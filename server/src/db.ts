import { randomUUID } from 'crypto'
import { PAY_SCHEMA } from './payments'
import { RAID_SCHEMA } from './raid'
import { PROGRESS_SCHEMA, trackRun } from './progress'
import { META_KEYS, MetaKey, ARMORY_COST, DAILY_REWARD, dayKey, clampRun } from './rules'

/** minimal pg-compatible client (pg.Pool in production, pg-mem in tests) */
export type Sql = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  address     TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Hunter',
  is_guest    BOOLEAN NOT NULL DEFAULT FALSE,
  bank        INTEGER NOT NULL DEFAULT 0,
  meta_might  INTEGER NOT NULL DEFAULT 0,
  meta_hp     INTEGER NOT NULL DEFAULT 0,
  meta_magnet INTEGER NOT NULL DEFAULT 0,
  meta_xp     INTEGER NOT NULL DEFAULT 0,
  best_time   INTEGER NOT NULL DEFAULT 0,
  best_level  INTEGER NOT NULL DEFAULT 0,
  best_kills  INTEGER NOT NULL DEFAULT 0,
  pvp_kills   INTEGER NOT NULL DEFAULT 0,
  total_runs  INTEGER NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  total_gold  INTEGER NOT NULL DEFAULT 0,
  flags       INTEGER NOT NULL DEFAULT 0,
  last_start  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  weapon      TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  time_sec    INTEGER,
  level       INTEGER,
  kills       INTEGER,
  gold_claim  INTEGER,
  gold_given  INTEGER,
  pvp_kills   INTEGER,
  killer      TEXT,
  flagged     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS runs_address ON runs(address);
ALTER TABLE players ADD COLUMN IF NOT EXISTS armory INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_last TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS double_last TEXT;
CREATE INDEX IF NOT EXISTS players_best ON players(best_time DESC);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS snapshot TEXT;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS checkpoint_at TIMESTAMPTZ;
`

export async function migrate(db: Sql) {
  for (const stmt of (SCHEMA + ';' + PAY_SCHEMA + ';' + RAID_SCHEMA + ';' + PROGRESS_SCHEMA).split(';').map((s) => s.trim()).filter(Boolean)) await db.query(stmt)
}

export type Profile = {
  address: string
  name: string
  guest: boolean
  bank: number
  meta: Record<MetaKey, number>
  best: { time: number; level: number; kills: number }
  pvpKills: number
  totalRuns: number
  totalKills: number
  armory: number
  daily: { streak: number; claimable: boolean; next: number; doubleReady: boolean }
}

export function toProfile(r: any): Profile {
  return {
    address: r.address,
    name: r.name,
    guest: r.is_guest,
    bank: r.bank,
    meta: { might: r.meta_might, hp: r.meta_hp, magnet: r.meta_magnet, xp: r.meta_xp },
    best: { time: r.best_time, level: r.best_level, kills: r.best_kills },
    pvpKills: r.pvp_kills,
    totalRuns: r.total_runs,
    totalKills: r.total_kills,
    armory: r.armory ?? 0,
    daily: dailyInfo(r)
  }
}

function yesterday() {
  return dayKey(Date.now() - 86400000)
}

export function dailyInfo(r: any) {
  const today = dayKey()
  const claimable = r.daily_last !== today
  const alive = r.daily_last === today || r.daily_last === yesterday()
  const streak = alive ? r.daily_streak ?? 0 : 0
  const nextStreak = claimable ? streak + 1 : streak + 1
  return {
    streak,
    claimable,
    next: DAILY_REWARD[Math.min(DAILY_REWARD.length, Math.max(1, nextStreak)) - 1],
    doubleReady: r.double_last !== today
  }
}

/** claim today's login reward; streak continues if yesterday was claimed */
export async function claimDaily(db: Sql, address: string) {
  const today = dayKey()
  const p = (await db.query('SELECT * FROM players WHERE address = $1', [address])).rows[0]
  if (!p || p.daily_last === today) return 0
  const streak = p.daily_last === yesterday() ? (p.daily_streak ?? 0) + 1 : 1
  const reward = DAILY_REWARD[Math.min(DAILY_REWARD.length, streak) - 1]
  const r = await db.query(
    "UPDATE players SET bank = bank + $1::integer, total_gold = total_gold + $2::integer, daily_last = $3, daily_streak = $4::integer, updated_at = NOW() WHERE address = $5 AND (daily_last IS NULL OR daily_last <> $6)",
    [reward, reward, today, streak, address, today]
  )
  return (r.rowCount ?? 0) > 0 ? reward : 0
}

/** buy the next armory weapon (must be bought in order) */
export async function buyArmory(db: Sql, address: string, tier: number) {
  if (!(tier >= 1 && tier < ARMORY_COST.length)) return false
  const cost = ARMORY_COST[tier]
  const r = await db.query(
    'UPDATE players SET bank = bank - $1::integer, armory = $2::integer, updated_at = NOW() WHERE address = $3 AND armory = $4::integer AND bank >= $5::integer',
    [cost, tier, address, tier - 1, cost]
  )
  return (r.rowCount ?? 0) > 0
}

export async function getOrCreate(db: Sql, address: string, name: string, guest: boolean) {
  const cur = await db.query('SELECT * FROM players WHERE address = $1', [address])
  if (cur.rows.length) {
    if (name && name !== cur.rows[0].name) {
      await db.query('UPDATE players SET name = $1, updated_at = NOW() WHERE address = $2', [name.slice(0, 32), address])
      cur.rows[0].name = name.slice(0, 32)
    }
    return cur.rows[0]
  }
  await db.query('INSERT INTO players (address, name, is_guest) VALUES ($1, $2, $3)', [address, (name || 'Hunter').slice(0, 32), guest])
  return (await db.query('SELECT * FROM players WHERE address = $1', [address])).rows[0]
}

export async function startRun(db: Sql, address: string, weapon: string) {
  const id = randomUUID()
  // runs left open (player left mid-run): bank what their last checkpoint earned, then close the rest
  await bankAbandoned(db, address)
  await db.query('UPDATE runs SET ended_at = NOW(), gold_given = 0 WHERE address = $1 AND ended_at IS NULL', [address])
  await db.query('INSERT INTO runs (id, address, weapon) VALUES ($1, $2, $3)', [id, address, weapon])
  await db.query('UPDATE players SET last_start = NOW() WHERE address = $1', [address])
  return id
}

const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const ms = (d: Date | string) => new Date(d).getTime()

/** latest checkpoint of a run left open in the last 48h — the player can resume it */
export async function getResume(db: Sql, address: string) {
  const r = await db.query('SELECT * FROM runs WHERE address = $1 AND ended_at IS NULL AND snapshot IS NOT NULL', [address])
  const rows = r.rows.filter((x: any) => x.checkpoint_at && Date.now() - ms(x.checkpoint_at) < 48 * 3600e3)
  rows.sort((a: any, b: any) => ms(b.checkpoint_at) - ms(a.checkpoint_at))
  const x = rows[0]
  if (!x) return null
  try {
    return { runId: x.id as string, snap: JSON.parse(x.snapshot) }
  } catch {
    return null
  }
}

/** mid-run checkpoint: saves the run for resume AND banks the gold earned so far (live gold) */
export async function saveCheckpoint(db: Sql, id: string, address: string, snap: any) {
  const text = JSON.stringify(snap ?? {})
  if (text.length > 16000) return null
  const run = (await db.query('SELECT * FROM runs WHERE id = $1 AND address = $2 AND ended_at IS NULL', [id, address])).rows[0]
  if (!run) return null
  await db.query(
    'UPDATE runs SET snapshot = $1, checkpoint_at = NOW(), time_sec = $2, level = $3, kills = $4, gold_claim = $5, pvp_kills = $6 WHERE id = $7',
    [text, Math.floor(num(snap?.time)), Math.floor(num(snap?.level)), Math.floor(num(snap?.kills)), Math.floor(num(snap?.gold)), Math.floor(num(snap?.pvpKills)), id]
  )
  // the latest build follows the hunter into the raid at -91,71
  const build = JSON.stringify({ level: snap?.level, weapons: snap?.weapons, passives: snap?.passives, evolved: snap?.evolved })
  if (build.length < 4000) await db.query('UPDATE players SET last_build = $1 WHERE address = $2', [build, address])
  const elapsed = (Date.now() - ms(run.started_at)) / 1000
  const res = clampRun({ time: num(snap?.time), level: num(snap?.level), kills: num(snap?.kills), gold: num(snap?.gold), pvpKills: num(snap?.pvpKills), killedByPlayer: false }, elapsed)
  const t = await trackRun(db, address, run, res, num(snap?.bossesSlain))
  // keep the stored (unclamped) values honest for the live boards
  await db.query('UPDATE runs SET time_sec = $1, level = $2, kills = $3 WHERE id = $4', [res.time, res.level, res.kills, id])
  return t
}

/** pay out checkpointed runs that were abandoned (clamped by the same anti-cheat rules as a normal finish) */
export async function bankAbandoned(db: Sql, address: string) {
  const r = await db.query('SELECT * FROM runs WHERE address = $1 AND ended_at IS NULL AND snapshot IS NOT NULL', [address])
  let total = 0
  for (const run of r.rows) {
    if (!run.checkpoint_at) continue
    const elapsed = (ms(run.checkpoint_at) - ms(run.started_at)) / 1000
    const res = clampRun(
      { time: num(run.time_sec), level: num(run.level), kills: num(run.kills), gold: num(run.gold_claim), pvpKills: num(run.pvp_kills), killedByPlayer: false },
      elapsed
    )
    const fin = await finishRun(db, run, address, res, num(run.gold_claim), null)
    total += fin.paid + fin.bonus
  }
  return total
}

export async function getOpenRun(db: Sql, id: string, address: string) {
  const r = await db.query('SELECT * FROM runs WHERE id = $1 AND address = $2 AND ended_at IS NULL', [id, address])
  return r.rows[0] as undefined | { id: string; started_at: Date | string }
}

export async function finishRun(
  db: Sql,
  run: any,
  address: string,
  res: { time: number; level: number; kills: number; gold: number; pvpKills: number; flagged: boolean },
  claimGold: number,
  killer: string | null,
  bossesClaim = 0
) {
  // live gold: whatever checkpoints have not banked yet (nothing already banked is taken back)
  const fresh = (await db.query('SELECT * FROM runs WHERE id = $1', [run.id])).rows[0] ?? run
  const t = await trackRun(db, address, fresh, res, Math.max(bossesClaim, num(fresh.bosses)))
  const p = (await db.query('SELECT * FROM players WHERE address = $1', [address])).rows[0]
  const newBest = res.time > p.best_time
  // first finished run of the day banks double gold
  const today = dayKey()
  let bonus = 0
  if (p.double_last !== today && res.gold > 0 && !res.flagged) {
    bonus = res.gold
    await db.query('UPDATE players SET double_last = $1 WHERE address = $2', [today, address])
  }
  await db.query(
    'UPDATE runs SET ended_at = NOW(), time_sec = $1, level = $2, kills = $3, gold_claim = $4, pvp_kills = $5, killer = $6, flagged = $7 WHERE id = $8',
    [res.time, res.level, res.kills, claimGold, res.pvpKills, killer, res.flagged, run.id]
  )
  await db.query(
    `UPDATE players SET bank = bank + $1, total_gold = total_gold + $1, total_runs = total_runs + 1, total_kills = total_kills + $2,
       pvp_kills = pvp_kills + $3, flags = flags + $4,
       best_time = $5, best_level = $6, best_kills = $7, updated_at = NOW() WHERE address = $8`,
    [
      bonus, res.kills, res.pvpKills, res.flagged ? 1 : 0,
      newBest ? res.time : p.best_time, newBest ? res.level : p.best_level, newBest ? res.kills : p.best_kills, address
    ]
  )
  return { newBest, bonus, paid: t.banked, slayer: t.slayer }
}

export async function buy(db: Sql, address: string, key: MetaKey, cost: number) {
  if (!META_KEYS.includes(key)) return false
  const col = `meta_${key}`
  const r = await db.query(`UPDATE players SET bank = bank - $1::integer, ${col} = ${col} + 1, updated_at = NOW() WHERE address = $2 AND bank >= $3::integer`, [cost, address, cost])
  return (r.rowCount ?? 0) > 0
}

export async function leaderboard(db: Sql) {
  const runs = await db.query('SELECT name, best_time, best_level, best_kills FROM players WHERE best_time > 0 AND flags < 3 ORDER BY best_time DESC, best_kills DESC LIMIT 10')
  const pvp = await db.query('SELECT name, pvp_kills FROM players WHERE pvp_kills > 0 AND flags < 3 ORDER BY pvp_kills DESC LIMIT 5')
  const total = await db.query('SELECT COUNT(*) AS n FROM players')
  return {
    runs: runs.rows.map((r) => ({ n: r.name, t: r.best_time, l: r.best_level, k: r.best_kills })),
    pvp: pvp.rows.map((r) => [r.name, r.pvp_kills] as [string, number]),
    players: Number(total.rows[0].n)
  }
}

export async function rankOf(db: Sql, time: number) {
  const r = await db.query('SELECT COUNT(*) AS n FROM players WHERE best_time > $1 AND flags < 3', [time])
  return Number(r.rows[0].n) + 1
}

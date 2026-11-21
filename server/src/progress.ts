// Live progression: gold banked every checkpoint, live + weekly + all-time rankings, daily quests,
// and the one-time reward for slaying NIGHTSWARM (the Lv 200 boss).
import type { Sql } from './db'

export const PROGRESS_SCHEMA = `
ALTER TABLE runs ADD COLUMN IF NOT EXISTS bosses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS q_kills INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS q_bosses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS q_gold INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS slayer_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS player_quests (
  day     TEXT NOT NULL,
  address TEXT NOT NULL,
  kills   INTEGER NOT NULL DEFAULT 0,
  bosses  INTEGER NOT NULL DEFAULT 0,
  level   INTEGER NOT NULL DEFAULT 0,
  time    INTEGER NOT NULL DEFAULT 0,
  gold    INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, address)
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_hp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_rage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS pot_phoenix INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS weekly_paid (
  week    TEXT PRIMARY KEY,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const KST = 9 * 3600e3
/** quests reset at midnight KST */
export const questDay = (t = Date.now()) => new Date(t + KST).toISOString().slice(0, 10)
/** weeks start Monday 00:00 KST */
export function weekStart(t = Date.now()) {
  const k = new Date(t + KST)
  const dow = (k.getUTCDay() + 6) % 7
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow) - KST
}
export const weekKey = (t = Date.now()) => new Date(weekStart(t) + KST).toISOString().slice(0, 10)

// ───────────── NIGHTSWARM slayer ─────────────
// bosses: every ladder boss up to and including NIGHTSWARM (src/game/defs.ts NIGHTSWARM_INDEX + 1)
export const SLAYER = { gold: 100_000, items: ['title_nightswarm', 'void_wings'], bosses: 23, level: 200 }

// ───────────── weekly prizes (paid lazily when a new week's board is first read) ─────────────
export const WEEKLY_PRIZE = [30_000, 20_000, 15_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000, 6_000]

// ───────────── daily quests ─────────────
export type QuestKind = 'kills' | 'level' | 'time' | 'bosses' | 'gold'
const QUEST_TARGET: Record<QuestKind, number[]> = { kills: [300, 900, 1800], level: [20, 35, 55], time: [300, 600, 900], bosses: [1, 2, 3], gold: [800, 2500, 6000] }
export const QUEST_REWARD = [600, 1200, 2500]
const QUEST_TEXT: Record<QuestKind, (t: number) => string> = {
  kills: (t) => `Slay ${t.toLocaleString()} monsters`,
  level: (t) => `Reach level ${t} in one run`,
  time: (t) => `Survive ${Math.round(t / 60)} minutes in one run`,
  bosses: (t) => `Defeat ${t} boss${t > 1 ? 'es' : ''}`,
  gold: (t) => `Earn ${t.toLocaleString()} gold from runs`
}
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
/** today's 3 quests for this hunter (easy / medium / hard, three different kinds) */
export function questsFor(day: string, address: string) {
  const kinds: QuestKind[] = ['kills', 'level', 'time', 'bosses', 'gold']
  let h = hash(day + address)
  const pick: QuestKind[] = []
  while (pick.length < 3) {
    const k = kinds[h % kinds.length]
    if (!pick.includes(k)) pick.push(k)
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0
  }
  return pick.map((kind, tier) => ({ kind, tier, target: QUEST_TARGET[kind][tier], reward: QUEST_REWARD[tier], text: QUEST_TEXT[kind](QUEST_TARGET[kind][tier]) }))
}

export async function questState(db: Sql, address: string, now = Date.now()) {
  const day = questDay(now)
  const row = (await db.query('SELECT * FROM player_quests WHERE day = $1 AND address = $2', [day, address])).rows[0] ?? {}
  const claimed = n(row.claimed)
  return {
    day,
    resetsAt: Date.UTC(new Date(now + KST).getUTCFullYear(), new Date(now + KST).getUTCMonth(), new Date(now + KST).getUTCDate() + 1) - KST,
    quests: questsFor(day, address).map((q, i) => {
      const prog = n(row[q.kind])
      return { ...q, progress: Math.min(prog, q.target), done: prog >= q.target, claimed: !!(claimed & (1 << i)) }
    })
  }
}

export async function claimQuest(db: Sql, address: string, i: number, now = Date.now()) {
  const st = await questState(db, address, now)
  const q = st.quests[i]
  if (!q || !q.done || q.claimed) return 0
  const row = (await db.query('SELECT claimed FROM player_quests WHERE day = $1 AND address = $2', [st.day, address])).rows[0]
  const old = n(row?.claimed)
  if (old & (1 << i)) return 0
  const r = await db.query('UPDATE player_quests SET claimed = $1 WHERE day = $2 AND address = $3 AND claimed = $4', [old | (1 << i), st.day, address, old])
  if (!r.rowCount) return 0
  await db.query('UPDATE players SET bank = bank + $1, total_gold = total_gold + $1, updated_at = NOW() WHERE address = $2', [q.reward, address])
  return q.reward
}

/**
 * Called on every checkpoint and at the end of a run with the clamped result.
 * Banks newly earned gold (live gold), feeds daily quests and checks the NIGHTSWARM reward.
 * `final` = the run ended (pvp death may lower res.gold below what was already banked: nothing is taken back).
 */
export async function trackRun(db: Sql, address: string, run: any, res: { time: number; level: number; kills: number; gold: number; flagged: boolean }, bossesClaim: number) {
  const bosses = Math.max(0, Math.min(Math.floor(n(bossesClaim)), 3 + Math.floor(res.level / 8)))
  const given = n(run.gold_given)
  // clampRun already caps gold to what is physically possible; over-claims are flagged off the boards
  const bankNow = Math.max(0, res.gold - given)
  if (bankNow > 0) await db.query('UPDATE players SET bank = bank + $1, total_gold = total_gold + $1, updated_at = NOW() WHERE address = $2', [bankNow, address])
  const dk = Math.max(0, res.kills - n(run.q_kills))
  const dB = Math.max(0, bosses - n(run.q_bosses))
  const dg = Math.max(0, res.gold - n(run.q_gold))
  await db.query('UPDATE runs SET gold_given = $1, bosses = $2, q_kills = $3, q_bosses = $4, q_gold = $5 WHERE id = $6', [
    Math.max(given, given + bankNow), bosses, Math.max(n(run.q_kills), res.kills), Math.max(n(run.q_bosses), bosses), Math.max(n(run.q_gold), res.gold), run.id
  ])
  const day = questDay()
  const q = await db.query('UPDATE player_quests SET kills = kills + $1, bosses = bosses + $2, gold = gold + $3 WHERE day = $4 AND address = $5', [dk, dB, dg, day, address])
  if (!q.rowCount) await db.query('INSERT INTO player_quests (day, address, kills, bosses, gold, level, time) VALUES ($1, $2, $3, $4, $5, 0, 0)', [day, address, dk, dB, dg])
  const cur = (await db.query('SELECT level, time FROM player_quests WHERE day = $1 AND address = $2', [day, address])).rows[0]
  if (cur && (res.level > n(cur.level) || res.time > n(cur.time)))
    await db.query('UPDATE player_quests SET level = $1, time = $2 WHERE day = $3 AND address = $4', [Math.max(n(cur.level), res.level), Math.max(n(cur.time), res.time), day, address])
  let slayer = false
  if (!res.flagged && bosses >= SLAYER.bosses && res.level >= SLAYER.level) slayer = await grantSlayer(db, address)
  return { banked: bankNow, slayer }
}

export async function grantSlayer(db: Sql, address: string) {
  const r = await db.query('UPDATE players SET slayer_at = NOW(), bank = bank + $1, total_gold = total_gold + $1 WHERE address = $2 AND slayer_at IS NULL', [SLAYER.gold, address])
  if (!r.rowCount) return false
  for (const it of SLAYER.items) {
    const u = await db.query('UPDATE player_items SET qty = qty + 1 WHERE address = $1 AND item = $2', [address, it])
    if (!u.rowCount) await db.query('INSERT INTO player_items (address, item, qty) VALUES ($1, $2, 1)', [address, it])
  }
  // wear them right away
  await db.query("UPDATE players SET cosmetic = 'void_wings', title = 'title_nightswarm' WHERE address = $1", [address])
  return true
}

// ───────────── rankings (live) ─────────────
type Row = { n: string; t: number; l: number; k: number; live?: boolean }
function liveCutoff(now: number) {
  return now - 60_000
}

/** all-time board (personal bests) with players who are mid-run right now merged in live */
export async function boards(db: Sql, now = Date.now()) {
  await payWeekly(db, now)
  const best = (await db.query('SELECT address, name, best_time, best_level, best_kills FROM players WHERE best_time > 0 AND flags < 3 ORDER BY best_time DESC, best_kills DESC LIMIT 30')).rows
  const open = (await db.query('SELECT r.address, r.time_sec, r.level, r.kills, r.checkpoint_at, p.name, p.flags FROM runs r JOIN players p ON p.address = r.address WHERE r.ended_at IS NULL AND r.checkpoint_at IS NOT NULL')).rows.filter(
    (r: any) => new Date(r.checkpoint_at).getTime() > liveCutoff(now) && n(r.flags) < 3
  )
  const liveBy = new Map<string, any>(open.map((r: any) => [r.address, r]))
  const all = new Map<string, Row>()
  for (const p of best) all.set(p.address, { n: p.name, t: n(p.best_time), l: n(p.best_level), k: n(p.best_kills) })
  for (const r of open) {
    const cur = all.get(r.address)
    if (!cur || n(r.time_sec) > cur.t) all.set(r.address, { n: r.name, t: n(r.time_sec), l: n(r.level), k: n(r.kills), live: true })
    else cur.live = true
  }
  const allTime = [...all.values()].sort((a, b) => b.t - a.t || b.k - a.k).slice(0, 10)

  const ws = weekStart(now)
  const week = (await db.query('SELECT r.address, r.time_sec, r.level, r.kills, r.ended_at, r.checkpoint_at, r.flagged, p.name, p.flags FROM runs r JOIN players p ON p.address = r.address WHERE r.started_at >= $1 AND r.time_sec IS NOT NULL', [new Date(ws)])).rows
  const wk = new Map<string, Row>()
  for (const r of week) {
    if (r.flagged || n(r.flags) >= 3) continue
    const live = !r.ended_at && r.checkpoint_at && new Date(r.checkpoint_at).getTime() > liveCutoff(now)
    const cur = wk.get(r.address)
    const row = { n: r.name, t: n(r.time_sec), l: n(r.level), k: n(r.kills), live: !!live || !!cur?.live }
    if (!cur || row.t > cur.t) wk.set(r.address, row)
    else if (live) cur.live = true
  }
  const weekly = [...wk.values()].sort((a, b) => b.t - a.t || b.k - a.k).slice(0, 10)
  const slayers = (await db.query('SELECT name, slayer_at FROM players WHERE slayer_at IS NOT NULL ORDER BY slayer_at ASC LIMIT 20')).rows.map((r: any) => r.name)
  return { allTime, weekly, slayers, live: liveBy.size, week: weekKey(now), weekEndsAt: ws + 7 * 86400e3, prizes: WEEKLY_PRIZE }
}

/** pay last week's top 10 once, the first time anything reads the boards in a new week */
export async function payWeekly(db: Sql, now = Date.now()) {
  const prevStart = weekStart(now) - 7 * 86400e3
  const key = weekKey(prevStart + 3600e3)
  const done = (await db.query('SELECT week FROM weekly_paid WHERE week = $1', [key])).rows[0]
  if (done) return false
  try {
    await db.query('INSERT INTO weekly_paid (week) VALUES ($1)', [key])
  } catch {
    return false // another request is paying it
  }
  const rows = (await db.query('SELECT r.address, r.time_sec, r.kills, r.flagged, p.flags FROM runs r JOIN players p ON p.address = r.address WHERE r.started_at >= $1 AND r.started_at < $2 AND r.time_sec IS NOT NULL', [new Date(prevStart), new Date(prevStart + 7 * 86400e3)])).rows
  const best = new Map<string, { t: number; k: number }>()
  for (const r of rows) {
    if (r.flagged || n(r.flags) >= 3) continue
    const c = best.get(r.address)
    if (!c || n(r.time_sec) > c.t) best.set(r.address, { t: n(r.time_sec), k: n(r.kills) })
  }
  const ranked = [...best.entries()].sort((a, b) => b[1].t - a[1].t || b[1].k - a[1].k).slice(0, WEEKLY_PRIZE.length)
  for (let i = 0; i < ranked.length; i++) {
    const [address] = ranked[i]
    await db.query('UPDATE players SET bank = bank + $1, total_gold = total_gold + $1 WHERE address = $2', [WEEKLY_PRIZE[i], address])
    if (i < 3) {
      const u = await db.query('UPDATE player_items SET qty = qty + 1 WHERE address = $1 AND item = $2', [address, 'title_champion'])
      if (!u.rowCount) await db.query('INSERT INTO player_items (address, item, qty) VALUES ($1, $2, 1)', [address, 'title_champion'])
      await db.query("UPDATE players SET title = 'title_champion' WHERE address = $1 AND title IS NULL", [address])
    }
  }
  return true
}


// ───────────── potion belt: bought in the lobby, packed into the next run ─────────────
export const POTIONS = {
  hp: { cost: 150, max: 5, col: 'pot_hp' },
  rage: { cost: 400, max: 3, col: 'pot_rage' },
  phoenix: { cost: 2500, max: 1, col: 'pot_phoenix' }
} as const
export type PotionId = keyof typeof POTIONS
export const beltOf = (p: any) => ({ hp: n(p?.pot_hp), rage: n(p?.pot_rage), phoenix: n(p?.pot_phoenix) })

export async function buyPotion(db: Sql, address: string, id: string) {
  const d = (POTIONS as any)[id] as (typeof POTIONS)[PotionId] | undefined
  if (!d) return false
  const r = await db.query(`UPDATE players SET bank = bank - $1::integer, ${d.col} = ${d.col} + 1, updated_at = NOW() WHERE address = $2 AND bank >= $3::integer AND ${d.col} < $4::integer`, [d.cost, address, d.cost, d.max])
  return (r.rowCount ?? 0) > 0
}

/** the whole belt goes into the run that starts now */
export async function packBelt(db: Sql, address: string) {
  const p = (await db.query('SELECT pot_hp, pot_rage, pot_phoenix FROM players WHERE address = $1', [address])).rows[0]
  const belt = beltOf(p)
  await db.query('UPDATE players SET pot_hp = 0, pot_rage = 0, pot_phoenix = 0 WHERE address = $1', [address])
  return belt
}

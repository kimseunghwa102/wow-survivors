// THE PALE SOVEREIGN — a co-op world boss that lives at -91,71.
// One shared health pool per day (resets at midnight KST), damage is clamped by what each hunter
// could plausibly deal, and everyone who fought gets cosmetic loot + gold when it falls.
import type { Express, Request, Response } from 'express'
import type { Sql } from './db'

/** Must match RAID in src/raid/defs.ts */
export const RAID = {
  maxHp: 8_000_000,
  /** sustained damage/second vs the reaper by highest armory tier owned (fists … divine) */
  dps: [15, 60, 100, 320, 520, 850, 2200, 7800, 26500],
  /** run-level scaling, same curve as the main game's manual weapons (capped at Lv 200) */
  levelScale: (lvl: number) => 1 + 0.02 * (Math.min(200, Math.max(1, lvl)) - 1),
  slack: 1.3,
  burst: 45_000, // a nuke can land on top of the sustained budget
  window: 30, // seconds of unspent budget a hunter may bank
  minShare: 0.0015, // ≥0.15% of the boss's health to qualify for loot
  goldPool: 60_000, // split by damage share …
  goldMin: 1_500, // … with a floor for everyone who qualifies
  goldMax: 25_000
}

/** auto-skill damage per second per skill level vs the reaper (must match raid/src/defs.ts SKILL_DPS) */
export const SKILL_DPS: Record<string, number> = { lash: 30, bolt: 28, orbit: 25, aura: 22, thunder: 35, nova: 32 }
export type Build = { level: number; weapons: [string, number][]; passives: [string, number][]; evolved: string[] }
/** the build a hunter brings into the raid (their latest run), condensed */
export function buildOf(raw: any): Build | null {
  try {
    const b = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!b || !Array.isArray(b.weapons)) return null
    return {
      level: Math.max(1, Math.min(999, Math.floor(n(b.level)))),
      weapons: b.weapons.filter((w: any) => SKILL_DPS[w?.[0]] !== undefined).slice(0, 6).map((w: any) => [String(w[0]), Math.max(1, Math.min(8, Math.floor(n(w[1]))))]),
      passives: (b.passives ?? []).slice(0, 6).map((p: any) => [String(p[0]), Math.max(1, Math.min(5, Math.floor(n(p[1]))))]),
      evolved: (b.evolved ?? []).filter((x: any) => SKILL_DPS[x] !== undefined).slice(0, 6).map(String)
    }
  } catch {
    return null
  }
}
/** total auto-skill dps of a build (same formula on the client) */
export function skillDps(b: Build | null) {
  if (!b) return 0
  const pv = (id: string) => b.passives.find((p) => p[0] === id)?.[1] ?? 0
  const mult = 1 + 0.08 * pv('might') + 0.06 * pv('haste') + 0.05 * pv('duplicator')
  let d = 0
  for (const [w, lv] of b.weapons) d += SKILL_DPS[w] * lv * (b.evolved.includes(w) ? 1.6 : 1)
  return d * mult * RAID.levelScale(b.level)
}

/** cosmetic loot table (ids must match src/raid/defs.ts COSMETICS) */
export const COSMETICS = [
  { id: 'title_slayer', rarity: 'common', w: 34 },
  { id: 'title_bane', rarity: 'common', w: 26 },
  { id: 'lantern', rarity: 'rare', w: 16 },
  { id: 'crown', rarity: 'rare', w: 12 },
  { id: 'hourglass', rarity: 'epic', w: 6 },
  { id: 'shroud', rarity: 'epic', w: 4.5 },
  { id: 'scythe_skin', rarity: 'legendary', w: 1.5 },
  // not dropped by the reaper: NIGHTSWARM slayers and weekly champions
  { id: 'title_nightswarm', rarity: 'legendary', w: 0 },
  { id: 'void_wings', rarity: 'legendary', w: 0 },
  { id: 'title_champion', rarity: 'epic', w: 0 },
  // the one who beat THE ALMIGHTY
  { id: 'title_god', rarity: 'divine', w: 0 },
  { id: 'god_skin', rarity: 'divine', w: 0 }
] as const
export type CosmeticId = (typeof COSMETICS)[number]['id']
const COS_IDS = new Set<string>(COSMETICS.map((c) => c.id))

export const RAID_SCHEMA = `
CREATE TABLE IF NOT EXISTS raid_days (
  day       TEXT PRIMARY KEY,
  hp        BIGINT NOT NULL,
  max_hp    BIGINT NOT NULL,
  started   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  killed_at TIMESTAMPTZ,
  killer    TEXT
);
CREATE TABLE IF NOT EXISTS raid_dmg (
  day      TEXT NOT NULL,
  address  TEXT NOT NULL,
  name     TEXT NOT NULL DEFAULT 'Hunter',
  dmg      BIGINT NOT NULL DEFAULT 0,
  last_hit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day, address)
);
CREATE TABLE IF NOT EXISTS raid_loot (
  day     TEXT NOT NULL,
  address TEXT NOT NULL,
  items   TEXT NOT NULL,
  gold    INTEGER NOT NULL,
  PRIMARY KEY (day, address)
);
CREATE TABLE IF NOT EXISTS player_items (
  address TEXT NOT NULL,
  item    TEXT NOT NULL,
  qty     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, item)
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS cosmetic TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_build TEXT`

/** the reaper's day turns over at midnight Korea time */
export const raidDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10)
export const nextRespawn = (t = Date.now()) => {
  const k = new Date(t + 9 * 3600e3)
  return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1) - 9 * 3600e3
}
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const ms = (d: any) => new Date(d).getTime()

export async function raidToday(db: Sql, now = Date.now()) {
  const day = raidDay(now)
  let r = (await db.query('SELECT * FROM raid_days WHERE day = $1', [day])).rows[0]
  if (!r) {
    try {
      await db.query('INSERT INTO raid_days (day, hp, max_hp) VALUES ($1, $2, $2)', [day, RAID.maxHp])
    } catch {}
    r = (await db.query('SELECT * FROM raid_days WHERE day = $1', [day])).rows[0]
  }
  return r
}

export async function raidState(db: Sql, address?: string, now = Date.now()) {
  const r = await raidToday(db, now)
  const top = (await db.query('SELECT name, dmg FROM raid_dmg WHERE day = $1 ORDER BY dmg DESC LIMIT 8', [r.day])).rows
  const mine = address ? (await db.query('SELECT dmg FROM raid_dmg WHERE day = $1 AND address = $2', [r.day, address])).rows[0] : null
  const loot = address ? (await db.query('SELECT items, gold FROM raid_loot WHERE day = $1 AND address = $2', [r.day, address])).rows[0] : null
  return {
    day: r.day,
    hp: n(r.hp),
    maxHp: n(r.max_hp),
    alive: !r.killed_at,
    killedAt: r.killed_at ? ms(r.killed_at) : 0,
    killer: r.killer ?? null,
    respawnAt: nextRespawn(now),
    started: ms(r.started),
    now,
    top: top.map((t: any) => ({ n: t.name, d: n(t.dmg) })),
    myDmg: mine ? n(mine.dmg) : 0,
    myLoot: loot ? { items: JSON.parse(loot.items), gold: n(loot.gold) } : null
  }
}

/** most damage this hunter could have dealt since their last accepted hit */
export function allowance(p: { armory: number; best_level: number; last_build?: string | null }, sinceLastSec: number) {
  const tier = Math.max(0, Math.min(RAID.dps.length - 1, n(p.armory)))
  const dps = (RAID.dps[tier] * RAID.levelScale(n(p.best_level)) + skillDps(buildOf(p.last_build))) * RAID.slack
  const burst = tier >= 6 && sinceLastSec >= 25 ? RAID.burst * RAID.levelScale(n(p.best_level)) : 0
  return Math.floor(dps * Math.min(RAID.window, Math.max(0, sinceLastSec)) + burst)
}

export async function raidHit(db: Sql, address: string, name: string, claimed: number, now = Date.now()) {
  const r = await raidToday(db, now)
  if (r.killed_at) return { accepted: 0, killed: false }
  const p = (await db.query('SELECT armory, best_level, is_guest, last_build FROM players WHERE address = $1', [address])).rows[0]
  if (!p) return { accepted: 0, killed: false }
  let row = (await db.query('SELECT * FROM raid_dmg WHERE day = $1 AND address = $2', [r.day, address])).rows[0]
  if (!row) {
    // first contact: the budget starts now (plus a few seconds of grace for the walk in)
    await db.query('INSERT INTO raid_dmg (day, address, name, dmg, last_hit) VALUES ($1, $2, $3, 0, $4)', [r.day, address, name.slice(0, 32), new Date(now - 5000)])
    row = { dmg: 0, last_hit: new Date(now - 5000) }
  }
  const since = (now - ms(row.last_hit)) / 1000
  const accepted = Math.max(0, Math.min(Math.floor(n(claimed)), allowance(p, since), n(r.hp)))
  if (accepted <= 0) return { accepted: 0, killed: false }
  await db.query('UPDATE raid_dmg SET dmg = dmg + $1, last_hit = $2, name = $3 WHERE day = $4 AND address = $5', [accepted, new Date(now), name.slice(0, 32), r.day, address])
  const up = await db.query('UPDATE raid_days SET hp = hp + $1 WHERE day = $2 AND killed_at IS NULL', [-accepted, r.day])
  const cur = (await db.query('SELECT hp FROM raid_days WHERE day = $1', [r.day])).rows[0]
  if (up.rowCount && cur && n(cur.hp) <= 0) {
    // only one request can flip killed_at (the WHERE guards the race)
    const won = await db.query('UPDATE raid_days SET hp = 0, killed_at = $1, killer = $2 WHERE day = $3 AND killed_at IS NULL', [new Date(now), name.slice(0, 32), r.day])
    if (won.rowCount) {
      await distributeLoot(db, r.day, n(r.max_hp))
      return { accepted, killed: true }
    }
  }
  return { accepted, killed: false }
}

/** weighted roll; `rand` injectable for tests */
export function rollItems(count: number, rand = Math.random): CosmeticId[] {
  const total = COSMETICS.reduce((s, c) => s + c.w, 0)
  const out: CosmeticId[] = []
  for (let i = 0; i < count; i++) {
    let x = rand() * total
    for (const c of COSMETICS) {
      x -= c.w
      if (x <= 0) {
        out.push(c.id)
        break
      }
    }
    if (out.length < i + 1) out.push(COSMETICS[0].id)
  }
  return out
}

async function distributeLoot(db: Sql, day: string, maxHp: number, rand = Math.random) {
  const rows = (await db.query('SELECT address, dmg FROM raid_dmg WHERE day = $1', [day])).rows
  const ranked = rows.map((x: any) => ({ address: x.address, dmg: n(x.dmg) })).sort((a: any, b: any) => b.dmg - a.dmg)
  for (let i = 0; i < ranked.length; i++) {
    const { address, dmg } = ranked[i]
    const share = dmg / maxHp
    if (share < RAID.minShare) continue
    // 2 drops for everyone, +1 for 5%+ damage, +1 for the top 3
    const count = 2 + (share >= 0.05 ? 1 : 0) + (i < 3 ? 1 : 0)
    const items = rollItems(count, rand)
    const gold = Math.round(Math.min(RAID.goldMax, Math.max(RAID.goldMin, RAID.goldPool * share)))
    await db.query('INSERT INTO raid_loot (day, address, items, gold) VALUES ($1, $2, $3, $4)', [day, address, JSON.stringify(items), gold])
    await db.query('UPDATE players SET bank = bank + $1, total_gold = total_gold + $1, updated_at = NOW() WHERE address = $2', [gold, address])
    for (const it of items) {
      const u = await db.query('UPDATE player_items SET qty = qty + 1 WHERE address = $1 AND item = $2', [address, it])
      if (!u.rowCount) await db.query('INSERT INTO player_items (address, item, qty) VALUES ($1, $2, 1)', [address, it])
    }
  }
}

export async function inventory(db: Sql, address: string) {
  const items = (await db.query('SELECT item, qty FROM player_items WHERE address = $1', [address])).rows
  const p = (await db.query('SELECT cosmetic, title, last_build FROM players WHERE address = $1', [address])).rows[0]
  return { items: Object.fromEntries(items.map((r: any) => [r.item, n(r.qty)])), cosmetic: p?.cosmetic ?? null, title: p?.title ?? null, build: buildOf(p?.last_build) }
}

export async function equipCosmetic(db: Sql, address: string, item: string | null) {
  if (item === null || item === '') {
    await db.query('UPDATE players SET cosmetic = NULL WHERE address = $1', [address])
    return true
  }
  if (!COS_IDS.has(item)) return false
  const own = (await db.query('SELECT qty FROM player_items WHERE address = $1 AND item = $2', [address, item])).rows[0]
  if (!own || n(own.qty) <= 0) return false
  const col = item.startsWith('title_') ? 'title' : 'cosmetic'
  await db.query(`UPDATE players SET ${col} = $1 WHERE address = $2`, [item, address])
  return true
}

type Authed = (fn: (req: Request, res: Response, a: { address: string; guest: boolean; meta: any }) => Promise<unknown>) => any

export function raidRoutes(app: Express, db: Sql, authed: Authed, getOrCreate: (db: Sql, a: string, n: string, g: boolean) => Promise<any>) {
  const nm = (req: Request) => String(req.body?.name ?? '').slice(0, 32)
  // public state (spectators, the portal sign in the castle)
  app.get('/api/raid', async (_req, res, next) => {
    try {
      res.json({ ok: true, raid: await raidState(db) })
    } catch (e) {
      next(e)
    }
  })
  app.post(
    '/api/raid/state',
    authed(async (_req, res, a) => {
      res.json({ ok: true, raid: await raidState(db, a.address), inv: await inventory(db, a.address) })
    })
  )
  app.post(
    '/api/raid/hit',
    authed(async (req, res, a) => {
      if (a.guest) return res.status(403).json({ ok: false, error: 'connect a wallet to fight the reaper' })
      await getOrCreate(db, a.address, nm(req), a.guest)
      const r = await raidHit(db, a.address, nm(req) || 'Hunter', n(req.body?.dmg))
      res.json({ ok: true, ...r, raid: await raidState(db, a.address), inv: r.killed ? await inventory(db, a.address) : undefined })
    })
  )
  app.post(
    '/api/cosmetic/equip',
    authed(async (req, res, a) => {
      const ok = await equipCosmetic(db, a.address, req.body?.item ?? null)
      res.status(ok ? 200 : 400).json({ ok, inv: await inventory(db, a.address), error: ok ? undefined : 'you do not own that item' })
    })
  )
}

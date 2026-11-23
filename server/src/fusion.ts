// Fusion recipe book: every new fused art a hunter makes (Lv 250+) is saved to their account,
// and the first time they make each recipe they get a small gold reward.
import type { Sql } from './db'

export const FUSION_SCHEMA = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS codex TEXT NOT NULL DEFAULT ''`

/** mirrors ART_ELEMENT in src/game/defs.ts (keep the two in step) */
export const ART_ELEMENT: Record<string, string> = {
  ember: 'fire', fan: 'blade', tide: 'tide', lances: 'light', kunai: 'shadow', drums: 'thunder', fist: 'ki', stars: 'light',
  broadside: 'shadow', pillars: 'light', blacksun: 'fire', wheel: 'light', kiburst: 'ki', cannonade: 'shadow', cuts: 'blade',
  judgment: 'light', hellrain: 'fire', horizon: 'shadow', foxfire: 'fire', phantom: 'shadow', raijin: 'thunder', eyes: 'light',
  abyss: 'tide', sixarms: 'blade', timestop: 'time', wrath: 'ki', genesis: 'light'
}
export const FUSION_LVL = 250
export const MAX_ESSENCE = 3
export const REWARD_PER_STAR = 100
/** the book never grows past this (27 cores × element mixes is far below it in practice) */
export const CODEX_MAX = 600

/** a recipe is the core art plus the elements melted into it (order of essences does not matter) */
export function recipeKey(core: string, essences: string[]): string | null {
  if (!ART_ELEMENT[core] || !Array.isArray(essences) || !essences.length || essences.length > MAX_ESSENCE) return null
  const els: string[] = []
  for (const e of essences) {
    if (typeof e !== 'string' || !ART_ELEMENT[e] || e === core) return null
    els.push(ART_ELEMENT[e])
  }
  return `${core}|${els.sort().join('+')}`
}

export function codexOf(row: any): string[] {
  return String(row?.codex || '')
    .split(',')
    .filter(Boolean)
}

/**
 * Record a fusion. The run must be open and its latest checkpoint at Lv 250+ (the checkpoint's level is
 * already clamped by the anti-cheat rules), so the book can only grow from real play.
 */
export async function recordFusion(db: Sql, address: string, runId: string, core: string, essences: string[]) {
  const key = recipeKey(core, essences)
  if (!key) return { ok: false as const, error: 'bad recipe' }
  const run = (await db.query('SELECT level FROM runs WHERE id = $1 AND address = $2 AND ended_at IS NULL', [runId, address])).rows[0]
  if (!run) return { ok: false as const, error: 'run not found or already finished' }
  if (Number(run.level) < FUSION_LVL) return { ok: false as const, error: 'fusion opens at Lv 250' }
  const p = (await db.query('SELECT codex FROM players WHERE address = $1', [address])).rows[0]
  if (!p) return { ok: false as const, error: 'no profile' }
  const book = codexOf(p)
  if (book.includes(key)) return { ok: true as const, isNew: false, reward: 0, key, codex: book }
  if (book.length >= CODEX_MAX) return { ok: true as const, isNew: false, reward: 0, key, codex: book }
  const reward = REWARD_PER_STAR * essences.length
  // append only if still missing (two quick calls can't both pay)
  const upd = await db.query(
    "UPDATE players SET codex = CASE WHEN codex = '' THEN $1 ELSE codex || ',' || $1 END, bank = bank + $2 WHERE address = $3 AND NOT ((',' || codex || ',') LIKE $4) RETURNING codex",
    [key, reward, address, '%,' + key + ',%']
  )
  if (!upd.rows.length) return { ok: true as const, isNew: false, reward: 0, key, codex: book }
  return { ok: true as const, isNew: true, reward, key, codex: codexOf(upd.rows[0]) }
}

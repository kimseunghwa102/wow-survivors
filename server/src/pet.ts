// SOULBOUND PET: every hunter tames one monster, then melts the souls of the monsters they hunt into it.
// Souls drop in runs (1 per SOUL_EVERY kills of a kind, counted on the hunter's side) and are banked here,
// capped by the run's clamped kill count so they can only come from real play.
import type { Sql } from './db'

export const PET_SCHEMA = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS pet TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS souls TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS souls_banked INTEGER NOT NULL DEFAULT 0`

/** must match PET_KINDS in src/game/defs.ts */
export const PET_KINDS = ['bat', 'ghoul', 'skeleton', 'wraith', 'slime', 'spider', 'imp', 'wisp', 'hound', 'brute'] as const
export type PetKind = (typeof PET_KINDS)[number]
export const SOUL_EVERY = 20
export const PET_MAX_FED = 1_000_000

export type Pet = { base: PetKind; mix: Partial<Record<PetKind, number>>; fed: number; at: string }

const isKind = (k: any): k is PetKind => typeof k === 'string' && (PET_KINDS as readonly string[]).includes(k)

export function petOf(r: any): Pet | null {
  try {
    const p = JSON.parse(r?.pet || 'null')
    return p && isKind(p.base) ? { base: p.base, mix: p.mix ?? {}, fed: Number(p.fed) || 0, at: String(p.at || '') } : null
  } catch {
    return null
  }
}
export function soulsOf(r: any): Partial<Record<PetKind, number>> {
  try {
    const s = JSON.parse(r?.souls || '{}') ?? {}
    const out: Partial<Record<PetKind, number>> = {}
    for (const k of PET_KINDS) if (Number(s[k]) > 0) out[k] = Math.floor(Number(s[k]))
    return out
  } catch {
    return {}
  }
}

/** souls this run has earned so far (cumulative, as the client counts them), banked up to the believable amount */
export async function bankSouls(db: Sql, address: string, runId: string, reported: any) {
  if (!reported || typeof reported !== 'object') return 0
  const run = (await db.query('SELECT kills, souls_banked FROM runs WHERE id = $1 AND address = $2', [runId, address])).rows[0]
  if (!run) return 0
  const rep: [PetKind, number][] = []
  let got = 0
  for (const k of PET_KINDS) {
    const n = Math.max(0, Math.floor(Number(reported[k]) || 0))
    if (n) rep.push([k, n]), (got += n)
  }
  const allowed = Math.floor(Number(run.kills) / SOUL_EVERY)
  const target = Math.min(got, allowed)
  const delta = target - Number(run.souls_banked)
  if (delta <= 0) return 0
  // hand the new souls out in proportion to what the hunter reported
  const add: Partial<Record<PetKind, number>> = {}
  let left = delta
  rep.sort((a, b) => b[1] - a[1])
  for (const [k, n] of rep) {
    const share = Math.min(left, Math.round((delta * n) / got))
    if (share > 0) (add[k] = share), (left -= share)
  }
  if (left > 0 && rep.length) add[rep[0][0]] = (add[rep[0][0]] ?? 0) + left
  const upd = await db.query('UPDATE runs SET souls_banked = $1 WHERE id = $2 AND souls_banked = $3 RETURNING id', [target, runId, Number(run.souls_banked)])
  if (!upd.rows.length) return 0
  const p = (await db.query('SELECT souls FROM players WHERE address = $1', [address])).rows[0]
  const s = soulsOf(p)
  for (const k of Object.keys(add) as PetKind[]) s[k] = (s[k] ?? 0) + (add[k] ?? 0)
  await db.query('UPDATE players SET souls = $1 WHERE address = $2', [JSON.stringify(s), address])
  return delta
}

export async function tamePet(db: Sql, address: string, kind: any) {
  if (!isKind(kind)) return { ok: false as const, error: 'unknown monster' }
  const p = (await db.query('SELECT pet FROM players WHERE address = $1', [address])).rows[0]
  if (!p) return { ok: false as const, error: 'no profile' }
  if (petOf(p)) return { ok: false as const, error: 'you already have a pet' }
  const pet: Pet = { base: kind, mix: {}, fed: 0, at: new Date().toISOString() }
  await db.query('UPDATE players SET pet = $1 WHERE address = $2', [JSON.stringify(pet), address])
  return { ok: true as const, pet }
}

export async function feedPet(db: Sql, address: string, kind: any, n: any) {
  if (!isKind(kind)) return { ok: false as const, error: 'unknown soul' }
  const want = Math.floor(Number(n))
  if (!(want > 0) || want > 100000) return { ok: false as const, error: 'bad amount' }
  const p = (await db.query('SELECT pet, souls FROM players WHERE address = $1', [address])).rows[0]
  const pet = petOf(p)
  if (!pet) return { ok: false as const, error: 'tame a pet first' }
  const s = soulsOf(p)
  if ((s[kind] ?? 0) < want) return { ok: false as const, error: 'not enough souls' }
  if (pet.fed + want > PET_MAX_FED) return { ok: false as const, error: 'your pet cannot hold more' }
  s[kind] = (s[kind] ?? 0) - want
  if (!s[kind]) delete s[kind]
  pet.mix[kind] = (pet.mix[kind] ?? 0) + want
  pet.fed += want
  // compare-and-set on the souls text so two quick feeds can't spend the same souls twice
  const upd = await db.query('UPDATE players SET pet = $1, souls = $2 WHERE address = $3 AND souls = $4 RETURNING address', [JSON.stringify(pet), JSON.stringify(s), address, p.souls])
  if (!upd.rows.length) return { ok: false as const, error: 'try again' }
  return { ok: true as const, pet, souls: s }
}

/** set the pet free (its fed souls are gone) so another monster can be tamed */
export async function releasePet(db: Sql, address: string) {
  await db.query("UPDATE players SET pet = '' WHERE address = $1", [address])
  return { ok: true as const }
}

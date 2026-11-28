// SOULBOUND PETS: a stable of up to 10 pets, one walks with you.
//  · 3 are free to tame (bat, slime, ghoul)
//  · the next ones show up one at a time at the PET SHOP (by the WHO IS GOD throne): to unlock pet #k you need
//    (k-3) pets raised to full size (×6, Lv PET_MAX_LVL) and GOLD (100 000 and up, rising) — the last one is PET GOD
//  · souls drop in runs (1 per SOUL_EVERY kills of a kind, counted by the client) and are banked here, capped by
//    the run's clamped kill count; feeding souls into the active pet makes it grow and fuses that monster's trait.
import type { Sql } from './db'

export const PET_SCHEMA = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS pet TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS souls TEXT NOT NULL DEFAULT '';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS souls_banked INTEGER NOT NULL DEFAULT 0`

/** soul kinds = the normal monsters (must match SOUL_KINDS / PET_KINDS in src/game/defs.ts) */
export const PET_KINDS = ['bat', 'ghoul', 'skeleton', 'wraith', 'slime', 'spider', 'imp', 'wisp', 'hound', 'brute'] as const
export type PetKind = (typeof PET_KINDS)[number]
/** the 10 pets in unlock order (must match PET_SPECIES in src/game/defs.ts) */
export const PET_SPECIES = ['bat', 'slime', 'ghoul', 'skeleton', 'spider', 'imp', 'wraith', 'hound', 'brute', 'god'] as const
export type PetSpecies = (typeof PET_SPECIES)[number]
export const PET_FREE = 3
/** GOLD to unlock species #3..#9 */
export const PET_UNLOCK_GOLD = [100_000, 200_000, 400_000, 800_000, 1_600_000, 3_200_000, 10_000_000]
export const SOUL_EVERY = 20
export const PET_MAX_FED = 1_000_000
/** full size (×6): level 118 = 41 067 souls (must match PET_MAX_LVL in defs.ts) */
export const PET_MAX_LVL = 118
export const petLevel = (fed: number) => 1 + Math.floor(Math.sqrt(Math.max(0, fed) / 3))

type One = { mix: Partial<Record<PetKind, number>>; fed: number; at: string }
export type Stable = { active: string; pets: Record<string, One> }
export type Pet = { base: string; mix: Partial<Record<PetKind, number>>; fed: number; at: string }

const isSoul = (k: any): k is PetKind => typeof k === 'string' && (PET_KINDS as readonly string[]).includes(k)
const isSpecies = (k: any): k is PetSpecies => typeof k === 'string' && (PET_SPECIES as readonly string[]).includes(k)
/** legacy pets (tamed before the shop existed) may be any soul kind */
const isPetKind = (k: any) => isSpecies(k) || isSoul(k)

export function stableOf(r: any): Stable {
  try {
    const p = JSON.parse(r?.pet || 'null')
    if (!p) return { active: '', pets: {} }
    if (p.base && isPetKind(p.base)) return { active: p.base, pets: { [p.base]: { mix: p.mix ?? {}, fed: Number(p.fed) || 0, at: String(p.at || '') } } } // v1 (single pet)
    const pets: Record<string, One> = {}
    for (const [k, v] of Object.entries(p.pets ?? {})) if (isPetKind(k)) pets[k] = { mix: (v as any).mix ?? {}, fed: Number((v as any).fed) || 0, at: String((v as any).at || '') }
    return { active: pets[p.active] ? p.active : Object.keys(pets)[0] ?? '', pets }
  } catch {
    return { active: '', pets: {} }
  }
}
/** the pet walking with you */
export function petOf(r: any): Pet | null {
  const s = stableOf(r)
  const a = s.pets[s.active]
  return a ? { base: s.active, ...a } : null
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
export const maxedCount = (s: Stable) => Object.values(s.pets).filter((p) => petLevel(p.fed) >= PET_MAX_LVL).length
/** the next species the shop offers (null = all owned), its price and how many full-size pets it needs */
export function nextUnlock(s: Stable) {
  for (let i = PET_FREE; i < PET_SPECIES.length; i++) {
    const k = PET_SPECIES[i]
    if (!s.pets[k]) return { kind: k, index: i, gold: PET_UNLOCK_GOLD[i - PET_FREE], needMaxed: i - PET_FREE + 1 }
  }
  return null
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

async function savePet(db: Sql, address: string, before: string, st: Stable) {
  const r = await db.query('UPDATE players SET pet = $1 WHERE address = $2 AND pet = $3 RETURNING address', [JSON.stringify(st), address, before])
  return r.rows.length > 0
}

/** tame one of the 3 free pets */
export async function tamePet(db: Sql, address: string, kind: any) {
  const i = (PET_SPECIES as readonly string[]).indexOf(kind)
  if (i < 0) return { ok: false as const, error: 'unknown pet' }
  if (i >= PET_FREE) return { ok: false as const, error: 'this pet is unlocked at the PET SHOP' }
  const p = (await db.query('SELECT pet FROM players WHERE address = $1', [address])).rows[0]
  if (!p) return { ok: false as const, error: 'no profile' }
  const st = stableOf(p)
  if (st.pets[kind]) return { ok: false as const, error: 'you already have this pet' }
  st.pets[kind] = { mix: {}, fed: 0, at: new Date().toISOString() }
  st.active = kind
  if (!(await savePet(db, address, p.pet, st))) return { ok: false as const, error: 'try again' }
  return { ok: true as const }
}

/** buy the next pet at the PET SHOP: needs full-size pets + GOLD */
export async function unlockPet(db: Sql, address: string, kind: any) {
  const p = (await db.query('SELECT pet, bank FROM players WHERE address = $1', [address])).rows[0]
  if (!p) return { ok: false as const, error: 'no profile' }
  const st = stableOf(p)
  const nx = nextUnlock(st)
  if (!nx) return { ok: false as const, error: 'you own every pet' }
  if (nx.kind !== kind) return { ok: false as const, error: 'that pet is still hidden' }
  if (maxedCount(st) < nx.needMaxed) return { ok: false as const, error: `raise ${nx.needMaxed} pet${nx.needMaxed > 1 ? 's' : ''} to full size (Lv ${PET_MAX_LVL}) first` }
  if (Number(p.bank) < nx.gold) return { ok: false as const, error: `needs ${nx.gold.toLocaleString('en-US')} GOLD` }
  st.pets[kind] = { mix: {}, fed: 0, at: new Date().toISOString() }
  st.active = kind
  // compare-and-set on the pet text + a bank check in the same statement: two quick buys can't spend twice
  const r = await db.query('UPDATE players SET pet = $1, bank = bank - $2::integer, updated_at = NOW() WHERE address = $3 AND pet = $4 AND bank >= $5::integer RETURNING address', [
    JSON.stringify(st), nx.gold, address, p.pet, nx.gold
  ])
  if (!r.rows.length) return { ok: false as const, error: 'try again' }
  return { ok: true as const, gold: nx.gold }
}

/** choose which of your pets walks with you */
export async function setActivePet(db: Sql, address: string, kind: any) {
  const p = (await db.query('SELECT pet FROM players WHERE address = $1', [address])).rows[0]
  const st = stableOf(p)
  if (!st.pets[kind]) return { ok: false as const, error: 'you do not have this pet' }
  if (st.active === kind) return { ok: true as const }
  st.active = kind
  if (!(await savePet(db, address, p.pet, st))) return { ok: false as const, error: 'try again' }
  return { ok: true as const }
}

/** feed souls into the active pet */
export async function feedPet(db: Sql, address: string, kind: any, n: any) {
  if (!isSoul(kind)) return { ok: false as const, error: 'unknown soul' }
  const want = Math.floor(Number(n))
  if (!(want > 0) || want > 100000) return { ok: false as const, error: 'bad amount' }
  const p = (await db.query('SELECT pet, souls FROM players WHERE address = $1', [address])).rows[0]
  const st = stableOf(p)
  const pet = st.pets[st.active]
  if (!pet) return { ok: false as const, error: 'tame a pet first' }
  const s = soulsOf(p)
  if ((s[kind] ?? 0) < want) return { ok: false as const, error: 'not enough souls' }
  if (pet.fed + want > PET_MAX_FED) return { ok: false as const, error: 'your pet cannot hold more' }
  s[kind] = (s[kind] ?? 0) - want
  if (!s[kind]) delete s[kind]
  pet.mix[kind] = (pet.mix[kind] ?? 0) + want
  pet.fed += want
  // compare-and-set on both texts so two quick feeds can't spend the same souls twice
  const upd = await db.query('UPDATE players SET pet = $1, souls = $2 WHERE address = $3 AND souls = $4 AND pet = $5 RETURNING address', [JSON.stringify(st), JSON.stringify(s), address, p.souls, p.pet])
  if (!upd.rows.length) return { ok: false as const, error: 'try again' }
  return { ok: true as const }
}

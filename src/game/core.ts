// WOW NIGHTSWARM — pure game simulation (no Decentraland imports, runs headless for balance tests).
import LAYOUT from '../../layout.json'
import {
  WeaponId, PassiveId, EnemyKind, WEAPONS, PASSIVES, ENEMIES, MAX_WEAPON_LVL, MAX_PASSIVE_LVL,
  MAX_WEAPONS, MAX_PASSIVES, waveMix, xpNeed, ARMORY, NUKE, NUKE_TIER, GOD_TIER, isHoldable, manualLevelScale, bossFor, BossDef,
  BOOSTS, BoostId, RARITY, GodId, GODS, GOD_UNLOCK, MAX_GODS, MAX_GOD_LVL, ARTS, ArtId, MAX_ART_LVL, BOSSES,
  FUSION_LVL, ART_SLOTS, MAX_ESSENCE, FusionStats, fusionStats, fusionName, ELEMENTS, ART_ELEMENT, FURY_PER_STAR, FURY_MAX, DREAD_HEAL, DREAD_LVL, DREAD_DMG,
  DIVINE_CHANCE, DUNG_CHANCE, Jackpot, JACKPOT_ART, isJackpotArt
} from './defs'

export type Rect = { x0: number; z0: number; x1: number; z1: number }
export const ARENA: Rect[] = LAYOUT.arena

export const TUNING = {
  maxEnemies: 140,
  pvpScale: 0.35, // weapon damage dealt to other players is scaled down
  pvpHitInterval: 0.4,
  baseMagnet: 2.4,
  baseHp: 120,
  eliteEvery: 60,
  bossEvery: 300,
  ringEvery: 90
}

export type Enemy = {
  id: number
  /** bosses: spawn time, damage taken while being measured, sized yet */
  b0?: number
  bTaken?: number
  sized?: boolean
  kind: EnemyKind
  x: number
  z: number
  hp: number
  maxHp: number
  speed: number
  dmg: number
  r: number
  xp: number
  alive: boolean
  wob: number
  kx: number
  kz: number
  lastHit: Record<string, number>
  sc: number // visual scale multiplier
  boss?: number // index into the boss ladder
  slamCd?: number
  wind?: number // slam wind-up timer
  slow?: number // seconds of chill left (Frost Comet)
  frozen?: number // seconds fully frozen (Glacier Cataclysm)
  chargeCd?: number
  atkCd?: number
  atkI?: number
  charging?: number
  cvx?: number
  cvz?: number
  phase?: number // mythic enrage step
  windR?: number // radius of a blink-slam
}
export type PickKind = 'gem' | 'coin' | 'chest' | 'heal' | 'potion'
export type Pickup = { id: number; kind: PickKind; x: number; z: number; value: number; alive: boolean; flying: boolean; big?: boolean; born: number }
export type Proj = { id: number; x: number; z: number; vx: number; vz: number; dmg: number; pierce: number; life: number; hit: number[]; k?: 'feather' | 'knife' }
/** a friendly homing flame / shadow from an art */
export type Ally = { id: number; x: number; z: number; vx: number; vz: number; life: number; dmg: number; k: 'fox' | 'shade'; hit: number[] }
export type Hostile = { id: number; x: number; z: number; vx: number; vz: number; life: number; dmg: number; home?: number; k?: string }
export type Remote = { id: string; x: number; z: number; attackable: boolean }

export type Ev =
  | { t: 'hit'; id: number; x: number; z: number; dmg: number; crit?: boolean }
  | { t: 'kill'; kind: EnemyKind; x: number; z: number }
  | { t: 'gem' }
  | { t: 'coin' }
  | { t: 'chest'; big: boolean }
  | { t: 'heal' }
  | { t: 'levelup' }
  | { t: 'hurt'; dmg: number }
  | { t: 'dead'; killer?: string }
  | { t: 'boss' }
  | { t: 'elite' }
  | { t: 'ring' }
  | { t: 'pvpHit'; to: string; dmg: number }
  | { t: 'slash'; x: number; z: number; yaw: number; w: number; l: number; tint?: string }
  | { t: 'nova'; x: number; z: number; r: number }
  | { t: 'strike'; x: number; z: number; r: number }
  | { t: 'shoot' }
  | { t: 'swing'; x: number; z: number; yaw: number; range: number; arc: number; tier: number }
  | { t: 'quake'; x: number; z: number; r: number }
  | { t: 'tracer'; x: number; z: number; yaw: number; len: number }
  | { t: 'zeus'; pts: [number, number][] }
  | { t: 'divine'; x: number; z: number; r: number }
  | { t: 'nukeLaunch'; x: number; z: number; tx: number; tz: number; delay: number }
  | { t: 'nuke'; x: number; z: number; r: number }
  | { t: 'bossSpawn'; boss: number }
  | { t: 'bossDown'; boss: number }
  | { t: 'slamWarn'; x: number; z: number; r: number; dur: number }
  | { t: 'slam'; x: number; z: number; r: number }
  | { t: 'charge'; x: number; z: number; yaw: number; len: number }
  | { t: 'combo'; n: number; name: string }
  | { t: 'awaken' }
  | { t: 'potion'; kind: PotionKind }
  | { t: 'potionGet'; kind: PotionKind }
  | { t: 'revive'; x: number; z: number }
  | { t: 'rageEnd' }
  | { t: 'kame'; x: number; z: number; yaw: number; len: number; w: number; dur: number; max: boolean }
  | { t: 'meteorFall'; x: number; z: number; delay: number; big: boolean }
  | { t: 'gnuke'; x: number; z: number; r: number }
  | { t: 'hole'; x: number; z: number; r: number; dur: number; max: boolean }
  | { t: 'gsword'; x: number; z: number; delay: number; max: boolean }
  | { t: 'bbeamWarn'; x: number; z: number; yaw: number; len: number; w: number; dur: number }
  | { t: 'bbeam'; x: number; z: number; yaw: number; len: number; w: number; dur: number }
  | { t: 'comboBreak'; n: number }
  | { t: 'arena'; kind: ArenaKind; on: boolean; dur: number }
  | { t: 'comet'; x: number; z: number; r: number }
  | { t: 'frostHit'; x: number; z: number; r: number }
  | { t: 'arc'; pts: [number, number][] }
  | { t: 'chakram'; x: number; z: number; yaw: number; d: number; dur: number }
  | { t: 'mine'; id: number; x: number; z: number }
  | { t: 'boom'; id: number; x: number; z: number; r: number }
  | { t: 'sweep'; x: number; z: number; yaw: number; len: number; dur: number; n: number }
  | { t: 'dash'; x0: number; z0: number; x1: number; z1: number }
  | { t: 'proj'; x: number; z: number; vx: number; vz: number; life: number; k: number } // k 0-3 shard tier · 4 feather · 5 gold feather (network only)
  // mythic boss patterns (Lv 350+)
  | { t: 'mRingWarn'; x: number; z: number; r0: number; r1: number; dur: number }
  | { t: 'mRing'; x: number; z: number; r0: number; r1: number; own?: boolean; tint?: string }
  | { t: 'mStrike'; x: number; z: number; r: number; delay: number; k: string; own?: boolean; tint?: string }
  | { t: 'mSpokes'; x: number; z: number; n: number; len: number; w: number; a0: number; omega: number; warm: number; dur: number; own?: boolean }
  | { t: 'mBlink'; x0: number; z0: number; x1: number; z1: number }
  | { t: 'mLight'; safe: [number, number, number][]; dur: number }
  | { t: 'mLightHit'; ok: boolean }
  | { t: 'mChrono'; dur: number; own?: boolean; x?: number; z?: number }
  | { t: 'allyOut'; x: number; z: number; vx: number; vz: number; life: number; k: number }
  | { t: 'genesis'; x: number; z: number; r: number }
  | { t: 'secondWind' }
  | { t: 'autoPick'; label: string; color: string }
  | { t: 'fuse'; core: ArtId; ess: ArtId; n: number; jackpot?: Jackpot }
  | { t: 'mPhase'; boss: number; phase: number }
  | { t: 'ascend' }

export type PotionKind = 'hp' | 'rage' | 'phoenix'
export const POTION_DEFS: Record<PotionKind, { name: string; key: string; color: string; desc: string; carry: number; shop: number; shopMax: number }> = {
  hp: { name: 'Blood Potion', key: '3', color: '#FF3B4A', desc: 'heal 45% HP instantly', carry: 9, shop: 150, shopMax: 5 },
  rage: { name: 'Rage Elixir', key: '4', color: '#FF8A1A', desc: '12s: damage ×1.6, attacks 25% faster, kills heal you', carry: 5, shop: 400, shopMax: 3 },
  phoenix: { name: 'Phoenix Tear', key: 'auto', color: '#FFD86A', desc: 'cheat death once: revive at 60% HP with a firestorm', carry: 1, shop: 2500, shopMax: 1 }
}
/** monsters scale with how strong the hunter has become (the "threat"): healing is scarce, potions decide fights */
export const THREAT = { perLevel: 0.08, from: 12, dmgShare: 1.0, cap: 300, deepPerLevel: 0.004, timeCap: 5400 }

export type ArenaKind = 'bloodmoon' | 'goldrush' | 'elitehunt'
export const ARENA_EVENTS: Record<ArenaKind, { name: string; desc: string; dur: number; color: string }> = {
  bloodmoon: { name: 'BLOOD MOON', desc: 'twice the monsters · gold ×1.5', dur: 40, color: '#FF2A3D' },
  goldrush: { name: 'GOLD RUSH', desc: 'gold rains from the sky — grab it!', dur: 25, color: '#FFD86A' },
  elitehunt: { name: 'ELITE HUNT', desc: '3 bounty brutes — each carries a vault', dur: 60, color: '#B07BFF' }
}
/** kill-streak milestones (the announcer calls them out) */
export const COMBO_TIERS: [number, string][] = [
  [25, 'KILLING SPREE'], [50, 'RAMPAGE'], [100, 'UNSTOPPABLE'], [200, 'GODLIKE'], [400, 'LEGENDARY'], [800, 'BEYOND GODLIKE']
]
export type VaultPrize = 'jackpot' | 'relic' | 'double' | 'heal' | 'magnet'
export const VAULT_PRIZES: Record<VaultPrize, { name: string; sym: string; desc: string; color: string; w: number }> = {
  jackpot: { name: 'GOLD JACKPOT', sym: '7', desc: 'a pile of gold', color: '#FFD86A', w: 22 },
  relic: { name: 'RIFT RELIC', sym: '♦', desc: '+15% damage for the rest of the run', color: '#FF5468', w: 22 },
  double: { name: 'DOUBLE ROLL', sym: '★', desc: '+2 extra upgrades', color: '#A26BFF', w: 26 },
  heal: { name: 'LIFE SPRING', sym: '♥', desc: 'full heal + 30 max HP', color: '#3DFF8E', w: 16 },
  magnet: { name: 'SOUL MAGNET', sym: '●', desc: 'every gem on the floor flies to you', color: '#4AA8FF', w: 14 }
}

export type Option =
  | { kind: 'weapon'; id: WeaponId; to: number }
  | { kind: 'passive'; id: PassiveId; to: number }
  | { kind: 'evolve'; id: WeaponId }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'boost'; id: BoostId; m?: number }
  | { kind: 'god'; id: GodId; to: number }
  | { kind: 'art'; id: ArtId; to: number }

let rand = Math.random
export function setRandom(fn: () => number) {
  rand = fn
}

export type RunSnap = {
  v: number; time: number; level: number; xp: number; kills: number; gold: number; hp: number; maxHp: number
  pendingLevels: number; rerolls: number; pvpKills: number
  weapons: [WeaponId, number][]; passives: [PassiveId, number][]; evolved: WeaponId[]; gods?: [GodId, number][]; arts?: [ArtId, number][]; fusions?: [ArtId, ArtId[]][]; legacyArts?: boolean; potions?: Record<PotionKind, number>
  bossIndex: number; bossQueue: number; bossesSlain: number; boostDmg: number; boostArea: number; boostRegen: number
  nextElite: number; nextRing: number
  boons?: Record<string, number>
  ascended?: boolean
  godBorn?: boolean
}

export class Run {
  // player
  x = 0
  z = 0
  yaw = 0
  hp = TUNING.baseHp
  maxHp = TUNING.baseHp
  level = 1
  xp = 0
  kills = 0
  gold = 0
  time = 0
  alive = true
  pendingLevels = 0
  rerolls = 2
  invuln = 0
  hurtCd = 0
  weapons = new Map<WeaponId, number>()
  passives = new Map<PassiveId, number>()
  evolved = new Set<WeaponId>()
  cd: Record<string, number> = {}
  orbitAngle = 0
  meta = { might: 0, hp: 0, magnet: 0, xp: 0 }
  lastAttacker = ''
  pvpKills = 0
  // armory (manual attacks)
  armory = 0 // highest tier owned
  equip = 0 // tier in hand
  manualCd = 0
  nukeCd = 0
  pendingNuke: { x: number; z: number; t: number } | null = null
  // boss ladder
  bossIndex = 0 // next boss to come
  bossQueue = 0 // bosses earned but not yet spawned
  bossIds: number[] = [] // enemy ids of the bosses on the field (twins = 2)
  bossesSlain = 0
  // endless boosts
  boostDmg = 0
  boostArea = 0
  boostRegen = 0

  // new auto-skills
  comets: { x: number; z: number; r: number; dmg: number; t: number; chill: number; freeze: number }[] = []
  chakrams: { ox: number; oz: number; fx: number; fz: number; d: number; t: number; dur: number; dmg: number; out: number[]; back: number[]; pv: number }[] = []
  mines: { id: number; x: number; z: number; arm: number; life: number; dmg: number; r: number }[] = []
  sweeps: { t: number; dur: number; yaw: number; len: number; n: number; dmg: number; hit: Set<number>; pv: Set<string> }[] = []
  wisps: { x: number; z: number; cd: number; ph: number; dash: number; tx: number; tz: number }[] = []

  // potions + threat
  potions: Record<PotionKind, number> = { hp: 0, rage: 0, phoenix: 0 }
  potCd = 0
  rageT = 0
  revives = 0

  // god powers (Lv 200+)
  gods = new Map<GodId, number>()
  awakened = false
  private kames: { x: number; z: number; yaw: number; len: number; w: number; t: number; dmg: number; tick: number }[] = []
  private nukes: { x: number; z: number; t: number; r: number; dmg: number }[] = []
  private holes: { x: number; z: number; t: number; dur: number; r: number; dmg: number; boom: number; tick: number }[] = []
  private swords: { x: number; z: number; t: number; dmg: number }[] = []
  // mythic boss patterns
  private mRings: { x: number; z: number; r0: number; r1: number; t: number; dmg: number }[] = []
  private mSpokes: { x: number; z: number; n: number; len: number; w: number; a0: number; omega: number; warm: number; t: number; dmg: number; tick: number; age: number }[] = []
  private mLight: { safe: [number, number, number][]; t: number; dmg: number } | null = null
  /** Chrono: time slows the hunter (the game slows the avatar while this runs) */
  slowT = 0
  /** THE ALMIGHTY fell in this run: the story is over, only the horde remains */
  ascended = false
  /** a God (permanent): born awakened, stronger, flying */
  godBorn = false
  // sky-god boss attacks
  hostile: Hostile[] = []
  private bMeteors: { x: number; z: number; t: number; r: number; dmg: number }[] = []
  private bBeams: { x: number; z: number; yaw: number; len: number; w: number; t: number; warm: number; dmg: number; tick: number }[] = []

  // kill combo
  combo = 0
  comboT = 0
  bestCombo = 0
  private comboTier = 0
  // arena events
  arena: { kind: ArenaKind; t: number; dur: number } | null = null
  nextArena = 150
  private rushAcc = 0
  bounties: number[] = []

  enemies: Enemy[] = []
  pickups: Pickup[] = []
  projs: Proj[] = []
  // arts
  arts = new Map<ArtId, number>()
  /** fused arts: core → essences melted into it (the essences no longer cast on their own) */
  fusions = new Map<ArtId, ArtId[]>()
  /** arts melted into another art: never offered again this run */
  consumed = new Set<ArtId>()
  /** tests only: force the next fusion's luck roll (0 = divine, 0.002 = dung, 1 = normal) */
  fusionLuck: number | undefined = undefined
  /** a run saved past Lv 250 before fusion existed: keeps learning arts without a slot limit (fusing stays optional) */
  legacyArts = false
  /** recent damage per second (rolling ~30 s), so bosses can be sized to the hunter */
  dps = 0
  private dpsAcc = 0
  private dpsT = 0
  /** one free comeback for newcomers (before Lv 60) */
  secondWind = true
  private emptyT = 0
  /** stacked boons (percent / flat amounts as in BOOSTS) */
  boons: Record<string, number> = {}
  allies: Ally[] = []
  private ownStrikes: { x: number; z: number; r: number; t: number; dmg: number; slow: number }[] = []
  private ownSpokes: { x: number; z: number; n: number; len: number; w: number; a0: number; omega: number; age: number; warm: number; dur: number; dmg: number; tick: number }[] = []
  private artSeen = new Set<ArtId>()
  private nextId = 1
  private spawnAcc = 0
  nextElite = TUNING.eliteEvery
  nextRing = TUNING.ringEvery
  private pvpAcc = new Map<string, number>()
  private pvpLast = new Map<string, number>()
  events: Ev[] = []

  constructor(start: WeaponId, meta?: { might: number; hp: number; magnet: number; xp: number }, armory = 0, equip?: number) {
    this.weapons.set(start, 1)
    if (meta) this.meta = meta
    this.armory = Math.max(0, Math.min(ARMORY.length - 1, armory))
    let eq = Math.min(equip ?? this.armory, this.armory)
    if (!isHoldable(eq)) eq--
    this.equip = Math.max(0, eq)
    this.maxHp = this.hp = TUNING.baseHp + this.meta.hp * 10
  }

  /** the ones who defeated THE ALMIGHTY start every run as God: awakened, twice as strong and sturdy */
  becomeGod() {
    if (this.godBorn) return
    this.godBorn = true
    this.awakened = true
    this.maxHp *= 2
    this.hp = this.maxHp
  }

  /** everything needed to resume this run later (enemies respawn; an alive boss comes back at full hp) */
  snapshot(): RunSnap {
    return {
      v: 1,
      time: Math.floor(this.time), level: this.level, xp: Math.floor(this.xp), kills: this.kills, gold: Math.floor(this.gold),
      hp: Math.ceil(this.hp), maxHp: this.maxHp, pendingLevels: this.pendingLevels, rerolls: this.rerolls, pvpKills: this.pvpKills,
      weapons: [...this.weapons.entries()], passives: [...this.passives.entries()], evolved: [...this.evolved], gods: [...this.gods.entries()], arts: [...this.arts.entries()], fusions: [...this.fusions.entries()], legacyArts: this.legacyArts, potions: { ...this.potions },
      // bosses on the field come back (twins: both, so the pair stays together)
      bossIndex: this.bossIndex - this.bossesAlive().length, bossQueue: this.bossQueue + this.bossesAlive().length, bossesSlain: this.bossesSlain,
      boostDmg: this.boostDmg, boostArea: this.boostArea, boostRegen: this.boostRegen,
      nextElite: this.nextElite, nextRing: this.nextRing,
      ascended: this.ascended,
      godBorn: this.godBorn,
      boons: { ...this.boons }
    }
  }

  static restore(s: RunSnap, meta: { might: number; hp: number; magnet: number; xp: number }, armory: number, equip: number) {
    const first = (s.weapons[0]?.[0] ?? 'lash') as WeaponId
    const r = new Run(first, meta, armory, equip)
    r.weapons = new Map(s.weapons)
    r.passives = new Map(s.passives)
    r.evolved = new Set(s.evolved)
    r.gods = new Map(s.gods ?? [])
    r.arts = new Map((s.arts ?? []).filter(([id]) => ARTS[id]))
    for (const id of r.arts.keys()) r.artSeen.add(id)
    // saved before the fusion update (no fusions field) and already past Lv 250 → no slot limit for this run
    r.legacyArts = !!s.legacyArts || (s.fusions === undefined && s.level >= FUSION_LVL)
    for (const [core, ess] of s.fusions ?? []) {
      if (!r.arts.has(core)) continue
      const list = (ess ?? []).filter((e) => ARTS[e] && e !== core).slice(0, MAX_ESSENCE)
      if (!list.length) continue
      r.fusions.set(core, list)
      for (const e of list) {
        r.consumed.add(e)
        r.arts.delete(e)
        r.artSeen.add(e)
      }
    }
    if (s.potions) r.potions = { hp: Math.min(9, s.potions.hp | 0), rage: Math.min(5, s.potions.rage | 0), phoenix: Math.min(1, s.potions.phoenix | 0) }
    r.awakened = s.level >= GOD_UNLOCK
    r.time = s.time
    r.level = s.level
    r.xp = s.xp
    r.kills = s.kills
    r.gold = s.gold
    r.maxHp = Math.max(r.maxHp, s.maxHp)
    r.hp = Math.max(1, Math.min(r.maxHp, s.hp))
    r.pendingLevels = s.pendingLevels
    r.rerolls = s.rerolls
    r.pvpKills = s.pvpKills
    r.bossIndex = s.bossIndex
    r.bossQueue = s.bossQueue
    r.bossesSlain = s.bossesSlain
    r.boostDmg = s.boostDmg
    r.boostArea = s.boostArea
    r.boostRegen = s.boostRegen
    r.nextElite = s.nextElite
    r.ascended = !!s.ascended
    if (s.boons) for (const k of Object.keys(s.boons)) if (k in BOOSTS && Number.isFinite(s.boons[k])) r.boons[k] = s.boons[k]
    r.godBorn = !!s.godBorn // maxHp in the snapshot already holds the ×2
    if (r.godBorn) r.awakened = true
    r.nextRing = s.nextRing
    r.invuln = 3
    return r
  }

  // ───────── derived stats ─────────
  p(id: PassiveId) {
    return this.passives.get(id) ?? 0
  }
  get might() {
    return (1 + 0.12 * this.p('might') + 0.05 * this.meta.might + this.boostDmg) * (this.rageT > 0 ? 1.6 : 1) * (this.godBorn ? 2 : 1)
  }
  get cdMul() {
    return Math.max(0.3, (1 - 0.07 * this.p('haste')) * (1 - (this.boons.haste ?? 0) / 100) * (this.rageT > 0 ? 0.75 : 1))
  }
  get area() {
    return 1 + 0.1 * this.p('expanse') + this.boostArea
  }
  get amount() {
    return Math.floor((this.p('duplicator') + 1) / 2)
  }
  get armor() {
    return this.p('plating') + (this.boons.armor ?? 0)
  }
  /** how hard the horde hits back: grows with the hunter's level */
  get threat() {
    const L = Math.min(this.level, THREAT.cap)
    const base = 1 + Math.max(0, L - THREAT.from) * THREAT.perLevel
    return this.level <= THREAT.cap ? base : base * (1 + (this.level - THREAT.cap) * THREAT.deepPerLevel)
  }
  /** run time that drives monster growth: stops at 90 min, deeper runs scale through the threat only */
  get tScale() {
    return Math.min(this.time, THREAT.timeCap)
  }
  get regen() {
    // healing is scarce on purpose: potions are the real lifeline
    return 0.12 + 0.25 * this.p('bloodstone') + this.boostRegen * 0.5 + (this.godBorn ? 3 : 0)
  }
  get magnet() {
    return TUNING.baseMagnet * (1 + 0.35 * this.p('magnet') + 0.1 * this.meta.magnet + (this.boons.magnet ?? 0) / 100)
  }
  get speedMul() {
    return (1 + 0.08 * this.p('swiftness') + (this.g('wings') ? 0.15 : 0) + (this.boons.speed ?? 0) / 100) * (this.slowT > 0 ? 0.5 : 1)
  }
  get xpMul() {
    return 1 + 0.05 * this.meta.xp + (this.boons.xp ?? 0) / 100
  }
  get goldMul() {
    return (1 + 0.12 * this.p('fortune') + (this.boons.greed ?? 0) / 100) * this.comboMul * (this.arena?.kind === 'bloodmoon' ? 1.5 : 1)
  }
  /** gold ×1 → ×1.5: +10% every 50 kills in a streak */
  get comboMul() {
    return 1 + Math.min(0.5, Math.floor(this.combo / 50) * 0.1)
  }
  get need() {
    return xpNeed(this.level)
  }
  w(id: WeaponId) {
    return this.weapons.get(id) ?? 0
  }
  g(id: GodId) {
    return this.gods.get(id) ?? 0
  }
  evo(id: WeaponId) {
    return this.evolved.has(id)
  }

  // ───────── main step ─────────
  step(dt: number, frozen: boolean, remotes: Remote[] = []): Ev[] {
    this.events = []
    if (!this.alive) return this.events
    if (this.invuln > 0) this.invuln -= dt
    if (frozen) return this.events
    this.time += dt
    if (this.hurtCd > 0) this.hurtCd -= dt
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt * this.healMul())
    this.spawn(dt)
    this.moveEnemies(dt)
    this.fire(dt, remotes)
    this.moveProjs(dt, remotes)
    this.collect(dt)
    this.bossStep(dt)
    this.manualStep(dt)
    this.arenaStep(dt)
    if (this.potCd > 0) this.potCd -= dt
    if (this.rageT > 0 && (this.rageT -= dt) <= 0) this.events.push({ t: 'rageEnd' })
    if (this.combo && (this.comboT -= dt) <= 0) this.breakCombo()
    this.flushPvp(dt)
    this.dpsT += dt
    if (this.dpsT >= 1) {
      this.dps = this.dps * 0.965 + (this.dpsAcc / this.dpsT) * 0.035
      this.dpsAcc = 0
      this.dpsT = 0
    }
    return this.events
  }

  // ───────── spawning ─────────
  private spawn(dt: number) {
    const t = this.time
    // ramps to 12/s by ~5 min, then keeps creeping up to 17/s for the deep game
    const rate = (Math.min(12, 0.7 + t / 25) + Math.min(5, Math.max(0, t - 600) / 300)) * (this.arena?.kind === 'bloodmoon' ? 1.8 : 1)
    this.spawnAcc += rate * dt
    let alive = this.enemies.filter((e) => e.alive).length
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      if (alive >= TUNING.maxEnemies) continue
      alive++
      this.spawnEnemy(pick(waveMix(t)))
    }
    // a strong hunter clears the screen: if nothing is near for 2 s, a pack rushes in around them
    const near = this.enemies.some((e) => e.alive && Math.abs(e.x - this.x) < 11 && Math.abs(e.z - this.z) < 11)
    this.emptyT = near ? 0 : this.emptyT + dt
    if (this.emptyT > 1.2 && t > 15) {
      this.emptyT = 0
      const n = Math.min(TUNING.maxEnemies - alive, 10 + Math.floor(Math.min(t, 1800) / 90) + 4 * this.armory)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand()
        const c = clampArena(this.x + Math.sin(a) * (9 + rand() * 3), this.z + Math.cos(a) * (9 + rand() * 3), 0.6)
        this.spawnEnemy(pick(waveMix(t)), c.x, c.z)
      }
    }
    if (t >= this.nextElite) {
      this.nextElite += TUNING.eliteEvery
      this.spawnEnemy('elite')
      this.events.push({ t: 'elite' })
    }
    if (this.bossQueue > 0 && !this.bossIds.length) this.spawnBoss()
    if (t >= this.nextRing) {
      this.nextRing += TUNING.ringEvery
      const n = 26
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const c = clampArena(this.x + Math.sin(a) * 9, this.z + Math.cos(a) * 9, 0.8)
        this.spawnEnemy('bat', c.x, c.z)
      }
      this.events.push({ t: 'ring' })
    }
  }

  spawnEnemy(kind: EnemyKind, x?: number, z?: number) {
    const d = ENEMIES[kind]
    if (x === undefined || z === undefined) {
      let ok = false
      for (let tries = 0; tries < 12 && !ok; tries++) {
        const a = rand() * Math.PI * 2
        const r = 11 + rand() * 4
        x = this.x + Math.sin(a) * r
        z = this.z + Math.cos(a) * r
        ok = inArena(x, z, 0.8)
      }
      if (!ok) {
        const c = clampArena(x!, z!, 0.8)
        x = c.x
        z = c.z
      }
    }
    const T = this.tScale
    const scale = (1 + T / 150) * (kind === 'boss' ? 1 : this.threat)
    const hp = d.hp * scale
    const e: Enemy = {
      id: this.nextId++, kind, x: x!, z: z!, hp, maxHp: hp,
      speed: d.speed * (1 + Math.min(0.25, T / 1200)), dmg: d.dmg * (1 + T / 220) * (1 + (this.threat - 1) * THREAT.dmgShare),
      r: d.r, xp: d.xp, alive: true, wob: rand() * 6.28, kx: 0, kz: 0, lastHit: {},
      sc: 1 + Math.min(0.5, this.time / 2400)
    }
    const slot = this.enemies.findIndex((q) => !q.alive)
    if (slot >= 0) this.enemies[slot] = e
    else this.enemies.push(e)
    return e
  }

  private moveEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = this.x - e.x
      const dz = this.z - e.z
      const dist = Math.hypot(dx, dz) || 0.001
      e.wob += dt * 1.7
      const side = Math.sin(e.wob) * 0.35
      const ux = dx / dist
      const uz = dz / dist
      const mx = ux - uz * side
      const mz = uz + ux * side
      const ml = Math.hypot(mx, mz) || 1
      // stop at touching distance so the horde forms a ring around the player instead of stacking on top
      const reach = e.r + 0.45
      let chill = 1
      if (e.frozen && e.frozen > 0) {
        e.frozen -= dt
        chill = e.boss !== undefined ? 0.5 : 0
      } else if (e.slow && e.slow > 0) {
        e.slow -= dt
        chill = e.boss !== undefined ? 0.75 : 0.45
      }
      const stepLen = Math.min(e.speed * chill * dt, Math.max(0, dist - reach))
      e.x += (mx / ml) * stepLen + e.kx * dt
      e.z += (mz / ml) * stepLen + e.kz * dt
      if (e.boss !== undefined) {
        e.kx = 0
        e.kz = 0
      }
      e.kx *= Math.max(0, 1 - dt * 6)
      e.kz *= Math.max(0, 1 - dt * 6)
      const c = clampArena(e.x, e.z, 0.5)
      e.x = c.x
      e.z = c.z
      // contact damage: one hit at a time with short i-frames (like the genre)
      if (dist < e.r + 0.55 && this.invuln <= 0 && this.hurtCd <= 0) {
        const dmg = e.dmg * Math.max(0.25, 1 - this.armor * 0.08) * (this.god ? 0.5 : 1)
        this.hp -= dmg
        this.lastAttacker = ''
        this.hurtCd = 0.6
        this.events.push({ t: 'hurt', dmg })
        this.breakCombo(true)
      }
    }
    if (this.hp <= 0) this.die('')
  }

  die(killer: string) {
    if (!this.alive) return
    // second wind: a newcomer's first death (before Lv 60) is forgiven once
    if (this.secondWind && this.level < 60 && !killer) {
      this.secondWind = false
      this.hp = this.maxHp * 0.7
      this.invuln = 3
      this.events.push({ t: 'revive', x: this.x, z: this.z })
      this.events.push({ t: 'secondWind' })
      for (const e of this.enemies) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d < 8) this.hitEnemy(e, e.kind === 'boss' ? 0 : e.maxHp * 2 / this.might, ((e.x - this.x) / (d || 1)) * 12, ((e.z - this.z) / (d || 1)) * 12)
      }
      return
    }
    // Phoenix Tear: cheat death once
    if (this.potions.phoenix > 0) {
      this.potions.phoenix--
      this.revives++
      this.hp = this.maxHp * 0.6
      this.invuln = 3
      this.events.push({ t: 'revive', x: this.x, z: this.z })
      for (const e of this.enemies) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d < 7) this.hitEnemy(e, e.kind === 'boss' ? 0 : e.maxHp * 2 / this.might, ((e.x - this.x) / (d || 1)) * 10, ((e.z - this.z) / (d || 1)) * 10)
      }
      return
    }
    this.alive = false
    this.hp = 0
    this.events.push({ t: 'dead', killer: killer || undefined })
  }

  /** damage from another player (PvP) */
  receivePvp(dmg: number, from: string) {
    if (!this.alive || this.invuln > 0) return
    this.hp -= dmg * Math.max(0.3, 1 - this.armor * 0.06)
    this.lastAttacker = from
    if (this.hurtCd <= 0) {
      this.hurtCd = 0.3
      this.events.push({ t: 'hurt', dmg })
      this.breakCombo(true)
    }
    if (this.hp <= 0) this.die(from)
  }

  // ───────── damage ─────────
  private hitEnemy(e: Enemy, dmg: number, kx = 0, kz = 0) {
    if (!e.alive) return
    const crit = rand() < 0.05 + 0.02 * this.p('fortune') + (this.boons.crit ?? 0) / 100
    let d = dmg * this.might * (crit ? 2 + (this.boons.critdmg ?? 0) / 100 : 1)
    if (e.kind === 'boss' || e.kind === 'elite') d *= 1 + (this.boons.bossdmg ?? 0) / 100
    if (this.artHit) d *= 1 + (this.boons.artdmg ?? 0) / 100
    // Divine Ascension one-shots everything except the mythic ladder (Lv 350+), which only takes its heavy blows
    if (this.god && !(e.kind === 'boss' && bossFor(e.boss ?? 0).divine)) d = Math.max(d, e.hp + 1)
    this.dpsAcc += Math.min(d, Math.max(0, e.hp))
    if (e.kind === 'boss' && !e.sized) {
      e.bTaken = (e.bTaken ?? 0) + d
      d = Math.min(d, Math.max(0, e.hp - e.maxHp * 0.5)) // can't fall below half before it has been sized
    }
    e.hp -= d
    if (this.boons.execute && e.kind !== 'boss' && e.hp > 0 && e.hp < e.maxHp * this.boons.execute / 100) e.hp = 0
    e.kx += kx
    e.kz += kz
    this.events.push({ t: 'hit', id: e.id, x: e.x, z: e.z, dmg: d, crit })
    if (this.evo('lash') && this.lashHealBudget > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.healMul())
      this.lashHealBudget -= 1
    }
    if (e.hp <= 0) this.killEnemy(e)
  }
  private lashHealBudget = 0

  private killEnemy(e: Enemy) {
    e.alive = false
    this.kills++
    if (this.boons.vamp) this.hp = Math.min(this.maxHp, this.hp + this.boons.vamp * this.healMul())
    this.combo++
    this.comboT = 3
    if (this.rageT > 0) this.hp = Math.min(this.maxHp, this.hp + 0.35 * this.healMul())
    if (this.combo > this.bestCombo) this.bestCombo = this.combo
    const tier = COMBO_TIERS.filter(([n]) => this.combo >= n).length
    if (tier > this.comboTier) {
      this.comboTier = tier
      this.events.push({ t: 'combo', n: this.combo, name: COMBO_TIERS[tier - 1][1] })
    }
    const bi = this.bounties.indexOf(e.id)
    if (bi >= 0) {
      this.bounties.splice(bi, 1)
      for (let i = 0; i < 6; i++) this.drop('coin', e.x + (rand() - 0.5) * 2, e.z + (rand() - 0.5) * 2, 1)
    }
    this.events.push({ t: 'kill', kind: e.kind, x: e.x, z: e.z })
    if (e.kind === 'boss') {
      const bi = e.boss ?? 0
      this.bossIds = this.bossIds.filter((id) => id !== e.id)
      this.bossesSlain++
      this.drop('chest', e.x, e.z, 1, true)
      this.drop('gem', e.x + 0.8, e.z, Math.round(this.need * 1.2))
      for (let i = 0; i < 6 + Math.min(14, bi * 2); i++) this.drop('coin', e.x + (rand() - 0.5) * 3, e.z + (rand() - 0.5) * 3, 1)
      this.drop('potion', e.x - 1, e.z, 0)
      this.drop('potion', e.x - 1.4, e.z + 0.8, 0)
      this.drop('potion', e.x + 1.2, e.z - 0.6, 1)
      this.events.push({ t: 'bossDown', boss: bi })
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25) // a breather after every boss
      if (bossFor(bi).god && !this.ascended) {
        // the story ends: no boss comes after God
        this.ascended = true
        this.bossQueue = 0
        this.mRings = []
        this.mSpokes = []
        this.mLight = null
        this.hostile = []
        this.becomeGod()
        this.hp = this.maxHp
        this.invuln = 20 // the ending plays out in peace
        this.events.push({ t: 'ascend' })
      }
    } else if (e.kind === 'elite') {
      this.drop('chest', e.x, e.z, 1, false)
      this.drop('potion', e.x - 0.6, e.z, 0)
      if (rand() < 0.4) this.drop('potion', e.x + 0.6, e.z + 0.4, 1)
      this.drop('gem', e.x + 0.5, e.z, e.xp)
    } else {
      this.drop('gem', e.x, e.z, e.xp)
      const r = rand()
      if (r < 0.02 * (1 + 0.12 * this.p('fortune'))) this.drop('coin', e.x + 0.3, e.z, 1)
      else if (r > 0.997) this.drop('heal', e.x, e.z + 0.3, 30)
      else if (r > 0.9945) this.drop('potion', e.x - 0.3, e.z, rand() < 0.8 ? 0 : 1)
    }
  }

  private pvpDamage(target: Remote, dmg: number) {
    if (!target.attackable) return
    const now = this.time
    const last = this.pvpLast.get(target.id) ?? -9
    if (now - last < TUNING.pvpHitInterval) return
    this.pvpLast.set(target.id, now)
    this.pvpAcc.set(target.id, (this.pvpAcc.get(target.id) ?? 0) + dmg * this.might * TUNING.pvpScale)
  }
  private pvpFlush = 0
  private flushPvp(dt: number) {
    this.pvpFlush += dt
    if (this.pvpFlush < 0.25) return
    this.pvpFlush = 0
    for (const [to, dmg] of this.pvpAcc) if (dmg > 0) this.events.push({ t: 'pvpHit', to, dmg: Math.round(dmg) })
    this.pvpAcc.clear()
  }

  // ───────── weapons ─────────
  private ready(id: string, cd: number, dt: number) {
    this.cd[id] = (this.cd[id] ?? 0) - dt
    if (this.cd[id] > 0) return false
    this.cd[id] = cd * this.cdMul
    return true
  }

  private alive_() {
    return this.enemies.filter((e) => e.alive)
  }

  private fire(dt: number, remotes: Remote[]) {
    const foes = this.alive_()
    this.lashHealBudget = Math.min(8, this.lashHealBudget + dt * 8)
    // LASH — rectangle in front (and behind from lvl 2)
    const lv = this.w('lash')
    if (lv && this.ready('lash', this.evo('lash') ? 0.9 : 1.2, dt)) {
      const widthMul = 1 + (lv >= 4 ? 0.2 : 0) + (lv >= 7 ? 0.2 : 0) + (this.evo('lash') ? 0.3 : 0)
      const L = 3.6 * this.area * widthMul
      const W = 1.2 * this.area * (this.evo('lash') ? 1.5 : 1)
      const dmg = (15 + 6 * Math.min(lv - 1, 2) + (lv >= 5 ? 6 : 0) + (lv >= 6 ? 6 : 0) + (lv >= 8 ? 10 : 0)) * (this.evo('lash') ? 1.6 : 1)
      // auto-aim at the nearest foe within reach (players move & face freely in Decentraland)
      let aim = this.yaw
      let best = 7
      for (const e of foes) {
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d < best) {
          best = d
          aim = (Math.atan2(e.x - this.x, e.z - this.z) * 180) / Math.PI
        }
      }
      const dirs = lv >= 2 ? [aim, aim + 180] : [aim]
      for (const yaw of dirs) {
        const a = (yaw * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        const cx = this.x + fx * (L / 2 + 0.3)
        const cz = this.z + fz * (L / 2 + 0.3)
        this.events.push({ t: 'slash', x: cx, z: cz, yaw, w: W, l: L })
        const inBox = (x: number, z: number, r: number) => {
          const rx = x - cx
          const rz = z - cz
          const along = rx * fx + rz * fz
          const across = rx * fz - rz * fx
          return Math.abs(along) <= L / 2 + r && Math.abs(across) <= W / 2 + r
        }
        for (const e of foes) if (inBox(e.x, e.z, e.r)) this.hitEnemy(e, dmg, fx * 2, fz * 2)
        for (const p of remotes) if (inBox(p.x, p.z, 0.4)) this.pvpDamage(p, dmg)
      }
    }
    // BOLT — homing-ish projectiles at nearest targets
    const bv = this.w('bolt')
    if (bv && this.ready('bolt', this.evo('bolt') ? 0.4 : 1.1, dt)) {
      const count = 1 + Math.floor(bv / 2) + (bv >= 7 ? 0 : 0) + this.amount + (this.evo('bolt') ? 2 : 0)
      const dmg = 12 + 4 * (bv >= 3 ? 1 : 0) + 4 * (bv >= 5 ? 1 : 0) + (bv >= 8 ? 8 : 0) + (bv - 1) * 1.5
      const pierce = this.evo('bolt') ? 4 : bv >= 6 ? 2 : 1
      const targets: { x: number; z: number; d: number }[] = foes.map((e) => ({ x: e.x, z: e.z, d: Math.hypot(e.x - this.x, e.z - this.z) }))
      for (const p of remotes) if (p.attackable) targets.push({ x: p.x, z: p.z, d: Math.hypot(p.x - this.x, p.z - this.z) })
      targets.sort((a, b) => a.d - b.d)
      for (let i = 0; i < count; i++) {
        const tg = targets[i % Math.max(1, targets.length)]
        let vx: number
        let vz: number
        if (tg && tg.d < 16) {
          vx = (tg.x - this.x) / (tg.d || 1)
          vz = (tg.z - this.z) / (tg.d || 1)
        } else {
          const a = ((this.yaw + (i - count / 2) * 12) * Math.PI) / 180
          vx = Math.sin(a)
          vz = Math.cos(a)
        }
        this.projs.push({ id: this.nextId++, x: this.x, z: this.z, vx: vx * 14, vz: vz * 14, dmg, pierce, life: 1.4, hit: [] })
      }
      this.events.push({ t: 'shoot' })
    }
    // ORBIT — blades circling the player
    const ov = this.w('orbit')
    if (ov) {
      const n = this.orbitCount()
      const R = this.orbitRadius()
      this.orbitAngle += dt * (200 * (ov >= 5 ? 1.25 : 1) * (this.evo('orbit') ? 1.6 : 1))
      const dmg = 12 + (ov >= 3 ? 4 : 0) + (ov >= 7 ? 4 : 0) + (ov - 1) * 1.5
      for (let i = 0; i < n; i++) {
        const a = ((this.orbitAngle + (i * 360) / n) * Math.PI) / 180
        const bx = this.x + Math.sin(a) * R
        const bz = this.z + Math.cos(a) * R
        for (const e of foes) {
          if (Math.hypot(e.x - bx, e.z - bz) > e.r + 0.55) continue
          const k = 'o' + i
          if ((e.lastHit[k] ?? -9) > this.time - 0.4) continue
          e.lastHit[k] = this.time
          this.hitEnemy(e, dmg, Math.sin(a) * 3, Math.cos(a) * 3)
        }
        for (const p of remotes) if (Math.hypot(p.x - bx, p.z - bz) < 0.8) this.pvpDamage(p, dmg)
      }
    }
    // AURA — damage ticks around the player
    const av = this.w('aura')
    if (av && this.ready('aura', 0.5, dt)) {
      const R = this.auraRadius()
      const dmg = 6 + 2.5 * Math.floor(av / 2) + (av - 1) * 0.8
      let heals = 0
      for (const e of foes) {
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d > R + e.r) continue
        this.hitEnemy(e, dmg, ((e.x - this.x) / (d || 1)) * 1.5, ((e.z - this.z) / (d || 1)) * 1.5)
        if (this.evo('aura') && heals < 6) {
          this.hp = Math.min(this.maxHp, this.hp + 0.4)
          heals++
        }
      }
      for (const p of remotes) if (Math.hypot(p.x - this.x, p.z - this.z) < R) this.pvpDamage(p, dmg)
    }
    // THUNDER — random strikes
    const tv = this.w('thunder')
    if (tv && this.ready('thunder', this.evo('thunder') ? 1.2 : 2.4, dt)) {
      const n = 1 + Math.floor(tv / 2) + this.amount + (this.evo('thunder') ? 3 : 0)
      const dmg = 30 + 10 * Math.floor((tv - 1) / 2) + (tv - 1) * 2
      const splash = 1.2 * this.area * (this.evo('thunder') ? 1.6 : 1)
      const near = foes.filter((e) => Math.hypot(e.x - this.x, e.z - this.z) < 13)
      const pvpTargets = remotes.filter((p) => p.attackable && Math.hypot(p.x - this.x, p.z - this.z) < 13)
      for (let i = 0; i < n; i++) {
        let tx: number
        let tz: number
        if (pvpTargets.length && rand() < 0.25) {
          const p = pvpTargets[Math.floor(rand() * pvpTargets.length)]
          tx = p.x
          tz = p.z
        } else if (near.length) {
          const e = near[Math.floor(rand() * near.length)]
          tx = e.x
          tz = e.z
        } else continue
        this.events.push({ t: 'strike', x: tx, z: tz, r: splash })
        for (const e of foes) if (Math.hypot(e.x - tx, e.z - tz) < splash + e.r) this.hitEnemy(e, dmg)
        for (const p of remotes) if (Math.hypot(p.x - tx, p.z - tz) < splash) this.pvpDamage(p, dmg)
      }
    }
    // NOVA — periodic explosion
    const nv = this.w('nova')
    if (nv && this.ready('nova', (this.evo('nova') ? 2.4 : 3.2) * (nv >= 4 ? 0.9 : 1), dt)) {
      const R = (2.6 + 0.35 * Math.floor(nv / 3)) * this.area * (this.evo('nova') ? 1.4 : 1)
      const dmg = 22 + 9 * Math.floor((nv - 1) / 2) + (nv - 1) * 2
      const pulses = this.evo('nova') ? 2 : 1
      for (let k = 0; k < pulses; k++) {
        const r = R * (k === 0 ? 1 : 1.5)
        this.events.push({ t: 'nova', x: this.x, z: this.z, r })
        for (const e of foes) {
          const d = Math.hypot(e.x - this.x, e.z - this.z)
          if (d < r + e.r) this.hitEnemy(e, dmg, ((e.x - this.x) / (d || 1)) * 4, ((e.z - this.z) / (d || 1)) * 4)
        }
        for (const p of remotes) if (Math.hypot(p.x - this.x, p.z - this.z) < r) this.pvpDamage(p, dmg)
      }
    }
    this.fire2(dt, foes, remotes)
    this.fireGods(dt, foes, remotes)
    this.fireArts(dt, foes)
  }

  // ───────── second wave of auto-skills ─────────
  private fire2(dt: number, foes: Enemy[], remotes: Remote[]) {
    const near = (x: number, z: number, max: number) => {
      let best: Enemy | null = null
      let bd = max
      for (const e of foes) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - x, e.z - z)
        if (d < bd) (bd = d), (best = e)
      }
      return best
    }
    // FROST COMET — comets fall on the densest nearby foes, chill (evo: freeze)
    const fv = this.w('frost')
    if (fv && this.ready('frost', this.evo('frost') ? 1.5 : 2.8, dt)) {
      const n = 1 + Math.floor(fv / 3) + this.amount + (this.evo('frost') ? 2 : 0)
      const r = 1.5 * this.area * (1 + 0.07 * fv) * (this.evo('frost') ? 1.4 : 1)
      const dmg = (26 + 7 * (fv - 1)) * (this.evo('frost') ? 1.5 : 1)
      const pool = foes.filter((e) => Math.hypot(e.x - this.x, e.z - this.z) < 12)
      for (let i = 0; i < n && pool.length; i++) {
        const e = pool[Math.floor(rand() * pool.length)]
        this.comets.push({ x: e.x, z: e.z, r, dmg, t: 0.38, chill: fv >= 8 ? 3 : 2, freeze: this.evo('frost') ? 1.2 : 0 })
        this.events.push({ t: 'comet', x: e.x, z: e.z, r })
      }
    }
    for (const c of this.comets) {
      c.t -= dt
      if (c.t > 0) continue
      this.events.push({ t: 'frostHit', x: c.x, z: c.z, r: c.r })
      for (const e of foes)
        if (e.alive && Math.hypot(e.x - c.x, e.z - c.z) < c.r + e.r) {
          e.slow = Math.max(e.slow ?? 0, c.chill)
          if (c.freeze) e.frozen = Math.max(e.frozen ?? 0, c.freeze)
          this.hitEnemy(e, c.dmg)
        }
      for (const p of remotes) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r) this.pvpDamage(p, c.dmg)
    }
    this.comets = this.comets.filter((c) => c.t > 0)

    // ARC CHAIN — lightning leaps from foe to foe
    const cv = this.w('chain')
    if (cv && this.ready('chain', this.evo('chain') ? 0.8 : 1.15, dt)) {
      const jumps = 3 + cv + (cv >= 8 ? 1 : 0) + (this.evo('chain') ? 5 : 0)
      let dmg = (22 + 6 * (cv - 1)) * (this.evo('chain') ? 1.4 : 1)
      let cur = near(this.x, this.z, 9)
      const pts: [number, number][] = [[this.x, this.z]]
      const used = new Set<number>()
      let px = this.x
      let pz = this.z
      while (cur && pts.length <= jumps) {
        used.add(cur.id)
        pts.push([cur.x, cur.z])
        px = cur.x
        pz = cur.z
        this.hitEnemy(cur, dmg)
        if (!this.evo('chain')) dmg *= 0.92
        let next: Enemy | null = null
        let bd = 4.8 * this.area
        for (const e of foes) {
          if (!e.alive || used.has(e.id)) continue
          const d = Math.hypot(e.x - px, e.z - pz)
          if (d < bd) (bd = d), (next = e)
        }
        cur = next
      }
      for (const p of remotes) if (p.attackable && Math.hypot(p.x - this.x, p.z - this.z) < 4) this.pvpDamage(p, dmg)
      if (pts.length > 1) this.events.push({ t: 'arc', pts: pts.slice(0, 12) })
    }

    // MOON CHAKRAM — out and back, cuts every foe on both passes
    const kv = this.w('chakram')
    if (kv && this.ready('chakram', this.evo('chakram') ? 1.4 : 2.2, dt)) {
      const n = 1 + (kv >= 4 ? 1 : 0) + (kv >= 7 ? 1 : 0) + this.amount + (this.evo('chakram') ? 1 : 0)
      const d = (6 + 0.5 * Math.floor(kv / 3)) * this.area * (this.evo('chakram') ? 1.3 : 1)
      const dmg = (20 + 5 * (kv - 1)) * (this.evo('chakram') ? 1.5 : 1)
      const tg = near(this.x, this.z, 14)
      const base = tg ? (Math.atan2(tg.x - this.x, tg.z - this.z) * 180) / Math.PI : this.yaw
      for (let i = 0; i < n; i++) {
        const yaw = base + (i - (n - 1) / 2) * (360 / Math.max(n, 3)) * (n > 2 ? 1 : 0.25)
        const a = (yaw * Math.PI) / 180
        this.chakrams.push({ ox: this.x, oz: this.z, fx: Math.sin(a), fz: Math.cos(a), d, t: 0, dur: 1.1, dmg, out: [], back: [], pv: -9 })
        this.events.push({ t: 'chakram', x: this.x, z: this.z, yaw, d, dur: 1.1 })
      }
    }
    for (const c of this.chakrams) {
      c.t += dt
      const k = Math.min(1, c.t / c.dur)
      const going = k < 0.5
      const s = Math.sin(k * Math.PI) * c.d
      // the way back homes on the player
      const bx = going ? c.ox : this.x
      const bz = going ? c.oz : this.z
      const x = bx + c.fx * s
      const z = bz + c.fz * s
      const list = going ? c.out : c.back
      for (const e of foes)
        if (e.alive && !list.includes(e.id) && Math.hypot(e.x - x, e.z - z) < e.r + 0.7) {
          list.push(e.id)
          this.hitEnemy(e, c.dmg, c.fx * 2, c.fz * 2)
        }
      if (this.time - c.pv > 0.5) for (const p of remotes) if (Math.hypot(p.x - x, p.z - z) < 0.8) (this.pvpDamage(p, c.dmg), (c.pv = this.time))
    }
    this.chakrams = this.chakrams.filter((c) => c.t < c.dur)

    // HEX MINE — runes that blow up under foes
    const mv = this.w('mine')
    if (mv) {
      const max = 3 + Math.floor(mv / 2) + (mv >= 8 ? 1 : 0) + (this.evo('mine') ? 4 : 0)
      const r = 1.9 * this.area * (1 + 0.06 * mv) * (this.evo('mine') ? 1.3 : 1)
      const dmg = (36 + 11 * (mv - 1)) * (this.evo('mine') ? 1.6 : 1)
      if (this.ready('mine', this.evo('mine') ? 1.0 : 1.8, dt) && this.mines.length < max) {
        const a = rand() * Math.PI * 2
        const rr = 1.6 + rand() * 2.8
        const c = clampArena(this.x + Math.sin(a) * rr, this.z + Math.cos(a) * rr, 0.6)
        const id = this.nextId++
        this.mines.push({ id, x: c.x, z: c.z, arm: 0.4, life: 9, dmg, r })
        this.events.push({ t: 'mine', id, x: c.x, z: c.z })
      }
      for (const m of this.mines) {
        m.arm -= dt
        m.life -= dt
        if (m.arm > 0) continue
        const trip = m.life <= 0 || foes.some((e) => e.alive && Math.hypot(e.x - m.x, e.z - m.z) < e.r + 0.8) || remotes.some((p) => p.attackable && Math.hypot(p.x - m.x, p.z - m.z) < 0.8)
        if (!trip) continue
        m.life = -1
        this.events.push({ t: 'boom', id: m.id, x: m.x, z: m.z, r: m.r })
        for (const e of foes) {
          const d = Math.hypot(e.x - m.x, e.z - m.z)
          if (e.alive && d < m.r + e.r) this.hitEnemy(e, m.dmg, ((e.x - m.x) / (d || 1)) * 5, ((e.z - m.z) / (d || 1)) * 5)
        }
        for (const p of remotes) if (Math.hypot(p.x - m.x, p.z - m.z) < m.r) this.pvpDamage(p, m.dmg)
        if (this.evo('mine')) this.hp = Math.min(this.maxHp, this.hp + 3)
      }
      this.mines = this.mines.filter((m) => m.life > 0 || m.arm > 0)
    } else this.mines = []

    // PRISM RAY — beams sweep a full circle
    const yv = this.w('beam')
    if (yv && this.ready('beam', (this.evo('beam') ? 2.0 : 3.0) * (yv >= 4 ? 0.85 : 1), dt)) {
      const n = 1 + (yv >= 5 ? 1 : 0) + (this.evo('beam') ? 1 : 0)
      const len = (5.2 + 0.5 * Math.floor(yv / 3)) * this.area * (this.evo('beam') ? 1.3 : 1)
      const dmg = (22 + 6 * (yv - 1)) * (this.evo('beam') ? 1.5 : 1)
      const yaw = rand() * 360
      this.sweeps.push({ t: 0, dur: 0.8, yaw, len, n, dmg, hit: new Set(), pv: new Set() })
      this.events.push({ t: 'sweep', x: this.x, z: this.z, yaw, len, dur: 0.8, n })
    }
    for (const b of this.sweeps) {
      b.t += dt
      const ang = b.yaw + Math.min(1, b.t / b.dur) * 360
      for (let i = 0; i < b.n; i++) {
        const a = ((ang + (i * 360) / b.n) * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        const inBeam = (x: number, z: number, r: number) => {
          const rx = x - this.x
          const rz = z - this.z
          const along = rx * fx + rz * fz
          return along > 0 && along < b.len + r && Math.abs(rx * fz - rz * fx) < 0.45 + r
        }
        for (const e of foes) if (e.alive && !b.hit.has(e.id) && inBeam(e.x, e.z, e.r)) (b.hit.add(e.id), this.hitEnemy(e, b.dmg))
        for (const p of remotes) if (!b.pv.has(p.id) && inBeam(p.x, p.z, 0.3)) (b.pv.add(p.id), this.pvpDamage(p, b.dmg))
      }
    }
    this.sweeps = this.sweeps.filter((b) => b.t < b.dur)

    // SPIRIT WISPS — familiars that hover and dart
    const wv = this.w('wisp')
    const want = wv ? 1 + Math.floor(wv / 3) + this.amount + (this.evo('wisp') ? 2 : 0) : 0
    while (this.wisps.length < want) this.wisps.push({ x: this.x, z: this.z, cd: 0.4 * this.wisps.length, ph: this.wisps.length * 2.1, dash: 0, tx: 0, tz: 0 })
    if (this.wisps.length > want) this.wisps.length = want
    if (wv) {
      const dmg = (18 + 5 * (wv - 1)) * (this.evo('wisp') ? 1.5 : 1)
      const cd = (wv >= 4 ? 1.1 : 1.3) * (wv >= 7 ? 0.85 : 1) * (this.evo('wisp') ? 0.65 : 1) * this.cdMul
      const splash = this.evo('wisp') ? 1.5 * this.area : 0
      this.wisps.forEach((w, i) => {
        w.ph += dt * 2.2
        if (w.dash > 0) {
          w.dash -= dt
          const k = Math.min(1, dt / Math.max(0.01, w.dash + dt))
          w.x += (w.tx - w.x) * k
          w.z += (w.tz - w.z) * k
          if (w.dash <= 0) {
            for (const e of foes)
              if (e.alive && Math.hypot(e.x - w.tx, e.z - w.tz) < e.r + 0.5 + splash) this.hitEnemy(e, dmg)
            for (const p of remotes) if (Math.hypot(p.x - w.tx, p.z - w.tz) < 0.6 + splash) this.pvpDamage(p, dmg)
          }
          return
        }
        // hover around the hunter
        const a = w.ph + (i * Math.PI * 2) / Math.max(1, want)
        const hx = this.x + Math.sin(a) * 1.3
        const hz = this.z + Math.cos(a) * 1.3
        const k = Math.min(1, dt * 6)
        w.x += (hx - w.x) * k
        w.z += (hz - w.z) * k
        w.cd -= dt
        if (w.cd > 0) return
        const tg = near(w.x, w.z, 8)
        if (!tg) return
        w.cd = cd
        w.dash = 0.18
        w.tx = tg.x
        w.tz = tg.z
        this.events.push({ t: 'dash', x0: w.x, z0: w.z, x1: tg.x, z1: tg.z })
      })
    }
  }

  orbitCount() {
    const ov = this.w('orbit')
    if (!ov) return 0
    return 1 + Math.floor(ov / 2) + this.amount + (this.evo('orbit') ? 3 : 0)
  }
  orbitRadius() {
    return 1.5 * this.area * (this.evo('orbit') ? 1.25 : 1)
  }
  auraRadius() {
    const av = this.w('aura')
    return av ? (1.4 + 0.18 * Math.ceil(av / 2)) * this.area * (this.evo('aura') ? 1.3 : 1) : 0
  }

  private moveProjs(dt: number, remotes: Remote[]) {
    for (const p of this.projs) {
      if (p.life <= 0) continue
      p.life -= dt
      p.x += p.vx * dt
      p.z += p.vz * dt
      for (const e of this.enemies) {
        if (!e.alive || p.pierce <= 0 || p.hit.includes(e.id)) continue
        if (Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.25) {
          p.hit.push(e.id)
          p.pierce--
          this.hitEnemy(e, p.dmg, p.vx * 0.12, p.vz * 0.12)
        }
      }
      for (const r of remotes) {
        if (p.pierce > 0 && Math.hypot(r.x - p.x, r.z - p.z) < 0.5) {
          this.pvpDamage(r, p.dmg)
          p.pierce--
        }
      }
      if (p.pierce <= 0) p.life = 0
    }
    this.projs = this.projs.filter((p) => p.life > 0)
  }

  // ───────── pickups ─────────
  private drop(kind: PickKind, x: number, z: number, value: number, big = false) {
    // merge tiny gems when there are too many on the floor
    if (kind === 'gem') {
      const gems = this.pickups.filter((p) => p.alive && p.kind === 'gem')
      if (gems.length > 110) {
        // merge into the nearest gem so XP stays where the kill happened
        let g = gems[0]
        let bd = Infinity
        for (const q of gems) {
          const d = Math.abs(q.x - x) + Math.abs(q.z - z)
          if (d < bd) (bd = d), (g = q)
        }
        g.value += value
        return
      }
    }
    const pk: Pickup = { id: this.nextId++, kind, x, z, value, alive: true, flying: false, big, born: this.time }
    const slot = this.pickups.findIndex((p) => !p.alive)
    if (slot >= 0) this.pickups[slot] = pk
    else this.pickups.push(pk)
  }

  private collect(dt: number) {
    const mag = this.magnet
    for (const p of this.pickups) {
      if (!p.alive) continue
      const d = Math.hypot(p.x - this.x, p.z - this.z)
      // gems left on the floor for 18 s drift to the player on their own
      if (!p.flying && (d < (p.kind === 'chest' ? 1.3 : mag) || (p.kind === 'gem' && this.time - p.born > 18))) p.flying = true
      if (p.flying) {
        const sp = 10 + Math.max(0, mag - d) * 2 + Math.min(14, Math.max(0, d - mag))
        p.x += ((this.x - p.x) / (d || 1)) * Math.min(d, sp * dt)
        p.z += ((this.z - p.z) / (d || 1)) * Math.min(d, sp * dt)
      }
      if (Math.hypot(p.x - this.x, p.z - this.z) < 0.5) {
        p.alive = false
        if (p.kind === 'gem') {
          this.gainXp(p.value)
          this.events.push({ t: 'gem' })
        } else if (p.kind === 'coin') {
          this.gold += Math.round(5 * this.goldMul * (1 + this.time / 2400))
          this.events.push({ t: 'coin' })
        } else if (p.kind === 'heal') {
          this.hp = Math.min(this.maxHp, this.hp + p.value)
          this.events.push({ t: 'heal' })
        } else if (p.kind === 'potion') {
          const k: PotionKind = p.value === 1 ? 'rage' : 'hp'
          if (this.potions[k] < POTION_DEFS[k].carry) this.potions[k]++
          else this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.1)
          this.events.push({ t: 'potionGet', kind: k })
        } else if (p.kind === 'chest') this.events.push({ t: 'chest', big: !!p.big })
      }
    }
  }

  gainXp(v: number) {
    this.xp += v * this.xpMul
    while (this.xp >= this.need) {
      this.xp -= this.need
      this.level++
      this.pendingLevels++
      this.events.push({ t: 'levelup' })
      if (this.level >= GOD_UNLOCK && !this.awakened) {
        this.awakened = true
        this.events.push({ t: 'awaken' })
      }
      while (!this.ascended && this.level >= bossFor(this.bossIndex + this.bossQueue).lvl) this.bossQueue++
    }
  }

  // ───────── upgrades ─────────
  canEvolve(): WeaponId[] {
    const out: WeaponId[] = []
    for (const [id, lv] of this.weapons) if (lv >= MAX_WEAPON_LVL && !this.evolved.has(id) && this.p(WEAPONS[id].evoWith) > 0) out.push(id)
    return out
  }

  allUpgrades(): Option[] {
    const opts: Option[] = []
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const lv = this.w(id)
      if (lv === 0 && this.weapons.size >= MAX_WEAPONS) continue
      if (lv < MAX_WEAPON_LVL) opts.push({ kind: 'weapon', id, to: lv + 1 })
    }
    for (const id of Object.keys(PASSIVES) as PassiveId[]) {
      const lv = this.p(id)
      if (lv === 0 && this.passives.size >= MAX_PASSIVES) continue
      if (lv < MAX_PASSIVE_LVL) opts.push({ kind: 'passive', id, to: lv + 1 })
    }
    return opts
  }

  godUpgrades(): Option[] {
    if (this.level < GOD_UNLOCK && !this.godBorn) return []
    const out: Option[] = []
    for (const id of Object.keys(GODS) as GodId[]) {
      const lv = this.g(id)
      if (lv === 0 && this.gods.size >= MAX_GODS) continue
      if (lv < MAX_GOD_LVL) out.push({ kind: 'god', id, to: lv + 1 })
    }
    return out
  }

  /** has this boss of the ladder been slain in this run? */
  private slain(name: string) {
    const i = BOSSES.findIndex((b) => b.name === name)
    return i >= 0 && i < this.bossIndex - this.bossesAlive().length
  }
  artUnlocked(id: ArtId) {
    const d = ARTS[id]
    return d.lvl ? this.level >= d.lvl : !!d.boss && this.slain(d.boss)
  }
  artUpgrades(): Option[] {
    const out: Option[] = []
    for (const id of Object.keys(ARTS) as ArtId[]) {
      const lv = this.arts.get(id) ?? 0
      if (this.consumed.has(id)) continue
      if (lv === 0 && this.artSlotsFull()) continue
      if (lv < MAX_ART_LVL && this.artUnlocked(id)) out.push({ kind: 'art', id, to: lv + 1 })
    }
    return out
  }

  // ── fusion (Lv 250+) ──
  fusionOpen() {
    return this.level >= FUSION_LVL
  }
  artSlotsFull() {
    return this.fusionOpen() && !this.legacyArts && this.arts.size >= ART_SLOTS
  }
  /** can ESS melt into CORE? both mastered, and the result holds at most MAX_ESSENCE essences */
  canFuse(core: ArtId, ess: ArtId) {
    if (!this.fusionOpen() || core === ess) return false
    if (isJackpotArt(core) || isJackpotArt(ess)) return false
    if ((this.arts.get(core) ?? 0) < MAX_ART_LVL || (this.arts.get(ess) ?? 0) < MAX_ART_LVL) return false
    return (this.fusions.get(core)?.length ?? 0) + 1 + (this.fusions.get(ess)?.length ?? 0) <= MAX_ESSENCE
  }
  /** what fusing would make, without doing it */
  fusePreview(core: ArtId, ess: ArtId): { name: string; essences: ArtId[]; stats: FusionStats } {
    const essences = [...(this.fusions.get(core) ?? []), ess, ...(this.fusions.get(ess) ?? [])]
    return { name: fusionName(core, essences), essences, stats: fusionStats(essences) }
  }
  fusablePairs() {
    let n = 0
    const ids = [...this.arts.keys()]
    for (const a of ids) for (const b of ids) if (this.canFuse(a, b)) n++
    return n
  }
  fuse(core: ArtId, ess: ArtId) {
    if (!this.canFuse(core, ess)) return false
    // every fusion rolls the jackpot: 1 in 1000 divine, 1 in 500 a disaster
    const roll = this.fusionLuck ?? rand()
    this.fusionLuck = undefined
    const jackpot: Jackpot | null = roll < DIVINE_CHANCE ? 'divine' : roll < DIVINE_CHANCE + DUNG_CHANCE ? 'dung' : null
    if (jackpot) {
      const gone = [core, ess, ...(this.fusions.get(core) ?? []), ...(this.fusions.get(ess) ?? [])]
      for (const id of [core, ess]) {
        this.arts.delete(id)
        this.fusions.delete(id)
      }
      for (const id of gone) this.consumed.add(id)
      const art = JACKPOT_ART[jackpot]
      this.arts.set(art, MAX_ART_LVL)
      this.artSeen.add(art)
      this.events.push({ t: 'fuse', core: art, ess, n: 3, jackpot })
      return true
    }
    const { essences } = this.fusePreview(core, ess)
    this.fusions.set(core, essences)
    this.fusions.delete(ess)
    this.arts.delete(ess)
    for (const e of essences) this.consumed.add(e)
    this.events.push({ t: 'fuse', core, ess, n: essences.length })
    return true
  }
  /** fused stars held (★ per essence) */
  fusionStars() {
    let n = 0
    for (const e of this.fusions.values()) n += e.length
    if (this.arts.has('crown')) n += 4
    if (this.arts.has('flush')) n += 2
    return n
  }
  /** BOSS DREAD: a Lv 250+ boss on the field smothers passive healing */
  dreadOn() {
    if (!this.bossIds.length) return false
    for (const id of this.bossIds) {
      const b = this.enemies.find((e) => e.id === id)
      if (b && b.alive && bossFor(b.boss ?? 0).lvl >= DREAD_LVL) return true
    }
    return false
  }
  private dreadCache = { t: -1, on: false }
  healMul() {
    if (this.dreadCache.t !== this.time) this.dreadCache = { t: this.time, on: this.dreadOn() }
    return this.dreadCache.on ? DREAD_HEAL : 1
  }
  /** BOSS FURY: bosses answer your fusions — harder hits, faster attacks */
  bossFury() {
    return Math.min(FURY_MAX, 1 + FURY_PER_STAR * this.fusionStars()) * (this.healMul() < 1 ? DREAD_DMG : 1)
  }
  artName(id: ArtId) {
    return fusionName(id, this.fusions.get(id) ?? [])
  }

  levelChoices(): Option[] {
    const n = 3 + (this.p('fortune') >= 3 ? 1 : 0)
    // a freshly unlocked art is always on offer, then arts mix into the pool with everything else
    const arts = this.artUpgrades()
    const fresh = arts.filter((o) => o.kind === 'art' && o.to === 1 && !this.artSeen.has(o.id))
    if (fresh.length) {
      const f = fresh[0] as { kind: 'art'; id: ArtId; to: number }
      this.artSeen.add(f.id)
      const rest = this.levelChoicesBase(arts.filter((o) => o !== f), n - 1)
      return [f as Option].concat(rest)
    }
    return this.levelChoicesBase(arts, n)
  }

  /** boons still worth taking (capped ones drop out) */
  private boonPool(): BoostId[] {
    return (Object.keys(BOOSTS) as BoostId[]).filter((b) => {
      if (b === 'area') return this.boostArea < 0.6
      if (b === 'potion') return this.potions.hp < 9
      if (b === 'phoenix') return this.potions.phoenix < 1
      const cap = BOOSTS[b].cap
      return cap === undefined || (this.boons[b] ?? 0) < cap
    })
  }
  private rollRarity() {
    const total = RARITY.reduce((s, r) => s + r.w, 0)
    let x = rand() * total
    for (const r of RARITY) {
      if (x < r.w) return r.m
      x -= r.w
    }
    return 1
  }
  boostChoices(n: number): Option[] {
    const ids = this.boonPool()
    const out: Option[] = []
    while (out.length < n && ids.length) {
      const id = ids.splice(Math.floor(rand() * ids.length), 1)[0]
      out.push({ kind: 'boost', id, m: id === 'phoenix' ? 1 : this.rollRarity() })
    }
    return out
  }

  private levelChoicesBase(arts: Option[], n: number): Option[] {
    const all = this.allUpgrades().concat(arts)
    // after the awakening, every level-up offers a god power (if any is left)
    const gods = this.godUpgrades()
    if (gods.length) {
      const g = gods[Math.floor(rand() * gods.length)]
      const rest = all.length ? all : this.boostChoices(6)
      const others = gods.filter((x) => x !== g).concat(rest)
      const out: Option[] = [g]
      while (out.length < n && others.length) out.push(others.splice(Math.floor(rand() * others.length), 1)[0])
      return out
    }
    if (!all.length) return this.boostChoices(Math.max(3, n))
    // owned items are twice as likely, so builds snowball
    const weighted = all.map((o) => ({ o, w: (o.kind === 'weapon' ? this.w(o.id) : o.kind === 'passive' ? this.p(o.id) : o.kind === 'art' ? this.arts.get(o.id) ?? 0 : 0) > 0 ? 2.2 : 1 }))
    const out: Option[] = []
    while (out.length < n && weighted.length) {
      const total = weighted.reduce((s, x) => s + x.w, 0)
      let r = rand() * total
      let i = 0
      while (i < weighted.length - 1 && r > weighted[i].w) r -= weighted[i++].w
      out.push(weighted[i].o)
      weighted.splice(i, 1)
    }
    return out
  }

  /** a level-up that changes your build gets a pause; routine upgrades are taken automatically */
  isMeaningful(opts: Option[]) {
    return opts.some((o) => o.kind === 'evolve' || o.kind === 'god' || ((o.kind === 'weapon' || o.kind === 'passive' || o.kind === 'art') && o.to === 1) || (o.kind === 'boost' && (o.m ?? 1) >= 3))
  }
  autoPick(opts: Option[]): Option {
    const sc = (o: Option) => (o.kind === 'weapon' ? 3 + o.to * 0.1 : o.kind === 'art' ? 2.9 : o.kind === 'passive' ? 2.4 : o.kind === 'boost' ? 1 + (o.m ?? 1) * 0.4 : 1)
    return [...opts].sort((a, b) => sc(b) - sc(a))[0]
  }

  apply(o: Option) {
    if (o.kind === 'weapon') this.weapons.set(o.id, o.to)
    else if (o.kind === 'passive') {
      this.passives.set(o.id, o.to)
      if (o.id === 'vitality') {
        this.maxHp += 20
        this.hp += 20
      }
    } else if (o.kind === 'evolve') this.evolved.add(o.id)
    else if (o.kind === 'god') this.gods.set(o.id, o.to)
    else if (o.kind === 'art') this.arts.set(o.id, o.to)
    else if (o.kind === 'gold') this.gold += o.amount
    else if (o.kind === 'heal') this.hp = Math.min(this.maxHp, this.hp + o.amount)
    else if (o.kind === 'boost') {
      const m = o.m ?? 1
      const n = BOOSTS[o.id].per * m
      if (o.id === 'dmg') this.boostDmg += n / 100
      else if (o.id === 'hp') {
        this.maxHp += n
        this.hp = Math.min(this.maxHp, this.hp + n)
      } else if (o.id === 'area') this.boostArea = Math.min(0.6, this.boostArea + n / 100)
      else if (o.id === 'regen') this.boostRegen += n
      else if (o.id === 'gold') this.gold += n
      else if (o.id === 'potion') this.potions.hp = Math.min(9, this.potions.hp + n)
      else if (o.id === 'reroll') this.rerolls += n
      else if (o.id === 'phoenix') this.potions.phoenix = 1
      else {
        const cap = BOOSTS[o.id].cap
        this.boons[o.id] = Math.min(cap ?? Infinity, (this.boons[o.id] ?? 0) + n)
      }
    }
  }

  // ───────── ARTS ─────────
  private artHit = false
  private fireArts(dt: number, foes: Enemy[]) {
    this.artHit = true
    try {
      this.fireArts_(dt, foes)
    } finally {
      this.artHit = false
    }
  }
  private fireArts_(dt: number, foes: Enemy[]) {
    // resolve what is already falling / spinning / flying
    for (const st of this.ownStrikes) {
      st.t -= dt
      if (st.t > 0) continue
      if (st.r >= 2) this.events.push({ t: 'slam', x: st.x, z: st.z, r: st.r })
      for (const e of foes)
        if (e.alive && Math.hypot(e.x - st.x, e.z - st.z) < st.r + e.r) {
          if (st.slow) e.slow = Math.max(e.slow ?? 0, st.slow)
          this.hitEnemy(e, st.dmg)
        }
    }
    this.ownStrikes = this.ownStrikes.filter((st) => st.t > 0)
    for (const sp of this.ownSpokes) {
      sp.age += dt
      if (sp.age < sp.warm) continue
      sp.tick -= dt
      if (sp.tick > 0) continue
      sp.tick = 0.25
      const a0 = sp.a0 + sp.omega * (sp.age - sp.warm)
      for (let i = 0; i < sp.n; i++) {
        const a = ((a0 + (i * 360) / sp.n) * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        for (const e of foes) {
          if (!e.alive) continue
          const rx = e.x - sp.x
          const rz = e.z - sp.z
          const along = rx * fx + rz * fz
          if (along > 0 && along < sp.len + e.r && Math.abs(rx * fz - rz * fx) < sp.w / 2 + e.r) this.hitEnemy(e, sp.dmg)
        }
      }
    }
    this.ownSpokes = this.ownSpokes.filter((sp) => sp.age < sp.warm + sp.dur)
    for (const a of this.allies) {
      a.life -= dt
      let tg: Enemy | null = null
      let bd = 14
      for (const e of foes) {
        if (!e.alive || a.hit.includes(e.id)) continue
        const d = Math.hypot(e.x - a.x, e.z - a.z)
        if (d < bd) (bd = d), (tg = e)
      }
      const sp = a.k === 'fox' ? 9 : 11
      if (tg) {
        const d = bd || 1
        a.vx += (((tg.x - a.x) / d) * sp - a.vx) * Math.min(1, dt * 5)
        a.vz += (((tg.z - a.z) / d) * sp - a.vz) * Math.min(1, dt * 5)
        if (d < tg.r + 0.6) {
          a.hit.push(tg.id)
          this.hitEnemy(tg, a.dmg, a.vx * 0.2, a.vz * 0.2)
          if (a.hit.length >= (a.k === 'shade' ? 4 : 2)) a.life = 0
        }
      }
      a.x += a.vx * dt
      a.z += a.vz * dt
    }
    this.allies = this.allies.filter((a) => a.life > 0)
    if (!this.arts.size) return

    const sc = manualLevelScale(this.level) * (this.godBorn ? 1.25 : 1)
    // the art being cast right now: its fusion bonuses (none for an unfused art)
    const NOFUSE: FusionStats = { dmg: 1, area: 1, cd: 1, slow: 0 }
    let fz = NOFUSE
    // a fused art's effects carry its newest essence's colour (the view adds a glow of that colour)
    let tintFrom = this.events.length
    let tintCol: string | undefined
    const flushTint = () => {
      if (tintCol) for (let i = tintFrom; i < this.events.length; i++) {
        const ev = this.events[i]
        if (ev.t === 'mStrike' || ev.t === 'mRing' || ev.t === 'slash') ev.tint = tintCol
      }
      tintFrom = this.events.length
    }
    const dmgOf = (base: number, _tier: number) => base * sc * fz.dmg * (1 + 0.22 * (lvRaw - 1)) * (lvRaw >= MAX_ART_LVL ? 1.35 : 1)
    const near = (R: number) => foes.filter((e) => e.alive && Math.hypot(e.x - this.x, e.z - this.z) < R)
    const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)]
    const nearest = (R: number) => {
      let b: Enemy | null = null
      let bd = R
      for (const e of foes) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d < bd) (bd = d), (b = e)
      }
      return b
    }
    const aimYaw = (R = 14) => {
      const t = nearest(R)
      return t ? (Math.atan2(t.x - this.x, t.z - this.z) * 180) / Math.PI : this.yaw
    }
    const strike = (k: string, x: number, z: number, r: number, delay: number, dmg: number, slow = fz.slow) => {
      const c = clampArena(x, z, 0.3)
      this.ownStrikes.push({ x: c.x, z: c.z, r, t: delay, dmg, slow })
      this.events.push({ t: 'mStrike', x: c.x, z: c.z, r, delay, k, own: true })
    }
    const spokes = (n: number, len: number, w: number, omega: number, dur: number, dmg: number, a0 = rand() * 360) => {
      this.ownSpokes.push({ x: this.x, z: this.z, n, len, w, a0, omega, age: 0, warm: 0.05, dur, dmg, tick: 0 })
      this.events.push({ t: 'mSpokes', x: this.x, z: this.z, n, len, w, a0, omega, warm: 0.05, dur, own: true })
    }
    const ring = (i: number, dmg: number) => {
      const r0 = 2.2 + 4 * i
      this.events.push({ t: 'mRing', x: this.x, z: this.z, r0, r1: r0 + 2, own: true })
      for (const e of foes) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d > r0 - e.r - 0.6 && d < r0 + 2 + e.r) this.hitEnemy(e, dmg, ((e.x - this.x) / (d || 1)) * 3, ((e.z - this.z) / (d || 1)) * 3)
      }
    }
    const slashAt = (x: number, z: number, yaw: number, w: number, l: number, dmg: number) => {
      const a = (yaw * Math.PI) / 180
      const fx = Math.sin(a)
      const fz = Math.cos(a)
      this.events.push({ t: 'slash', x, z, yaw, w, l })
      for (const e of foes) {
        if (!e.alive) continue
        const rx = e.x - x
        const rz = e.z - z
        if (Math.abs(rx * fx + rz * fz) <= l / 2 + e.r && Math.abs(rx * fz - rz * fx) <= w / 2 + e.r) this.hitEnemy(e, dmg, fx * 2, fz * 2)
      }
    }
    const crowd = (R = 14) => this.densest(foes, R)
    const lvOf = (id: ArtId) => this.arts.get(id) ?? 0
    // levels 1-8 map to tiers 1-5 (the tier decides counts/sizes; every level adds damage)
    const TIER = [0, 1, 2, 3, 3, 4, 4, 4, 5]
    let lvRaw = 1
    const go = (id: ArtId, cd: number) => {
      const lv = lvOf(id)
      lvRaw = lv
      const tier = TIER[lv] ?? 0
      const ess = this.fusions.get(id)
      flushTint()
      tintCol = ess ? ELEMENTS[ART_ELEMENT[ess[ess.length - 1]]].color : undefined
      fz = ess ? fusionStats(ess) : NOFUSE
      A = this.area * fz.area
      return lv > 0 && this.ready('art_' + id, cd * fz.cd * (tier >= 4 ? 0.85 : 1) * (lv >= 6 ? 0.92 : 1), dt) ? tier : 0
    }
    let A = this.area
    let lv = 0
    // ── rift arts ──
    if ((lv = go('ember', 2.6))) {
      const pool = near(12)
      const n = 3 + 2 * Math.floor(lv / 2) + (lv >= 5 ? 4 : 0)
      for (let i = 0; i < n && pool.length; i++) {
        const e = pick(pool)
        strike('fire', e.x + (rand() - 0.5) * 1.5, e.z + (rand() - 0.5) * 1.5, 1.3 * A, 0.55 + rand() * 0.3, dmgOf(28, lv))
      }
    }
    if ((lv = go('fan', 1.6))) {
      const n = 5 + 2 * Math.floor(lv / 2)
      const base = aimYaw()
      const spread = lv >= 5 ? 360 : 70
      for (let i = 0; i < n; i++) {
        const yaw = base + (spread >= 360 ? (i * 360) / n : (i / Math.max(1, n - 1) - 0.5) * spread)
        const a = (yaw * Math.PI) / 180
        this.projs.push({ id: this.nextId++, x: this.x, z: this.z, vx: Math.sin(a) * 16, vz: Math.cos(a) * 16, dmg: dmgOf(16, lv), pierce: lv >= 3 ? 4 : 2, life: 0.9, hit: [], k: 'knife' })
      }
      this.events.push({ t: 'shoot' })
    }
    if ((lv = go('tide', 3.4))) {
      const n = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0)
      for (let i = 0; i < n; i++) ring(i, dmgOf(34, lv) * (lv >= 5 ? 1.2 : 1))
    }
    if ((lv = go('lances', 2.2))) {
      const pool = near(16).sort((a, b) => b.maxHp - a.maxHp)
      const n = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 2 : 0) + (lv >= 5 ? 2 : 0)
      for (let i = 0; i < n && i < pool.length; i++) strike('spear', pool[i].x, pool[i].z, 1.4 * A, 0.45, dmgOf(60, lv))
    }
    if ((lv = go('kunai', 2.0))) {
      const bursts = lv >= 5 ? 2 : 1
      for (let b = 0; b < bursts; b++) {
        const n = 8 + 4 * Math.floor(lv / 2)
        for (let i = 0; i < n; i++) {
          const a = ((i * 360) / n + b * (180 / n)) * (Math.PI / 180)
          this.projs.push({ id: this.nextId++, x: this.x, z: this.z, vx: Math.sin(a) * (14 - b * 3), vz: Math.cos(a) * (14 - b * 3), dmg: dmgOf(14, lv), pierce: 2, life: 0.8, hit: [], k: 'knife' })
        }
      }
    }
    if ((lv = go('drums', 2.8))) {
      const rings = lv >= 5 ? 2 : 1
      for (let k = 0; k < rings; k++) {
        const n = 6 + 2 * Math.floor(lv / 2) + k * 4
        const R = (lv >= 4 ? 4.6 : 3.8) * A + k * 3
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + k * 0.3
          strike('bolt', this.x + Math.sin(a) * R, this.z + Math.cos(a) * R, 1.3 * A, 0.2 + k * 0.15, dmgOf(30, lv))
        }
      }
    }
    if ((lv = go('fist', 3.6))) {
      const n = 1 + (lv >= 4 ? 1 : 0) + (lv >= 5 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const c = crowd() ?? nearest(14)
        if (!c) break
        strike('fist', c.x + i * 1.5, c.z, (2.4 + (lv >= 3 ? 0.6 : 0)) * A, 0.6, dmgOf(95, lv))
      }
    }
    if ((lv = go('stars', 2.4))) {
      const n = 6 + 3 * Math.floor(lv / 2) + (lv >= 5 ? 6 : 0)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const rr = 2 + rand() * 9
        strike('star', this.x + Math.sin(a) * rr, this.z + Math.cos(a) * rr, 1.2 * A, 0.6 + rand() * 0.5, dmgOf(26, lv))
      }
    }
    if ((lv = go('broadside', 3.0))) {
      const lines = lv >= 3 ? 2 : 1
      const shells = 5 + 2 * Math.floor(lv / 2) + (lv >= 5 ? 3 : 0)
      const base = aimYaw(16)
      for (let l = 0; l < lines; l++) {
        const a = ((base + (l ? 180 : 0)) * Math.PI) / 180
        for (let i = 0; i < shells; i++) strike('cannon', this.x + Math.sin(a) * (2 + i * 1.8), this.z + Math.cos(a) * (2 + i * 1.8), 1.4 * A, 0.3 + i * 0.12, dmgOf(38, lv))
      }
    }
    if ((lv = go('pillars', 2.6))) {
      const pool = near(13)
      const n = 4 + 2 * Math.floor(lv / 2) + (lv >= 5 ? 4 : 0)
      for (let i = 0; i < n && pool.length; i++) {
        const e = pick(pool)
        strike('pillar', e.x, e.z, 1.6 * A, 0.5, dmgOf(52, lv))
      }
    }
    if ((lv = go('blacksun', 4.2))) {
      const n = 1 + (lv >= 4 ? 1 : 0) + (lv >= 5 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const c = crowd() ?? nearest(14)
        if (!c) break
        strike('sun', c.x + (i ? (rand() - 0.5) * 6 : 0), c.z + (i ? (rand() - 0.5) * 6 : 0), (3.2 + (lv >= 2 ? 0.8 : 0)) * A, 1.2, dmgOf(120, lv), 2.5)
      }
    }
    if ((lv = go('wheel', 4.5))) spokes(2 + Math.floor(lv / 2) + (lv >= 5 ? 2 : 0), (8 + (lv >= 4 ? 3 : 0)) * A, 1.2, 90, 2.8, dmgOf(14, lv))
    // ── mythic arts ──
    if ((lv = go('kiburst', 2.4))) {
      const base = aimYaw()
      const dirs = lv >= 5 ? [base, base + 180] : [base]
      for (const y of dirs) spokes(1, 16 * A, (2.6 + (lv >= 2 ? 1 : 0)) * A, 0, 0.6, dmgOf(70, lv), y)
    }
    if ((lv = go('cannonade', 2.6))) {
      const n = 6 + 3 * Math.floor(lv / 2) + (lv >= 5 ? 8 : 0)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const rr = 2.5 + rand() * 10
        strike('cannon', this.x + Math.sin(a) * rr, this.z + Math.cos(a) * rr, 1.6 * A, 0.5 + rand() * 0.6, dmgOf(60, lv))
      }
    }
    if ((lv = go('cuts', 1.8))) {
      const pool = near(9)
      const n = 4 + 3 * Math.floor(lv / 2)
      for (let i = 0; i < n && pool.length; i++) {
        const e = pick(pool)
        slashAt(e.x, e.z, rand() * 360, 1.0 * A, 3.2 * A, dmgOf(45, lv))
      }
      if (lv >= 5)
        for (let i = 0; i < 2; i++) {
          this.allies.push({ id: this.nextId++, x: this.x + (i ? 1 : -1), z: this.z - 0.5, vx: 0, vz: 0, life: 4, dmg: dmgOf(60, lv), k: 'shade', hit: [] })
          const y = ((this.yaw + (i ? 40 : -40)) * Math.PI) / 180
          this.events.push({ t: 'allyOut', x: this.x, z: this.z, vx: Math.sin(y) * 6, vz: Math.cos(y) * 6, life: 1.8, k: 1 })
        }
    }
    if ((lv = go('judgment', 3.6))) {
      const c = nearest(14) ?? { x: this.x, z: this.z }
      const g = 3 + (lv >= 2 ? 2 : 0)
      const reps = lv >= 5 ? 2 : 1
      for (let r = 0; r < reps; r++)
        for (let i = 0; i < g; i++)
          for (let j = 0; j < g; j++) if ((i + j + r) % 2 === 0) strike('pillar', c.x + (i - (g - 1) / 2) * 3.2, c.z + (j - (g - 1) / 2) * 3.2, 1.7 * A, 0.6 + r * 0.9, dmgOf(80, lv))
    }
    if ((lv = go('hellrain', 2.2))) {
      const pool = near(13)
      const n = 8 + 4 * Math.floor(lv / 2) + (lv >= 5 ? 8 : 0)
      for (let i = 0; i < n; i++) {
        const e = pool.length && rand() < 0.7 ? pick(pool) : null
        const a = rand() * Math.PI * 2
        const rr = 2 + rand() * 9
        strike('fire', e ? e.x : this.x + Math.sin(a) * rr, e ? e.z : this.z + Math.cos(a) * rr, 1.5 * A, 0.5 + rand() * 0.7, dmgOf(55, lv))
      }
    }
    if ((lv = go('horizon', 4.0))) {
      const n = 1 + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0) + (lv >= 5 ? 1 : 0)
      for (let i = 0; i < n; i++) {
        const c = i === 0 ? crowd(16) : pick(near(16))
        if (!c) break
        strike('sun', c.x, c.z, 3.6 * A, 1.1, dmgOf(160, lv), lv >= 3 ? 3.5 : 2)
      }
    }
    if ((lv = go('foxfire', 2.2))) {
      const n = 3 + 2 * Math.floor(lv / 2) + (lv >= 5 ? 4 : 0)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        this.allies.push({ id: this.nextId++, x: this.x + Math.sin(a), z: this.z + Math.cos(a), vx: Math.sin(a) * 6, vz: Math.cos(a) * 6, life: 3.5, dmg: dmgOf(55, lv), k: 'fox', hit: [] })
        this.events.push({ t: 'allyOut', x: this.x, z: this.z, vx: Math.sin(a) * 7, vz: Math.cos(a) * 7, life: 1.6, k: 0 })
      }
    }
    if ((lv = go('phantom', 3.2))) {
      const base = this.yaw
      const lines = lv >= 5 ? 4 : 2
      const L = 6 + (lv >= 2 ? 3 : 0)
      for (let l = 0; l < lines; l++) {
        const side = ((base + 90 + l * (360 / lines)) * Math.PI) / 180
        const fwd = (base * Math.PI) / 180
        for (let i = 0; i < L; i++) {
          const off = (i - L / 2) * 1.8
          strike('cannon', this.x + Math.sin(side) * 3.5 + Math.sin(fwd) * off, this.z + Math.cos(side) * 3.5 + Math.cos(fwd) * off, 1.5 * A, 0.3 + i * 0.08, dmgOf(65, lv))
        }
      }
    }
    if ((lv = go('raijin', 2.6))) {
      const n = 8 + 2 * Math.floor(lv / 2)
      const R = 5 * A
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        strike('bolt', this.x + Math.sin(a) * R, this.z + Math.cos(a) * R, 1.6 * A, 0.25, dmgOf(60, lv))
      }
      let cur = nearest(10)
      const pts: [number, number][] = [[this.x, this.z]]
      const used = new Set<number>()
      const jumps = 5 + (lv >= 4 ? 4 : 0) + (lv >= 5 ? 6 : 0)
      while (cur && pts.length <= jumps) {
        used.add(cur.id)
        pts.push([cur.x, cur.z])
        this.hitEnemy(cur, dmgOf(50, lv))
        let nx: Enemy | null = null
        let bd = 6
        for (const e of foes) {
          if (!e.alive || used.has(e.id)) continue
          const d = Math.hypot(e.x - cur.x, e.z - cur.z)
          if (d < bd) (bd = d), (nx = e)
        }
        cur = nx
      }
      if (pts.length > 1) this.events.push({ t: 'arc', pts: pts.slice(0, 12) })
    }
    if ((lv = go('eyes', 4.0))) spokes(3 + Math.floor(lv / 2) + (lv >= 5 ? 3 : 0), 12 * A, 1.5, lv >= 4 ? 130 : 95, 3.2, dmgOf(22, lv))
    if ((lv = go('abyss', 3.0))) {
      const n = 2 + (lv >= 2 ? 1 : 0) + (lv >= 5 ? 2 : 0)
      for (let i = 0; i < n; i++) ring(i, dmgOf(70, lv))
    }
    if ((lv = go('sixarms', 2.0))) {
      const k = lv >= 5 ? 12 : 6
      const l = (4.2 + (lv >= 3 ? 1.2 : 0)) * A
      for (let i = 0; i < k; i++) {
        const yaw = this.yaw + (i * 360) / k
        const a = (yaw * Math.PI) / 180
        slashAt(this.x + Math.sin(a) * (l / 2 + 0.3), this.z + Math.cos(a) * (l / 2 + 0.3), yaw, 1.3 * A, l, dmgOf(75, lv))
      }
    }
    if ((lv = go('timestop', 9.0))) {
      const dur = 2 + 0.4 * lv + (lv >= 5 ? 1 : 0)
      const R = (10 + (lv >= 3 ? 4 : 0)) * A
      for (const e of near(R)) if (e.kind !== 'boss') e.frozen = Math.max(e.frozen ?? 0, dur)
        else e.slow = Math.max(e.slow ?? 0, dur)
      this.events.push({ t: 'mChrono', dur, own: true, x: this.x, z: this.z })
    }
    if ((lv = go('wrath', 4.0))) {
      const c = crowd(16) ?? nearest(16)
      if (c) {
        const r = (4 + (lv >= 3 ? 1 : 0)) * A
        strike('sun', c.x, c.z, r, 1.0, dmgOf(220, lv), 2)
        for (let i = 0; i < 8 + (lv >= 5 ? 8 : 0); i++) {
          const a = (i / 8) * Math.PI * 2
          strike('fire', c.x + Math.sin(a) * (r + 1.5), c.z + Math.cos(a) * (r + 1.5), 1.5 * A, 1.2 + i * 0.03, dmgOf(80, lv))
        }
      }
    }
    if ((lv = go('genesis', 8.0))) {
      const R = (14 + 2 * lv) * A
      this.events.push({ t: 'nova', x: this.x, z: this.z, r: R })
      this.events.push({ t: 'genesis', x: this.x, z: this.z, r: R })
      for (const e of near(R)) this.hitEnemy(e, dmgOf(400, lv))
    }
    // ── fusion jackpots ──
    if ((lv = go('crown', 5.0))) {
      // ✦ CROWN OF CREATION ✦ — four rings of heaven-pillars open outward, a wheel of light turns, and every third cast the dawn of creation
      fz = { dmg: 3.4, area: 1.25, cd: 1, slow: 0.3 }
      A = this.area * fz.area
      tintCol = '#FFD86A'
      const rings: [number, number, number][] = [[5, 8, 0.2], [9, 12, 0.45], [13, 16, 0.7], [17, 20, 0.95]]
      const turn = rand() * 360
      rings.forEach(([R, n, delay], w) => {
        for (let i = 0; i < n; i++) {
          const a = ((turn + (w % 2 ? 180 / n : 0) + (i * 360) / n) * Math.PI) / 180
          strike('pillar', this.x + Math.sin(a) * R * A, this.z + Math.cos(a) * R * A, 1.5 * A, delay, dmgOf(110, lv))
        }
      })
      spokes(8, 17 * A, 1.3, 75, 2.2, dmgOf(45, lv), turn)
      ring(1, dmgOf(90, lv))
      this.crownCasts = (this.crownCasts + 1) % 3
      if (this.crownCasts === 0) {
        const R = 20 * A
        this.events.push({ t: 'genesis', x: this.x, z: this.z, r: R })
        for (const e of near(R)) this.hitEnemy(e, dmgOf(260, lv))
      }
    }
    if ((lv = go('flush', 2.2))) {
      // 💩 ROYAL FLUSH — lobbed poop on the crowd, then a stream of pee at the nearest foe. It stinks (slows).
      fz = { dmg: 1.3, area: 1.1, cd: 1, slow: 0.5 }
      A = this.area * fz.area
      tintCol = '#7A4A1E'
      const pool = near(13)
      for (let i = 0; i < 7 && pool.length; i++) {
        const e = pick(pool)
        strike('poop', e.x + (rand() - 0.5) * 1.2, e.z + (rand() - 0.5) * 1.2, 1.5 * A, 0.5 + rand() * 0.35, dmgOf(42, lv))
      }
      const t = nearest(14)
      if (t) {
        const dx = t.x - this.x
        const dz = t.z - this.z
        for (let i = 1; i <= 6; i++) {
          const f = i / 6
          strike('pee', this.x + dx * f, this.z + dz * f, 0.8 * A, 0.06 * i, dmgOf(14, lv))
        }
      }
    }
    flushTint()
  }
  private crownCasts = 0

  // ───────── GOD POWERS ─────────
  private densest(foes: Enemy[], max = 14) {
    // the foe with the most neighbours within 3 m (bosses count big)
    let best: Enemy | null = null
    let bs = -1
    const near = foes.filter((e) => e.alive && Math.hypot(e.x - this.x, e.z - this.z) < max)
    for (let i = 0; i < near.length; i += Math.max(1, Math.floor(near.length / 40))) {
      const e = near[i]
      let sc = e.kind === 'boss' ? 30 : 0
      for (const q of near) if (Math.abs(q.x - e.x) < 3 && Math.abs(q.z - e.z) < 3) sc++
      if (sc > bs) (bs = sc), (best = e)
    }
    return best
  }
  private fireGods(dt: number, foes: Enemy[], remotes: Remote[]) {
    if (!this.gods.size && !this.kames.length && !this.nukes.length && !this.holes.length && !this.swords.length) return
    const pv = (p: Remote) => this.pvpDamage(p, 60) // god powers are capped against players
    // CELESTIAL CANNON — giant energy wave toward the densest pack
    const kv = this.g('kame')
    if (kv && this.ready('g_kame', 7 - 0.6 * (kv - 1), dt)) {
      const tg = this.densest(foes, 20)
      if (tg) {
        const yaw = (Math.atan2(tg.x - this.x, tg.z - this.z) * 180) / Math.PI
        const len = 26 * this.area
        const w = (2.6 + 0.35 * kv) * this.area
        this.kames.push({ x: this.x, z: this.z, yaw, len, w, t: 1.4, dmg: 300 * kv, tick: 0 })
        this.events.push({ t: 'kame', x: this.x, z: this.z, yaw, len, w, dur: 1.4, max: kv >= MAX_GOD_LVL })
      } else this.cd['g_kame'] = 0.5
    }
    for (const k of this.kames) {
      k.t -= dt
      k.tick -= dt
      // the wave follows the caster
      k.x = this.x
      k.z = this.z
      if (k.tick > 0) continue
      k.tick = 0.2
      const a = (k.yaw * Math.PI) / 180
      const fx = Math.sin(a)
      const fz = Math.cos(a)
      for (const e of foes) {
        if (!e.alive) continue
        const rx = e.x - k.x
        const rz = e.z - k.z
        const along = rx * fx + rz * fz
        if (along > -0.5 && along < k.len && Math.abs(rx * fz - rz * fx) < k.w / 2 + e.r) this.hitEnemy(e, k.dmg, fx * 3, fz * 3)
      }
      for (const p of remotes) {
        const rx = p.x - k.x
        const rz = p.z - k.z
        const along = rx * fx + rz * fz
        if (along > 0 && along < k.len && Math.abs(rx * fz - rz * fx) < k.w / 2) pv(p)
      }
    }
    this.kames = this.kames.filter((k) => k.t > 0)
    // HEAVEN'S NUKE — a nuclear meteor
    const nv = this.g('nuke')
    if (nv && this.ready('g_nuke', 8 - 0.7 * (nv - 1), dt)) {
      const tg = this.densest(foes, 18)
      if (tg) {
        const r = (5 + 0.6 * nv) * this.area
        this.nukes.push({ x: tg.x, z: tg.z, t: 1.0, r, dmg: 1500 * nv })
        this.events.push({ t: 'meteorFall', x: tg.x, z: tg.z, delay: 1.0, big: nv >= MAX_GOD_LVL })
      } else this.cd['g_nuke'] = 0.5
    }
    for (const n of this.nukes) {
      n.t -= dt
      if (n.t > 0) continue
      this.events.push({ t: 'gnuke', x: n.x, z: n.z, r: n.r })
      for (const e of foes) {
        const d = Math.hypot(e.x - n.x, e.z - n.z)
        if (e.alive && d < n.r + e.r) this.hitEnemy(e, n.dmg * (1 - 0.4 * Math.min(1, d / n.r)), ((e.x - n.x) / (d || 1)) * 8, ((e.z - n.z) / (d || 1)) * 8)
      }
      for (const p of remotes) if (Math.hypot(p.x - n.x, p.z - n.z) < n.r) pv(p)
    }
    this.nukes = this.nukes.filter((n) => n.t > 0)
    // SINGULARITY — black hole: pull, crush, collapse
    const hv = this.g('hole')
    if (hv && this.ready('g_hole', 10 - 0.8 * (hv - 1), dt)) {
      const tg = this.densest(foes, 14)
      if (tg) {
        const c = clampArena(tg.x, tg.z, 1)
        this.holes.push({ x: c.x, z: c.z, t: 2.2, dur: 2.2, r: (6 + 0.5 * hv) * this.area, dmg: 150 * hv, boom: 1000 * hv, tick: 0 })
        this.events.push({ t: 'hole', x: c.x, z: c.z, r: (6 + 0.5 * hv) * this.area, dur: 2.2, max: hv >= MAX_GOD_LVL })
      } else this.cd['g_hole'] = 0.5
    }
    for (const h of this.holes) {
      h.t -= dt
      h.tick -= dt
      for (const e of foes) {
        if (!e.alive || e.kind === 'boss') continue
        const d = Math.hypot(e.x - h.x, e.z - h.z)
        if (d < h.r && d > 0.3) {
          const pull = Math.min(d, (4 + this.g('hole')) * dt)
          e.x -= ((e.x - h.x) / d) * pull
          e.z -= ((e.z - h.z) / d) * pull
        }
      }
      if (h.tick <= 0) {
        h.tick = 0.25
        for (const e of foes) if (e.alive && Math.hypot(e.x - h.x, e.z - h.z) < 3.5 + e.r) this.hitEnemy(e, h.dmg)
      }
      if (h.t <= 0) {
        this.events.push({ t: 'gnuke', x: h.x, z: h.z, r: 5 })
        for (const e of foes) if (e.alive && Math.hypot(e.x - h.x, e.z - h.z) < 5 + e.r) this.hitEnemy(e, h.boom)
        for (const p of remotes) if (Math.hypot(p.x - h.x, p.z - h.z) < 5) pv(p)
      }
    }
    this.holes = this.holes.filter((h) => h.t > 0)
    // JUDGMENT BLADES — swords of light rain around the hunter
    const sv = this.g('swords')
    if (sv && this.ready('g_swords', 3.2 - 0.25 * (sv - 1), dt)) {
      const n = 5 + Math.ceil(sv / 2) * 2 - 2
      const near = foes.filter((e) => e.alive && Math.hypot(e.x - this.x, e.z - this.z) < 11)
      for (let i = 0; i < n; i++) {
        let x: number
        let z: number
        if (near.length && i % 3 !== 2) {
          const e = near[Math.floor(rand() * near.length)]
          x = e.x
          z = e.z
        } else {
          const a = (i / n) * Math.PI * 2 + rand()
          x = this.x + Math.sin(a) * (3 + rand() * 4)
          z = this.z + Math.cos(a) * (3 + rand() * 4)
        }
        const c = clampArena(x, z, 0.6)
        const delay = 0.35 + i * 0.06
        this.swords.push({ x: c.x, z: c.z, t: delay, dmg: 600 * sv })
        this.events.push({ t: 'gsword', x: c.x, z: c.z, delay, max: sv >= MAX_GOD_LVL })
      }
    }
    for (const w of this.swords) {
      w.t -= dt
      if (w.t > 0) continue
      for (const e of foes) if (e.alive && Math.hypot(e.x - w.x, e.z - w.z) < 1.9 + e.r) this.hitEnemy(e, w.dmg)
      for (const p of remotes) if (Math.hypot(p.x - w.x, p.z - w.z) < 1.9) pv(p)
    }
    this.swords = this.swords.filter((w) => w.t > 0)
    // SERAPH WINGS — feather storm (flight itself is applied to the avatar by the game)
    const wv = this.g('wings')
    if (wv && this.ready('g_wings', 0.5 - 0.04 * (wv - 1), dt)) {
      const n = 2 + Math.ceil(wv / 2)
      const ts = foes.filter((e) => e.alive).map((e) => ({ e, d: Math.hypot(e.x - this.x, e.z - this.z) })).filter((q) => q.d < 16).sort((a, b) => a.d - b.d)
      for (let i = 0; i < n && ts.length; i++) {
        const tg = ts[i % ts.length].e
        const d = Math.hypot(tg.x - this.x, tg.z - this.z) || 1
        this.projs.push({ id: this.nextId++, x: this.x, z: this.z, vx: ((tg.x - this.x) / d) * 18, vz: ((tg.z - this.z) / d) * 18, dmg: 110 * wv, pierce: 3, life: 1.1, hit: [], k: 'feather' })
      }
    }
  }

  // ───────── sky-god boss patterns ─────────
  private skyAttack(b: Enemy, d: BossDef, kind: string) {
    if (d.pct) d = { ...d, dmg: this.pctDmg(d, 0.9) }
    if (kind === 'beam') {
      const yaw = (Math.atan2(this.x - b.x, this.z - b.z) * 180) / Math.PI
      const len = 24
      const w = 2.6
      this.bBeams.push({ x: b.x, z: b.z, yaw, len, w, t: 0.9, warm: 1.2, dmg: d.dmg * 0.45, tick: 0 })
      this.events.push({ t: 'bbeamWarn', x: b.x, z: b.z, yaw, len, w, dur: 1.2 })
    } else if (kind === 'orbs') {
      const n = 12 + Math.min(8, Math.floor((b.boss ?? 0) / 4))
      const base = rand() * Math.PI * 2
      for (let i = 0; i < n; i++) {
        const a = base + (i / n) * Math.PI * 2
        this.hostile.push({ id: this.nextId++, x: b.x, z: b.z, vx: Math.sin(a) * 6, vz: Math.cos(a) * 6, life: 4.5, dmg: d.dmg * 0.3 })
      }
      // and three aimed straight at the hunter
      const dd = Math.hypot(this.x - b.x, this.z - b.z) || 1
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(this.x - b.x, this.z - b.z) + i * 0.18
        this.hostile.push({ id: this.nextId++, x: b.x, z: b.z, vx: Math.sin(a) * 8.5, vz: Math.cos(a) * 8.5, life: (dd + 8) / 8.5, dmg: d.dmg * 0.3 })
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const a = rand() * Math.PI * 2
        const r = i === 0 ? 0 : 2 + rand() * 6
        const c = clampArena(this.x + Math.sin(a) * r, this.z + Math.cos(a) * r, 0.6)
        const delay = 1.3 + i * 0.12
        this.bMeteors.push({ x: c.x, z: c.z, t: delay, r: 2.6, dmg: d.dmg * 0.9 })
        this.events.push({ t: 'slamWarn', x: c.x, z: c.z, r: 2.6, dur: delay })
        this.events.push({ t: 'meteorFall', x: c.x, z: c.z, delay, big: false })
      }
    }
  }
  private hurtPlayer(dmg: number) {
    if (this.invuln > 0) return
    const v = dmg * Math.max(0.3, 1 - this.armor * 0.08) * (this.god ? 0.5 : 1) * (this.bossIds.length ? this.bossFury() : 1)
    this.hp -= v
    this.lastAttacker = ''
    this.events.push({ t: 'hurt', dmg: v })
    this.breakCombo(true)
    if (this.hp <= 0) this.die('')
  }
  private skyAttacks(dt: number) {
    for (const bm of this.bBeams) {
      if (bm.warm > 0) {
        bm.warm -= dt
        if (bm.warm <= 0) this.events.push({ t: 'bbeam', x: bm.x, z: bm.z, yaw: bm.yaw, len: bm.len, w: bm.w, dur: bm.t })
        continue
      }
      bm.t -= dt
      bm.tick -= dt
      if (bm.tick > 0) continue
      bm.tick = 0.3
      const a = (bm.yaw * Math.PI) / 180
      const rx = this.x - bm.x
      const rz = this.z - bm.z
      const along = rx * Math.sin(a) + rz * Math.cos(a)
      if (along > 0 && along < bm.len && Math.abs(rx * Math.cos(a) - rz * Math.sin(a)) < bm.w / 2 + 0.3) this.hurtPlayer(bm.dmg)
    }
    this.bBeams = this.bBeams.filter((bm) => bm.warm > 0 || bm.t > 0)
    for (const m of this.bMeteors) {
      m.t -= dt
      if (m.t > 0) continue
      this.events.push({ t: 'slam', x: m.x, z: m.z, r: m.r })
      if (Math.hypot(this.x - m.x, this.z - m.z) < m.r) this.hurtPlayer(m.dmg)
    }
    this.bMeteors = this.bMeteors.filter((m) => m.t > 0)
    for (const h of this.hostile) {
      h.life -= dt
      if (h.home) {
        // turn toward the hunter, a little at a time (you can outrun them)
        const want = Math.atan2(this.x - h.x, this.z - h.z)
        const cur = Math.atan2(h.vx, h.vz)
        let dA = want - cur
        while (dA > Math.PI) dA -= Math.PI * 2
        while (dA < -Math.PI) dA += Math.PI * 2
        const turn = Math.max(-h.home * dt, Math.min(h.home * dt, dA))
        const sp = Math.hypot(h.vx, h.vz)
        h.vx = Math.sin(cur + turn) * sp
        h.vz = Math.cos(cur + turn) * sp
      }
      h.x += h.vx * dt
      h.z += h.vz * dt
      if (Math.hypot(this.x - h.x, this.z - h.z) < 0.75) {
        h.life = 0
        this.hurtPlayer(h.dmg)
      }
    }
    this.hostile = this.hostile.filter((h) => h.life > 0 && inArena(h.x, h.z, -2))
  }

  // ───────── potions ─────────
  drink(k: 'hp' | 'rage') {
    if (!this.alive || this.potions[k] <= 0) return false
    if (k === 'hp') {
      if (this.potCd > 0 || this.hp >= this.maxHp) return false
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.45)
      this.potCd = 2.5
    } else {
      if (this.rageT > 3) return false
      this.rageT = 12
    }
    this.potions[k]--
    this.events.push({ t: 'potion', kind: k })
    return true
  }

  /** timeout ends the streak; getting hit (soft) halves it */
  breakCombo(soft = false) {
    const before = this.combo
    this.combo = soft ? Math.floor(this.combo / 2) : 0
    if (!this.combo) this.comboT = 0
    this.comboTier = COMBO_TIERS.filter(([n]) => this.combo >= n).length
    if (before >= 25 && (!soft || before - this.combo >= 25)) this.events.push({ t: 'comboBreak', n: before })
  }

  // ───────── random arena events (every ~3 min) ─────────
  private arenaStep(dt: number) {
    const a = this.arena
    if (!a) {
      if (this.time < this.nextArena || this.bossIds.length) return
      const kinds: ArenaKind[] = ['bloodmoon', 'goldrush', 'elitehunt']
      const kind = kinds[Math.floor(rand() * kinds.length)]
      const dur = ARENA_EVENTS[kind].dur
      this.arena = { kind, t: dur, dur }
      this.events.push({ t: 'arena', kind, on: true, dur })
      if (kind === 'elitehunt')
        for (let i = 0; i < 3; i++) {
          const ang = rand() * Math.PI * 2
          const c = clampArena(this.x + Math.sin(ang) * 10, this.z + Math.cos(ang) * 10, 1)
          const e = this.spawnEnemy('elite', c.x, c.z)
          e.hp = e.maxHp = e.maxHp * 1.6
          e.sc = 1.25
          this.bounties.push(e.id)
        }
      return
    }
    a.t -= dt
    if (a.kind === 'goldrush') {
      this.rushAcc += dt
      while (this.rushAcc >= 0.35) {
        this.rushAcc -= 0.35
        const ang = rand() * Math.PI * 2
        const r = 2 + rand() * 6
        const c = clampArena(this.x + Math.sin(ang) * r, this.z + Math.cos(ang) * r, 0.8)
        this.drop('coin', c.x, c.z, 1)
      }
    }
    if (a.kind === 'elitehunt') this.bounties = this.bounties.filter((id) => this.enemies.some((e) => e.id === id && e.alive))
    if (a.t <= 0 || (a.kind === 'elitehunt' && !this.bounties.length)) {
      this.events.push({ t: 'arena', kind: a.kind, on: false, dur: 0 })
      this.arena = null
      this.bounties = []
      this.nextArena = this.time + 150 + rand() * 60
    }
  }

  // ───────── boss ladder ─────────
  bossesAlive(): Enemy[] {
    const out: Enemy[] = []
    for (const id of this.bossIds) {
      const e = this.enemies.find((q) => q.id === id && q.alive)
      if (e) out.push(e)
    }
    return out
  }
  get boss(): Enemy | undefined {
    return this.bossesAlive()[0]
  }
  bossDef(): BossDef | undefined {
    const b = this.boss
    return b ? bossFor(b.boss!) : undefined
  }

  private spawnBoss() {
    // twins: spawn the pair together, on opposite sides of the hunter
    const group = [this.bossIndex]
    while (bossFor(group[group.length - 1]).twin && this.bossQueue > group.length) group.push(group[group.length - 1] + 1)
    group.forEach((idx, i) => {
      this.bossIndex++
      this.bossQueue--
      const d = bossFor(idx)
      let x: number | undefined
      let z: number | undefined
      if (group.length > 1) {
        const a = rand() * Math.PI * 2 + i * Math.PI
        const c = clampArena(this.x + Math.sin(a) * 11, this.z + Math.cos(a) * 11, 1)
        x = c.x
        z = c.z
      }
      const e = this.spawnEnemy('boss', x, z)
      e.boss = idx
      // size the boss to the hunter: never melted in a few seconds, never a slog for a newcomer
      const share = group.length > 1 ? 0.6 : 1
      const maxSec = idx < 8 ? 38 * share : Infinity
      const dps = Math.max(1, this.dps)
      e.hp = e.maxHp = Math.round(Math.min(d.hp, Math.max(d.hp * 0.35, dps * maxSec)))
      e.b0 = this.time
      e.bTaken = 0
      // mythic bosses hit for a share of your max HP, so they stay deadly however strong you are
      e.dmg = d.pct ? Math.max(d.dmg, this.maxHp * d.pct * 0.5) : d.dmg * (idx < 5 ? 0.6 : idx < 8 ? 0.8 : 1) // the first bosses go easier on newcomers
      e.speed = d.speed
      e.r = d.r
      e.sc = d.scale
      e.xp = 0
      e.slamCd = 3 + i * 1.5
      this.bossIds.push(e.id)
      this.events.push({ t: 'bossSpawn', boss: idx })
    })
  }

  /** 3 s into a boss fight, measure how fast the hunter hurts it and stretch its HP so the fight lasts */
  private sizeBosses() {
    for (const e of this.enemies) {
      if (!e.alive || e.kind !== 'boss' || e.sized || e.b0 === undefined || this.time - e.b0 < 3) continue
      e.sized = true
      const d = bossFor(e.boss ?? 0)
      const twins = this.bossesAlive().length > 1 ? 0.6 : 1
      const minSec = (d.god ? 150 : d.divine ? 70 : d.name === 'NIGHTSWARM' || d.name === 'AETHERION' ? 50 : 28) * twins
      const rate = (e.bTaken ?? 0) / (this.time - e.b0)
      const need = rate * (minSec - 3)
      if (need > e.hp) {
        const f = Math.min(d.divine ? 2 : 1e6, need / e.hp)
        e.hp *= f
        e.maxHp *= f
      }
    }
  }

  private bossStep(dt: number) {
    this.sizeBosses()
    const alive = this.bossesAlive()
    if (alive.length !== this.bossIds.length) this.bossIds = alive.map((e) => e.id)
    for (const b of alive) this.bossAct(b, dt)
    this.skyAttacks(dt)
    this.mythicStep(dt)
  }

  // ───────── mythic patterns (Lv 350+): every hit is a share of YOUR max HP ─────────
  /** later bosses hit a little harder on top of their own share */
  private esc(d: BossDef) {
    return 1 + Math.max(0, d.lvl - 350) / 4000
  }
  private pctDmg(d: BossDef, mult: number) {
    // divine form halves damage taken; against the mythic ladder it only shaves a quarter
    return this.maxHp * (d.pct ?? 0.25) * mult * this.esc(d) * (this.god ? 1.5 : 1)
  }
  private mythicMove(b: Enemy, d: BossDef, mv: string) {
    const tier = Math.max(0, d.lvl - 350) // 0 … 761
    const toYou = Math.atan2(this.x - b.x, this.z - b.z)
    switch (mv) {
      case 'rings': {
        const n = 3 + Math.floor(tier / 250)
        for (let i = 0; i < n; i++) {
          const r0 = 2.2 + i * 4, r1 = r0 + 2
          const t = 1.2 + i * 0.35
          this.mRings.push({ x: b.x, z: b.z, r0, r1, t, dmg: this.pctDmg(d, 0.9) })
          this.events.push({ t: 'mRingWarn', x: b.x, z: b.z, r0, r1, dur: t })
        }
        return
      }
      case 'rain': {
        const n = 10 + Math.floor(tier / 40)
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2
          const rr = i === 0 ? 0 : 1.5 + rand() * 8
          const c = clampArena(this.x + Math.sin(a) * rr, this.z + Math.cos(a) * rr, 0.6)
          const delay = 1.0 + i * 0.07
          this.bMeteors.push({ x: c.x, z: c.z, t: delay, r: 1.8, dmg: this.pctDmg(d, 0.55) })
          this.events.push({ t: 'mStrike', x: c.x, z: c.z, r: 1.8, delay, k: d.rain ?? 'star' })
        }
        return
      }
      case 'pillars': {
        // checkerboard of light around you: half erupts, then the other half
        const cell = 3.6
        for (let i = -2; i <= 2; i++)
          for (let j = -2; j <= 2; j++) {
            const c = clampArena(this.x + i * cell, this.z + j * cell, 0.6)
            const delay = (i + j) % 2 === 0 ? 1.3 : 2.3
            this.bMeteors.push({ x: c.x, z: c.z, t: delay, r: 1.95, dmg: this.pctDmg(d, 0.8) })
            this.events.push({ t: 'mStrike', x: c.x, z: c.z, r: 1.95, delay, k: 'pillar' })
          }
        return
      }
      case 'spokes': {
        const n = 4 + Math.floor(tier / 150)
        const omega = (rand() < 0.5 ? -1 : 1) * (38 + tier / 18)
        const a0 = (toYou * 180) / Math.PI + 180 / n
        this.mSpokes.push({ x: b.x, z: b.z, n, len: 22, w: 1.6, a0, omega, warm: 1.0, t: 4.5, dmg: this.pctDmg(d, 0.18), tick: 0, age: 0 })
        this.events.push({ t: 'mSpokes', x: b.x, z: b.z, n, len: 22, w: 1.6, a0, omega, warm: 1.0, dur: 4.5 })
        return
      }
      case 'shades': {
        const n = 3 + Math.floor(tier / 200)
        const k = d.name === 'YORUMI' ? 'fox' : 'shade'
        for (let i = 0; i < n; i++) {
          const a = toYou + ((i - (n - 1) / 2) / n) * Math.PI * 1.4
          this.hostile.push({ id: this.nextId++, x: b.x, z: b.z, vx: Math.sin(a) * 5, vz: Math.cos(a) * 5, life: 4.5, dmg: this.pctDmg(d, 0.3), home: 1.7, k })
        }
        return
      }
      case 'sun': {
        const r = 4.5 + tier / 260
        const suns = 1 + (tier >= 450 ? 1 : 0)
        for (let i = 0; i < suns; i++) {
          const delay = 2.2 + i * 1.2
          const c = clampArena(this.x + (i ? (rand() - 0.5) * 6 : 0), this.z + (i ? (rand() - 0.5) * 6 : 0), 0.6)
          this.bMeteors.push({ x: c.x, z: c.z, t: delay, r, dmg: this.pctDmg(d, 1.1) })
          this.events.push({ t: 'mStrike', x: c.x, z: c.z, r, delay, k: 'sun' })
        }
        return
      }
      case 'blink': {
        // vanish and strike from your side
        const a = rand() * Math.PI * 2
        const c = clampArena(this.x + Math.sin(a) * 2.6, this.z + Math.cos(a) * 2.6, 1)
        this.events.push({ t: 'mBlink', x0: b.x, z0: b.z, x1: c.x, z1: c.z })
        b.x = c.x
        b.z = c.z
        b.wind = 0.55
        b.windR = Math.max(3.5, d.slam * 0.55)
        this.events.push({ t: 'slamWarn', x: b.x, z: b.z, r: b.windR, dur: 0.55 })
        return
      }
      case 'cross': {
        const a = rand() * Math.PI
        for (const yawR of [a, a + Math.PI / 2]) {
          const yaw = (yawR * 180) / Math.PI
          const sx = this.x - Math.sin(yawR) * 30, sz = this.z - Math.cos(yawR) * 30
          this.bBeams.push({ x: sx, z: sz, yaw, len: 60, w: 2.4, t: 0.6, warm: 1.0, dmg: this.pctDmg(d, 0.35), tick: 0 })
          this.events.push({ t: 'bbeamWarn', x: sx, z: sz, yaw, len: 60, w: 2.4, dur: 1.0 })
        }
        return
      }
      case 'wave': {
        const yaw = (toYou * 180) / Math.PI
        this.bBeams.push({ x: b.x, z: b.z, yaw, len: 30, w: 5.5, t: 0.9, warm: 1.3, dmg: this.pctDmg(d, 0.3), tick: 0 })
        this.events.push({ t: 'bbeamWarn', x: b.x, z: b.z, yaw, len: 30, w: 5.5, dur: 1.3 })
        return
      }
      case 'light': {
        // LET THERE BE LIGHT: stand in a safe circle or be burned away
        const safe: [number, number, number][] = []
        const a = rand() * Math.PI * 2
        safe.push((() => { const c = clampArena(this.x + Math.sin(a) * 6, this.z + Math.cos(a) * 6, 3); return [c.x, c.z, 3.2] as [number, number, number] })())
        for (let i = 0; i < 2; i++) {
          const c = clampArena(32 + (rand() - 0.5) * 24, 24 + (rand() - 0.5) * 36, 3)
          safe.push([c.x, c.z, 3.2])
        }
        this.mLight = { safe, t: 3.6, dmg: this.maxHp * 0.92 }
        this.events.push({ t: 'mLight', safe, dur: 3.6 })
        return
      }
      case 'chrono': {
        this.slowT = 3.5
        this.events.push({ t: 'mChrono', dur: 3.5 })
        this.mythicMove(b, d, 'rings')
        return
      }
      default:
        this.skyAttack(b, d, mv)
    }
  }
  private mythicStep(dt: number) {
    if (this.slowT > 0) this.slowT -= dt
    for (const g of this.mRings) {
      g.t -= dt
      if (g.t > 0) continue
      this.events.push({ t: 'mRing', x: g.x, z: g.z, r0: g.r0, r1: g.r1 })
      const dd = Math.hypot(this.x - g.x, this.z - g.z)
      if (dd >= g.r0 - 0.4 && dd <= g.r1 + 0.4) this.hurtPlayer(g.dmg)
    }
    this.mRings = this.mRings.filter((g) => g.t > 0)
    for (const sp of this.mSpokes) {
      if (sp.warm > 0) {
        sp.warm -= dt
        continue
      }
      sp.t -= dt
      sp.age += dt
      sp.tick -= dt
      if (sp.tick > 0) continue
      sp.tick = 0.3
      const rx = this.x - sp.x, rz = this.z - sp.z
      for (let i = 0; i < sp.n; i++) {
        const a = ((sp.a0 + sp.omega * sp.age) * Math.PI) / 180 + (i / sp.n) * Math.PI * 2
        const along = rx * Math.sin(a) + rz * Math.cos(a)
        if (along > 0 && along < sp.len && Math.abs(rx * Math.cos(a) - rz * Math.sin(a)) < sp.w / 2 + 0.3) {
          this.hurtPlayer(sp.dmg)
          break
        }
      }
    }
    this.mSpokes = this.mSpokes.filter((sp) => sp.warm > 0 || sp.t > 0)
    const L = this.mLight
    if (L) {
      L.t -= dt
      if (L.t <= 0) {
        const ok = L.safe.some(([x, z, r]) => Math.hypot(this.x - x, this.z - z) < r)
        this.events.push({ t: 'mLightHit', ok })
        if (!ok && this.invuln <= 0 && this.alive) {
          this.hp -= L.dmg
          this.events.push({ t: 'hurt', dmg: L.dmg })
          if (this.hp <= 0) this.die('')
        }
        this.mLight = null
      }
    }
  }

  private bossAct(b: Enemy, dt: number) {
    const d = bossFor(b.boss!)
    if (b.wind !== undefined) {
      b.wind -= dt
      if (b.wind <= 0) {
        b.wind = undefined
        const r = b.windR ?? d.slam
        b.windR = undefined
        this.events.push({ t: 'slam', x: b.x, z: b.z, r })
        if (Math.hypot(this.x - b.x, this.z - b.z) < r && this.invuln <= 0) {
          const dmg = (d.pct ? this.maxHp * d.pct * 1.3 * this.esc(d) : d.dmg * 1.6) * Math.max(0.3, 1 - this.armor * 0.08) * (this.god ? (d.pct ? 0.75 : 0.5) : 1) * this.bossFury()
          this.hp -= dmg
          this.lastAttacker = ''
          this.events.push({ t: 'hurt', dmg })
          this.breakCombo(true)
          if (this.hp <= 0) this.die('')
        }
        const adds = this.bossIds.length > 1 ? 3 : 4 + Math.min(6, b.boss!)
        for (let i = 0; i < adds; i++) {
          const a = (i / 6) * Math.PI * 2
          const c = clampArena(b.x + Math.sin(a) * (r + 1), b.z + Math.cos(a) * (r + 1), 0.8)
          this.spawnEnemy(d.adds, c.x, c.z)
        }
      }
      return
    }
    // chargers lunge across the arena (a red line warns first)
    if (d.charge) {
      b.chargeCd = (b.chargeCd ?? 5) - dt
      if (b.charging !== undefined) {
        b.charging -= dt
        const step = d.speed * 4.2 * dt
        b.x += (b.cvx ?? 0) * step
        b.z += (b.cvz ?? 0) * step
        const c = clampArena(b.x, b.z, 0.5)
        b.x = c.x
        b.z = c.z
        if (b.charging <= 0) b.charging = undefined
        return
      }
      const dist = Math.hypot(this.x - b.x, this.z - b.z)
      if (b.chargeCd <= 0 && dist > 4 && dist < 16) {
        b.chargeCd = 6.5
        b.cvx = (this.x - b.x) / dist
        b.cvz = (this.z - b.z) / dist
        b.charging = Math.min(1.1, (dist + 3) / (d.speed * 4.2))
        this.events.push({ t: 'charge', x: b.x, z: b.z, yaw: (Math.atan2(b.cvx, b.cvz) * 180) / Math.PI, len: d.speed * 4.2 * b.charging })
        return
      }
    }
    if (d.moves?.length) {
      // enrage steps at 66% / 33% HP
      if (d.phases) {
        const f = b.hp / b.maxHp
        const ph = Math.min(d.phases, f < 0.33 ? 2 : f < 0.66 ? 1 : 0)
        if (ph > (b.phase ?? 0)) {
          b.phase = ph
          this.events.push({ t: 'mPhase', boss: b.boss ?? 0, phase: ph })
        }
      }
      b.atkCd = (b.atkCd ?? 2.4) - dt
      if (b.atkCd <= 0) {
        const ph = b.phase ?? 0
        b.atkCd = ((d.cd ?? 3) * Math.pow(0.85, ph)) / this.bossFury()
        const n = (d.combo ?? 1) + (ph >= 2 ? 1 : 0)
        for (let k = 0; k < n; k++) {
          const mv = d.moves[(b.atkI ?? 0) % d.moves.length]
          b.atkI = (b.atkI ?? 0) + 1
          this.mythicMove(b, d, mv)
        }
      }
    } else if (d.attacks?.length) {
      b.atkCd = (b.atkCd ?? 3) - dt
      if (b.atkCd <= 0) {
        b.atkCd = (3.4 - Math.min(1.2, (b.boss ?? 0) * 0.02)) / this.bossFury()
        b.atkI = (b.atkI ?? 0) + 1
        this.skyAttack(b, d, d.attacks[b.atkI % d.attacks.length])
      }
    }
    b.slamCd = (b.slamCd ?? 4) - dt
    if (b.slamCd <= 0 && Math.hypot(this.x - b.x, this.z - b.z) < d.slam * 1.6) {
      b.slamCd = b.boss! >= 3 ? 4.2 : 5.5
      b.wind = 1.1
      this.events.push({ t: 'slamWarn', x: b.x, z: b.z, r: d.slam, dur: 1.1 })
    }
  }

  // ───────── armory: manual attacks ─────────
  private manualStep(dt: number) {
    if (this.manualCd > 0) this.manualCd -= dt
    if (this.nukeCd > 0) this.nukeCd -= dt
    const pn = this.pendingNuke
    if (pn) {
      pn.t -= dt
      if (pn.t <= 0) {
        this.pendingNuke = null
        const R = NUKE.radius * this.area
        this.events.push({ t: 'nuke', x: pn.x, z: pn.z, r: R })
        const dmg = NUKE.dmg * manualLevelScale(this.level)
        for (const e of this.enemies) {
          if (!e.alive) continue
          const dd = Math.hypot(e.x - pn.x, e.z - pn.z)
          if (dd > R + e.r) continue
          const hit = e.kind === 'boss' ? Math.min(dmg, e.maxHp * NUKE.bossCap) / this.might : dmg
          const ux = (e.x - pn.x) / (dd || 1)
          const uz = (e.z - pn.z) / (dd || 1)
          this.hitEnemy(e, hit, ux * 12, uz * 12)
        }
      }
    }
  }

  /** Divine Ascension in hand: every hit on a monster is lethal */
  get god() {
    return this.equip === GOD_TIER && this.alive
  }

  get canNuke() {
    return this.armory >= NUKE_TIER && this.nukeCd <= 0 && !this.pendingNuke
  }

  /** F key: drop the Doomsday Nuke ahead of the player */
  nuke(yaw: number) {
    if (!this.alive || !this.canNuke) return false
    this.nukeCd = NUKE.cd
    const a = (yaw * Math.PI) / 180
    const c = clampArena(this.x + Math.sin(a) * NUKE.ahead, this.z + Math.cos(a) * NUKE.ahead, 1)
    this.pendingNuke = { x: c.x, z: c.z, t: NUKE.delay }
    this.events.push({ t: 'nukeLaunch', x: this.x, z: this.z, tx: c.x, tz: c.z, delay: NUKE.delay })
    return true
  }

  /** left click (held): attack with the equipped armory weapon toward yaw (degrees, 0 = +z) */
  manualAttack(yaw: number, remotes: Remote[] = []) {
    if (!this.alive || this.manualCd > 0) return false
    const w = ARMORY[this.equip]
    this.manualCd = w.cd * (0.5 + 0.5 * this.cdMul)
    const a = (yaw * Math.PI) / 180
    const fx = Math.sin(a)
    const fz = Math.cos(a)
    const dmg = w.dmg * manualLevelScale(this.level)
    if (w.god) {
      // divine nova: everything around you dies
      const R = w.range * this.area
      for (const e of this.enemies) {
        if (!e.alive) continue
        const dx = e.x - this.x
        const dz = e.z - this.z
        const d = Math.hypot(dx, dz)
        if (d > R + e.r) continue
        this.hitEnemy(e, e.kind === 'boss' && bossFor(e.boss ?? 0).divine ? dmg : 1, (dx / (d || 1)) * w.knock, (dz / (d || 1)) * w.knock)
      }
      for (const r of remotes) if (Math.hypot(r.x - this.x, r.z - this.z) < R) this.pvpDamage(r, 400)
      this.events.push({ t: 'divine', x: this.x, z: this.z, r: R })
      return true
    }
    if (w.chain) {
      // Zeus: strike the foe nearest the aim line, then leap to the closest unhit foes
      let cur: Enemy | undefined
      let best = Infinity
      for (const e of this.enemies) {
        if (!e.alive) continue
        const dx = e.x - this.x
        const dz = e.z - this.z
        const t = dx * fx + dz * fz
        if (t < 0 || t > w.range) continue
        const score = Math.hypot(dx, dz) + Math.abs(dx * fz - dz * fx) * 2
        if (score < best) (best = score), (cur = e)
      }
      const pts: [number, number][] = [[this.x, this.z]]
      const hit = new Set<number>()
      for (let k = 0; cur && k <= w.chain; k++) {
        hit.add(cur.id)
        pts.push([cur.x, cur.z])
        const from = cur
        this.hitEnemy(from, dmg * (1 - k * 0.06), 0, 0)
        cur = undefined
        let bd = 9
        for (const e of this.enemies) {
          if (!e.alive || hit.has(e.id)) continue
          const d = Math.hypot(e.x - from.x, e.z - from.z)
          if (d < bd) (bd = d), (cur = e)
        }
      }
      for (const r of remotes) if (Math.hypot(r.x - this.x, r.z - this.z) < 8) this.pvpDamage(r, dmg * 0.4)
      if (pts.length > 1) this.events.push({ t: 'zeus', pts })
      return true
    }
    if (w.gun) {
      const spread = ((rand() - 0.5) * 7 * Math.PI) / 180
      const gx = Math.sin(a + spread)
      const gz = Math.cos(a + spread)
      let len = w.range
      let pierce = 2
      const hits = this.enemies
        .filter((e) => e.alive)
        .map((e) => {
          const t = (e.x - this.x) * gx + (e.z - this.z) * gz
          const perp = Math.abs((e.x - this.x) * gz - (e.z - this.z) * gx)
          return { e, t, perp }
        })
        .filter((h) => h.t > 0 && h.t < w.range && h.perp < h.e.r + 0.35)
        .sort((p, q) => p.t - q.t)
      for (const h of hits) {
        if (pierce-- <= 0) break
        this.hitEnemy(h.e, dmg, gx * w.knock, gz * w.knock)
        len = h.t
      }
      for (const r of remotes) {
        const t = (r.x - this.x) * gx + (r.z - this.z) * gz
        const perp = Math.abs((r.x - this.x) * gz - (r.z - this.z) * gx)
        if (t > 0 && t < w.range && perp < 0.6) this.pvpDamage(r, dmg)
      }
      this.events.push({ t: 'tracer', x: this.x, z: this.z, yaw: yaw + (spread * 180) / Math.PI, len: Math.max(2, len) })
      return true
    }
    const range = w.range * this.area
    const half = w.arc / 2
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x
      const dz = e.z - this.z
      const d = Math.hypot(dx, dz)
      if (d > range + e.r) continue
      const ang = Math.abs(((((Math.atan2(dx, dz) * 180) / Math.PI - yaw) % 360) + 540) % 360 - 180)
      if (d > 1.0 && ang > half) continue
      this.hitEnemy(e, dmg, (dx / (d || 1)) * w.knock, (dz / (d || 1)) * w.knock)
      if (w.leech) this.hp = Math.min(this.maxHp, this.hp + w.leech)
    }
    for (const r of remotes) {
      const dx = r.x - this.x
      const dz = r.z - this.z
      const d = Math.hypot(dx, dz)
      const ang = Math.abs(((((Math.atan2(dx, dz) * 180) / Math.PI - yaw) % 360) + 540) % 360 - 180)
      if (d < range && ang <= half) this.pvpDamage(r, dmg)
    }
    this.events.push({ t: 'swing', x: this.x + fx * range * 0.5, z: this.z + fz * range * 0.5, yaw, range, arc: w.arc, tier: this.equip })
    if (w.quake) {
      const qx = this.x + fx * range * 0.8
      const qz = this.z + fz * range * 0.8
      const qr = w.quake * this.area
      for (const e of this.enemies) if (e.alive && Math.hypot(e.x - qx, e.z - qz) < qr + e.r) this.hitEnemy(e, dmg * 0.5, 0, 0)
      this.events.push({ t: 'quake', x: qx, z: qz, r: qr })
    }
    return true
  }

  /** open a treasure chest: evolution if possible, else 1/3/5 random upgrades (slot-machine) */
  openChest(big: boolean): { rolls: Option[]; gold: number; prize?: VaultPrize } {
    const rolls: Option[] = []
    const evo = this.canEvolve()
    if (evo.length) rolls.push({ kind: 'evolve', id: evo[0] })
    const luck = 0.05 * this.p('fortune')
    const r = rand()
    let count = big ? (r < 0.5 + luck ? 5 : 3) : r < 0.06 + luck ? 5 : r < 0.3 + luck ? 3 : 1
    // boss vaults also spin the prize roulette
    let prize: VaultPrize | undefined
    if (big) {
      const ids = Object.keys(VAULT_PRIZES) as VaultPrize[]
      const total = ids.reduce((s, k) => s + VAULT_PRIZES[k].w, 0)
      let x = rand() * total
      prize = ids[ids.length - 1]
      for (const k of ids) {
        if (x < VAULT_PRIZES[k].w) {
          prize = k
          break
        }
        x -= VAULT_PRIZES[k].w
      }
      if (prize === 'double') count += 2
    }
    while (rolls.length < count) {
      const owned = this.allUpgrades().filter((o) => (o.kind === 'weapon' ? this.w(o.id) : o.kind === 'passive' ? this.p(o.id) : 0) > 0)
      const pool = owned.length ? owned : this.allUpgrades()
      if (!pool.length) {
        const o: Option = this.boostChoices(1)[0] ?? { kind: 'boost', id: 'dmg' }
        this.apply(o)
        rolls.push(o)
        continue
      }
      const o = pool[Math.floor(rand() * pool.length)]
      this.apply(o)
      rolls.push(o)
    }
    if (rolls[0]?.kind === 'evolve') this.apply(rolls[0])
    let gold = Math.round((big ? 120 : 40) * count * this.goldMul * 0.4)
    if (prize === 'jackpot') gold += Math.round((300 + this.time * 0.6) * (1 + 0.2 * this.p('fortune')))
    if (prize === 'relic') this.boostDmg += 0.15
    if (prize === 'heal') {
      this.maxHp += 30
      this.hp = this.maxHp
    }
    if (prize === 'magnet') for (const p of this.pickups) if (p.alive && p.kind === 'gem') p.flying = true
    this.gold += gold
    return { rolls, gold, prize }
  }
}

// ───────── helpers ─────────
function pick<T>(list: [T, number][]): T {
  const total = list.reduce((s, x) => s + x[1], 0)
  let r = rand() * total
  for (const [v, w] of list) {
    if (r < w) return v
    r -= w
  }
  return list[list.length - 1][0]
}

/** THE BLOOD RING: the only place hunters can hurt each other (parcels -106..-105, 79..80); monsters spawn everywhere */
export const PVP_ZONE = { x0: 0.6, x1: 31.4, z0: 48.4, z1: 78.3 }
export function inPvpZone(x: number, z: number) {
  return x >= PVP_ZONE.x0 && x <= PVP_ZONE.x1 && z >= PVP_ZONE.z0 && z <= PVP_ZONE.z1
}

export function inArena(x: number, z: number, m = 0) {
  return ARENA.some((r) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m)
}

export function clampArena(x: number, z: number, m = 0) {
  if (inArena(x, z, m)) return { x, z }
  let best = { x, z, d: Infinity }
  for (const r of ARENA) {
    const cx = Math.min(Math.max(x, r.x0 + m), r.x1 - m)
    const cz = Math.min(Math.max(z, r.z0 + m), r.z1 - m)
    const d = Math.hypot(cx - x, cz - z)
    if (d < best.d) best = { x: cx, z: cz, d }
  }
  return { x: best.x, z: best.z }
}

export function optionLabel(o: Option): { title: string; sub: string; desc: string; color: string; isNew: boolean } {
  if (o.kind === 'weapon') {
    const w = WEAPONS[o.id]
    return { title: w.name, sub: o.to === 1 ? 'NEW WEAPON' : `LV ${o.to - 1} → ${o.to}`, desc: w.desc[o.to - 1], color: w.color, isNew: o.to === 1 }
  }
  if (o.kind === 'passive') {
    const p = PASSIVES[o.id]
    return { title: p.name, sub: o.to === 1 ? 'NEW PASSIVE' : `LV ${o.to - 1} → ${o.to}`, desc: p.desc, color: p.color, isNew: o.to === 1 }
  }
  if (o.kind === 'god') {
    const g = GODS[o.id]
    return { title: '✦ ' + g.name, sub: o.to === 1 ? 'GOD POWER' : `GOD LV ${o.to - 1} → ${o.to}`, desc: g.desc[o.to - 1], color: g.color, isNew: o.to === 1 }
  }
  if (o.kind === 'evolve') {
    const w = WEAPONS[o.id]
    return { title: w.evo, sub: 'ASCENSION!', desc: `${w.name} ascends`, color: '#FFD86A', isNew: true }
  }
  if (o.kind === 'gold') return { title: `+${o.amount} Gold`, sub: 'VAULT', desc: 'Spend it at the Arcane Forge', color: '#FFD86A', isNew: false }
  if (o.kind === 'boost') {
    const b = BOOSTS[o.id]
    const m = o.m ?? 1
    const rar = RARITY.find((r) => r.m === m) ?? RARITY[0]
    const amt = Math.round(b.per * m * 10) / 10
    return { title: b.name, sub: `${rar.name} BOON${m > 1 ? ' ×' + m : ''}`, desc: b.desc.replace('{n}', String(amt)), color: m >= 3 ? rar.color : b.color, isNew: m >= 3 }
  }
  if (o.kind === 'art') {
    const a = ARTS[o.id]
    const tag = a.boss ? 'MYTHIC ART' : 'NEW ART'
    return { title: (a.boss ? '✧ ' : '') + a.name, sub: o.to === 1 ? `${tag} UNLOCKED` : `ART LV ${o.to - 1} → ${o.to}`, desc: a.desc[o.to - 1], color: a.color, isNew: o.to === 1 }
  }
  return { title: `+${o.amount} HP`, sub: 'HEAL', desc: 'Restore health', color: '#3DFF8E', isNew: false }
}

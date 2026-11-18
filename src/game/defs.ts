// Pure data: weapons, passives, enemies, evolutions. No Decentraland imports (used by the headless sim too).

export type WeaponId = 'lash' | 'bolt' | 'orbit' | 'aura' | 'thunder' | 'nova'
export type PassiveId = 'might' | 'haste' | 'expanse' | 'duplicator' | 'plating' | 'vitality' | 'bloodstone' | 'magnet' | 'swiftness' | 'fortune'
export type EnemyKind = 'bat' | 'ghoul' | 'skeleton' | 'wraith' | 'elite' | 'boss'

export const MAX_WEAPON_LVL = 8
export const MAX_PASSIVE_LVL = 5
export const MAX_WEAPONS = 6
export const MAX_PASSIVES = 6

export const WEAPONS: Record<WeaponId, { name: string; evo: string; evoWith: PassiveId; color: string; desc: string[] }> = {
  lash: {
    name: 'Rift Scythe',
    evo: 'Eclipse Scythe',
    evoWith: 'might',
    color: '#FF3B4E',
    desc: ['Rends the rift in front of you', 'Also rends behind', '+6 damage', '+20% width', '+6 damage', '+6 damage', '+20% width', '+10 damage']
  },
  bolt: {
    name: 'Star Shard',
    evo: 'Starfall Volley',
    evoWith: 'duplicator',
    color: '#A26BFF',
    desc: ['Shoots star shards at the nearest foe', '+1 shard', '+4 damage', '+1 shard', '+4 damage', 'Shards pierce', '+1 shard', '+8 damage']
  },
  orbit: {
    name: 'Halo Glaives',
    evo: 'Glaive Tempest',
    evoWith: 'haste',
    color: '#5EF2FF',
    desc: ['A glaive orbits you', '+1 glaive', '+4 damage', '+1 glaive', '+25% speed', '+1 glaive', '+4 damage', '+1 glaive']
  },
  aura: {
    name: 'Void Bloom',
    evo: 'Abyssal Maw',
    evoWith: 'vitality',
    color: '#FF4FD2',
    desc: ['A void field burns nearby foes', '+radius', '+2.5 damage', '+radius', '+2.5 damage', '+radius', '+2.5 damage', '+radius']
  },
  thunder: {
    name: 'Storm Sigil',
    evo: 'Skybreaker',
    evoWith: 'expanse',
    color: '#9FE8FF',
    desc: ['Sigils call lightning on foes', '+1 strike', '+10 damage', '+1 strike', '+10 damage', '+1 strike', '+10 damage', '+1 strike']
  },
  nova: {
    name: 'Ember Pulse',
    evo: 'Sunforge Burst',
    evoWith: 'plating',
    color: '#FF8A1E',
    desc: ['Pulses fire around you', '+radius', '+9 damage', '-10% cooldown', '+9 damage', '+radius', '+9 damage', '+radius']
  }
}

export const PASSIVES: Record<PassiveId, { name: string; desc: string; color: string }> = {
  might: { name: 'Fury Core', desc: '+12% damage', color: '#FF5468' },
  haste: { name: 'Chrono Gear', desc: '-7% cooldowns', color: '#5EF2FF' },
  expanse: { name: 'Prism Lens', desc: '+10% area', color: '#9FE8FF' },
  duplicator: { name: 'Echo Rune', desc: '+1 shard / glaive / sigil (odd levels)', color: '#A26BFF' },
  plating: { name: 'Obsidian Shell', desc: '+1 armor (less contact damage)', color: '#C9CFDA' },
  vitality: { name: 'Heartstone', desc: '+20 max HP', color: '#3DFF8E' },
  bloodstone: { name: 'Lifebloom', desc: '+0.4 HP regen / sec', color: '#FF2A3D' },
  magnet: { name: 'Lodestar', desc: '+35% pickup range', color: '#4AA8FF' },
  swiftness: { name: 'Wind Treads', desc: '+8% move speed', color: '#FFFFFF' },
  fortune: { name: 'Lucky Chip', desc: '+20% gold, luckier vaults', color: '#FFD86A' }
}

export type EnemyDef = { hp: number; speed: number; dmg: number; xp: number; r: number; model: string; scale: number; hover: number }
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  bat: { hp: 6, speed: 3.3, dmg: 5, xp: 1, r: 0.35, model: 'models/bat.glb', scale: 1, hover: 0 },
  ghoul: { hp: 18, speed: 1.9, dmg: 8, xp: 2, r: 0.4, model: 'models/ghoul.glb', scale: 1, hover: 0 },
  skeleton: { hp: 30, speed: 2.5, dmg: 10, xp: 3, r: 0.4, model: 'models/skeleton.glb', scale: 1, hover: 0 },
  wraith: { hp: 24, speed: 3.7, dmg: 12, xp: 4, r: 0.45, model: 'models/wraith.glb', scale: 1, hover: 0 },
  elite: { hp: 320, speed: 2.1, dmg: 20, xp: 25, r: 0.8, model: 'models/ghoul_elite.glb', scale: 1.7, hover: 0 },
  boss: { hp: 1, speed: 1.7, dmg: 35, xp: 120, r: 1.2, model: 'models/lich.glb', scale: 1, hover: 0 } // stats come from BOSSES
}

/** which kinds spawn at a given run time (seconds), with weights */
export function waveMix(t: number): [EnemyKind, number][] {
  if (t < 60) return [['bat', 80], ['ghoul', 20]]
  if (t < 120) return [['bat', 40], ['ghoul', 40], ['skeleton', 20]]
  if (t < 240) return [['bat', 25], ['ghoul', 30], ['skeleton', 30], ['wraith', 15]]
  return [['bat', 20], ['ghoul', 20], ['skeleton', 35], ['wraith', 25]]
}

/** experience needed to go from `lvl` to `lvl+1` */
export function xpNeed(lvl: number) {
  if (lvl < 20) return 5 + (lvl - 1) * 4
  if (lvl < 40) return 85 + (lvl - 20) * 8
  return 245 + Math.round((lvl - 40) * 5.5)
}

export const STARTERS: WeaponId[] = ['lash', 'bolt', 'orbit']

// ───────────── ARMORY: manual weapons (left click / hold). Bought with banked gold, kept forever. ─────────────
export type ArmoryDef = {
  name: string
  cost: number
  dmg: number
  range: number
  arc: number // degrees (melee)
  cd: number
  knock: number
  color: string
  model: string
  fx: string
  gun?: boolean
  chain?: number // Zeus: lightning jumps to this many extra foes
  god?: boolean // Divine Ascension: every hit is lethal
  quake?: number // hammer shockwave radius
  leech?: number // hp per hit
  desc: string
}
export const ARMORY: ArmoryDef[] = [
  { name: 'Bare Fists', cost: 0, dmg: 12, range: 2.1, arc: 100, cd: 0.4, knock: 3, color: '#E8E2FF', model: 'models/w_fist.glb', fx: 'fist', desc: 'Punch what is in front of you' },
  { name: 'Frying Pan', cost: 200, dmg: 30, range: 2.5, arc: 120, cd: 0.45, knock: 8, color: '#FFB84A', model: 'models/w_pan.glb', fx: 'pan', desc: 'BONK. Big knockback' },
  { name: 'War Hammer', cost: 500, dmg: 70, range: 2.8, arc: 130, cd: 0.7, knock: 10, quake: 3.2, color: '#FFD86A', model: 'models/w_hammer.glb', fx: 'hammer', desc: 'Smash + ground quake' },
  { name: 'Flame Sword', cost: 2000, dmg: 120, range: 3.7, arc: 160, cd: 0.38, knock: 4, color: '#FF6A1E', model: 'models/w_flame.glb', fx: 'flame', desc: 'Wide burning slashes' },
  { name: 'Reaper Blade', cost: 4000, dmg: 210, range: 4.6, arc: 240, cd: 0.4, knock: 5, leech: 1, color: '#B07BFF', model: 'models/w_reaper.glb', fx: 'reaper', desc: 'Huge sweeps that steal life' },
  { name: 'Storm Minigun', cost: 20000, dmg: 60, range: 18, arc: 0, cd: 0.07, knock: 1.5, gun: true, color: '#7FE8FF', model: 'models/w_minigun.glb', fx: 'gun', desc: 'Hold to shred everything in a line' },
  { name: 'Doomsday Nuke', cost: 100000, dmg: 40000, range: 16, arc: 0, cd: 30, knock: 0, color: '#FF3B2E', model: 'models/w_nuke.glb', fx: 'nuke', desc: 'Press F: wipe the screen (30s cooldown)' },
  { name: "Zeus' Atomic Thunder", cost: 200000, dmg: 1400, range: 20, arc: 0, cd: 0.22, knock: 3, chain: 7, color: '#FFE45A', model: 'models/w_zeus.glb', fx: 'zeus', desc: 'Chain lightning that leaps through 8 foes' },
  { name: 'Divine Ascension', cost: 1000000, dmg: 1, range: 10, arc: 360, cd: 0.35, knock: 12, god: true, color: '#FFFFFF', model: 'models/w_god.glb', fx: 'god', desc: 'BECOME A GOD — divine form, everything dies in one hit' }
]
export const GOD_TIER = 8
/** weapons you can hold (the nuke is an F-key ability, not a held weapon) */
export const isHoldable = (tier: number) => tier !== NUKE_TIER
export const NUKE_TIER = 6
export const NUKE = { cd: 30, delay: 1.2, radius: 16, dmg: 40000, bossCap: 0.2, ahead: 9 }
/** manual damage grows with player level so the armory stays relevant deep into a run */
export const manualLevelScale = (lvl: number) => 1 + 0.02 * (lvl - 1)

// ───────────── BOSS LADDER: a boss every few levels up to 200, then endless calamities ─────────────
export type BossDef = { lvl: number; name: string; title: string; model: string; scale: number; hp: number; dmg: number; speed: number; r: number; slam: number; adds: EnemyKind; color: string }
export const BOSSES: BossDef[] = [
  { lvl: 10, name: 'Gravemaw', title: 'Glutton of the Crypts', model: 'models/ghoul_elite.glb', scale: 2.6, hp: 1500, dmg: 25, speed: 2.0, r: 1.2, slam: 3.5, adds: 'ghoul', color: '#FF5A3D' },
  { lvl: 20, name: 'The Hollow King', title: 'Lord of the Casino Crypt', model: 'models/lich.glb', scale: 1.5, hp: 6000, dmg: 35, speed: 1.8, r: 1.3, slam: 4.5, adds: 'skeleton', color: '#B07BFF' },
  { lvl: 35, name: 'Wraith Matriarch', title: 'Mother of the Veil', model: 'models/wraith.glb', scale: 2.8, hp: 24000, dmg: 45, speed: 2.6, r: 1.3, slam: 5, adds: 'wraith', color: '#3FE6FF' },
  { lvl: 50, name: 'Ossuary Drake', title: 'First Dragon of the Rift', model: 'models/dragon_bone.glb', scale: 1.0, hp: 60000, dmg: 60, speed: 2.0, r: 2.0, slam: 6, adds: 'skeleton', color: '#CFE8FF' },
  { lvl: 70, name: 'Cinderwing', title: 'The Burning Drake', model: 'models/dragon_fire.glb', scale: 1.1, hp: 130000, dmg: 80, speed: 2.2, r: 2.2, slam: 6.5, adds: 'bat', color: '#FF6A1E' },
  { lvl: 90, name: 'Voidmaw', title: 'Wyrm Between Stars', model: 'models/dragon_void.glb', scale: 1.15, hp: 250000, dmg: 100, speed: 2.3, r: 2.3, slam: 7, adds: 'wraith', color: '#C04BFF' },
  { lvl: 115, name: 'Elder Ossuary', title: 'The Drake Reborn', model: 'models/dragon_bone.glb', scale: 1.4, hp: 450000, dmg: 125, speed: 2.3, r: 2.6, slam: 7.5, adds: 'skeleton', color: '#CFE8FF' },
  { lvl: 140, name: 'Cinder Tyrant', title: 'Crown of Ash', model: 'models/dragon_fire.glb', scale: 1.55, hp: 800000, dmg: 150, speed: 2.4, r: 2.9, slam: 8, adds: 'bat', color: '#FF6A1E' },
  { lvl: 170, name: 'Abyssal Leviathan', title: 'The Sky That Bites', model: 'models/dragon_void.glb', scale: 1.7, hp: 1400000, dmg: 180, speed: 2.5, r: 3.2, slam: 8.5, adds: 'wraith', color: '#C04BFF' },
  { lvl: 200, name: 'NIGHTSWARM', title: 'The World Eater', model: 'models/dragon_wyrm.glb', scale: 1.0, hp: 2600000, dmg: 220, speed: 2.4, r: 3.6, slam: 10, adds: 'wraith', color: '#FFD86A' }
]
export const ENDLESS_EVERY = 20 // after level 200: a Calamity every 20 levels, 35% stronger each time
export function bossFor(index: number): BossDef {
  if (index < BOSSES.length) return BOSSES[index]
  const k = index - BOSSES.length + 1
  const base = BOSSES[3 + ((k - 1) % 7)]
  const mul = Math.pow(1.35, k)
  return {
    ...base,
    lvl: 200 + k * ENDLESS_EVERY,
    name: `Calamity ${toRoman(k)}: ${base.name}`,
    title: 'Endless Night',
    scale: Math.min(2.0, base.scale * 1.15),
    hp: Math.round(BOSSES[BOSSES.length - 1].hp * mul),
    dmg: Math.round(BOSSES[BOSSES.length - 1].dmg * Math.pow(1.12, k))
  }
}
function toRoman(n: number) {
  const r: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let s = ''
  for (const [v, c] of r) while (n >= v) (s += c), (n -= v)
  return s
}

// ───────────── endless level-ups once every skill is maxed ─────────────
export type BoostId = 'dmg' | 'hp' | 'area' | 'regen' | 'gold'
export const BOOSTS: Record<BoostId, { name: string; desc: string; color: string }> = {
  dmg: { name: 'Rift Power', desc: '+8% all damage', color: '#FF5468' },
  hp: { name: 'Rift Vigor', desc: '+25 max HP and heal 25', color: '#3DFF8E' },
  area: { name: 'Rift Reach', desc: '+4% area (max +60%)', color: '#9FE8FF' },
  regen: { name: 'Rift Bloom', desc: '+0.5 HP regen / sec', color: '#FF7AC8' },
  gold: { name: 'Rift Tithe', desc: '+30 gold now', color: '#FFD86A' }
}

// ───────────── TREASURY: real-money gold packs (must match server/src/payments.ts) ─────────────
export const GOLD_PACKS = [
  { id: 'p5', usd: 5, gold: 5_000, bonus: 0, tag: '', img: 'images/pack_1.png' },
  { id: 'p10', usd: 10, gold: 10_000, bonus: 0, tag: 'POPULAR', img: 'images/pack_2.png' },
  { id: 'p25', usd: 25, gold: 27_500, bonus: 10, tag: '+10% BONUS', img: 'images/pack_3.png' },
  { id: 'p50', usd: 50, gold: 60_000, bonus: 20, tag: '+20% BONUS', img: 'images/pack_4.png' },
  { id: 'p100', usd: 100, gold: 130_000, bonus: 30, tag: 'BEST VALUE', img: 'images/pack_5.png' }
]
export const FIRST_BUY_BONUS = 0.5

/** relics dropped by THE PALE SOVEREIGN (raid at -91,71); must match raid/src/defs.ts + server/src/raid.ts */
export type CosmeticDef = { id: string; name: string; model?: string; anchor?: 'head' | 'hand_l' | 'hand_r' | 'feet' | 'over'; title?: string }
export const COSMETICS: CosmeticDef[] = [
  { id: 'title_slayer', name: 'Reaper Slayer', title: 'Reaper Slayer' },
  { id: 'title_bane', name: "Death's Bane", title: "Death's Bane" },
  { id: 'lantern', name: 'Soul Lantern', model: 'models/cos_lantern.glb', anchor: 'hand_l' },
  { id: 'crown', name: 'Bone Crown', model: 'models/cos_crown.glb', anchor: 'head' },
  { id: 'hourglass', name: 'Hourglass of Ages', model: 'models/cos_hourglass.glb', anchor: 'over' },
  { id: 'shroud', name: "Reaper's Shroud", model: 'models/cos_shroud.glb', anchor: 'feet' },
  { id: 'scythe_skin', name: 'Scythe of the Pale Sovereign', model: 'models/cos_scythe.glb', anchor: 'hand_r' }
]
export const RAID_PARCEL = { x: -91, y: 71 }

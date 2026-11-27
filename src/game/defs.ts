// Pure data: weapons, passives, enemies, evolutions. No Decentraland imports (used by the headless sim too).

export type WeaponId = 'lash' | 'bolt' | 'orbit' | 'aura' | 'thunder' | 'nova' | 'frost' | 'chain' | 'chakram' | 'mine' | 'beam' | 'wisp'
export type PassiveId = 'might' | 'haste' | 'expanse' | 'duplicator' | 'plating' | 'vitality' | 'bloodstone' | 'magnet' | 'swiftness' | 'fortune'
export type EnemyKind = 'bat' | 'ghoul' | 'skeleton' | 'wraith' | 'slime' | 'slimelet' | 'spider' | 'imp' | 'wisp' | 'hound' | 'brute' | 'elite' | 'boss'

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
  },
  frost: {
    name: 'Frost Comet',
    evo: 'Glacier Cataclysm',
    evoWith: 'magnet',
    color: '#8FE3FF',
    desc: ['Ice comets crash into the horde and slow it', '+damage', '+radius', '+1 comet', '+damage', '+radius', '+1 comet', '+damage, longer chill']
  },
  chain: {
    name: 'Arc Chain',
    evo: 'Tesla Storm',
    evoWith: 'swiftness',
    color: '#7DF9FF',
    desc: ['Lightning leaps from foe to foe', '+1 jump', '+damage', '+1 jump', '+damage', '+1 jump', '+damage', '+2 jumps']
  },
  chakram: {
    name: 'Moon Chakram',
    evo: 'Twin Eclipse',
    evoWith: 'fortune',
    color: '#E6E9FF',
    desc: ['A chakram flies out and comes back, cutting everything twice', '+damage', '+range', '+1 chakram', '+damage', '+range', '+1 chakram', '+damage']
  },
  mine: {
    name: 'Hex Mine',
    evo: 'Soul Detonator',
    evoWith: 'bloodstone',
    color: '#FF4A8A',
    desc: ['Leaves cursed runes that explode under foes', '+1 rune', '+damage', '+radius', '+1 rune', '+damage', '+radius', '+2 runes']
  },
  beam: {
    name: 'Prism Ray',
    evo: 'Solar Lance',
    evoWith: 'expanse',
    color: '#FFF27A',
    desc: ['A light beam sweeps a full circle around you', '+length', '+damage', '-cooldown', '+1 beam', '+damage', '+length', '+damage']
  },
  wisp: {
    name: 'Spirit Wisps',
    evo: 'Phoenix Choir',
    evoWith: 'duplicator',
    color: '#7BFFB2',
    desc: ['Spirit wisps dart at foes on their own', '+damage', '+1 wisp', '+speed', '+damage', '+1 wisp', '+speed', '+damage']
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
  magnet: { name: 'Lodestar', desc: '+35% pickup range (max +300%)', color: '#4AA8FF' },
  swiftness: { name: 'Wind Treads', desc: '+8% move speed', color: '#FFFFFF' },
  fortune: { name: 'Lucky Chip', desc: '+12% gold & coins, luckier vaults', color: '#FFD86A' }
}

export type EnemyDef = { hp: number; speed: number; dmg: number; xp: number; r: number; model: string; scale: number; hover: number }
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  bat: { hp: 6, speed: 3.3, dmg: 5, xp: 1, r: 0.35, model: 'models/bat.glb', scale: 1, hover: 0 },
  ghoul: { hp: 18, speed: 1.9, dmg: 8, xp: 2, r: 0.4, model: 'models/ghoul.glb', scale: 1, hover: 0 },
  skeleton: { hp: 30, speed: 2.5, dmg: 10, xp: 3, r: 0.4, model: 'models/skeleton.glb', scale: 1, hover: 0 },
  wraith: { hp: 24, speed: 3.7, dmg: 12, xp: 4, r: 0.45, model: 'models/wraith.glb', scale: 1, hover: 0 },
  // the wider bestiary: each has its own trick (see Run.moveEnemies)
  slime: { hp: 22, speed: 1.6, dmg: 7, xp: 2, r: 0.5, model: 'models/slime.glb', scale: 1, hover: 0 }, // splits in two when it dies
  slimelet: { hp: 7, speed: 3.0, dmg: 4, xp: 1, r: 0.3, model: 'models/slime.glb', scale: 0.55, hover: 0 },
  spider: { hp: 20, speed: 2.6, dmg: 9, xp: 3, r: 0.45, model: 'models/spider.glb', scale: 1, hover: 0 }, // pounces
  imp: { hp: 16, speed: 2.8, dmg: 6, xp: 4, r: 0.38, model: 'models/imp.glb', scale: 1, hover: 0 }, // keeps its distance, throws fireballs
  wisp: { hp: 10, speed: 3.2, dmg: 22, xp: 3, r: 0.35, model: 'models/wisp.glb', scale: 1, hover: 0 }, // rushes in and explodes
  hound: { hp: 34, speed: 4.4, dmg: 13, xp: 5, r: 0.5, model: 'models/hound.glb', scale: 1, hover: 0 }, // fast pack hunter
  brute: { hp: 120, speed: 1.45, dmg: 18, xp: 8, r: 0.75, model: 'models/brute.glb', scale: 1, hover: 0 }, // stone giant, shrugs off knockback
  elite: { hp: 320, speed: 2.1, dmg: 20, xp: 25, r: 0.8, model: 'models/ghoul_elite.glb', scale: 1.7, hover: 0 },
  boss: { hp: 1, speed: 1.7, dmg: 35, xp: 120, r: 1.2, model: 'models/lich.glb', scale: 1, hover: 0 } // stats come from BOSSES
}

/** which kinds spawn at a given run time (seconds), with weights */
export function waveMix(t: number): [EnemyKind, number][] {
  if (t < 60) return [['bat', 70], ['ghoul', 20], ['slime', 10]]
  if (t < 120) return [['bat', 30], ['ghoul', 25], ['skeleton', 15], ['slime', 15], ['spider', 15]]
  if (t < 240) return [['bat', 15], ['ghoul', 15], ['skeleton', 20], ['wraith', 10], ['slime', 10], ['spider', 12], ['imp', 10], ['wisp', 8]]
  if (t < 480) return [['bat', 10], ['ghoul', 10], ['skeleton', 18], ['wraith', 14], ['spider', 10], ['imp', 12], ['wisp', 8], ['brute', 8], ['hound', 10]]
  return [['bat', 5], ['ghoul', 5], ['skeleton', 15], ['wraith', 15], ['slime', 5], ['spider', 10], ['imp', 12], ['wisp', 10], ['hound', 15], ['brute', 13]]
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
  { name: 'Divine Ascension', cost: 1000000, dmg: 800, range: 10, arc: 360, cd: 0.35, knock: 12, god: true, color: '#FFFFFF', model: 'models/w_god.glb', fx: 'god', desc: 'BECOME A GOD — divine form, everything dies in one hit (mythic bosses take heavy blows)' }
]
export const GOD_TIER = 8
/** weapons you can hold (the nuke is an F-key ability, not a held weapon) */
export const isHoldable = (tier: number) => tier !== NUKE_TIER
export const NUKE_TIER = 6
export const NUKE = { cd: 30, delay: 1.2, radius: 16, dmg: 40000, bossCap: 0.2, ahead: 9 }
/** manual damage grows with player level so the armory stays relevant deep into a run */
export const manualLevelScale = (lvl: number) => 1 + 0.02 * (lvl - 1)

// ───────────── BOSS LADDER: a boss every few levels up to 200, then endless calamities ─────────────
export type BossDef = {
  lvl: number; name: string; title: string; model: string; scale: number; hp: number; dmg: number; speed: number; r: number; slam: number; adds: EnemyKind; color: string
  /** spawns together with the next entry (twin encounter) */
  twin?: boolean
  /** lunges at the player between slams */
  charge?: boolean
  /** hover height (sky gods fly) */
  fly?: number
  /** ranged patterns: energy beam, orb barrage, meteor rain */
  attacks?: BossAttack[]
  /** Lv 350+ mythic patterns (replace `attacks`); fired `combo` at a time every `cd` seconds */
  moves?: BossMove[]
  /** what falls in a 'rain' volley */
  rain?: RainKind
  /** share of the hunter's max HP a big hit takes (mythic bosses scale with you, not with flat numbers) */
  pct?: number
  combo?: number
  cd?: number
  /** enrage steps at 66% / 33% HP: faster volleys, and one more pattern at once in the last step */
  phases?: number
  /** shrugs off Divine Ascension one-hit kills */
  divine?: boolean
  /** THE ALMIGHTY: the story ends when it falls */
  god?: boolean
}
export type BossAttack = 'beam' | 'orbs' | 'meteors'
export type BossMove = BossAttack | 'rings' | 'rain' | 'pillars' | 'spokes' | 'shades' | 'sun' | 'blink' | 'cross' | 'wave' | 'light' | 'chrono'
export type RainKind = 'spear' | 'cannon' | 'kunai' | 'fire' | 'fist' | 'bolt' | 'star'
// original creature bosses + dragons; twins arrive together and share the arena
export const BOSSES: BossDef[] = [
  { lvl: 10, name: 'Gravemaw', title: 'Glutton of the Crypts', model: 'models/ghoul_elite.glb', scale: 2.6, hp: 1500, dmg: 25, speed: 2.0, r: 1.2, slam: 3.5, adds: 'ghoul', color: '#FF5A3D' },
  { lvl: 16, name: 'Voltkit', title: 'The Storm Kitsune', model: 'models/boss_fox.glb', scale: 0.85, hp: 3200, dmg: 28, speed: 2.7, r: 1.3, slam: 4, adds: 'bat', color: '#5EF2FF', charge: true },
  { lvl: 22, name: 'The Hollow King', title: 'Lord of the Casino Crypt', model: 'models/lich.glb', scale: 1.5, hp: 6500, dmg: 35, speed: 1.8, r: 1.3, slam: 4.5, adds: 'skeleton', color: '#B07BFF' },
  { lvl: 28, name: 'Sporelord', title: 'King of the Rotting Grove', model: 'models/boss_toad.glb', scale: 0.8, hp: 12000, dmg: 40, speed: 1.6, r: 1.8, slam: 5.2, adds: 'ghoul', color: '#9DFF5A' },
  { lvl: 35, name: 'Wraith Matriarch', title: 'Mother of the Veil', model: 'models/wraith.glb', scale: 2.8, hp: 22000, dmg: 45, speed: 2.6, r: 1.3, slam: 5, adds: 'wraith', color: '#3FE6FF' },
  { lvl: 42, name: 'Prismhorn', title: 'The Crystal Colossus', model: 'models/boss_golem.glb', scale: 0.85, hp: 36000, dmg: 55, speed: 1.5, r: 1.8, slam: 6, adds: 'skeleton', color: '#7AF0FF' },
  { lvl: 50, name: 'Ossuary Drake', title: 'First Dragon of the Rift', model: 'models/dragon_bone.glb', scale: 1.0, hp: 60000, dmg: 60, speed: 2.0, r: 2.0, slam: 6, adds: 'skeleton', color: '#CFE8FF' },
  { lvl: 60, name: 'Emberfang', title: 'Twin of Flame', model: 'models/boss_hound.glb', scale: 0.95, hp: 55000, dmg: 65, speed: 2.8, r: 1.5, slam: 5, adds: 'bat', color: '#FF7A1A', twin: true, charge: true },
  { lvl: 60, name: 'Voltkit Prime', title: 'Twin of Storm', model: 'models/boss_fox.glb', scale: 1.05, hp: 55000, dmg: 65, speed: 2.9, r: 1.5, slam: 5, adds: 'bat', color: '#5EF2FF', charge: true },
  { lvl: 70, name: 'Cinderwing', title: 'The Burning Drake', model: 'models/dragon_fire.glb', scale: 1.1, hp: 130000, dmg: 80, speed: 2.2, r: 2.2, slam: 6.5, adds: 'bat', color: '#FF6A1E' },
  { lvl: 80, name: 'Lumora', title: 'The Moth Queen', model: 'models/boss_moth.glb', scale: 1.0, hp: 170000, dmg: 85, speed: 2.5, r: 1.8, slam: 7, adds: 'bat', color: '#FFD86A' },
  { lvl: 90, name: 'Voidmaw', title: 'Wyrm Between Stars', model: 'models/dragon_void.glb', scale: 1.15, hp: 250000, dmg: 100, speed: 2.3, r: 2.3, slam: 7, adds: 'wraith', color: '#C04BFF' },
  { lvl: 100, name: 'Prismhorn Elder', title: 'Twin of Stone', model: 'models/boss_golem.glb', scale: 1.15, hp: 220000, dmg: 105, speed: 1.7, r: 2.2, slam: 7, adds: 'skeleton', color: '#D69BFF', twin: true },
  { lvl: 100, name: 'Sporelord Ancient', title: 'Twin of Rot', model: 'models/boss_toad.glb', scale: 1.05, hp: 220000, dmg: 105, speed: 1.8, r: 2.2, slam: 7, adds: 'ghoul', color: '#9DFF5A' },
  { lvl: 115, name: 'Elder Ossuary', title: 'The Drake Reborn', model: 'models/dragon_bone.glb', scale: 1.4, hp: 450000, dmg: 125, speed: 2.3, r: 2.6, slam: 7.5, adds: 'skeleton', color: '#CFE8FF' },
  { lvl: 128, name: 'Magmashell', title: 'The Walking Volcano', model: 'models/boss_turtle.glb', scale: 1.1, hp: 620000, dmg: 135, speed: 1.4, r: 2.8, slam: 8.5, adds: 'skeleton', color: '#FF6A1A' },
  { lvl: 140, name: 'Cinder Tyrant', title: 'Crown of Ash', model: 'models/dragon_fire.glb', scale: 1.55, hp: 800000, dmg: 150, speed: 2.4, r: 2.9, slam: 8, adds: 'bat', color: '#FF6A1E' },
  { lvl: 155, name: 'Lumora Eternal', title: 'Twin of Dusk', model: 'models/boss_moth.glb', scale: 1.3, hp: 700000, dmg: 160, speed: 2.6, r: 2.2, slam: 8, adds: 'wraith', color: '#FFD86A', twin: true },
  { lvl: 155, name: 'Magmashell Titan', title: 'Twin of Dawn', model: 'models/boss_turtle.glb', scale: 1.35, hp: 700000, dmg: 160, speed: 1.6, r: 3.2, slam: 9, adds: 'skeleton', color: '#FF6A1A' },
  { lvl: 170, name: 'Abyssal Leviathan', title: 'The Sky That Bites', model: 'models/dragon_void.glb', scale: 1.7, hp: 1400000, dmg: 180, speed: 2.5, r: 3.2, slam: 8.5, adds: 'wraith', color: '#C04BFF' },
  { lvl: 185, name: 'Ashen Twin', title: 'The Twin Calamity', model: 'models/dragon_fire.glb', scale: 1.6, hp: 1100000, dmg: 190, speed: 2.4, r: 3.0, slam: 8.5, adds: 'bat', color: '#FF6A1E', twin: true },
  { lvl: 185, name: 'Starless Twin', title: 'The Twin Calamity', model: 'models/dragon_void.glb', scale: 1.6, hp: 1100000, dmg: 190, speed: 2.5, r: 3.0, slam: 8.5, adds: 'wraith', color: '#C04BFF' },
  { lvl: 200, name: 'NIGHTSWARM', title: 'The World Eater', model: 'models/dragon_wyrm.glb', scale: 1.0, hp: 2600000, dmg: 220, speed: 2.4, r: 3.6, slam: 10, adds: 'wraith', color: '#FFD86A' },
  // ── the SKY GODS (Lv 220-300): they fly, fire energy beams, orb barrages and meteor rain ──
  { lvl: 220, name: 'Seraph of Ruin', title: 'The Light That Burns', model: 'models/boss_seraph.glb', scale: 1.0, hp: 6000000, dmg: 240, speed: 3.0, r: 2.4, slam: 9, adds: 'wraith', color: '#FFF2B0', fly: 3.5, attacks: ['beam', 'orbs'] },
  { lvl: 240, name: 'Stormheart', title: 'Wings of the Last Storm', model: 'models/boss_stormbird.glb', scale: 1.1, hp: 9000000, dmg: 260, speed: 3.6, r: 2.6, slam: 9, adds: 'bat', color: '#7DF9FF', fly: 5, charge: true, attacks: ['orbs', 'meteors'] },
  { lvl: 260, name: 'Oculus Prime', title: 'The Eye Above All', model: 'models/boss_oculus.glb', scale: 1.1, hp: 13500000, dmg: 280, pct: 0.13, speed: 2.2, r: 3.0, slam: 10, adds: 'wraith', color: '#FF2A6A', fly: 4, attacks: ['beam', 'orbs'] },
  { lvl: 280, name: 'Azure Leviathan', title: 'Serpent of the Upper Sky', model: 'models/boss_skywyrm.glb', scale: 1.3, hp: 20000000, dmg: 300, pct: 0.15, speed: 3.2, r: 3.0, slam: 10, adds: 'skeleton', color: '#3FE6FF', fly: 4.5, charge: true, attacks: ['beam', 'meteors'] },
  { lvl: 300, name: 'AETHERION', title: 'The God-Eater', model: 'models/boss_aetherion.glb', scale: 1.2, hp: 33000000, dmg: 340, pct: 0.17, speed: 2.4, r: 3.8, slam: 12, adds: 'wraith', color: '#B05BFF', fly: 2.5, attacks: ['beam', 'orbs', 'meteors'] },
  // ── the MYTHIC ASCENT (Lv 350-1000, every 50): warriors, pirates, ninja, angels and demons — original designs ──
  // their hits take a share of YOUR max HP, so the fight stays deadly however strong you get
  { lvl: 350, name: 'VARKOS', title: 'The Unbound Ki Berserker', model: 'models/boss_varkos.glb', scale: 1.0, hp: 45000000, dmg: 360, speed: 3.0, r: 2.4, slam: 9, adds: 'skeleton', color: '#FF3B4E', fly: 1.5, moves: ['wave', 'rain', 'rings', 'blink'], rain: 'fist', pct: 0.18, combo: 1, cd: 3.2, divine: true },
  { lvl: 400, name: 'CAPTAIN DRAKKAR', title: 'Emperor of the Drowned Tide', model: 'models/boss_drakkar.glb', scale: 1.1, hp: 52000000, dmg: 380, speed: 2.2, r: 2.8, slam: 10, adds: 'ghoul', color: '#2BD4C4', moves: ['rain', 'rings', 'pillars', 'cross'], rain: 'cannon', pct: 0.19, combo: 1, cd: 3.0, divine: true },
  { lvl: 450, name: 'KAGEROU', title: 'The Thousand Shadows', model: 'models/boss_kagerou.glb', scale: 1.0, hp: 60000000, dmg: 400, speed: 3.8, r: 2.0, slam: 8, adds: 'wraith', color: '#E03A5A', moves: ['shades', 'rain', 'blink', 'cross'], rain: 'kunai', pct: 0.19, combo: 1, cd: 2.8, divine: true },
  { lvl: 500, name: 'SOLARIEL', title: 'Archangel of Judgment', model: 'models/boss_solariel.glb', scale: 1.1, hp: 70000000, dmg: 420, speed: 2.8, r: 2.6, slam: 9, adds: 'wraith', color: '#FFE9A8', fly: 3, moves: ['pillars', 'rain', 'cross', 'wave'], rain: 'spear', pct: 0.2, combo: 2, cd: 3.4, divine: true },
  { lvl: 550, name: 'MALGOROTH', title: 'The Hellforge Tyrant', model: 'models/boss_malgoroth.glb', scale: 1.2, hp: 82000000, dmg: 440, speed: 2.4, r: 3.0, slam: 10, adds: 'skeleton', color: '#FF5A1E', moves: ['rain', 'spokes', 'rings', 'sun'], rain: 'fire', pct: 0.21, combo: 2, cd: 3.4, divine: true },
  { lvl: 600, name: 'ZERATH', title: 'The Star-Devourer', model: 'models/boss_zerath.glb', scale: 1.0, hp: 95000000, dmg: 460, speed: 3.2, r: 2.4, slam: 9, adds: 'wraith', color: '#8A6BFF', fly: 2.5, moves: ['sun', 'orbs', 'rain', 'wave'], rain: 'star', pct: 0.21, combo: 2, cd: 3.2, divine: true },
  { lvl: 650, name: 'YORUMI', title: 'The Nine-Tailed Empress', model: 'models/boss_yorumi.glb', scale: 1.2, hp: 110000000, dmg: 480, speed: 3.6, r: 2.6, slam: 9, adds: 'bat', color: '#7FD8FF', moves: ['shades', 'spokes', 'rings', 'blink'], pct: 0.22, combo: 2, cd: 3.0, divine: true },
  { lvl: 700, name: 'THE DROWNED ARMADA', title: 'Ghost Flagship of the Endless Sea', model: 'models/boss_armada.glb', scale: 1.3, hp: 125000000, dmg: 500, speed: 2.0, r: 3.4, slam: 11, adds: 'ghoul', color: '#39FFB0', fly: 3.5, moves: ['cross', 'rain', 'sun', 'rings'], rain: 'cannon', pct: 0.23, combo: 2, cd: 3.2, divine: true },
  { lvl: 750, name: 'IKAZUCHI', title: 'The Thunder Shogun', model: 'models/boss_raikou.glb', scale: 1.2, hp: 140000000, dmg: 520, speed: 3.0, r: 2.8, slam: 10, adds: 'skeleton', color: '#FFD02B', moves: ['pillars', 'cross', 'rain', 'blink'], rain: 'bolt', pct: 0.23, combo: 2, cd: 3.0, divine: true },
  { lvl: 800, name: 'OPHANOS', title: 'The Burning Wheels', model: 'models/boss_ophanos.glb', scale: 1.2, hp: 160000000, dmg: 540, speed: 2.4, r: 3.0, slam: 10, adds: 'wraith', color: '#FFB347', fly: 4, moves: ['spokes', 'pillars', 'orbs', 'rain'], rain: 'spear', pct: 0.24, combo: 2, cd: 3.0, divine: true },
  { lvl: 850, name: 'NYXARA', title: 'Queen of the Abyss', model: 'models/boss_nyxara.glb', scale: 1.2, hp: 180000000, dmg: 560, speed: 3.2, r: 2.6, slam: 10, adds: 'wraith', color: '#B04BFF', fly: 3, moves: ['sun', 'shades', 'spokes', 'cross'], pct: 0.25, combo: 2, cd: 3.4, divine: true },
  { lvl: 900, name: 'ASURAKH', title: 'The Six-Armed Wrath', model: 'models/boss_asurakh.glb', scale: 1.3, hp: 200000000, dmg: 580, speed: 2.8, r: 3.2, slam: 11, adds: 'skeleton', color: '#FF6A3D', moves: ['rain', 'rings', 'cross', 'wave', 'blink'], rain: 'fist', pct: 0.25, combo: 2, cd: 3.2, divine: true },
  { lvl: 950, name: 'KHRONOS', title: 'The Time Devourer', model: 'models/boss_khronos.glb', scale: 1.3, hp: 225000000, dmg: 600, speed: 2.2, r: 3.4, slam: 11, adds: 'ghoul', color: '#E8D28A', fly: 2.5, moves: ['chrono', 'rings', 'pillars', 'spokes', 'sun'], pct: 0.26, combo: 2, cd: 3.2, divine: true },
  { lvl: 1000, name: 'MORTHAEL', title: 'The Last Demon King', model: 'models/boss_morthael.glb', scale: 1.5, hp: 400000000, dmg: 640, speed: 3.2, r: 3.4, slam: 12, adds: 'wraith', color: '#FF2A3D', fly: 3, moves: ['sun', 'shades', 'cross', 'rain', 'spokes', 'rings', 'blink'], rain: 'fire', pct: 0.27, combo: 2, cd: 3.0, phases: 2, divine: true },
  // ── THE ALMIGHTY (Lv 1111): defeat God and become God. No boss comes after. ──
  { lvl: 1111, name: 'THE ALMIGHTY', title: 'God of All Creation', model: 'models/boss_almighty.glb', scale: 1.6, hp: 400000000, dmg: 700, speed: 2.2, r: 4.0, slam: 13, adds: 'wraith', color: '#FFF6D8', fly: 4.5, moves: ['light', 'pillars', 'spokes', 'rain', 'cross', 'sun', 'shades', 'rings'], rain: 'star', pct: 0.25, combo: 2, cd: 3.0, phases: 2, divine: true, god: true }
]
/** index of NIGHTSWARM in the ladder (bosses slain to reach + kill it; server/src/progress.ts SLAYER.bosses must match) */
export const NIGHTSWARM_INDEX = BOSSES.findIndex((b) => b.name === 'NIGHTSWARM')
/** the boss that ends the story, and the level it waits at */
export const GOD_INDEX = BOSSES.findIndex((b) => b.god)
export const GOD_LEVEL = BOSSES[GOD_INDEX].lvl
/** past THE ALMIGHTY nothing else comes: only the horde */
const NO_BOSS: BossDef = { ...BOSSES[GOD_INDEX], lvl: Number.POSITIVE_INFINITY, name: '—', title: 'No one left above you', god: false }
export function bossFor(index: number): BossDef {
  return index < BOSSES.length ? BOSSES[index] : NO_BOSS
}

// ───────────── GOD POWERS: unlocked at Lv 200 (own slots, up to Lv 5) ─────────────
export type GodId = 'kame' | 'nuke' | 'hole' | 'swords' | 'wings'
export const GOD_UNLOCK = 200
export const MAX_GODS = 3
export const MAX_GOD_LVL = 5
export const GODS: Record<GodId, { name: string; color: string; desc: string[] }> = {
  kame: { name: 'Celestial Cannon', color: '#5EF2FF', desc: ['Fire a colossal energy wave at the horde', '+damage, wider', '+damage, faster', '+damage, wider', 'MAX: golden beam'] },
  nuke: { name: "Heaven's Nuke", color: '#FF6A1A', desc: ['Call down a nuclear meteor', '+damage, bigger blast', '+damage, faster', '+damage, bigger blast', 'MAX: annihilation'] },
  hole: { name: 'Singularity', color: '#B05BFF', desc: ['Open a black hole that swallows and crushes', '+damage, stronger pull', '+damage, faster', '+damage, stronger pull', 'MAX: event horizon'] },
  swords: { name: 'Judgment Blades', color: '#FFF2B0', desc: ['Giant swords of light rain from heaven', '+2 blades, +damage', '+damage, faster', '+2 blades, +damage', 'MAX: golden judgment'] },
  wings: { name: 'Seraph Wings', color: '#FFD86A', desc: ['Grow wings: FLY (big jumps, glide), +15% speed, feather storm', '+feathers, +damage', '+damage, faster', '+feathers, +damage', 'MAX: golden storm'] }
}

// ───────────── ARTS: a new skill every 15-50 levels, all the way to God (no slot limit, 5 levels each) ─────────────
// Rift arts unlock by level (Lv 25-300); mythic arts are taken from each mythic boss you slay (Lv 350-1111).
export type ArtId =
  | 'ember' | 'fan' | 'tide' | 'lances' | 'kunai' | 'drums' | 'fist' | 'stars' | 'broadside' | 'pillars' | 'blacksun' | 'wheel'
  | 'kiburst' | 'cannonade' | 'cuts' | 'judgment' | 'hellrain' | 'horizon' | 'foxfire' | 'phantom' | 'raijin' | 'eyes' | 'abyss' | 'sixarms' | 'timestop' | 'wrath' | 'genesis'
  // fusion jackpots (never offered: only a lucky — or very unlucky — fusion makes them)
  | 'crown' | 'flush'
export const MAX_ART_LVL = 8
export type ArtDef = { name: string; color: string; lvl?: number; boss?: string; desc: string[] }
const up = (first: string, a: string, b: string, c: string, max: string) => [first, a, b, '+damage', c, '+damage, faster', '+damage', 'MAX: ' + max]
export const ARTS: Record<ArtId, ArtDef> = {
  ember: { name: 'Ember Rain', color: '#FF7A2A', lvl: 25, desc: up('Fireballs rain on nearby foes', '+2 fireballs', '+damage', '+2 fireballs, faster', 'a firestorm') },
  fan: { name: 'Blade Fan', color: '#D8E0F0', lvl: 40, desc: up('A fan of piercing knives at the nearest foe', '+2 knives', '+damage, pierce more', '+2 knives', 'knives in every direction') },
  tide: { name: 'Tidal Rings', color: '#3FD8FF', lvl: 55, desc: up('Rings of force roll out from you', '+1 ring', '+damage', '+1 ring, faster', 'three tides at once') },
  lances: { name: 'Sky Lances', color: '#FFE9A8', lvl: 70, desc: up('Spears of light pierce the strongest foes', '+1 lance', '+damage', '+2 lances', 'lances on everything big') },
  kunai: { name: 'Shadow Kunai', color: '#E03A5A', lvl: 85, desc: up('Kunai burst out in a full circle', '+4 kunai', '+damage', '+4 kunai, faster', 'twin bursts') },
  drums: { name: 'Thunder Drums', color: '#FFD02B', lvl: 100, desc: up('Lightning hammers a ring around you', '+2 bolts', '+damage', 'wider ring, faster', 'a double ring') },
  fist: { name: 'Meteor Fist', color: '#FF3B4E', lvl: 120, desc: up('A giant fist smashes the thickest crowd', '+damage', '+size', '+1 fist', 'three fists') },
  stars: { name: 'Star Shower', color: '#B9A8FF', lvl: 140, desc: up('Falling stars scatter over the field', '+3 stars', '+damage', '+3 stars, faster', 'a meteor shower') },
  broadside: { name: 'Broadside', color: '#2BD4C4', lvl: 165, desc: up('A line of cannon fire walks into the horde', '+2 shells', '+damage', 'second line', 'a full broadside') },
  pillars: { name: 'Judgment Pillars', color: '#FFF2B0', lvl: 230, desc: up('Pillars of light erupt under foes', '+2 pillars', '+damage', '+2 pillars, faster', 'a field of judgment') },
  blacksun: { name: 'Black Sun', color: '#B04BFF', lvl: 260, desc: up('A black sun crashes down and slows the crowd', '+size', '+damage', '+1 sun', 'twin eclipses') },
  wheel: { name: 'Prism Wheel', color: '#FFF27A', lvl: 290, desc: up('Rotating beams of light spin around you', '+1 beam', '+damage', '+1 beam, longer', 'a blinding wheel') },
  // ── mythic arts: taken from the bosses you slay ──
  kiburst: { name: 'Ki Burst', color: '#FF3B4E', boss: 'VARKOS', desc: up("VARKOS's power: a crimson ki wave", 'wider', '+damage', 'faster', 'waves both ways') },
  cannonade: { name: 'Ghost Cannonade', color: '#2BD4C4', boss: 'CAPTAIN DRAKKAR', desc: up("DRAKKAR's guns: cannonballs rain around you", '+3 shells', '+damage', '+3 shells, faster', 'the whole fleet fires') },
  cuts: { name: 'Thousand Cuts', color: '#E03A5A', boss: 'KAGEROU', desc: up("KAGEROU's art: slashes on every nearby foe", '+3 cuts', '+damage', '+3 cuts, faster', 'shadow clones join in') },
  judgment: { name: "Heaven's Judgment", color: '#FFE9A8', boss: 'SOLARIEL', desc: up("SOLARIEL's verdict: a grid of light pillars", 'bigger grid', '+damage', 'faster', 'judgment twice') },
  hellrain: { name: 'Hellfire Rain', color: '#FF5A1E', boss: 'MALGOROTH', desc: up("MALGOROTH's forge: a storm of hellfire", '+4 drops', '+damage', '+4 drops, faster', 'the forge overflows') },
  horizon: { name: 'Event Horizon', color: '#8A6BFF', boss: 'ZERATH', desc: up("ZERATH's heart: black suns on the biggest crowds", '+1 sun', '+damage, slow', '+1 sun', 'a dying galaxy') },
  foxfire: { name: 'Foxfire Swarm', color: '#7FD8FF', boss: 'YORUMI', desc: up("YORUMI's tails: homing foxfire", '+2 flames', '+damage', '+2 flames, faster', 'nine tails of fire') },
  phantom: { name: 'Phantom Broadside', color: '#39FFB0', boss: 'THE DROWNED ARMADA', desc: up('The ARMADA fires along both your flanks', 'longer lines', '+damage', 'faster', 'four lines of fire') },
  raijin: { name: "Raijin's Drums", color: '#FFE45A', boss: 'IKAZUCHI', desc: up("IKAZUCHI's storm: bolts in a ring + chain lightning", '+2 bolts', '+damage', '+chain jumps', 'the sky splits') },
  eyes: { name: 'Wheel of Eyes', color: '#FFB347', boss: 'OPHANOS', desc: up("OPHANOS's gaze: spinning beams of fire", '+1 beam', '+damage', 'faster spin', 'every eye opens') },
  abyss: { name: 'Abyssal Rings', color: '#C35BFF', boss: 'NYXARA', desc: up("NYXARA's void: rings of darkness erupt", '+1 ring', '+damage', 'faster', 'the abyss opens') },
  sixarms: { name: 'Six-Armed Fury', color: '#FF6A3D', boss: 'ASURAKH', desc: up("ASURAKH's arms: six blades strike at once", '+damage', 'longer reach', 'faster', 'twelve blades') },
  timestop: { name: 'Time Stop', color: '#E8D28A', boss: 'KHRONOS', desc: up("KHRONOS's clock: every foe near you freezes", 'longer', 'wider', 'faster', 'time itself obeys') },
  wrath: { name: "Demon King's Wrath", color: '#FF2A3D', boss: 'MORTHAEL', desc: up("MORTHAEL's wrath: a hell-sun and fire around it", '+damage', '+size', 'faster', 'the last king rises in you') },
  genesis: { name: 'Genesis Light', color: '#FFF6D8', boss: 'THE ALMIGHTY', desc: up('The light of creation smites everything around you', '+radius', '+damage', 'faster', 'let there be light') },
  crown: { name: '✦ CROWN OF CREATION ✦', color: '#FFD86A', desc: ['DIVINE FUSION (1 in 1000): four rings of heaven-pillars, a turning wheel of light and the dawn of creation', '', '', '', '', '', '', 'MAX'] },
  flush: { name: '💩 ROYAL FLUSH', color: '#9A6A3A', desc: ['DISASTER FUSION (1 in 500): you throw poop and spray pee. It stinks (slows) and it still hurts', '', '', '', '', '', '', 'MAX'] }
}

// ───────────── FUSION: from Lv 250, two mastered arts melt into one stronger art ─────────────
// The CORE keeps its pattern (one visual instead of two); each ESSENCE melts in and adds its element.
// Order matters: Ember→Tide (fire tide rings) is a different skill from Tide→Ember (rain that slows).
export const FUSION_LVL = 250
/** art slots once fusion opens: a full bar means fuse to make room for a new art */
export const ART_SLOTS = 6
/** a fused art holds its core plus up to 3 essences (★ → ★★ → ★★★) */
export const MAX_ESSENCE = 3
export type ElementId = 'fire' | 'thunder' | 'blade' | 'tide' | 'light' | 'shadow' | 'ki' | 'time'
export type ElementDef = { name: string; adj: string; color: string; dmg: number; area: number; cd: number; slow: number; trait: string }
export const ELEMENTS: Record<ElementId, ElementDef> = {
  fire: { name: 'Fire', adj: 'Infernal', color: '#FF7A2A', dmg: 1.3, area: 1, cd: 1, slow: 0, trait: 'Burning: +30% damage' },
  thunder: { name: 'Thunder', adj: 'Storm', color: '#FFE45A', dmg: 1, area: 1, cd: 0.78, slow: 0, trait: 'Storm: casts 28% faster' },
  blade: { name: 'Blade', adj: 'Razor', color: '#D8E0F0', dmg: 1.15, area: 1, cd: 0.88, slow: 0, trait: 'Keen: +15% damage, 12% faster' },
  tide: { name: 'Tide', adj: 'Abyssal', color: '#3FA8FF', dmg: 1.05, area: 1.25, cd: 1, slow: 0.45, trait: 'Undertow: +25% area, slows foes' },
  light: { name: 'Light', adj: 'Holy', color: '#FFF2B0', dmg: 1.12, area: 1.2, cd: 1, slow: 0, trait: 'Radiance: +20% area, +12% damage' },
  shadow: { name: 'Shadow', adj: 'Phantom', color: '#9B6BFF', dmg: 1.22, area: 1.08, cd: 1, slow: 0, trait: 'Dread: +22% damage, +8% area' },
  ki: { name: 'Ki', adj: 'Titan', color: '#FFB03A', dmg: 1.28, area: 1.05, cd: 1, slow: 0, trait: 'Overdrive: +28% damage' },
  time: { name: 'Time', adj: 'Eternal', color: '#9FE8FF', dmg: 1, area: 1, cd: 0.7, slow: 0.25, trait: 'Haste: casts 30% faster, slows foes' }
}
export const ART_ELEMENT: Record<ArtId, ElementId> = {
  ember: 'fire', fan: 'blade', tide: 'tide', lances: 'light', kunai: 'shadow', drums: 'thunder', fist: 'ki', stars: 'light',
  broadside: 'shadow', pillars: 'light', blacksun: 'fire', wheel: 'light', kiburst: 'ki', cannonade: 'shadow', cuts: 'blade',
  judgment: 'light', hellrain: 'fire', horizon: 'shadow', foxfire: 'fire', phantom: 'shadow', raijin: 'thunder', eyes: 'light',
  abyss: 'tide', sixarms: 'blade', timestop: 'time', wrath: 'ki', genesis: 'light', crown: 'light', flush: 'tide'
}
/** each essence also hands over most of its own power, so fusing never makes you weaker */
export const ESSENCE_ABSORB = 0.65
/** extra bonus by stars: ★ / ★★ / ★★★ */
export const FUSION_TIER_BONUS = [1, 1, 1.04, 1.08]
export type FusionStats = { dmg: number; area: number; cd: number; slow: number }
export function fusionStats(essences: ArtId[]): FusionStats {
  // element bonuses add up (three fire essences = +90% damage, not ×2.2)
  const f: FusionStats = { dmg: 1, area: 1, cd: 1, slow: 0 }
  for (const e of essences) {
    const el = ELEMENTS[ART_ELEMENT[e]]
    f.dmg += el.dmg - 1
    f.area += el.area - 1
    f.cd -= 1 - el.cd
    f.slow = Math.max(f.slow, el.slow)
  }
  f.dmg *= (1 + ESSENCE_ABSORB * essences.length) * FUSION_TIER_BONUS[Math.min(essences.length, MAX_ESSENCE)]
  f.area = Math.min(f.area, 1.6)
  f.cd = Math.max(f.cd, 0.5)
  return f
}
/** a recipe = the core plus the elements melted into it (server/src/fusion.ts builds the same key) */
export function recipeKey(core: ArtId, essences: ArtId[]) {
  return `${core}|${essences.map((e) => ART_ELEMENT[e]).sort().join('+')}`
}
export const RECIPE_REWARD_PER_STAR = 100
/** FUSION JACKPOTS: rolled on every fusion. The two arts become this instead of the recipe. */
export const DIVINE_CHANCE = 0.001
export const DUNG_CHANCE = 0.002
export type Jackpot = 'divine' | 'dung'
export const JACKPOT_ART: Record<Jackpot, ArtId> = { divine: 'crown', dung: 'flush' }
export const JACKPOT_KEY: Record<Jackpot, string> = { divine: 'DIVINE', dung: 'DUNG' }
export const isJackpotArt = (id: ArtId) => id === 'crown' || id === 'flush'
/** BOSS FURY: every fused star makes bosses hit harder and attack more often (fusing trades screen clutter for danger) */
export const FURY_PER_STAR = 0.07
export const FURY_MAX = 1.6
/** BOSS DREAD: while a Lv 250+ boss lives, regen / life-steal / kill-heals only work at this share (potions still heal in full) */
export const DREAD_HEAL = 0.12
export const DREAD_LVL = 250
/** Lv 250+ bosses also hit this much harder than before (before any fusion fury) */
export const DREAD_DMG = 1.3
/** APEX: from boss Lv 200 up, every level makes the boss tougher, harder-hitting, faster and longer to kill (keeps climbing to Lv 1111) */
export const APEX_LVL = 200
export function apex(lvl: number) {
  const t = Math.max(0, lvl - APEX_LVL)
  return {
    hp: 1 + t / 110, //   Lv300 ×1.9 · Lv500 ×3.7 · Lv1000 ×8.3 · Lv1111 ×9.3
    dmg: Math.min(2.4, 1 + t / 450), // Lv300 ×1.22 · Lv500 ×1.67 · Lv1000 ×2.4
    haste: Math.min(1.75, 1 + t / 800), // attacks come this much more often
    speed: Math.min(1.35, 1 + t / 1500),
    time: Math.min(2.6, 1 + t / 320), // minimum fight length multiplier (Lv500 ×1.9 · Lv1000 ×2.6)
  }
}
export function fusionName(core: ArtId, essences: ArtId[]): string {
  if (!essences.length) return ARTS[core].name
  const adjs: string[] = []
  for (const e of essences) {
    const a = ELEMENTS[ART_ELEMENT[e]].adj
    if (!adjs.includes(a)) adjs.push(a)
  }
  // three different elements read as one word, so names stay short
  const prefix = adjs.length >= 3 ? 'Prismatic' : adjs.join(' ')
  return `${prefix} ${ARTS[core].name} ${'★'.repeat(Math.min(essences.length, MAX_ESSENCE))}`
}

// ───────────── endless level-ups once every skill is maxed ─────────────
// 20 boons; each offer rolls a rarity that multiplies the effect (×1 common · ×2 rare · ×3 epic · ×5 legendary)
export type BoostId =
  | 'dmg' | 'hp' | 'area' | 'regen' | 'gold'
  | 'crit' | 'critdmg' | 'haste' | 'speed' | 'magnet' | 'xp' | 'armor' | 'artdmg' | 'bossdmg' | 'vamp' | 'execute' | 'greed' | 'potion' | 'reroll' | 'phoenix'
/** {n} in desc is replaced by the rolled amount */
export const BOOSTS: Record<BoostId, { name: string; desc: string; color: string; per: number; cap?: number }> = {
  dmg: { name: 'Rift Power', desc: '+{n}% all damage', color: '#FF5468', per: 8 },
  hp: { name: 'Rift Vigor', desc: '+{n} max HP and heal it', color: '#3DFF8E', per: 25 },
  area: { name: 'Rift Reach', desc: '+{n}% area (max +60%)', color: '#9FE8FF', per: 4, cap: 60 },
  regen: { name: 'Rift Bloom', desc: '+{n} HP regen / sec', color: '#FF7AC8', per: 0.5 },
  gold: { name: 'Rift Tithe', desc: '+{n} gold now', color: '#FFD86A', per: 30 },
  crit: { name: 'Keen Edge', desc: '+{n}% crit chance (max +40%)', color: '#FFE45A', per: 3, cap: 40 },
  critdmg: { name: 'Executioner\'s Eye', desc: '+{n}% crit damage (max +400%)', color: '#FF8A3D', per: 25, cap: 400 },
  haste: { name: 'Quickened Rift', desc: '-{n}% cooldowns (max -30%)', color: '#5EF2FF', per: 3, cap: 30 },
  speed: { name: 'Fleet Step', desc: '+{n}% move speed (max +40%)', color: '#FFFFFF', per: 4, cap: 40 },
  magnet: { name: 'Gravity Well', desc: '+{n}% pickup range', color: '#4AA8FF', per: 15 },
  xp: { name: 'Scholar\'s Rune', desc: '+{n}% XP (max +200%)', color: '#B9A8FF', per: 5, cap: 200 },
  armor: { name: 'Bastion', desc: '+{n} armor (max +10)', color: '#C9CFDA', per: 1, cap: 10 },
  artdmg: { name: 'Art Mastery', desc: '+{n}% damage of your ARTS (max +500%)', color: '#E8D28A', per: 12, cap: 500 },
  bossdmg: { name: 'Giantslayer', desc: '+{n}% damage to bosses & elites (max +300%)', color: '#FF2A3D', per: 10, cap: 300 },
  vamp: { name: 'Blood Pact', desc: 'every kill heals {n} HP (max 30)', color: '#C0182E', per: 0.4, cap: 30 },
  execute: { name: 'Reaper\'s Mark', desc: 'foes under {n}% HP die at once (not bosses, max 20%)', color: '#7A2AFF', per: 2, cap: 20 },
  greed: { name: 'Golden Hunger', desc: '+{n}% gold from everything (max +50%)', color: '#FFC83D', per: 4, cap: 50 },
  potion: { name: 'Alchemist\'s Gift', desc: '+{n} health potion (max 9)', color: '#FF4A6A', per: 1 },
  reroll: { name: 'Twist of Fate', desc: '+{n} reroll', color: '#8EC5FF', per: 1 },
  phoenix: { name: 'Ember of Rebirth', desc: 'a phoenix feather (revive once, max 1)', color: '#FF9A2A', per: 1, cap: 1 }
}
export const RARITY = [
  { name: 'COMMON', m: 1, w: 62, color: '#C9CFDA' },
  { name: 'RARE', m: 2, w: 26, color: '#4AA8FF' },
  { name: 'EPIC', m: 3, w: 10, color: '#B04BFF' },
  { name: 'LEGENDARY', m: 5, w: 2, color: '#FFD86A' }
]

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
export type CosmeticDef = { id: string; name: string; model?: string; anchor?: 'head' | 'hand_l' | 'hand_r' | 'feet' | 'over' | 'back'; title?: string; anim?: boolean }
export const COSMETICS: CosmeticDef[] = [
  { id: 'title_slayer', name: 'Reaper Slayer', title: 'Reaper Slayer' },
  { id: 'title_bane', name: "Death's Bane", title: "Death's Bane" },
  { id: 'lantern', name: 'Soul Lantern', model: 'models/cos_lantern.glb', anchor: 'hand_l' },
  { id: 'crown', name: 'Bone Crown', model: 'models/cos_crown.glb', anchor: 'head' },
  { id: 'hourglass', name: 'Hourglass of Ages', model: 'models/cos_hourglass.glb', anchor: 'over' },
  { id: 'shroud', name: "Reaper's Shroud", model: 'models/cos_shroud.glb', anchor: 'feet' },
  { id: 'scythe_skin', name: 'Scythe of the Pale Sovereign', model: 'models/cos_scythe.glb', anchor: 'hand_r' },
  // NIGHTSWARM slayers (Lv 200) and weekly champions
  { id: 'title_nightswarm', name: 'Nightswarm Slayer', title: '✦ NIGHTSWARM SLAYER ✦' },
  { id: 'void_wings', name: 'Void Wings', model: 'models/cos_void_wings.glb', anchor: 'back', anim: true },
  { id: 'title_champion', name: 'Weekly Champion', title: '♛ Weekly Champion' },
  // worn automatically while the Seraph Wings god power is active (not an item)
  { id: 'seraph_wings', name: 'Seraph Wings', model: 'models/cos_seraph_wings.glb', anchor: 'back', anim: true },
  // the ones who defeated THE ALMIGHTY (Lv 1111)
  { id: 'title_god', name: 'God', title: '✦ GOD ✦' },
  { id: 'god_skin', name: 'Divine Radiance', model: 'models/cos_god.glb', anchor: 'back', anim: true }
]
export const RAID_PARCEL = { x: -91, y: 71 }

// ═════════════ SOULBOUND PET ═════════════
// Tame one monster, then melt the souls of the monsters you hunt into it. Every soul makes it grow;
// each kind of soul gives its own trait, so no two pets end up alike. (server: server/src/pet.ts)
export const PET_KINDS = ['bat', 'ghoul', 'skeleton', 'wraith', 'slime', 'spider', 'imp', 'wisp', 'hound', 'brute'] as const
export type PetKind = (typeof PET_KINDS)[number]
/** one soul per this many kills of a kind (must match SOUL_EVERY on the server) */
export const SOUL_EVERY = 20
export type PetSave = { base: PetKind; mix: Partial<Record<PetKind, number>>; fed: number }
export const PET_INFO: Record<PetKind, { name: string; adj: string; color: string; trait: string }> = {
  bat: { name: 'Bat', adj: 'Vampiric', color: '#B04BFF', trait: 'faster bites · heals you a little' },
  ghoul: { name: 'Ghoul', adj: 'Rotting', color: '#7DFF5A', trait: 'poison bite that splashes' },
  skeleton: { name: 'Skeleton', adj: 'Bone', color: '#E8E2D0', trait: 'raw damage' },
  wraith: { name: 'Wraith', adj: 'Phantom', color: '#3FE6FF', trait: 'long reach' },
  slime: { name: 'Slime', adj: 'Gelatinous', color: '#4AF0A0', trait: 'big splash damage' },
  spider: { name: 'Spider', adj: 'Venom', color: '#9AFF3A', trait: 'webs slow enemies' },
  imp: { name: 'Imp', adj: 'Infernal', color: '#FF6A2A', trait: 'fire bolts hit a second foe' },
  wisp: { name: 'Wisp', adj: 'Radiant', color: '#FFF2A0', trait: 'critical hits' },
  hound: { name: 'Hound', adj: 'Feral', color: '#FF3B4E', trait: 'attacks faster · runs faster' },
  brute: { name: 'Brute', adj: 'Titanic', color: '#C9A27A', trait: 'heavy blows knock foes back' }
}
/** pet level from souls fed: Lv 1 → 10 needs ~300 souls, Lv 100 needs ~30 000 */
export const petLevel = (fed: number) => 1 + Math.floor(Math.sqrt(Math.max(0, fed) / 3))
/** grows from cub to colossus */
export const petScale = (lvl: number) => Math.min(6, 0.75 + 0.045 * (lvl - 1))
export function petShares(p: PetSave): [PetKind, number][] {
  const tot = Math.max(1, p.fed)
  return (Object.keys(p.mix) as PetKind[]).filter((k) => (p.mix[k] ?? 0) > 0).map((k) => [k, (p.mix[k] ?? 0) / tot] as [PetKind, number]).sort((a, b) => b[1] - a[1])
}
export function petName(p: PetSave) {
  const lv = petLevel(p.fed)
  const top = petShares(p).find(([k, f]) => k !== p.base && f >= 0.15)
  const size = lv >= 120 ? 'Colossal ' : lv >= 60 ? 'Giant ' : lv >= 25 ? 'Great ' : ''
  return `${size}${top ? PET_INFO[top[0]].adj + ' ' : ''}${PET_INFO[p.base].name}`
}
export type PetStats = {
  base: PetKind; lvl: number; scale: number; name: string; color: string
  dmg: number; rate: number; range: number; splash: number; slow: number; chain: number; vamp: number; crit: number; knock: number; speed: number
  shares: [PetKind, number][]
}
/** turn a saved pet into combat numbers (the base kind counts as a 40% share on top of what was fed) */
export function petStats(p: PetSave): PetStats {
  const lvl = petLevel(p.fed)
  const sh = new Map<PetKind, number>()
  for (const [k, f] of petShares(p)) sh.set(k, f * 0.6)
  sh.set(p.base, (sh.get(p.base) ?? 0) + 0.4)
  const f = (k: PetKind) => sh.get(k) ?? 0
  const top = [...sh.entries()].sort((a, b) => b[1] - a[1])
  return {
    base: p.base, lvl, scale: petScale(lvl), name: petName(p), color: PET_INFO[(top.find(([k]) => k !== p.base && k && (p.mix[k] ?? 0) > 0)?.[0]) ?? p.base].color,
    dmg: (1 + 0.06 * (lvl - 1)) * (1 + 1.2 * f('skeleton') + 0.8 * f('brute')),
    rate: 1.1 * (1 + 0.9 * f('bat') + 1.1 * f('hound')),
    range: 6 + 7 * f('wraith') + Math.min(4, lvl * 0.04),
    splash: 1.2 * f('ghoul') + 3.2 * f('slime') + Math.min(1.5, lvl * 0.01),
    slow: 2.5 * f('spider'),
    chain: f('imp') >= 0.12 ? 1 + (f('imp') >= 0.35 ? 1 : 0) : 0,
    vamp: 0.006 * f('bat'),
    crit: Math.min(0.6, 0.05 + 0.6 * f('wisp')),
    knock: 2 + 14 * f('brute'),
    speed: 6 + 6 * f('hound'),
    shares: petShares(p)
  }
}

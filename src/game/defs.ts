// Pure data: weapons, passives, enemies, evolutions. No Decentraland imports (used by the headless sim too).

export type WeaponId = 'lash' | 'bolt' | 'orbit' | 'aura' | 'thunder' | 'nova'
export type PassiveId = 'might' | 'haste' | 'expanse' | 'duplicator' | 'plating' | 'vitality' | 'bloodstone' | 'magnet' | 'swiftness' | 'fortune'
export type EnemyKind = 'bat' | 'ghoul' | 'skeleton' | 'wraith' | 'elite' | 'lich'

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
  lich: { hp: 3200, speed: 1.7, dmg: 35, xp: 120, r: 1.2, model: 'models/lich.glb', scale: 1.4, hover: 0 }
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
  return 245 + (lvl - 40) * 12
}

export const STARTERS: WeaponId[] = ['lash', 'bolt', 'orbit']

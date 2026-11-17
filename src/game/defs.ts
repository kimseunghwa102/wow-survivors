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
    name: 'Crimson Lash',
    evo: 'Blood Reaper',
    evoWith: 'might',
    color: '#FF3B4E',
    desc: ['Slashes in front of you', 'Also slashes behind', '+6 damage', '+20% width', '+6 damage', '+6 damage', '+20% width', '+10 damage']
  },
  bolt: {
    name: 'Arcane Bolt',
    evo: 'Arcane Storm',
    evoWith: 'duplicator',
    color: '#A26BFF',
    desc: ['Fires at the nearest foe', '+1 bolt', '+4 damage', '+1 bolt', '+4 damage', 'Bolts pierce', '+1 bolt', '+8 damage']
  },
  orbit: {
    name: 'Spirit Blades',
    evo: 'Blade Cyclone',
    evoWith: 'haste',
    color: '#5EF2FF',
    desc: ['A blade circles you', '+1 blade', '+4 damage', '+1 blade', '+25% speed', '+1 blade', '+4 damage', '+1 blade']
  },
  aura: {
    name: 'Holy Aura',
    evo: 'Soul Siphon',
    evoWith: 'vitality',
    color: '#FFD86A',
    desc: ['Damages foes around you', '+radius', '+2.5 damage', '+radius', '+2.5 damage', '+radius', '+2.5 damage', '+radius']
  },
  thunder: {
    name: 'Thunder Strike',
    evo: 'Wrath of Heaven',
    evoWith: 'expanse',
    color: '#9FE8FF',
    desc: ['Lightning hits random foes', '+1 strike', '+10 damage', '+1 strike', '+10 damage', '+1 strike', '+10 damage', '+1 strike']
  },
  nova: {
    name: 'Fire Nova',
    evo: 'Solar Flare',
    evoWith: 'plating',
    color: '#FF8A1E',
    desc: ['Explodes around you', '+radius', '+9 damage', '-10% cooldown', '+9 damage', '+radius', '+9 damage', '+radius']
  }
}

export const PASSIVES: Record<PassiveId, { name: string; desc: string; color: string }> = {
  might: { name: 'Might', desc: '+12% damage', color: '#FF5468' },
  haste: { name: 'Haste', desc: '-7% cooldowns', color: '#5EF2FF' },
  expanse: { name: 'Expanse', desc: '+10% area', color: '#9FE8FF' },
  duplicator: { name: 'Duplicator', desc: '+1 projectile / blade / strike (odd levels)', color: '#A26BFF' },
  plating: { name: 'Plating', desc: '+1 armor (less contact damage)', color: '#C9CFDA' },
  vitality: { name: 'Vitality', desc: '+20 max HP', color: '#3DFF8E' },
  bloodstone: { name: 'Bloodstone', desc: '+0.4 HP regen / sec', color: '#FF2A3D' },
  magnet: { name: 'Magnet', desc: '+35% pickup range', color: '#4AA8FF' },
  swiftness: { name: 'Swiftness', desc: '+8% move speed', color: '#FFFFFF' },
  fortune: { name: 'Fortune', desc: '+20% gold, luckier chests', color: '#FFD86A' }
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

// Shared numbers for THE PALE SOVEREIGN raid. Armory + gold packs mirror the castle (src/game/defs.ts);
// RAID / COSMETICS mirror the save server (server/src/raid.ts).

export const API_URL: string = (globalThis as any).__WOW_API__ ?? 'https://wow-survivors-api.onrender.com'
export const CASTLE = { x: -106, y: 76 }

export type ArmoryDef = { name: string; color: string; range: number; cd: number; gun?: boolean; god?: boolean }
export const ARMORY: ArmoryDef[] = [
  { name: 'Bare Fists', color: '#E8E2FF', range: 2.4, cd: 0.4 },
  { name: 'Frying Pan', color: '#FFB84A', range: 2.8, cd: 0.45 },
  { name: 'War Hammer', color: '#FFD86A', range: 3.1, cd: 0.7 },
  { name: 'Flame Sword', color: '#FF6A1E', range: 4.0, cd: 0.38 },
  { name: 'Reaper Blade', color: '#B07BFF', range: 4.9, cd: 0.4 },
  { name: 'Storm Minigun', color: '#7FE8FF', range: 18, cd: 0.07, gun: true },
  { name: 'Doomsday Nuke', color: '#FF3B2E', range: 18, cd: 0.07, gun: true }, // nuke tier: still fires the minigun, F = nuke
  { name: "Zeus' Atomic Thunder", color: '#FFE45A', range: 20, cd: 0.22 },
  { name: 'Divine Ascension', color: '#FFFFFF', range: 12, cd: 0.35, god: true }
]
export const NUKE_TIER = 6

/** must match server/src/raid.ts RAID */
export const RAID = {
  maxHp: 8_000_000,
  dps: [15, 60, 100, 320, 520, 850, 2200, 7800, 26500],
  nukeDps: 1333, // the part of a nuke-tier hunter's budget reserved for F
  burst: 45_000,
  levelScale: (lvl: number) => 1 + 0.02 * (Math.min(200, Math.max(1, lvl)) - 1)
}

export const BOSS = {
  name: 'THE PALE SOVEREIGN',
  title: 'Reaper of the Last Hour',
  home: { x: 8, z: 10 },
  radius: 2.6, // body hitbox
  model: 'models/reaper.glb'
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export const RARITY_COLOR: Record<Rarity, string> = { common: '#C9C3D6', rare: '#4FA8FF', epic: '#B07BFF', legendary: '#FFB000' }
export type CosmeticDef = { id: string; name: string; desc: string; rarity: Rarity; model?: string; anchor?: 'head' | 'hand_l' | 'hand_r' | 'feet' | 'over'; title?: string }
export const COSMETICS: CosmeticDef[] = [
  { id: 'title_slayer', name: 'Title: Reaper Slayer', desc: 'shown above your head in the castle', rarity: 'common', title: 'Reaper Slayer' },
  { id: 'title_bane', name: "Title: Death's Bane", desc: 'shown above your head in the castle', rarity: 'common', title: "Death's Bane" },
  { id: 'lantern', name: 'Soul Lantern', desc: 'a caged green soul swinging from your hand', rarity: 'rare', model: 'models/cos_lantern.glb', anchor: 'hand_l' },
  { id: 'crown', name: 'Bone Crown', desc: 'a crown of bone and blood-rubies', rarity: 'rare', model: 'models/cos_crown.glb', anchor: 'head' },
  { id: 'hourglass', name: 'Hourglass of Ages', desc: 'his hourglass, floating over you', rarity: 'epic', model: 'models/cos_hourglass.glb', anchor: 'over' },
  { id: 'shroud', name: "Reaper's Shroud", desc: 'tattered smoke and embers swirl around you', rarity: 'epic', model: 'models/cos_shroud.glb', anchor: 'feet' },
  { id: 'scythe_skin', name: 'Scythe of the Pale Sovereign', desc: 'LEGENDARY — carry his scythe', rarity: 'legendary', model: 'models/cos_scythe.glb', anchor: 'hand_r' }
]
export const cosmetic = (id: string | null | undefined) => COSMETICS.find((c) => c.id === id)

export const GOLD_PACKS = [
  { id: 'p5', usd: 5, gold: 5_000, bonus: 0, tag: '', img: 'images/pack_1.png' },
  { id: 'p10', usd: 10, gold: 10_000, bonus: 0, tag: 'POPULAR', img: 'images/pack_2.png' },
  { id: 'p25', usd: 25, gold: 27_500, bonus: 10, tag: '+10% BONUS', img: 'images/pack_3.png' },
  { id: 'p50', usd: 50, gold: 60_000, bonus: 20, tag: '+20% BONUS', img: 'images/pack_4.png' },
  { id: 'p100', usd: 100, gold: 130_000, bonus: 30, tag: 'BEST VALUE', img: 'images/pack_5.png' }
]
export const FIRST_BUY_BONUS = 0.5
export const MANA_TOKEN = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'

// Same save server & wallet identity as the castle: gold, armory, forge and cosmetics are shared.
import { signedFetch } from '~system/SignedFetch'
import { API_URL } from './defs'

export type Profile = {
  address: string
  name: string
  guest: boolean
  bank: number
  meta: { might: number; hp: number; magnet: number; xp: number }
  best: { time: number; level: number; kills: number }
  armory: number
  firstPurchase?: boolean
}
export type Inventory = { items: Record<string, number>; cosmetic: string | null; title: string | null }
export type RaidState = {
  day: string
  hp: number
  maxHp: number
  alive: boolean
  killedAt: number
  killer: string | null
  respawnAt: number
  started: number
  now: number
  top: { n: string; d: number }[]
  myDmg: number
  myLoot: { items: string[]; gold: number } | null
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
  const res = await signedFetch({
    url: API_URL + path,
    init: { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }
  })
  let json: any = {}
  try {
    json = JSON.parse(res.body || '{}')
  } catch {}
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export async function loadProfile(name: string) {
  const r = await call('POST', '/api/profile', { name })
  return { profile: r.profile as Profile, inv: (r.inv ?? { items: {}, cosmetic: null, title: null }) as Inventory }
}
export async function raidState(name: string) {
  const r = await call('POST', '/api/raid/state', { name })
  return { raid: r.raid as RaidState, inv: r.inv as Inventory }
}
export async function raidHit(dmg: number, name: string) {
  const r = await call('POST', '/api/raid/hit', { dmg: Math.floor(dmg), name })
  return r as { accepted: number; killed: boolean; raid: RaidState; inv?: Inventory }
}
export async function equipCosmetic(item: string | null) {
  const r = await call('POST', '/api/cosmetic/equip', { item })
  return r.inv as Inventory
}
export async function pingServer() {
  try {
    await fetch(API_URL + '/api/health')
  } catch {}
}

// gold shop (identical flow to the castle's Treasury)
export type GoldQuote = { id: string; pack: string; currency: 'ETH' | 'MANA'; to: string; amountWei: string; amount: number; gold: number; firstBonus: boolean; usd: number; expiresAt: number }
export async function shopConfig() {
  const res = await fetch(API_URL + '/api/shop/config')
  const r = await res.json()
  return { enabled: !!r.enabled, gold: r.gold ?? 10000, usd: r.usd ?? 10 }
}
export async function shopQuote(currency: 'ETH' | 'MANA', name: string, pack: string) {
  const r = await call('POST', '/api/shop/quote', { currency, name, pack })
  return r.quote as GoldQuote
}
export async function shopConfirm(quoteId: string, txHash: string) {
  // 'pending' comes back as 200, invalid/failed as 400 (throws with the server's reason)
  return (await call('POST', '/api/shop/confirm', { quoteId, txHash })) as { ok: boolean; status: string; gold?: number; profile?: Profile }
}

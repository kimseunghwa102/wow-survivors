// Save server client. Every request is signed by the player's wallet via signedFetch,
// so the server knows who they are without logins or PINs.
import { signedFetch } from '~system/SignedFetch'
import { API_URL } from '../config'
import type { RunSnap } from './core'

export type ServerProfile = {
  address: string
  name: string
  guest: boolean
  bank: number
  meta: { might: number; hp: number; magnet: number; xp: number }
  best: { time: number; level: number; kills: number }
  pvpKills: number
  totalRuns: number
  totalKills: number
  armory?: number
  daily?: { streak: number; claimable: boolean; next: number; doubleReady: boolean }
  firstPurchase?: boolean
}
export type BoardRow = { n: string; t: number; l: number; k: number; live?: boolean }
export type GlobalBoard = {
  runs: BoardRow[]; pvp: [string, number][]; players: number
  // live boards (players mid-run are merged in, flagged live)
  allTime?: BoardRow[]; weekly?: BoardRow[]; slayers?: string[]; live?: number; week?: string; weekEndsAt?: number; prizes?: number[]
}
export type Quest = { kind: string; tier: number; target: number; reward: number; text: string; progress: number; done: boolean; claimed: boolean }
export type QuestState = { day: string; resetsAt: number; quests: Quest[] }

export const save = {
  online: false,
  status: 'connecting…' as string,
  profile: null as ServerProfile | null,
  board: null as GlobalBoard | null,
  runId: '' as string,
  /** a run the player left mid-way (from /api/profile) */
  resume: null as null | { runId: string; snap: RunSnap },
  /** raid relics (cosmetic + title) */
  inv: { items: {}, cosmetic: null, title: null } as { items: Record<string, number>; cosmetic: string | null; title: string | null }
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
  if (!API_URL) throw new Error('no API_URL')
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

function offline(e: unknown) {
  save.online = false
  save.status = `offline — progress this session only (${String((e as any)?.message ?? e).slice(0, 60)})`
}

export async function loadProfile(name: string) {
  try {
    const r = await call('POST', '/api/profile', { name })
    save.profile = r.profile
    if (r.inv) save.inv = r.inv
    save.resume = r.resume && r.resume.snap && r.resume.snap.v === 1 ? r.resume : null
    save.online = true
    save.status = r.profile.guest ? 'guest — connect a wallet to keep progress everywhere' : 'progress saved to your wallet'
    return r.profile as ServerProfile
  } catch (e) {
    offline(e)
    return null
  }
}

export async function serverStartRun(weapon: string, name: string) {
  save.runId = ''
  if (!save.online) return
  try {
    const r = await call('POST', '/api/run/start', { weapon, name })
    save.runId = r.runId
  } catch (e) {
    console.log('run/start failed', e)
  }
}

export async function serverEndRun(result: { time: number; level: number; kills: number; gold: number; pvpKills: number; killer?: string; bossesSlain?: number }) {
  if (!save.online || !save.runId) return null
  const runId = save.runId
  save.runId = ''
  try {
    const r = await call('POST', '/api/run/end', { runId, ...result })
    save.profile = r.profile
    return r as { granted: number; paid?: number; bonus?: number; newBest: boolean; slayer?: boolean; rank: number; profile: ServerProfile; inv?: any }
  } catch (e) {
    console.log('run/end failed', e)
    return null
  }
}

export async function serverBuy(key: string) {
  const r = await call('POST', '/api/shop/buy', { key })
  save.profile = r.profile
  return r.profile as ServerProfile
}

export async function serverArmoryBuy(tier: number) {
  const r = await call('POST', '/api/armory/buy', { tier })
  save.profile = r.profile
  return r.profile as ServerProfile
}

export async function serverClaimDaily(name: string) {
  const r = await call('POST', '/api/daily/claim', { name })
  save.profile = r.profile
  return { reward: r.reward as number, profile: r.profile as ServerProfile }
}

export type GoldQuote = { id: string; pack: string; currency: 'ETH' | 'MANA'; to: string; token: string | null; amountWei: string; amount: number; gold: number; firstBonus: boolean; usd: number; expiresAt: number }

export async function shopConfig() {
  const r = await fetch(`${API_URL}/api/shop/config`)
  return (await r.json()) as { enabled: boolean; gold: number; usd: number; wallet: string | null }
}

export async function shopQuote(currency: 'ETH' | 'MANA', name: string, pack: string) {
  const r = await call('POST', '/api/shop/quote', { currency, name, pack })
  return r.quote as GoldQuote
}

export async function shopConfirm(quoteId: string, txHash: string) {
  // 'pending' comes back as 200, invalid/failed as 400 (call() throws with the server's error text)
  const r = await call('POST', '/api/shop/confirm', { quoteId, txHash })
  if (r.profile) save.profile = r.profile
  return r as { ok: boolean; status: string; gold?: number; error?: string; profile?: ServerProfile }
}

export async function loadBoard() {
  if (!API_URL) return
  try {
    const res = await fetch(API_URL + '/api/leaderboard')
    const j = await res.json()
    if (j.ok) save.board = j
  } catch {}
}

/** mid-run checkpoint so leaving the scene never loses skills or gold */
export async function serverSaveRun(snap: RunSnap) {
  if (!save.online || !save.runId) return null
  try {
    const r = await call('POST', '/api/run/save', { runId: save.runId, snap })
    if (r.profile) save.profile = r.profile
    return r as { ok: boolean; banked: number; slayer: boolean; profile: ServerProfile | null; inv?: any }
  } catch (e) {
    console.log('run/save failed', e)
    return null
  }
}

/** today's 3 quests (reset at midnight KST) */
export async function serverQuests() {
  if (!save.online) return null
  try {
    const r = await call('POST', '/api/quests', {})
    return r as QuestState
  } catch (e) {
    console.log('quests failed', e)
    return null
  }
}
export async function serverClaimQuest(i: number) {
  const r = await call('POST', '/api/quests/claim', { i })
  if (r.profile) save.profile = r.profile
  return r as QuestState & { reward: number; profile: ServerProfile | null }
}

/** bank a saved run instead of resuming it */
export async function serverAbandon() {
  const r = await call('POST', '/api/run/abandon', {})
  if (r.profile) save.profile = r.profile
  return r as { banked: number; profile: ServerProfile | null }
}

/** wake the (free-tier) save server and keep it awake while someone is in the scene */
export async function pingServer() {
  if (!API_URL) return
  try {
    await fetch(API_URL + '/api/health')
  } catch {}
}

/** public world-boss status for the gate sign */
export async function raidPublic() {
  const r = await fetch(API_URL + '/api/raid')
  const j = await r.json()
  return j.raid as { hp: number; maxHp: number; alive: boolean; killer: string | null; respawnAt: number; now: number; top: { n: string; d: number }[] }
}

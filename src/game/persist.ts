// Save server client. Every request is signed by the player's wallet via signedFetch,
// so the server knows who they are without logins or PINs.
import { signedFetch } from '~system/SignedFetch'
import { API_URL } from '../config'

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
}
export type GlobalBoard = { runs: { n: string; t: number; l: number; k: number }[]; pvp: [string, number][]; players: number }

export const save = {
  online: false,
  status: 'connecting…' as string,
  profile: null as ServerProfile | null,
  board: null as GlobalBoard | null,
  runId: '' as string
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

export async function serverEndRun(result: { time: number; level: number; kills: number; gold: number; pvpKills: number; killer?: string }) {
  if (!save.online || !save.runId) return null
  const runId = save.runId
  save.runId = ''
  try {
    const r = await call('POST', '/api/run/end', { runId, ...result })
    save.profile = r.profile
    return r as { granted: number; bonus?: number; newBest: boolean; rank: number; profile: ServerProfile }
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

export async function loadBoard() {
  if (!API_URL) return
  try {
    const res = await fetch(API_URL + '/api/leaderboard')
    const j = await res.json()
    if (j.ok) save.board = j
  } catch {}
}

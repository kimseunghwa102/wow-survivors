// End-to-end test: in-memory Postgres + REAL Decentraland-style signed requests (same crypto the explorer uses).
import { newDb } from 'pg-mem'
import type { AddressInfo } from 'net'
import { Authenticator } from '@dcl/crypto'
import { createUnsafeIdentity, ethSign } from '@dcl/crypto/dist/crypto'
import createAuthChainHeaders from '@dcl/platform-crypto-middleware/dist/createAuthChainHeader'
import { createPayload } from '@dcl/platform-crypto-middleware/dist/verify'
import { createApp, dclAuth } from '../src/app'
import { migrate } from '../src/db'

const assert = (c: any, m: string) => {
  if (!c) throw new Error('FAIL: ' + m)
  console.log('  ✓', m)
}

async function identity() {
  const owner = createUnsafeIdentity()
  const eph = createUnsafeIdentity()
  const id = await Authenticator.initializeAuthChain(owner.address, eph as any, 10, async (msg) =>
    ethSign(Buffer.from(owner.privateKey.replace(/^0x/, ''), 'hex'), msg)
  )
  return { owner, id }
}

async function main() {
  const mem = newDb()
  const { Pool } = mem.adapters.createPg()
  const db = new Pool()
  await migrate(db)
  const app = createApp(db, dclAuth({ allowedParcels: ['-106,76', '-105,77'] }))
  const server = app.listen(0)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const alice = await identity()
  const signed = async (who: typeof alice, method: string, path: string, body?: any, metaOverride?: any) => {
    const ts = Date.now()
    const metadata = JSON.stringify(metaOverride ?? { signer: 'decentraland-kernel-scene', parcel: '-106,76', isGuest: false, origin: 'https://play.decentraland.org' })
    const chain = Authenticator.signPayload(who.id, createPayload(method, path, String(ts), metadata))
    const headers = { ...createAuthChainHeaders(chain, ts, JSON.parse(metadata)), 'content-type': 'application/json' }
    const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, json: (await r.json()) as any }
  }

  console.log('auth')
  const unsigned = await fetch(base + '/api/profile', { method: 'POST' })
  assert(unsigned.status === 401 || unsigned.status === 400, 'unsigned request rejected')
  const p = await signed(alice, 'POST', '/api/profile', { name: 'Alice' })
  assert(p.status === 200 && p.json.profile.address === alice.owner.address.toLowerCase(), 'signed request → wallet address recognised')
  const wrongParcel = await signed(alice, 'POST', '/api/profile', {}, { signer: 'decentraland-kernel-scene', parcel: '10,10' })
  assert(wrongParcel.status === 400 || wrongParcel.status === 401, 'request from another scene/parcel rejected')

  console.log('run flow')
  const s1 = await signed(alice, 'POST', '/api/run/start', { weapon: 'orbit', name: 'Alice' })
  assert(s1.json.ok && s1.json.runId, 'run started')
  // backdate the run start by 10 minutes to simulate a real 10-minute run
  await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '600 seconds' WHERE id = $1`, [s1.json.runId])
  const e1 = await signed(alice, 'POST', '/api/run/end', { runId: s1.json.runId, time: 590, level: 31, kills: 2400, gold: 1500, pvpKills: 1 })
  assert(e1.json.ok && e1.json.granted === 1500, 'honest result fully credited (1500 gold)')
  assert(e1.json.newBest && e1.json.profile.best.time === 590, 'best time saved')
  const again = await signed(alice, 'POST', '/api/run/end', { runId: s1.json.runId, time: 590, gold: 1500 })
  assert(again.status === 404, 'same run cannot be claimed twice')

  console.log('anti-cheat')
  await new Promise((r) => setTimeout(r, 4200))
  const s2 = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  const e2 = await signed(alice, 'POST', '/api/run/end', { runId: s2.json.runId, time: 900, level: 99, kills: 99999, gold: 999999, pvpKills: 50 })
  assert(e2.json.granted <= 12 * 11, `instant "900s" run clamped (granted ${e2.json.granted})`)
  assert(e2.json.profile.best.time === 590, 'fake time did not replace best')
  const fast = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  assert(fast.status === 429, 'run spam rate-limited')

  console.log('shop')
  const bank0 = e2.json.profile.bank
  const b1 = await signed(alice, 'POST', '/api/shop/buy', { key: 'might' })
  assert(b1.json.ok && b1.json.profile.meta.might === 1 && b1.json.profile.bank === bank0 - 80, 'bought Power Lv1 for 80')
  const b2 = await signed(alice, 'POST', '/api/shop/buy', { key: 'might' })
  assert(b2.json.ok && b2.json.profile.bank === bank0 - 80 - 320, 'Power Lv2 cost 320')
  const bad = await signed(alice, 'POST', '/api/shop/buy', { key: 'godmode' })
  assert(bad.status === 400, 'unknown upgrade rejected')

  console.log('persistence + leaderboard')
  const again2 = await signed(alice, 'POST', '/api/profile', {})
  assert(again2.json.profile.meta.might === 2 && again2.json.profile.bank === b2.json.profile.bank, 'upgrades & gold persist across sessions')
  const lb = await (await fetch(base + '/api/leaderboard')).json()
  assert(lb.runs[0].n === 'Alice' && lb.runs[0].t === 590, 'global leaderboard lists best run')

  server.close()
  console.log('\nALL PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

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
  // fake chain for payment tests
  const OWNER = '0x' + 'ab'.repeat(20)
  const chain: Record<string, { tx: any; receipt: any }> = {}
  const rpc = async (method: string, params: any[]) => {
    if (method === 'eth_getTransactionByHash') return chain[params[0]]?.tx ?? null
    if (method === 'eth_getTransactionReceipt') return chain[params[0]]?.receipt ?? null
    if (method === 'eth_getBlockByNumber') return { timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) }
    throw new Error('unexpected ' + method)
  }
  const app = createApp(db, dclAuth({ allowedParcels: ['-106,76', '-105,77'] }), { wallet: OWNER, rpc, prices: async () => ({ ETH: 2500, MANA: 0.25 }) })
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
  assert(e1.json.ok && e1.json.granted === 3000 && e1.json.bonus === 1500, 'honest result credited + first run of the day doubled (3000 gold)')
  assert(e1.json.newBest && e1.json.profile.best.time === 590, 'best time saved')
  const again = await signed(alice, 'POST', '/api/run/end', { runId: s1.json.runId, time: 590, gold: 1500 })
  assert(again.status === 404, 'same run cannot be claimed twice')

  console.log('anti-cheat')
  await new Promise((r) => setTimeout(r, 4200))
  const s2 = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  const e2 = await signed(alice, 'POST', '/api/run/end', { runId: s2.json.runId, time: 900, level: 99, kills: 99999, gold: 999999, pvpKills: 50 })
  assert(e2.json.granted <= 25 * 11, `instant "900s" run clamped (granted ${e2.json.granted})`)
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

  console.log('daily + armory')
  const d0 = await signed(alice, 'POST', '/api/profile', {})
  assert(d0.json.profile.daily.claimable && d0.json.profile.daily.next === 100, 'daily reward claimable (100)')
  const d1 = await signed(alice, 'POST', '/api/daily/claim', {})
  assert(d1.json.ok && d1.json.reward === 100 && d1.json.profile.bank === d0.json.profile.bank + 100, 'daily claimed +100')
  const d2 = await signed(alice, 'POST', '/api/daily/claim', {})
  assert(d2.status === 400, 'cannot claim twice a day')
  // pretend yesterday was claimed with a 3-day streak → today continues to day 4
  await db.query("UPDATE players SET daily_last = $1, daily_streak = 3 WHERE address = $2", [new Date(Date.now() - 86400000).toISOString().slice(0, 10), alice.owner.address.toLowerCase()])
  const d3 = await signed(alice, 'POST', '/api/daily/claim', {})
  assert(d3.json.reward === 400 && d3.json.profile.daily.streak === 4, 'streak continues (day 4 = 400)')
  const skip = await signed(alice, 'POST', '/api/armory/buy', { tier: 2 })
  assert(skip.status === 400 && skip.json.profile.armory === 0, 'armory must be bought in order')
  const bankA = skip.json.profile.bank
  const a1 = await signed(alice, 'POST', '/api/armory/buy', { tier: 1 })
  assert(a1.json.ok && a1.json.profile.armory === 1 && a1.json.profile.bank === bankA - 200, 'bought Frying Pan for 200')
  const rich = await signed(alice, 'POST', '/api/armory/buy', { tier: 6 })
  assert(rich.status === 400, 'nuke not affordable / out of order')
  await db.query('UPDATE players SET bank = 0 WHERE address = $1', [alice.owner.address.toLowerCase()])
  const poor = await signed(alice, 'POST', '/api/armory/buy', { tier: 2 })
  assert(poor.status === 400 && poor.json.profile.armory === 1, 'not enough gold rejected')

  console.log('gold packs (ETH / MANA → owner wallet)')
  const cfg = await (await fetch(base + '/api/shop/config')).json()
  assert(cfg.enabled && cfg.gold === 10000 && cfg.usd === 10 && cfg.wallet === OWNER, 'shop config: 10,000 gold for $10 to the owner wallet')
  const bob = await identity()
  await signed(bob, 'POST', '/api/profile', {})
  const qe = await signed(bob, 'POST', '/api/shop/quote', { currency: 'ETH' })
  assert(qe.json.ok && qe.json.quote.amount === 0.004 && qe.json.quote.to === OWNER, 'ETH quote: $10 @ $2500 = 0.004 ETH')
  const bobAddr = bob.owner.address.toLowerCase()
  const h1 = '0x' + '11'.repeat(32)
  const pend = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(pend.json.status === 'pending', 'not mined yet → pending')
  chain[h1] = { tx: { from: bobAddr, to: OWNER, value: '0x' + BigInt(qe.json.quote.amountWei).toString(16) }, receipt: { blockNumber: '0x10', status: '0x1', logs: [] } }
  const pb0 = pend.json.profile.bank
  const ok1 = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(ok1.json.ok && ok1.json.profile.bank === pb0 + 10000, 'ETH payment verified on-chain → +10,000 gold')
  const again9 = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(again9.json.profile.bank === pb0 + 10000, 'confirming twice does not double-credit')
  const qe2 = await signed(bob, 'POST', '/api/shop/quote', { currency: 'ETH' })
  const reuse = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe2.json.quote.id, txHash: h1 })
  assert(reuse.status === 400, 'same tx cannot pay for a second pack')
  const h2 = '0x' + '22'.repeat(32)
  chain[h2] = { tx: { from: bobAddr, to: '0x' + 'cd'.repeat(20), value: '0x' + BigInt(qe2.json.quote.amountWei).toString(16) }, receipt: { blockNumber: '0x11', status: '0x1', logs: [] } }
  const wrong = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe2.json.quote.id, txHash: h2 })
  assert(wrong.status === 400, 'payment to another wallet is rejected')
  const h3 = '0x' + '33'.repeat(32)
  chain[h3] = { tx: { from: bobAddr, to: OWNER, value: '0x1' }, receipt: { blockNumber: '0x12', status: '0x1', logs: [] } }
  const small = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe2.json.quote.id, txHash: h3 })
  assert(small.status === 400, 'underpayment is rejected')
  const qm = await signed(bob, 'POST', '/api/shop/quote', { currency: 'MANA' })
  assert(qm.json.quote.amount === 40 && qm.json.quote.token === '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', 'MANA quote: $10 @ $0.25 = 40 MANA')
  const h4 = '0x' + '44'.repeat(32)
  const pad = (a: string) => '0x' + a.replace(/^0x/, '').padStart(64, '0')
  chain[h4] = {
    tx: { from: bobAddr, to: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', value: '0x0' },
    receipt: { blockNumber: '0x13', status: '0x1', logs: [{ address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad(bobAddr), pad(OWNER)], data: pad(BigInt(qm.json.quote.amountWei).toString(16)) }] }
  }
  const okm = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qm.json.quote.id, txHash: h4 })
  assert(okm.json.ok && okm.json.profile.bank === pb0 + 20000, 'MANA transfer verified from token logs → +10,000 gold')
  const stolen = await signed(alice, 'POST', '/api/shop/confirm', { quoteId: qm.json.quote.id, txHash: h4 })
  assert(stolen.status === 400, "someone else can't claim another player's quote / payment")

  console.log('persistence + leaderboard')
  const again2 = await signed(alice, 'POST', '/api/profile', {})
  assert(again2.json.profile.meta.might === 2 && again2.json.profile.armory === 1, 'upgrades & armory persist across sessions')
  const lb = await (await fetch(base + '/api/leaderboard')).json()
  assert(lb.runs[0].n === 'Alice' && lb.runs[0].t === 590, 'global leaderboard lists best run')

  server.close()
  console.log('\nALL PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

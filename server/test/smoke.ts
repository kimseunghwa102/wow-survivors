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

  console.log('checkpoint + resume')
  await new Promise((r) => setTimeout(r, 4200))
  const s3 = await signed(alice, 'POST', '/api/run/start', { weapon: 'lash' })
  await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '300 seconds' WHERE id = $1`, [s3.json.runId])
  const snap = { v: 1, time: 290, level: 20, kills: 500, gold: 800, pvpKills: 0, weapons: [['lash', 5]], passives: [['might', 2]] }
  const c1 = await signed(alice, 'POST', '/api/run/save', { runId: s3.json.runId, snap })
  assert(c1.status === 200 && c1.json.ok, 'mid-run checkpoint saved')
  const c2 = await signed(alice, 'POST', '/api/run/save', { runId: 'nope', snap })
  assert(c2.status === 404, 'checkpoint for unknown run rejected')
  const r1 = await signed(alice, 'POST', '/api/profile', {})
  assert(r1.json.resume?.runId === s3.json.runId && r1.json.resume.snap.level === 20 && r1.json.resume.snap.weapons[0][1] === 5, 'profile offers the saved run (skills intact)')
  const bankBefore = r1.json.profile.bank
  const ab = await signed(alice, 'POST', '/api/run/abandon', {})
  assert(ab.json.ok && ab.json.banked === 800 && ab.json.profile.bank === bankBefore + 800, 'abandoned run banks its checkpoint gold (800)')
  const r2 = await signed(alice, 'POST', '/api/profile', {})
  assert(!r2.json.resume, 'nothing to resume after banking')
  const ab2 = await signed(alice, 'POST', '/api/run/abandon', {})
  assert(ab2.json.banked === 0, 'cannot bank the same run twice')
  // leaving mid-run then starting a new run also banks the checkpoint (clamped by anti-cheat)
  await new Promise((r) => setTimeout(r, 4200))
  const s4 = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '60 seconds' WHERE id = $1`, [s4.json.runId])
  await signed(alice, 'POST', '/api/run/save', { runId: s4.json.runId, snap: { time: 55, level: 5, kills: 50, gold: 99999 } })
  await new Promise((r) => setTimeout(r, 4200))
  await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  const r3 = await signed(alice, 'POST', '/api/profile', {})
  const gained = r3.json.profile.bank - ab.json.profile.bank
  assert(gained > 0 && gained <= 25 * 72, `new run banks the left run, clamped (${gained})`)

  console.log('shop')
  const bank0 = r3.json.profile.bank
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
  assert(qe.json.ok && qe.json.quote.amount === 0.004 && qe.json.quote.to === OWNER && qe.json.quote.gold === 15000 && qe.json.quote.firstBonus, 'ETH quote: $10 @ $2500 = 0.004 ETH, first purchase +50% → 15,000 gold')
  const bobAddr = bob.owner.address.toLowerCase()
  const h1 = '0x' + '11'.repeat(32)
  const pend = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(pend.json.status === 'pending', 'not mined yet → pending')
  chain[h1] = { tx: { from: bobAddr, to: OWNER, value: '0x' + BigInt(qe.json.quote.amountWei).toString(16) }, receipt: { blockNumber: '0x10', status: '0x1', logs: [] } }
  const pb0 = pend.json.profile.bank
  const ok1 = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(ok1.json.ok && ok1.json.profile.bank === pb0 + 15000, 'ETH payment verified on-chain → +15,000 gold (first-buy bonus)')
  const again9 = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qe.json.quote.id, txHash: h1 })
  assert(again9.json.profile.bank === pb0 + 15000, 'confirming twice does not double-credit')
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
  const qm = await signed(bob, 'POST', '/api/shop/quote', { currency: 'MANA', pack: 'p100' })
  assert(qm.json.quote.amount === 400 && qm.json.quote.gold === 130000 && !qm.json.quote.firstBonus && qm.json.quote.token === '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', 'MANA quote: $100 pack @ $0.25 = 400 MANA → 130,000 gold (no repeat first-buy bonus)')
  const h4 = '0x' + '44'.repeat(32)
  const pad = (a: string) => '0x' + a.replace(/^0x/, '').padStart(64, '0')
  chain[h4] = {
    tx: { from: bobAddr, to: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', value: '0x0' },
    receipt: { blockNumber: '0x13', status: '0x1', logs: [{ address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad(bobAddr), pad(OWNER)], data: pad(BigInt(qm.json.quote.amountWei).toString(16)) }] }
  }
  const okm = await signed(bob, 'POST', '/api/shop/confirm', { quoteId: qm.json.quote.id, txHash: h4 })
  assert(okm.json.ok && okm.json.profile.bank === pb0 + 145000, 'MANA transfer verified from token logs → +130,000 gold')
  const stolen = await signed(alice, 'POST', '/api/shop/confirm', { quoteId: qm.json.quote.id, txHash: h4 })
  assert(stolen.status === 400, "someone else can't claim another player's quote / payment")


  console.log('persistence + leaderboard')
  const again2 = await signed(alice, 'POST', '/api/profile', {})
  assert(again2.json.profile.meta.might === 2 && again2.json.profile.armory === 1, 'upgrades & armory persist across sessions')
  const lb = await (await fetch(base + '/api/leaderboard')).json()
  assert(lb.runs[0].n === 'Alice' && lb.runs[0].t === 590, 'global leaderboard lists best run')

  console.log('raid: the pale sovereign')
  {
    const { rollItems, raidToday, RAID } = await import('../src/raid')
    const aliceAddr = alice.owner.address.toLowerCase()
    const pub = await (await fetch(base + '/api/raid')).json()
    assert(pub.raid.alive && pub.raid.hp === RAID.maxHp, 'public raid state: boss alive at full health')
    // a checkpoint stores the build that follows the hunter into the raid
    await new Promise((r) => setTimeout(r, 4200))
    const sb = await signed(alice, 'POST', '/api/run/start', { weapon: 'lash' })
    await signed(alice, 'POST', '/api/run/save', { runId: sb.json.runId, snap: { v: 1, time: 30, level: 40, kills: 10, gold: 5, weapons: [['lash', 8], ['thunder', 6]], passives: [['might', 3]], evolved: ['lash'] } })
    const pb = await signed(alice, 'POST', '/api/profile', {})
    assert(pb.json.inv.build && pb.json.inv.build.level === 40 && pb.json.inv.build.weapons[0][1] === 8 && pb.json.inv.build.evolved[0] === 'lash', 'last run build is exposed to the raid')
    const { skillDps, buildOf } = await import('../src/raid')
    assert(skillDps(buildOf(pb.json.inv.build)) > 500, 'build adds skill damage budget')
    await db.query('UPDATE players SET armory = 8, best_level = 100 WHERE address = $1', [aliceAddr])
    const h1 = await signed(alice, 'POST', '/api/raid/hit', { dmg: 1e9, name: 'Alice' })
    assert(h1.json.ok && h1.json.accepted > 0 && h1.json.accepted < 2_000_000, `huge claim clamped by armory/level budget (${h1.json.accepted})`)
    const h2 = await signed(alice, 'POST', '/api/raid/hit', { dmg: 1e9, name: 'Alice' })
    assert(h2.json.accepted < 30_000, `spam right after is near zero (${h2.json.accepted})`)
    await db.query(`UPDATE raid_dmg SET last_hit = NOW() - INTERVAL '10 seconds' WHERE address = $1`, [aliceAddr])
    const h3 = await signed(alice, 'POST', '/api/raid/hit', { dmg: 50_000, name: 'Alice' })
    assert(h3.json.accepted === 50_000 && h3.json.raid.myDmg >= 50_000, 'honest hit inside the budget is fully accepted')
    const st = await signed(bob, 'POST', '/api/raid/state', { name: 'Bob' })
    assert(st.json.raid.top[0].n === 'Alice' && st.json.raid.hp < RAID.maxHp, 'shared health pool + damage ranking visible to others')
    await signed(bob, 'POST', '/api/profile', { name: 'Bob' })
    await db.query(`UPDATE raid_dmg SET last_hit = NOW() - INTERVAL '10 seconds' WHERE address = $1`, [aliceAddr])
    await signed(bob, 'POST', '/api/raid/hit', { dmg: 50, name: 'Bob' })
    const bank0 = (await signed(alice, 'POST', '/api/profile', {})).json.profile.bank
    const day = (await raidToday(db)).day
    await db.query('UPDATE raid_days SET hp = 1000 WHERE day = $1', [day])
    const k = await signed(alice, 'POST', '/api/raid/hit', { dmg: 5000, name: 'Alice' })
    assert(k.json.killed && !k.json.raid.alive && k.json.raid.killer === 'Alice', 'killing blow ends the raid for everyone')
    assert(k.json.raid.myLoot && k.json.raid.myLoot.items.length >= 3 && k.json.raid.myLoot.gold >= RAID.goldMin, `loot: ${k.json.raid.myLoot.items.join(', ')} + ${k.json.raid.myLoot.gold} gold`)
    const bank1 = (await signed(alice, 'POST', '/api/profile', {})).json.profile.bank
    assert(bank1 === bank0 + k.json.raid.myLoot.gold, 'loot gold lands in the shared bank (main castle sees it)')
    const bs = await signed(bob, 'POST', '/api/raid/state', {})
    assert(!bs.json.raid.myLoot, 'a hunter below the 0.15% damage share gets no loot')
    const after = await signed(alice, 'POST', '/api/raid/hit', { dmg: 5000, name: 'Alice' })
    assert(after.json.accepted === 0, 'dead boss takes no more damage until midnight KST')
    const item = k.json.raid.myLoot.items.find((x: string) => !x.startsWith('title_')) || k.json.raid.myLoot.items[0]
    const eq = await signed(alice, 'POST', '/api/cosmetic/equip', { item })
    assert(eq.json.ok && (eq.json.inv.cosmetic === item || eq.json.inv.title === item), `equip owned cosmetic (${item})`)
    const bad = await signed(bob, 'POST', '/api/cosmetic/equip', { item: 'scythe_skin' })
    assert(bad.status === 400, 'cannot equip an item you do not own')
    const prof = await signed(alice, 'POST', '/api/profile', {})
    assert(prof.json.inv && (prof.json.inv.cosmetic === item || prof.json.inv.title === item), 'profile carries cosmetics to the main castle')
    const tomorrow = await raidToday(db, Date.now() + 86400e3)
    assert(Number(tomorrow.hp) === RAID.maxHp && !tomorrow.killed_at, 'next KST day: the reaper rises again at full health')
    let seq = 0
    const fixed = rollItems(5, () => [0.01, 0.999, 0.5, 0.75, 0.9][seq++])
    assert(fixed[0] === 'title_slayer' && fixed[1] === 'scythe_skin', 'loot table weights (legendary at the far tail)')
  }

  server.close()
  console.log('\nALL PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

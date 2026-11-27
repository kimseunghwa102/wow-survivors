// End-to-end test: in-memory Postgres + REAL Decentraland-style signed requests (same crypto the explorer uses).
import { newDb } from 'pg-mem'
import type { AddressInfo } from 'net'
import { Authenticator } from '@dcl/crypto'
import { createUnsafeIdentity, ethSign } from '@dcl/crypto/dist/crypto'
import createAuthChainHeaders from '@dcl/platform-crypto-middleware/dist/createAuthChainHeader'
import { createPayload } from '@dcl/platform-crypto-middleware/dist/verify'
import { createApp, dclAuth } from '../src/app'
import { migrate } from '../src/db'
import { startCasino, _test as casinoT } from '../src/casino/casino'
import WS from 'ws'

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
  assert(e2.json.granted <= 32 * 11, `instant "900s" run clamped (granted ${e2.json.granted})`)
  assert(e2.json.profile.best.time === 590, 'fake time did not replace best')
  const fast = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  assert(fast.status === 429, 'run spam rate-limited')

  console.log('checkpoint + resume')
  await new Promise((r) => setTimeout(r, 4200))
  const s3 = await signed(alice, 'POST', '/api/run/start', { weapon: 'lash' })
  await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '300 seconds' WHERE id = $1`, [s3.json.runId])
  const snap = { v: 1, time: 290, level: 20, kills: 500, gold: 800, pvpKills: 0, weapons: [['lash', 5]], passives: [['might', 2]] }
  const pre = (await signed(alice, 'POST', '/api/profile', {})).json.profile.bank
  const c1 = await signed(alice, 'POST', '/api/run/save', { runId: s3.json.runId, snap })
  assert(c1.status === 200 && c1.json.ok, 'mid-run checkpoint saved')
  assert(c1.json.banked === 800 && c1.json.profile.bank === pre + 800, 'LIVE GOLD: checkpoint banks the 800 gold immediately')
  const c1b = await signed(alice, 'POST', '/api/run/save', { runId: s3.json.runId, snap })
  assert(c1b.json.banked === 0 && c1b.json.profile.bank === pre + 800, 'same checkpoint twice banks nothing extra')
  const lbLive = await (await fetch(base + '/api/leaderboard')).json()
  assert(lbLive.weekly.some((r: any) => r.live && r.n === 'Alice') && lbLive.live === 1 && lbLive.allTime.some((r: any) => r.live), `LIVE RANKING: running hunter appears on weekly + all-time boards (${lbLive.live} live)`)
  const c2 = await signed(alice, 'POST', '/api/run/save', { runId: 'nope', snap })
  assert(c2.status === 404, 'checkpoint for unknown run rejected')
  const r1 = await signed(alice, 'POST', '/api/profile', {})
  assert(r1.json.resume?.runId === s3.json.runId && r1.json.resume.snap.level === 20 && r1.json.resume.snap.weapons[0][1] === 5, 'profile offers the saved run (skills intact)')
  const bankBefore = r1.json.profile.bank
  const ab = await signed(alice, 'POST', '/api/run/abandon', {})
  assert(ab.json.ok && ab.json.profile.bank === bankBefore + ab.json.banked && ab.json.banked === 0, 'abandoning adds nothing already banked live')
  const r2 = await signed(alice, 'POST', '/api/profile', {})
  assert(!r2.json.resume, 'nothing to resume after banking')
  const ab2 = await signed(alice, 'POST', '/api/run/abandon', {})
  assert(ab2.json.banked === 0, 'cannot bank the same run twice')
  // leaving mid-run then starting a new run also banks the checkpoint (clamped by anti-cheat)
  await new Promise((r) => setTimeout(r, 4200))
  const s4 = await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '60 seconds' WHERE id = $1`, [s4.json.runId])
  const cx = await signed(alice, 'POST', '/api/run/save', { runId: s4.json.runId, snap: { time: 55, level: 5, kills: 50, gold: 99999 } })
  assert(cx.json.banked > 0 && cx.json.banked <= 32 * 72, `live gold is still clamped by anti-cheat (${cx.json.banked})`)
  await new Promise((r) => setTimeout(r, 4200))
  await signed(alice, 'POST', '/api/run/start', { weapon: 'bolt' })
  const r3 = await signed(alice, 'POST', '/api/profile', {})
  const gained = r3.json.profile.bank - ab.json.profile.bank
  assert(gained > 0 && gained <= 32 * 72, `left run's gold stays banked, clamped (${gained})`)

  console.log('potion belt')
  {
    const b0 = (await signed(alice, 'POST', '/api/profile', {})).json.profile
    const p1 = await signed(alice, 'POST', '/api/potion/buy', { id: 'hp' })
    const p2 = await signed(alice, 'POST', '/api/potion/buy', { id: 'phoenix' })
    const p3 = await signed(alice, 'POST', '/api/potion/buy', { id: 'phoenix' })
    assert(p1.json.ok && p2.json.ok && p3.status === 400, 'buy potions; phoenix belt max 1')
    assert(p2.json.profile.bank === b0.bank - 150 - 2500 && p2.json.profile.belt.hp === 1 && p2.json.profile.belt.phoenix === 1, 'gold paid, belt filled')
    await new Promise((r) => setTimeout(r, 4200))
    const st = await signed(alice, 'POST', '/api/run/start', { weapon: 'lash' })
    assert(st.json.belt.hp === 1 && st.json.belt.phoenix === 1, 'run start packs the belt')
    const after = (await signed(alice, 'POST', '/api/profile', {})).json.profile
    assert(after.belt.hp === 0 && after.belt.phoenix === 0, 'belt is empty after packing (no duplicates)')
  }

  console.log('daily quests + NIGHTSWARM slayer')
  {
    const q0 = await signed(alice, 'POST', '/api/quests', {})
    assert(q0.json.quests.length === 3 && new Set(q0.json.quests.map((q: any) => q.kind)).size === 3, `3 different daily quests: ${q0.json.quests.map((q: any) => q.text).join(' | ')}`)
    const qs = q0.json.quests
    const bad0 = await signed(alice, 'POST', '/api/quests/claim', { i: 0 })
    assert(bad0.status === 400 || qs[0].done, 'cannot claim an unfinished quest')
    // a long honest run that slays NIGHTSWARM
    await new Promise((r) => setTimeout(r, 4200))
    const sr = await signed(alice, 'POST', '/api/run/start', { weapon: 'lash' })
    await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '1000 seconds' WHERE id = $1`, [sr.json.runId])
    const before = (await signed(alice, 'POST', '/api/profile', {})).json.profile.bank
    const sv = await signed(alice, 'POST', '/api/run/save', { runId: sr.json.runId, snap: { v: 1, time: 990, level: 205, kills: 14000, gold: 9000, bossesSlain: 23, weapons: [['lash', 8]], passives: [], evolved: [] } })
    assert(sv.json.slayer === true && sv.json.inv.items.title_nightswarm === 1 && sv.json.inv.items.void_wings === 1, 'NIGHTSWARM slain at Lv 200: title + Void Wings granted')
    assert(sv.json.profile.bank >= before + 100000, 'slayer bonus: +100,000 gold')
    const sv2 = await signed(alice, 'POST', '/api/run/save', { runId: sr.json.runId, snap: { v: 1, time: 995, level: 205, kills: 14100, gold: 9050, bossesSlain: 23 } })
    assert(sv2.json.slayer === false, 'slayer reward only once')
    const q1 = await signed(alice, 'POST', '/api/quests', {})
    assert(q1.json.quests.every((q: any) => q.done), 'that run completed all three quests')
    let got = bad0.json.reward || 0
    for (let i = 0; i < 3; i++) got += (await signed(alice, 'POST', '/api/quests/claim', { i })).json.reward || 0
    assert(got === 600 + 1200 + 2500, `quest rewards claimed (${got})`)
    const again = await signed(alice, 'POST', '/api/quests/claim', { i: 2 })
    assert(again.status === 400, 'quest reward only once')
    const board = await (await fetch(base + '/api/leaderboard')).json()
    assert(board.slayers.includes(alice.name) || board.slayers.length === 1, 'Hall of Slayers lists the slayer')
  }

  console.log('THE ALMIGHTY: the one who beats God becomes God')
  {
    const gabe = await identity()
    await signed(gabe, 'POST', '/api/profile', { name: 'Gabriel' })
    const gr = await signed(gabe, 'POST', '/api/run/start', { weapon: 'lash' })
    await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '70000 seconds' WHERE id = $1`, [gr.json.runId])
    const snap = (time: number, level: number, bossesSlain: number) => ({ runId: gr.json.runId, snap: { v: 1, time, level, kills: Math.floor(time * 15), gold: Math.floor(time * 12), bossesSlain, weapons: [['lash', 8]], passives: [], evolved: [] } })
    const early = await signed(gabe, 'POST', '/api/run/save', snap(7200, 1111, 43))
    assert(early.json.ok && early.json.god === false && !early.json.profile.god, 'Lv 1111 after only 2 h is not believed')
    const short = await signed(gabe, 'POST', '/api/run/save', snap(66000, 1111, 42))
    assert(short.json.god === false, 'one boss short of the whole ladder → not God')
    const g = await signed(gabe, 'POST', '/api/run/save', snap(66050, 1111, 43))
    assert(g.json.god === true && g.json.inv.items.title_god === 1 && g.json.inv.items.god_skin === 1, 'THE ALMIGHTY slain at Lv 1111 after 18 h: God skin + title granted')
    assert(g.json.inv.cosmetic === 'god_skin' && g.json.inv.title === 'title_god' && g.json.profile.god === true, 'worn at once; profile says God (every run starts as God)')
    const g2 = await signed(gabe, 'POST', '/api/run/save', snap(66100, 1112, 43))
    assert(g2.json.god === false, 'godhood is granted once')
    const board = await (await fetch(base + '/api/leaderboard')).json()
    assert(Array.isArray(board.gods) && board.gods.length === 1, 'Hall of Gods lists the new God')
    assert(board.firstGod && board.firstGod.name === 'Gabriel' && /^0x/.test(board.firstGod.address), 'WHO IS GOD?: the first God is named for the throne')
    // a rich deep run: gold far over the cap is clamped, but it does not cancel godhood
    const rich = await identity()
    await signed(rich, 'POST', '/api/profile', { name: 'Midas' })
    const rr = await signed(rich, 'POST', '/api/run/start', { weapon: 'lash' })
    await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '70000 seconds' WHERE id = $1`, [rr.json.runId])
    const rg = await signed(rich, 'POST', '/api/run/save', { runId: rr.json.runId, snap: { v: 1, time: 66000, level: 1150, kills: 900000, gold: 66000 * 200, bossesSlain: 43, weapons: [['lash', 8]], passives: [], evolved: [] } })
    assert(rg.json.god === true, 'a gold over-claim alone does not cancel a real God kill')
    // catch-up: a run that met every rule before the fix (stored, no grant) is granted on the next board read, dated by the run
    const late = await identity()
    await signed(late, 'POST', '/api/profile', { name: 'Paul' })
    const lr = await signed(late, 'POST', '/api/run/start', { weapon: 'lash' })
    await db.query(`UPDATE runs SET level = 1183, bosses = 43, time_sec = 25982, checkpoint_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [lr.json.runId])
    const { grantMissedGods } = await import('../src/progress')
    await grantMissedGods(db)
    const pg = (await db.query(`SELECT god_at FROM players WHERE address = $1`, [late.owner.address.toLowerCase()])).rows[0]
    assert(pg && pg.god_at, 'catch-up grants a God the live check missed')
    const b2 = await (await fetch(base + '/api/leaderboard')).json()
    assert(b2.firstGod.name === 'Paul', 'the earliest God (by when their run was saved) takes the throne')
    const end = await signed(gabe, 'POST', '/api/run/end', { runId: gr.json.runId, time: 66200, level: 1113, kills: 993000, gold: 794000, bossesSlain: 43 })
    assert(end.json.ok && end.json.god === false && end.json.profile.god === true && end.json.profile.best.time === 66200, 'an 18 h run ends cleanly (no longer cut at 3 h)')
  }

  console.log('fusion recipe book')
  {
    const fay = await identity()
    await signed(fay, 'POST', '/api/profile', { name: 'Fay' })
    const fr = await signed(fay, 'POST', '/api/run/start', { weapon: 'lash' })
    const snapAt = (time: number, level: number) => ({ v: 1, time, level, kills: Math.floor(time * 15), gold: Math.floor(time * 12), bossesSlain: 10, weapons: [['lash', 8]], passives: [], evolved: [] })
    const early = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'tide', essences: ['ember'], snap: snapAt(30, 260) })
    assert(early.status === 400, 'Lv 260 after 30 s is not believed → no fusion reward')
    await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '3000 seconds' WHERE id = $1`, [fr.json.runId])
    const cp = await signed(fay, 'POST', '/api/run/save', { runId: fr.json.runId, snap: snapAt(2900, 260) })
    const bank0 = cp.json.profile.bank
    const f1 = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'tide', essences: ['ember'] })
    assert(f1.json.ok && f1.json.isNew && f1.json.reward === 100 && f1.json.key === 'tide|fire', 'new recipe saved: Infernal Tidal Rings ★ (+100)')
    assert(f1.json.profile.bank === bank0 + 100 && f1.json.profile.codex.includes('tide|fire'), 'gold banked, recipe in the profile book')
    const f2 = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'tide', essences: ['hellrain'] })
    assert(f2.json.ok && !f2.json.isNew && f2.json.reward === 0, 'same core + same element = same recipe, no second reward')
    const f3 = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'tide', essences: ['ember', 'drums'] })
    assert(f3.json.isNew && f3.json.reward === 200 && f3.json.codex.length === 2, 'a ★★ mix is a new recipe (+200)')
    const bad = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'tide', essences: ['tide'] })
    assert(bad.status === 400, 'an art cannot melt into itself')
    const bad2 = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'godmode', essences: ['ember'] })
    assert(bad2.status === 400, 'unknown art rejected')
    const dv = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'crown', essences: [], jackpot: 'divine' })
    assert(dv.json.isNew && dv.json.reward === 3000 && dv.json.codex.includes('DIVINE'), 'DIVINE FUSION saved (+3000, once)')
    const dv2 = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'crown', essences: [], jackpot: 'divine' })
    assert(!dv2.json.isNew && dv2.json.reward === 0, 'the divine reward is paid only once per account')
    const dg = await signed(fay, 'POST', '/api/fusion', { runId: fr.json.runId, core: 'flush', essences: [], jackpot: 'dung' })
    assert(dg.json.isNew && dg.json.reward === 500 && dg.json.codex.includes('DUNG'), 'ROYAL FLUSH saved (+500 consolation)')
  }

  console.log('soulbound pet')
  {
    const pip = await identity()
    await signed(pip, 'POST', '/api/profile', { name: 'Pip' })
    const none = await signed(pip, 'POST', '/api/pet/feed', { kind: 'bat', n: 1 })
    assert(none.status === 400, 'no pet yet → cannot feed')
    const bad = await signed(pip, 'POST', '/api/pet/tame', { kind: 'dragon' })
    assert(bad.status === 400, 'only hunted monsters can be tamed')
    const t = await signed(pip, 'POST', '/api/pet/tame', { kind: 'slime' })
    assert(t.json.ok && t.json.profile.pet.base === 'slime' && t.json.profile.pet.fed === 0, 'tamed a slime')
    const t2 = await signed(pip, 'POST', '/api/pet/tame', { kind: 'bat' })
    assert(t2.status === 400, 'one pet per hunter')
    const pr = await signed(pip, 'POST', '/api/run/start', { weapon: 'lash' })
    await db.query(`UPDATE runs SET started_at = NOW() - INTERVAL '600 seconds' WHERE id = $1`, [pr.json.runId])
    // 600 s × ≤20 kills/s → at most 12050 kills → 602 souls; the hunter claims far more
    const sv = await signed(pip, 'POST', '/api/run/save', { runId: pr.json.runId, snap: { v: 1, time: 590, level: 80, kills: 2000, gold: 100, souls: { bat: 60, imp: 40, dragon: 999 } } })
    assert(sv.json.profile.souls.bat === 60 && sv.json.profile.souls.imp === 40 && !sv.json.profile.souls.dragon, 'souls banked (2000 kills → 100 souls, unknown kinds dropped)')
    const sv2 = await signed(pip, 'POST', '/api/run/save', { runId: pr.json.runId, snap: { v: 1, time: 595, level: 80, kills: 2000, gold: 100, souls: { bat: 60, imp: 40 } } })
    assert(sv2.json.profile.souls.bat === 60, 'the same souls are not banked twice')
    const greedy = await signed(pip, 'POST', '/api/run/end', { runId: pr.json.runId, time: 599, level: 80, kills: 2200, gold: 100, souls: { bat: 5000, imp: 40 } })
    const s3 = greedy.json.profile.souls
    assert(s3.bat + s3.imp === 110, 'souls never exceed kills / 20 (2200 kills → 110)')
    const f = await signed(pip, 'POST', '/api/pet/feed', { kind: 'imp', n: 30 })
    assert(f.json.ok && f.json.profile.pet.mix.imp === 30 && f.json.profile.pet.fed === 30 && f.json.profile.souls.imp === s3.imp - 30, 'fed 30 imp souls into the slime')
    const over = await signed(pip, 'POST', '/api/pet/feed', { kind: 'imp', n: 9999 })
    assert(over.status === 400, 'cannot feed souls you do not have')
    const rel = await signed(pip, 'POST', '/api/pet/release', {})
    assert(rel.json.ok && rel.json.profile.pet === null, 'set free → can tame again')
  }

  console.log('arena relay')
  {
    const { relay, _testClient, _testDrop } = await import('../src/arena')
    const tk = await signed(alice, 'POST', '/api/arena/ticket', {})
    assert(tk.json.ok && typeof tk.json.ticket === 'string', 'signed hunters get a relay ticket')
    const outA: string[] = []
    const outB: string[] = []
    const A = _testClient('0xAAA', outA)
    const B = _testClient('0xBBB', outB)
    relay(A, JSON.stringify({ k: 'fx', d: { id: '0xEVIL', a: [1, 2, 3], e: [[29, 1, 2, 3, 0.5, 7]] } }))
    assert(outB.length === 1 && JSON.parse(outB[0]).d.id === '0xaaa' && outA.length === 0, 'effects reach the others, stamped with the real sender (spoofed id replaced)')
    relay(A, JSON.stringify({ k: 'hit', d: { to: '0xccc', from: '0xEVIL', dmg: 50 } }))
    assert(outB.length === 1, 'a PvP hit goes only to its target')
    relay(A, JSON.stringify({ k: 'hit', d: { to: '0xBBB', from: '0xEVIL', dmg: 50 } }))
    assert(outB.length === 2 && JSON.parse(outB[1]).d.from === '0xaaa', 'the hit arrives from the real attacker')
    relay(A, JSON.stringify({ k: 'drop-table', d: {} }))
    assert(outB.length === 2, 'unknown kinds are dropped')
    let sent = 0
    for (let i = 0; i < 100; i++) sent += relay(A, JSON.stringify({ k: 'st', d: { l: i } }))
    assert(sent < 40, 'flooding is rate-limited')
    _testDrop(A)
    _testDrop(B)
  }

  console.log('shop')
  const bank0 = (await signed(alice, 'POST', '/api/profile', {})).json.profile.bank
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
  assert(lb.runs.some((r: any) => r.n === 'Alice' && r.t === 590), 'global leaderboard lists best run')

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

  console.log('gold casino (hold\'em with WOW gold)')
  {
    process.env.CASINO_NEXT_MS = '50'
    await startCasino(server as any, db)
    casinoT.CASINO.nextHandMs = 50
    const tableClient = async (who: typeof alice) => {
      const t = await signed(who, 'POST', '/casino/ticket', { name: 'x' })
      const ws = new WS(base.replace('http', 'ws') + '/casino?t=' + t.json.ticket)
      let id = 0
      const acks = new Map<number, (d: any) => void>()
      let view: any = null
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw))
        if (m.a != null) acks.get(m.a)?.(m.d)
        else if (m.e === 'state') view = m.d
      })
      await new Promise((r) => ws.on('open', r))
      const call = (e: string, d: any = {}) => new Promise<any>((res) => { const i = ++id; acks.set(i, res); ws.send(JSON.stringify({ e, d, id: i })) })
      return { ws, call, view: () => view }
    }
    const goldOf = async (a: string) => (await db.query('SELECT bank, casino_stack FROM players WHERE address = $1', [a])).rows[0]
    const aA = alice.owner.address.toLowerCase(), bA = bob.owner.address.toLowerCase()
    const before = Number((await goldOf(aA)).bank) + Number((await goldOf(bA)).bank)
    const bad = await fetch(base.replace('http', 'ws').replace('ws:', 'http:') + '/casino/health')
    assert(bad.status === 200, 'casino health endpoint')
    const A = await tableClient(alice)
    const B = await tableClient(bob)
    assert((await A.call('dcl:join', { name: 'Alice' })).ok && (await B.call('dcl:join', { name: 'Bob' })).ok, 'wallet login only (no nickname/PIN)')
    assert(!(await A.call('login', { name: 'x', pin: '1234' })).ok, 'nickname/PIN accounts are refused')
    casinoT.S.cfg.ai = false
    await A.call('stand')
    await db.query('UPDATE players SET bank = 300 WHERE address = $1', [bA])
    const poor = await B.call('sit', { seat: 1 })
    assert(!poor.ok, 'cannot sit with less than the minimum buy-in')
    await db.query('UPDATE players SET bank = 8000 WHERE address = $1', [bA])
    await db.query('UPDATE players SET bank = 8000 WHERE address = $1', [aA])
    const s1 = await A.call('sit', { seat: 0 })
    const s2 = await B.call('sit', { seat: 1 })
    assert(s1.ok && s2.ok && s1.buyIn === 8000, 'buy-in = the whole bank (8,000) moves onto the table')
    const ga = await goldOf(aA)
    assert(Number(ga.bank) === 0 && Number(ga.casino_stack) === 8000, 'escrow: bank 0 + table 8,000')
    // play some hands: whoever is to act calls (or checks)
    for (let k = 0; k < 400; k++) {
      await new Promise((r) => setTimeout(r, 10))
      for (const c of [A, B]) {
        const v = c.view()
        const h = v?.hand
        if (h && !h.over && h.opts) await c.call('act', { type: k % 7 === 0 ? 'raise' : 'call', to: h.opts.minTo, no: h.no })
      }
      if ((A.view()?.handNo ?? 0) >= 6 && A.view()?.hand?.over) break
    }
    const hands = A.view().handNo
    assert(hands >= 3, `${hands} hands played for gold`)
    await new Promise((r) => setTimeout(r, 200))
    await A.call('stand')
    await B.call('stand')
    await new Promise((r) => setTimeout(r, 200))
    const fa = await goldOf(aA), fb = await goldOf(bA)
    assert(Number(fa.casino_stack) === 0 && Number(fb.casino_stack) === 0, 'standing up cashes the stack back to the bank')
    assert(Number(fa.bank) + Number(fb.bank) === 16000, `gold is conserved between hunters (${fa.bank} + ${fb.bank} = 16,000) — they took it from each other`)
    const r = (await db.query('SELECT casino_net, casino_hands FROM players WHERE address = $1', [aA])).rows[0]
    assert(Number(r.casino_hands) >= 3 && Number(r.casino_net) === Number(fa.bank) - 8000, `net booked (${r.casino_net})`)
    A.ws.close()
    B.ws.close()
    void before
  }

  server.close()
  console.log('\nALL PASSED')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

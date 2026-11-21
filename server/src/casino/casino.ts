// GOLD HOLD'EM — the casino table of WOW NIGHTSWARM.
// Same rules/engine as GYBM Hold'em, but the chips ARE the hunters' WOW gold:
//   sit  → a buy-in moves gold from the bank into the table (players.casino_stack = escrow)
//   hand → stacks are written back after every hand (a crash refunds the last saved stack)
//   stand / disconnect → the stack goes back to the bank
// Only Decentraland wallets (no guests, no nickname/PIN accounts). One table, 5 seats, AI "Alpha" is the house.
// Scenes: WOW casino at -103,78 and the GYBM casino at -76,-48 play the same table.
// Protocol (same as the GYBM scene client): POST /casino/ticket (signedFetch) → WS /casino?t=ticket,
// client → {e, d, id}, server → {e, d} or ack {a: id, d}.
import crypto from 'crypto'
import type { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import type { Sql } from '../db'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const E: any = require('./engine')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AI: any = require('./ai')

export const CASINO_SCHEMA = `
ALTER TABLE players ADD COLUMN IF NOT EXISTS casino_stack INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS casino_net INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS casino_hands INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS casino_won INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS casino_best INTEGER NOT NULL DEFAULT 0`

export const CASINO = {
  sb: 25,
  bb: 50,
  minBuyIn: 500,
  maxBuyIn: 5000,
  turnSecs: 30,
  aiStack: 5000,
  offlineStandMs: Number(process.env.CASINO_OFFLINE_MS || 90_000),
  nextHandMs: Number(process.env.CASINO_NEXT_MS || 6000)
}
const AI_KEY: string = AI.KEY

type P = {
  name: string
  chips: number
  bank: number
  seat: number | null
  away?: boolean
  busts: number
  handsPlayed: number
  handsWon: number
  bestPot: number
  invested: number
  net: number
}
type Sock = { data: { key: string | null; addr: string; name: string }; emit: (e: string, d?: any) => void; ws: WebSocket; alive: boolean }

const S: any = { cfg: { start: 0, sb: CASINO.sb, bb: CASINO.bb, turnSecs: CASINO.turnSecs, ai: true }, players: {} as Record<string, P>, seats: Array(E.SEATS).fill(null), button: -1, handNo: 0, hand: null, nextAt: 0 }
const RT = new Map<string, { sock: Sock | null; lastSeen: number; timeouts: number }>()
const rt = (k: string) => {
  let r = RT.get(k)
  if (!r) RT.set(k, (r = { sock: null, lastSeen: 0, timeouts: 0 }))
  return r
}
const clients = new Set<Sock>()
const tickets = new Map<string, { addr: string; exp: number }>()
let db: Sql
let rank: any[] = []

// ───────────── gold (the WOW bank) ─────────────
// all writes for one wallet run in order
const chains = new Map<string, Promise<unknown>>()
function serial<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  chains.set(key, next.catch(() => undefined))
  return next
}
async function readBank(addr: string) {
  const r = (await db.query('SELECT bank, name FROM players WHERE address = $1', [addr])).rows[0]
  return r ? { bank: Number(r.bank), name: String(r.name) } : null
}
/** moves `amount` gold from the bank onto the table; returns the amount moved (0 = not enough gold) */
function buyIn(addr: string, amount: number) {
  return serial(addr, async () => {
    const r = await db.query('UPDATE players SET bank = bank - $1::integer, casino_stack = casino_stack + $1::integer, updated_at = NOW() WHERE address = $2 AND bank >= $3::integer', [amount, addr, amount])
    return (r.rowCount ?? 0) > 0 ? amount : 0
  })
}
/** writes the current table stack (escrow) after a hand */
function saveStack(addr: string, stack: number, delta: number, won: boolean, pot: number) {
  return serial(addr, async () => {
    await db.query(
      'UPDATE players SET casino_stack = $1::integer, casino_net = casino_net + $2::integer, casino_hands = casino_hands + 1, casino_won = casino_won + $3::integer, casino_best = GREATEST(casino_best, $4::integer) WHERE address = $5',
      [Math.max(0, Math.floor(stack)), Math.floor(delta), won ? 1 : 0, Math.floor(pot), addr]
    )
  })
}
/** the whole escrow goes back to the bank */
function cashOut(addr: string) {
  return serial(addr, async () => {
    await db.query('UPDATE players SET bank = bank + casino_stack, casino_stack = 0, updated_at = NOW() WHERE address = $1 AND casino_stack > 0', [addr])
  })
}
async function refreshRank() {
  const rows = (await db.query('SELECT address, name, bank, casino_stack, casino_net, casino_hands, casino_won, casino_best FROM players WHERE casino_hands > 0 ORDER BY casino_net DESC LIMIT 10')).rows
  rank = rows.map((r: any) => ({
    name: r.name,
    chips: Number(r.bank) + Number(r.casino_stack),
    net: Number(r.casino_net),
    handsWon: Number(r.casino_won),
    handsPlayed: Number(r.casino_hands),
    bestPot: Number(r.casino_best),
    online: !!rt(r.address).sock,
    seated: S.players[r.address]?.seat != null
  }))
}

// ───────────── table flow (same as GYBM Hold'em) ─────────────
let turnT: NodeJS.Timeout | null = null
let nextT: NodeJS.Timeout | null = null
let aiPlan: any = null
const atTable = (k: string) => k === AI_KEY || !!rt(k).sock
function armTurn() {
  if (turnT) clearTimeout(turnT)
  turnT = null
  const h = S.hand
  if (!h || h.over || h.toAct < 0) return
  if (h.ps[h.toAct].pid === AI_KEY) return armAiTurn(h)
  const key = h.ps[h.toAct].pid
  const ms = (atTable(key) ? S.cfg.turnSecs : Math.min(8, S.cfg.turnSecs)) * 1000
  h.deadline = h.turnAt + ms
  const no = h.no, seat = h.toAct, at = h.turnAt
  turnT = setTimeout(() => {
    const x = S.hand
    if (!x || x.no !== no || x.over || x.toAct !== seat || x.turnAt !== at) return
    const r = rt(key)
    r.timeouts++
    E.doAction(S, seat, 'auto')
    if (r.timeouts >= 2 && S.players[key]) S.players[key].away = true
    changed()
  }, Math.max(0, h.deadline - Date.now()))
}
function armAiTurn(h: any) {
  const no = h.no, seat = h.toAct, at = h.turnAt, id = `${no}-${seat}-${at}`
  h.deadline = at + S.cfg.turnSecs * 1000
  if (!aiPlan || aiPlan.id !== id) {
    let mv
    try {
      mv = AI.decide(S, seat)
    } catch {
      mv = { type: 'call' }
    }
    aiPlan = { id, mv, actAt: at + AI.thinkMs(S, seat, mv) }
  }
  turnT = setTimeout(() => {
    const x = S.hand
    if (!x || x.no !== no || x.over || x.toAct !== seat || x.turnAt !== at) return
    const { mv } = aiPlan
    if (!E.doAction(S, seat, mv.type, mv.to) && !E.doAction(S, seat, 'call')) E.doAction(S, seat, 'auto')
    changed()
  }, Math.max(0, aiPlan.actAt - Date.now()))
}
// the house AI keeps a solo hunter company; makes room when a 4th human sits; its stack is house money
function aiTick() {
  let p = S.players[AI_KEY]
  if (!p) p = S.players[AI_KEY] = { name: AI.NAME, chips: CASINO.aiStack, bank: 0, seat: null, busts: 0, handsPlayed: 0, handsWon: 0, bestPot: 0, invested: 0, net: 0 }
  p.away = false
  const inHand = E.inActiveHand(S, AI_KEY)
  const dealt = !!(S.hand && !S.hand.over && S.hand.ps.some((q: any) => q && q.pid === AI_KEY))
  if (p.chips < CASINO.bb * 4 && !dealt) p.chips = CASINO.aiStack
  const humans = S.seats.filter((k: string | null) => k && k !== AI_KEY).length
  if (p.seat == null) {
    if (S.cfg.ai && humans <= 3) {
      const seat = AI.SEAT_ORDER.find((i: number) => !S.seats[i])
      if (seat != null) {
        S.seats[seat] = AI_KEY
        p.seat = seat
      }
    }
  } else if ((!S.cfg.ai || humans >= 4) && !inHand) stand(AI_KEY)
}
function scheduleNext() {
  const h = S.hand
  if ((h && !h.over) || E.eligibleSeats(S).length < 2) {
    if (nextT) clearTimeout(nextT)
    nextT = null
    S.nextAt = 0
    return
  }
  if (nextT) return
  const delay = h ? CASINO.nextHandMs : 3000
  S.nextAt = Date.now() + delay
  nextT = setTimeout(() => {
    nextT = null
    S.nextAt = 0
    if (S.hand && !S.hand.over) return
    if (E.startHand(S)) {
      // remember each stack before the blinds, to book the gold won or lost
      S.hand.start = {}
      S.hand.ps.forEach((q: any) => {
        if (q) S.hand.start[q.pid] = S.players[q.pid].chips + q.total
      })
    }
    changed()
  }, delay)
}
function book(h: any) {
  h.booked = true
  h.ps.forEach((q: any, i: number) => {
    if (!q) return
    const p = S.players[q.pid] as P
    if (!p) return
    p.handsPlayed++
    const won = !!(h.result && h.result.wins[i])
    if (won) {
      p.handsWon++
      p.bestPot = Math.max(p.bestPot, h.result.pot || 0)
    }
    if (q.pid === AI_KEY) return
    const delta = p.chips - (h.start?.[q.pid] ?? p.chips)
    p.net += delta
    void saveStack(q.pid, p.chips, delta, won, won ? h.result.pot || 0 : 0).catch((e) => console.error('[casino] save', e))
  })
  void refreshRank().then(broadcast, () => undefined)
}
function changed() {
  if (S.hand && S.hand.over && !S.hand.booked) book(S.hand)
  aiTick()
  armTurn()
  scheduleNext()
  broadcast()
}
function stand(key: string) {
  const p = S.players[key]
  if (!p || p.seat == null) return
  const seat = p.seat, h = S.hand
  if (h && !h.over && h.ps[seat] && h.ps[seat].pid === key) E.foldOut(S, seat, '퇴장 (폴드)')
  if (S.seats[seat] === key) S.seats[seat] = null
  p.seat = null
  p.away = false
}
/** stand up and take the stack back to the bank */
async function leaveTable(key: string) {
  const p = S.players[key] as P
  if (!p) return
  stand(key)
  // folding may have just ended the hand: book it before the stack leaves the table
  if (S.hand && S.hand.over && !S.hand.booked) book(S.hand)
  if (key === AI_KEY) return
  // chips committed to a hand that is still running stay in the pot; the rest goes home
  const h = S.hand
  if (h && !h.over && h.ps.some((q: any) => q && q.pid === key && !q.folded)) return
  const back = p.chips
  p.chips = 0
  if (h && !h.over && h.start && h.start[key] !== undefined) {
    // folded out mid-hand: book what this hand cost before cashing out
    const delta = back - h.start[key]
    p.net += delta
    delete h.start[key]
    await saveStack(key, back, delta, false, 0)
  } else await serial(key, async () => db.query('UPDATE players SET casino_stack = $1::integer WHERE address = $2', [back, key]))
  await cashOut(key)
  const b = await readBank(key)
  if (b) p.bank = b.bank
}

// ───────────── views ─────────────
function viewFor(key: string | null) {
  const now = Date.now(), h = S.hand, me = key ? (S.players[key] as P) : null
  const inHand = key ? E.inActiveHand(S, key) : false
  // broke = sitting at the table with an empty stack (standing players just buy in when they sit)
  const broke = !!me && me.seat != null && me.chips === 0 && !inHand
  const amt = me ? Math.min(CASINO.maxBuyIn, me.bank) : 0
  const v: any = {
    cfg: { start: 0, sb: S.cfg.sb, bb: S.cfg.bb, turnSecs: S.cfg.turnSecs, ai: !!S.cfg.ai, gold: true, minBuyIn: CASINO.minBuyIn, maxBuyIn: CASINO.maxBuyIn },
    me: me
      ? { name: me.name, chips: me.chips, bank: me.bank, seat: me.seat, away: !!me.away, busts: me.busts, broke, recoverIn: 0, canRecover: broke && me.seat != null && amt >= CASINO.minBuyIn, recoverLong: false, recoverAmt: amt, bj: false }
      : null,
    seats: S.seats.map((k: string | null) => {
      const p = k && S.players[k]
      return p ? { name: p.name, chips: p.chips, away: !!p.away, online: atTable(k!), me: k === key, bot: k === AI_KEY } : null
    }),
    button: S.button,
    handNo: S.handNo,
    nextIn: S.nextAt ? Math.max(0, S.nextAt - now) : 0,
    hand: null,
    ranking: rank,
    linked: me ? me.name : null
  }
  if (h) {
    const mySeat = me && me.seat != null ? me.seat : -1
    v.hand = {
      no: h.no, street: h.street, board: h.board, toAct: h.toAct, over: h.over, sb: h.sb, bb: h.bb, button: h.button,
      turnLeft: h.over ? 0 : Math.max(0, (h.deadline || 0) - now),
      log: h.log.slice(-3),
      pot: h.ps.reduce((a: number, q: any) => a + (q ? q.total : 0), 0),
      ps: h.ps.map((q: any, i: number) => {
        if (!q) return null
        const p = S.players[q.pid]
        const reveal = q.pid === key || (h.over && h.result && h.result.shown[i] != null)
        return { name: p ? p.name : '?', bet: q.bet, folded: q.folded, allin: !q.folded && !h.over && (p ? p.chips : 0) === 0, cards: reveal ? q.hole : null, current: S.seats[i] === q.pid }
      }),
      result: h.over ? h.result : null,
      opts: !h.over && mySeat >= 0 && h.toAct === mySeat && h.ps[mySeat] && h.ps[mySeat].pid === key ? E.options(S, mySeat) : null,
      myBest: mySeat >= 0 && h.ps[mySeat] && h.ps[mySeat].pid === key && !h.ps[mySeat].folded && h.board.length >= 3 ? E.handName(E.bestHand([...h.ps[mySeat].hole, ...h.board]).score) : null
    }
  }
  return v
}
function broadcast() {
  for (const s of clients) s.emit('state', viewFor(s.data.key))
}

// ───────────── sockets ─────────────
async function attach(sock: Sock, name: string) {
  const key = sock.data.addr
  const b = await readBank(key)
  if (!b) return { ok: false, msg: 'Play WOW NIGHTSWARM once first to open your gold account.' }
  const r = rt(key)
  if (r.sock && r.sock !== sock) {
    r.sock.emit('kicked', {})
    r.sock.data.key = null
  }
  r.sock = sock
  r.lastSeen = Date.now()
  sock.data.key = key
  let p = S.players[key] as P
  if (!p) p = S.players[key] = { name: b.name || name || 'Hunter', chips: 0, bank: b.bank, seat: null, busts: 0, handsPlayed: 0, handsWon: 0, bestPot: 0, invested: 0, net: 0 }
  p.bank = b.bank
  if (b.name) p.name = b.name.slice(0, 16)
  return { ok: true, name: p.name, isNew: false, chips: p.chips, bank: p.bank }
}

const handlers: Record<string, (s: Sock, d: any) => Promise<any>> = {
  'dcl:auto': (s) => attach(s, ''),
  'dcl:join': (s, d) => attach(s, String(d?.name || '')),
  login: async () => ({ ok: false, msg: 'Decentraland wallet only' }),
  resume: async () => ({ ok: false }),
  logout: async (s) => {
    const key = s.data.key
    if (key) {
      await leaveTable(key)
      const r = rt(key)
      if (r.sock === s) r.sock = null
    }
    s.data.key = null
    return { ok: true }
  },
  'dcl:unlink': async (s) => handlers.logout(s, {}),
  sit: async (s, d) => {
    const key = s.data.key
    const p = key ? (S.players[key] as P) : null
    if (!key || !p) return { ok: false, msg: '먼저 입장해주세요.' }
    const seat = Number(d?.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat >= E.SEATS) return { ok: false }
    if (p.seat != null) return { ok: false, msg: '이미 앉아 있어요.' }
    if (S.seats[seat]) return { ok: false, msg: '방금 다른 사람이 앉았어요.' }
    if (p.chips <= 0) {
      const b = await readBank(key)
      if (b) p.bank = b.bank
      const amt = Math.min(CASINO.maxBuyIn, p.bank)
      if (amt < CASINO.minBuyIn) return { ok: false, msg: `You need at least ${CASINO.minBuyIn} gold to sit. Hunt in WOW NIGHTSWARM!` }
      if (S.seats[seat]) return { ok: false, msg: '방금 다른 사람이 앉았어요.' }
      const got = await buyIn(key, amt)
      if (!got) return { ok: false, msg: 'Not enough gold.' }
      p.chips += got
      p.bank -= got
    }
    if (S.seats[seat] || p.seat != null) {
      // lost the seat while the buy-in was written: give it back
      await leaveTable(key)
      return { ok: false, msg: '방금 다른 사람이 앉았어요.' }
    }
    S.seats[seat] = key
    p.seat = seat
    p.away = false
    rt(key).timeouts = 0
    changed()
    return { ok: true, buyIn: p.chips }
  },
  stand: async (s) => {
    if (s.data.key) await leaveTable(s.data.key)
    changed()
    return { ok: true }
  },
  away: async (s) => {
    const p = s.data.key ? S.players[s.data.key] : null
    if (!p || p.seat == null) return { ok: false }
    p.away = !p.away
    rt(s.data.key!).timeouts = 0
    changed()
    return { ok: true }
  },
  // "recover" = rebuy from the bank when the stack is gone
  recover: async (s) => {
    const key = s.data.key
    const p = key ? (S.players[key] as P) : null
    if (!key || !p) return { ok: false, msg: '먼저 입장해주세요.' }
    if (p.chips > 0) return { ok: false, msg: '칩이 남아 있으면 복구할 수 없어요.' }
    if (E.inActiveHand(S, key)) return { ok: false, msg: '이번 핸드가 끝난 뒤에 복구할 수 있어요.' }
    const b = await readBank(key)
    if (b) p.bank = b.bank
    const amt = Math.min(CASINO.maxBuyIn, p.bank)
    if (amt < CASINO.minBuyIn) return { ok: false, msg: `Not enough gold (need ${CASINO.minBuyIn}).` }
    const got = await buyIn(key, amt)
    if (!got) return { ok: false, msg: 'Not enough gold.' }
    p.chips += got
    p.bank -= got
    changed()
    return { ok: true, amount: got }
  },
  act: async (s, d) => {
    const key = s.data.key
    const p = key ? S.players[key] : null
    const h = S.hand
    if (!key || !p || !h || h.over || h.no !== d?.no || p.seat == null || h.toAct !== p.seat || !h.ps[p.seat] || h.ps[p.seat].pid !== key) return { ok: false, msg: '지금은 내 차례가 아니에요.' }
    if (!['fold', 'call', 'raise'].includes(d?.type)) return { ok: false }
    if (!E.doAction(S, p.seat, d.type, d.to)) return { ok: false, msg: '그 금액으로는 레이즈할 수 없어요.' }
    rt(key).timeouts = 0
    changed()
    return { ok: true }
  }
}

function open(ws: WebSocket, addr: string) {
  const sock: Sock = {
    data: { key: null, addr, name: '' },
    ws,
    alive: true,
    emit(e, d) {
      if (ws.readyState === 1) ws.send(JSON.stringify(d === undefined ? { e } : { e, d }))
    }
  }
  ws.on('pong', () => (sock.alive = true))
  ws.on('message', (raw) => {
    sock.alive = true
    let m: any
    try {
      m = JSON.parse(String(raw))
    } catch {
      return
    }
    if (!m || typeof m.e !== 'string') return
    if (m.e === 'ping') return sock.emit('pong')
    const fn = handlers[m.e]
    if (!fn) return
    const reply = (res: any) => {
      if (m.id != null && ws.readyState === 1) ws.send(JSON.stringify({ a: m.id, d: res }))
    }
    fn(sock, m.d && typeof m.d === 'object' ? m.d : {})
      .then(reply, (e) => {
        console.error('[casino]', m.e, e)
        reply({ ok: false, msg: '서버 오류' })
      })
      .finally(() => sock.emit('state', viewFor(sock.data.key)))
  })
  ws.on('close', () => {
    clients.delete(sock)
    const key = sock.data.key
    if (key) {
      const r = rt(key)
      if (r.sock === sock) {
        r.sock = null
        r.lastSeen = Date.now()
      }
    }
    changed()
  })
  ws.on('error', () => undefined)
  clients.add(sock)
  sock.emit('state', viewFor(null))
}

export function casinoRoutes(app: any, sql: Sql, authed: any, getOrCreate: (db: Sql, a: string, n: string, g: boolean) => Promise<any>) {
  db = sql
  app.post(
    '/casino/ticket',
    authed(async (req: any, res: any, a: any) => {
      if (a.guest) return res.status(403).json({ ok: false, msg: 'Guests cannot play for gold — connect a wallet.' })
      const name = String(req.body?.name || '').replace(/[^\w .\-#]/g, '').slice(0, 32)
      await getOrCreate(sql, a.address, name, false)
      const now = Date.now()
      for (const [t, x] of tickets) if (x.exp < now) tickets.delete(t)
      const t = crypto.randomBytes(18).toString('hex')
      tickets.set(t, { addr: a.address, exp: now + 120_000 })
      const p = (await sql.query('SELECT name FROM players WHERE address = $1', [a.address])).rows[0]
      res.json({ ok: true, ticket: t, linked: p?.name ?? null })
    })
  )
  app.get('/casino/health', (_req: any, res: any) => res.json({ ok: true, clients: clients.size, seated: S.seats.filter(Boolean).length, hand: S.handNo }))
}

/** attach the WebSocket gateway to the HTTP server; refund escrow left by a previous process */
export async function startCasino(server: HttpServer, sql: Sql) {
  db = sql
  const left = await sql.query('UPDATE players SET bank = bank + casino_stack, casino_stack = 0 WHERE casino_stack > 0')
  if (left.rowCount) console.log(`[casino] refunded ${left.rowCount} table stack(s) from the last session`)
  await refreshRank().catch(() => undefined)
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })
  server.on('upgrade', (req, socket, head) => {
    let url: URL
    try {
      url = new URL(req.url || '', 'http://x')
    } catch {
      return socket.destroy()
    }
    if (url.pathname !== '/casino') return socket.destroy()
    const t = url.searchParams.get('t')
    const x = t ? tickets.get(t) : undefined
    if (t) tickets.delete(t)
    if (!x || x.exp < Date.now()) return socket.destroy()
    wss.handleUpgrade(req, socket, head, (ws) => open(ws, x.addr))
  })
  // heartbeat, offline sweep, bank refresh
  setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.ws.terminate()
        continue
      }
      c.alive = false
      try {
        c.ws.ping()
      } catch {
        /* closed */
      }
    }
  }, 25_000).unref()
  setInterval(() => {
    S.seats.forEach((k: string | null) => {
      if (!k || k === AI_KEY) return
      const r = rt(k)
      if (!r.sock && Date.now() - r.lastSeen > CASINO.offlineStandMs && !E.inActiveHand(S, k)) void leaveTable(k).then(changed)
    })
    // gold earned in the arena shows up at the table
    for (const c of clients)
      if (c.data.key && S.players[c.data.key])
        void readBank(c.data.key).then((b) => {
          if (b && c.data.key && S.players[c.data.key]) S.players[c.data.key].bank = b.bank
        })
  }, 10_000).unref()
  return { S, tables: () => S }
}

/** test helper: the live table */
export const _test = { S, CASINO }

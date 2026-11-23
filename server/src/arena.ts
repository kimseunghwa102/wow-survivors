// Arena relay: hunters' status, skill effects, PvP hits and announcements, passed between everyone in the scene.
// Decentraland's own MessageBus stays as a backup; this relay is the reliable path. The server stamps every
// message with the sender's signed-in address, so nobody can send hits or effects in someone else's name.
import { randomUUID } from 'crypto'
import type { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

/** message kinds the relay passes on (anything else is dropped) */
export const ARENA_KINDS = new Set(['st', 'fx', 'hit', 'ko', 'god', 'jp'])
/** per connection: at most this many messages per second (status 5/s + effects 5/s + a little headroom) */
const RATE = 25
const MAX_BYTES = 8 * 1024

type Client = { ws: WebSocket; addr: string; alive: boolean; budget: number; t: number }
const clients = new Set<Client>()
const tickets = new Map<string, { addr: string; exp: number }>()

/** one-time ticket for the WebSocket, handed out by a signed request (see /api/arena/ticket) */
export function arenaTicket(addr: string) {
  const now = Date.now()
  for (const [t, x] of tickets) if (x.exp < now) tickets.delete(t)
  const t = randomUUID()
  tickets.set(t, { addr: addr.toLowerCase(), exp: now + 120_000 })
  return t
}

export function arenaStats() {
  return { clients: clients.size }
}

/** relay one raw message from `from` to everyone else; returns the number of receivers (exported for tests) */
export function relay(from: Client, raw: string): number {
  const now = Date.now()
  // token bucket
  from.budget = Math.min(RATE, from.budget + ((now - from.t) / 1000) * RATE)
  from.t = now
  if (from.budget < 1) return 0
  from.budget -= 1
  if (raw.length > MAX_BYTES) return 0
  let m: any
  try {
    m = JSON.parse(raw)
  } catch {
    return 0
  }
  if (!m || typeof m !== 'object' || !ARENA_KINDS.has(m.k) || !m.d || typeof m.d !== 'object') return 0
  // the sender is who they signed in as, whatever the message claims
  const d = { ...m.d }
  if (m.k === 'hit') d.from = from.addr
  else if (m.k === 'ko') d.victim = from.addr
  else d.id = from.addr
  const out = JSON.stringify({ k: m.k, d })
  let n = 0
  for (const c of clients) {
    if (c === from || c.ws.readyState !== WebSocket.OPEN) continue
    // a PvP hit only goes to its target
    if (m.k === 'hit' && String(d.to || '').toLowerCase() !== c.addr) continue
    c.ws.send(out)
    n++
  }
  return n
}

export function startArena(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_BYTES })
  server.on('upgrade', (req, socket, head) => {
    let url: URL
    try {
      url = new URL(req.url || '', 'http://x')
    } catch {
      return
    }
    if (url.pathname !== '/arena') return
    const t = url.searchParams.get('t')
    const x = t ? tickets.get(t) : undefined
    if (t) tickets.delete(t)
    if (!x || x.exp < Date.now()) return socket.destroy()
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c: Client = { ws, addr: x.addr, alive: true, budget: RATE, t: Date.now() }
      clients.add(c)
      ws.on('pong', () => (c.alive = true))
      ws.on('message', (data) => relay(c, String(data)))
      ws.on('close', () => clients.delete(c))
      ws.on('error', () => clients.delete(c))
    })
  })
  setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.ws.terminate()
        clients.delete(c)
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
}

/** tests: a fake client */
export function _testClient(addr: string, sent: string[]): Client {
  const c: Client = { ws: { readyState: WebSocket.OPEN, send: (s: string) => sent.push(s) } as any, addr: addr.toLowerCase(), alive: true, budget: RATE, t: Date.now() }
  clients.add(c)
  return c
}
export function _testDrop(c: Client) {
  clients.delete(c)
}

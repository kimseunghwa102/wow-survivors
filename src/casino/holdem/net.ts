// Connection to the GYBM Hold'em server (the same server as the web table).
// 1. Wake the server (Render's free plan sleeps after 15 idle minutes).
// 2. Prove the wallet with signedFetch → one-time ticket (optional: without it you can still log in with nickname + PIN).
// 3. Plain WebSocket to /dcl: client → {e, d, id}, server → {e, d} or ack {a: id, d}.
import { engine, executeTask } from '@dcl/sdk/ecs'
import { signedFetch } from '~system/SignedFetch'
import { getPlayer } from '@dcl/sdk/players'
import { store, toast, View } from './store'
import { errorText, fmt } from './text'

import { API_URL } from '../../config'
export const SERVER = API_URL
const WS_URL = API_URL.replace(/^http/, 'ws') + '/casino'

/* ---------- tiny timer queue (the scene runtime has no setTimeout) ---------- */
type Job = { at: number; fn: () => void }
const jobs: Job[] = []
export function later(ms: number, fn: () => void) {
  jobs.push({ at: Date.now() + ms, fn })
}
engine.addSystem(() => {
  if (!jobs.length) return
  const now = Date.now()
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].at <= now) {
      const j = jobs.splice(i, 1)[0]
      try {
        j.fn()
      } catch (e) {
        console.error('[holdem] job', e)
      }
    }
  }
})

/* ---------- socket ---------- */
let ws: WebSocket | null = null
let nextId = 0
const acks = new Map<number, (d: any) => void>()
let pingT = 0
let attempt = 0
let wantAuto = false // log back in after a reconnect
let autoTried = false // per connection: try the wallet login once when the first view arrives
let pendingJoin = false // the player pressed PLAY while the wallet check was still running
let walletTries = 0
let walletBusy = false

export type Ack = { ok: boolean; msg?: string; [k: string]: any }
export function call(e: string, d: Record<string, unknown> = {}): Promise<Ack> {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== 1) return resolve({ ok: false, msg: 'offline' })
    const id = ++nextId
    acks.set(id, resolve)
    later(10000, () => {
      const r = acks.get(id)
      if (r) {
        acks.delete(id)
        r({ ok: false, msg: 'timeout' })
      }
    })
    ws.send(JSON.stringify({ e, d, id }))
  })
}

function onState(v: View) {
  const prevMe = store.view && store.view.me
  store.view = v
  store.viewAt = Date.now()
  // turn timer: restart only when the turn changes, so small network delays don't make it jump
  const h = v.hand
  if (h && !h.over && h.toAct >= 0) {
    const key = h.no + ':' + h.street + ':' + h.toAct + ':' + h.log.length
    if (key !== store.turnKey) {
      store.turnKey = key
      store.turnEnd = Date.now() + h.turnLeft
      if (h.opts) store.raiseTo = h.opts.minTo
    }
  } else store.turnKey = ''
  if (prevMe && !v.me && !store.kicked) store.remembered = null
  // the wallet is linked to an account: log in without asking anything
  if (!autoTried && store.verified && v.linked && !v.me && !store.kicked && !store.noAuto) {
    autoTried = true
    executeTask(async () => {
      const r = await call('dcl:auto')
      if (r.ok) {
        wantAuto = true
        toast('Welcome back, ' + r.name + '!')
      }
    })
  }
}

function open(ticket: string | null) {
  store.status = 'connecting'
  let sock: WebSocket
  try {
    sock = new WebSocket(WS_URL + (ticket ? '?t=' + ticket : ''))
  } catch (e) {
    console.error('[holdem] ws', e)
    return retry()
  }
  ws = sock
  let opened = false
  later(15000, () => {
    if (!opened && ws === sock) {
      store.note = 'connection timed out'
      try {
        sock.close()
      } catch {}
      ws = null
      retry()
    }
  })
  sock.onopen = () => {
    opened = true
    autoTried = false
    attempt = 0
    store.note = ''
    store.status = 'online'
    if (pendingJoin && store.verified) {
      pendingJoin = false
      executeTask(async () => {
        await join()
      })
    } else if (wantAuto) executeTask(async () => autoLogin(true))
  }
  sock.onmessage = (ev) => {
    let m: any
    try {
      m = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (m.a != null) {
      const r = acks.get(m.a)
      if (r) {
        acks.delete(m.a)
        r(m.d || {})
      }
      return
    }
    if (m.e === 'state') onState(m.d as View)
    else if (m.e === 'kicked') {
      store.kicked = true
      wantAuto = false
    }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    if (!opened) store.note = 'could not reach the table server'
    ws = null
    for (const r of acks.values()) r({ ok: false, msg: 'offline' })
    acks.clear()
    if (store.view && store.view.me) wantAuto = true
    retry()
  }
  sock.onerror = () => {}
}

function retry() {
  attempt++
  store.status = attempt >= 2 ? 'waking' : 'offline'
  later(Math.min(15000, 2000 * attempt), () => connect())
}

/** resolves with the promise's value, or `fallback` after `ms` */
function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((res) => {
    let done = false
    later(ms, () => {
      if (!done) {
        done = true
        res(fallback)
      }
    })
    p.then(
      (v) => {
        if (!done) {
          done = true
          res(v)
        }
      },
      () => {
        if (!done) {
          done = true
          res(fallback)
        }
      }
    )
  })
}

/** Proves the Decentraland wallet with a signed request. Render's free server can take ~50 s to wake,
 *  so a slow or 502/503 answer is retried instead of giving up. */
async function getTicket(totalMs = 60000): Promise<string | null> {
  const end = Date.now() + totalMs
  while (Date.now() < end) {
    try {
      const r = await within(signedFetch({ url: SERVER + '/casino/ticket', init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: (getPlayer() || { name: '' }).name }) } }), Math.max(5000, end - Date.now()), null as any)
      if (!r) {
        store.note = 'wallet check timed out'
        return null
      }
      if (r.ok) {
        const j = JSON.parse(r.body)
        store.verified = !!j.ticket
        if (j.ticket) store.note = ''
        return j.ticket || null
      }
      if (r.status === 502 || r.status === 503 || r.status === 504 || r.status === 0) {
        store.note = 'server is waking up'
        await new Promise<void>((res) => later(4000, res))
        continue
      }
      store.note = 'wallet check failed (' + r.status + ')'
      return null
    } catch (e) {
      console.log('[holdem] signed fetch unavailable', e)
      store.note = 'wallet check unavailable'
      return null
    }
  }
  store.note = 'wallet check timed out'
  return null
}

/** Gets a wallet ticket while already connected without one, then reconnects with it. */
export async function ensureWallet(totalMs = 60000): Promise<boolean> {
  if (store.verified) return true
  if (walletBusy) return false
  walletBusy = true
  walletTries++
  const t = await getTicket(totalMs)
  walletBusy = false
  if (!t) return false
  const old = ws
  ws = null
  try {
    if (old) old.close()
  } catch {}
  open(t)
  return true
}

export function connect() {
  executeTask(async () => {
    if (store.status !== 'offline' && store.status !== 'starting') return
    store.status = attempt >= 2 ? 'waking' : 'connecting'
    const t = await getTicket(25000)
    open(t)
  })
}

export function startNet() {
  // debugging handle (also used by the headless test)
  ;(globalThis as any).__gybm = { store, call, login, act, autoLogin }
  connect()
  let walletT = 0
  engine.addSystem((dt) => {
    walletT += dt
    if (walletT > 20 && !store.verified && !walletBusy && walletTries < 10 && store.status === 'online' && !(store.view && store.view.me)) {
      walletT = 0
      executeTask(async () => {
        await ensureWallet(40000)
      })
    }
    pingT += dt
    if (pingT < 20) return
    pingT = 0
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ e: 'ping' }))
  })
}

/* ---------- account actions ---------- */
/** One click, no nickname/PIN: the verified Decentraland wallet logs in (and gets an account the first time). */
export async function join(): Promise<boolean> {
  const pl = getPlayer()
  const r = await call('dcl:join', { name: pl ? pl.name : '' })
  if (!r.ok) {
    toast(r.msg && /[A-Za-z]/.test(r.msg) ? r.msg : errorText(r.msg, 'Could not join. Try again.'))
    return false
  }
  store.kicked = false
  store.noAuto = false
  wantAuto = true
  store.loginOpen = false
  if (r.isNew) {
    store.newPin = r.pin || ''
    toast(`Welcome, ${r.name}! Your bank: ${fmt(r.bank || 0)} gold.`, 5000)
  } else toast('Welcome back, ' + r.name + '!')
  return true
}

export async function autoLogin(silent = false) {
  store.kicked = false
  if (!store.verified && !silent && !store.remembered) {
    toast('Checking your Decentraland wallet...', 4000)
    pendingJoin = true
    const ok = await ensureWallet(60000)
    if (ok) return true // join() runs as soon as the verified connection opens
    pendingJoin = false
    toast('Wallet check failed (' + (store.note || 'unknown') + '). Gold tables need a Decentraland wallet (no guests).', 6000)
    return false
  }
  if (store.verified) {
    if (silent && !(store.view && store.view.linked)) return false
    return join()
  }
  if (store.view && store.view.linked && store.verified) {
    const r = await call('dcl:auto')
    if (r.ok) {
      wantAuto = true
      store.loginOpen = false
      if (!silent) toast('Welcome back, ' + r.name + '!')
      return true
    }
  }
  if (store.remembered) {
    const r = await call('login', { name: store.remembered.name, pin: store.remembered.pin })
    if (r.ok) {
      wantAuto = true
      return true
    }
  }
  if (!silent) store.loginOpen = true
  return false
}

export async function login(name: string, pin: string) {
  store.busy = true
  store.formError = ''
  const r = await call('login', { name: name.trim(), pin: pin.trim() })
  store.busy = false
  if (!r.ok) {
    store.formError = r.msg === 'offline' ? 'Not connected yet. Try again in a moment.' : errorText(r.msg, 'Login failed.')
    return
  }
  store.kicked = false
  store.remembered = { name: name.trim(), pin: pin.trim() }
  wantAuto = true
  store.loginOpen = false
  store.formPin = ''
  toast(r.isNew ? `Welcome, ${r.name}! You got ${r.chips} free chips.` : `Welcome back, ${r.name}!`)
}

export async function logout() {
  wantAuto = false
  store.remembered = null
  store.noAuto = true // stay logged out for the rest of this visit (the wallet link is kept)
  await call('logout')
  toast('Logged out.')
}

export async function act(e: string, d: Record<string, unknown> = {}, okMsg = '') {
  const r = await call(e, d)
  if (!r.ok) {
    if (e === 'recover' && typeof r.recoverIn === 'number') toast('Chips can be recovered later. Please wait.')
    else toast(r.msg === 'offline' ? 'Reconnecting...' : r.msg && !/[가-힯]/.test(r.msg) ? r.msg : errorText(r.msg))
  } else if (okMsg) toast(okMsg)
  return r
}

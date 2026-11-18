import express, { Request, Response, NextFunction } from 'express'
import { verify } from '@dcl/platform-crypto-middleware'
import { GOLD_PACK, createQuote, confirmPurchase, settlePending, Rpc, PriceFeed, coingecko, Currency } from './payments'
import { Sql, getOrCreate, toProfile, startRun, getOpenRun, finishRun, buy, leaderboard, rankOf, buyArmory, claimDaily } from './db'
import { META_KEYS, META_MAX, MetaKey, metaCost, clampRun, LIMITS } from './rules'

export type Auth = { address: string; guest: boolean; meta: Record<string, any> }
export type Authenticator = (req: Request) => Promise<Auth>

/**
 * Real Decentraland auth: the scene calls signedFetch(), the explorer signs the request with the
 * player's wallet (ephemeral key chain). We verify the chain and get the wallet address.
 */
export function dclAuth(opts: { allowedParcels?: string[]; allowGuests?: boolean } = {}): Authenticator {
  return async (req) => {
    const path = new URL(req.originalUrl, 'http://x').pathname
    const data = await verify<Record<string, any>>(req.method, path, req.headers as any, {
      fetcher: { fetch: ((url: any, init?: any) => fetch(url, init)) as any },
      metadataValidator: (m) => {
        if (m.signer && m.signer !== 'decentraland-kernel-scene') return false
        if (opts.allowedParcels?.length && m.parcel && !opts.allowedParcels.includes(m.parcel)) return false
        return true
      }
    })
    const meta = data.authMetadata ?? {}
    const guest = !!meta.isGuest
    if (guest && opts.allowGuests === false) throw Object.assign(new Error('Guests cannot save — connect a wallet'), { statusCode: 403 })
    return { address: data.auth.toLowerCase(), guest, meta }
  }
}

/** local development only: trust an x-dev-address header */
export const devAuth: Authenticator = async (req) => {
  const a = String(req.headers['x-dev-address'] || '')
  if (!/^0x[0-9a-f]{40}$/i.test(a)) throw Object.assign(new Error('missing x-dev-address'), { statusCode: 401 })
  return { address: a.toLowerCase(), guest: false, meta: {} }
}

export type PayOpts = { wallet?: string; rpc?: Rpc; prices?: PriceFeed }

export function createApp(db: Sql, auth: Authenticator, pay: PayOpts = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))
  // CORS (web explorer) — identity headers must be allowed
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  const authed =
    (fn: (req: Request, res: Response, a: Auth) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
      let a: Auth
      try {
        a = await auth(req)
      } catch (e: any) {
        return res.status(e.statusCode ?? 401).json({ ok: false, error: e.message ?? 'unauthorized' })
      }
      try {
        await fn(req, res, a)
      } catch (e) {
        next(e)
      }
    }

  const nameOf = (req: Request) => String((req.body && req.body.name) || req.query.name || '').replace(/[^\w .\-#]/g, '').slice(0, 32)

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'wow-nightswarm', time: Date.now() }))

  app.get('/api/leaderboard', async (_req, res, next) => {
    try {
      res.json({ ok: true, ...(await leaderboard(db)) })
    } catch (e) {
      next(e)
    }
  })

  app.post(
    '/api/profile',
    authed(async (req, res, a) => {
      if (pay.rpc && pay.wallet && !a.guest) await settlePending(db, a.address, pay.rpc).catch(() => 0)
      const p = await getOrCreate(db, a.address, nameOf(req), a.guest)
      res.json({ ok: true, profile: toProfile(p) })
    })
  )

  app.post(
    '/api/run/start',
    authed(async (req, res, a) => {
      const p = await getOrCreate(db, a.address, nameOf(req), a.guest)
      if (p.last_start && Date.now() - new Date(p.last_start).getTime() < LIMITS.minSecondsBetweenStarts * 1000)
        return res.status(429).json({ ok: false, error: 'too many runs' })
      const weapon = String(req.body?.weapon || '').slice(0, 16)
      const runId = await startRun(db, a.address, weapon)
      res.json({ ok: true, runId })
    })
  )

  app.post(
    '/api/run/end',
    authed(async (req, res, a) => {
      const b = req.body || {}
      const run = await getOpenRun(db, String(b.runId || ''), a.address)
      if (!run) return res.status(404).json({ ok: false, error: 'run not found or already finished' })
      const elapsed = (Date.now() - new Date(run.started_at).getTime()) / 1000
      const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)
      const killer = b.killer ? String(b.killer).slice(0, 32) : null
      const result = clampRun(
        { time: num(b.time), level: num(b.level), kills: num(b.kills), gold: num(b.gold), pvpKills: num(b.pvpKills), killedByPlayer: !!killer },
        elapsed
      )
      const fin = await finishRun(db, run, a.address, result, Math.floor(num(b.gold)), killer)
      const p = (await db.query('SELECT * FROM players WHERE address = $1', [a.address])).rows[0]
      res.json({ ok: true, granted: result.gold + fin.bonus, bonus: fin.bonus, newBest: fin.newBest, rank: await rankOf(db, p.best_time), profile: toProfile(p) })
    })
  )

  app.post(
    '/api/shop/buy',
    authed(async (req, res, a) => {
      const key = String(req.body?.key || '') as MetaKey
      if (!META_KEYS.includes(key)) return res.status(400).json({ ok: false, error: 'unknown upgrade' })
      const p = await getOrCreate(db, a.address, '', a.guest)
      const lvl = p[`meta_${key}`] as number
      if (lvl >= META_MAX) return res.status(400).json({ ok: false, error: 'maxed' })
      const ok = await buy(db, a.address, key, metaCost(lvl))
      const after = (await db.query('SELECT * FROM players WHERE address = $1', [a.address])).rows[0]
      res.status(ok ? 200 : 400).json({ ok, error: ok ? undefined : 'not enough gold', profile: toProfile(after) })
    })
  )

  app.post(
    '/api/armory/buy',
    authed(async (req, res, a) => {
      const tier = Math.floor(Number(req.body?.tier))
      await getOrCreate(db, a.address, '', a.guest)
      const ok = await buyArmory(db, a.address, tier)
      const after = (await db.query('SELECT * FROM players WHERE address = $1', [a.address])).rows[0]
      res.status(ok ? 200 : 400).json({ ok, error: ok ? undefined : 'not enough gold or wrong order', profile: toProfile(after) })
    })
  )

  app.post(
    '/api/daily/claim',
    authed(async (req, res, a) => {
      await getOrCreate(db, a.address, nameOf(req), a.guest)
      const reward = await claimDaily(db, a.address)
      const after = (await db.query('SELECT * FROM players WHERE address = $1', [a.address])).rows[0]
      res.status(reward ? 200 : 400).json({ ok: reward > 0, reward, error: reward ? undefined : 'already claimed today', profile: toProfile(after) })
    })
  )

  // ── gold packs paid in ETH / MANA, sent to the owner's wallet ──
  const payOn = () => !!pay.wallet && /^0x[0-9a-fA-F]{40}$/.test(pay.wallet) && !!pay.rpc
  app.get('/api/shop/config', (_req, res) => {
    res.json({ ok: true, enabled: payOn(), gold: GOLD_PACK.gold, usd: GOLD_PACK.usd, wallet: payOn() ? pay.wallet!.toLowerCase() : null, currencies: ['ETH', 'MANA'] })
  })

  app.post(
    '/api/shop/quote',
    authed(async (req, res, a) => {
      if (!payOn()) return res.status(503).json({ ok: false, error: 'payments are not enabled yet' })
      if (a.guest) return res.status(403).json({ ok: false, error: 'connect a wallet to buy gold' })
      const currency = String(req.body?.currency).toUpperCase() as Currency
      if (currency !== 'ETH' && currency !== 'MANA') return res.status(400).json({ ok: false, error: 'currency must be ETH or MANA' })
      await getOrCreate(db, a.address, nameOf(req), a.guest)
      const q = await createQuote(db, a.address, currency, pay.wallet!, pay.prices ?? coingecko)
      res.json({ ok: true, quote: q })
    })
  )

  app.post(
    '/api/shop/confirm',
    authed(async (req, res, a) => {
      if (!payOn()) return res.status(503).json({ ok: false, error: 'payments are not enabled yet' })
      const r = await confirmPurchase(db, a.address, String(req.body?.quoteId ?? ''), String(req.body?.txHash ?? ''), pay.rpc!)
      const p = (await db.query('SELECT * FROM players WHERE address = $1', [a.address])).rows[0]
      res.status(r.status === 'invalid' || r.status === 'failed' ? 400 : 200).json({ ...r, profile: p ? toProfile(p) : undefined })
    })
  )

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    res.status(500).json({ ok: false, error: 'server error' })
  })
  return app
}

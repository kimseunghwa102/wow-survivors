/**
 * Gold packs paid in ETH or MANA (Ethereum mainnet), sent straight to the owner's wallet.
 * Flow: client asks for a quote → wallet sends the tx → client posts the tx hash →
 * the server reads the chain and only credits gold when the money really arrived.
 */
import { Sql } from './db'

export type Pack = { id: string; usd: number; gold: number; bonus: number; tag?: string }
/** base rate 1,000 gold per $1; bigger packs add bonus gold. Must match GOLD_PACKS in src/game/defs.ts */
export const GOLD_PACKS: Pack[] = [
  { id: 'p5', usd: 5, gold: 5_000, bonus: 0 },
  { id: 'p10', usd: 10, gold: 10_000, bonus: 0, tag: 'POPULAR' },
  { id: 'p25', usd: 25, gold: 27_500, bonus: 10 },
  { id: 'p50', usd: 50, gold: 60_000, bonus: 20 },
  { id: 'p100', usd: 100, gold: 130_000, bonus: 30, tag: 'BEST VALUE' }
]
export const FIRST_BUY_BONUS = 0.5 // +50% gold on a wallet's first purchase
export const GOLD_PACK = GOLD_PACKS[1]
export const MANA_TOKEN = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942' // MANA (Ethereum mainnet)
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const QUOTE_TTL_MS = 30 * 60 * 1000

export type Currency = 'ETH' | 'MANA'
export type Rpc = (method: string, params: any[]) => Promise<any>
export type PriceFeed = () => Promise<{ ETH: number; MANA: number }>

export const PAY_SCHEMA = `
CREATE TABLE IF NOT EXISTS purchases (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  currency    TEXT NOT NULL,
  amount_wei  TEXT NOT NULL,
  gold        INTEGER NOT NULL,
  usd         INTEGER NOT NULL,
  to_wallet   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'quoted',
  tx_hash     TEXT UNIQUE,
  created_at  BIGINT NOT NULL,
  paid_at     BIGINT
)`

export function rpcClient(url: string): Rpc {
  let id = 1
  return async (method, params) => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }) })
    const j: any = await r.json()
    if (j.error) throw new Error(`rpc ${method}: ${j.error.message ?? JSON.stringify(j.error)}`)
    return j.result
  }
}

let cache: { t: number; v: { ETH: number; MANA: number } } | null = null
const UA = { 'user-agent': 'wow-nightswarm-shop/1.0', accept: 'application/json' }
async function getJson(url: string) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal })
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`)
    return (await r.json()) as any
  } finally {
    clearTimeout(timer)
  }
}
const SOURCES: [string, () => Promise<{ ETH: number; MANA: number }>][] = [
  ['coinbase', async () => {
    const [e, m] = await Promise.all([getJson('https://api.coinbase.com/v2/prices/ETH-USD/spot'), getJson('https://api.coinbase.com/v2/prices/MANA-USD/spot')])
    return { ETH: Number(e?.data?.amount), MANA: Number(m?.data?.amount) }
  }],
  ['kraken', async () => {
    const j = await getJson('https://api.kraken.com/0/public/Ticker?pair=ETHUSD,MANAUSD')
    const r: Record<string, any> = j?.result ?? {}
    const pick = (k: string) => Number(Object.entries(r).find(([n]) => n.includes(k))?.[1]?.['c']?.[0] ?? NaN)
    return { ETH: pick('ETH'), MANA: pick('MANA') }
  }],
  ['coingecko', async () => {
    const j = await getJson('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,decentraland&vs_currencies=usd')
    return { ETH: Number(j?.ethereum?.usd), MANA: Number(j?.decentraland?.usd) }
  }]
]
/** live USD prices from the first source that answers; a quote is never built from a price older than 30 min */
export const coingecko: PriceFeed = async () => {
  if (cache && Date.now() - cache.t < 60_000) return cache.v
  const errs: string[] = []
  for (const [name, fn] of SOURCES) {
    try {
      const v = await fn()
      if (v.ETH > 100 && v.MANA > 0.001) {
        cache = { t: Date.now(), v }
        return v
      }
      errs.push(`${name}: bad data`)
    } catch (e: any) {
      errs.push(`${name}: ${e?.message ?? e}`)
    }
  }
  if (cache && Date.now() - cache.t < 30 * 60_000) return cache.v
  console.error('price feed failed:', errs.join(' | '))
  throw Object.assign(new Error('price feed unavailable, try again in a minute'), { statusCode: 503 })
}

/** usd → token amount, rounded UP so the owner never receives less than the pack price */
export function toWei(usd: number, price: number, currency: Currency): bigint {
  const decimals = currency === 'ETH' ? 6 : 2
  const units = Math.ceil((usd / price) * 10 ** decimals)
  return BigInt(units) * 10n ** BigInt(18 - decimals)
}
export const fromWei = (w: bigint) => Number(w) / 1e18

export async function hasBought(db: Sql, address: string) {
  return (await db.query("SELECT 1 FROM purchases WHERE address = $1 AND status = 'paid' LIMIT 1", [address])).rows.length > 0
}

export async function createQuote(db: Sql, address: string, currency: Currency, wallet: string, prices: PriceFeed, packId = 'p10') {
  const pack = GOLD_PACKS.find((k) => k.id === packId)
  if (!pack) throw Object.assign(new Error('unknown pack'), { statusCode: 400 })
  const first = !(await hasBought(db, address))
  const gold = Math.round(pack.gold * (first ? 1 + FIRST_BUY_BONUS : 1))
  const p = await prices()
  const wei = toWei(pack.usd, p[currency], currency)
  const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  await db.query(
    'INSERT INTO purchases (id, address, currency, amount_wei, gold, usd, to_wallet, created_at) VALUES ($1, $2, $3, $4, $5::integer, $6::integer, $7, $8)',
    [id, address, currency, wei.toString(), gold, pack.usd, wallet.toLowerCase(), Date.now()]
  )
  return {
    id,
    currency,
    to: wallet.toLowerCase(),
    token: currency === 'MANA' ? MANA_TOKEN : null,
    amountWei: wei.toString(),
    amount: fromWei(wei),
    pack: pack.id,
    gold,
    firstBonus: first,
    usd: pack.usd,
    priceUsd: p[currency],
    expiresAt: Date.now() + QUOTE_TTL_MS
  }
}

const addr = (topic: string) => '0x' + topic.slice(-40).toLowerCase()

/** checks the chain; returns 'pending' until the tx is mined, then credits gold exactly once */
export async function confirmPurchase(db: Sql, address: string, quoteId: string, txHash: string, rpc: Rpc) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, status: 'invalid', error: 'bad tx hash' }
  const hash = txHash.toLowerCase()
  const q = (await db.query('SELECT * FROM purchases WHERE id = $1 AND address = $2', [quoteId, address])).rows[0]
  if (!q) return { ok: false, status: 'invalid', error: 'unknown quote' }
  if (q.status === 'paid') return { ok: q.tx_hash === hash, status: 'paid', gold: q.gold }
  const used = (await db.query('SELECT id FROM purchases WHERE tx_hash = $1', [hash])).rows[0]
  if (used && used.id !== quoteId) return { ok: false, status: 'invalid', error: 'transaction already used' }

  // remember the tx right away so it is still credited if the player leaves before it is mined
  if (q.status === 'quoted') await db.query("UPDATE purchases SET tx_hash = $1, status = 'submitted' WHERE id = $2 AND status = 'quoted'", [hash, quoteId])
  else if (q.tx_hash && q.tx_hash !== hash) return { ok: false, status: 'invalid', error: 'quote already used by another transaction' }
  const tx = await rpc('eth_getTransactionByHash', [hash])
  if (!tx) return { ok: false, status: 'pending' }
  const receipt = await rpc('eth_getTransactionReceipt', [hash])
  if (!receipt || !receipt.blockNumber) return { ok: false, status: 'pending' }
  if (receipt.status !== '0x1') {
    await db.query("UPDATE purchases SET status = 'rejected' WHERE id = $1 AND status <> 'paid'", [quoteId])
    return { ok: false, status: 'failed', error: 'transaction reverted' }
  }
  if (String(tx.from).toLowerCase() !== address) return { ok: false, status: 'invalid', error: 'paid from a different wallet' }
  const block = await rpc('eth_getBlockByNumber', [receipt.blockNumber, false])
  const minedMs = Number(BigInt(block.timestamp)) * 1000
  if (minedMs < Number(q.created_at) - 120_000) return { ok: false, status: 'invalid', error: 'transaction older than the quote' }

  const need = BigInt(q.amount_wei)
  let paid = 0n
  if (q.currency === 'ETH') {
    if (String(tx.to).toLowerCase() === q.to_wallet) paid = BigInt(tx.value)
  } else {
    for (const lg of receipt.logs ?? []) {
      if (String(lg.address).toLowerCase() !== MANA_TOKEN || lg.topics?.[0] !== TRANSFER_TOPIC) continue
      if (addr(lg.topics[1]) === address && addr(lg.topics[2]) === q.to_wallet) paid += BigInt(lg.data)
    }
  }
  if (paid < need) {
    await db.query("UPDATE purchases SET status = 'rejected' WHERE id = $1 AND status <> 'paid'", [quoteId])
    return { ok: false, status: 'invalid', error: `payment too small or wrong recipient (${fromWei(paid)} ${q.currency})` }
  }

  // credit exactly once (status guard + unique tx_hash)
  const r = await db.query("UPDATE purchases SET status = 'paid', tx_hash = $1, paid_at = $2 WHERE id = $3 AND status <> 'paid'", [hash, Date.now(), quoteId])
  if ((r.rowCount ?? 0) > 0) await db.query('UPDATE players SET bank = bank + $1::integer, total_gold = total_gold + $2::integer, updated_at = NOW() WHERE address = $3', [q.gold, q.gold, address])
  return { ok: true, status: 'paid', gold: q.gold }
}

/** retry purchases whose tx was submitted but not yet confirmed (called on profile load) */
export async function settlePending(db: Sql, address: string, rpc: Rpc) {
  const rows = (await db.query("SELECT id, tx_hash FROM purchases WHERE address = $1 AND status = 'submitted'", [address])).rows
  let gold = 0
  for (const r of rows) {
    try {
      const res: any = await confirmPurchase(db, address, r.id, r.tx_hash, rpc)
      if (res.ok && res.gold) gold += res.gold
    } catch {}
  }
  return gold
}

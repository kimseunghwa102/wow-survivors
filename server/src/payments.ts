/**
 * Gold packs paid in ETH or MANA (Ethereum mainnet), sent straight to the owner's wallet.
 * Flow: client asks for a quote → wallet sends the tx → client posts the tx hash →
 * the server reads the chain and only credits gold when the money really arrived.
 */
import { Sql } from './db'

export const GOLD_PACK = { id: 'gold10k', gold: 10_000, usd: 10 }
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
export const coingecko: PriceFeed = async () => {
  if (cache && Date.now() - cache.t < 60_000) return cache.v
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,decentraland&vs_currencies=usd')
  const j: any = await r.json()
  const v = { ETH: Number(j?.ethereum?.usd), MANA: Number(j?.decentraland?.usd) }
  if (!(v.ETH > 0 && v.MANA > 0)) throw new Error('price feed unavailable')
  cache = { t: Date.now(), v }
  return v
}

/** usd → token amount, rounded UP so the owner never receives less than the pack price */
export function toWei(usd: number, price: number, currency: Currency): bigint {
  const decimals = currency === 'ETH' ? 6 : 2
  const units = Math.ceil((usd / price) * 10 ** decimals)
  return BigInt(units) * 10n ** BigInt(18 - decimals)
}
export const fromWei = (w: bigint) => Number(w) / 1e18

export async function createQuote(db: Sql, address: string, currency: Currency, wallet: string, prices: PriceFeed) {
  const p = await prices()
  const wei = toWei(GOLD_PACK.usd, p[currency], currency)
  const id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  await db.query(
    'INSERT INTO purchases (id, address, currency, amount_wei, gold, usd, to_wallet, created_at) VALUES ($1, $2, $3, $4, $5::integer, $6::integer, $7, $8)',
    [id, address, currency, wei.toString(), GOLD_PACK.gold, GOLD_PACK.usd, wallet.toLowerCase(), Date.now()]
  )
  return {
    id,
    currency,
    to: wallet.toLowerCase(),
    token: currency === 'MANA' ? MANA_TOKEN : null,
    amountWei: wei.toString(),
    amount: fromWei(wei),
    gold: GOLD_PACK.gold,
    usd: GOLD_PACK.usd,
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

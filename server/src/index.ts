import { Pool } from 'pg'
import { createApp, dclAuth, devAuth } from './app'
import { migrate } from './db'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required (Neon connection string)')
  // DATABASE_URL=pgmem → throwaway in-memory database for local testing
  const pool =
    url === 'pgmem'
      ? new (require('pg-mem').newDb().adapters.createPg().Pool)()
      : new Pool({ connectionString: url, ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false }, max: 5 })
  await migrate(pool)
  const dev = process.env.DEV_AUTH === '1' && process.env.NODE_ENV !== 'production'
  const parcels = (process.env.ALLOWED_PARCELS || '').split(';').map((s) => s.trim()).filter(Boolean)
  const auth = dev ? devAuth : dclAuth({ allowedParcels: parcels, allowGuests: process.env.ALLOW_GUESTS !== '0' })
  const app = createApp(pool, auth)
  const port = Number(process.env.PORT || 8080)
  app.listen(port, () => console.log(`wow-survivors api on :${port} (auth: ${dev ? 'DEV' : 'decentraland signedFetch'})`))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

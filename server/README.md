# WOW Survivors — save server

Express + Postgres. Stores per-wallet gold, Shrine upgrades, best run and the all-time leaderboard.

- **Auth**: the scene calls `signedFetch`; the Decentraland explorer signs each request with the player's wallet.
  The server verifies the signature chain (`@dcl/platform-crypto-middleware`) → wallet address. No login, no PIN.
  Requests must come from one of the estate's parcels (`ALLOWED_PARCELS`).
- **Anti-cheat**: the game runs on the player's computer, so results are clamped server-side:
  run time ≤ real time since `/run/start`, gold ≤ 12/s, kills ≤ 20/s, PvP kills ≤ 4/min, one claim per run,
  4 s between runs. Shop purchases are atomic on the server. Suspicious results are flagged; 3 flags hide a player from the board.

| Endpoint | |
|---|---|
| `GET /api/health` | health check |
| `GET /api/leaderboard` | top 10 survival, top 5 PvP |
| `POST /api/profile` *(signed)* | create/load profile |
| `POST /api/run/start` *(signed)* | start a run → `runId` |
| `POST /api/run/end` *(signed)* | submit result → gold credited |
| `POST /api/shop/buy` *(signed)* | buy a Shrine upgrade |

```bash
npm install
npm test                                   # in-memory DB + real wallet signatures
DATABASE_URL=pgmem DEV_AUTH=1 npm run dev  # local server without a database
```

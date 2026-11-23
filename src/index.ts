// WOW SURVIVORS — a survivors-like horde game with PvP for the Wow Casino estate (base -106,76, 12 parcels)
import { engine } from '@dcl/sdk/ecs'
import { buildWorld } from './world'
import { setupGame, G } from './game/game'
import { setupUi } from './ui'
import { buildCasino } from './casino/build'
import { CORE_ONLY } from './edition'
import { buildThrone } from './throne'

export function main() {
  buildWorld()
  // WHO IS GOD? — the first God's throne at the east end of the arena
  buildThrone()
  // GOLD HOLD'EM casino at -103,78 (the WOW casino, playing for WOW gold)
  if (!CORE_ONLY) buildCasino()
  setupGame()
  setupUi()
  // chest reel animation timer
  engine.addSystem((dt) => {
    if (G.chest && G.chest.spin > 0) G.chest.spin -= dt
  })
}

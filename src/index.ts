// WOW SURVIVORS — a survivors-like horde game with PvP for the Wow Casino estate (base -106,76, 12 parcels)
import { engine } from '@dcl/sdk/ecs'
import { buildWorld } from './world'
import { setupGame, G } from './game/game'
import { setupUi } from './ui'
import { buildCasino } from './casino/build'

export function main() {
  buildWorld()
  // GOLD HOLD'EM casino at -103,78 (the GYBM casino, playing for WOW gold)
  buildCasino()
  setupGame()
  setupUi()
  // chest reel animation timer
  engine.addSystem((dt) => {
    if (G.chest && G.chest.spin > 0) G.chest.spin -= dt
  })
}

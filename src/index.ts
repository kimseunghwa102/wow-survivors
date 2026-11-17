// WOW SURVIVORS — a survivors-like horde game with PvP for the Wow Casino estate (base -106,76, 12 parcels)
import { engine } from '@dcl/sdk/ecs'
import { buildWorld } from './world'
import { setupGame, G } from './game/game'
import { setupUi } from './ui'

export function main() {
  buildWorld()
  setupGame()
  setupUi()
  // chest reel animation timer
  engine.addSystem((dt) => {
    if (G.chest && G.chest.spin > 0) G.chest.spin -= dt
  })
}

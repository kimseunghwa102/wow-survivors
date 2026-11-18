// THE PALE SOVEREIGN — co-op world-boss raid for WOW NIGHTSWARM (parcel -91,71).
// Shares the castle's save server: gold, armory, forge and relics follow you between both scenes.
import { buildWorld } from './world'
import { setupSfx } from './sfx'
import { setupGame } from './game'
import { setupUi } from './ui'

export function main() {
  setupSfx()
  buildWorld()
  setupGame()
  setupUi()
}

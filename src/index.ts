// WOW SURVIVORS — a survivors-like horde game with PvP for the Wow Casino estate (base -106,76, 12 parcels)
import { engine } from '@dcl/sdk/ecs'
import { buildWorld } from './world'
import { setupGame, G } from './game/game'
import { setupUi } from './ui'
import { buildCasino } from './casino/build'
import { CORE_ONLY } from './edition'
import { buildThrone } from './throne'
import { buildGodLounge } from './godlounge'
import { buildPetShop } from './petshop'

export function main() {
  buildWorld()
  // WHO IS GOD? — the first God's throne at the east end of the arena
  buildThrone()
  // 2F GOD LOUNGE (Lv 1111 Gods only) floating over the arena + the GOD'S ASCENT well in the Sanctuary
  buildGodLounge()
  // PET SHOP beside the WHO IS GOD throne
  buildPetShop()
  // GOLD HOLD'EM casino at -103,78 (the WOW casino, playing for WOW gold)
  if (!CORE_ONLY) buildCasino()
  setupGame()
  setupUi()
  // chest reel animation timer
  engine.addSystem((dt) => {
    if (G.chest && G.chest.spin > 0) G.chest.spin -= dt
  })
}

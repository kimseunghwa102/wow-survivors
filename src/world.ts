import { engine, Transform, GltfContainer, LightSource, SkyboxTime, TextAlignMode, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'
import LAYOUT from '../layout.json'
import { node, text, setText, hitbox, bob, V, FACE } from './helpers'
import { topRuns, topPvp } from './game/net'
import { save, loadBoard } from './game/persist'
import { G } from './game/game'

export function buildWorld() {
  // night sky
  SkyboxTime.create(engine.RootEntity, { fixedTime: 79200 })

  // all static geometry = one GLB made in Blender (blender/build_arena.py)
  const arena = engine.addEntity()
  Transform.create(arena)
  GltfContainer.create(arena, { src: 'models/arena.glb' })

  // lights: fire lamps + rune circles
  const fire = Color3.create(1, 0.6, 0.25)
  for (const [x, z] of [[24, 10], [40, 10], [24, 38], [40, 38], [8, 58], [24, 70]])
    LightSource.create(node(V(x, 4.2, z)), { type: LightSource.Type.Point({}), color: fire, intensity: 2500, range: 14 })
  const soul = Color3.create(0.55, 0.3, 1)
  LightSource.create(node(V(32, 3, 24)), { type: LightSource.Type.Point({}), color: soul, intensity: 3000, range: 16 })
  LightSource.create(node(V(16, 3, 64)), { type: LightSource.Type.Point({}), color: soul, intensity: 3000, range: 16 })
  LightSource.create(node(V(8, 4, 8)), { type: LightSource.Type.Point({}), color: Color3.create(0.6, 0.9, 1), intensity: 2500, range: 14 })

  // ── Sanctuary ──
  const title = node(V(8, 4.2, 8))
  bob(title, 0.15, 2200)
  text(V(0, 0.4, 0), 'WOW SURVIVORS', 9, '#FFD86A', { parent: title, billboard: true, outline: '#2A0A3A' })
  text(V(0, -0.45, 0), 'Survive the night. Outlast the horde. Beat your rivals.', 2.6, '#E8E2FF', { parent: title, billboard: true })
  const [hx, , hz] = LAYOUT.howto
  text(V(hx, 2.75, hz - 0.13), 'HOW TO PLAY', 4.2, '#FFD86A', { rot: FACE.south })
  text(
    V(hx - 1.95, 1.45, hz - 0.13),
    'Walk through the gate to start a run.\nYour weapons attack automatically.\nCollect gems → level up → pick upgrades.\nMax a weapon + own its partner passive,\nthen open a chest to EVOLVE it.\nElites drop chests. The Lich King: 5:00.\nOther hunters can hurt you in the arena —\nslay them for a bounty!\nThe Sanctuary is safe (run pauses).',
    2.15,
    '#FFFFFF',
    { rot: FACE.south, align: TextAlignMode.TAM_MIDDLE_LEFT }
  )
  const [sx, , sz] = LAYOUT.shrine
  const shrineHit = hitbox(V(sx, 1.4, sz), V(2.6, 2.8, 2.6))
  pointerEventsSystem.onPointerDown({ entity: shrineHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Shrine of Power — spend gold', maxDistance: 8 } }, () => {
    G.shopOpen = true
  })
  text(V(sx, 3.4, sz), 'SHRINE OF POWER', 3.2, '#5EF2FF', { billboard: true, outline: '#001A22' })

  // gate signs
  const lg = LAYOUT.lobby
  const gz = (lg.gateZ0 + lg.gateZ1) / 2
  text(V(16.0, 5.6, gz), 'THE GRAVEYARD · PvP', 3.4, '#FF5468', { rot: FACE.west, outline: '#200000' })
  text(V(16.6, 5.6, gz), 'SANCTUARY · SAFE', 3.4, '#5EF2FF', { rot: FACE.east, outline: '#001A22' })
  const lgd = LAYOUT.legends
  const gz2 = (lgd.gateZ0 + lgd.gateZ1) / 2
  text(V(47.4, 5.6, gz2), 'HALL OF LEGENDS · SAFE', 3.0, '#FFD86A', { rot: FACE.west, outline: '#2A1A00' })
  text(V(16, 9.5, 78.0), 'THE LICH KING AWAITS', 4, '#A26BFF', { outline: '#10001A' })

  // ── Hall of Legends leaderboard ──
  const [lx, , lz] = LAYOUT.leaderboard
  text(V(lx, 6.1, lz - 0.22), 'HALL OF LEGENDS', 5.5, '#FFD86A', { outline: '#2A1A00' })
  text(V(lx - 3.9, 5.35, lz - 0.22), 'LONGEST SURVIVAL (ALL-TIME)', 2.8, '#5EF2FF', { align: TextAlignMode.TAM_MIDDLE_LEFT })
  text(V(lx + 1.2, 5.35, lz - 0.22), 'TOP PvP SLAYERS', 2.8, '#FF5468', { align: TextAlignMode.TAM_MIDDLE_LEFT })
  const runsT = text(V(lx - 3.9, 3.0, lz - 0.22), '', 2.3, '#FFFFFF', { align: TextAlignMode.TAM_MIDDLE_LEFT })
  const pvpT = text(V(lx + 1.2, 3.6, lz - 0.22), '', 2.3, '#FFFFFF', { align: TextAlignMode.TAM_MIDDLE_LEFT })
  let acc = 2
  let boardT = 0
  engine.addSystem((dt) => {
    acc += dt
    boardT += dt
    if (boardT > 30) {
      boardT = 0
      void loadBoard()
    }
    if (acc < 2) return
    acc = 0
    // all-time board from the save server; falls back to this session's synced board
    const runs = save.board?.runs?.length ? save.board.runs : topRuns()
    setText(
      runsT,
      runs.length
        ? runs.slice(0, 8).map((r, i) => `${i + 1}. ${r.n.substring(0, 12)}  ${mmss(r.t)}  Lv${r.l}`).join('\n')
        : 'No legends yet.\nBe the first!'
    )
    const pv = save.board?.pvp?.length ? save.board.pvp : topPvp()
    setText(pvpT, pv.length ? pv.map(([n, k], i) => `${i + 1}. ${n.substring(0, 12)}  ${k}`).join('\n') : 'No duels yet.')
  })
}

export function mmss(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

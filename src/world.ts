import { engine, Transform, GltfContainer, LightSource, SkyboxTime, TextAlignMode, pointerEventsSystem, InputAction, Tween } from '@dcl/sdk/ecs'
import { openExternalUrl } from '~system/RestrictedActions'
import { Color3, Quaternion } from '@dcl/sdk/math'
import LAYOUT from '../layout.json'
import { node, text, setText, hitbox, bob, V, FACE } from './helpers'
import { topRuns, topPvp } from './game/net'
import { save, loadBoard } from './game/persist'
import { G, equipped } from './game/game'
import { ARMORY } from './game/defs'

export function buildWorld() {
  // night sky
  SkyboxTime.create(engine.RootEntity, { fixedTime: 79200 })

  // all static geometry = one GLB made in Blender (blender/build_arena.py)
  const arena = engine.addEntity()
  Transform.create(arena)
  GltfContainer.create(arena, { src: 'models/arena.glb' })

  // floating rift cores above each rune circle (Blender GLB, slow spin)
  for (const [x, y, z] of [[32, 7.5, 24], [16, 7.5, 64]]) {
    const holder = node(V(x, y, z))
    bob(holder, 0.35, 3200)
    const core = node(V(0, 0, 0), undefined, holder)
    GltfContainer.create(core, { src: 'models/rift_core.glb' })
    Tween.setRotateContinuous(core, Quaternion.fromEulerDegrees(0, 1, 0), 25)
  }

  // lights: fire lamps, rift cores, gates, cathedral
  const fire = Color3.create(1, 0.55, 0.22)
  for (const [x, z] of [[24, 10], [40, 10], [24, 38], [40, 38], [8, 58], [24, 70]])
    LightSource.create(node(V(x, 4.2, z)), { type: LightSource.Type.Point({}), color: fire, intensity: 2200, range: 14 })
  const soul = Color3.create(0.6, 0.3, 1)
  LightSource.create(node(V(32, 6, 24)), { type: LightSource.Type.Point({}), color: soul, intensity: 5000, range: 20 })
  LightSource.create(node(V(16, 6, 64)), { type: LightSource.Type.Point({}), color: soul, intensity: 5000, range: 20 })
  LightSource.create(node(V(16, 6, 74)), { type: LightSource.Type.Point({}), color: Color3.create(0.75, 0.35, 1), intensity: 3500, range: 16 })
  // warm lantern light under each dome's oculus ring
  LightSource.create(node(V(32, 14, 24)), { type: LightSource.Type.Point({}), color: fire, intensity: 6000, range: 24 })
  LightSource.create(node(V(16, 13, 64)), { type: LightSource.Type.Point({}), color: fire, intensity: 5000, range: 20 })
  LightSource.create(node(V(8, 4, 8)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.8, 0.45), intensity: 2500, range: 14 })
  LightSource.create(node(V(56, 4, 40)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.8, 0.45), intensity: 2200, range: 12 })

  // ── Sanctuary ──
  const title = node(V(8, 4.2, 8))
  bob(title, 0.15, 2200)
  text(V(0, 0.4, 0), 'WOW NIGHTSWARM', 9, '#FFD86A', { parent: title, billboard: true, outline: '#2A0A3A' })
  text(V(0, -0.45, 0), 'Hold the rift. Break the swarm. Hunt your rivals.', 2.6, '#E8E2FF', { parent: title, billboard: true })
  const [hx, , hz] = LAYOUT.howto
  text(V(hx, 2.75, hz - 0.13), 'HOW TO PLAY', 4.2, '#FFD86A', { rot: FACE.south })
  text(
    V(hx - 1.95, 1.45, hz - 0.13),
    'Walk through the gate to start a run.\nSkills fire on their own · HOLD LEFT CLICK to\nattack with your Armory weapon · F = nuke.\nGems → level up → upgrades. Max a skill + its\npartner passive, open a vault to ASCEND it.\nA BOSS rises every few levels — dragons from\nLv 50, the World Eater at Lv 200, then endless.\nClaim your DAILY reward · first run = 2x gold.\nOther hunters can hurt you in the rift!',
    2.15,
    '#FFFFFF',
    { rot: FACE.south, align: TextAlignMode.TAM_MIDDLE_LEFT }
  )
  const [sx, , sz] = LAYOUT.shrine
  const shrineHit = hitbox(V(sx, 1.4, sz), V(2.6, 2.8, 2.6))
  pointerEventsSystem.onPointerDown({ entity: shrineHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Arcane Forge — spend gold', maxDistance: 8 } }, () => {
    G.shopOpen = true
  })
  text(V(sx, 3.4, sz), 'ARCANE FORGE', 3.2, '#5EF2FF', { billboard: true, outline: '#001A22' })

  // creator credit at the spawn point — click to open X
  const xHolder = node(V(10.6, 2.4, 2.2))
  bob(xHolder, 0.08, 2600)
  text(V(0, 0.45, 0), 'Created by', 1.6, '#CFC8E8', { billboard: true, parent: xHolder })
  text(V(0, 0, 0), 'X / Twitter  @bitcoinisnotall', 3.4, '#FFFFFF', { billboard: true, outline: '#1D9BF0', parent: xHolder })
  text(V(0, -0.45, 0), 'click to follow', 1.4, '#1D9BF0', { billboard: true, parent: xHolder })
  const xHit = hitbox(V(10.6, 2.4, 2.2), V(3.4, 1.6, 1.0))
  pointerEventsSystem.onPointerDown({ entity: xHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Follow @bitcoinisnotall on X', maxDistance: 12 } }, () => {
    void openExternalUrl({ url: 'https://x.com/bitcoinisnotall' })
  })

  // Armory: the weapon you'd swing floats over a pedestal; click to open the shop
  const [ax, , az] = LAYOUT.armory
  const showHolder = node(V(ax, 1.7, az))
  bob(showHolder, 0.15, 1800)
  const show = node(V(0, 0, 0), undefined, showHolder, V(1.4, 1.4, 1.4))
  Tween.setRotateContinuous(show, Quaternion.fromEulerDegrees(0, 1, 0), 60)
  let shown = -1
  engine.addSystem(() => {
    const t = equipped()
    if (t !== shown) {
      shown = t
      GltfContainer.createOrReplace(show, { src: ARMORY[t].model })
    }
  })
  const armHit = hitbox(V(ax, 1.3, az), V(2.4, 2.6, 2.4))
  pointerEventsSystem.onPointerDown({ entity: armHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Armory — your own weapons', maxDistance: 8 } }, () => {
    G.armoryOpen = true
  })
  text(V(ax, 3.1, az), 'ARMORY', 3.2, '#FFB84A', { billboard: true, outline: '#2A1400' })
  text(V(ax, 2.7, az), 'fists → pan → hammer → swords → minigun → ☢', 1.6, '#FFFFFF', { billboard: true })

  // gate signs
  const lg = LAYOUT.lobby
  const gz = (lg.gateZ0 + lg.gateZ1) / 2
  text(V(15.84, 8.3, gz), 'THE RIFT · PvP', 3.4, '#FF5468', { rot: FACE.west, outline: '#200000' })
  text(V(17.48, 8.3, gz), 'SANCTUARY · SAFE', 3.4, '#5EF2FF', { rot: FACE.east, outline: '#001A22' })
  const lgd = LAYOUT.legends
  const gz2 = (lgd.gateZ0 + lgd.gateZ1) / 2
  text(V(46.44, 8.3, gz2), 'HALL OF LEGENDS · SAFE', 3.0, '#FFD86A', { rot: FACE.west, outline: '#2A1A00' })
  text(V(16, 10.4, 78.22), 'THE HOLLOW KING AWAITS', 4, '#C79BFF', { outline: '#10001A' })

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

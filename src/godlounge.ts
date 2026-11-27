// 2F GOD LOUNGE — a floating sky island 40 m above the arena (x16–48, z0–32 = parcels -105..-104 × 76..77).
// Only GODs (hunters who defeated THE ALMIGHTY at Lv 1111) may enter. The GOD'S ASCENT well in the centre of the
// Sanctuary swallows them in a vortex and lifts them up with no loading screen (movePlayerTo inside this scene).
// Up there: the sealed GATE TO THE LAND OF THE GODS (-27,128), THE DIVINE VAULT (god-only wearables, not yet
// revealed), THE PANTHEON (every God's name) and the DESCENT well back down.
// Static art: models/god_lounge.glb (blender/build_godlounge.py).
import { engine, Transform, GltfContainer, LightSource, Tween, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { movePlayerTo, teleportTo } from '~system/RestrictedActions'
import { getPlayer } from '@dcl/sdk/players'
import { node, text, setText, bob, hitbox, V, FACE } from './helpers'
import { G, banner } from './game/game'
import { save } from './game/persist'
import { play } from './game/sfx'

export const LY = 40 // lounge floor
const AREA = { x0: 16, x1: 48, z0: 0, z1: 32 }
const LOBBY_WELL = V(8, 0, 8)
const DESCENT = V(24, LY, 8.5)
const UP_TO = V(32, LY + 0.4, 6.8)
const UP_LOOK = V(32, LY + 5, 23.6)
const DOWN_TO = V(8, 0.3, 4.6)
const DOWN_LOOK = V(8, 1.6, 12)
const GATE = V(32, LY, 23.6)
const WELL_R = 1.4
/** the Land of the Gods estate (-27,128) — flip to true when it is built and the gate should open */
export const LAND_OF_GODS_OPEN = false
const LAND = { x: -27, y: 128 }
/** the creator may walk in to look after the lounge */
const CREATOR = '0xfefb65dfd2bcb24269b944e34388f6748e38a6a8'

/** warp state, read by the UI overlay (src/ui.tsx WarpOverlay) */
export const WARP = { on: false, t: 0, dir: 'up' as 'up' | 'down', moved: false }
export const WARP_SWALLOW = 1.1 // seconds until the screen is swallowed and you move
export const WARP_LEN = 2.1

function mayEnter() {
  if (G.isGod) return true
  const id = (getPlayer()?.userId ?? '').toLowerCase()
  return id === CREATOR
}

function spin(src: string, pos: Vector3, axis: Vector3, speed: number) {
  const e = node(pos)
  GltfContainer.create(e, { src })
  Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(axis.x, axis.y, axis.z), speed)
  return e
}

export function buildGodLounge() {
  // ── the island ──
  const isl = engine.addEntity()
  Transform.create(isl)
  GltfContainer.create(isl, { src: 'models/god_lounge.glb' })
  const orb = node(V(32, LY + 14, 16))
  bob(orb, 0.5, 4200)
  const orr = node(V(0, 0, 0), undefined, orb)
  GltfContainer.create(orr, { src: 'models/god_orrery.glb' })
  Tween.setRotateContinuous(orr, Quaternion.fromEulerDegrees(0, 1, 0), 12)

  const gold = Color3.create(1, 0.78, 0.45)
  LightSource.create(node(V(32, LY + 6, 15)), { type: LightSource.Type.Point({}), color: gold, intensity: 7000, range: 24 })
  LightSource.create(node(V(32, LY + 5, 19.5)), { type: LightSource.Type.Point({}), color: gold, intensity: 6000, range: 16 })
  LightSource.create(node(V(39.5, LY + 3.5, 16)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.7, 0.4), intensity: 4000, range: 13 })
  LightSource.create(node(V(23, LY + 3, 16.5)), { type: LightSource.Type.Point({}), color: gold, intensity: 2500, range: 10 })

  // ── NORTH: the sealed gate to the Land of the Gods ──
  spin('models/god_portal_fx.glb', V(GATE.x, LY + 0.9 + 4.7, GATE.z), V(0, 0, 1), 18)
  text(V(GATE.x, LY + 14.9, GATE.z - 0.6), 'LAND OF THE GODS', 7, '#FFE9A8', { rot: FACE.south, outline: '#3A2400' })
  text(V(GATE.x, LY + 14.0, GATE.z - 0.6), '-27,128  ·  a kingdom ruled by a man who became a god', 2.2, '#FFF6D8', { rot: FACE.south, outline: '#2A1A00' })
  const sealT = text(V(GATE.x, LY + 1.75, GATE.z - 5.3), '⛓ SEALED ⛓\nthe gate awakens soon', 2.6, '#FF9A6A', { rot: FACE.south, outline: '#2A0800' })
  bob(sealT, 0.08, 2600)
  const gateHit = hitbox(V(GATE.x, LY + 5.6, GATE.z - 0.9), V(9, 10, 0.6))
  pointerEventsSystem.onPointerDown(
    { entity: gateHit, opts: { button: InputAction.IA_POINTER, hoverText: LAND_OF_GODS_OPEN ? 'Enter the Land of the Gods (-27,128)' : 'The gate is sealed…', maxDistance: 14 } },
    () => {
      if (LAND_OF_GODS_OPEN) {
        void teleportTo({ worldCoordinates: LAND })
        return
      }
      play('warn')
      banner('⛓ THE GATE IS SEALED ⛓  The LAND OF THE GODS (-27,128) awakens soon.', 4)
    }
  )

  // ── EAST: THE DIVINE VAULT ──
  text(V(44.35, LY + 6.45, 16), 'THE DIVINE VAULT', 4.6, '#FFD86A', { rot: FACE.west, outline: '#2A1A00' })
  text(V(44.35, LY + 5.85, 16), 'wearables only a GOD can claim  ·  unveiling soon', 1.8, '#F3E6FF', { rot: FACE.west, outline: '#14001E' })
  const VA = [-40, -20, 0, 20, 40]
  for (let i = 0; i < VA.length; i++) {
    const a = (VA[i] * Math.PI) / 180
    const x = 32 + Math.cos(a) * 10.6
    const z = 16 + Math.sin(a) * 10.6
    const q = node(V(x, LY + 3.75, z))
    bob(q, 0.1, 2200 + i * 260)
    text(V(0, 0.2, 0), '?', 6, '#FFD86A', { parent: q, billboard: true, outline: '#3A2400' })
    text(V(x, LY + 3.38, z), 'GOD-ONLY · Lv 1111', 1.3, '#FFF1C8', { billboard: true, outline: '#2A1A00' })
  }
  text(V(32 + 8.0, LY + 1.5, 16), 'CLOSED · COMING SOON', 2.2, '#FFB4C0', { rot: FACE.west, outline: '#2A0008' })

  // ── WEST: THE PANTHEON (the names of every God) ──
  const panT = node(V(23, LY + 3.45, 16.5))
  bob(panT, 0.1, 3000)
  text(V(0, 0.5, 0), '☀ THE PANTHEON ☀', 3, '#FFD86A', { parent: panT, billboard: true, outline: '#2A1A00' })
  const names = text(V(0, -0.15, 0), '', 1.9, '#FFF6D8', { parent: panT, billboard: true, outline: '#2A1A00' })

  // ── SOUTH: arrival + the DESCENT well ──
  const hello = node(V(32, LY + 4.1, 9.6))
  bob(hello, 0.12, 2800)
  text(V(0, 0.35, 0), '2F · GOD LOUNGE', 4.2, '#FFE9A8', { parent: hello, rot: FACE.south, outline: '#3A2400' })
  text(V(0, -0.35, 0), 'only those who became GOD stand here', 1.7, '#FFFFFF', { parent: hello, rot: FACE.south, outline: '#2A1A00' })
  spin('models/ascent_fx.glb', V(DESCENT.x, LY + 0.06, DESCENT.z), V(0, -1, 0), 40)
  text(V(DESCENT.x, LY + 2.3, DESCENT.z), '▼ DESCENT ▼\nback to the Sanctuary', 1.8, '#D8C0FF', { billboard: true, outline: '#14001E' })

  // ── the Sanctuary: GOD'S ASCENT well ──
  const well = node(LOBBY_WELL)
  GltfContainer.create(well, { src: 'models/ascent_well.glb' })
  spin('models/ascent_fx.glb', V(LOBBY_WELL.x, 0.24, LOBBY_WELL.z), V(0, 1, 0), 50)
  LightSource.create(node(V(LOBBY_WELL.x, 1.8, LOBBY_WELL.z)), { type: LightSource.Type.Point({}), color: Color3.create(0.75, 0.5, 1), intensity: 2500, range: 8 })
  text(V(LOBBY_WELL.x, 3.05, LOBBY_WELL.z), "✦ GOD'S ASCENT ✦", 2.6, '#FFE9A8', { billboard: true, outline: '#3A2400' })
  text(V(LOBBY_WELL.x, 2.55, LOBBY_WELL.z), 'step in to rise to the 2F GOD LOUNGE\nLv 1111 GODs only', 1.35, '#E8DAFF', { billboard: true, outline: '#14001E' })

  let deny = 0
  let cool = 0
  let kick = 0
  let acc = 3
  engine.addSystem((dt) => {
    deny -= dt
    cool -= dt
    kick -= dt
    acc += dt
    if (acc > 3) {
      acc = 0
      const g = save.board?.gods ?? []
      setText(names, g.length ? g.slice(0, 12).join('\n') : 'no God yet')
    }
    if (WARP.on) {
      WARP.t += dt
      if (!WARP.moved && WARP.t >= WARP_SWALLOW) {
        WARP.moved = true
        const up = WARP.dir === 'up'
        void movePlayerTo({ newRelativePosition: up ? UP_TO : DOWN_TO, cameraTarget: up ? UP_LOOK : DOWN_LOOK })
        banner(up ? '✦ WELCOME, GOD ✦  2F · GOD LOUNGE' : 'back in the Sanctuary', 3)
      }
      if (WARP.t >= WARP_LEN) {
        WARP.on = false
        cool = 2.5
      }
      return
    }
    const pt = Transform.getOrNull(engine.PlayerEntity)
    if (!pt) return
    const p = pt.position
    const inLounge = p.y > LY - 3 && p.x > AREA.x0 && p.x < AREA.x1 && p.z > AREA.z0 && p.z < AREA.z1
    // somebody who isn't a God got up here (shouldn't happen) → back down
    if (inLounge && !mayEnter()) {
      if (kick <= 0) {
        kick = 3
        void movePlayerTo({ newRelativePosition: DOWN_TO, cameraTarget: DOWN_LOOK })
      }
      return
    }
    if (cool > 0) return
    if (p.y < 2.5 && Math.hypot(p.x - LOBBY_WELL.x, p.z - LOBBY_WELL.z) < WELL_R) {
      if (G.phase === 'running' || G.phase === 'levelup' || G.phase === 'chest' || G.phase === 'forge') return
      if (mayEnter()) startWarp('up')
      else if (deny <= 0) {
        deny = 5
        play('warn')
        banner("✦ GOD'S ASCENT ✦  Only GODs may rise — defeat THE ALMIGHTY at Lv 1111.", 4)
      }
      return
    }
    if (inLounge && Math.hypot(p.x - DESCENT.x, p.z - DESCENT.z) < WELL_R) startWarp('down')
  })
}

function startWarp(dir: 'up' | 'down') {
  WARP.on = true
  WARP.t = 0
  WARP.dir = dir
  WARP.moved = false
  play('warp')
}

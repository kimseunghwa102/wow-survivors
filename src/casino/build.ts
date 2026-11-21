import {
  engine,
  Entity,
  Transform,
  GltfContainer,
  ColliderLayer,
  MeshCollider,
  VisibilityComponent,
  TextShape,
  Billboard,
  BillboardMode,
  pointerEventsSystem,
  InputAction,
  LightSource,
  AudioSource,
  Tween,
  TweenSequence,
  TweenLoop,
  EasingFunction
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math'
import { teleportTo } from '~system/RestrictedActions'
import { buildTable, renderTable } from './holdem/table'
import { startUi } from './holdem/ui'
import { startNet } from './holdem/net'

// ═════════════════ 설정 ═════════════════
const MUSIC = 'sounds/casino/lounge.mp3'
const CHIME = 'sounds/casino/chime.mp3'
const H = 6 // 천장 높이
const V = Vector3.create
const hex4 = Color4.fromHexString
const hex3 = Color3.fromHexString

// 텍스트 방향: rotY=0 → +z를 바라보는 사람이 읽음 / 90 → +x / -90 → -x

// ═════════════════ 헬퍼 ═════════════════
// Blender→DCL 변환 시 모델이 Y축 기준 180° 돌아가므로 되돌려서 배치
const FLIP = Quaternion.fromEulerDegrees(0, 180, 0)
// 파셀 경계(0~16m)에 딱 붙은 벽이 경계 밖으로 판정되지 않도록 0.2% 안쪽으로
const IN_S = 0.998
const IN_SCALE = V(IN_S, 1, IN_S)
const IN_POS = V(8 * (1 - IN_S), 0, 8 * (1 - IN_S))
function model(src: string, pos: Vector3, physics = false, scale = Vector3.One()) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, rotation: FLIP, scale })
  GltfContainer.create(e, {
    src,
    visibleMeshesCollisionMask: physics ? ColliderLayer.CL_PHYSICS : ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  return e
}

/** 클릭 영역 (보이지 않는 박스 콜라이더) */
function hotspot(pos: Vector3, scale: Vector3, hover: string, onClick: () => void, maxDistance = 8) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, scale })
  MeshCollider.setBox(e, ColliderLayer.CL_POINTER)
  pointerEventsSystem.onPointerDown({ entity: e, opts: { button: InputAction.IA_POINTER, hoverText: hover, maxDistance } }, onClick)
  return e
}

function text(pos: Vector3, value: string, size: number, color: Color4, rotY = 0, billboard = false, outline = Color3.Black()) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, rotation: Quaternion.fromEulerDegrees(0, rotY, 0) })
  TextShape.create(e, { text: value, fontSize: size, textColor: color, outlineWidth: 0.15, outlineColor: outline })
  if (billboard) Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
  return e
}

const spinners: { e: Entity; axis: Vector3; speed: number }[] = []
const spin = (e: Entity, axis: Vector3, speed: number) => spinners.push({ e, axis, speed })

let chimeEntity: Entity
function playChime(at: Vector3) {
  Transform.createOrReplace(chimeEntity, { position: at, parent: root })
  AudioSource.createOrReplace(chimeEntity, { audioClipUrl: CHIME, playing: true, loop: false, volume: 0.9 })
}
// ═════════════════ placement inside WOW NIGHTSWARM ═════════════════
// The GYBM casino is built in its own 16×16 frame (entrance at z=0) and set into parcel -103,78
// (scene-local x48–64, z32–48), turned so the entrance faces the arena gate on the west side.
export const CASINO_ROOT = { x: 48, z: 48, yaw: 90 }
let root: Entity
/** world (scene) position → casino frame */
export function toCasino(x: number, z: number) {
  const dx = x - CASINO_ROOT.x
  const dz = z - CASINO_ROOT.z
  // inverse of a +90° turn: world (dx, dz) = (lz, -lx)
  return { x: -dz, z: dx }
}
export function inCasino(x: number, z: number) {
  return x >= 48 && x <= 64 && z >= 32 && z <= 48
}

// ═════════════════ 씬 ═════════════════
export function buildCasino() {
  const before = new Set<Entity>()
  for (const [e] of engine.getEntitiesWith(Transform)) before.add(e)
  root = engine.addEntity()
  Transform.create(root, { position: V(CASINO_ROOT.x, 0, CASINO_ROOT.z), rotation: Quaternion.fromEulerDegrees(0, CASINO_ROOT.yaw, 0) })
  build()
  // everything the casino just created lives in the casino frame
  for (const [e, t] of engine.getEntitiesWith(Transform)) if (e !== root && !before.has(e) && !t.parent) Transform.getMutable(e).parent = root
}

function build() {
  chimeEntity = engine.addEntity()

  // ── 3D 모델 (Blender 제작) ──
  model('models/casino/casino_static.glb', IN_POS, true, IN_SCALE)

  const chandelier = model('models/casino/chandelier.glb', V(8, H - 0.05, 10))
  spin(chandelier, V(0, 1, 0), 8)

  const roulette = model('models/casino/roulette.glb', V(8, 2.85, 15.68))
  spin(roulette, V(0, 0, 1), 26)

  // 마키 전구: 두 세트를 번갈아 켜서 체이싱 효과
  const bulbsA = model('models/casino/bulbs_a.glb', IN_POS, false, IN_SCALE)
  const bulbsB = model('models/casino/bulbs_b.glb', IN_POS, false, IN_SCALE)
  VisibilityComponent.create(bulbsA, { visible: true })
  VisibilityComponent.create(bulbsB, { visible: false })
  let blinkT = 0
  let flip = false
  engine.addSystem((dt) => {
    blinkT += dt
    if (blinkT < 0.35) return
    blinkT = 0
    flip = !flip
    VisibilityComponent.getMutable(bulbsA).visible = !flip
    VisibilityComponent.getMutable(bulbsB).visible = flip
  })

  // ── GOLD HOLD'EM (WOW gold, shared with the GYBM casino at -76,-48) ──
  buildTable()
  startUi()
  startNet()
  engine.addSystem(() => renderTable())

  // ── portal to the GYBM casino (-76,-48): same table, same gold ──
  const gate = engine.addEntity()
  Transform.create(gate, { position: V(13.6, 0, 1.3), rotation: Quaternion.fromEulerDegrees(0, 180, 0), scale: V(0.55, 0.55, 0.55) })
  GltfContainer.create(gate, { src: 'models/raid_gate.glb', visibleMeshesCollisionMask: ColliderLayer.CL_NONE, invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
  text(V(13.6, 3.1, 1.25), 'GYBM CASINO\n-76,-48', 0.9, hex4('#FFD700FF'), 0, true)
  hotspot(V(13.6, 1.2, 1.3), V(1.8, 2.4, 0.8), 'Portal to the GYBM Casino (same table, same gold)', () => {
    playChime(V(13.6, 1, 1.3))
    void teleportTo({ worldCoordinates: { x: -76, y: -48 } })
  }, 6)


  // ── 슬롯머신 (무료 재미용) ──
  const symbols = ['7', 'BAR', '$', 'K', 'A', '*']
  for (const z of [6.4, 9.4, 12.4]) {
    const result = text(V(14.62, 1.95, z), 'SPIN ME', 0.7, Color4.White(), 90)
    hotspot(V(15.2, 1.0, z), V(1.0, 2.0, 1.2), 'Spin (just for fun)', () => {
      const pick = () => symbols[Math.floor(Math.random() * symbols.length)]
      let a = pick(),
        b = pick(),
        c = pick()
      if (Math.random() < 0.18) b = c = a
      const win = a === b && b === c
      const t = TextShape.getMutable(result)
      t.text = win ? `JACKPOT!  ${a} ${b} ${c}` : `${a}  ${b}  ${c}`
      t.textColor = win ? hex4('#FF4FA3FF') : hex4('#FFE082FF')
      if (win) playChime(V(15, 1.5, z))
    }, 6)
  }

  // ── 조명 ──
  const point = (pos: Vector3, color: string, intensity: number, range: number) => {
    const e = engine.addEntity()
    Transform.create(e, { position: pos })
    LightSource.create(e, { type: LightSource.Type.Point({}), color: hex3(color), intensity, range })
  }
  point(V(8, 3.6, 10), '#FFD9A6', 30000, 11)
  point(V(8, 4.0, 1.4), '#FFC870', 16000, 8)
  point(V(1.8, 4.0, 10), '#FF5FA8', 9000, 7)
  point(V(14.2, 4.0, 9.4), '#7C9BFF', 9000, 7)

  const spots: { e: Entity; base: number }[] = []
  for (const [x, col, base] of [
    [4, '#FF3EA5', 0],
    [12, '#3EE7FF', 180]
  ] as [number, string, number][]) {
    const e = engine.addEntity()
    Transform.create(e, { position: V(x, H - 0.3, 12), rotation: Quaternion.fromEulerDegrees(70, base, 0) })
    LightSource.create(e, { type: LightSource.Type.Spot({ innerAngle: 15, outerAngle: 28 }), color: hex3(col), intensity: 25000, range: 14 })
    spots.push({ e, base })
  }
  let t = 0
  engine.addSystem((dt) => {
    t += dt
    spots.forEach((s, i) => {
      Transform.getMutable(s.e).rotation = Quaternion.fromEulerDegrees(65 + Math.sin(t * 0.9 + i * 2) * 15, s.base + Math.sin(t * 0.6 + i) * 70, 0)
    })
    for (const s of spinners) {
      const tr = Transform.getMutable(s.e)
      tr.rotation = Quaternion.multiply(tr.rotation, Quaternion.fromEulerDegrees(s.axis.x * s.speed * dt, s.axis.y * s.speed * dt, s.axis.z * s.speed * dt))
    }
  })

  // ── 배경음악 (오리지널 라운지 재즈 루프) ──
  const music = engine.addEntity()
  Transform.create(music, { position: V(8, 2, 9) })
  AudioSource.create(music, { audioClipUrl: MUSIC, playing: true, loop: true, volume: 0.6, global: false })
}

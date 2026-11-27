// SOULBOUND PET visuals: the tamed monster walks beside its hunter (in the Sanctuary, the God Lounge and in runs),
// grows with every soul it is fed, wears a glowing ring in the colour of its strongest fused soul, and carries
// spirit-copies of the two monsters fused into it most, circling around it.
import { engine, Entity, Transform, GltfContainer, Animator, MeshRenderer, Material, MaterialTransparencyMode, Tween, TextShape, Billboard, BillboardMode, Font } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ENEMIES, PetStats, PET_INFO, PetKind } from './defs'
import type { Run } from './core'

const HIDE = Vector3.create(0, -60, 0)
let root: Entity
let body: Entity
let model: Entity
let ring: Entity
let orbit: Entity
let tag: Entity
const spirits: Entity[] = []
let shownKey = ''
let px = 0
let pz = 0
let yaw = 0
let placed = false
let hop = 0

const col4 = (h: string, a = 1) => {
  const c = Color4.fromHexString(h)
  return Color4.create(c.r, c.g, c.b, a)
}

export function setupPetView() {
  root = engine.addEntity()
  Transform.create(root, { position: HIDE })
  body = engine.addEntity()
  Transform.create(body, { parent: root })
  model = engine.addEntity()
  Transform.create(model, { parent: body })
  ring = engine.addEntity()
  Transform.create(ring, { parent: root, position: Vector3.create(0, 0.04, 0), rotation: Quaternion.fromEulerDegrees(90, 0, 0) })
  MeshRenderer.setPlane(ring)
  orbit = engine.addEntity()
  Transform.create(orbit, { parent: root })
  Tween.setRotateContinuous(orbit, Quaternion.fromEulerDegrees(0, 1, 0), 60)
  for (let i = 0; i < 2; i++) {
    const s = engine.addEntity()
    Transform.create(s, { parent: orbit, position: HIDE })
    spirits.push(s)
  }
  tag = engine.addEntity()
  Transform.create(tag, { parent: root, position: Vector3.create(0, 1.6, 0) })
  TextShape.create(tag, { text: '', fontSize: 1.6, textColor: Color4.White(), font: Font.F_SANS_SERIF, outlineWidth: 0.15, outlineColor: Color3.Black() })
  Billboard.create(tag, { billboardMode: BillboardMode.BM_Y })
}

function dress(p: PetStats) {
  const key = `${p.base}|${p.lvl}|${p.color}|${p.shares.slice(0, 3).map(([k]) => k).join(',')}`
  if (key === shownKey) return
  const first = !shownKey
  shownKey = key
  if (first || GltfContainer.getOrNull(model)?.src !== ENEMIES[p.base].model) {
    GltfContainer.createOrReplace(model, { src: ENEMIES[p.base].model })
    Animator.createOrReplace(model, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 1 }] })
  }
  const sc = p.scale * ENEMIES[p.base].scale
  Transform.getMutable(model).scale = Vector3.create(sc, sc, sc)
  const rs = 1.2 + p.scale * 1.1
  Transform.getMutable(ring).scale = Vector3.create(rs, rs, 1)
  Material.setPbrMaterial(ring, {
    texture: Material.Texture.Common({ src: 'images/ring.png' }),
    albedoColor: col4(p.color, 0.9),
    emissiveColor: Color3.fromHexString(p.color),
    emissiveIntensity: 2.5,
    emissiveTexture: Material.Texture.Common({ src: 'images/ring.png' }),
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
  })
  // spirit-copies of the two strongest fused souls (not the base kind)
  const fused = p.shares.filter(([k, f]) => k !== p.base && f >= 0.08).slice(0, 2)
  spirits.forEach((s, i) => {
    const f = fused[i]
    if (!f) {
      Transform.getMutable(s).position = HIDE
      return
    }
    const k = f[0] as PetKind
    GltfContainer.createOrReplace(s, { src: ENEMIES[k].model })
    Animator.createOrReplace(s, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 1.3 }] })
    const r = 0.9 + p.scale * 0.8
    const ss = Math.max(0.25, p.scale * 0.32)
    const t = Transform.getMutable(s)
    t.position = Vector3.create(i ? -r : r, 0.6 + p.scale * 0.5, 0)
    t.scale = Vector3.create(ss, ss, ss)
  })
  Transform.getMutable(tag).position = Vector3.create(0, 0.9 + p.scale * 1.7, 0)
  TextShape.getMutable(tag).text = `${p.name}  ·  Lv ${p.lvl}`
  TextShape.getMutable(tag).textColor = col4(PET_INFO[p.base].color)
}

/** call every frame; pet = null hides it */
export function renderPet(pet: PetStats | null, run: Run | null, inRun: boolean, dt: number) {
  if (!root) return
  if (!pet) {
    if (shownKey) {
      Transform.getMutable(root).position = HIDE
      shownKey = ''
    }
    placed = false
    return
  }
  dress(pet)
  const pt = Transform.getOrNull(engine.PlayerEntity)
  if (!pt) return
  const ground = pt.position.y > 30 ? 40 : 0
  let tx: number
  let tz: number
  let ty = yaw
  if (inRun && run && run.pet) {
    tx = run.petX
    tz = run.petZ
    ty = run.petYaw
  } else {
    // stroll behind the hunter
    const f = Vector3.rotate(Vector3.Forward(), pt.rotation)
    const off = 1.2 + pet.scale * 0.6
    tx = pt.position.x - f.x * off * 0.7 + f.z * off * 0.7
    tz = pt.position.z - f.z * off * 0.7 - f.x * off * 0.7
    const d = Math.hypot(tx - px, tz - pz)
    if (d > 0.3) ty = (Math.atan2(tx - px, tz - pz) * 180) / Math.PI
  }
  if (!placed || Math.hypot(tx - px, tz - pz) > 30) {
    px = tx
    pz = tz
    placed = true
  }
  const k = Math.min(1, dt * (inRun ? 14 : 4))
  const moving = Math.hypot(tx - px, tz - pz) > 0.2
  px += (tx - px) * k
  pz += (tz - pz) * k
  let dy = ty - yaw
  while (dy > 180) dy -= 360
  while (dy < -180) dy += 360
  yaw += dy * Math.min(1, dt * 8)
  hop += dt * (moving ? 9 : 3)
  const t = Transform.getMutable(root)
  t.position = Vector3.create(px, ground, pz)
  Transform.getMutable(body).rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
  Transform.getMutable(body).position = Vector3.create(0, Math.abs(Math.sin(hop)) * (moving ? 0.12 : 0.03) * pet.scale, 0)
}

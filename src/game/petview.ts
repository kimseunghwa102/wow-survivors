// SOULBOUND PET visuals: a tamed monster walking beside its hunter (in the Sanctuary, the God Lounge and in runs).
// It grows with every soul it is fed, wears a glowing ring in the colour of its strongest fused soul, and carries
// spirit-copies of the two monsters fused into it most, circling around it.
// One PetVis per hunter: yours (renderPet) and every other hunter's (net.ts, from the pet token in their status).
import { engine, Entity, Transform, GltfContainer, Animator, MeshRenderer, Material, MaterialTransparencyMode, Tween, TextShape, Billboard, BillboardMode, Font } from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { ENEMIES, PetStats, PET_INFO, PetKind, PetLook, petLook, petModel, petModelScale, petScale } from './defs'
import type { Run } from './core'

const HIDE = Vector3.create(0, -60, 0)
const col4 = (h: string, a = 1) => {
  const c = Color4.fromHexString(h)
  return Color4.create(c.r, c.g, c.b, a)
}

export class PetVis {
  root: Entity
  body: Entity
  model: Entity
  ring: Entity
  orbit: Entity
  tag: Entity
  spirits: Entity[] = []
  key = ''
  src = ''
  px = 0
  pz = 0
  yaw = 0
  placed = false
  hop = 0
  scale = 1

  constructor(withTag = true) {
    this.root = engine.addEntity()
    Transform.create(this.root, { position: HIDE })
    this.body = engine.addEntity()
    Transform.create(this.body, { parent: this.root })
    this.model = engine.addEntity()
    Transform.create(this.model, { parent: this.body })
    this.ring = engine.addEntity()
    Transform.create(this.ring, { parent: this.root, position: Vector3.create(0, 0.04, 0), rotation: Quaternion.fromEulerDegrees(90, 0, 0) })
    MeshRenderer.setPlane(this.ring)
    this.orbit = engine.addEntity()
    Transform.create(this.orbit, { parent: this.root })
    Tween.setRotateContinuous(this.orbit, Quaternion.fromEulerDegrees(0, 1, 0), 60)
    for (let i = 0; i < 2; i++) {
      const s = engine.addEntity()
      Transform.create(s, { parent: this.orbit, position: HIDE })
      this.spirits.push(s)
    }
    this.tag = engine.addEntity()
    Transform.create(this.tag, { parent: this.root, position: Vector3.create(0, 1.6, 0) })
    TextShape.create(this.tag, { text: '', fontSize: withTag ? 1.6 : 0.01, textColor: Color4.White(), font: Font.F_SANS_SERIF, outlineWidth: 0.15, outlineColor: Color3.Black() })
    Billboard.create(this.tag, { billboardMode: BillboardMode.BM_Y })
  }

  dress(p: PetLook) {
    const key = `${p.base}|${p.lvl}|${p.color}|${p.spirits.join(',')}|${p.name}`
    if (key === this.key) return
    this.key = key
    const src = petModel(p.base)
    if (src !== this.src) {
      this.src = src
      GltfContainer.createOrReplace(this.model, { src })
      Animator.createOrReplace(this.model, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 1 }] })
    }
    this.scale = petScale(p.lvl)
    const sc = this.scale * petModelScale(p.base)
    Transform.getMutable(this.model).scale = Vector3.create(sc, sc, sc)
    const rs = 1.2 + this.scale * 1.1
    Transform.getMutable(this.ring).scale = Vector3.create(rs, rs, 1)
    Material.setPbrMaterial(this.ring, {
      texture: Material.Texture.Common({ src: 'images/ring.png' }),
      albedoColor: col4(p.color, 0.9),
      emissiveColor: Color3.fromHexString(p.color),
      emissiveIntensity: 2.5,
      emissiveTexture: Material.Texture.Common({ src: 'images/ring.png' }),
      transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
    })
    this.spirits.forEach((s, i) => {
      const k = p.spirits[i] as PetKind | undefined
      if (!k) {
        Transform.getMutable(s).position = HIDE
        return
      }
      GltfContainer.createOrReplace(s, { src: ENEMIES[k].model })
      Animator.createOrReplace(s, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 1.3 }] })
      const r = 0.9 + this.scale * 0.8
      const ss = Math.max(0.25, this.scale * 0.32)
      const t = Transform.getMutable(s)
      t.position = Vector3.create(i ? -r : r, 0.6 + this.scale * 0.5, 0)
      t.scale = Vector3.create(ss, ss, ss)
    })
    Transform.getMutable(this.tag).position = Vector3.create(0, 0.9 + this.scale * 1.7, 0)
    const ts = TextShape.getMutable(this.tag)
    ts.text = `${p.name}  ·  Lv ${p.lvl}`
    ts.textColor = col4(PET_INFO[p.base as PetKind | 'god']?.color ?? '#FFFFFF')
  }

  hide() {
    Transform.getMutable(this.root).position = HIDE
    this.placed = false
  }

  /** follow (ox, oz, facing) from behind-right, or go straight to (tx, tz) when given */
  move(dt: number, ground: number, owner: { x: number; z: number; fx: number; fz: number }, exact?: { x: number; z: number; yaw: number }) {
    let tx: number
    let tz: number
    let ty = this.yaw
    if (exact) {
      tx = exact.x
      tz = exact.z
      ty = exact.yaw
    } else {
      const off = 1.2 + this.scale * 0.6
      tx = owner.x - owner.fx * off * 0.7 + owner.fz * off * 0.7
      tz = owner.z - owner.fz * off * 0.7 - owner.fx * off * 0.7
      if (Math.hypot(tx - this.px, tz - this.pz) > 0.3) ty = (Math.atan2(tx - this.px, tz - this.pz) * 180) / Math.PI
    }
    if (!this.placed || Math.hypot(tx - this.px, tz - this.pz) > 30) {
      this.px = tx
      this.pz = tz
      this.placed = true
    }
    const k = Math.min(1, dt * (exact ? 14 : 4))
    const moving = Math.hypot(tx - this.px, tz - this.pz) > 0.2
    this.px += (tx - this.px) * k
    this.pz += (tz - this.pz) * k
    let dy = ty - this.yaw
    while (dy > 180) dy -= 360
    while (dy < -180) dy += 360
    this.yaw += dy * Math.min(1, dt * 8)
    this.hop += dt * (moving ? 9 : 3)
    Transform.getMutable(this.root).position = Vector3.create(this.px, ground, this.pz)
    const b = Transform.getMutable(this.body)
    b.rotation = Quaternion.fromEulerDegrees(0, this.yaw, 0)
    b.position = Vector3.create(0, Math.abs(Math.sin(this.hop)) * (moving ? 0.12 : 0.03) * this.scale, 0)
  }

  destroy() {
    for (const e of [this.root, this.body, this.model, this.ring, this.orbit, this.tag, ...this.spirits]) engine.removeEntity(e)
  }
}

let mine: PetVis | null = null
let lookCache: { s: PetStats | null; l: PetLook | null } = { s: null, l: null }
export function setupPetView() {
  mine = new PetVis()
}

/** your own pet, every frame (pet = null hides it) */
export function renderPet(pet: PetStats | null, run: Run | null, inRun: boolean, dt: number) {
  if (!mine) return
  if (!pet) {
    if (mine.key) {
      mine.hide()
      mine.key = ''
    }
    return
  }
  if (lookCache.s !== pet) lookCache = { s: pet, l: petLook(pet) }
  mine.dress(lookCache.l!)
  const pt = Transform.getOrNull(engine.PlayerEntity)
  if (!pt) return
  const f = Vector3.rotate(Vector3.Forward(), pt.rotation)
  const owner = { x: pt.position.x, z: pt.position.z, fx: f.x, fz: f.z }
  const ground = pt.position.y > 30 ? 40 : 0
  if (inRun && run && run.pet) mine.move(dt, ground, owner, { x: run.petX, z: run.petZ, yaw: run.petYaw })
  else mine.move(dt, ground, owner)
}

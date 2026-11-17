// Renders the pure simulation (core.ts) with pooled Decentraland entities.
import {
  engine, Entity, Transform, GltfContainer, Animator, MeshRenderer, Material, MaterialTransparencyMode,
  TextShape, TextAlignMode, Font, Billboard, BillboardMode, Tween
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { Run, Ev } from './core'
import { ENEMIES, EnemyKind } from './defs'

const HIDE = Vector3.create(32, -40, 24)
const V = Vector3.create
const yawQ = (deg: number) => Quaternion.fromEulerDegrees(0, deg, 0)

function ent(): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: HIDE })
  return e
}
function glow(e: Entity, hex: string, alpha = 1, strength = 3) {
  const c = Color4.fromHexString(hex)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(c.r, c.g, c.b, alpha),
    emissiveColor: Color3.create(c.r, c.g, c.b),
    emissiveIntensity: strength,
    transparencyMode: alpha < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : undefined
  })
}

class Pool {
  free: Entity[] = []
  constructor(make: () => Entity, n: number) {
    for (let i = 0; i < n; i++) this.free.push(make())
  }
  take(): Entity | undefined {
    return this.free.pop()
  }
  give(e: Entity) {
    Transform.getMutable(e).position = HIDE
    this.free.push(e)
  }
}

// ─────────────── pools ───────────────
const ENEMY_POOL: Record<EnemyKind, number> = { bat: 70, ghoul: 45, skeleton: 40, wraith: 30, elite: 3, lich: 2 }
const enemyPools = {} as Record<EnemyKind, Pool>
const enemyEnt = new Map<number, { e: Entity; kind: EnemyKind }>()

type PickVisual = 'gem_blue' | 'gem_green' | 'gem_red' | 'coin' | 'chest' | 'heal'
const pickPools = {} as Record<PickVisual, Pool>
const pickEnt = new Map<number, { e: Entity; v: PickVisual }>()

let boltPool: Pool
const boltEnt = new Map<number, Entity>()
let blades: Entity[] = []
let aura: Entity
type Timed = { e: Entity; life: number; max: number; kind: 'slash' | 'nova' | 'strike' | 'dmg'; r?: number; y?: number }
const active: Timed[] = []
let slashPool: Pool
let novaPool: Pool
let strikePool: Pool
let dmgPool: Pool

export function setupView() {
  for (const k of Object.keys(ENEMY_POOL) as EnemyKind[]) {
    enemyPools[k] = new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src: ENEMIES[k].model })
      Animator.create(e, { states: [{ clip: 'Idle', playing: true, loop: true, speed: k === 'bat' ? 1.6 : 1 }] })
      const s = ENEMIES[k].scale
      Transform.getMutable(e).scale = V(s, s, s)
      return e
    }, ENEMY_POOL[k])
  }
  const pick = (src: string, n: number, spin = 120) =>
    new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src })
      if (spin) Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), spin)
      return e
    }, n)
  pickPools.gem_blue = pick('models/gem_blue.glb', 100)
  pickPools.gem_green = pick('models/gem_green.glb', 24)
  pickPools.gem_red = pick('models/gem_red.glb', 6)
  pickPools.coin = pick('models/coin.glb', 20, 200)
  pickPools.chest = pick('models/chest.glb', 4, 30)
  pickPools.heal = new Pool(() => {
    const e = ent()
    MeshRenderer.setSphere(e)
    glow(e, '#FF3B5C', 1, 2)
    Transform.getMutable(e).scale = V(0.4, 0.4, 0.4)
    return e
  }, 4)

  boltPool = new Pool(() => {
    const e = ent()
    MeshRenderer.setSphere(e)
    glow(e, '#B98CFF', 1, 5)
    Transform.getMutable(e).scale = V(0.28, 0.28, 0.28)
    return e
  }, 50)
  for (let i = 0; i < 12; i++) {
    const e = ent()
    MeshRenderer.setBox(e)
    glow(e, '#5EF2FF', 1, 4)
    Transform.getMutable(e).scale = V(0.12, 0.08, 0.75)
    blades.push(e)
  }
  aura = ent()
  MeshRenderer.setCylinder(aura)
  glow(aura, '#FFD86A', 0.18, 2)
  slashPool = new Pool(() => {
    const e = ent()
    MeshRenderer.setBox(e)
    glow(e, '#FF3B4E', 0.55, 4)
    return e
  }, 4)
  novaPool = new Pool(() => {
    const e = ent()
    MeshRenderer.setCylinder(e)
    glow(e, '#FF8A1E', 0.35, 4)
    return e
  }, 4)
  strikePool = new Pool(() => {
    const e = ent()
    MeshRenderer.setBox(e)
    glow(e, '#BFF4FF', 0.8, 6)
    return e
  }, 12)
  dmgPool = new Pool(() => {
    const e = ent()
    TextShape.create(e, { text: '', fontSize: 3, textColor: Color4.White(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.2, outlineColor: Color3.Black() })
    Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
    return e
  }, 30)
}

function pickVisual(kind: string, value: number): PickVisual {
  if (kind === 'gem') return value <= 2 ? 'gem_blue' : value <= 20 ? 'gem_green' : 'gem_red'
  return kind as PickVisual
}

let dmgCount = 0

/** call every frame after run.step() */
export function renderRun(run: Run | null, events: Ev[], dt: number) {
  // enemies
  const seen = new Set<number>()
  if (run) {
    for (const e of run.enemies) {
      if (!e.alive) continue
      seen.add(e.id)
      let v = enemyEnt.get(e.id)
      if (!v) {
        const ent_ = enemyPools[e.kind].take()
        if (!ent_) continue
        v = { e: ent_, kind: e.kind }
        enemyEnt.set(e.id, v)
      }
      const t = Transform.getMutable(v.e)
      t.position = V(e.x, ENEMIES[e.kind].hover, e.z)
      t.rotation = yawQ((Math.atan2(run.x - e.x, run.z - e.z) * 180) / Math.PI)
    }
  }
  for (const [id, v] of enemyEnt)
    if (!seen.has(id)) {
      enemyPools[v.kind].give(v.e)
      enemyEnt.delete(id)
    }

  // pickups
  const seenP = new Set<number>()
  if (run) {
    for (const p of run.pickups) {
      if (!p.alive) continue
      seenP.add(p.id)
      const want = pickVisual(p.kind, p.value)
      let v = pickEnt.get(p.id)
      if (v && v.v !== want) {
        pickPools[v.v].give(v.e)
        pickEnt.delete(p.id)
        v = undefined
      }
      if (!v) {
        const e = pickPools[want].take()
        if (!e) continue
        v = { e, v: want }
        pickEnt.set(p.id, v)
      }
      Transform.getMutable(v.e).position = V(p.x, p.kind === 'heal' ? 0.4 : 0.05, p.z)
    }
  }
  for (const [id, v] of pickEnt)
    if (!seenP.has(id)) {
      pickPools[v.v].give(v.e)
      pickEnt.delete(id)
    }

  // bolts
  const seenB = new Set<number>()
  if (run)
    for (const b of run.projs) {
      seenB.add(b.id)
      let e = boltEnt.get(b.id)
      if (!e) {
        e = boltPool.take()
        if (!e) continue
        boltEnt.set(b.id, e)
      }
      Transform.getMutable(e).position = V(b.x, 1.1, b.z)
    }
  for (const [id, e] of boltEnt)
    if (!seenB.has(id)) {
      boltPool.give(e)
      boltEnt.delete(id)
    }

  // orbit blades + aura around the local player
  const n = run && run.alive ? run.orbitCount() : 0
  const R = run ? run.orbitRadius() : 0
  blades.forEach((b, i) => {
    const t = Transform.getMutable(b)
    if (i >= n || !run) {
      t.position = HIDE
      return
    }
    const a = run.orbitAngle + (i * 360) / n
    const rad = (a * Math.PI) / 180
    t.position = V(run.x + Math.sin(rad) * R, 1.0, run.z + Math.cos(rad) * R)
    t.rotation = yawQ(a + 90)
  })
  const ar = run && run.alive ? run.auraRadius() : 0
  const at = Transform.getMutable(aura)
  if (ar > 0 && run) {
    at.position = V(run.x, 0.08, run.z)
    at.scale = V(ar * 2, 0.02, ar * 2)
  } else at.position = HIDE

  // one-shot effects
  for (const ev of events) {
    if (ev.t === 'slash') {
      const e = slashPool.take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 1.0, ev.z)
      t.rotation = yawQ(ev.yaw)
      t.scale = V(ev.w, 0.05, ev.l)
      active.push({ e, life: 0.16, max: 0.16, kind: 'slash' })
    } else if (ev.t === 'nova') {
      const e = novaPool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.4, ev.z)
      active.push({ e, life: 0.35, max: 0.35, kind: 'nova', r: ev.r })
    } else if (ev.t === 'strike') {
      const e = strikePool.take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 6, ev.z)
      t.scale = V(0.25, 12, 0.25)
      active.push({ e, life: 0.22, max: 0.22, kind: 'strike' })
    } else if (ev.t === 'hit' && (ev.crit || dmgCount++ % 3 === 0)) {
      const e = dmgPool.take()
      if (!e) continue
      const ts = TextShape.getMutable(e)
      ts.text = String(Math.round(ev.dmg))
      ts.textColor = ev.crit ? Color4.create(1, 0.85, 0.2, 1) : Color4.White()
      ts.fontSize = ev.crit ? 4.5 : 3
      Transform.getMutable(e).position = V(ev.x + (Math.random() - 0.5) * 0.4, 1.8, ev.z)
      active.push({ e, life: 0.6, max: 0.6, kind: 'dmg', y: 1.8 })
    }
  }
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i]
    a.life -= dt
    const k = 1 - a.life / a.max
    if (a.kind === 'nova') Transform.getMutable(a.e).scale = V(a.r! * 2 * (0.3 + 0.7 * k), 0.05, a.r! * 2 * (0.3 + 0.7 * k))
    if (a.kind === 'dmg') {
      const t = Transform.getMutable(a.e)
      t.position = V(t.position.x, a.y! + k * 0.8, t.position.z)
    }
    if (a.life <= 0) {
      const pool = a.kind === 'slash' ? slashPool : a.kind === 'nova' ? novaPool : a.kind === 'strike' ? strikePool : dmgPool
      pool.give(a.e)
      active.splice(i, 1)
    }
  }
}

/** clear everything (run ended) */
export function clearView() {
  renderRun(null, [], 0)
}

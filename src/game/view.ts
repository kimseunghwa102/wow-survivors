// Renders the pure simulation (core.ts) with pooled Decentraland entities.
import {
  engine, Entity, Transform, GltfContainer, Animator,
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
const ENEMY_POOL: Record<EnemyKind, number> = { bat: 55, ghoul: 40, skeleton: 35, wraith: 25, elite: 3, lich: 2 }
const enemyPools = {} as Record<EnemyKind, Pool>
const enemyEnt = new Map<number, { e: Entity; kind: EnemyKind }>()

type PickVisual = 'gem_blue' | 'gem_green' | 'gem_red' | 'coin' | 'chest' | 'heal'
const pickPools = {} as Record<PickVisual, Pool>
const pickEnt = new Map<number, { e: Entity; v: PickVisual }>()

// skill FX (Blender GLBs, base + ascended look)
type FxKind = 'slash' | 'shard' | 'glaive' | 'bloom' | 'sigil' | 'pulse'
const fxSrc = (k: FxKind, asc: boolean) => `models/fx_${k}${asc ? '_asc' : ''}.glb`
let boltPool: [Pool, Pool]
const boltEnt = new Map<number, { e: Entity; asc: boolean }>()
let blades: Entity[] = []
let bladesAsc = false
let aura: Entity
let auraAsc = false
type Timed = { e: Entity; life: number; max: number; kind: 'slash' | 'nova' | 'strike' | 'dmg' | 'lvl'; r?: number; y?: number; asc: boolean; s?: number }
const active: Timed[] = []
let slashPool: [Pool, Pool]
let novaPool: [Pool, Pool]
let strikePool: [Pool, Pool]
let lvlPool: Pool
let dmgPool: Pool

function fxPool(k: FxKind, n: number, spin = 0): [Pool, Pool] {
  const make = (asc: boolean) =>
    new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src: fxSrc(k, asc) })
      if (spin) Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), spin)
      return e
    }, n)
  return [make(false), make(true)]
}

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
  pickPools.heal = pick('models/fx_heal.glb', 4, 90)

  boltPool = fxPool('shard', 40, 540)
  for (let i = 0; i < 12; i++) {
    const e = ent()
    GltfContainer.create(e, { src: fxSrc('glaive', false) })
    blades.push(e)
  }
  aura = ent()
  GltfContainer.create(aura, { src: fxSrc('bloom', false) })
  Tween.setRotateContinuous(aura, Quaternion.fromEulerDegrees(0, -1, 0), 40)
  slashPool = fxPool('slash', 4)
  novaPool = fxPool('pulse', 4)
  strikePool = fxPool('sigil', 10)
  lvlPool = pick('models/fx_levelup.glb', 2, 90)
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
      let v = boltEnt.get(b.id)
      if (!v) {
        const asc = run.evo('bolt')
        const e = boltPool[asc ? 1 : 0].take()
        if (!e) continue
        v = { e, asc }
        boltEnt.set(b.id, v)
      }
      Transform.getMutable(v.e).position = V(b.x, 1.1, b.z)
    }
  for (const [id, v] of boltEnt)
    if (!seenB.has(id)) {
      boltPool[v.asc ? 1 : 0].give(v.e)
      boltEnt.delete(id)
    }

  // orbit blades + aura around the local player
  const n = run && run.alive ? run.orbitCount() : 0
  const R = run ? run.orbitRadius() : 0
  const bAsc = !!run && run.evo('orbit')
  if (bAsc !== bladesAsc) {
    bladesAsc = bAsc
    for (const b of blades) GltfContainer.getMutable(b).src = fxSrc('glaive', bAsc)
  }
  const aAsc = !!run && run.evo('aura')
  if (aAsc !== auraAsc) {
    auraAsc = aAsc
    GltfContainer.getMutable(aura).src = fxSrc('bloom', aAsc)
  }
  blades.forEach((b, i) => {
    const t = Transform.getMutable(b)
    if (i >= n || !run) {
      t.position = HIDE
      return
    }
    const a = run.orbitAngle + (i * 360) / n
    const rad = (a * Math.PI) / 180
    t.position = V(run.x + Math.sin(rad) * R, 1.0, run.z + Math.cos(rad) * R)
    t.rotation = yawQ(a * 4)
  })
  const ar = run && run.alive ? run.auraRadius() : 0
  const at = Transform.getMutable(aura)
  if (ar > 0 && run) {
    at.position = V(run.x, 0.06, run.z)
    at.scale = V(ar * 2, 1 + ar * 0.25, ar * 2)
  } else at.position = HIDE

  // one-shot effects
  for (const ev of events) {
    if (ev.t === 'slash') {
      const asc = !!run && run.evo('lash')
      const e = slashPool[asc ? 1 : 0].take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 0.9, ev.z)
      t.rotation = yawQ(ev.yaw + 90)
      t.scale = V(ev.l, 1, ev.w * 1.8)
      active.push({ e, life: 0.2, max: 0.2, kind: 'slash', asc, s: ev.l })
    } else if (ev.t === 'nova') {
      const asc = !!run && run.evo('nova')
      const e = novaPool[asc ? 1 : 0].take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      active.push({ e, life: 0.4, max: 0.4, kind: 'nova', r: ev.r, asc })
    } else if (ev.t === 'strike') {
      const asc = !!run && run.evo('thunder')
      const e = strikePool[asc ? 1 : 0].take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 0, ev.z)
      t.rotation = yawQ(Math.random() * 360)
      t.scale = V(ev.r * 2, 1, ev.r * 2)
      active.push({ e, life: 0.28, max: 0.28, kind: 'strike', r: ev.r, asc })
    } else if (ev.t === 'levelup' && run) {
      const e = lvlPool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(run.x, 0.05, run.z)
      active.push({ e, life: 0.9, max: 0.9, kind: 'lvl', asc: false })
    } else if (ev.t === 'hit' && (ev.crit || dmgCount++ % 3 === 0)) {
      const e = dmgPool.take()
      if (!e) continue
      const ts = TextShape.getMutable(e)
      ts.text = String(Math.round(ev.dmg))
      ts.textColor = ev.crit ? Color4.create(1, 0.85, 0.2, 1) : Color4.White()
      ts.fontSize = ev.crit ? 4.5 : 3
      Transform.getMutable(e).position = V(ev.x + (Math.random() - 0.5) * 0.4, 1.8, ev.z)
      active.push({ e, life: 0.6, max: 0.6, kind: 'dmg', y: 1.8, asc: false })
    }
  }
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i]
    a.life -= dt
    const k = 1 - a.life / a.max
    if (a.kind === 'nova') {
      const d = a.r! * 2 * (0.25 + 0.75 * Math.sqrt(k))
      Transform.getMutable(a.e).scale = V(d, 1 + (1 - k) * 2, d)
    }
    if (a.kind === 'strike') {
      const w = a.r! * 2 * (1 - k * 0.7)
      Transform.getMutable(a.e).scale = V(w, 1, w)
    }
    if (a.kind === 'slash') {
      const t = Transform.getMutable(a.e)
      t.scale = V(a.s! * (0.85 + 0.25 * k), 1, t.scale.z)
    }
    if (a.kind === 'lvl') {
      const d = 1.6 + k * 2.5
      Transform.getMutable(a.e).scale = V(d, 1 - k * 0.8, d)
    }
    if (a.kind === 'dmg') {
      const t = Transform.getMutable(a.e)
      t.position = V(t.position.x, a.y! + k * 0.8, t.position.z)
    }
    if (a.life <= 0) {
      const ai = a.asc ? 1 : 0
      const pool = a.kind === 'slash' ? slashPool[ai] : a.kind === 'nova' ? novaPool[ai] : a.kind === 'strike' ? strikePool[ai] : a.kind === 'lvl' ? lvlPool : dmgPool
      pool.give(a.e)
      active.splice(i, 1)
    }
  }
}

/** clear everything (run ended) */
export function clearView() {
  renderRun(null, [], 0)
}

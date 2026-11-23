// Table effects: sound pool, card deal/flip animation, flying chips, WIN text and fireworks.
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  Material,
  AudioSource,
  VisibilityComponent,
  Billboard,
  BillboardMode,
  TextShape
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3 } from '@dcl/sdk/math'

const V = Vector3.create
const now = () => Date.now()

/* ---------- timers ---------- */
const jobs: { at: number; fn: () => void }[] = []
export function schedule(ms: number, fn: () => void) {
  if (ms <= 0) return fn()
  jobs.push({ at: now() + ms, fn })
}

/* ---------- sounds ---------- */
export type Sfx = 'elevator' | 'deal' | 'flip' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'fold' | 'collect' | 'turn' | 'win' | 'lose' | 'firework'
const VOL: Record<Sfx, number> = {
  elevator: 0.8,
  deal: 0.5, flip: 0.55, check: 0.9, call: 0.9, bet: 0.9, raise: 0.9, allin: 0.9, fold: 0.55, collect: 0.6, turn: 0.6, win: 0.85, lose: 0.6, firework: 0.55
}
const pool: Entity[] = []
let poolAt = 0
let lastPlay: Partial<Record<Sfx, number>> = {}
export function sfx(name: Sfx, delayMs = 0) {
  schedule(delayMs, () => {
    const t = now()
    if ((lastPlay[name] || 0) > t - 45) return // the same sound twice in one frame is just louder
    lastPlay[name] = t
    const e = pool[poolAt++ % pool.length]
    AudioSource.createOrReplace(e, { audioClipUrl: 'sounds/sfx/' + name + '.mp3', playing: true, loop: false, volume: VOL[name], global: true, currentTime: 0 })
  })
}

/* ---------- card animation ---------- */
type CardBase = { pos: Vector3; scale: Vector3 }
const cardBase = new Map<Entity, CardBase>()
type CardAnim = { kind: 'deal' | 'flip'; t0: number; dur: number; mid?: () => void; midDone?: boolean }
const cardAnims = new Map<Entity, CardAnim>()
export function registerCard(e: Entity, pos: Vector3, scale: Vector3) {
  cardBase.set(e, { pos, scale })
}
/** card slides down and turns open; starts after delayMs */
export function dealCard(e: Entity, delayMs: number) {
  cardAnims.set(e, { kind: 'deal', t0: now() + delayMs, dur: 420 })
  applyCard(e, 0, 'deal')
  sfx('deal', delayMs)
}
/** card turns over; the face is put on at the half-way point */
export function flipCard(e: Entity, delayMs: number, setFace: () => void) {
  cardAnims.set(e, { kind: 'flip', t0: now() + delayMs, dur: 380, mid: setFace })
  sfx('flip', delayMs)
}
export function stopCard(e: Entity) {
  const a = cardAnims.get(e)
  if (a && a.mid && !a.midDone) a.mid()
  cardAnims.delete(e)
  applyCard(e, 1, 'deal')
}
const easeOutBack = (p: number) => 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2)
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
function applyCard(e: Entity, p: number, kind: 'deal' | 'flip') {
  const b = cardBase.get(e)
  if (!b) return
  const tr = Transform.getMutable(e)
  if (kind === 'deal') {
    const k = Math.max(0, easeOutBack(p))
    tr.scale = V(b.scale.x * Math.min(1.08, k), b.scale.y * (0.35 + 0.65 * Math.min(1, easeOut(p))), 1)
    tr.position = V(b.pos.x, b.pos.y + 0.55 * (1 - easeOut(p)), b.pos.z)
  } else {
    const x = Math.abs(Math.cos(p * Math.PI)) // 1 → 0 → 1
    tr.scale = V(b.scale.x * x, b.scale.y * (1 + 0.12 * Math.sin(p * Math.PI)), 1)
    tr.position = V(b.pos.x, b.pos.y + 0.12 * Math.sin(p * Math.PI), b.pos.z)
  }
}

/* ---------- flying chips ---------- */
type Fly = { e: Entity; from: Vector3; to: Vector3; t0: number; dur: number; arc: number; done?: () => void }
const flights: Fly[] = []
export function fly(e: Entity, from: Vector3, to: Vector3, delayMs: number, dur: number, arc: number, done?: () => void) {
  for (let i = flights.length - 1; i >= 0; i--) if (flights[i].e === e) flights.splice(i, 1)
  flights.push({ e, from, to, t0: now() + delayMs, dur, arc, done })
}

/* ---------- WIN / LOSE text and fireworks ---------- */
const pops = new Map<Entity, { t0: number; base: number }>()
export function popText(e: Entity, base: number) {
  pops.set(e, { t0: now(), base })
  Transform.getMutable(e).scale = V(0, 0, 0)
}
type Spark = { e: Entity; p: Vector3; v: Vector3; t0: number; life: number; size: number }
const sparkEnts: Entity[] = []
const sparks: Spark[] = []
let sparkAt = 0
export function fireworks(at: Vector3, bursts: number) {
  for (let b = 0; b < bursts; b++) {
    const delay = b * 480
    schedule(delay, () => {
      const c = V(at.x + (Math.random() - 0.5) * 1.4, at.y + Math.random() * 0.8, at.z + (Math.random() - 0.5) * 1.4)
      const n = 10
      for (let i = 0; i < n; i++) {
        const e = sparkEnts[sparkAt++ % sparkEnts.length]
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(2 * Math.random() - 1)
        const sp = 1.8 + Math.random() * 1.4
        const v = V(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp + 1.2, Math.sin(ph) * Math.sin(th) * sp)
        for (let j = sparks.length - 1; j >= 0; j--) if (sparks[j].e === e) sparks.splice(j, 1)
        sparks.push({ e, p: c, v, t0: now(), life: 1300 + Math.random() * 500, size: 0.09 + Math.random() * 0.06 })
        VisibilityComponent.getMutable(e).visible = true
      }
      sfx('firework')
    })
  }
}

export function buildFx() {
  for (let i = 0; i < 8; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: V(8, 1.5, 10) })
    pool.push(e)
  }
  const cols = [Color4.fromHexString('#FFD54FFF'), Color4.fromHexString('#FF5FA8FF'), Color4.fromHexString('#7DF9FFFF')]
  for (let i = 0; i < 30; i++) {
    const e = engine.addEntity()
    Transform.create(e, { position: V(8, -5, 10), scale: V(0.1, 0.1, 0.1) })
    MeshRenderer.setPlane(e)
    Material.setBasicMaterial(e, { diffuseColor: cols[i % cols.length] })
    Billboard.create(e, { billboardMode: BillboardMode.BM_ALL })
    VisibilityComponent.create(e, { visible: false })
    sparkEnts.push(e)
  }
  engine.addSystem(fxSystem)
}

function fxSystem(dt: number) {
  const t = now()
  // timers
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].at <= t) {
      const j = jobs.splice(i, 1)[0]
      j.fn()
    }
  }
  // cards
  cardAnims.forEach((a, e) => {
    const p = (t - a.t0) / a.dur
    if (p < 0) {
      if (a.kind === 'deal') applyCard(e, 0, 'deal')
      return
    }
    if (a.mid && !a.midDone && p >= 0.5) {
      a.midDone = true
      a.mid()
    }
    if (p >= 1) {
      applyCard(e, 1, 'deal')
      cardAnims.delete(e)
      return
    }
    applyCard(e, p, a.kind)
  })
  // chips
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i]
    const p = (t - f.t0) / f.dur
    if (p < 0) continue
    const vis = VisibilityComponent.getMutable(f.e)
    if (p >= 1) {
      vis.visible = false
      flights.splice(i, 1)
      if (f.done) f.done()
      continue
    }
    vis.visible = true
    const q = easeOut(p)
    Transform.getMutable(f.e).position = V(
      f.from.x + (f.to.x - f.from.x) * q,
      f.from.y + (f.to.y - f.from.y) * q + Math.sin(p * Math.PI) * f.arc,
      f.from.z + (f.to.z - f.from.z) * q
    )
  }
  // text pops: 0 → 1.25 → 1, then a slow pulse
  pops.forEach((s, e) => {
    const p = (t - s.t0) / 450
    const k = p < 1 ? easeOutBack(Math.min(1, p)) : 1 + 0.06 * Math.sin((t - s.t0) / 180)
    const v = s.base * k
    Transform.getMutable(e).scale = V(v, v, v)
  })
  // sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    const age = t - s.t0
    if (age >= s.life) {
      VisibilityComponent.getMutable(s.e).visible = false
      Transform.getMutable(s.e).position = V(8, -5, 10)
      sparks.splice(i, 1)
      continue
    }
    s.v = V(s.v.x * 0.985, s.v.y - 2.6 * dt, s.v.z * 0.985)
    s.p = V(s.p.x + s.v.x * dt, s.p.y + s.v.y * dt, s.p.z + s.v.z * dt)
    const k = s.size * (1 - age / s.life) * (0.75 + 0.25 * Math.sin(age / 40))
    const tr = Transform.getMutable(s.e)
    tr.position = s.p
    tr.scale = V(k, k, k)
  }
}

export function stopPop(e: Entity) {
  pops.delete(e)
  Transform.getMutable(e).scale = V(0, 0, 0)
}

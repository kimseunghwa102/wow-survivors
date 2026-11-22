// Renders the pure simulation (core.ts) with pooled Decentraland entities.
import {
  engine, Entity, Transform, GltfContainer, Animator,
  TextShape, TextAlignMode, Font, Billboard, BillboardMode, Tween, MeshRenderer, Material, MaterialTransparencyMode, EasingFunction, AvatarAttach, AvatarAnchorPointType
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { Run, Ev } from './core'
import { ENEMIES, EnemyKind, ARMORY, GOD_TIER, bossFor, WeaponId, WEAPONS, PASSIVES, PassiveId, MAX_PASSIVE_LVL } from './defs'

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
  made = 0
  /** pre-creates n entities; grows lazily up to max when they run out */
  constructor(
    private make: () => Entity,
    n: number,
    private max = n
  ) {
    for (let i = 0; i < n; i++) this.free.push(make())
    this.made = n
  }
  take(): Entity | undefined {
    if (!this.free.length && this.made < this.max) {
      this.made++
      return this.make()
    }
    return this.free.pop()
  }
  give(e: Entity) {
    Transform.getMutable(e).position = HIDE
    this.free.push(e)
  }
}

// ─────────────── pools ───────────────
const ENEMY_POOL: Record<EnemyKind, number> = { bat: 52, ghoul: 38, skeleton: 33, wraith: 24, elite: 3, boss: 0 }
const enemyPools = {} as Record<EnemyKind, Pool>
type EVis = { e: Entity; kind: EnemyKind; px: number; pz: number; tx: number; tz: number; acc: number; yaw: number; sc: number; squash: number }
const enemyEnt = new Map<number, EVis>()
const modelOf = new Map<Entity, Entity>()
const rotOf = new Map<Entity, Entity>()
/** how often each monster gets a new movement segment; the renderer interpolates in between (smooth at any FPS) */
const MOVE_STEP = 0.14

type PickVisual = 'gem_blue' | 'gem_green' | 'gem_red' | 'coin' | 'chest' | 'heal' | 'pot_hp' | 'pot_rage'
const pickPools = {} as Record<PickVisual, Pool>
const pickEnt = new Map<number, { e: Entity; v: PickVisual }>()

// skill FX (Blender GLBs, base + ascended look)
type FxKind = 'slash' | 'shard' | 'glaive' | 'bloom' | 'sigil' | 'pulse'
const TIER_SUFFIX = ['', '_t2', '_t3', '_asc']
const fxSrc = (k: FxKind, t: number) => `models/fx_${k}${TIER_SUFFIX[t]}.glb`
/** visual tier of a skill: 0 = Lv1-3, 1 = Lv4-6, 2 = Lv7-8, 3 = ascended */
const tierOf = (run: Run, id: WeaponId) => (run.evo(id) ? 3 : run.w(id) >= 7 ? 2 : run.w(id) >= 4 ? 1 : 0)
/** size grows a little with every level so each pick is visible */
const lvlSize = (run: Run, id: WeaponId) => 1 + 0.07 * Math.max(0, run.w(id) - 1) + (run.evo(id) ? 0.15 : 0)
let boltPool: Pool[]
const boltEnt = new Map<number, { e: Entity; t: number }>()
let blades: Entity[] = []
let bladesTier = 0
let aura: Entity
let auraTier = 0
type Timed = { e: Entity; life: number; max: number; kind: 'slash' | 'nova' | 'strike' | 'dmg' | 'lvl' | 'up'; r?: number; y?: number; asc: number; s?: number; pool?: Pool }
const active: Timed[] = []
let slashPool: Pool[]
let novaPool: Pool[]
let strikePool: Pool[]
let lvlPool: Pool
let dmgPool: Pool
// armory / boss visuals
const SWING_FX = ['fist', 'pan', 'hammer', 'flame', 'reaper'] as const
const swingPools = {} as Record<(typeof SWING_FX)[number], Pool>
let quakePool: Pool
let tracerPool: Pool
let warnPool: Pool
let slamPool: Pool
// two boss slots (twin encounters)
type BossVis = { ent: Entity; model: Entity; shown: number; acc: number; lastId: number; tx: number; tz: number }
const bossVis: BossVis[] = []
let held: Entity
let heldTier = -1
let swingT = 0
let missile: Entity
let blast: Entity
let nukeFlight: null | { x0: number; z0: number; x1: number; z1: number; t: number; d: number } = null
let blastT = 0
let blastR = 0
type Fx = { e: Entity; life: number; max: number; pool: Pool; kind: 'swing' | 'quake' | 'tracer' | 'warn' | 'slam'; r: number; w?: number }
const fxs: Fx[] = []

function fxPool(k: FxKind, n: number, spin = 0, max = n): Pool[] {
  const make = (t: number) =>
    new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src: fxSrc(k, t) })
      if (spin) Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), spin)
      return e
    }, t === 0 ? n : Math.min(n, 2), max)
  return [make(0), make(1), make(2), make(3)]
}

export function setupView() {
  for (const k of Object.keys(ENEMY_POOL) as EnemyKind[]) {
    enemyPools[k] = new Pool(() => {
      // parent = smoothly tweened position, child = model (scale / facing / hit squash)
      const e = ent()
      const r = engine.addEntity()
      Transform.create(r, { parent: e })
      const m = engine.addEntity()
      Transform.create(m, { parent: r })
      GltfContainer.create(m, { src: ENEMIES[k].model })
      rotOf.set(e, r)
      Animator.create(m, { states: [{ clip: 'Idle', playing: true, loop: true, speed: k === 'bat' ? 1.6 : 1 }] })
      modelOf.set(e, m)
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
  pickPools.pot_hp = pick('models/pot_hp.glb', 3, 90)
  pickPools.pot_rage = pick('models/pot_rage.glb', 2, 90)

  boltPool = fxPool('shard', 20, 0, 40)
  for (let i = 0; i < 12; i++) {
    const e = ent()
    GltfContainer.create(e, { src: fxSrc('glaive', 0) })
    blades.push(e)
  }
  aura = ent()
  GltfContainer.create(aura, { src: fxSrc('bloom', 0) })
  Tween.setRotateContinuous(aura, Quaternion.fromEulerDegrees(0, -1, 0), 40)
  setupSkills2()
  setupGods()
  slashPool = fxPool('slash', 4)
  novaPool = fxPool('pulse', 4)
  strikePool = fxPool('sigil', 10)
  lvlPool = pick('models/fx_levelup.glb', 2, 90)
  setupUpgradeFx()
  setupHalos()
  spawnPool = pick('models/fx_spawn.glb', 8, 0)
  zeusPool = pick('models/fx_sigil_asc.glb', 9, 0)
  divinePool = pick('models/fx_pulse_asc.glb', 3, 0)
  godAura = ent()
  deathPool = pick('models/fx_death.glb', 16, 0)
  for (let i = 0; i < 2; i++) {
    const be = ent()
    const bm = engine.addEntity()
    Transform.create(bm, { parent: be })
    bossVis.push({ ent: be, model: bm, shown: 0, acc: 0, lastId: 0, tx: 0, tz: 0 })
  }
  held = ent()
  for (const k of SWING_FX) swingPools[k] = pick(`models/fx_sw_${k}.glb`, 3, 0)
  quakePool = pick('models/fx_quake.glb', 3, 0)
  tracerPool = pick('models/fx_tracer.glb', 8, 0)
  missile = ent()
  GltfContainer.create(missile, { src: 'models/w_nuke.glb' })
  blast = ent()
  GltfContainer.create(blast, { src: 'models/fx_nuke.glb' })
  const grow = (src: string, n: number, max: number) =>
    new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src })
      return e
    }, n, max)
  warnPool = grow('models/fx_slam_warn.glb', 4, 56)
  slamPool = grow('models/fx_slam.glb', 3, 36)
  dmgPool = new Pool(() => {
    const e = ent()
    TextShape.create(e, { text: '', fontSize: 3, textColor: Color4.White(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.2, outlineColor: Color3.Black() })
    Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
    return e
  }, 30)
}

function pickVisual(kind: string, value: number): PickVisual {
  if (kind === 'gem') return value <= 2 ? 'gem_blue' : value <= 20 ? 'gem_green' : 'gem_red'
  if (kind === 'potion') return value === 1 ? 'pot_rage' : 'pot_hp'
  return kind as PickVisual
}

let dmgCount = 0

/** call every frame after run.step() */
export function renderRun(run: Run | null, events: Ev[], dt: number) {
  // enemies
  const seen = new Set<number>()
  const bossSeenIds = new Set<number>()
  if (run) {
    for (const e of run.enemies) {
      if (!e.alive) continue
      if (e.kind === 'boss') {
        // keep each boss in its own slot
        let bv = bossVis.find((q) => q.shown === e.id)
        if (!bv) bv = bossVis.find((q) => !q.shown || !bossSeenIds.has(q.shown) && !run.bossIds.includes(q.shown))
        if (!bv) continue
        bossSeenIds.add(e.id)
        if (bv.shown !== e.id) {
          bv.shown = e.id
          const d = bossFor(e.boss ?? 0)
          GltfContainer.createOrReplace(bv.model, { src: d.model })
          Animator.createOrReplace(bv.model, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 0.8 }] })
          Transform.getMutable(bv.model).scale = V(d.scale, d.scale, d.scale)
        }
        bv.acc += dt
        if (bv.acc >= MOVE_STEP || bv.shown !== bv.lastId) {
          const fy = bossFor(e.boss ?? 0).fly ?? 0
          const start = bv.lastId === e.id ? V(bv.tx, fy, bv.tz) : V(e.x, fy, e.z)
          bv.lastId = e.id
          Tween.createOrReplace(bv.ent, { mode: Tween.Mode.Move({ start, end: V(e.x, fy, e.z) }), duration: MOVE_STEP * 1000, easingFunction: EasingFunction.EF_LINEAR })
          bv.tx = e.x
          bv.tz = e.z
          bv.acc = 0
          const face = e.charging !== undefined ? (Math.atan2(e.cvx ?? 0, e.cvz ?? 1) * 180) / Math.PI : (Math.atan2(run.x - e.x, run.z - e.z) * 180) / Math.PI
          Transform.getMutable(bv.model).rotation = yawQ(face)
        }
        continue
      }
      seen.add(e.id)
      let v = enemyEnt.get(e.id)
      const hy = ENEMIES[e.kind].hover
      const face = (Math.atan2(run.x - e.x, run.z - e.z) * 180) / Math.PI
      if (!v) {
        const ent_ = enemyPools[e.kind].take()
        if (!ent_) continue
        const sc = ENEMIES[e.kind].scale * e.sc
        v = { e: ent_, kind: e.kind, px: e.x, pz: e.z, tx: e.x, tz: e.z, acc: Math.random() * MOVE_STEP, yaw: face, sc, squash: 0 }
        enemyEnt.set(e.id, v)
        Tween.deleteFrom(ent_)
        Transform.getMutable(ent_).position = V(e.x, hy, e.z)
        Transform.getMutable(modelOf.get(ent_)!).scale = V(sc, sc, sc)
        Tween.deleteFrom(rotOf.get(ent_)!)
        Transform.getMutable(rotOf.get(ent_)!).rotation = yawQ(face)
        spawnPuff(e.x, e.z, e.kind === 'elite' ? 2 : 1)
      }
      v.acc += dt
      if (v.acc >= MOVE_STEP) {
        // velocity from the simulation since the last segment → extrapolate one step ahead
        const vx = (e.x - v.px) / v.acc
        const vz = (e.z - v.pz) / v.acc
        v.px = e.x
        v.pz = e.z
        const nx = e.x + vx * MOVE_STEP
        const nz = e.z + vz * MOVE_STEP
        // start from where the renderer currently is (last target) unless the error grew too large
        const sx = Math.hypot(v.tx - e.x, v.tz - e.z) > 1.5 ? e.x : v.tx
        const sz = Math.hypot(v.tx - e.x, v.tz - e.z) > 1.5 ? e.z : v.tz
        Tween.createOrReplace(v.e, {
          mode: Tween.Mode.Move({ start: V(sx, hy, sz), end: V(nx, hy, nz) }),
          duration: MOVE_STEP * 1000,
          easingFunction: EasingFunction.EF_LINEAR
        })
        v.tx = nx
        v.tz = nz
        v.acc = 0
        // turn smoothly toward the player only when the heading really changed
        let dy = ((face - v.yaw + 540) % 360) - 180
        if (Math.abs(dy) > 6) {
          const from = v.yaw
          v.yaw = from + dy
          Tween.createOrReplace(rotOf.get(v.e)!, {
            mode: Tween.Mode.Rotate({ start: yawQ(from), end: yawQ(v.yaw) }),
            duration: MOVE_STEP * 1000,
            easingFunction: EasingFunction.EF_LINEAR
          })
        }
      }
      if (v.squash > 0) {
        v.squash -= dt
        if (v.squash <= 0) Transform.getMutable(modelOf.get(v.e)!).scale = V(v.sc, v.sc, v.sc)
      }
    }
  }
  for (const bv of bossVis)
    if (bv.shown && !bossSeenIds.has(bv.shown)) {
      bv.shown = 0
      bv.lastId = 0
      Tween.deleteFrom(bv.ent)
      Transform.getMutable(bv.ent).position = HIDE
    }
  for (const [id, v] of enemyEnt)
    if (!seen.has(id)) {
      Tween.deleteFrom(v.e)
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
      Transform.getMutable(v.e).position = V(p.x, p.kind === 'heal' ? 0.4 : p.kind === 'potion' ? 0.5 : 0.05, p.z)
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
        const feather = b.k === 'feather'
        const knife = b.k === 'knife'
        const t = knife ? 9 : feather ? 4 + (run.g('wings') >= 5 ? 1 : 0) : tierOf(run, 'bolt')
        const e = knife ? MP.knife.take() : feather ? featherPool[t - 4].take() : boltPool[t].take()
        if (!e) continue
        v = { e, t }
        if (feather || knife) Transform.getMutable(e).rotation = yawQ((Math.atan2(b.vx, b.vz) * 180) / Math.PI)
        boltEnt.set(b.id, v)
        const sz = b.k === 'feather' ? 1.3 : knife ? 1 : lvlSize(run, 'bolt')
        Transform.getMutable(e).scale = V(sz, sz, sz)
        Tween.createOrReplace(e, {
          mode: Tween.Mode.Move({ start: V(b.x, 1.1, b.z), end: V(b.x + b.vx * b.life, 1.1, b.z + b.vz * b.life) }),
          duration: b.life * 1000,
          easingFunction: EasingFunction.EF_LINEAR
        })
      }
    }
  for (const [id, v] of boltEnt)
    if (!seenB.has(id)) {
      Tween.deleteFrom(v.e)
      if (v.t === 9) MP.knife.give(v.e)
      else if (v.t >= 4) featherPool[v.t - 4].give(v.e)
      else boltPool[v.t].give(v.e)
      boltEnt.delete(id)
    }

  // orbit blades + aura around the local player
  const n = run && run.alive ? run.orbitCount() : 0
  const R = run ? run.orbitRadius() : 0
  const bT = run ? tierOf(run, 'orbit') : 0
  if (bT !== bladesTier) {
    bladesTier = bT
    for (const b of blades) GltfContainer.getMutable(b).src = fxSrc('glaive', bT)
  }
  const aT = run ? tierOf(run, 'aura') : 0
  if (aT !== auraTier) {
    auraTier = aT
    GltfContainer.getMutable(aura).src = fxSrc('bloom', aT)
  }
  const bSz = run ? lvlSize(run, 'orbit') : 1
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
    t.scale = V(bSz, bSz, bSz)
  })
  const ar = run && run.alive ? run.auraRadius() : 0
  const at = Transform.getMutable(aura)
  if (ar > 0 && run) {
    at.position = V(run.x, 0.06, run.z)
    at.scale = V(ar * 2, 1 + ar * 0.25, ar * 2)
  } else at.position = HIDE

  playEvents(events, run)
  for (const q of remoteQ.splice(0)) playEvents(q.evs, null, q.tiers)
  for (let i = remoteProjs.length - 1; i >= 0; i--) {
    const p = remoteProjs[i]
    p.life -= dt
    if (p.life > 0) continue
    Tween.deleteFrom(p.e)
    Transform.getMutable(p.e).position = HIDE
    p.pool.give(p.e)
    remoteProjs.splice(i, 1)
  }
  for (let i = remoteMines.length - 1; i >= 0; i--) if (remoteMines[i].a.life <= 0) remoteMines.splice(i, 1)
  renderSkills2(run, dt)
  renderGods(run, dt)
  renderSky(dt)
  renderHalos(run, dt)
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]
    f.life -= dt
    const k = 1 - Math.max(0, f.life) / f.max
    const t = Transform.getMutable(f.e)
    if (f.kind === 'swing') t.scale = V(f.w! * (0.8 + 0.3 * k), 1, f.r * 1.1)
    else if (f.kind === 'quake') t.scale = V(f.r * 2 * (0.3 + 0.7 * k), 1, f.r * 2 * (0.3 + 0.7 * k))
    else if (f.kind === 'warn') t.scale = V(f.r * 2 * (0.15 + 0.85 * k), 1, f.r * 2 * (0.15 + 0.85 * k))
    else if (f.kind === 'slam') t.scale = V(f.r * 2 * (0.4 + 0.6 * k), 1 + (1 - k) * 3, f.r * 2 * (0.4 + 0.6 * k))
    if (f.life <= 0) {
      f.pool.give(f.e)
      fxs.splice(i, 1)
    }
  }
  // nuke missile arc + blast
  if (nukeFlight) {
    const n = nukeFlight
    n.t += dt
    const k = Math.min(1, n.t / n.d)
    const x = n.x0 + (n.x1 - n.x0) * k
    const z = n.z0 + (n.z1 - n.z0) * k
    const y = 1.5 + Math.sin(k * Math.PI) * 9 - k * 1.5
    const vy = Math.cos(k * Math.PI) * 9 * Math.PI - 1.5
    const horiz = Math.hypot(n.x1 - n.x0, n.z1 - n.z0) || 1
    const t = Transform.getMutable(missile)
    t.position = V(x, y, z)
    t.rotation = Quaternion.multiply(yawQ((Math.atan2(n.x1 - n.x0, n.z1 - n.z0) * 180) / Math.PI), Quaternion.fromEulerDegrees((-Math.atan2(vy / n.d, horiz / n.d) * 180) / Math.PI, 0, 0))
    t.scale = V(1.6, 1.6, 1.6)
  }
  if (blastT > 0) {
    blastT -= dt
    const k = 1 - Math.max(0, blastT) / 2.2
    const d = blastR * 2 * Math.min(1, 0.2 + k * 1.6)
    Transform.getMutable(blast).scale = V(d, blastR * (0.4 + k * 0.9), d)
    if (blastT <= 0) Transform.getMutable(blast).position = HIDE
  }
  // the equipped armory weapon floats at the player's right hand and swings
  const want = run && run.alive ? run.equip : -1
  if (want !== heldTier) {
    heldTier = want
    if (want >= 0) GltfContainer.createOrReplace(held, { src: ARMORY[want].model })
    else Transform.getMutable(held).position = HIDE
  }
  if (run && run.alive && want >= 0) {
    const yaw = aimYaw
    const a = (yaw * Math.PI) / 180
    const fx = Math.sin(a)
    const fz = Math.cos(a)
    const gun = !!ARMORY[want].gun
    if (swingT > 0) swingT -= dt
    const sk = Math.max(0, swingT) / (gun ? 0.06 : 0.2)
    const swing = gun ? 0 : (1 - sk) * 150 - 80
    const push = gun ? -sk * 0.15 : want === 0 ? Math.sin((1 - sk) * Math.PI) * 0.5 : 0
    const t = Transform.getMutable(held)
    t.position = V(run.x + fz * 0.5 + fx * (0.25 + push), gun ? 1.15 : 1.25, run.z - fx * 0.5 + fz * (0.25 + push))
    t.rotation = Quaternion.multiply(yawQ(yaw + (swingT > 0 ? swing : -20)), Quaternion.fromEulerDegrees(gun ? 0 : swingT > 0 ? 10 : -35, 0, 0))
    t.scale = V(1, 1, 1)
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
    if (a.kind === 'up') {
      const d = a.r! * 2 * (0.5 + k * 0.9)
      Transform.getMutable(a.e).scale = V(d, 0.3 + Math.sin(k * Math.PI) * 1.1, d)
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
      const ai = a.asc
      const pool = a.pool ?? (a.kind === 'slash' ? slashPool[ai] : a.kind === 'nova' ? novaPool[ai] : a.kind === 'strike' ? strikePool[ai] : a.kind === 'lvl' ? lvlPool : dmgPool)
      pool.give(a.e)
      active.splice(i, 1)
    }
  }
}


// ───────── one-shot effects (mine, and other players' via the fx stream) ─────────
const remoteQ: { evs: Ev[]; tiers: number[] }[] = []
/** effects another player cast — drawn with their skill tiers */
export function queueRemoteFx(evs: Ev[], tiers: number[]) {
  if (remoteQ.length < 12) remoteQ.push({ evs, tiers })
}
/** my orbit-blade and aura tiers (shown to other players) */
export function haloTiersOf(run: Run) {
  return { tb: tierOf(run, 'orbit'), ta: tierOf(run, 'aura') }
}
/** a projectile of mine as a network packet kind: 0-3 shard tier, 4 feather, 5 gold feather */
export function projKind(run: Run, k: string | undefined) {
  return k === 'feather' ? (run.g('wings') >= 5 ? 5 : 4) : tierOf(run, 'bolt')
}
const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[]
/** what other hunters draw around me: wisps, passive rings */
export function lookOf(run: Run) {
  return {
    wc: Math.min(6, run.wisps.length),
    wt: tierOf(run, 'wisp'),
    ps: ([...run.passives.entries()] as [PassiveId, number][]).slice(0, 6).map(([p, l]) => PASSIVE_IDS.indexOf(p) * 10 + Math.min(MAX_PASSIVE_LVL, l))
  }
}
/** my skill tiers for slash / nova / strike, sent along with my effects */
export function fxTiers(run: Run) {
  return [tierOf(run, 'lash'), tierOf(run, 'nova'), tierOf(run, 'thunder'), ...SK2.map((id) => tierOf(run, id))]
}

function playEvents(events: Ev[], run: Run | null, tiers?: number[]) {
  for (const ev of events) {
    if (ev.t === 'slash') {
      const asc = tiers ? tiers[0] : run ? tierOf(run, 'lash') : 0
      const e = slashPool[asc].take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 0.9, ev.z)
      t.rotation = yawQ(ev.yaw + 90)
      t.scale = V(ev.l, 1, ev.w * 1.8)
      active.push({ e, life: 0.2, max: 0.2, kind: 'slash', asc, s: ev.l })
    } else if (ev.t === 'nova') {
      const asc = tiers ? tiers[1] : run ? tierOf(run, 'nova') : 0
      const e = novaPool[asc].take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      active.push({ e, life: 0.4, max: 0.4, kind: 'nova', r: ev.r, asc })
    } else if (ev.t === 'strike') {
      const asc = tiers ? tiers[2] : run ? tierOf(run, 'thunder') : 0
      const e = strikePool[asc].take()
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 0, ev.z)
      t.rotation = yawQ(Math.random() * 360)
      t.scale = V(ev.r * 2, 1, ev.r * 2)
      active.push({ e, life: 0.28, max: 0.28, kind: 'strike', r: ev.r, asc })
    } else if (playGod(ev, run, tiers)) {
      // handled
    } else if (!tiers && playMyth(ev, run)) {
      // handled
    } else if (playSkill2(ev, run, tiers)) {
      // handled
    } else if (ev.t === 'kill') {
      deathPuff(ev.x, ev.z, ev.kind === 'elite' ? 2.2 : ev.kind === 'boss' ? 4 : 1)
    } else if (ev.t === 'swing') {
      const kind = ARMORY[ev.tier].fx as (typeof SWING_FX)[number]
      const e = swingPools[kind]?.take()
      if (!tiers) swingT = 0.2
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 1.0, ev.z)
      t.rotation = yawQ(ev.yaw)
      const w = ev.range * (ev.arc >= 180 ? 2.3 : ev.arc >= 140 ? 1.9 : 1.5)
      t.scale = V(w, 1, ev.range * 1.1)
      fxs.push({ e, life: 0.2, max: 0.2, pool: swingPools[kind], kind: 'swing', r: ev.range, w })
    } else if (ev.t === 'zeus') {
      if (!tiers) swingT = 0.12
      for (const [x, z] of ev.pts.slice(1)) {
        const e = zeusPool.take()
        if (!e) break
        const t = Transform.getMutable(e)
        t.position = V(x, 0, z)
        t.rotation = yawQ(Math.random() * 360)
        t.scale = V(2.2, 1, 2.2)
        active.push({ e, life: 0.22, max: 0.22, kind: 'strike', r: 1.1, asc: 3, pool: zeusPool })
      }
    } else if (ev.t === 'divine') {
      const e = divinePool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      active.push({ e, life: 0.45, max: 0.45, kind: 'nova', r: ev.r, asc: 3, pool: divinePool })
    } else if (ev.t === 'quake') {
      const e = quakePool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      fxs.push({ e, life: 0.4, max: 0.4, pool: quakePool, kind: 'quake', r: ev.r })
    } else if (ev.t === 'tracer') {
      const e = tracerPool.take()
      if (!tiers) swingT = 0.06
      if (!e) continue
      const t = Transform.getMutable(e)
      t.position = V(ev.x, 1.15, ev.z)
      t.rotation = yawQ(ev.yaw)
      t.scale = V(1, 1, ev.len)
      fxs.push({ e, life: 0.07, max: 0.07, pool: tracerPool, kind: 'tracer', r: ev.len })
    } else if (ev.t === 'nukeLaunch') {
      nukeFlight = { x0: ev.x, z0: ev.z, x1: ev.tx, z1: ev.tz, t: 0, d: ev.delay }
    } else if (ev.t === 'nuke') {
      nukeFlight = null
      Transform.getMutable(missile).position = HIDE
      blastT = 2.2
      blastR = ev.r
      Transform.getMutable(blast).position = V(ev.x, 0, ev.z)
    } else if (ev.t === 'slamWarn') {
      const e = warnPool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      fxs.push({ e, life: ev.dur, max: ev.dur, pool: warnPool, kind: 'warn', r: ev.r })
    } else if (ev.t === 'charge') {
      const e = warnPool.take()
      if (!e) continue
      const a = (ev.yaw * Math.PI) / 180
      const t = Transform.getMutable(e)
      t.position = V(ev.x + Math.sin(a) * ev.len * 0.5, 0.05, ev.z + Math.cos(a) * ev.len * 0.5)
      t.rotation = yawQ(ev.yaw)
      t.scale = V(2.2, 1, ev.len + 2)
      fxs.push({ e, life: 0.5, max: 0.5, pool: warnPool, kind: 'tracer', r: ev.len })
    } else if (ev.t === 'slam') {
      const e = slamPool.take()
      if (!e) continue
      Transform.getMutable(e).position = V(ev.x, 0.05, ev.z)
      fxs.push({ e, life: 0.55, max: 0.55, pool: slamPool, kind: 'slam', r: ev.r })
    } else if (ev.t === 'levelup' && (run || (ev as any).x !== undefined)) {
      const e = lvlPool.take()
      if (!e) continue
      Transform.getMutable(e).position = tiers ? V((ev as any).x, 0.05, (ev as any).z) : V(run!.x, 0.05, run!.z)
      active.push({ e, life: 0.9, max: 0.9, kind: 'lvl', asc: 0 })
    } else if (ev.t === 'hit') {
      const v = enemyEnt.get(ev.id)
      if (v && v.squash <= 0) {
        v.squash = 0.09
        Transform.getMutable(modelOf.get(v.e)!).scale = V(v.sc * 1.18, v.sc * 0.86, v.sc * 1.18)
      }
      if (!(ev.crit || dmgCount++ % 3 === 0)) continue
      const e = dmgPool.take()
      if (!e) continue
      const ts = TextShape.getMutable(e)
      ts.text = String(Math.round(ev.dmg))
      ts.textColor = ev.crit ? Color4.create(1, 0.85, 0.2, 1) : Color4.White()
      ts.fontSize = ev.crit ? 4.5 : 3
      Transform.getMutable(e).position = V(ev.x + (Math.random() - 0.5) * 0.4, 1.8, ev.z)
      active.push({ e, life: 0.6, max: 0.6, kind: 'dmg', y: 1.8, asc: 0 })
    }
  }
}

// ───────── upgrade feedback: burst + big floating title ─────────
const UP_KEYS = ['lash', 'bolt', 'orbit', 'aura', 'thunder', 'nova', 'frost', 'chain', 'chakram', 'mine', 'beam', 'wisp', 'passive', 'asc'] as const
const upPools = {} as Record<(typeof UP_KEYS)[number], Pool>
let upText: Entity
let upTextT = 0
function setupUpgradeFx() {
  for (const k of UP_KEYS)
    upPools[k] = new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src: `models/fx_up_${k}.glb` })
      Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), 180)
      return e
    }, 1, 2)
  upText = ent()
  TextShape.create(upText, { text: '', fontSize: 5, textColor: Color4.White(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.25, outlineColor: Color3.Black() })
  Billboard.create(upText, { billboardMode: BillboardMode.BM_Y })
}

/** call when the player picks an upgrade (level-up card or vault roll) */
export function upgradeFx(run: Run, kind: 'weapon' | 'passive' | 'evolve', id: string, title: string, color: string) {
  const key = (kind === 'evolve' ? 'asc' : kind === 'passive' ? 'passive' : id) as (typeof UP_KEYS)[number]
  const pool = upPools[key]
  const e = pool?.take()
  if (e) {
    Transform.getMutable(e).position = V(run.x, 0.02, run.z)
    active.push({ e, life: kind === 'evolve' ? 1.6 : 1.0, max: kind === 'evolve' ? 1.6 : 1.0, kind: 'up', asc: 0, pool, r: kind === 'evolve' ? 2.2 : 1.4 })
  }
  const tx = TextShape.getMutable(upText)
  tx.text = title
  tx.textColor = Color4.fromHexString(color.length === 7 ? color + 'FF' : color)
  tx.fontSize = kind === 'evolve' ? 7 : 5
  upTextT = 1.6
  Transform.getMutable(upText).position = V(run.x, 2.6, run.z)
}

// ───────── passive orbs (one ring per passive, one orb per level) + level rank aura ─────────
type Halo = { ring: Entity; orbs: Entity[] }
const halos: Halo[] = []
let rankDisc: Entity
let rankShown = -1
const RANKS = [
  { lvl: 50, color: '#CD7F32', name: 'BRONZE' },
  { lvl: 100, color: '#D8E4F0', name: 'SILVER' },
  { lvl: 150, color: '#FFD24A', name: 'GOLD' },
  { lvl: 200, color: '#B04BFF', name: 'VOID' }
]
export const rankOf = (lvl: number) => RANKS.filter((r) => lvl >= r.lvl).length - 1
export const rankName = (i: number) => RANKS[i]?.name ?? ''
export const rankColor = (i: number) => RANKS[i]?.color ?? '#FFFFFF'
function hex3(h: string) {
  const c = Color4.fromHexString(h + 'FF')
  return Color3.create(c.r, c.g, c.b)
}
function setupHalos() {
  for (let i = 0; i < 6; i++) {
    const ring = ent()
    MeshRenderer.setPlane(ring)
    const orbs: Entity[] = []
    for (let k = 0; k < MAX_PASSIVE_LVL; k++) {
      const o = ent()
      MeshRenderer.setSphere(o)
      orbs.push(o)
    }
    halos.push({ ring, orbs })
  }
  rankDisc = ent()
  MeshRenderer.setPlane(rankDisc)
}
let haloKey = ''
let haloSpin = 0
function renderHalos(run: Run | null, dt: number) {
  haloSpin += dt * 40
  const ps = run && run.alive ? ([...run.passives.entries()] as [PassiveId, number][]) : []
  const key = ps.map(([p, l]) => p + l).join(',')
  if (key !== haloKey) {
    haloKey = key
    halos.forEach((h, i) => {
      const p = ps[i]
      if (!p) return
      const [id, lv] = p
      const col = PASSIVES[id].color
      const glow = 0.8 + lv * 0.7 + (lv >= MAX_PASSIVE_LVL ? 2 : 0)
      Material.setPbrMaterial(h.ring, {
        texture: Material.Texture.Common({ src: 'images/ring.png' }),
        emissiveTexture: Material.Texture.Common({ src: 'images/ring.png' }),
        albedoColor: Color4.fromHexString(col + 'FF'),
        emissiveColor: hex3(col),
        emissiveIntensity: glow,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        castShadows: false
      })
      for (const o of h.orbs)
        Material.setPbrMaterial(o, { albedoColor: Color4.fromHexString(col + 'FF'), emissiveColor: hex3(col), emissiveIntensity: glow * 1.5, castShadows: false })
    })
  }
  halos.forEach((h, i) => {
    const p = ps[i]
    const rt = Transform.getMutable(h.ring)
    if (!p || !run) {
      rt.position = HIDE
      for (const o of h.orbs) Transform.getMutable(o).position = HIDE
      return
    }
    const lv = p[1]
    const R = 0.75 + i * 0.24
    const y = 0.05 + i * 0.01
    rt.position = V(run.x, y, run.z)
    rt.rotation = Quaternion.multiply(yawQ(haloSpin * (i % 2 ? -1 : 1)), Quaternion.fromEulerDegrees(90, 0, 0))
    rt.scale = V(R * 2, R * 2, 1)
    h.orbs.forEach((o, k) => {
      const ot = Transform.getMutable(o)
      if (k >= lv) {
        ot.position = HIDE
        return
      }
      const a = ((haloSpin * (i % 2 ? -1.5 : 1.5) + (k * 360) / lv + i * 30) * Math.PI) / 180
      const sz = lv >= MAX_PASSIVE_LVL ? 0.16 : 0.11
      ot.position = V(run.x + Math.sin(a) * R, 0.35 + i * 0.12 + Math.sin(a * 2 + i) * 0.05, run.z + Math.cos(a) * R)
      ot.scale = V(sz, sz, sz)
    })
  })
  // rank aura (Lv 50 bronze → 100 silver → 150 gold → 200 void)
  const rk = run && run.alive ? rankOf(run.level) : -1
  if (rk !== rankShown) {
    rankShown = rk
    if (rk >= 0) {
      const col = RANKS[rk].color
      Material.setPbrMaterial(rankDisc, {
        texture: Material.Texture.Common({ src: 'images/rank.png' }),
        emissiveTexture: Material.Texture.Common({ src: 'images/rank.png' }),
        albedoColor: Color4.fromHexString(col + 'FF'),
        emissiveColor: hex3(col),
        emissiveIntensity: 2 + rk * 1.2,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        castShadows: false
      })
    }
  }
  const dt_ = Transform.getMutable(rankDisc)
  if (rk >= 0 && run) {
    const d = 4.2 + rk * 0.5
    dt_.position = V(run.x, 0.04, run.z)
    dt_.rotation = Quaternion.multiply(yawQ(-haloSpin * 0.5), Quaternion.fromEulerDegrees(90, 0, 0))
    dt_.scale = V(d, d, 1)
  } else dt_.position = HIDE
  // floating upgrade title
  if (upTextT > 0) {
    upTextT -= dt
    const t = Transform.getMutable(upText)
    if (upTextT <= 0) t.position = HIDE
    else if (run) t.position = V(run.x, 2.6 + (1.6 - upTextT) * 0.6, run.z)
  }
}

// ───────── spawn / death / hit juice ─────────
let spawnPool: Pool
let deathPool: Pool
function spawnPuff(x: number, z: number, s: number) {
  const e = spawnPool.take()
  if (!e) return
  Transform.getMutable(e).position = V(x, 0.03, z)
  active.push({ e, life: 0.45, max: 0.45, kind: 'up', asc: 0, pool: spawnPool, r: 0.7 * s })
}
function deathPuff(x: number, z: number, s: number) {
  const e = deathPool.take()
  if (!e) return
  Transform.getMutable(e).position = V(x, 0.05, z)
  active.push({ e, life: 0.55, max: 0.55, kind: 'up', asc: 0, pool: deathPool, r: 0.75 * s })
}

// ───────── Zeus lightning + divine form ─────────
let zeusPool: Pool
let divinePool: Pool
let godAura: Entity
let godShown = false
/** the god's divine form follows the player's avatar (halo, wings of light, aura) */
export function setGodForm(on: boolean) {
  if (on === godShown) return
  godShown = on
  if (on) {
    GltfContainer.createOrReplace(godAura, { src: 'models/god_aura.glb' })
    AvatarAttach.createOrReplace(godAura, { anchorPointId: AvatarAnchorPointType.AAPT_POSITION })
  } else {
    AvatarAttach.deleteFrom(godAura)
    GltfContainer.deleteFrom(godAura)
    Transform.getMutable(godAura).position = HIDE
  }
}

let aimYaw = 0
/** where the player aims (camera yaw) — set by the game each frame */
export function setAim(y: number) {
  aimYaw = y
}

/** clear everything (run ended) */
export function clearView() {
  clearSkills2()
  clearGods()
  renderRun(null, [], 0)
  nukeFlight = null
  Transform.getMutable(missile).position = HIDE
  for (const bv of bossVis) {
    Tween.deleteFrom(bv.ent)
    Transform.getMutable(bv.ent).position = HIDE
    bv.shown = 0
    bv.lastId = 0
  }
}


// ───────── second wave of auto-skills: Frost Comet, Arc Chain, Moon Chakram, Hex Mine, Prism Ray, Spirit Wisps ─────────
const SK2: WeaponId[] = ['frost', 'chain', 'chakram', 'mine', 'beam', 'wisp']
type K2 = 'comet' | 'frost' | 'arc' | 'chakram' | 'hex' | 'boom' | 'beam' | 'wisp'
const P2 = {} as Record<K2, Pool[]>
const src2 = (k: K2, t: number) => `models/fx_${k}${TIER_SUFFIX[t]}.glb`
function pools2(k: K2, n: number, max: number, spin = 0) {
  P2[k] = [0, 1, 2, 3].map(
    (t) =>
      new Pool(() => {
        const e = ent()
        GltfContainer.create(e, { src: src2(k, t) })
        if (spin) Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), spin)
        return e
      }, t === 0 ? n : 1, max)
  )
}
type Anim = { e: Entity; pool: Pool; life: number; max: number; upd: (k: number, t: Transform_) => void }
type Transform_ = ReturnType<typeof Transform.getMutable>
const anims: Anim[] = []
const mineEnt = new Map<number, { e: Entity; t: number }>()
let wispEnt: { e: Entity; t: number }[] = []
const chakLocal: { e: Entity; t: number }[] = []
const chakRemote: { x: number; z: number; fx: number; fz: number; d: number; t: number; dur: number; e: Entity; pool: Pool }[] = []
const remoteMines: { a: Anim; x: number; z: number }[] = []
const remoteProjs: { e: Entity; pool: Pool; life: number }[] = []

function setupSkills2() {
  pools2('comet', 4, 16)
  pools2('frost', 4, 16)
  pools2('arc', 12, 36)
  pools2('chakram', 3, 10, 900)
  pools2('hex', 4, 12, 60)
  pools2('boom', 4, 14)
  pools2('beam', 3, 6)
  pools2('wisp', 4, 14)
}
const tier2 = (run: Run | null, tiers: number[] | undefined, id: WeaponId) => {
  const i = 3 + SK2.indexOf(id)
  return Math.max(0, Math.min(3, tiers ? tiers[i] ?? 0 : run ? tierOf(run, id) : 0))
}
function anim(k: K2, t: number, life: number, upd: Anim['upd']) {
  const pool = P2[k][t]
  const e = pool.take()
  if (!e) return null
  const a = { e, pool, life, max: life, upd }
  anims.push(a)
  upd(0, Transform.getMutable(e))
  return a
}

/** returns true if the event belongs to the new skills */
function playSkill2(ev: Ev, run: Run | null, tiers?: number[]): boolean {
  switch (ev.t) {
    case 'comet': {
      const t = tier2(run, tiers, 'frost')
      const s = 0.8 + ev.r * 0.35
      anim('comet', t, 0.38, (k, tr) => {
        tr.position = V(ev.x - 2.2 * (1 - k), 9 * (1 - k) + s * 0.9, ev.z - 1.2 * (1 - k))
        tr.rotation = Quaternion.fromEulerDegrees(-14, 60, 0)
        tr.scale = V(s, s, s)
      })
      return true
    }
    case 'frostHit': {
      const t = tier2(run, tiers, 'frost')
      anim('frost', t, 0.55, (k, tr) => {
        const d = ev.r * 2 * (0.35 + 0.65 * Math.sqrt(k))
        tr.position = V(ev.x, 0.04, ev.z)
        tr.scale = V(d, 0.6 + (1 - k) * 1.4, d)
      })
      return true
    }
    case 'arc': {
      const t = tier2(run, tiers, 'chain')
      for (let i = 0; i + 1 < ev.pts.length; i++) {
        const [x0, z0] = ev.pts[i]
        const [x1, z1] = ev.pts[i + 1]
        const len = Math.hypot(x1 - x0, z1 - z0) || 0.1
        const yaw = (Math.atan2(x1 - x0, z1 - z0) * 180) / Math.PI
        const roll = Math.random() * 180
        anim('arc', t, 0.2 + i * 0.015, (k, tr) => {
          tr.position = V(x0, 1.0, z0)
          tr.rotation = Quaternion.multiply(yawQ(yaw), Quaternion.fromEulerDegrees(0, 0, roll + k * 40))
          tr.scale = V(1 + (1 - k) * 0.4, 1 + (1 - k) * 0.4, len)
        })
      }
      return true
    }
    case 'chakram': {
      if (run && !tiers) return true // my own chakrams are drawn from the simulation
      const t = tier2(run, tiers, 'chakram')
      const e = P2.chakram[t].take()
      if (!e) return true
      const a = (ev.yaw * Math.PI) / 180
      chakRemote.push({ x: ev.x, z: ev.z, fx: Math.sin(a), fz: Math.cos(a), d: Math.min(14, ev.d), t: 0, dur: Math.min(2, ev.dur), e, pool: P2.chakram[t] })
      return true
    }
    case 'mine': {
      if (run && !tiers) return true // my own mines are drawn from the simulation
      // another hunter's hex mine: sits on the ground until it blows (or ~9 s)
      const t = tier2(run, tiers, 'mine')
      const a = anim('hex', t, 9, (_k, tr) => {
        tr.position = V(ev.x, 0.02, ev.z)
        tr.scale = V(1.1, 1.1, 1.1)
      })
      if (a) remoteMines.push({ a, x: ev.x, z: ev.z })
      return true
    }
    case 'proj': {
      if (run && !tiers) return true
      // another hunter's crystal shard / seraph feather in flight
      const feather = ev.k >= 4
      const pool = feather ? featherPool[ev.k - 4] : boltPool[Math.max(0, Math.min(3, ev.k))]
      const e = pool?.take()
      if (!e) return true
      const tr = Transform.getMutable(e)
      tr.position = V(ev.x, 1.1, ev.z)
      tr.rotation = yawQ((Math.atan2(ev.vx, ev.vz) * 180) / Math.PI)
      const sz = feather ? 1.3 : 1.1
      tr.scale = V(sz, sz, sz)
      Tween.createOrReplace(e, {
        mode: Tween.Mode.Move({ start: V(ev.x, 1.1, ev.z), end: V(ev.x + ev.vx * ev.life, 1.1, ev.z + ev.vz * ev.life) }),
        duration: ev.life * 1000,
        easingFunction: EasingFunction.EF_LINEAR
      })
      remoteProjs.push({ e, pool, life: ev.life })
      return true
    }
    case 'boom': {
      if (tiers)
        for (let i = remoteMines.length - 1; i >= 0; i--) {
          const m = remoteMines[i]
          if (Math.hypot(m.x - ev.x, m.z - ev.z) < 1.6) {
            m.a.life = Math.min(m.a.life, 0.01)
            remoteMines.splice(i, 1)
          }
        }
      const t = tier2(run, tiers, 'mine')
      anim('boom', t, 0.5, (k, tr) => {
        const d = ev.r * 2 * (0.3 + 0.7 * Math.sqrt(k))
        tr.position = V(ev.x, 0.04, ev.z)
        tr.scale = V(d, 1 + (1 - k) * 2.5, d)
      })
      return true
    }
    case 'sweep': {
      const t = tier2(run, tiers, 'beam')
      const mine = !!run && !tiers
      for (let i = 0; i < Math.min(3, ev.n); i++)
        anim('beam', t, ev.dur, (k, tr) => {
          const cx = mine && run ? run.x : ev.x
          const cz = mine && run ? run.z : ev.z
          tr.position = V(cx, 1.0, cz)
          tr.rotation = yawQ(ev.yaw + k * 360 + (i * 360) / ev.n)
          const w = 1 + Math.sin(k * Math.PI) * 0.5
          tr.scale = V(w, w, Math.min(16, ev.len) * (0.4 + 0.6 * Math.min(1, k * 5)))
        })
      return true
    }
    case 'dash': {
      if (run && !tiers) return true // my wisps are drawn from the simulation
      const t = tier2(run, tiers, 'wisp')
      const yaw = (Math.atan2(ev.x1 - ev.x0, ev.z1 - ev.z0) * 180) / Math.PI
      anim('wisp', t, 0.22, (k, tr) => {
        tr.position = V(ev.x0 + (ev.x1 - ev.x0) * k, 1.1, ev.z0 + (ev.z1 - ev.z0) * k)
        tr.rotation = yawQ(yaw)
        tr.scale = V(1, 1, 1)
      })
      return true
    }
  }
  return false
}

function renderSkills2(run: Run | null, dt: number) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i]
    a.life -= dt
    if (a.life <= 0) {
      a.pool.give(a.e)
      anims.splice(i, 1)
      continue
    }
    a.upd(1 - a.life / a.max, Transform.getMutable(a.e))
  }
  // remote chakrams fly out and back from where they were thrown
  for (let i = chakRemote.length - 1; i >= 0; i--) {
    const c = chakRemote[i]
    c.t += dt
    if (c.t >= c.dur) {
      c.pool.give(c.e)
      chakRemote.splice(i, 1)
      continue
    }
    const s = Math.sin((c.t / c.dur) * Math.PI) * c.d
    Transform.getMutable(c.e).position = V(c.x + c.fx * s, 1.0, c.z + c.fz * s)
  }
  const live = run && run.alive ? run : null
  // my chakrams (from the simulation, so hits line up)
  const ct = live ? tierOf(live, 'chakram') : 0
  const want = live ? live.chakrams.length : 0
  while (chakLocal.length > want) {
    const c = chakLocal.pop()!
    P2.chakram[c.t].give(c.e)
  }
  if (live)
    live.chakrams.forEach((c, i) => {
      let v = chakLocal[i]
      if (v && v.t !== ct) {
        P2.chakram[v.t].give(v.e)
        chakLocal[i] = undefined as any
        v = undefined as any
      }
      if (!v) {
        const e = P2.chakram[ct].take()
        if (!e) return
        v = chakLocal[i] = { e, t: ct }
      }
      const k = Math.min(1, c.t / c.dur)
      const s = Math.sin(k * Math.PI) * c.d
      const bx = k < 0.5 ? c.ox : live.x
      const bz = k < 0.5 ? c.oz : live.z
      const sz = lvlSize(live, 'chakram')
      const tr = Transform.getMutable(v.e)
      tr.position = V(bx + c.fx * s, 1.0, bz + c.fz * s)
      tr.scale = V(sz, sz, sz)
    })
  // my hex mines
  const seen = new Set<number>()
  const mt = live ? tierOf(live, 'mine') : 0
  if (live)
    for (const m of live.mines) {
      seen.add(m.id)
      let v = mineEnt.get(m.id)
      if (!v) {
        const e = P2.hex[mt].take()
        if (!e) continue
        v = { e, t: mt }
        mineEnt.set(m.id, v)
        const sz = 0.9 + 0.08 * live.w('mine')
        const tr = Transform.getMutable(e)
        tr.position = V(m.x, 0.02, m.z)
        tr.scale = V(sz, sz, sz)
      }
    }
  for (const [id, v] of mineEnt)
    if (!seen.has(id)) {
      P2.hex[v.t].give(v.e)
      mineEnt.delete(id)
    }
  // my spirit wisps
  const wt = live ? tierOf(live, 'wisp') : 0
  const ws = live ? live.wisps : []
  while (wispEnt.length > ws.length) {
    const w = wispEnt.pop()!
    P2.wisp[w.t].give(w.e)
  }
  ws.forEach((w, i) => {
    let v = wispEnt[i]
    if (v && v.t !== wt) {
      P2.wisp[v.t].give(v.e)
      v = undefined as any
    }
    if (!v) {
      const e = P2.wisp[wt].take()
      if (!e) return
      v = wispEnt[i] = { e, t: wt }
    }
    const tr = Transform.getMutable(v.e)
    const dx = w.dash > 0 ? w.tx - w.x : Math.cos(w.ph)
    const dz = w.dash > 0 ? w.tz - w.z : -Math.sin(w.ph)
    tr.position = V(w.x, 1.3 + Math.sin(w.ph * 2) * 0.15, w.z)
    tr.rotation = yawQ((Math.atan2(dx, dz) * 180) / Math.PI)
    const sz = live ? lvlSize(live, 'wisp') : 1
    tr.scale = V(sz, sz, sz)
  })
}

function clearSkills2() {
  for (const a of anims.splice(0)) a.pool.give(a.e)
  for (const c of chakRemote.splice(0)) c.pool.give(c.e)
  for (const c of chakLocal.splice(0)) if (c) P2.chakram[c.t].give(c.e)
  for (const [, v] of mineEnt) P2.hex[v.t].give(v.e)
  mineEnt.clear()
  for (const w of wispEnt.splice(0)) if (w) P2.wisp[w.t].give(w.e)
}


// ───────── GOD POWERS + sky-god boss attacks ─────────
let featherPool: Pool[]
const GP = {} as Record<'kame' | 'meteor' | 'hole' | 'lsword' | 'nuke' | 'bbeam' | 'borb', Pool[]>
const gAnims: Anim[] = []
const orbEnt = new Map<number, { e: Entity; pool: Pool }>()
const allyEnt = new Map<number, { e: Entity; pool: Pool }>()
function setupGods() {
  const mk = (src: string, n: number, max: number, spin = 0) =>
    new Pool(() => {
      const e = ent()
      GltfContainer.create(e, { src })
      if (spin) Tween.setRotateContinuous(e, Quaternion.fromEulerDegrees(0, 1, 0), spin)
      return e
    }, n, max)
  featherPool = [mk('models/fx_feather.glb', 6, 24), mk('models/fx_feather_max.glb', 1, 24)]
  GP.kame = [mk('models/fx_kame.glb', 1, 3), mk('models/fx_kame_max.glb', 1, 3)]
  GP.meteor = [mk('models/fx_meteor.glb', 2, 10), mk('models/fx_meteor_max.glb', 1, 3)]
  GP.hole = [mk('models/fx_hole.glb', 1, 3, 240), mk('models/fx_hole_max.glb', 1, 3, 240)]
  GP.lsword = [mk('models/fx_lsword.glb', 4, 14), mk('models/fx_lsword_max.glb', 1, 14)]
  GP.nuke = [mk('models/fx_nuke.glb', 1, 4)]
  GP.bbeam = [mk('models/fx_bbeam.glb', 1, 3)]
  GP.borb = [mk('models/fx_borb.glb', 12, 40, 300)]
  MP.ringWarn = []
  MP.ring = []
  for (let i = 0; i < 6; i++) {
    MP.ringWarn.push(mk(`models/fx_mring${i}_warn.glb`, 1, 3))
    MP.ring.push(mk(`models/fx_mring${i}.glb`, 1, 3))
  }
  for (const k of RAIN_KINDS) MP.rain[k] = mk(`models/fx_rain_${k}.glb`, 1, 34)
  MP.pillar = mk('models/fx_mpillar.glb', 1, 52)
  MP.sun = mk('models/fx_msun.glb', 1, 4, 40)
  MP.spoke = mk('models/fx_bbeam.glb', 1, 20)
  MP.shade = mk('models/fx_shade.glb', 1, 14)
  MP.fox = mk('models/fx_fox.glb', 1, 14, 200)
  MP.safe = mk('models/fx_safe.glb', 1, 3, 30)
  MP.light = mk('models/fx_godlight.glb', 1, 1)
  MP.chrono = mk('models/fx_chrono.glb', 1, 1, 50)
  MP.ascend = mk('models/fx_ascend_ring.glb', 1, 4)
  MP.apillar = mk('models/fx_mpillar.glb', 1, 3, 30)
  MP.knife = mk('models/fx_knife.glb', 4, 60)
  MP.allyFox = mk('models/fx_fox.glb', 1, 24, 200)
  MP.allyShade = mk('models/fx_shade.glb', 1, 6)
}
// mythic boss patterns (Lv 350-1111)
const RAIN_KINDS = ['spear', 'cannon', 'kunai', 'fire', 'fist', 'bolt', 'star'] as const
const MP = { rain: {} as Record<string, Pool> } as {
  ringWarn: Pool[]; ring: Pool[]; rain: Record<string, Pool>; pillar: Pool; sun: Pool; spoke: Pool; shade: Pool; fox: Pool
  safe: Pool; light: Pool; chrono: Pool; ascend: Pool; apillar: Pool; knife: Pool; allyFox: Pool; allyShade: Pool
}
const ringIdx = (r0: number) => Math.max(0, Math.min(5, Math.round((r0 - 2.2) / 4)))
function warnAt(x: number, z: number, r: number, dur: number) {
  const e = warnPool.take()
  if (!e) return
  Transform.getMutable(e).position = V(x, 0.05, z)
  fxs.push({ e, life: dur, max: dur, pool: warnPool, kind: 'warn', r })
}
function playMyth(ev: Ev, run: Run | null): boolean {
  switch (ev.t) {
    case 'mRingWarn': {
      gAnim(MP.ringWarn[ringIdx(ev.r0)], ev.dur, (k, tr) => {
        tr.position = V(ev.x, 0, ev.z)
        const s = 1 + Math.sin(k * k * 46) * 0.012
        tr.scale = V(s, 1, s)
      })
      return true
    }
    case 'mRing': {
      gAnim(MP.ring[ringIdx(ev.r0)], 0.5, (k, tr) => {
        tr.position = V(ev.x, 0, ev.z)
        const s = 1 + k * 0.06
        tr.scale = V(s, 0.05 + Math.sin(Math.min(1, k * 1.7) * Math.PI) * 1.7, s)
      })
      return true
    }
    case 'mStrike': {
      if (!ev.own) warnAt(ev.x, ev.z, ev.r, ev.delay)
      const delay = ev.delay
      if (ev.k === 'pillar') {
        gAnim(MP.pillar, delay + 0.45, (k, tr) => {
          const el = k * (delay + 0.45)
          if (el < delay - 0.04) return void (tr.position = HIDE)
          const a = el - delay
          const w = ev.r * 2 * (a < 0.25 ? 1 : Math.max(0, 1 - (a - 0.25) / 0.2))
          tr.position = V(ev.x, 0, ev.z)
          tr.scale = V(w, Math.min(1, 0.2 + (a + 0.04) * 8), w)
        })
      } else if (ev.k === 'sun') {
        gAnim(MP.sun, delay + 0.3, (k, tr) => {
          const el = k * (delay + 0.3)
          const f = Math.min(1, el / delay)
          const s = ev.r * (el <= delay ? 0.45 + 0.65 * f : 1.1 * Math.max(0, 1 - (el - delay) / 0.3))
          tr.position = V(ev.x, 0.6 + 15 * Math.pow(1 - f, 1.6), ev.z)
          tr.scale = V(s, s, s)
        })
      } else if (ev.k === 'bolt') {
        gAnim(MP.rain.bolt, delay + 0.25, (k, tr) => {
          const el = k * (delay + 0.25)
          if (el < delay - 0.1) return void (tr.position = HIDE)
          const f = 1 + Math.sin(el * 90) * 0.25
          tr.position = V(ev.x, 0, ev.z)
          tr.rotation = yawQ(el * 900)
          tr.scale = V(f, 1, f)
        })
      } else {
        const pool = MP.rain[ev.k] ?? MP.rain.star
        const ox = -3.2, oz = -2.1, h = 18
        gAnim(pool, delay, (k, tr) => {
          const f = k * k
          tr.position = V(ev.x + ox * (1 - f), h * (1 - f), ev.z + oz * (1 - f))
          tr.rotation = Quaternion.fromEulerDegrees(-6.5, ev.k === 'kunai' || ev.k === 'spear' ? ev.x * 53 : 0, 10)
          const s = ev.k === 'fist' ? 1.3 : 1.15
          tr.scale = V(s, s, s)
        })
      }
      return true
    }
    case 'mSpokes': {
      for (let i = 0; i < ev.n; i++) {
        const yaw0 = ev.a0 + (i * 360) / ev.n
        const a = (yaw0 * Math.PI) / 180
        const e = ev.own ? undefined : warnPool.take()
        if (e) {
          const t = Transform.getMutable(e)
          t.position = V(ev.x + Math.sin(a) * ev.len * 0.5, 0.05, ev.z + Math.cos(a) * ev.len * 0.5)
          t.rotation = yawQ(yaw0)
          t.scale = V(ev.w, 1, ev.len)
          fxs.push({ e, life: ev.warm, max: ev.warm, pool: warnPool, kind: 'tracer', r: ev.len })
        }
        const life = ev.warm + ev.dur
        gAnim(MP.spoke, life, (k, tr) => {
          const el = k * life
          if (el < ev.warm) return void (tr.position = HIDE)
          const age = el - ev.warm
          tr.position = V(ev.x, 1.0, ev.z)
          tr.rotation = yawQ(yaw0 + ev.omega * age)
          const w = ev.w * (1 + Math.sin(el * 50) * 0.1) * (life - el < 0.2 ? (life - el) / 0.2 : 1)
          tr.scale = V(w, w, ev.len * Math.min(1, age * 8))
        })
      }
      return true
    }
    case 'mBlink':
      deathPuff(ev.x0, ev.z0, 2.6)
      deathPuff(ev.x1, ev.z1, 2.6)
      return true
    case 'mLight': {
      for (const [x, z, r] of ev.safe)
        gAnim(MP.safe, ev.dur + 0.4, (k, tr) => {
          const s = r * 2 * Math.min(1, k * 9)
          tr.position = V(x, 0, z)
          tr.scale = V(s, 1 + Math.sin(k * 40) * 0.06, s)
        })
      const cx = run ? run.x : 32
      const cz = run ? run.z : 24
      const life = ev.dur + 0.5
      gAnim(MP.light, life, (k, tr) => {
        const el = k * life
        const f = Math.min(1, el / ev.dur)
        const out = el > ev.dur ? Math.max(0, 1 - (el - ev.dur) / 0.5) : 1
        tr.position = V(cx, 0, cz)
        tr.scale = V(64 - 30 * f * f, (2 + 44 * f * f) * out, 64 - 30 * f * f)
      })
      return true
    }
    case 'mChrono': {
      const x0 = run ? run.x : 32
      const z0 = run ? run.z : 24
      gAnim(MP.chrono, ev.dur, (k, tr) => {
        const s = 8 * Math.min(1, k * 10) * (k > 0.88 ? (1 - k) / 0.12 : 1)
        tr.position = V(run ? run.x : x0, 0, run ? run.z : z0)
        tr.scale = V(s, 1, s)
      })
      return true
    }
    case 'genesis': {
      gAnim(MP.apillar, 1.6, (k, tr) => {
        const w = 6 * Math.sin(Math.min(1, k * 1.2) * Math.PI)
        tr.position = V(ev.x, 0, ev.z)
        tr.scale = V(w, 4 + k * 6, w)
      })
      gAnim(MP.ascend, 1.2, (k, tr) => {
        const s2 = 2 + k * ev.r * 2
        tr.position = V(ev.x, 0.12, ev.z)
        tr.scale = V(s2, 1, s2)
      })
      return true
    }
    case 'ascend': {
      const x = run ? run.x : 32
      const z = run ? run.z : 24
      ascendFx(x, z)
      return true
    }
  }
  return false
}
// giant golden words in the sky over a new God
let skyA: Entity | undefined
let skyB: Entity | undefined
let skyT = 0
let skyX = 32
let skyZ = 24
export function skyText(a: string, b: string, secs: number, x = 32, z = 24) {
  if (!skyA || !skyB) {
    skyA = ent()
    TextShape.create(skyA, { text: '', fontSize: 30, textColor: Color4.create(1, 0.86, 0.45, 1), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.22, outlineColor: Color3.create(0.3, 0.17, 0) })
    Billboard.create(skyA, { billboardMode: BillboardMode.BM_Y })
    skyB = ent()
    TextShape.create(skyB, { text: '', fontSize: 18, textColor: Color4.create(1, 0.98, 0.9, 1), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.2, outlineColor: Color3.create(0.3, 0.17, 0) })
    Billboard.create(skyB, { billboardMode: BillboardMode.BM_Y })
  }
  TextShape.getMutable(skyA).text = a
  TextShape.getMutable(skyB).text = b
  skyT = secs
  skyX = x
  skyZ = z
}
function renderSky(dt: number) {
  if (!skyA || !skyB) return
  if (skyT <= 0) return
  skyT -= dt
  if (skyT <= 0) {
    Transform.getMutable(skyA).position = HIDE
    Transform.getMutable(skyB).position = HIDE
    return
  }
  const bob = Math.sin(skyT * 1.3) * 0.4
  Transform.getMutable(skyA).position = V(skyX, 21 + bob, skyZ)
  Transform.getMutable(skyB).position = V(skyX, 17.6 + bob, skyZ)
}
/** the column of light and golden shockwaves when a hunter becomes God (also played for remote hunters) */
export function ascendFx(x: number, z: number) {
  gAnim(MP.apillar, 9, (k, tr) => {
    const el = k * 9
    const w = el < 0.6 ? el / 0.6 * 7 : el > 7.5 ? 7 * (9 - el) / 1.5 : 7 + Math.sin(el * 6) * 0.4
    tr.position = V(x, 0, z)
    tr.scale = V(w, Math.min(9, 0.4 + el * 12), w)
  })
  for (let i = 0; i < 4; i++)
    gAnim(MP.ascend, 1.6 + i * 0.7, (k, tr) => {
      const el = k * (1.6 + i * 0.7)
      const on = el > i * 0.7
      const f = on ? (el - i * 0.7) / 1.6 : 0
      const s = on ? 2 + f * 70 : 0.01
      tr.position = on ? V(x, 0.1 + i * 0.05, z) : HIDE
      tr.scale = V(s, 1, s)
    })
}
function gAnim(pool: Pool, life: number, upd: Anim['upd']) {
  const e = pool.take()
  if (!e) return
  gAnims.push({ e, pool, life, max: life, upd })
  upd(0, Transform.getMutable(e))
}
function playGod(ev: Ev, run: Run | null, tiers?: number[]): boolean {
  const mine = !!run && !tiers
  switch (ev.t) {
    case 'kame':
      gAnim(GP.kame[ev.max ? 1 : 0], ev.dur, (k, tr) => {
        const x = mine && run ? run.x : ev.x
        const z = mine && run ? run.z : ev.z
        tr.position = V(x, 1.3, z)
        tr.rotation = yawQ(ev.yaw)
        const grow = Math.min(1, k * 6)
        const w = ev.w * (1 + Math.sin(k * 40) * 0.08) * (k > 0.85 ? (1 - k) / 0.15 : 1)
        tr.scale = V(w, w, ev.len * grow)
      })
      return true
    case 'meteorFall': {
      const pool = GP.meteor[ev.big ? 1 : 0]
      const s = ev.big ? 1.6 : 1.1
      gAnim(pool, ev.delay, (k, tr) => {
        tr.position = V(ev.x - 7 * (1 - k), 1.7 * s + 20 * (1 - k), ev.z - 4 * (1 - k))
        tr.rotation = Quaternion.fromEulerDegrees(-28, 60, 0)
        tr.scale = V(s, s, s)
      })
      return true
    }
    case 'gnuke':
      gAnim(GP.nuke[0], 1.6, (k, tr) => {
        const d = ev.r * 2 * Math.min(1, 0.2 + k * 1.8)
        tr.position = V(ev.x, 0, ev.z)
        tr.scale = V(d, ev.r * (0.4 + k * 0.9), d)
      })
      return true
    case 'hole':
      gAnim(GP.hole[ev.max ? 1 : 0], ev.dur, (k, tr) => {
        const d = ev.r * (0.3 + 0.7 * Math.min(1, k * 4)) * (k > 0.9 ? (1 - k) / 0.1 : 1)
        tr.position = V(ev.x, 0.1, ev.z)
        tr.scale = V(d, d * 0.8, d)
      })
      return true
    case 'gsword':
      gAnim(GP.lsword[ev.max ? 1 : 0], ev.delay + 0.35, (k, tr) => {
        const fall = Math.min(1, (k * (ev.delay + 0.35)) / ev.delay)
        tr.position = V(ev.x, 0.05 + 12 * (1 - fall), ev.z)
        tr.rotation = yawQ(ev.x * 37)
        tr.scale = V(1.3, 1.3, 1.3)
      })
      return true
    case 'bbeamWarn': {
      const e = warnPool.take()
      if (!e) return true
      const a = (ev.yaw * Math.PI) / 180
      const t = Transform.getMutable(e)
      t.position = V(ev.x + Math.sin(a) * ev.len * 0.5, 0.05, ev.z + Math.cos(a) * ev.len * 0.5)
      t.rotation = yawQ(ev.yaw)
      t.scale = V(ev.w, 1, ev.len)
      fxs.push({ e, life: ev.dur, max: ev.dur, pool: warnPool, kind: 'tracer', r: ev.len })
      return true
    }
    case 'bbeam':
      gAnim(GP.bbeam[0], ev.dur, (k, tr) => {
        tr.position = V(ev.x, 2.2, ev.z)
        tr.rotation = Quaternion.multiply(yawQ(ev.yaw), Quaternion.fromEulerDegrees(4, 0, 0))
        const w = ev.w * (1 + Math.sin(k * 50) * 0.1)
        tr.scale = V(w, w, ev.len * Math.min(1, k * 8))
      })
      return true
  }
  return false
}
function renderGods(run: Run | null, dt: number) {
  for (let i = gAnims.length - 1; i >= 0; i--) {
    const a = gAnims[i]
    a.life -= dt
    if (a.life <= 0) {
      a.pool.give(a.e)
      gAnims.splice(i, 1)
      continue
    }
    a.upd(1 - a.life / a.max, Transform.getMutable(a.e))
  }
  // boss orbs (hostile projectiles), positioned every frame
  const seen = new Set<number>()
  if (run)
    for (const h of run.hostile) {
      seen.add(h.id)
      let o = orbEnt.get(h.id)
      if (!o) {
        const pool = h.k === 'shade' ? MP.shade : h.k === 'fox' ? MP.fox : GP.borb[0]
        const e = pool.take()
        if (!e) continue
        o = { e, pool }
        orbEnt.set(h.id, o)
      }
      const t = Transform.getMutable(o.e)
      if (h.k === 'shade') {
        t.position = V(h.x, 0, h.z)
        t.rotation = yawQ((Math.atan2(h.vx, h.vz) * 180) / Math.PI)
      } else t.position = V(h.x, h.k === 'fox' ? 0.1 : 1.1, h.z)
    }
  for (const [id, o] of orbEnt)
    if (!seen.has(id)) {
      o.pool.give(o.e)
      orbEnt.delete(id)
    }
  // friendly foxfire / shadow clones from the arts
  const seenA = new Set<number>()
  if (run)
    for (const a of run.allies) {
      seenA.add(a.id)
      let o = allyEnt.get(a.id)
      if (!o) {
        const pool = a.k === 'fox' ? MP.allyFox : MP.allyShade
        const e = pool.take()
        if (!e) continue
        o = { e, pool }
        allyEnt.set(a.id, o)
      }
      const t = Transform.getMutable(o.e)
      t.position = V(a.x, a.k === 'fox' ? 0.2 : 0, a.z)
      if (a.k === 'shade') t.rotation = yawQ((Math.atan2(a.vx, a.vz) * 180) / Math.PI)
    }
  for (const [id, o] of allyEnt)
    if (!seenA.has(id)) {
      o.pool.give(o.e)
      allyEnt.delete(id)
    }
}
function clearGods() {
  for (const a of gAnims.splice(0)) a.pool.give(a.e)
  for (const [, o] of orbEnt) o.pool.give(o.e)
  orbEnt.clear()
  for (const [, o] of allyEnt) o.pool.give(o.e)
  allyEnt.clear()
}

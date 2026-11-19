// THE PALE SOVEREIGN — co-op world boss. One health pool on the save server; the boss's moves are
// driven by the server clock so every hunter sees the same fight, while each client resolves the hits
// that land on its own avatar.
import {
  engine, Entity, Transform, GltfContainer, Animator, Tween, EasingFunction, TextShape, Billboard, BillboardMode, Font,
  TextAlignMode, inputSystem, InputAction, PointerEventType, AvatarAttach, AvatarAnchorPointType, AvatarLocomotionSettings,
  PlayerIdentityData, LightSource
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { getPlayer } from '@dcl/sdk/players'
import { getUserAccount, sendAsync, requirePayment } from '~system/EthereumController'
import { movePlayerTo } from '~system/RestrictedActions'
import { ARMORY, NUKE_TIER, RAID, BOSS, COSMETICS, cosmetic, GOLD_PACKS, MANA_TOKEN, SKILLS, SkillId, Build, skillTier, skillDps, TIER_SUFFIX, fitR } from './defs'
import { loadProfile, raidState, raidHit, equipCosmetic, pingServer, shopConfig, shopQuote, shopConfirm, Profile, Inventory, RaidState } from './api'
import { play, musicLevel } from './sfx'
import { PORTAL } from './world'

// ───────────────────────── state ─────────────────────────
export const R = {
  name: 'Hunter',
  online: false,
  status: 'waking the save server…',
  profile: null as Profile | null,
  inv: { items: {}, cosmetic: null, title: null } as Inventory,
  build: null as Build | null,
  raid: null as RaidState | null,
  offset: 0, // server clock − local clock (ms)
  hp: 400,
  maxHp: 400,
  dead: false,
  deadT: 0,
  invuln: 0,
  slowT: 0,
  hurtFlash: 0,
  lastHurt: 0,
  auto: false,
  atkT: 0,
  pending: 0,
  myHits: 0,
  nukeCd: 0,
  banner: '',
  bannerT: 0,
  loot: null as null | { items: string[]; gold: number },
  lootSeen: '',
  cosOpen: false,
  cosMsg: '',
  party: [] as { n: string; d: number; c: string; t: number }[],
  warnBoss: '',
  phase: 0,
  // treasury (same as the castle)
  goldShopOpen: false,
  goldShop: { enabled: false, gold: 10000, usd: 10 },
  packSel: 1,
  payBusy: false,
  payMsg: '',
  firstPurchase: false
}
export const bank = () => R.profile?.bank ?? 0
export const tier = () => Math.max(0, Math.min(ARMORY.length - 1, R.profile?.armory ?? 0))
export const bestLevel = () => Math.max(1, R.profile?.best.level ?? 1)
export const serverNow = () => Date.now() + R.offset
const levelScale = () => RAID.levelScale(bestLevel())

export function banner(text: string, t = 3) {
  R.banner = text
  R.bannerT = t
}

// ───────────────────────── helpers ─────────────────────────
const V = Vector3.create
const HIDE = V(0, -30, 0)
const yawQ = (d: number) => Quaternion.fromEulerDegrees(0, d, 0)
function ent(src?: string, pos = HIDE) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos })
  if (src) GltfContainer.create(e, { src })
  return e
}
class Pool {
  free: Entity[] = []
  constructor(private make: () => Entity, n: number) {
    for (let i = 0; i < n; i++) this.free.push(make())
  }
  take() {
    return this.free.pop()
  }
  give(e: Entity) {
    Tween.deleteFrom(e)
    Transform.getMutable(e).position = HIDE
    this.free.push(e)
  }
}
function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hashStr = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function me() {
  const t = Transform.getOrNull(engine.PlayerEntity)
  return t ? t.position : V(8, 0, 3)
}

// ───────────────────────── the boss on screen ─────────────────────────
let bossRoot: Entity
let bossModel: Entity
let bossLight: Entity
let bossTag: Entity
let anim = 'Idle'
let animT = 0
let bossPos = { x: BOSS.home.x, z: BOSS.home.z }
let bossY = 0
let bossYaw = 180
let shown = true
type Fx = { e: Entity; pool: Pool; life: number; max: number; kind: string; r: number; x: number; z: number; y?: number; vx?: number; vz?: number }
const fxs: Fx[] = []
let warnPool: Pool, conePool: Pool, eruptPool: Pool, shockPool: Pool, boltPool: Pool, hitPool: Pool, domePool: Pool, sweepPool: Pool, dmgPool: Pool

function setupBoss() {
  bossRoot = ent(undefined, V(BOSS.home.x, BOSS.baseY, BOSS.home.z))
  bossModel = engine.addEntity()
  Transform.create(bossModel, { parent: bossRoot, rotation: yawQ(bossYaw) })
  GltfContainer.create(bossModel, { src: BOSS.model })
  Animator.create(bossModel, {
    states: ['Idle', 'Swing', 'Slam', 'Cast', 'Roar', 'Death'].map((c) => ({ clip: c, playing: c === 'Idle', loop: c === 'Idle', speed: 1, weight: 1, shouldReset: c !== 'Idle' }))
  })
  bossLight = engine.addEntity()
  Transform.create(bossLight, { parent: bossRoot, position: V(0, 9.6, -1.2) })
  LightSource.create(bossLight, { type: LightSource.Type.Point({}), color: Color3.fromHexString('#FF5A14'), intensity: 9000, range: 9 })
  bossTag = ent(undefined, V(BOSS.home.x, 18.2, BOSS.home.z))
  TextShape.create(bossTag, { text: '', fontSize: 3, textColor: Color4.fromHexString('#FFD27A'), outlineWidth: 0.25, outlineColor: Color3.Black(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER })
  Billboard.create(bossTag, { billboardMode: BillboardMode.BM_Y })

  warnPool = new Pool(() => ent('models/fx_r_warn.glb'), 10)
  conePool = new Pool(() => ent('models/fx_r_cone.glb'), 1)
  eruptPool = new Pool(() => ent('models/fx_r_erupt.glb'), 9)
  shockPool = new Pool(() => ent('models/fx_r_shock.glb'), 2)
  boltPool = new Pool(() => ent('models/fx_r_bolt.glb'), 5)
  hitPool = new Pool(() => ent('models/fx_r_hit.glb'), 5)
  domePool = new Pool(() => ent('models/fx_r_dome.glb'), 1)
  sweepPool = new Pool(() => ent('models/fx_r_sweep.glb'), 1)
  dmgPool = new Pool(() => {
    const e = ent()
    TextShape.create(e, { text: '', fontSize: 4, textColor: Color4.White(), outlineWidth: 0.25, outlineColor: Color3.Black(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER })
    Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
    return e
  }, 10)
}

function playAnim(clip: string) {
  anim = clip
  animT = 0
  Animator.playSingleAnimation(bossModel, clip, true)
}

function spawnFx(pool: Pool, kind: string, x: number, z: number, life: number, r: number, y = 0.03, rot = 0) {
  const e = pool.take()
  if (!e) return null
  const t = Transform.getMutable(e)
  t.position = V(x, y, z)
  t.rotation = yawQ(rot)
  t.scale = V(r, 1, r)
  const f: Fx = { e, pool, life, max: life, kind, r, x, z, y }
  fxs.push(f)
  return f
}

function floatDmg(n: number, color: string, big = false) {
  const e = dmgPool.take()
  if (!e) return
  const ts = TextShape.getMutable(e)
  ts.text = n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : String(Math.round(n))
  ts.textColor = Color4.fromHexString(color)
  ts.fontSize = big ? 7 : 4
  const x = bossPos.x + (Math.random() - 0.5) * 4
  const y = 4 + Math.random() * 7
  Transform.getMutable(e).position = V(x, y, bossPos.z - 2.5)
  fxs.push({ e, pool: dmgPool, life: 0.9, max: 0.9, kind: 'dmg', r: 1, x, z: bossPos.z - 2.5, y })
}

// ───────────────────────── deterministic attack schedule ─────────────────────────
// times inside an 18 s cycle (scaled down as the reaper weakens)
const PLAN: { t: number; k: 'move' | 'sweep' | 'slam' | 'erupt' | 'bolts' | 'finale' }[] = [
  { t: 0.0, k: 'move' },
  { t: 2.4, k: 'sweep' },
  { t: 5.8, k: 'slam' },
  { t: 9.2, k: 'erupt' },
  { t: 12.4, k: 'bolts' },
  { t: 15.0, k: 'finale' }
]
const CYCLE = [18, 14, 11]
const DMG = { sweep: 80, slam: 130, erupt: 70, bolt: 42, dome: 35 }
type Pending = { at: number; fn: () => void; always?: boolean }
let pending: Pending[] = []
let lastK = -1
let lastLocal = 0

function phaseOf(r: RaidState | null) {
  if (!r) return 0
  const f = r.hp / r.maxHp
  return f < 0.2 ? 2 : f < 0.5 ? 1 : 0
}

function schedule(T: number) {
  const r = R.raid
  if (!r || !r.alive) return
  const ph = phaseOf(r)
  R.phase = ph
  const C = CYCLE[ph]
  const s = C / 18
  const k = Math.floor(T / C)
  const local = T - k * C
  if (k !== lastK) {
    lastK = k
    lastLocal = -0.001
  }
  const rnd = mulberry(k * 7919 + hashStr(r.day))
  // pre-roll this cycle's choices so every client draws the same numbers in the same order
  const anchor = { x: BOSS.home.x + (rnd() - 0.5) * 1.2, z: BOSS.home.z + (rnd() - 0.5) * 0.9 }
  const eruptN = 4 + ph * 2
  const erupts: [number, number][] = []
  for (let i = 0; i < eruptN; i++) erupts.push([2.2 + rnd() * 11.6, 2.4 + rnd() * 11.4])
  const finaleDome = ph >= 1 && rnd() < 0.85
  for (const p of PLAN) {
    const at = p.t * s
    if (at > lastLocal && at <= local) startAttack(p.k, T, s, ph, anchor, erupts, finaleDome)
  }
  lastLocal = local
}

function startAttack(kind: string, T: number, s: number, ph: number, anchor: { x: number; z: number }, erupts: [number, number][], dome: boolean) {
  const p = me()
  const mult = 1 + ph * 0.25
  if (kind === 'move') {
    const from = V(bossPos.x, BOSS.baseY, bossPos.z)
    bossPos = anchor
    Tween.createOrReplace(bossRoot, { mode: Tween.Mode.Move({ start: from, end: V(anchor.x, BOSS.baseY, anchor.z) }), duration: 1600 * s, easingFunction: EasingFunction.EF_EASESINE })
    bossY = 0
  } else if (kind === 'sweep') {
    const yaw = faceYaw(p.x, p.z)
    const CR = fitR(bossPos.x, bossPos.z, 9.5)
    const c = spawnFx(conePool, 'warn', bossPos.x, bossPos.z, 1.6 * s, CR, 0.04, yaw)
    play('r_laugh', 1)
    pending.push({ at: T + 0.6 * s, fn: () => playAnim('Swing') })
    pending.push({
      at: T + 1.6 * s,
      fn: () => {
        play('r_swing')
        spawnFx(sweepPool, 'sweep', bossPos.x, bossPos.z, 0.5, CR, 1.0, yaw)
        const q = me()
        const dx = q.x - bossPos.x
        const dz = q.z - bossPos.z
        const d = Math.hypot(dx, dz)
        const ang = Math.abs(((((Math.atan2(dx, dz) * 180) / Math.PI - yaw) % 360) + 540) % 360 - 180)
        if (d < CR + 0.3 && ang < 72) hurt(DMG.sweep * mult, 'the scythe')
        if (c) c.life = 0
      }
    })
  } else if (kind === 'slam') {
    // he leaps toward you and crashes down: a huge circle right in front of him
    const yaw = faceYaw(p.x, p.z)
    const a = (yaw * Math.PI) / 180
    const cx = clamp(bossPos.x + Math.sin(a) * 4.5, 3.2, 12.8)
    const cz = clamp(bossPos.z + Math.cos(a) * 4.5, 3.0, 13)
    const SR = fitR(cx, cz, 4.6)
    spawnFx(warnPool, 'warn', cx, cz, 1.8 * s, SR)
    play('r_roar', 1.1)
    playAnim('Slam')
    const hop = { x: clamp(bossPos.x + Math.sin(a) * 0.5, 7.4, 8.6), z: clamp(bossPos.z + Math.cos(a) * 0.5, 8.3, 9.1) }
    const Y0 = BOSS.baseY
    Tween.createOrReplace(bossRoot, { mode: Tween.Mode.Move({ start: V(bossPos.x, Y0, bossPos.z), end: V(hop.x, Y0 + 1.2, hop.z) }), duration: 900 * s, easingFunction: EasingFunction.EF_EASEOUTQUAD })
    pending.push({
      at: T + 0.9 * s,
      fn: () => Tween.createOrReplace(bossRoot, { mode: Tween.Mode.Move({ start: V(hop.x, Y0 + 1.2, hop.z), end: V(hop.x, Y0, hop.z) }), duration: 450 * s, easingFunction: EasingFunction.EF_EASEINQUAD })
    })
    bossPos = hop
    pending.push({
      at: T + 1.8 * s,
      fn: () => {
        play('r_slam')
        spawnFx(shockPool, 'shock', cx, cz, 0.7, fitR(cx, cz, 9.2) / 2)
        spawnFx(eruptPool, 'burst', cx, cz, 0.5, fitR(cx, cz, 2.5) / 1.55)
        const q = me()
        if (Math.hypot(q.x - cx, q.z - cz) < SR + 0.1) hurt(DMG.slam * mult, 'the slam')
      }
    })
  } else if (kind === 'erupt') {
    playAnim('Cast')
    play('r_timestop', 0.8)
    const spots = [...erupts, [clamp(p.x, 2.2, 13.8), clamp(p.z, 2.2, 13.8)] as [number, number]]
    for (const [x, z] of spots) spawnFx(warnPool, 'warn', x, z, 1.6 * s, fitR(x, z, 1.9))
    pending.push({
      at: T + 1.6 * s,
      fn: () => {
        play('r_erupt')
        const q = me()
        let hit = false
        for (const [x, z] of spots) {
          spawnFx(eruptPool, 'erupt', x, z, 0.9, fitR(x, z, 1.9 * 1.55) / 1.55)
          if (!hit && Math.hypot(q.x - x, q.z - z) < fitR(x, z, 1.9) + 0.1) hit = true
        }
        if (hit) hurt(DMG.erupt * mult, 'the lava')
      }
    })
  } else if (kind === 'bolts') {
    playAnim('Cast')
    const n = 3 + ph
    for (let i = 0; i < n; i++)
      pending.push({
        at: T + (0.3 + i * 0.32) * s,
        fn: () => {
          play('r_bolt', 0.9 + Math.random() * 0.2)
          const q = me()
          const sx = bossPos.x - 1.5 + Math.random() * 3
          const sz = bossPos.z - 2.2
          const dx = q.x - sx
          const dz = q.z - sz
          const d = Math.hypot(dx, dz) || 1
          const f = spawnFx(boltPool, 'bolt', sx, sz, 2.2, 1, 9.5)
          if (f) {
            f.vx = (dx / d) * 11
            f.vz = (dz / d) * 11
            Transform.getMutable(f.e).scale = V(1.3, 1.3, 1.3)
          }
        }
      })
  } else if (kind === 'finale') {
    if (dome) {
      playAnim('Cast')
      play('r_timestop')
      const DR = fitR(bossPos.x, bossPos.z, 7.2)
      spawnFx(domePool, 'dome', bossPos.x, bossPos.z, 2.4 * s, DR, 0)
      pending.push({
        at: T + 0.8 * s,
        fn: () => {
          const q = me()
          if (Math.hypot(q.x - bossPos.x, q.z - bossPos.z) < DR) {
            R.slowT = 4
            hurt(DMG.dome * mult, 'the hourglass')
            banner('TIME STOPS AROUND YOU — get out!', 2)
          }
        }
      })
    } else {
      playAnim('Roar')
      play('r_roar')
    }
  }
}

function faceYaw(px: number, pz: number) {
  // he turns toward you, but never so far that his scythe leaves the parcel
  const yaw = (Math.atan2(px - bossPos.x, pz - bossPos.z) * 180) / Math.PI
  const rel = ((yaw - 180 + 540) % 360) - 180
  return 180 + clamp(rel, -65, 65)
}

// ───────────────────────── the player ─────────────────────────
function recomputeMaxHp() {
  const m = R.profile?.meta.hp ?? 0
  const prev = R.maxHp
  R.maxHp = 400 + m * 80 + tier() * 60
  if (R.hp === prev || R.hp > R.maxHp) R.hp = R.maxHp
}

function hurt(dmg: number, by: string) {
  if (R.dead || R.invuln > 0 || !R.raid?.alive) return
  if (tier() === 8) dmg *= 0.5 // divine form
  R.hp -= dmg
  R.hurtFlash = 0.25
  R.lastHurt = 0
  play('r_hurt')
  if (R.hp <= 0) {
    R.hp = 0
    R.dead = true
    R.deadT = 6
    banner(`YOU WERE REAPED by ${by}`, 5)
    play('r_laugh', 0.9)
  }
}

function respawn() {
  R.dead = false
  R.hp = R.maxHp
  R.invuln = 3
  void movePlayerTo({ newRelativePosition: V(PORTAL.x, 0.2, PORTAL.z + 2.2), cameraTarget: V(BOSS.home.x, 8, BOSS.home.z) })
}

function weaponHit(): number {
  const t = tier()
  const w = ARMORY[t]
  const sustained = RAID.dps[t] - (t >= NUKE_TIER ? RAID.nukeDps : 0)
  const crit = Math.random() < 0.1 ? 2 : 1
  return sustained * w.cd * levelScale() * crit
}

function inRange() {
  const p = me()
  return Math.hypot(p.x - bossPos.x, p.z - bossPos.z) <= ARMORY[tier()].range + BOSS.radius
}

function attackStep(dt: number) {
  R.atkT -= dt
  if (R.nukeCd > 0) R.nukeCd -= dt
  if (R.dead || !R.raid?.alive || R.goldShopOpen) return
  const holding = inputSystem.isPressed(InputAction.IA_POINTER)
  if ((holding || R.auto) && R.atkT <= 0 && inRange()) {
    const w = ARMORY[tier()]
    R.atkT = w.cd
    const d = weaponHit()
    R.pending += d
    R.myHits++
    if (R.myHits % (w.cd < 0.2 ? 4 : 1) === 0) {
      floatDmg(d * (w.cd < 0.2 ? 4 : 1), w.color, d > sustainedAvg() * 1.5)
      const p = me()
      const a = Math.atan2(p.x - bossPos.x, p.z - bossPos.z)
      spawnFx(hitPool, 'hit', bossPos.x + Math.sin(a) * 2.2, bossPos.z + Math.cos(a) * 2.2, 0.18, 1, 1.2 + Math.random() * 4)
      play('r_hit', 0.9 + Math.random() * 0.25)
    }
  }
  if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) nuke()
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) {
    R.auto = !R.auto
    banner(R.auto ? 'AUTO ATTACK ON — stay in range' : 'AUTO ATTACK OFF', 1.5)
  }
}
const sustainedAvg = () => (RAID.dps[tier()] - (tier() >= NUKE_TIER ? RAID.nukeDps : 0)) * ARMORY[tier()].cd * levelScale()

export function nuke() {
  if (tier() < NUKE_TIER) return banner('The Doomsday Nuke is sold in the castle Armory (100,000 gold)', 3)
  if (R.nukeCd > 0) return banner(`Nuke recharging: ${Math.ceil(R.nukeCd)}s`, 1.5)
  if (!R.raid?.alive) return
  R.nukeCd = 30
  const d = RAID.burst * 0.9 * levelScale()
  R.pending += d
  spawnFx(eruptPool, 'erupt', bossPos.x, bossPos.z - 1, 1.2, fitR(bossPos.x, bossPos.z - 1, 6.5) / 1.55)
  spawnFx(shockPool, 'shock', bossPos.x, bossPos.z, 0.9, fitR(bossPos.x, bossPos.z, 9) / 2)
  play('r_slam', 0.7)
  floatDmg(d, '#FF3B2E', true)
  banner('☢ NUKE!', 1.2)
}

// ───────────────────────── your castle build: auto-skills fire at the reaper ─────────────────────────
const SKILL_CODE: SkillId[] = ['lash', 'bolt', 'orbit', 'aura', 'thunder', 'nova']
const skillCd: Partial<Record<SkillId, number>> = {}
const skillPools: Partial<Record<string, Entity[]>> = {}
let glaives: Entity[] = []
let bloom: Entity | undefined
let buildKey = ''
let rfOut: number[][] = []
type Shot = { e: Entity; x: number; z: number; tx: number; tz: number; y: number; t: number; mine: boolean; dmg: number }
const shots: Shot[] = []

function fxEnt(kind: string, tier: number) {
  const key = kind + tier
  const list = (skillPools[key] ??= [])
  let e = list.find((x) => Transform.get(x).position.y < -20)
  if (!e) {
    if (list.length >= 6) return undefined
    e = ent(`models/fx_${kind}${TIER_SUFFIX[tier]}.glb`)
    list.push(e)
  }
  return e
}
function release(e: Entity, after: number, grow?: { from: number; to: number }) {
  if (grow) Tween.createOrReplace(e, { mode: Tween.Mode.Scale({ start: V(grow.from, 1, grow.from), end: V(grow.to, 1, grow.to) }), duration: after * 1000, easingFunction: EasingFunction.EF_EASEOUTQUAD })
  pending.push({
    at: serverNow() / 1000 + after,
    fn: () => {
      Tween.deleteFrom(e)
      Transform.getMutable(e).position = HIDE
    },
    always: true
  })
}

function setupBuild() {
  const b = R.build
  const key = b ? JSON.stringify(b) : ''
  if (key === buildKey) return
  buildKey = key
  for (const g of glaives) engine.removeEntity(g)
  glaives = []
  if (bloom) engine.removeEntity(bloom)
  bloom = undefined
  if (!b) return
  const has = (id: SkillId) => b.weapons.some((w) => w[0] === id)
  if (has('orbit')) {
    const n = 2 + Math.min(3, Math.floor((b.weapons.find((w) => w[0] === 'orbit')?.[1] ?? 1) / 3))
    for (let i = 0; i < n; i++) glaives.push(ent(`models/fx_glaive${TIER_SUFFIX[skillTier(b, 'orbit')]}.glb`))
  }
  if (has('aura')) bloom = ent(`models/fx_bloom${TIER_SUFFIX[skillTier(b, 'aura')]}.glb`)
}

/** a skill visual — mine, or another hunter's (tx/tz = point on the reaper) */
function drawSkill(id: SkillId, tier: number, x: number, z: number, tx: number, tz: number, mine: boolean, dmg = 0) {
  const k = SKILLS[id].fx
  const yaw = (Math.atan2(tx - x, tz - z) * 180) / Math.PI
  if (id === 'lash') {
    const e = fxEnt(k, tier)
    if (!e) return
    const t = Transform.getMutable(e)
    t.position = V((x + tx) / 2, 1.2, (z + tz) / 2)
    t.rotation = yawQ(yaw)
    t.scale = V(2.6, 2.6, 2.6)
    release(e, 0.3)
  } else if (id === 'bolt') {
    const e = fxEnt(k, tier)
    if (!e) return
    Transform.getMutable(e).position = V(x, 1.4, z)
    Transform.getMutable(e).scale = V(1.4, 1.4, 1.4)
    shots.push({ e, x, z, tx, tz, y: 1.4, t: 0, mine, dmg })
  } else if (id === 'thunder') {
    const e = fxEnt(k, tier)
    if (!e) return
    const t = Transform.getMutable(e)
    t.position = V(tx, 0.05, tz)
    t.scale = V(1.8, 1.8, 1.8)
    release(e, 0.5)
  } else if (id === 'nova') {
    const e = fxEnt(k, tier)
    if (!e) return
    const r = fitR(x, z, SKILLS.nova.range)
    Transform.getMutable(e).position = V(x, 0.06, z)
    release(e, 0.45, { from: 0.4, to: r })
  }
}

function skillStep(dt: number) {
  const b = R.build
  const p = me()
  // persistent visuals: glaives circle you, the bloom blooms under you
  const T = serverNow() / 1000
  glaives.forEach((g, i) => {
    const a = T * 2.6 + (i / glaives.length) * Math.PI * 2
    const t = Transform.getMutable(g)
    t.position = V(p.x + Math.cos(a) * 1.6, 1.0, p.z + Math.sin(a) * 1.6)
    t.rotation = yawQ(((a * 180) / Math.PI) * 4)
  })
  if (bloom && b) {
    const r = SKILLS.aura.range * (1 + 0.05 * (b.passives.find((x) => x[0] === 'expanse')?.[1] ?? 0))
    const t = Transform.getMutable(bloom)
    t.position = V(p.x, 0.05, p.z)
    t.scale = V(r * 2 * 0.5, 1, r * 2 * 0.5)
  }
  // shard projectiles (mine and others')
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]
    s.t += dt
    const dx = s.tx - s.x
    const dz = s.tz - s.z
    const d = Math.hypot(dx, dz)
    const step = 24 * dt
    if (d <= step || s.t > 1.5) {
      Transform.getMutable(s.e).position = HIDE
      if (s.mine) spawnFx(hitPool, 'hit', s.tx, s.tz, 0.15, 1, 2 + Math.random() * 3)
      shots.splice(i, 1)
      continue
    }
    s.x += (dx / d) * step
    s.z += (dz / d) * step
    s.y += (3.5 - s.y) * dt * 2
    const t = Transform.getMutable(s.e)
    t.position = V(s.x, s.y, s.z)
    t.rotation = yawQ((Math.atan2(dx, dz) * 180) / Math.PI)
  }
  if (!b || R.dead || !R.raid?.alive || !shown) return
  const dist = Math.hypot(p.x - bossPos.x, p.z - bossPos.z) - BOSS.radius
  for (const [id] of b.weapons) {
    skillCd[id] = (skillCd[id] ?? Math.random() * SKILLS[id].cd) - dt
    if ((skillCd[id] as number) > 0 || dist > SKILLS[id].range) continue
    skillCd[id] = SKILLS[id].cd
    const dmg = skillDps(b, id) * SKILLS[id].cd
    R.pending += dmg
    const a = Math.atan2(p.x - bossPos.x, p.z - bossPos.z) + (Math.random() - 0.5) * 0.9
    const tx = bossPos.x + Math.sin(a) * BOSS.radius
    const tz = bossPos.z + Math.cos(a) * BOSS.radius
    const tier = skillTier(b, id)
    if (id !== 'orbit' && id !== 'aura') drawSkill(id, tier, p.x, p.z, tx, tz, true, dmg)
    if (Math.random() < 0.5) floatDmg(dmg, SKILLS[id].color)
    if (rfOut.length < 8) rfOut.push([SKILL_CODE.indexOf(id), tier, Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(tx * 10) / 10, Math.round(tz * 10) / 10])
  }
}

// ───────────────────────── server sync ─────────────────────────
let flushT = 0
let pollT = 0
let busy = false
let lastAlive: boolean | null = null

function applyRaid(r: RaidState, inv?: Inventory) {
  R.offset = r.now - Date.now()
  if (inv) {
    R.inv = inv
    if ((inv as any).build) R.build = (inv as any).build
  }
  if (lastAlive === true && !r.alive) bossDies(r.killer)
  if (lastAlive === null && !r.alive) hideBoss(true)
  if (lastAlive === false && r.alive) hideBoss(false)
  lastAlive = r.alive
  R.raid = r
  if (r.myLoot && R.lootSeen !== r.day) {
    R.lootSeen = r.day
    R.loot = r.myLoot
    play('r_loot')
    void reloadProfile()
  }
}

function bossDies(killer: string | null) {
  playAnim('Death')
  play('r_death')
  banner(`THE PALE SOVEREIGN HAS FALLEN${killer ? ` — final blow: ${killer}` : ''}`, 7)
  musicLevel(0.25)
}
function hideBoss(hide: boolean) {
  shown = !hide
  Transform.getMutable(bossModel).scale = hide ? V(0, 0, 0) : V(1, 1, 1)
  LightSource.getMutable(bossLight).active = !hide
  if (!hide) {
    playAnim('Idle')
    musicLevel(0.55)
  }
}

async function reloadProfile() {
  try {
    const { profile, inv } = await loadProfile(R.name)
    R.profile = profile
    R.inv = inv
    R.build = (inv as any).build ?? null
    setupBuild()
    R.firstPurchase = !!profile.firstPurchase
    R.online = true
    R.status = profile.guest ? 'guest — log in with a wallet to fight and loot' : 'progress shared with the castle'
    recomputeMaxHp()
    attachMine()
    return true
  } catch (e: any) {
    R.online = false
    R.status = `waking the save server… (${String(e?.message ?? e).slice(0, 40)})`
    return false
  }
}

async function syncTick(dt: number) {
  flushT += dt
  pollT += dt
  if (busy) return
  if (!R.online) {
    if (pollT > 5) {
      pollT = 0
      busy = true
      void pingServer()
      await reloadProfile()
      busy = false
    }
    return
  }
  if (R.pending > 0 && flushT >= 1) {
    flushT = 0
    busy = true
    const d = Math.floor(R.pending)
    R.pending = 0
    try {
      const res = await raidHit(d, R.name)
      applyRaid(res.raid, res.inv)
      bus.emit('rh', { n: R.name, d: res.accepted, c: ARMORY[tier()].color })
      if (res.killed) banner('YOU LANDED THE FINAL BLOW!', 6)
    } catch (e: any) {
      if (/guest/i.test(String(e?.message))) banner('Log in with a wallet to damage the reaper', 3)
    }
    busy = false
  } else if (pollT >= 2.5) {
    pollT = 0
    busy = true
    try {
      const res = await raidState(R.name)
      applyRaid(res.raid, res.inv)
    } catch {}
    busy = false
  }
}

// ───────────────────────── co-op presence: damage feed + cosmetics on everyone ─────────────────────────
const bus = new MessageBus()
const others = new Map<string, { cos: string | null; e?: Entity }>()

function attachTo(avatarId: string | undefined, id: string | null, prev?: Entity) {
  if (prev) engine.removeEntity(prev)
  const c = cosmetic(id)
  if (!c || !c.model) return undefined
  const e = engine.addEntity()
  const anchor = { head: AvatarAnchorPointType.AAPT_NAME_TAG, over: AvatarAnchorPointType.AAPT_NAME_TAG, hand_l: AvatarAnchorPointType.AAPT_LEFT_HAND, hand_r: AvatarAnchorPointType.AAPT_RIGHT_HAND, feet: AvatarAnchorPointType.AAPT_POSITION }[c.anchor ?? 'over']
  AvatarAttach.create(e, avatarId ? { avatarId, anchorPointId: anchor } : { anchorPointId: anchor })
  const holder = engine.addEntity()
  Transform.create(holder, { parent: e, position: c.anchor === 'head' ? V(0, -0.35, 0) : c.anchor === 'over' ? V(0, 0.45, 0) : c.anchor === 'feet' ? V(0, -0.9, 0) : V(0, 0, 0) })
  GltfContainer.create(holder, { src: c.model })
  if (c.anchor === 'over') Tween.setRotateContinuous(holder, Quaternion.fromEulerDegrees(0, 1, 0), 40)
  return e
}
let myCosEnt: Entity | undefined
let myCos: string | null = null
function attachMine() {
  if (R.inv.cosmetic === myCos) return
  myCos = R.inv.cosmetic
  myCosEnt = attachTo(undefined, myCos, myCosEnt)
}

export async function equip(id: string | null) {
  R.cosMsg = 'saving…'
  try {
    R.inv = await equipCosmetic(id)
    attachMine()
    R.cosMsg = id ? `✓ equipped ${cosmetic(id)?.name}` : '✓ unequipped'
  } catch (e: any) {
    R.cosMsg = String(e?.message ?? e)
  }
}

// ───────────────────────── treasury (identical to the castle) ─────────────────────────
export function openGoldShop() {
  R.goldShopOpen = true
  R.payMsg = ''
  shopConfig()
    .then((c) => (R.goldShop = c))
    .catch(() => (R.goldShop.enabled = false))
}
function decToHex(dec: string) {
  let digits = dec.replace(/^0+/, '').split('').map(Number)
  if (!digits.length) return '0'
  let hex = ''
  while (digits.length) {
    let rem = 0
    const next: number[] = []
    for (const d of digits) {
      const cur = rem * 10 + d
      const q = Math.floor(cur / 16)
      rem = cur % 16
      if (next.length || q) next.push(q)
    }
    hex = rem.toString(16) + hex
    digits = next
  }
  return hex
}
const pad64 = (h: string) => h.replace(/^0x/, '').toLowerCase().padStart(64, '0')
const wait = (s: number) =>
  new Promise<void>((done) => {
    let t = 0
    const sys = (dt: number) => {
      t += dt
      if (t >= s) {
        engine.removeSystem(sys)
        done()
      }
    }
    engine.addSystem(sys)
  })

export async function buyGold(currency: 'ETH' | 'MANA') {
  if (R.payBusy) return
  if (!R.online) return void (R.payMsg = 'Save server offline — try again in a moment')
  R.payBusy = true
  try {
    const pl = getPlayer()
    let from = pl && !pl.isGuest && /^0x[0-9a-fA-F]{40}$/.test(pl.userId) ? pl.userId : ''
    if (!from) {
      try {
        from = (await getUserAccount({})).address ?? ''
      } catch {}
    }
    if (!from) throw new Error(pl?.isGuest ? 'you are logged in as a guest — log in with a wallet to buy gold' : 'could not read your wallet address')
    R.payMsg = 'Getting a price quote…'
    const q = await shopQuote(currency, R.name, GOLD_PACKS[R.packSel].id)
    const amountHex = '0x' + decToHex(q.amountWei)
    const tx = currency === 'ETH' ? { from, to: q.to, value: amountHex } : { from, to: MANA_TOKEN, value: '0x0', data: '0xa9059cbb' + pad64(q.to) + pad64(amountHex) }
    R.payMsg = `Confirm ${q.amount} ${currency} in your wallet…`
    const pick = (raw: string) => /0x[0-9a-fA-F]{64}/.exec(raw ?? '')?.[0] ?? ''
    let hash = ''
    let why = ''
    try {
      const res = await sendAsync({ id: Date.now() % 1e9, method: 'eth_sendTransaction', jsonParams: JSON.stringify([tx]) })
      hash = pick(res.jsonAnyResponse)
      if (!hash) why = res.jsonAnyResponse
    } catch (e: any) {
      why = String(e?.message ?? e)
    }
    if (!hash) {
      try {
        const res = await requirePayment({ toAddress: q.to, amount: q.amount, currency })
        hash = pick(res.jsonAnyResponse)
        if (!hash) why = res.jsonAnyResponse || why
      } catch (e: any) {
        why = String(e?.message ?? e) || why
      }
    }
    if (!hash && /denied|reject|cancel/i.test(why)) throw new Error('payment cancelled in the wallet')
    if (!hash && why) throw new Error(why.slice(0, 120))
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('no transaction was sent')
    R.payMsg = 'Payment sent — waiting for the blockchain (usually under a minute)…'
    for (let i = 0; i < 90; i++) {
      const r = await shopConfirm(q.id, hash)
      if (r.ok) {
        if (r.profile) R.profile = r.profile
        R.firstPurchase = false
        R.payMsg = `✓ +${(r.gold ?? q.gold).toLocaleString()} gold added. Thank you!`
        play('r_loot')
        banner(`+${(r.gold ?? q.gold).toLocaleString()} GOLD!`, 4)
        return
      }
      await wait(10)
    }
    R.payMsg = 'Still not confirmed — your gold will be added automatically next time you visit.'
  } catch (e: any) {
    R.payMsg = `Payment not completed: ${String(e?.message ?? e)}`
  } finally {
    R.payBusy = false
  }
}

// ───────────────────────── main loop ─────────────────────────
export function setupGame() {
  setupBoss()
  const pl = getPlayer()
  R.name = pl?.name || 'Hunter'
  void pingServer()
  void reloadProfile().then(async (ok) => {
    if (!ok) return
    try {
      const res = await raidState(R.name)
      applyRaid(res.raid, res.inv)
    } catch {}
    if (tier() < 7 && bestLevel() < 200) banner('⚠ He crushes the weak. Recommended: Lv 200 or Zeus’ Thunder (200,000 gold)', 7)
    else banner('THE PALE SOVEREIGN AWAITS — hold LEFT CLICK or press E', 5)
  })

  bus.on('rh', (m: { n: string; d: number; c: string }) => {
    if (!m || m.n === R.name || !(m.d > 0)) return
    R.party.unshift({ n: m.n, d: m.d, c: m.c, t: 0 })
    R.party = R.party.slice(0, 5)
    floatDmg(m.d, m.c)
  })
  bus.on('rf', (m: { id: string; e: number[][] }) => {
    if (!m || m.id === pl?.userId || !Array.isArray(m.e)) return
    for (const [c, t, x, z, tx, tz] of m.e.slice(0, 8)) {
      const id = SKILL_CODE[c]
      if (id && id !== 'orbit' && id !== 'aura') drawSkill(id, Math.max(0, Math.min(3, t | 0)), x, z, tx, tz, false)
    }
  })
  bus.on('rc', (m: { id: string; cos: string | null }) => {
    if (!m || m.id === pl?.userId) return
    const o = others.get(m.id) ?? { cos: null }
    if (o.cos !== m.cos) {
      o.e = attachTo(m.id, m.cos, o.e)
      o.cos = m.cos
    }
    others.set(m.id, o)
  })

  let presenceT = 0
  let godSet = false
  let rfT = 0
  let slowSet = false
  engine.addSystem((dt) => {
    const T = serverNow() / 1000
    if (R.bannerT > 0) R.bannerT -= dt
    if (R.hurtFlash > 0) R.hurtFlash -= dt
    if (R.invuln > 0) R.invuln -= dt
    for (const p of R.party) p.t += dt
    R.party = R.party.filter((p) => p.t < 6)
    animT += dt
    if (anim !== 'Idle' && anim !== 'Death' && animT > 1.6) playAnim('Idle')

    schedule(T)
    for (let i = pending.length - 1; i >= 0; i--)
      if (pending[i].at <= T) {
        const p = pending[i]
        pending.splice(i, 1)
        if (R.raid?.alive || p.always) p.fn()
      }
    // the reaper turns to face you
    if (shown && R.raid?.alive) {
      const p = me()
      bossYaw = bossYaw + ((((faceYaw(p.x, p.z) - bossYaw) % 360) + 540) % 360 - 180) * Math.min(1, dt * 2.5)
      Transform.getMutable(bossModel).rotation = yawQ(bossYaw)
    }
    const r = R.raid
    TextShape.getMutable(bossTag).text = r ? (r.alive ? `${BOSS.name}\n<size=70%>${Math.ceil((r.hp / r.maxHp) * 100)}%</size>` : 'HE RISES AGAIN AT MIDNIGHT (KST)') : ''

    // effects
    const q = me()
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i]
      f.life -= dt
      const k = 1 - Math.max(0, f.life) / f.max
      const t = Transform.getMutable(f.e)
      if (f.kind === 'warn') t.scale = V(f.r * (0.2 + 0.8 * Math.min(1, k * 1.4)), 1, f.r * (0.2 + 0.8 * Math.min(1, k * 1.4)))
      else if (f.kind === 'shock') t.scale = V(f.r * (0.3 + 1.7 * k), 1 + (1 - k) * 2, f.r * (0.3 + 1.7 * k))
      else if (f.kind === 'erupt' || f.kind === 'burst') t.scale = V(f.r * (1 - k * 0.4), Math.sin(Math.min(1, k * 1.6) * Math.PI) * (f.kind === 'burst' ? 0.5 : 1.1) + 0.05, f.r * (1 - k * 0.4))
      else if (f.kind === 'dome') t.scale = V(f.r * Math.min(1, k * 3), f.r * Math.min(1, k * 3), f.r * Math.min(1, k * 3))
      else if (f.kind === 'sweep') t.scale = V(f.r, 1 + k * 2, f.r)
      else if (f.kind === 'hit') t.scale = V(1 + k * 2, 1 + k * 2, 1 + k * 2)
      else if (f.kind === 'dmg') t.position = V(f.x, (f.y ?? 5) + k * 1.6, f.z)
      else if (f.kind === 'bolt') {
        f.x += (f.vx ?? 0) * dt
        f.z += (f.vz ?? 0) * dt
        f.y = Math.max(1.1, (f.y ?? 9.5) - dt * 7)
        t.position = V(f.x, f.y, f.z)
        t.rotation = yawQ((Math.atan2(f.vx ?? 0, f.vz ?? 1) * 180) / Math.PI)
        if (Math.hypot(q.x - f.x, q.z - f.z) < 1.0 && f.y < 2.6) {
          hurt(DMG.bolt * (1 + R.phase * 0.25), 'a soul bolt')
          f.life = 0
        }
        if (f.x < 0.5 || f.x > 15.5 || f.z < 0.5 || f.z > 15.5) f.life = 0
      }
      if (f.life <= 0) {
        f.pool.give(f.e)
        fxs.splice(i, 1)
      }
    }

    // player
    if (R.dead) {
      R.deadT -= dt
      if (R.deadT <= 0) respawn()
    } else {
      R.lastHurt += dt
      if (R.lastHurt > 4 && R.hp < R.maxHp) R.hp = Math.min(R.maxHp, R.hp + R.maxHp * 0.03 * dt)
    }
    if (R.slowT > 0) {
      R.slowT -= dt
      if (!slowSet) AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, { walkSpeed: 0.6, jogSpeed: 1.4, runSpeed: 2.0, jumpHeight: 0.4 })
      slowSet = true
      godSet = false
      if (R.slowT <= 0) {
        AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
        slowSet = false
      }
    } else if (tier() === 8 && !godSet) {
      godSet = true
      AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, { walkSpeed: 1.5, jogSpeed: 10, runSpeed: 14, jumpHeight: 5, runJumpHeight: 6, doubleJumpHeight: 5, glidingSpeed: 9, glidingFallingSpeed: 1.2 })
    }
    attackStep(dt)
    skillStep(dt)
    rfT += dt
    if (rfT > 0.25 && rfOut.length) {
      rfT = 0
      bus.emit('rf', { id: pl?.userId ?? '', e: rfOut.splice(0, 8) })
      rfOut = []
    }
    void syncTick(dt)

    // cosmetics presence ~every 4 s
    presenceT += dt
    if (presenceT > 4) {
      presenceT = 0
      bus.emit('rc', { id: pl?.userId ?? 'local', cos: R.inv.cosmetic })
      for (const [id] of others) {
        let seen = false
        for (const [, ident] of engine.getEntitiesWith(PlayerIdentityData)) if (ident.address === id) seen = true
        if (!seen) {
          const o = others.get(id)
          if (o?.e) engine.removeEntity(o.e)
          others.delete(id)
        }
      }
    }
  })
}

export const cosmeticsOwned = () => COSMETICS.filter((c) => (R.inv.items[c.id] ?? 0) > 0)

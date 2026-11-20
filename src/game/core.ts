// WOW NIGHTSWARM — pure game simulation (no Decentraland imports, runs headless for balance tests).
import LAYOUT from '../../layout.json'
import {
  WeaponId, PassiveId, EnemyKind, WEAPONS, PASSIVES, ENEMIES, MAX_WEAPON_LVL, MAX_PASSIVE_LVL,
  MAX_WEAPONS, MAX_PASSIVES, waveMix, xpNeed, ARMORY, NUKE, NUKE_TIER, GOD_TIER, isHoldable, manualLevelScale, bossFor, BossDef,
  BOOSTS, BoostId
} from './defs'

export type Rect = { x0: number; z0: number; x1: number; z1: number }
export const ARENA: Rect[] = LAYOUT.arena

export const TUNING = {
  maxEnemies: 140,
  pvpScale: 0.35, // weapon damage dealt to other players is scaled down
  pvpHitInterval: 0.4,
  baseMagnet: 2.4,
  baseHp: 120,
  eliteEvery: 60,
  bossEvery: 300,
  ringEvery: 90
}

export type Enemy = {
  id: number
  kind: EnemyKind
  x: number
  z: number
  hp: number
  maxHp: number
  speed: number
  dmg: number
  r: number
  xp: number
  alive: boolean
  wob: number
  kx: number
  kz: number
  lastHit: Record<string, number>
  sc: number // visual scale multiplier
  boss?: number // index into the boss ladder
  slamCd?: number
  wind?: number // slam wind-up timer
  slow?: number // seconds of chill left (Frost Comet)
  frozen?: number // seconds fully frozen (Glacier Cataclysm)
}
export type PickKind = 'gem' | 'coin' | 'chest' | 'heal'
export type Pickup = { id: number; kind: PickKind; x: number; z: number; value: number; alive: boolean; flying: boolean; big?: boolean; born: number }
export type Proj = { id: number; x: number; z: number; vx: number; vz: number; dmg: number; pierce: number; life: number; hit: number[] }
export type Remote = { id: string; x: number; z: number; attackable: boolean }

export type Ev =
  | { t: 'hit'; id: number; x: number; z: number; dmg: number; crit?: boolean }
  | { t: 'kill'; kind: EnemyKind; x: number; z: number }
  | { t: 'gem' }
  | { t: 'coin' }
  | { t: 'chest'; big: boolean }
  | { t: 'heal' }
  | { t: 'levelup' }
  | { t: 'hurt'; dmg: number }
  | { t: 'dead'; killer?: string }
  | { t: 'boss' }
  | { t: 'elite' }
  | { t: 'ring' }
  | { t: 'pvpHit'; to: string; dmg: number }
  | { t: 'slash'; x: number; z: number; yaw: number; w: number; l: number }
  | { t: 'nova'; x: number; z: number; r: number }
  | { t: 'strike'; x: number; z: number; r: number }
  | { t: 'shoot' }
  | { t: 'swing'; x: number; z: number; yaw: number; range: number; arc: number; tier: number }
  | { t: 'quake'; x: number; z: number; r: number }
  | { t: 'tracer'; x: number; z: number; yaw: number; len: number }
  | { t: 'zeus'; pts: [number, number][] }
  | { t: 'divine'; x: number; z: number; r: number }
  | { t: 'nukeLaunch'; x: number; z: number; tx: number; tz: number; delay: number }
  | { t: 'nuke'; x: number; z: number; r: number }
  | { t: 'bossSpawn'; boss: number }
  | { t: 'bossDown'; boss: number }
  | { t: 'slamWarn'; x: number; z: number; r: number; dur: number }
  | { t: 'slam'; x: number; z: number; r: number }
  | { t: 'comet'; x: number; z: number; r: number }
  | { t: 'frostHit'; x: number; z: number; r: number }
  | { t: 'arc'; pts: [number, number][] }
  | { t: 'chakram'; x: number; z: number; yaw: number; d: number; dur: number }
  | { t: 'mine'; id: number; x: number; z: number }
  | { t: 'boom'; id: number; x: number; z: number; r: number }
  | { t: 'sweep'; x: number; z: number; yaw: number; len: number; dur: number; n: number }
  | { t: 'dash'; x0: number; z0: number; x1: number; z1: number }

export type Option =
  | { kind: 'weapon'; id: WeaponId; to: number }
  | { kind: 'passive'; id: PassiveId; to: number }
  | { kind: 'evolve'; id: WeaponId }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'boost'; id: BoostId }

let rand = Math.random
export function setRandom(fn: () => number) {
  rand = fn
}

export type RunSnap = {
  v: number; time: number; level: number; xp: number; kills: number; gold: number; hp: number; maxHp: number
  pendingLevels: number; rerolls: number; pvpKills: number
  weapons: [WeaponId, number][]; passives: [PassiveId, number][]; evolved: WeaponId[]
  bossIndex: number; bossQueue: number; bossesSlain: number; boostDmg: number; boostArea: number; boostRegen: number
  nextElite: number; nextRing: number
}

export class Run {
  // player
  x = 0
  z = 0
  yaw = 0
  hp = TUNING.baseHp
  maxHp = TUNING.baseHp
  level = 1
  xp = 0
  kills = 0
  gold = 0
  time = 0
  alive = true
  pendingLevels = 0
  rerolls = 2
  invuln = 0
  hurtCd = 0
  weapons = new Map<WeaponId, number>()
  passives = new Map<PassiveId, number>()
  evolved = new Set<WeaponId>()
  cd: Record<string, number> = {}
  orbitAngle = 0
  meta = { might: 0, hp: 0, magnet: 0, xp: 0 }
  lastAttacker = ''
  pvpKills = 0
  // armory (manual attacks)
  armory = 0 // highest tier owned
  equip = 0 // tier in hand
  manualCd = 0
  nukeCd = 0
  pendingNuke: { x: number; z: number; t: number } | null = null
  // boss ladder
  bossIndex = 0 // next boss to come
  bossQueue = 0 // bosses earned but not yet spawned
  bossId = 0 // enemy id of the boss on the field (0 = none)
  bossesSlain = 0
  // endless boosts
  boostDmg = 0
  boostArea = 0
  boostRegen = 0

  // new auto-skills
  comets: { x: number; z: number; r: number; dmg: number; t: number; chill: number; freeze: number }[] = []
  chakrams: { ox: number; oz: number; fx: number; fz: number; d: number; t: number; dur: number; dmg: number; out: number[]; back: number[]; pv: number }[] = []
  mines: { id: number; x: number; z: number; arm: number; life: number; dmg: number; r: number }[] = []
  sweeps: { t: number; dur: number; yaw: number; len: number; n: number; dmg: number; hit: Set<number>; pv: Set<string> }[] = []
  wisps: { x: number; z: number; cd: number; ph: number; dash: number; tx: number; tz: number }[] = []

  enemies: Enemy[] = []
  pickups: Pickup[] = []
  projs: Proj[] = []
  private nextId = 1
  private spawnAcc = 0
  nextElite = TUNING.eliteEvery
  nextRing = TUNING.ringEvery
  private pvpAcc = new Map<string, number>()
  private pvpLast = new Map<string, number>()
  events: Ev[] = []

  constructor(start: WeaponId, meta?: { might: number; hp: number; magnet: number; xp: number }, armory = 0, equip?: number) {
    this.weapons.set(start, 1)
    if (meta) this.meta = meta
    this.armory = Math.max(0, Math.min(ARMORY.length - 1, armory))
    let eq = Math.min(equip ?? this.armory, this.armory)
    if (!isHoldable(eq)) eq--
    this.equip = Math.max(0, eq)
    this.maxHp = this.hp = TUNING.baseHp + this.meta.hp * 10
  }

  /** everything needed to resume this run later (enemies respawn; an alive boss comes back at full hp) */
  snapshot(): RunSnap {
    const boss = this.boss
    return {
      v: 1,
      time: Math.floor(this.time), level: this.level, xp: Math.floor(this.xp), kills: this.kills, gold: Math.floor(this.gold),
      hp: Math.ceil(this.hp), maxHp: this.maxHp, pendingLevels: this.pendingLevels, rerolls: this.rerolls, pvpKills: this.pvpKills,
      weapons: [...this.weapons.entries()], passives: [...this.passives.entries()], evolved: [...this.evolved],
      bossIndex: boss ? this.bossIndex - 1 : this.bossIndex, bossQueue: this.bossQueue + (boss ? 1 : 0), bossesSlain: this.bossesSlain,
      boostDmg: this.boostDmg, boostArea: this.boostArea, boostRegen: this.boostRegen,
      nextElite: this.nextElite, nextRing: this.nextRing
    }
  }

  static restore(s: RunSnap, meta: { might: number; hp: number; magnet: number; xp: number }, armory: number, equip: number) {
    const first = (s.weapons[0]?.[0] ?? 'lash') as WeaponId
    const r = new Run(first, meta, armory, equip)
    r.weapons = new Map(s.weapons)
    r.passives = new Map(s.passives)
    r.evolved = new Set(s.evolved)
    r.time = s.time
    r.level = s.level
    r.xp = s.xp
    r.kills = s.kills
    r.gold = s.gold
    r.maxHp = Math.max(r.maxHp, s.maxHp)
    r.hp = Math.max(1, Math.min(r.maxHp, s.hp))
    r.pendingLevels = s.pendingLevels
    r.rerolls = s.rerolls
    r.pvpKills = s.pvpKills
    r.bossIndex = s.bossIndex
    r.bossQueue = s.bossQueue
    r.bossesSlain = s.bossesSlain
    r.boostDmg = s.boostDmg
    r.boostArea = s.boostArea
    r.boostRegen = s.boostRegen
    r.nextElite = s.nextElite
    r.nextRing = s.nextRing
    r.invuln = 3
    return r
  }

  // ───────── derived stats ─────────
  p(id: PassiveId) {
    return this.passives.get(id) ?? 0
  }
  get might() {
    return 1 + 0.12 * this.p('might') + 0.05 * this.meta.might + this.boostDmg
  }
  get cdMul() {
    return Math.max(0.4, 1 - 0.07 * this.p('haste'))
  }
  get area() {
    return 1 + 0.1 * this.p('expanse') + this.boostArea
  }
  get amount() {
    return Math.floor((this.p('duplicator') + 1) / 2)
  }
  get armor() {
    return this.p('plating')
  }
  get regen() {
    return 0.25 + 0.4 * this.p('bloodstone') + this.boostRegen
  }
  get magnet() {
    return TUNING.baseMagnet * (1 + 0.35 * this.p('magnet') + 0.1 * this.meta.magnet)
  }
  get speedMul() {
    return 1 + 0.08 * this.p('swiftness')
  }
  get xpMul() {
    return 1 + 0.05 * this.meta.xp
  }
  get goldMul() {
    return 1 + 0.2 * this.p('fortune')
  }
  get need() {
    return xpNeed(this.level)
  }
  w(id: WeaponId) {
    return this.weapons.get(id) ?? 0
  }
  evo(id: WeaponId) {
    return this.evolved.has(id)
  }

  // ───────── main step ─────────
  step(dt: number, frozen: boolean, remotes: Remote[] = []): Ev[] {
    this.events = []
    if (!this.alive) return this.events
    if (this.invuln > 0) this.invuln -= dt
    if (frozen) return this.events
    this.time += dt
    if (this.hurtCd > 0) this.hurtCd -= dt
    this.hp = Math.min(this.maxHp, this.hp + this.regen * dt)
    this.spawn(dt)
    this.moveEnemies(dt)
    this.fire(dt, remotes)
    this.moveProjs(dt, remotes)
    this.collect(dt)
    this.bossStep(dt)
    this.manualStep(dt)
    this.flushPvp(dt)
    return this.events
  }

  // ───────── spawning ─────────
  private spawn(dt: number) {
    const t = this.time
    // ramps to 12/s by ~5 min, then keeps creeping up to 17/s for the deep game
    const rate = Math.min(12, 0.7 + t / 25) + Math.min(5, Math.max(0, t - 600) / 300)
    this.spawnAcc += rate * dt
    let alive = this.enemies.filter((e) => e.alive).length
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1
      if (alive >= TUNING.maxEnemies) continue
      alive++
      this.spawnEnemy(pick(waveMix(t)))
    }
    if (t >= this.nextElite) {
      this.nextElite += TUNING.eliteEvery
      this.spawnEnemy('elite')
      this.events.push({ t: 'elite' })
    }
    if (this.bossQueue > 0 && !this.bossId) this.spawnBoss()
    if (t >= this.nextRing) {
      this.nextRing += TUNING.ringEvery
      const n = 26
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        const c = clampArena(this.x + Math.sin(a) * 9, this.z + Math.cos(a) * 9, 0.8)
        this.spawnEnemy('bat', c.x, c.z)
      }
      this.events.push({ t: 'ring' })
    }
  }

  spawnEnemy(kind: EnemyKind, x?: number, z?: number) {
    const d = ENEMIES[kind]
    if (x === undefined || z === undefined) {
      let ok = false
      for (let tries = 0; tries < 12 && !ok; tries++) {
        const a = rand() * Math.PI * 2
        const r = 11 + rand() * 4
        x = this.x + Math.sin(a) * r
        z = this.z + Math.cos(a) * r
        ok = inArena(x, z, 0.8)
      }
      if (!ok) {
        const c = clampArena(x!, z!, 0.8)
        x = c.x
        z = c.z
      }
    }
    const scale = 1 + this.time / 150
    const hp = d.hp * scale
    const e: Enemy = {
      id: this.nextId++, kind, x: x!, z: z!, hp, maxHp: hp,
      speed: d.speed * (1 + Math.min(0.25, this.time / 1200)), dmg: d.dmg * (1 + this.time / 400),
      r: d.r, xp: d.xp, alive: true, wob: rand() * 6.28, kx: 0, kz: 0, lastHit: {},
      sc: 1 + Math.min(0.5, this.time / 2400)
    }
    const slot = this.enemies.findIndex((q) => !q.alive)
    if (slot >= 0) this.enemies[slot] = e
    else this.enemies.push(e)
    return e
  }

  private moveEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = this.x - e.x
      const dz = this.z - e.z
      const dist = Math.hypot(dx, dz) || 0.001
      e.wob += dt * 1.7
      const side = Math.sin(e.wob) * 0.35
      const ux = dx / dist
      const uz = dz / dist
      const mx = ux - uz * side
      const mz = uz + ux * side
      const ml = Math.hypot(mx, mz) || 1
      // stop at touching distance so the horde forms a ring around the player instead of stacking on top
      const reach = e.r + 0.45
      let chill = 1
      if (e.frozen && e.frozen > 0) {
        e.frozen -= dt
        chill = e.boss !== undefined ? 0.5 : 0
      } else if (e.slow && e.slow > 0) {
        e.slow -= dt
        chill = e.boss !== undefined ? 0.75 : 0.45
      }
      const stepLen = Math.min(e.speed * chill * dt, Math.max(0, dist - reach))
      e.x += (mx / ml) * stepLen + e.kx * dt
      e.z += (mz / ml) * stepLen + e.kz * dt
      if (e.boss !== undefined) {
        e.kx = 0
        e.kz = 0
      }
      e.kx *= Math.max(0, 1 - dt * 6)
      e.kz *= Math.max(0, 1 - dt * 6)
      const c = clampArena(e.x, e.z, 0.5)
      e.x = c.x
      e.z = c.z
      // contact damage: one hit at a time with short i-frames (like the genre)
      if (dist < e.r + 0.55 && this.invuln <= 0 && this.hurtCd <= 0) {
        const dmg = e.dmg * Math.max(0.25, 1 - this.armor * 0.08) * (this.god ? 0.5 : 1)
        this.hp -= dmg
        this.lastAttacker = ''
        this.hurtCd = 0.6
        this.events.push({ t: 'hurt', dmg })
      }
    }
    if (this.hp <= 0) this.die('')
  }

  die(killer: string) {
    if (!this.alive) return
    this.alive = false
    this.hp = 0
    this.events.push({ t: 'dead', killer: killer || undefined })
  }

  /** damage from another player (PvP) */
  receivePvp(dmg: number, from: string) {
    if (!this.alive || this.invuln > 0) return
    this.hp -= dmg * Math.max(0.3, 1 - this.armor * 0.06)
    this.lastAttacker = from
    if (this.hurtCd <= 0) {
      this.hurtCd = 0.3
      this.events.push({ t: 'hurt', dmg })
    }
    if (this.hp <= 0) this.die(from)
  }

  // ───────── damage ─────────
  private hitEnemy(e: Enemy, dmg: number, kx = 0, kz = 0) {
    if (!e.alive) return
    const crit = rand() < 0.05 + 0.02 * this.p('fortune')
    let d = dmg * this.might * (crit ? 2 : 1)
    if (this.god) d = Math.max(d, e.hp + 1)
    e.hp -= d
    e.kx += kx
    e.kz += kz
    this.events.push({ t: 'hit', id: e.id, x: e.x, z: e.z, dmg: d, crit })
    if (this.evo('lash') && this.lashHealBudget > 0) {
      this.hp = Math.min(this.maxHp, this.hp + 1)
      this.lashHealBudget -= 1
    }
    if (e.hp <= 0) this.killEnemy(e)
  }
  private lashHealBudget = 0

  private killEnemy(e: Enemy) {
    e.alive = false
    this.kills++
    this.events.push({ t: 'kill', kind: e.kind, x: e.x, z: e.z })
    if (e.kind === 'boss') {
      const bi = e.boss ?? 0
      this.bossId = 0
      this.bossesSlain++
      this.drop('chest', e.x, e.z, 1, true)
      this.drop('gem', e.x + 0.8, e.z, Math.round(this.need * 1.2))
      for (let i = 0; i < 6 + Math.min(14, bi * 2); i++) this.drop('coin', e.x + (rand() - 0.5) * 3, e.z + (rand() - 0.5) * 3, 1)
      this.events.push({ t: 'bossDown', boss: bi })
    } else if (e.kind === 'elite') {
      this.drop('chest', e.x, e.z, 1, false)
      this.drop('gem', e.x + 0.5, e.z, e.xp)
    } else {
      this.drop('gem', e.x, e.z, e.xp)
      const r = rand()
      if (r < 0.028 * (1 + 0.2 * this.p('fortune'))) this.drop('coin', e.x + 0.3, e.z, 1)
      else if (r > 0.996) this.drop('heal', e.x, e.z + 0.3, 30)
    }
  }

  private pvpDamage(target: Remote, dmg: number) {
    if (!target.attackable) return
    const now = this.time
    const last = this.pvpLast.get(target.id) ?? -9
    if (now - last < TUNING.pvpHitInterval) return
    this.pvpLast.set(target.id, now)
    this.pvpAcc.set(target.id, (this.pvpAcc.get(target.id) ?? 0) + dmg * this.might * TUNING.pvpScale)
  }
  private pvpFlush = 0
  private flushPvp(dt: number) {
    this.pvpFlush += dt
    if (this.pvpFlush < 0.25) return
    this.pvpFlush = 0
    for (const [to, dmg] of this.pvpAcc) if (dmg > 0) this.events.push({ t: 'pvpHit', to, dmg: Math.round(dmg) })
    this.pvpAcc.clear()
  }

  // ───────── weapons ─────────
  private ready(id: string, cd: number, dt: number) {
    this.cd[id] = (this.cd[id] ?? 0) - dt
    if (this.cd[id] > 0) return false
    this.cd[id] = cd * this.cdMul
    return true
  }

  private alive_() {
    return this.enemies.filter((e) => e.alive)
  }

  private fire(dt: number, remotes: Remote[]) {
    const foes = this.alive_()
    this.lashHealBudget = Math.min(8, this.lashHealBudget + dt * 8)
    // LASH — rectangle in front (and behind from lvl 2)
    const lv = this.w('lash')
    if (lv && this.ready('lash', this.evo('lash') ? 0.9 : 1.2, dt)) {
      const widthMul = 1 + (lv >= 4 ? 0.2 : 0) + (lv >= 7 ? 0.2 : 0) + (this.evo('lash') ? 0.3 : 0)
      const L = 3.6 * this.area * widthMul
      const W = 1.2 * this.area * (this.evo('lash') ? 1.5 : 1)
      const dmg = (15 + 6 * Math.min(lv - 1, 2) + (lv >= 5 ? 6 : 0) + (lv >= 6 ? 6 : 0) + (lv >= 8 ? 10 : 0)) * (this.evo('lash') ? 1.6 : 1)
      // auto-aim at the nearest foe within reach (players move & face freely in Decentraland)
      let aim = this.yaw
      let best = 7
      for (const e of foes) {
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d < best) {
          best = d
          aim = (Math.atan2(e.x - this.x, e.z - this.z) * 180) / Math.PI
        }
      }
      const dirs = lv >= 2 ? [aim, aim + 180] : [aim]
      for (const yaw of dirs) {
        const a = (yaw * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        const cx = this.x + fx * (L / 2 + 0.3)
        const cz = this.z + fz * (L / 2 + 0.3)
        this.events.push({ t: 'slash', x: cx, z: cz, yaw, w: W, l: L })
        const inBox = (x: number, z: number, r: number) => {
          const rx = x - cx
          const rz = z - cz
          const along = rx * fx + rz * fz
          const across = rx * fz - rz * fx
          return Math.abs(along) <= L / 2 + r && Math.abs(across) <= W / 2 + r
        }
        for (const e of foes) if (inBox(e.x, e.z, e.r)) this.hitEnemy(e, dmg, fx * 2, fz * 2)
        for (const p of remotes) if (inBox(p.x, p.z, 0.4)) this.pvpDamage(p, dmg)
      }
    }
    // BOLT — homing-ish projectiles at nearest targets
    const bv = this.w('bolt')
    if (bv && this.ready('bolt', this.evo('bolt') ? 0.4 : 1.1, dt)) {
      const count = 1 + Math.floor(bv / 2) + (bv >= 7 ? 0 : 0) + this.amount + (this.evo('bolt') ? 2 : 0)
      const dmg = 12 + 4 * (bv >= 3 ? 1 : 0) + 4 * (bv >= 5 ? 1 : 0) + (bv >= 8 ? 8 : 0) + (bv - 1) * 1.5
      const pierce = this.evo('bolt') ? 4 : bv >= 6 ? 2 : 1
      const targets: { x: number; z: number; d: number }[] = foes.map((e) => ({ x: e.x, z: e.z, d: Math.hypot(e.x - this.x, e.z - this.z) }))
      for (const p of remotes) if (p.attackable) targets.push({ x: p.x, z: p.z, d: Math.hypot(p.x - this.x, p.z - this.z) })
      targets.sort((a, b) => a.d - b.d)
      for (let i = 0; i < count; i++) {
        const tg = targets[i % Math.max(1, targets.length)]
        let vx: number
        let vz: number
        if (tg && tg.d < 16) {
          vx = (tg.x - this.x) / (tg.d || 1)
          vz = (tg.z - this.z) / (tg.d || 1)
        } else {
          const a = ((this.yaw + (i - count / 2) * 12) * Math.PI) / 180
          vx = Math.sin(a)
          vz = Math.cos(a)
        }
        this.projs.push({ id: this.nextId++, x: this.x, z: this.z, vx: vx * 14, vz: vz * 14, dmg, pierce, life: 1.4, hit: [] })
      }
      this.events.push({ t: 'shoot' })
    }
    // ORBIT — blades circling the player
    const ov = this.w('orbit')
    if (ov) {
      const n = this.orbitCount()
      const R = this.orbitRadius()
      this.orbitAngle += dt * (200 * (ov >= 5 ? 1.25 : 1) * (this.evo('orbit') ? 1.6 : 1))
      const dmg = 12 + (ov >= 3 ? 4 : 0) + (ov >= 7 ? 4 : 0) + (ov - 1) * 1.5
      for (let i = 0; i < n; i++) {
        const a = ((this.orbitAngle + (i * 360) / n) * Math.PI) / 180
        const bx = this.x + Math.sin(a) * R
        const bz = this.z + Math.cos(a) * R
        for (const e of foes) {
          if (Math.hypot(e.x - bx, e.z - bz) > e.r + 0.55) continue
          const k = 'o' + i
          if ((e.lastHit[k] ?? -9) > this.time - 0.4) continue
          e.lastHit[k] = this.time
          this.hitEnemy(e, dmg, Math.sin(a) * 3, Math.cos(a) * 3)
        }
        for (const p of remotes) if (Math.hypot(p.x - bx, p.z - bz) < 0.8) this.pvpDamage(p, dmg)
      }
    }
    // AURA — damage ticks around the player
    const av = this.w('aura')
    if (av && this.ready('aura', 0.5, dt)) {
      const R = this.auraRadius()
      const dmg = 6 + 2.5 * Math.floor(av / 2) + (av - 1) * 0.8
      let heals = 0
      for (const e of foes) {
        const d = Math.hypot(e.x - this.x, e.z - this.z)
        if (d > R + e.r) continue
        this.hitEnemy(e, dmg, ((e.x - this.x) / (d || 1)) * 1.5, ((e.z - this.z) / (d || 1)) * 1.5)
        if (this.evo('aura') && heals < 6) {
          this.hp = Math.min(this.maxHp, this.hp + 0.4)
          heals++
        }
      }
      for (const p of remotes) if (Math.hypot(p.x - this.x, p.z - this.z) < R) this.pvpDamage(p, dmg)
    }
    // THUNDER — random strikes
    const tv = this.w('thunder')
    if (tv && this.ready('thunder', this.evo('thunder') ? 1.2 : 2.4, dt)) {
      const n = 1 + Math.floor(tv / 2) + this.amount + (this.evo('thunder') ? 3 : 0)
      const dmg = 30 + 10 * Math.floor((tv - 1) / 2) + (tv - 1) * 2
      const splash = 1.2 * this.area * (this.evo('thunder') ? 1.6 : 1)
      const near = foes.filter((e) => Math.hypot(e.x - this.x, e.z - this.z) < 13)
      const pvpTargets = remotes.filter((p) => p.attackable && Math.hypot(p.x - this.x, p.z - this.z) < 13)
      for (let i = 0; i < n; i++) {
        let tx: number
        let tz: number
        if (pvpTargets.length && rand() < 0.25) {
          const p = pvpTargets[Math.floor(rand() * pvpTargets.length)]
          tx = p.x
          tz = p.z
        } else if (near.length) {
          const e = near[Math.floor(rand() * near.length)]
          tx = e.x
          tz = e.z
        } else continue
        this.events.push({ t: 'strike', x: tx, z: tz, r: splash })
        for (const e of foes) if (Math.hypot(e.x - tx, e.z - tz) < splash + e.r) this.hitEnemy(e, dmg)
        for (const p of remotes) if (Math.hypot(p.x - tx, p.z - tz) < splash) this.pvpDamage(p, dmg)
      }
    }
    // NOVA — periodic explosion
    const nv = this.w('nova')
    if (nv && this.ready('nova', (this.evo('nova') ? 2.4 : 3.2) * (nv >= 4 ? 0.9 : 1), dt)) {
      const R = (2.6 + 0.35 * Math.floor(nv / 3)) * this.area * (this.evo('nova') ? 1.4 : 1)
      const dmg = 22 + 9 * Math.floor((nv - 1) / 2) + (nv - 1) * 2
      const pulses = this.evo('nova') ? 2 : 1
      for (let k = 0; k < pulses; k++) {
        const r = R * (k === 0 ? 1 : 1.5)
        this.events.push({ t: 'nova', x: this.x, z: this.z, r })
        for (const e of foes) {
          const d = Math.hypot(e.x - this.x, e.z - this.z)
          if (d < r + e.r) this.hitEnemy(e, dmg, ((e.x - this.x) / (d || 1)) * 4, ((e.z - this.z) / (d || 1)) * 4)
        }
        for (const p of remotes) if (Math.hypot(p.x - this.x, p.z - this.z) < r) this.pvpDamage(p, dmg)
      }
    }
    this.fire2(dt, foes, remotes)
  }

  // ───────── second wave of auto-skills ─────────
  private fire2(dt: number, foes: Enemy[], remotes: Remote[]) {
    const near = (x: number, z: number, max: number) => {
      let best: Enemy | null = null
      let bd = max
      for (const e of foes) {
        if (!e.alive) continue
        const d = Math.hypot(e.x - x, e.z - z)
        if (d < bd) (bd = d), (best = e)
      }
      return best
    }
    // FROST COMET — comets fall on the densest nearby foes, chill (evo: freeze)
    const fv = this.w('frost')
    if (fv && this.ready('frost', this.evo('frost') ? 1.5 : 2.8, dt)) {
      const n = 1 + Math.floor(fv / 3) + this.amount + (this.evo('frost') ? 2 : 0)
      const r = 1.5 * this.area * (1 + 0.07 * fv) * (this.evo('frost') ? 1.4 : 1)
      const dmg = (26 + 7 * (fv - 1)) * (this.evo('frost') ? 1.5 : 1)
      const pool = foes.filter((e) => Math.hypot(e.x - this.x, e.z - this.z) < 12)
      for (let i = 0; i < n && pool.length; i++) {
        const e = pool[Math.floor(rand() * pool.length)]
        this.comets.push({ x: e.x, z: e.z, r, dmg, t: 0.38, chill: fv >= 8 ? 3 : 2, freeze: this.evo('frost') ? 1.2 : 0 })
        this.events.push({ t: 'comet', x: e.x, z: e.z, r })
      }
    }
    for (const c of this.comets) {
      c.t -= dt
      if (c.t > 0) continue
      this.events.push({ t: 'frostHit', x: c.x, z: c.z, r: c.r })
      for (const e of foes)
        if (e.alive && Math.hypot(e.x - c.x, e.z - c.z) < c.r + e.r) {
          e.slow = Math.max(e.slow ?? 0, c.chill)
          if (c.freeze) e.frozen = Math.max(e.frozen ?? 0, c.freeze)
          this.hitEnemy(e, c.dmg)
        }
      for (const p of remotes) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r) this.pvpDamage(p, c.dmg)
    }
    this.comets = this.comets.filter((c) => c.t > 0)

    // ARC CHAIN — lightning leaps from foe to foe
    const cv = this.w('chain')
    if (cv && this.ready('chain', this.evo('chain') ? 0.8 : 1.15, dt)) {
      const jumps = 3 + cv + (cv >= 8 ? 1 : 0) + (this.evo('chain') ? 5 : 0)
      let dmg = (22 + 6 * (cv - 1)) * (this.evo('chain') ? 1.4 : 1)
      let cur = near(this.x, this.z, 9)
      const pts: [number, number][] = [[this.x, this.z]]
      const used = new Set<number>()
      let px = this.x
      let pz = this.z
      while (cur && pts.length <= jumps) {
        used.add(cur.id)
        pts.push([cur.x, cur.z])
        px = cur.x
        pz = cur.z
        this.hitEnemy(cur, dmg)
        if (!this.evo('chain')) dmg *= 0.92
        let next: Enemy | null = null
        let bd = 4.8 * this.area
        for (const e of foes) {
          if (!e.alive || used.has(e.id)) continue
          const d = Math.hypot(e.x - px, e.z - pz)
          if (d < bd) (bd = d), (next = e)
        }
        cur = next
      }
      for (const p of remotes) if (p.attackable && Math.hypot(p.x - this.x, p.z - this.z) < 4) this.pvpDamage(p, dmg)
      if (pts.length > 1) this.events.push({ t: 'arc', pts: pts.slice(0, 12) })
    }

    // MOON CHAKRAM — out and back, cuts every foe on both passes
    const kv = this.w('chakram')
    if (kv && this.ready('chakram', this.evo('chakram') ? 1.4 : 2.2, dt)) {
      const n = 1 + (kv >= 4 ? 1 : 0) + (kv >= 7 ? 1 : 0) + this.amount + (this.evo('chakram') ? 1 : 0)
      const d = (6 + 0.5 * Math.floor(kv / 3)) * this.area * (this.evo('chakram') ? 1.3 : 1)
      const dmg = (20 + 5 * (kv - 1)) * (this.evo('chakram') ? 1.5 : 1)
      const tg = near(this.x, this.z, 14)
      const base = tg ? (Math.atan2(tg.x - this.x, tg.z - this.z) * 180) / Math.PI : this.yaw
      for (let i = 0; i < n; i++) {
        const yaw = base + (i - (n - 1) / 2) * (360 / Math.max(n, 3)) * (n > 2 ? 1 : 0.25)
        const a = (yaw * Math.PI) / 180
        this.chakrams.push({ ox: this.x, oz: this.z, fx: Math.sin(a), fz: Math.cos(a), d, t: 0, dur: 1.1, dmg, out: [], back: [], pv: -9 })
        this.events.push({ t: 'chakram', x: this.x, z: this.z, yaw, d, dur: 1.1 })
      }
    }
    for (const c of this.chakrams) {
      c.t += dt
      const k = Math.min(1, c.t / c.dur)
      const going = k < 0.5
      const s = Math.sin(k * Math.PI) * c.d
      // the way back homes on the player
      const bx = going ? c.ox : this.x
      const bz = going ? c.oz : this.z
      const x = bx + c.fx * s
      const z = bz + c.fz * s
      const list = going ? c.out : c.back
      for (const e of foes)
        if (e.alive && !list.includes(e.id) && Math.hypot(e.x - x, e.z - z) < e.r + 0.7) {
          list.push(e.id)
          this.hitEnemy(e, c.dmg, c.fx * 2, c.fz * 2)
        }
      if (this.time - c.pv > 0.5) for (const p of remotes) if (Math.hypot(p.x - x, p.z - z) < 0.8) (this.pvpDamage(p, c.dmg), (c.pv = this.time))
    }
    this.chakrams = this.chakrams.filter((c) => c.t < c.dur)

    // HEX MINE — runes that blow up under foes
    const mv = this.w('mine')
    if (mv) {
      const max = 3 + Math.floor(mv / 2) + (mv >= 8 ? 1 : 0) + (this.evo('mine') ? 4 : 0)
      const r = 1.9 * this.area * (1 + 0.06 * mv) * (this.evo('mine') ? 1.3 : 1)
      const dmg = (36 + 11 * (mv - 1)) * (this.evo('mine') ? 1.6 : 1)
      if (this.ready('mine', this.evo('mine') ? 1.0 : 1.8, dt) && this.mines.length < max) {
        const a = rand() * Math.PI * 2
        const rr = 1.6 + rand() * 2.8
        const c = clampArena(this.x + Math.sin(a) * rr, this.z + Math.cos(a) * rr, 0.6)
        const id = this.nextId++
        this.mines.push({ id, x: c.x, z: c.z, arm: 0.4, life: 9, dmg, r })
        this.events.push({ t: 'mine', id, x: c.x, z: c.z })
      }
      for (const m of this.mines) {
        m.arm -= dt
        m.life -= dt
        if (m.arm > 0) continue
        const trip = m.life <= 0 || foes.some((e) => e.alive && Math.hypot(e.x - m.x, e.z - m.z) < e.r + 0.8) || remotes.some((p) => p.attackable && Math.hypot(p.x - m.x, p.z - m.z) < 0.8)
        if (!trip) continue
        m.life = -1
        this.events.push({ t: 'boom', id: m.id, x: m.x, z: m.z, r: m.r })
        for (const e of foes) {
          const d = Math.hypot(e.x - m.x, e.z - m.z)
          if (e.alive && d < m.r + e.r) this.hitEnemy(e, m.dmg, ((e.x - m.x) / (d || 1)) * 5, ((e.z - m.z) / (d || 1)) * 5)
        }
        for (const p of remotes) if (Math.hypot(p.x - m.x, p.z - m.z) < m.r) this.pvpDamage(p, m.dmg)
        if (this.evo('mine')) this.hp = Math.min(this.maxHp, this.hp + 3)
      }
      this.mines = this.mines.filter((m) => m.life > 0 || m.arm > 0)
    } else this.mines = []

    // PRISM RAY — beams sweep a full circle
    const yv = this.w('beam')
    if (yv && this.ready('beam', (this.evo('beam') ? 2.0 : 3.0) * (yv >= 4 ? 0.85 : 1), dt)) {
      const n = 1 + (yv >= 5 ? 1 : 0) + (this.evo('beam') ? 1 : 0)
      const len = (5.2 + 0.5 * Math.floor(yv / 3)) * this.area * (this.evo('beam') ? 1.3 : 1)
      const dmg = (22 + 6 * (yv - 1)) * (this.evo('beam') ? 1.5 : 1)
      const yaw = rand() * 360
      this.sweeps.push({ t: 0, dur: 0.8, yaw, len, n, dmg, hit: new Set(), pv: new Set() })
      this.events.push({ t: 'sweep', x: this.x, z: this.z, yaw, len, dur: 0.8, n })
    }
    for (const b of this.sweeps) {
      b.t += dt
      const ang = b.yaw + Math.min(1, b.t / b.dur) * 360
      for (let i = 0; i < b.n; i++) {
        const a = ((ang + (i * 360) / b.n) * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        const inBeam = (x: number, z: number, r: number) => {
          const rx = x - this.x
          const rz = z - this.z
          const along = rx * fx + rz * fz
          return along > 0 && along < b.len + r && Math.abs(rx * fz - rz * fx) < 0.45 + r
        }
        for (const e of foes) if (e.alive && !b.hit.has(e.id) && inBeam(e.x, e.z, e.r)) (b.hit.add(e.id), this.hitEnemy(e, b.dmg))
        for (const p of remotes) if (!b.pv.has(p.id) && inBeam(p.x, p.z, 0.3)) (b.pv.add(p.id), this.pvpDamage(p, b.dmg))
      }
    }
    this.sweeps = this.sweeps.filter((b) => b.t < b.dur)

    // SPIRIT WISPS — familiars that hover and dart
    const wv = this.w('wisp')
    const want = wv ? 1 + Math.floor(wv / 3) + this.amount + (this.evo('wisp') ? 2 : 0) : 0
    while (this.wisps.length < want) this.wisps.push({ x: this.x, z: this.z, cd: 0.4 * this.wisps.length, ph: this.wisps.length * 2.1, dash: 0, tx: 0, tz: 0 })
    if (this.wisps.length > want) this.wisps.length = want
    if (wv) {
      const dmg = (18 + 5 * (wv - 1)) * (this.evo('wisp') ? 1.5 : 1)
      const cd = (wv >= 4 ? 1.1 : 1.3) * (wv >= 7 ? 0.85 : 1) * (this.evo('wisp') ? 0.65 : 1) * this.cdMul
      const splash = this.evo('wisp') ? 1.5 * this.area : 0
      this.wisps.forEach((w, i) => {
        w.ph += dt * 2.2
        if (w.dash > 0) {
          w.dash -= dt
          const k = Math.min(1, dt / Math.max(0.01, w.dash + dt))
          w.x += (w.tx - w.x) * k
          w.z += (w.tz - w.z) * k
          if (w.dash <= 0) {
            for (const e of foes)
              if (e.alive && Math.hypot(e.x - w.tx, e.z - w.tz) < e.r + 0.5 + splash) this.hitEnemy(e, dmg)
            for (const p of remotes) if (Math.hypot(p.x - w.tx, p.z - w.tz) < 0.6 + splash) this.pvpDamage(p, dmg)
          }
          return
        }
        // hover around the hunter
        const a = w.ph + (i * Math.PI * 2) / Math.max(1, want)
        const hx = this.x + Math.sin(a) * 1.3
        const hz = this.z + Math.cos(a) * 1.3
        const k = Math.min(1, dt * 6)
        w.x += (hx - w.x) * k
        w.z += (hz - w.z) * k
        w.cd -= dt
        if (w.cd > 0) return
        const tg = near(w.x, w.z, 8)
        if (!tg) return
        w.cd = cd
        w.dash = 0.18
        w.tx = tg.x
        w.tz = tg.z
        this.events.push({ t: 'dash', x0: w.x, z0: w.z, x1: tg.x, z1: tg.z })
      })
    }
  }

  orbitCount() {
    const ov = this.w('orbit')
    if (!ov) return 0
    return 1 + Math.floor(ov / 2) + this.amount + (this.evo('orbit') ? 3 : 0)
  }
  orbitRadius() {
    return 1.5 * this.area * (this.evo('orbit') ? 1.25 : 1)
  }
  auraRadius() {
    const av = this.w('aura')
    return av ? (1.4 + 0.18 * Math.ceil(av / 2)) * this.area * (this.evo('aura') ? 1.3 : 1) : 0
  }

  private moveProjs(dt: number, remotes: Remote[]) {
    for (const p of this.projs) {
      if (p.life <= 0) continue
      p.life -= dt
      p.x += p.vx * dt
      p.z += p.vz * dt
      for (const e of this.enemies) {
        if (!e.alive || p.pierce <= 0 || p.hit.includes(e.id)) continue
        if (Math.hypot(e.x - p.x, e.z - p.z) < e.r + 0.25) {
          p.hit.push(e.id)
          p.pierce--
          this.hitEnemy(e, p.dmg, p.vx * 0.12, p.vz * 0.12)
        }
      }
      for (const r of remotes) {
        if (p.pierce > 0 && Math.hypot(r.x - p.x, r.z - p.z) < 0.5) {
          this.pvpDamage(r, p.dmg)
          p.pierce--
        }
      }
      if (p.pierce <= 0) p.life = 0
    }
    this.projs = this.projs.filter((p) => p.life > 0)
  }

  // ───────── pickups ─────────
  private drop(kind: PickKind, x: number, z: number, value: number, big = false) {
    // merge tiny gems when there are too many on the floor
    if (kind === 'gem') {
      const gems = this.pickups.filter((p) => p.alive && p.kind === 'gem')
      if (gems.length > 110) {
        // merge into the nearest gem so XP stays where the kill happened
        let g = gems[0]
        let bd = Infinity
        for (const q of gems) {
          const d = Math.abs(q.x - x) + Math.abs(q.z - z)
          if (d < bd) (bd = d), (g = q)
        }
        g.value += value
        return
      }
    }
    const pk: Pickup = { id: this.nextId++, kind, x, z, value, alive: true, flying: false, big, born: this.time }
    const slot = this.pickups.findIndex((p) => !p.alive)
    if (slot >= 0) this.pickups[slot] = pk
    else this.pickups.push(pk)
  }

  private collect(dt: number) {
    const mag = this.magnet
    for (const p of this.pickups) {
      if (!p.alive) continue
      const d = Math.hypot(p.x - this.x, p.z - this.z)
      // gems left on the floor for 18 s drift to the player on their own
      if (!p.flying && (d < (p.kind === 'chest' ? 1.3 : mag) || (p.kind === 'gem' && this.time - p.born > 18))) p.flying = true
      if (p.flying) {
        const sp = 10 + Math.max(0, mag - d) * 2 + Math.min(14, Math.max(0, d - mag))
        p.x += ((this.x - p.x) / (d || 1)) * Math.min(d, sp * dt)
        p.z += ((this.z - p.z) / (d || 1)) * Math.min(d, sp * dt)
      }
      if (Math.hypot(p.x - this.x, p.z - this.z) < 0.5) {
        p.alive = false
        if (p.kind === 'gem') {
          this.gainXp(p.value)
          this.events.push({ t: 'gem' })
        } else if (p.kind === 'coin') {
          this.gold += Math.round(5 * this.goldMul * (1 + this.time / 1200))
          this.events.push({ t: 'coin' })
        } else if (p.kind === 'heal') {
          this.hp = Math.min(this.maxHp, this.hp + p.value)
          this.events.push({ t: 'heal' })
        } else if (p.kind === 'chest') this.events.push({ t: 'chest', big: !!p.big })
      }
    }
  }

  gainXp(v: number) {
    this.xp += v * this.xpMul
    while (this.xp >= this.need) {
      this.xp -= this.need
      this.level++
      this.pendingLevels++
      this.events.push({ t: 'levelup' })
      while (this.level >= bossFor(this.bossIndex + this.bossQueue).lvl) this.bossQueue++
    }
  }

  // ───────── upgrades ─────────
  canEvolve(): WeaponId[] {
    const out: WeaponId[] = []
    for (const [id, lv] of this.weapons) if (lv >= MAX_WEAPON_LVL && !this.evolved.has(id) && this.p(WEAPONS[id].evoWith) > 0) out.push(id)
    return out
  }

  allUpgrades(): Option[] {
    const opts: Option[] = []
    for (const id of Object.keys(WEAPONS) as WeaponId[]) {
      const lv = this.w(id)
      if (lv === 0 && this.weapons.size >= MAX_WEAPONS) continue
      if (lv < MAX_WEAPON_LVL) opts.push({ kind: 'weapon', id, to: lv + 1 })
    }
    for (const id of Object.keys(PASSIVES) as PassiveId[]) {
      const lv = this.p(id)
      if (lv === 0 && this.passives.size >= MAX_PASSIVES) continue
      if (lv < MAX_PASSIVE_LVL) opts.push({ kind: 'passive', id, to: lv + 1 })
    }
    return opts
  }

  levelChoices(): Option[] {
    const all = this.allUpgrades()
    const n = 3 + (this.p('fortune') >= 3 ? 1 : 0)
    if (!all.length) {
      const ids = (Object.keys(BOOSTS) as BoostId[]).filter((b) => !(b === 'area' && this.boostArea >= 0.6))
      const out: Option[] = []
      while (out.length < 3 && ids.length) out.push({ kind: 'boost', id: ids.splice(Math.floor(rand() * ids.length), 1)[0] })
      return out
    }
    // owned items are twice as likely, so builds snowball
    const weighted = all.map((o) => ({ o, w: (o.kind === 'weapon' ? this.w(o.id) : o.kind === 'passive' ? this.p(o.id) : 0) > 0 ? 2.2 : 1 }))
    const out: Option[] = []
    while (out.length < n && weighted.length) {
      const total = weighted.reduce((s, x) => s + x.w, 0)
      let r = rand() * total
      let i = 0
      while (i < weighted.length - 1 && r > weighted[i].w) r -= weighted[i++].w
      out.push(weighted[i].o)
      weighted.splice(i, 1)
    }
    return out
  }

  apply(o: Option) {
    if (o.kind === 'weapon') this.weapons.set(o.id, o.to)
    else if (o.kind === 'passive') {
      this.passives.set(o.id, o.to)
      if (o.id === 'vitality') {
        this.maxHp += 20
        this.hp += 20
      }
    } else if (o.kind === 'evolve') this.evolved.add(o.id)
    else if (o.kind === 'gold') this.gold += o.amount
    else if (o.kind === 'heal') this.hp = Math.min(this.maxHp, this.hp + o.amount)
    else if (o.kind === 'boost') {
      if (o.id === 'dmg') this.boostDmg += 0.08
      else if (o.id === 'hp') {
        this.maxHp += 25
        this.hp = Math.min(this.maxHp, this.hp + 25)
      } else if (o.id === 'area') this.boostArea = Math.min(0.6, this.boostArea + 0.04)
      else if (o.id === 'regen') this.boostRegen += 0.5
      else if (o.id === 'gold') this.gold += 30
    }
  }

  // ───────── boss ladder ─────────
  get boss(): Enemy | undefined {
    return this.bossId ? this.enemies.find((e) => e.id === this.bossId && e.alive) : undefined
  }
  bossDef(): BossDef | undefined {
    const b = this.boss
    return b ? bossFor(b.boss!) : undefined
  }

  private spawnBoss() {
    const idx = this.bossIndex++
    this.bossQueue--
    const d = bossFor(idx)
    const e = this.spawnEnemy('boss')
    e.boss = idx
    e.hp = e.maxHp = d.hp
    e.dmg = d.dmg
    e.speed = d.speed
    e.r = d.r
    e.sc = d.scale
    e.xp = 0
    e.slamCd = 3
    this.bossId = e.id
    this.events.push({ t: 'bossSpawn', boss: idx })
  }

  private bossStep(dt: number) {
    const b = this.boss
    if (!b) {
      if (this.bossId) this.bossId = 0
      return
    }
    const d = bossFor(b.boss!)
    if (b.wind !== undefined) {
      b.wind -= dt
      if (b.wind <= 0) {
        b.wind = undefined
        const r = d.slam
        this.events.push({ t: 'slam', x: b.x, z: b.z, r })
        if (Math.hypot(this.x - b.x, this.z - b.z) < r && this.invuln <= 0) {
          const dmg = d.dmg * 1.6 * Math.max(0.3, 1 - this.armor * 0.08) * (this.god ? 0.5 : 1)
          this.hp -= dmg
          this.lastAttacker = ''
          this.events.push({ t: 'hurt', dmg })
          if (this.hp <= 0) this.die('')
        }
        for (let i = 0; i < 4 + Math.min(6, b.boss!); i++) {
          const a = (i / 6) * Math.PI * 2
          const c = clampArena(b.x + Math.sin(a) * (r + 1), b.z + Math.cos(a) * (r + 1), 0.8)
          this.spawnEnemy(d.adds, c.x, c.z)
        }
      }
      return
    }
    b.slamCd = (b.slamCd ?? 4) - dt
    if (b.slamCd <= 0 && Math.hypot(this.x - b.x, this.z - b.z) < d.slam * 1.6) {
      b.slamCd = b.boss! >= 3 ? 4.2 : 5.5
      b.wind = 1.1
      this.events.push({ t: 'slamWarn', x: b.x, z: b.z, r: d.slam, dur: 1.1 })
    }
  }

  // ───────── armory: manual attacks ─────────
  private manualStep(dt: number) {
    if (this.manualCd > 0) this.manualCd -= dt
    if (this.nukeCd > 0) this.nukeCd -= dt
    const pn = this.pendingNuke
    if (pn) {
      pn.t -= dt
      if (pn.t <= 0) {
        this.pendingNuke = null
        const R = NUKE.radius * this.area
        this.events.push({ t: 'nuke', x: pn.x, z: pn.z, r: R })
        const dmg = NUKE.dmg * manualLevelScale(this.level)
        for (const e of this.enemies) {
          if (!e.alive) continue
          const dd = Math.hypot(e.x - pn.x, e.z - pn.z)
          if (dd > R + e.r) continue
          const hit = e.kind === 'boss' ? Math.min(dmg, e.maxHp * NUKE.bossCap) / this.might : dmg
          const ux = (e.x - pn.x) / (dd || 1)
          const uz = (e.z - pn.z) / (dd || 1)
          this.hitEnemy(e, hit, ux * 12, uz * 12)
        }
      }
    }
  }

  /** Divine Ascension in hand: every hit on a monster is lethal */
  get god() {
    return this.equip === GOD_TIER && this.alive
  }

  get canNuke() {
    return this.armory >= NUKE_TIER && this.nukeCd <= 0 && !this.pendingNuke
  }

  /** F key: drop the Doomsday Nuke ahead of the player */
  nuke(yaw: number) {
    if (!this.alive || !this.canNuke) return false
    this.nukeCd = NUKE.cd
    const a = (yaw * Math.PI) / 180
    const c = clampArena(this.x + Math.sin(a) * NUKE.ahead, this.z + Math.cos(a) * NUKE.ahead, 1)
    this.pendingNuke = { x: c.x, z: c.z, t: NUKE.delay }
    this.events.push({ t: 'nukeLaunch', x: this.x, z: this.z, tx: c.x, tz: c.z, delay: NUKE.delay })
    return true
  }

  /** left click (held): attack with the equipped armory weapon toward yaw (degrees, 0 = +z) */
  manualAttack(yaw: number, remotes: Remote[] = []) {
    if (!this.alive || this.manualCd > 0) return false
    const w = ARMORY[this.equip]
    this.manualCd = w.cd * (0.5 + 0.5 * this.cdMul)
    const a = (yaw * Math.PI) / 180
    const fx = Math.sin(a)
    const fz = Math.cos(a)
    const dmg = w.dmg * manualLevelScale(this.level)
    if (w.god) {
      // divine nova: everything around you dies
      const R = w.range * this.area
      for (const e of this.enemies) {
        if (!e.alive) continue
        const dx = e.x - this.x
        const dz = e.z - this.z
        const d = Math.hypot(dx, dz)
        if (d > R + e.r) continue
        this.hitEnemy(e, 1, (dx / (d || 1)) * w.knock, (dz / (d || 1)) * w.knock)
      }
      for (const r of remotes) if (Math.hypot(r.x - this.x, r.z - this.z) < R) this.pvpDamage(r, 400)
      this.events.push({ t: 'divine', x: this.x, z: this.z, r: R })
      return true
    }
    if (w.chain) {
      // Zeus: strike the foe nearest the aim line, then leap to the closest unhit foes
      let cur: Enemy | undefined
      let best = Infinity
      for (const e of this.enemies) {
        if (!e.alive) continue
        const dx = e.x - this.x
        const dz = e.z - this.z
        const t = dx * fx + dz * fz
        if (t < 0 || t > w.range) continue
        const score = Math.hypot(dx, dz) + Math.abs(dx * fz - dz * fx) * 2
        if (score < best) (best = score), (cur = e)
      }
      const pts: [number, number][] = [[this.x, this.z]]
      const hit = new Set<number>()
      for (let k = 0; cur && k <= w.chain; k++) {
        hit.add(cur.id)
        pts.push([cur.x, cur.z])
        const from = cur
        this.hitEnemy(from, dmg * (1 - k * 0.06), 0, 0)
        cur = undefined
        let bd = 9
        for (const e of this.enemies) {
          if (!e.alive || hit.has(e.id)) continue
          const d = Math.hypot(e.x - from.x, e.z - from.z)
          if (d < bd) (bd = d), (cur = e)
        }
      }
      for (const r of remotes) if (Math.hypot(r.x - this.x, r.z - this.z) < 8) this.pvpDamage(r, dmg * 0.4)
      if (pts.length > 1) this.events.push({ t: 'zeus', pts })
      return true
    }
    if (w.gun) {
      const spread = ((rand() - 0.5) * 7 * Math.PI) / 180
      const gx = Math.sin(a + spread)
      const gz = Math.cos(a + spread)
      let len = w.range
      let pierce = 2
      const hits = this.enemies
        .filter((e) => e.alive)
        .map((e) => {
          const t = (e.x - this.x) * gx + (e.z - this.z) * gz
          const perp = Math.abs((e.x - this.x) * gz - (e.z - this.z) * gx)
          return { e, t, perp }
        })
        .filter((h) => h.t > 0 && h.t < w.range && h.perp < h.e.r + 0.35)
        .sort((p, q) => p.t - q.t)
      for (const h of hits) {
        if (pierce-- <= 0) break
        this.hitEnemy(h.e, dmg, gx * w.knock, gz * w.knock)
        len = h.t
      }
      for (const r of remotes) {
        const t = (r.x - this.x) * gx + (r.z - this.z) * gz
        const perp = Math.abs((r.x - this.x) * gz - (r.z - this.z) * gx)
        if (t > 0 && t < w.range && perp < 0.6) this.pvpDamage(r, dmg)
      }
      this.events.push({ t: 'tracer', x: this.x, z: this.z, yaw: yaw + (spread * 180) / Math.PI, len: Math.max(2, len) })
      return true
    }
    const range = w.range * this.area
    const half = w.arc / 2
    for (const e of this.enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x
      const dz = e.z - this.z
      const d = Math.hypot(dx, dz)
      if (d > range + e.r) continue
      const ang = Math.abs(((((Math.atan2(dx, dz) * 180) / Math.PI - yaw) % 360) + 540) % 360 - 180)
      if (d > 1.0 && ang > half) continue
      this.hitEnemy(e, dmg, (dx / (d || 1)) * w.knock, (dz / (d || 1)) * w.knock)
      if (w.leech) this.hp = Math.min(this.maxHp, this.hp + w.leech)
    }
    for (const r of remotes) {
      const dx = r.x - this.x
      const dz = r.z - this.z
      const d = Math.hypot(dx, dz)
      const ang = Math.abs(((((Math.atan2(dx, dz) * 180) / Math.PI - yaw) % 360) + 540) % 360 - 180)
      if (d < range && ang <= half) this.pvpDamage(r, dmg)
    }
    this.events.push({ t: 'swing', x: this.x + fx * range * 0.5, z: this.z + fz * range * 0.5, yaw, range, arc: w.arc, tier: this.equip })
    if (w.quake) {
      const qx = this.x + fx * range * 0.8
      const qz = this.z + fz * range * 0.8
      const qr = w.quake * this.area
      for (const e of this.enemies) if (e.alive && Math.hypot(e.x - qx, e.z - qz) < qr + e.r) this.hitEnemy(e, dmg * 0.5, 0, 0)
      this.events.push({ t: 'quake', x: qx, z: qz, r: qr })
    }
    return true
  }

  /** open a treasure chest: evolution if possible, else 1/3/5 random upgrades (slot-machine) */
  openChest(big: boolean): { rolls: Option[]; gold: number } {
    const rolls: Option[] = []
    const evo = this.canEvolve()
    if (evo.length) rolls.push({ kind: 'evolve', id: evo[0] })
    const luck = 0.05 * this.p('fortune')
    const r = rand()
    const count = big ? (r < 0.5 + luck ? 5 : 3) : r < 0.06 + luck ? 5 : r < 0.3 + luck ? 3 : 1
    while (rolls.length < count) {
      const owned = this.allUpgrades().filter((o) => (o.kind === 'weapon' ? this.w(o.id) : o.kind === 'passive' ? this.p(o.id) : 0) > 0)
      const pool = owned.length ? owned : this.allUpgrades()
      if (!pool.length) {
        const ids = Object.keys(BOOSTS) as BoostId[]
        const o: Option = { kind: 'boost', id: ids[Math.floor(rand() * ids.length)] }
        this.apply(o)
        rolls.push(o)
        continue
      }
      const o = pool[Math.floor(rand() * pool.length)]
      this.apply(o)
      rolls.push(o)
    }
    if (rolls[0]?.kind === 'evolve') this.apply(rolls[0])
    const gold = Math.round((big ? 120 : 40) * count * this.goldMul * 0.4)
    this.gold += gold
    return { rolls, gold }
  }
}

// ───────── helpers ─────────
function pick<T>(list: [T, number][]): T {
  const total = list.reduce((s, x) => s + x[1], 0)
  let r = rand() * total
  for (const [v, w] of list) {
    if (r < w) return v
    r -= w
  }
  return list[list.length - 1][0]
}

export function inArena(x: number, z: number, m = 0) {
  return ARENA.some((r) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m)
}

export function clampArena(x: number, z: number, m = 0) {
  if (inArena(x, z, m)) return { x, z }
  let best = { x, z, d: Infinity }
  for (const r of ARENA) {
    const cx = Math.min(Math.max(x, r.x0 + m), r.x1 - m)
    const cz = Math.min(Math.max(z, r.z0 + m), r.z1 - m)
    const d = Math.hypot(cx - x, cz - z)
    if (d < best.d) best = { x: cx, z: cz, d }
  }
  return { x: best.x, z: best.z }
}

export function optionLabel(o: Option): { title: string; sub: string; desc: string; color: string; isNew: boolean } {
  if (o.kind === 'weapon') {
    const w = WEAPONS[o.id]
    return { title: w.name, sub: o.to === 1 ? 'NEW WEAPON' : `LV ${o.to - 1} → ${o.to}`, desc: w.desc[o.to - 1], color: w.color, isNew: o.to === 1 }
  }
  if (o.kind === 'passive') {
    const p = PASSIVES[o.id]
    return { title: p.name, sub: o.to === 1 ? 'NEW PASSIVE' : `LV ${o.to - 1} → ${o.to}`, desc: p.desc, color: p.color, isNew: o.to === 1 }
  }
  if (o.kind === 'evolve') {
    const w = WEAPONS[o.id]
    return { title: w.evo, sub: 'ASCENSION!', desc: `${w.name} ascends`, color: '#FFD86A', isNew: true }
  }
  if (o.kind === 'gold') return { title: `+${o.amount} Gold`, sub: 'VAULT', desc: 'Spend it at the Arcane Forge', color: '#FFD86A', isNew: false }
  if (o.kind === 'boost') {
    const b = BOOSTS[o.id]
    return { title: b.name, sub: 'RIFT BOOST', desc: b.desc, color: b.color, isNew: false }
  }
  return { title: `+${o.amount} HP`, sub: 'HEAL', desc: 'Restore health', color: '#3DFF8E', isNew: false }
}

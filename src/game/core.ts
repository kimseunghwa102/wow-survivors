// WOW NIGHTSWARM — pure game simulation (no Decentraland imports, runs headless for balance tests).
import LAYOUT from '../../layout.json'
import {
  WeaponId, PassiveId, EnemyKind, WEAPONS, PASSIVES, ENEMIES, MAX_WEAPON_LVL, MAX_PASSIVE_LVL,
  MAX_WEAPONS, MAX_PASSIVES, waveMix, xpNeed
} from './defs'

export type Rect = { x0: number; z0: number; x1: number; z1: number }
export const ARENA: Rect[] = LAYOUT.arena

export const TUNING = {
  maxEnemies: 150,
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
}
export type PickKind = 'gem' | 'coin' | 'chest' | 'heal'
export type Pickup = { id: number; kind: PickKind; x: number; z: number; value: number; alive: boolean; flying: boolean; big?: boolean }
export type Proj = { id: number; x: number; z: number; vx: number; vz: number; dmg: number; pierce: number; life: number; hit: number[] }
export type Remote = { id: string; x: number; z: number; attackable: boolean }

export type Ev =
  | { t: 'hit'; x: number; z: number; dmg: number; crit?: boolean }
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

export type Option =
  | { kind: 'weapon'; id: WeaponId; to: number }
  | { kind: 'passive'; id: PassiveId; to: number }
  | { kind: 'evolve'; id: WeaponId }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number }

let rand = Math.random
export function setRandom(fn: () => number) {
  rand = fn
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

  enemies: Enemy[] = []
  pickups: Pickup[] = []
  projs: Proj[] = []
  private nextId = 1
  private spawnAcc = 0
  private nextElite = TUNING.eliteEvery
  private nextBoss = TUNING.bossEvery
  private nextRing = TUNING.ringEvery
  private pvpAcc = new Map<string, number>()
  private pvpLast = new Map<string, number>()
  events: Ev[] = []

  constructor(start: WeaponId, meta?: { might: number; hp: number; magnet: number; xp: number }) {
    this.weapons.set(start, 1)
    if (meta) this.meta = meta
    this.maxHp = this.hp = TUNING.baseHp + this.meta.hp * 10
  }

  // ───────── derived stats ─────────
  p(id: PassiveId) {
    return this.passives.get(id) ?? 0
  }
  get might() {
    return 1 + 0.12 * this.p('might') + 0.05 * this.meta.might
  }
  get cdMul() {
    return Math.max(0.4, 1 - 0.07 * this.p('haste'))
  }
  get area() {
    return 1 + 0.1 * this.p('expanse')
  }
  get amount() {
    return Math.floor((this.p('duplicator') + 1) / 2)
  }
  get armor() {
    return this.p('plating')
  }
  get regen() {
    return 0.25 + 0.4 * this.p('bloodstone')
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
    this.flushPvp(dt)
    return this.events
  }

  // ───────── spawning ─────────
  private spawn(dt: number) {
    const t = this.time
    const rate = Math.min(12, 0.7 + t / 25)
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
    if (t >= this.nextBoss) {
      this.nextBoss += TUNING.bossEvery
      this.spawnEnemy('lich')
      this.events.push({ t: 'boss' })
    }
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
    const hp = d.hp * (kind === 'lich' ? 1 + this.time / 600 : scale)
    const e: Enemy = {
      id: this.nextId++, kind, x: x!, z: z!, hp, maxHp: hp,
      speed: d.speed * (1 + Math.min(0.25, this.time / 1200)), dmg: d.dmg * (1 + this.time / 400),
      r: d.r, xp: d.xp, alive: true, wob: rand() * 6.28, kx: 0, kz: 0, lastHit: {}
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
      const stepLen = Math.min(e.speed * dt, Math.max(0, dist - reach))
      e.x += (mx / ml) * stepLen + e.kx * dt
      e.z += (mz / ml) * stepLen + e.kz * dt
      e.kx *= Math.max(0, 1 - dt * 6)
      e.kz *= Math.max(0, 1 - dt * 6)
      const c = clampArena(e.x, e.z, 0.5)
      e.x = c.x
      e.z = c.z
      // contact damage: one hit at a time with short i-frames (like the genre)
      if (dist < e.r + 0.55 && this.invuln <= 0 && this.hurtCd <= 0) {
        const dmg = e.dmg * Math.max(0.25, 1 - this.armor * 0.08)
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
    const d = dmg * this.might * (crit ? 2 : 1)
    e.hp -= d
    e.kx += kx
    e.kz += kz
    this.events.push({ t: 'hit', x: e.x, z: e.z, dmg: d, crit })
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
    if (e.kind === 'lich') {
      this.drop('chest', e.x, e.z, 1, true)
      this.drop('gem', e.x + 0.6, e.z, 60)
    } else if (e.kind === 'elite') {
      this.drop('chest', e.x, e.z, 1, false)
      this.drop('gem', e.x + 0.5, e.z, e.xp)
    } else {
      this.drop('gem', e.x, e.z, e.xp)
      const r = rand()
      if (r < 0.035 * (1 + 0.2 * this.p('fortune'))) this.drop('coin', e.x + 0.3, e.z, 1)
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
        const g = gems[Math.floor(rand() * gems.length)]
        g.value += value
        return
      }
    }
    const pk: Pickup = { id: this.nextId++, kind, x, z, value, alive: true, flying: false, big }
    const slot = this.pickups.findIndex((p) => !p.alive)
    if (slot >= 0) this.pickups[slot] = pk
    else this.pickups.push(pk)
  }

  private collect(dt: number) {
    const mag = this.magnet
    for (const p of this.pickups) {
      if (!p.alive) continue
      const d = Math.hypot(p.x - this.x, p.z - this.z)
      if (!p.flying && d < (p.kind === 'chest' ? 1.3 : mag)) p.flying = true
      if (p.flying) {
        const sp = 9 + (mag - d) * 2
        p.x += ((this.x - p.x) / (d || 1)) * Math.min(d, sp * dt)
        p.z += ((this.z - p.z) / (d || 1)) * Math.min(d, sp * dt)
      }
      if (d < 0.5) {
        p.alive = false
        if (p.kind === 'gem') {
          this.gainXp(p.value)
          this.events.push({ t: 'gem' })
        } else if (p.kind === 'coin') {
          this.gold += Math.round(5 * this.goldMul)
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
    if (!all.length) return [{ kind: 'gold', amount: 25 }, { kind: 'heal', amount: 30 }]
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
        rolls.push({ kind: 'gold', amount: 40 })
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
  return { title: `+${o.amount} HP`, sub: 'HEAL', desc: 'Restore health', color: '#3DFF8E', isNew: false }
}

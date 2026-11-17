// Game controller: glues the simulation, rendering, sound, multiplayer and UI state together.
import { engine, Transform, AvatarLocomotionSettings } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import LAYOUT from '../../layout.json'
import { Run, Option, Ev, inArena } from './core'
import { WeaponId, WEAPONS } from './defs'
import { renderRun, clearView, setupView } from './view'
import { play, setupSfx } from './sfx'
import { setupNet, sendStatus, sendHit, sendKo, attackable, submitRun, me, nameOf } from './net'
import { save, loadProfile, serverStartRun, serverEndRun, serverBuy, loadBoard, ServerProfile } from './persist'

export type Phase = 'idle' | 'start' | 'running' | 'levelup' | 'chest' | 'dead'
export type MetaKey = 'might' | 'hp' | 'magnet' | 'xp'
export const META: Record<MetaKey, { name: string; desc: string; max: number }> = {
  might: { name: 'Power', desc: '+5% damage', max: 5 },
  hp: { name: 'Toughness', desc: '+10 max HP', max: 5 },
  magnet: { name: 'Attraction', desc: '+10% pickup range', max: 5 },
  xp: { name: 'Wisdom', desc: '+5% experience', max: 5 }
}
export const metaCost = (lvl: number) => 80 * (lvl + 1) * (lvl + 1)

export const G = {
  run: null as Run | null,
  phase: 'idle' as Phase,
  choices: [] as Option[],
  chest: null as null | { rolls: Option[]; gold: number; spin: number; big: boolean },
  chestQueue: [] as boolean[],
  bank: 0,
  meta: { might: 0, hp: 0, magnet: 0, xp: 0 } as Record<MetaKey, number>,
  best: { t: 0, l: 0, k: 0 },
  summary: null as null | { t: number; l: number; k: number; gold: number; killer?: string; pvpKills: number; newBest: boolean; rank?: number; saving?: boolean },
  shopBusy: false,
  inArena: false,
  banner: '',
  bannerT: 0,
  hurtFlash: 0,
  shopOpen: false,
  lastAttackerId: '',
  pvpKills: 0
}

export function banner(text: string, sec = 3) {
  G.banner = text
  G.bannerT = sec
}

export function applyProfile(p: ServerProfile | null) {
  if (!p) return
  G.bank = p.bank
  G.meta = { ...p.meta }
  G.best = { t: p.best.time, l: p.best.level, k: p.best.kills }
}

export function startRun(w: WeaponId) {
  void serverStartRun(w, me().name)
  G.run = new Run(w, { ...G.meta })
  G.pvpKills = 0
  G.phase = 'running'
  G.lastAttackerId = ''
  banner(`SURVIVE! ${WEAPONS[w].name} equipped`, 3)
}

export function choose(o: Option) {
  const r = G.run
  if (!r || G.phase !== 'levelup') return
  r.apply(o)
  if (o.kind === 'weapon' && o.to === 8) banner(`${WEAPONS[o.id].name} MAXED — find a chest to evolve!`, 4)
  r.pendingLevels = Math.max(0, r.pendingLevels - 1)
  nextModal()
}

export function reroll() {
  const r = G.run
  if (!r || r.rerolls <= 0 || G.phase !== 'levelup') return
  r.rerolls--
  G.choices = r.levelChoices()
}

export function skipLevel() {
  const r = G.run
  if (!r || G.phase !== 'levelup') return
  r.gold += 10
  r.pendingLevels = Math.max(0, r.pendingLevels - 1)
  nextModal()
}

export function collectChest() {
  if (G.phase !== 'chest') return
  G.chest = null
  nextModal()
}

function nextModal() {
  const r = G.run
  if (!r) return
  if (r.pendingLevels > 0) {
    G.phase = 'levelup'
    G.choices = r.levelChoices()
    return
  }
  const big = G.chestQueue.shift()
  if (big !== undefined) {
    const res = r.openChest(big)
    G.chest = { ...res, spin: 2.2, big }
    G.phase = 'chest'
    play('jackpot')
    if (res.rolls.some((o) => o.kind === 'evolve')) play('evolve')
    return
  }
  G.phase = 'running'
}

export function buyMeta(k: MetaKey) {
  const lv = G.meta[k]
  if (lv >= META[k].max || G.shopBusy) return
  const c = metaCost(lv)
  if (G.bank < c) return
  if (save.online) {
    // the server owns the wallet's gold — wait for its answer
    G.shopBusy = true
    serverBuy(k)
      .then((p) => {
        applyProfile(p)
        play('coin')
      })
      .catch((e) => banner(`Purchase failed: ${String(e?.message ?? e)}`, 3))
      .finally(() => (G.shopBusy = false))
    return
  }
  G.bank -= c
  G.meta[k] = lv + 1
  play('coin')
}

export function returnToSanctuary() {
  const [x, y, z] = LAYOUT.lobbyReturn
  void movePlayerTo({ newRelativePosition: Vector3.create(x, y, z), cameraTarget: Vector3.create(16, 1.5, 8) })
  G.phase = 'idle'
  G.summary = null
}

export function playAgain() {
  G.summary = null
  G.phase = G.inArena ? 'start' : 'idle'
}

function endRun(killer?: string) {
  const r = G.run!
  const t = Math.floor(r.time)
  const newBest = t > G.best.t
  if (newBest) G.best = { t, l: r.level, k: r.kills }
  const keep = killer ? 0.7 : 1
  const gold = Math.floor(r.gold * keep)
  G.summary = { t, l: r.level, k: r.kills, gold, killer, pvpKills: G.pvpKills, newBest, saving: save.online }
  submitRun({ n: me().name, t, l: r.level, k: r.kills })
  if (save.online) {
    void serverEndRun({ time: r.time, level: r.level, kills: r.kills, gold: r.gold, pvpKills: G.pvpKills, killer }).then((res) => {
      if (res) {
        applyProfile(res.profile)
        if (G.summary) {
          G.summary.gold = res.granted
          G.summary.rank = res.rank
          G.summary.newBest = res.newBest
        }
      } else G.bank += gold
      if (G.summary) G.summary.saving = false
      void loadBoard()
    })
  } else G.bank += gold
  if (killer && G.lastAttackerId) sendKo(G.lastAttackerId, killer, r.level)
  G.phase = 'dead'
  G.run = null
  clearView()
  play('death')
}

// ───────────────────────── per-frame ─────────────────────────
let statusT = 0
let lastSpeed = 1

function handle(evs: Ev[]) {
  const r = G.run!
  for (const e of evs) {
    switch (e.t) {
      case 'hit':
        play('hit', 0.9 + Math.random() * 0.3)
        break
      case 'kill':
        play('kill', 0.9 + Math.random() * 0.25)
        if (e.kind === 'lich') banner('THE LICH KING HAS FALLEN!', 4)
        break
      case 'gem':
        play('gem', 1 + Math.min(0.5, (r.xp / r.need) * 0.5))
        break
      case 'coin':
        play('coin')
        break
      case 'heal':
        play('coin', 0.8)
        break
      case 'chest':
        G.chestQueue.push(e.big)
        break
      case 'levelup':
        play('levelup')
        break
      case 'hurt':
        play('hurt')
        G.hurtFlash = 0.25
        break
      case 'boss':
        play('boss')
        banner('THE LICH KING RISES!', 5)
        break
      case 'elite':
        banner('An ELITE GHOUL appears — it carries a chest!', 4)
        break
      case 'ring':
        banner('THE SWARM SURROUNDS YOU!', 3)
        break
      case 'pvpHit':
        sendHit(e.to, e.dmg)
        break
      case 'dead':
        endRun(e.killer ? nameOf(e.killer) : undefined)
        return
    }
  }
  if (G.phase === 'running' && (r.pendingLevels > 0 || G.chestQueue.length)) nextModal()
}

export function setupGame() {
  setupView()
  setupSfx()
  // load the wallet's saved progress (retries while the player identity / server wakes up)
  let tries = 0
  const tryLoad = () =>
    loadProfile(me().name).then((p) => {
      if (p) applyProfile(p)
      else if (++tries < 4) retryAt = 8 * tries
    })
  let retryAt = 2
  let loadT = 0
  engine.addSystem((dt) => {
    loadT += dt
    if (retryAt > 0 && loadT >= retryAt) {
      retryAt = 0
      loadT = 0
      void tryLoad()
    }
  })
  void loadBoard()
  setupNet({
    onHit: (dmg, fromId, fromName) => {
      if (!G.run || G.phase === 'dead') return
      G.lastAttackerId = fromId
      G.run.receivePvp(dmg, fromId)
      if (G.run.events.some((e) => e.t === 'hurt')) G.hurtFlash = 0.25
      if (!G.run.alive) endRun(fromName || nameOf(fromId))
    },
    onBounty: (victim, lvl) => {
      play('pvp')
      G.pvpKills++
      banner(`YOU SLEW ${victim.toUpperCase()}! +BOUNTY`, 4)
      if (G.run) {
        G.run.gainXp(20 + lvl * 8)
        G.run.gold += 10 * lvl
        G.run.pvpKills++
      } else G.bank += 10 * lvl
    }
  })

  engine.addSystem((dt) => {
    dt = Math.min(dt, 0.1)
    if (G.bannerT > 0) G.bannerT -= dt
    if (G.hurtFlash > 0) G.hurtFlash -= dt
    const pt = Transform.getOrNull(engine.PlayerEntity)
    if (!pt) return
    const px = pt.position.x
    const pz = pt.position.z
    const f = Vector3.rotate(Vector3.Forward(), pt.rotation)
    const yaw = (Math.atan2(f.x, f.z) * 180) / Math.PI
    const wasIn = G.inArena
    G.inArena = inArena(px, pz)

    if (G.phase === 'idle' && G.inArena) G.phase = 'start'
    if (G.phase === 'start' && !G.inArena) G.phase = 'idle'
    if (G.run && wasIn && !G.inArena && G.phase !== 'dead') banner('SANCTUARY — your run is paused', 3)

    const r = G.run
    if (r) {
      r.x = px
      r.z = pz
      r.yaw = yaw
      const frozen = G.phase !== 'running' || !G.inArena
      if (frozen) r.invuln = Math.max(r.invuln, 0.3)
      const targets = G.phase === 'running' ? attackable(true, G.inArena) : []
      const evs = r.step(dt, frozen, targets)
      renderRun(r, evs, dt)
      handle(evs)
      // swiftness passive → avatar speed
      const sp = G.run ? G.run.speedMul : 1
      if (sp !== lastSpeed) {
        lastSpeed = sp
        // NOTE: values are relative to Decentraland's default locomotion; tune after a first playtest
        AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, { walkSpeed: 1.5 * sp, jogSpeed: 8 * sp, runSpeed: 10 * sp })
      }
    } else if (lastSpeed !== 1) {
      lastSpeed = 1
      AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
    }

    statusT += dt
    if (statusT > 0.5) {
      statusT = 0
      const rr = G.run
      sendStatus({
        l: rr?.level ?? 0,
        hp: Math.round(rr?.hp ?? 0),
        mh: rr?.maxHp ?? 0,
        run: !!rr && G.phase !== 'dead',
        ar: G.inArena && !!rr,
        ob: rr?.orbitCount() ?? 0,
        oa: rr?.orbitAngle ?? 0,
        orr: rr?.orbitRadius() ?? 0,
        au: rr?.auraRadius() ?? 0,
        k: rr?.kills ?? 0
      })
    }
  })
}

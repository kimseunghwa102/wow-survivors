// Game controller: glues the simulation, rendering, sound, multiplayer and UI state together.
import { engine, Transform, AvatarLocomotionSettings, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import LAYOUT from '../../layout.json'
import { Run, Option, Ev, inArena } from './core'
import { WeaponId, WEAPONS, PASSIVES, ARMORY, NUKE_TIER, bossFor } from './defs'
import { renderRun, clearView, setupView, setAim, upgradeFx, rankOf, rankName } from './view'
import { play, setupSfx, musicLevel } from './sfx'
import { setupNet, sendStatus, sendHit, sendKo, attackable, submitRun, me, nameOf } from './net'
import { save, loadProfile, serverStartRun, serverEndRun, serverBuy, loadBoard, ServerProfile, serverArmoryBuy, serverClaimDaily } from './persist'

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
  pvpKills: 0,
  // armory + daily
  armory: 0,
  equip: -1, // -1 = best owned
  armoryOpen: false,
  armoryBusy: false,
  armoryMsg: '' as string,
  daily: null as null | { streak: number; claimable: boolean; next: number; doubleReady: boolean },
  dailyBusy: false,
  flash: 0, // white screen flash (nuke)
  aim: 0,
  nukeAsk: false,
  autoAttack: false, // auto-swing the armory weapon at the nearest foe
  doubleBonus: 0
}

export const equipped = () => Math.min(G.equip < 0 ? G.armory : G.equip, G.armory, NUKE_TIER - 1)

export function banner(text: string, sec = 3) {
  G.banner = text
  G.bannerT = sec
}

export function applyProfile(p: ServerProfile | null) {
  if (!p) return
  G.bank = p.bank
  G.meta = { ...p.meta }
  G.best = { t: p.best.time, l: p.best.level, k: p.best.kills }
  if (p.armory !== undefined) G.armory = Math.max(G.armory, p.armory)
  if (p.daily) G.daily = p.daily
}

export function buyArmory(tier: number) {
  if (G.armoryBusy) return
  if (tier <= G.armory) return
  if (tier !== G.armory + 1) {
    G.armoryMsg = `Unlock ${ARMORY[G.armory + 1].name} first (weapons unlock in order)`
    return
  }
  const cost = ARMORY[tier].cost
  if (G.bank < cost) {
    G.armoryMsg = `Not enough gold: need ● ${cost.toLocaleString()}, you have ● ${G.bank.toLocaleString()}`
    play('hurt', 1.6)
    return
  }
  const done = () => {
    G.equip = -1
    G.armoryMsg = `✓ ${ARMORY[tier].name} unlocked and equipped!`
    play('buy')
    banner(`${ARMORY[tier].name.toUpperCase()} UNLOCKED!`, 3)
  }
  if (save.online) {
    G.armoryBusy = true
    G.armoryMsg = 'Buying…'
    serverArmoryBuy(tier)
      .then((p) => {
        applyProfile(p)
        if ((p.armory ?? 0) >= tier) done()
        else G.armoryMsg = 'Purchase was not accepted — try again'
      })
      .catch((e) => (G.armoryMsg = `Purchase failed: ${String(e?.message ?? e)}`))
      .finally(() => (G.armoryBusy = false))
    return
  }
  G.bank -= cost
  G.armory = tier
  done()
}

export function toggleAuto() {
  G.autoAttack = !G.autoAttack
  play('click')
  banner(G.autoAttack ? 'AUTO ATTACK ON' : 'AUTO ATTACK OFF', 1.5)
}

export function claimDaily() {
  if (G.dailyBusy || !G.daily?.claimable || !save.online) return
  G.dailyBusy = true
  serverClaimDaily(me().name)
    .then(({ reward, profile }) => {
      applyProfile(profile)
      play('buy')
      banner(`DAILY REWARD +${reward} GOLD · ${profile.daily?.streak ?? 1}-DAY STREAK`, 4)
    })
    .catch((e) => banner(`${String(e?.message ?? e)}`, 3))
    .finally(() => (G.dailyBusy = false))
}

export function startRun(w: WeaponId) {
  void serverStartRun(w, me().name)
  G.run = new Run(w, { ...G.meta }, G.armory, equipped())
  G.doubleBonus = 0
  G.armoryOpen = false
  G.pvpKills = 0
  G.phase = 'running'
  G.lastAttackerId = ''
  banner(`HOLD THE RIFT! ${WEAPONS[w].name} equipped`, 3)
  musicLevel(0.16)
}

export function choose(o: Option) {
  const r = G.run
  if (!r || G.phase !== 'levelup') return
  r.apply(o)
  showUpgrade(o)
  if (o.kind === 'weapon' && o.to === 8) banner(`${WEAPONS[o.id].name} MAXED — open a vault to ascend it!`, 4)
  r.pendingLevels = Math.max(0, r.pendingLevels - 1)
  nextModal()
}

/** instant visual + audio payoff for every pick */
export function showUpgrade(o: Option) {
  const r = G.run
  if (!r) return
  if (o.kind === 'weapon') {
    const w = WEAPONS[o.id]
    const tierUp = o.to === 4 || o.to === 7
    upgradeFx(r, 'weapon', o.id, `${w.name.toUpperCase()}  Lv${o.to}${tierUp ? '  ✦ NEW FORM' : ''}`, w.color)
    play(tierUp ? 'evolve' : 'buy', tierUp ? 1.3 : 1.15)
  } else if (o.kind === 'passive') {
    const p = PASSIVES[o.id]
    upgradeFx(r, 'passive', o.id, `${p.name.toUpperCase()}  Lv${o.to}`, p.color)
    play('buy', 1.25)
  } else if (o.kind === 'evolve') {
    const w = WEAPONS[o.id]
    upgradeFx(r, 'evolve', o.id, `✦ ${w.evo.toUpperCase()} ✦`, '#FFFFFF')
    play('evolve')
  } else if (o.kind === 'boost') upgradeFx(r, 'passive', 'boost', 'RIFT BOOST', '#FFD86A')
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
  const best = G.chest?.rolls.find((o) => o.kind === 'evolve') ?? G.chest?.rolls.find((o) => o.kind === 'weapon' || o.kind === 'passive')
  if (best) showUpgrade(best)
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
  musicLevel(0.28)
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
          G.doubleBonus = res.bonus ?? 0
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
      case 'levelup': {
        play('levelup')
        const rk = rankOf(r.level)
        if (rk >= 0 && rk !== rankOf(r.level - 1)) {
          banner(`RANK UP — ${rankName(rk)} AURA (Lv ${r.level})`, 4)
          play('evolve', 0.9)
        }
        break
      }
      case 'hurt':
        play('hurt')
        G.hurtFlash = 0.25
        break
      case 'slash':
        play('slash', 0.9 + Math.random() * 0.2)
        break
      case 'shoot':
        play('shard', 0.92 + Math.random() * 0.16)
        break
      case 'strike':
        play('sigil', 0.85 + Math.random() * 0.3)
        break
      case 'nova':
        play('pulse', 0.95 + Math.random() * 0.1)
        break
      case 'swing':
        play((['punch', 'bonk', 'smash', 'flameslash', 'reaper'] as const)[Math.min(4, e.tier)], 0.92 + Math.random() * 0.16)
        break
      case 'tracer':
        play('gun', 0.9 + Math.random() * 0.2)
        break
      case 'quake':
        play('slam', 1.5)
        break
      case 'nukeLaunch':
        play('nukelaunch')
        banner('☢ DOOMSDAY INBOUND ☢', 2)
        break
      case 'nuke':
        play('nuke')
        G.flash = 0.6
        break
      case 'bossSpawn': {
        const b = bossFor(e.boss)
        play('roar')
        play('boss')
        banner(`${b.name.toUpperCase()} — ${b.title}`, 5)
        break
      }
      case 'bossDown': {
        const b = bossFor(e.boss)
        play('evolve')
        banner(`${b.name.toUpperCase()} HAS FALLEN!`, 4)
        break
      }
      case 'slamWarn':
        play('warn')
        break
      case 'slam':
        play('slam')
        break
      case 'elite':
        play('elite')
        banner('A BRUTE appears — it carries a vault!', 4)
        break
      case 'ring':
        play('ring')
        banner('THE NIGHTSWARM CLOSES IN!', 3)
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
    if (G.flash > 0) G.flash -= dt
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
      if (!frozen && r.alive) {
        // aim where the camera looks (third person) — fall back to the avatar's facing
        const ct = Transform.getOrNull(engine.CameraEntity)
        let aim = yaw
        if (ct) {
          const cf = Vector3.rotate(Vector3.Forward(), ct.rotation)
          if (Math.abs(cf.x) + Math.abs(cf.z) > 0.05) aim = (Math.atan2(cf.x, cf.z) * 180) / Math.PI
        }
        G.aim = aim
        setAim(aim)
        if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) toggleAuto()
        if (G.autoAttack) {
          // aim at the nearest foe within reach of the equipped weapon
          const w = ARMORY[r.equip]
          const reach = w.gun ? w.range : w.range * r.area + 2
          let best = reach
          let ay = -999
          for (const e of r.enemies) {
            if (!e.alive) continue
            const d = Math.hypot(e.x - r.x, e.z - r.z) - e.r
            if (d < best) {
              best = d
              ay = (Math.atan2(e.x - r.x, e.z - r.z) * 180) / Math.PI
            }
          }
          if (ay > -999) {
            setAim(ay)
            r.manualAttack(ay, targets)
          }
        } else if (inputSystem.isPressed(InputAction.IA_POINTER)) r.manualAttack(aim, targets)
        if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN) || G.nukeAsk) r.nuke(aim)
      }
      G.nukeAsk = false
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

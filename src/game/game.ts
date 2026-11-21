// Game controller: glues the simulation, rendering, sound, multiplayer and UI state together.
import { engine, Transform, AvatarLocomotionSettings, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import LAYOUT from '../../layout.json'
import { Run, Option, Ev, inArena } from './core'
import type { Entity } from '@dcl/sdk/ecs'
import { WeaponId, WEAPONS, PASSIVES, ARMORY, NUKE_TIER, GOD_TIER, isHoldable, bossFor, GOLD_PACKS, GODS, MAX_GOD_LVL } from './defs'
import { renderRun, clearView, setupView, setAim, upgradeFx, rankOf, rankName, setGodForm, queueRemoteFx, fxTiers, haloTiersOf } from './view'
import { encodeFx, decodeFx } from './fxnet'
import { ARENA_EVENTS, VaultPrize, VAULT_PRIZES, POTION_DEFS, PotionKind } from './core'
import { attachCosmetic } from './cosmetics'
import { play, setupSfx, musicLevel } from './sfx'
import { setupNet, sendStatus, sendHit, sendKo, attackable, submitRun, me, nameOf, sendFx, pushFeed } from './net'
import { serverQuests, serverClaimQuest, QuestState, serverBuyPotion } from './persist'
import { save, loadProfile, serverStartRun, serverEndRun, serverBuy, loadBoard, ServerProfile, serverArmoryBuy, serverClaimDaily, shopConfig, shopQuote, shopConfirm, serverSaveRun, serverAbandon, pingServer } from './persist'
import { getUserAccount, sendAsync, requirePayment } from '~system/EthereumController'
import { getPlayer } from '@dcl/sdk/players'

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
  chest: null as null | { rolls: Option[]; gold: number; spin: number; big: boolean; prize?: VaultPrize },
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
  infoOpen: false, // upgrades overview panel (key 1)
  goldShopOpen: false,
  goldShop: { enabled: false, gold: 10000, usd: 10 },
  packSel: 1,
  firstPurchase: true,
  payBusy: false,
  payMsg: '' as string,
  buyConfirmT: 0,
  doubleBonus: 0,
  goldPulse: 0, // bank counter flash when gold comes in
  lastBank: -1,
  /** run gold the server already banked live (checkpoints) */
  runBanked: 0,
  // kill combo + arena events
  comboFlash: 0,
  comboName: '',
  // quests / rankings / slayer
  quests: null as QuestState | null,
  questOpen: false,
  questBusy: false,
  boardOpen: false,
  boardTab: 'weekly' as 'weekly' | 'allTime' | 'slayers',
  slayerReveal: 0,
  // potion belt in the lobby (server-owned) + run feel
  profileBelt: { hp: 0, rage: 0, phoenix: 0 },
  potionOpen: false,
  heartbeat: 0
}

export const equipped = () => {
  const t = Math.min(G.equip < 0 ? G.armory : G.equip, G.armory)
  return isHoldable(t) ? t : t - 1
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
  if (p.armory !== undefined) G.armory = Math.max(G.armory, p.armory)
  if (p.daily) G.daily = p.daily
  if (p.firstPurchase !== undefined) G.firstPurchase = p.firstPurchase
  if (p.belt) G.profileBelt = { ...p.belt }
  wearMine()
}

// raid relic on my own avatar
let myCos: string | null = null
let myCosEnt: Entity | undefined
let seraphEnt: Entity | undefined
function wearMine() {
  if (save.inv.cosmetic === myCos) return
  myCos = save.inv.cosmetic
  myCosEnt = attachCosmetic(undefined, myCos, myCosEnt)
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
    if (tier === GOD_TIER) {
      banner('✦ YOU HAVE ASCENDED — YOU ARE A GOD ✦', 6)
      play('evolve')
    }
    if (G.run) {
      // new weapons work immediately, even mid-run
      G.run.armory = G.armory
      G.run.equip = equipped()
    }
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

// ───────── GOLD SHOP: 10,000 gold for $10, paid in ETH or MANA straight to the owner's wallet ─────────
const MANA_TOKEN = '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'

/** decimal string → hex (no BigInt needed in the scene runtime) */
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

export function openGoldShop() {
  G.goldShopOpen = true
  G.payMsg = ''
  shopConfig()
    .then((c) => (G.goldShop = { enabled: c.enabled, gold: c.gold, usd: c.usd }))
    .catch(() => (G.goldShop.enabled = false))
}

export async function buyGold(currency: 'ETH' | 'MANA') {
  if (G.payBusy) return
  if (!save.online) return void (G.payMsg = 'Save server offline — try again in a moment')
  G.payBusy = true
  try {
    // wallet address: the player identity is reliable in every explorer; getUserAccount is a fallback
    const pl = getPlayer()
    let from = pl && !pl.isGuest && /^0x[0-9a-fA-F]{40}$/.test(pl.userId) ? pl.userId : ''
    if (!from) {
      try {
        from = (await getUserAccount({})).address ?? ''
      } catch {}
    }
    if (!from) throw new Error(pl?.isGuest ? 'you are logged in as a guest — log in with a wallet to buy gold' : 'could not read your wallet address')
    G.payMsg = 'Getting a price quote…'
    const q = await shopQuote(currency, me().name, GOLD_PACKS[G.packSel].id)
    const amountHex = '0x' + decToHex(q.amountWei)
    const tx =
      currency === 'ETH'
        ? { from, to: q.to, value: amountHex }
        : { from, to: MANA_TOKEN, value: '0x0', data: '0xa9059cbb' + pad64(q.to) + pad64(amountHex) }
    G.payMsg = `Confirm ${q.amount} ${currency} in your wallet…`
    const pickHash = (raw: string) => {
      const m = /0x[0-9a-fA-F]{64}/.exec(raw ?? '')
      return m ? m[0] : ''
    }
    let hash = ''
    let why = ''
    try {
      const res = await sendAsync({ id: Date.now() % 1e9, method: 'eth_sendTransaction', jsonParams: JSON.stringify([tx]) })
      hash = pickHash(res.jsonAnyResponse)
      if (!hash) why = res.jsonAnyResponse
    } catch (e: any) {
      why = String(e?.message ?? e)
    }
    if (!hash) {
      // fallback: the explorer's built-in payment prompt
      try {
        const res = await requirePayment({ toAddress: q.to, amount: q.amount, currency })
        hash = pickHash(res.jsonAnyResponse)
        if (!hash) why = res.jsonAnyResponse || why
      } catch (e: any) {
        why = String(e?.message ?? e) || why
      }
    }
    if (!hash && /denied|reject|cancel/i.test(why)) throw new Error('payment cancelled in the wallet')
    if (!hash && why) throw new Error(why.slice(0, 120))
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error('no transaction was sent')
    G.payMsg = 'Payment sent — waiting for the blockchain (usually under a minute)…'
    // poll until mined (the server also settles it on your next login if you leave)
    for (let i = 0; i < 90; i++) {
      const r = await shopConfirm(q.id, hash)
      if (r.ok) {
        if (r.profile) applyProfile(r.profile)
        G.firstPurchase = false
        G.payMsg = `✓ +${(r.gold ?? q.gold).toLocaleString()} gold added. Thank you!`
        play('buy')
        banner(`+${(r.gold ?? q.gold).toLocaleString()} GOLD!`, 4)
        return
      }
      await new Promise<void>((done) => {
        let t = 0
        const sys = (dt: number) => {
          t += dt
          if (t >= 10) {
            engine.removeSystem(sys)
            done()
          }
        }
        engine.addSystem(sys)
      })
    }
    G.payMsg = 'Still not confirmed — your gold will be added automatically next time you visit.'
  } catch (e: any) {
    G.payMsg = `Payment not completed: ${String(e?.message ?? e).slice(0, 90)}`
  } finally {
    G.payBusy = false
  }
}

export function equipWeapon(i: number) {
  if (i > G.armory || !isHoldable(i)) return
  G.equip = i
  if (G.run) G.run.equip = equipped()
  play('click')
  G.armoryMsg = `In hand: ${ARMORY[i].name}`
}

/** key 2: cycle through owned weapons */
export function cycleWeapon() {
  const owned = ARMORY.map((_, i) => i).filter((i) => i <= G.armory && isHoldable(i))
  if (owned.length <= 1) return banner('Unlock more weapons in the Armory (key 1)', 2)
  const next = owned[(owned.indexOf(equipped()) + 1) % owned.length]
  equipWeapon(next)
  banner(`IN HAND: ${ARMORY[next].name.toUpperCase()}`, 1.5)
}

/** key 3: buy the next armory weapon (press twice to confirm) */
export function buyNextHotkey() {
  const next = G.armory + 1
  if (next >= ARMORY.length) return banner('Armory complete!', 2)
  G.infoOpen = true
  if (G.buyConfirmT > 0) {
    G.buyConfirmT = 0
    buyArmory(next)
    return
  }
  G.buyConfirmT = 2.5
  G.armoryMsg = `Press 3 again to buy ${ARMORY[next].name} for ● ${ARMORY[next].cost.toLocaleString()}`
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

/** continue the run the player left (skills, level, gold all intact) */
export function resumeRun() {
  const s = save.resume
  if (!s) return
  save.resume = null
  save.runId = s.runId
  G.run = Run.restore(s.snap, { ...G.meta }, G.armory, equipped())
  G.runBanked = s.snap.gold
  G.doubleBonus = 0
  G.armoryOpen = false
  G.pvpKills = s.snap.pvpKills ?? 0
  G.phase = 'running'
  G.summary = null
  play('levelup')
  banner(`RUN RESUMED — Lv ${s.snap.level} · ● ${s.snap.gold.toLocaleString()} gold carried`, 4)
}

export function startRun(w: WeaponId) {
  const left = save.resume
  save.resume = null
  // a saved run that is not resumed gets banked by the server when the new run starts
  void serverStartRun(w, me().name).then((belt) => {
    // the lobby belt is packed into this run
    if (belt && G.run && (belt.hp || belt.rage || belt.phoenix)) {
      G.run.potions.hp = Math.min(9, G.run.potions.hp + belt.hp)
      G.run.potions.rage = Math.min(5, G.run.potions.rage + belt.rage)
      G.run.potions.phoenix = Math.min(1, G.run.potions.phoenix + belt.phoenix)
      banner(`Belt packed: ${belt.hp} Blood · ${belt.rage} Rage · ${belt.phoenix} Phoenix`, 3)
    }
    if (G.profileBelt) G.profileBelt = { hp: 0, rage: 0, phoenix: 0 }
    if (!left) return
    void loadProfile(me().name).then((p) => {
      applyProfile(p)
      banner(`Your saved run was banked: +${left.snap.gold.toLocaleString()} gold`, 4)
    })
  })
  G.run = new Run(w, { ...G.meta }, G.armory, equipped())
  G.runBanked = 0
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
  else if (o.kind === 'god') {
    const g = GODS[o.id]
    upgradeFx(r, 'evolve', o.id, `✦ ${g.name.toUpperCase()}  ${o.to >= MAX_GOD_LVL ? 'MAX' : 'Lv' + o.to} ✦`, g.color)
    play('evolve', 0.8)
    play('roar', 1.2)
    if (o.id === 'wings' && o.to === 1) banner('SERAPH WINGS — you can FLY now: jump, double-jump, glide!', 5)
  }
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

/** live checkpoint: banks gold + updates the live rankings */
function checkpoint() {
  const r = G.run
  if (!r) return
  void serverSaveRun(r.snapshot()).then((res) => {
    if (!res) return
    G.runBanked += res.banked ?? 0
    if (res.inv) save.inv = res.inv
    if (res.profile) applyProfile(res.profile)
    if (res.slayer) slayerReveal()
  })
}

/** the NIGHTSWARM reward lands (once per wallet) */
function slayerReveal() {
  G.slayerReveal = 9
  G.flash = 0.7
  play('evolve')
  play('jackpot')
  banner('✦ NIGHTSWARM SLAYER ✦  +100,000 GOLD · VOID WINGS', 7)
}

export async function refreshQuests() {
  const q = await serverQuests()
  if (q) G.quests = q
}
export function claimQuest(i: number) {
  if (G.questBusy) return
  G.questBusy = true
  void serverClaimQuest(i)
    .then((r) => {
      G.quests = r
      if (r.profile) applyProfile(r.profile)
      play('jackpot')
      banner(`QUEST COMPLETE  +${r.reward.toLocaleString()} GOLD`, 3)
    })
    .catch((e) => banner(String(e?.message ?? e), 3))
    .finally(() => (G.questBusy = false))
}
export function openQuests() {
  G.questOpen = !G.questOpen
  if (G.questOpen) void refreshQuests()
}
export function openBoard() {
  G.boardOpen = !G.boardOpen
  if (G.boardOpen) void loadBoard()
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
    G.chest = { ...res, spin: big ? 3.2 : 2.2, big }
    G.phase = 'chest'
    play('jackpot')
    if (res.rolls.some((o) => o.kind === 'evolve')) play('evolve')
    return
  }
  G.phase = 'running'
}

export function buyPotion(id: PotionKind) {
  if (G.shopBusy) return
  const d = POTION_DEFS[id]
  if (G.profileBelt[id] >= d.shopMax) return banner(`${d.name}: belt is full`, 2)
  if (G.bank < d.shop) return banner('Not enough gold', 2)
  if (!save.online) return banner('Connect to the save server to buy potions', 3)
  G.shopBusy = true
  serverBuyPotion(id)
    .then((p) => {
      applyProfile(p)
      play('coin')
    })
    .catch((e) => banner(`Purchase failed: ${String(e?.message ?? e)}`, 3))
    .finally(() => (G.shopBusy = false))
}
export function drinkPotion(k: 'hp' | 'rage') {
  const r = G.run
  if (!r || G.phase !== 'running') return
  if (!r.drink(k)) {
    if (r.potions[k] <= 0) banner(k === 'hp' ? 'No Blood Potions left!' : 'No Rage Elixirs left!', 1.5)
  }
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
  const banked = G.runBanked
  if (save.online) {
    void serverEndRun({ time: r.time, level: r.level, kills: r.kills, gold: r.gold, pvpKills: G.pvpKills, killer, bossesSlain: r.bossesSlain }).then((res) => {
      if (res) {
        if (res.inv) save.inv = res.inv
        applyProfile(res.profile)
        if (res.slayer) slayerReveal()
        if (G.summary) {
          G.summary.gold = res.granted
          G.doubleBonus = res.bonus ?? 0
          G.summary.rank = res.rank
          G.summary.newBest = res.newBest
        }
      } else G.bank += Math.max(0, gold - banked)
      if (G.summary) G.summary.saving = false
      void loadBoard()
    })
  } else G.bank += Math.max(0, gold - banked)
  G.runBanked = 0
  void refreshQuests()
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
      case 'zeus':
        play('sigil', 0.75 + Math.random() * 0.2)
        break
      case 'divine':
        play('pulse', 0.6)
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
        const prev = e.boss > 0 ? bossFor(e.boss - 1) : null
        play('roar')
        play('boss')
        // twins: one banner for the pair
        if (b.twin) banner(`⚔ TWIN BOSSES ⚔  ${b.name.toUpperCase()} & ${bossFor(e.boss + 1).name.toUpperCase()}`, 5)
        else if (!prev?.twin || prev.lvl !== b.lvl) banner(`${b.name.toUpperCase()} — ${b.title}`, 5)
        break
      }
      case 'bossDown': {
        const b = bossFor(e.boss)
        play('evolve')
        banner(G.run && G.run.bossesAlive().length ? `${b.name.toUpperCase()} HAS FALLEN! ONE MORE…` : `${b.name.toUpperCase()} HAS FALLEN!`, 4)
        break
      }
      case 'slamWarn':
        play('warn')
        break
      case 'slam':
        play('slam')
        break
      case 'elite':
        if (r.arena?.kind === 'elitehunt') break
        play('elite')
        banner('A BRUTE appears — it carries a vault!', 4)
        break
      case 'potion':
        if (e.kind === 'hp') {
          play('levelup', 1.3)
          play('buy', 0.7)
        } else {
          play('roar', 1.5)
          play('evolve', 1.4)
          G.flash = 0.35
          banner('RAGE! damage ×1.6 · 12s', 2)
        }
        break
      case 'potionGet':
        play('gem', 0.6)
        break
      case 'rageEnd':
        banner('rage wears off…', 1.2)
        break
      case 'revive':
        G.flash = 0.9
        play('evolve')
        play('nuke', 1.3)
        banner('✦ PHOENIX TEAR ✦  you cheated death!', 4)
        break
      case 'awaken':
        G.flash = 0.6
        play('evolve')
        play('boss')
        banner('✦ DIVINE AWAKENING ✦  GOD POWERS unlocked — every level-up now offers one', 6)
        break
      case 'kame':
        play('nukelaunch', 1.4)
        break
      case 'gnuke':
        play('nuke', 1.2)
        G.flash = Math.max(G.flash, 0.25)
        break
      case 'hole':
        play('roar', 0.6)
        break
      case 'gsword':
        play('slam', 1.5)
        break
      case 'bbeamWarn':
        play('warn')
        break
      case 'bbeam':
        play('nukelaunch', 0.8)
        break
      case 'combo':
        G.comboName = e.name
        G.comboFlash = 1.6
        play('evolve', 1 + Math.min(0.4, e.n / 2000))
        play('roar', 1.4)
        break
      case 'comboBreak':
        G.comboName = `COMBO BROKEN · ${e.n}`
        G.comboFlash = 1.0
        break
      case 'arena': {
        const d = ARENA_EVENTS[e.kind]
        if (e.on) {
          play('boss')
          banner(`${d.name}!  ${d.desc}`, 5)
          musicLevel(0.22)
        } else {
          banner(`${d.name} is over`, 2.5)
          musicLevel(0.16)
        }
        break
      }
      case 'charge':
        play('warn', 0.8)
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
      if (p) {
        applyProfile(p)
        void refreshQuests()
        // a run that started while the server was still waking up: register it now so it gets saved
        if (G.run && !save.runId && G.phase !== 'dead') void serverStartRun([...G.run.weapons.keys()][0], me().name)
        if (save.resume && !G.run) banner(`Your run is saved (Lv ${save.resume.snap.level}) — enter the rift to RESUME`, 6)
      } else {
        // free-tier server can take ~1 min to wake up: keep trying, never give up
        retryAt = Math.min(20, 5 + ++tries * 3)
        void pingServer()
      }
    })
  void pingServer()
  let retryAt = 2
  let loadT = 0
  let ckT = 0
  let pingT = 0
  engine.addSystem((dt) => {
    loadT += dt
    // live checkpoint every 10s → gold is banked and rankings update while you play
    ckT += dt
    if (G.run && G.phase !== 'dead' && G.run.alive && ckT > 10) {
      ckT = 0
      checkpoint()
    }
    // keep the free-tier save server awake while someone is here
    pingT += dt
    if (pingT > 240) {
      pingT = 0
      void pingServer()
    }
    // bank counter flash
    if (G.bank > G.lastBank && G.lastBank >= 0) G.goldPulse = 0.8
    G.lastBank = G.bank
    if (G.goldPulse > 0) G.goldPulse = Math.max(0, G.goldPulse - dt)
    if (retryAt > 0 && loadT >= retryAt) {
      retryAt = 0
      loadT = 0
      void tryLoad()
    }
  })
  void loadBoard()
  setupNet({
    onFx: (fromId, tiers, packets) => {
      const evs: Ev[] = []
      const t = tiers.map((v) => Math.max(0, Math.min(3, Math.round(v || 0))))
      for (const p of packets) {
        const e = decodeFx(p)
        if (!e) continue
        if (e.t === 'bossSpawn') {
          pushFeed(`${nameOf(fromId)} summoned ${bossFor(e.boss).name}!`, bossFor(e.boss).color)
          continue
        }
        if (e.t === 'bossDown') {
          pushFeed(`${nameOf(fromId)} slew ${bossFor(e.boss).name}!`, '#FFD86A')
          continue
        }
        if (e.t === 'nuke') play('nuke', 0.9)
        else if (e.t === 'divine') play('pulse', 0.55)
        else if (e.t === 'zeus') play('sigil', 0.7)
        evs.push(e)
      }
      if (evs.length) queueRemoteFx(evs, t)
    },
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

  // hotkeys that work anywhere (lobby or mid-run): 1 = upgrades panel, 2 = switch weapon, 3 = buy next weapon
  engine.addSystem((dt) => {
    if (G.buyConfirmT > 0) G.buyConfirmT -= dt
    // Divine Ascension in hand → the player takes divine form (lobby and runs)
    setGodForm(equipped() === GOD_TIER)
    const k1 = inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)
    if (k1 && !G.goldShopOpen) {
      G.infoOpen = !G.infoOpen
      play('click')
    }
    const k2 = inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)
    const k3 = inputSystem.isTriggered(InputAction.IA_ACTION_5, PointerEventType.PET_DOWN)
    if (inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)) {
      if (G.run && G.phase === 'running' && !G.goldShopOpen) drinkPotion('rage')
      else if (G.goldShopOpen) G.goldShopOpen = false
      else openGoldShop()
      play('click')
    }
    if (G.goldShopOpen) {
      // while the gold shop is open: 1 = next pack, 2 = pay with ETH, 3 = pay with MANA
      if (k1) G.packSel = (G.packSel + 1) % GOLD_PACKS.length
      if (k2) void buyGold('ETH')
      if (k3) void buyGold('MANA')
    } else if (G.run && G.phase === 'running') {
      // mid-run: 3 = Blood Potion, 4 = Rage Elixir
      if (k2) cycleWeapon()
      if (k3) drinkPotion('hp')
    } else {
      if (k2) cycleWeapon()
      if (k3) buyNextHotkey()
    }
  })

  engine.addSystem((dt) => {
    dt = Math.min(dt, 0.1)
    if (G.bannerT > 0) G.bannerT -= dt
    if (G.comboFlash > 0) G.comboFlash -= dt
    if (G.slayerReveal > 0) G.slayerReveal -= dt
    // low HP: heartbeat
    if (G.run && G.run.alive && G.phase === 'running' && G.run.hp < G.run.maxHp * 0.3) {
      G.heartbeat -= dt
      if (G.heartbeat <= 0) {
        G.heartbeat = G.run.hp < G.run.maxHp * 0.15 ? 0.45 : 0.75
        play('pulse', 0.55)
      }
    }
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
    if (G.run && wasIn && !G.inArena && G.phase !== 'dead') {
      banner('SANCTUARY — your run is paused & saved', 3)
      checkpoint()
    }

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
      // share my skill effects so other hunters see the magic
      if (G.inArena && G.phase !== 'dead' && evs.length) {
        const tiers = fxTiers(r)
        for (const e of evs) {
          const p = encodeFx(e, r.x, r.z)
          if (p) sendFx(p[0], p[1], tiers)
        }
      }
    } else {
      // no run of my own: still draw other players' effects
      renderRun(null, [], dt)
    }
    // golden wings on my back while Seraph Wings is active
    {
      const want = !!G.run && G.run.alive && G.run.g('wings') > 0
      if (want && !seraphEnt) seraphEnt = attachCosmetic(undefined, 'seraph_wings')
      else if (!want && seraphEnt) {
        engine.removeEntity(seraphEnt)
        seraphEnt = undefined
      }
    }
    // swiftness passive → avatar speed; divine form → god flight (huge jumps, double jump, gliding)
    {
      const sp = G.run ? G.run.speedMul : 1
      // divine form OR the Seraph Wings god power → flight
      const god = equipped() === GOD_TIER || (!!G.run && G.run.g('wings') > 0)
      const key = god ? sp + 100 : sp
      if (key !== lastSpeed) {
        lastSpeed = key
        if (!god && sp === 1) AvatarLocomotionSettings.deleteFrom(engine.PlayerEntity)
        else
          AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
            walkSpeed: 1.5 * sp,
            jogSpeed: (god ? 10 : 8) * sp,
            runSpeed: (god ? 14 : 10) * sp,
            ...(god ? { jumpHeight: 6, runJumpHeight: 7, doubleJumpHeight: 6, glidingSpeed: 9, glidingFallingSpeed: 1.2, hardLandingCooldown: 0 } : {})
          })
      }
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
        k: rr?.kills ?? 0,
        gd: equipped() === GOD_TIER,
        ...(rr ? haloTiersOf(rr) : { tb: 0, ta: 0 }),
        cs: save.inv.cosmetic,
        ti: save.inv.title
      })
    }
  })
}

import { PetVis } from './petview'
import { decodePet } from './defs'
// Multiplayer: other players' status, PvP hits, kill bounties and the shared leaderboard.
import {
  engine, Entity, Schemas, Transform, PlayerIdentityData, MeshRenderer, Material, MaterialTransparencyMode,
  TextShape, Billboard, BillboardMode, Font, TextAlignMode, GltfContainer, AvatarAttach, AvatarAnchorPointType
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { executeTask } from '@dcl/sdk/ecs'
import { signedFetch } from '~system/SignedFetch'
import { API_URL } from '../config'
import { attachCosmetic, titleOf, anchorOf, detach } from './cosmetics'
import { ARMORY, PASSIVES, PassiveId, MAX_PASSIVE_LVL } from './defs'
import { rankOf, rankColor } from './view'
import { syncEntity } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { Remote, inPvpZone } from './core'

const bus = new MessageBus()

// ───────────── transport: our own relay (reliable) + Decentraland's MessageBus (backup) ─────────────
// Every message goes out on both; a per-sender sequence number drops the second copy on arrival.
type Handler = (d: any) => void
const handlers = new Map<string, Handler>()
let seq = 1
const seen = new Map<string, number[]>()
/** wallet addresses compare in lower case (the relay, the explorer and getPlayer may differ in case) */
const low = (s: unknown) => String(s ?? '').toLowerCase()
function senderOf(k: string, d: any) {
  return low(k === 'hit' ? d.from : k === 'ko' ? d.victim : d.id)
}
function deliver(k: string, d: any) {
  if (!d || typeof d !== 'object') return
  const from = senderOf(k, d)
  if (d.q != null) {
    const key = k + ':' + from
    const list = seen.get(key) ?? []
    if (list.includes(d.q)) return
    list.push(d.q)
    if (list.length > 40) list.shift()
    seen.set(key, list)
  }
  handlers.get(k)?.(d)
}
function on(k: string, fn: Handler) {
  handlers.set(k, fn)
  bus.on(k, (d: any) => {
    heardCount.p2p++
    deliver(k, d)
  })
}
function emit(k: string, d: Record<string, unknown>) {
  const msg = { ...d, q: seq++ }
  if (relayUp && relay) {
    try {
      relay.send(JSON.stringify({ k, d: msg }))
    } catch {
      relayUp = false
    }
  }
  bus.emit(k, msg)
}
let relay: WebSocket | null = null
let relayUp = false
let relayTry = 0
/** connected to the arena relay right now (shown in the debug line) */
export function relayOnline() {
  return relayUp
}
/** what the link is doing, for the HUD: 'live', 'connecting', or the last error */
export let relayState = 'connecting'
/** messages heard from other hunters in the last few seconds, per link */
export const heardCount = { relay: 0, p2p: 0 }
function connectRelay() {
  executeTask(async () => {
    try {
      relayState = 'connecting'
      const res = await signedFetch({ url: API_URL + '/api/arena/ticket', init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' } })
      let j: any = {}
      try {
        j = JSON.parse(res.body || '{}')
      } catch {}
      if (!j.ticket) {
        relayState = `ticket refused (${res.status}${j.error ? ' ' + String(j.error).slice(0, 40) : ''})`
        throw new Error(relayState)
      }
      const ws = new WebSocket(API_URL.replace(/^http/, 'ws') + '/arena?t=' + j.ticket)
      relay = ws
      ws.onopen = () => {
        relayUp = true
        relayTry = 0
        relayState = 'live'
      }
      ws.onmessage = (ev) => {
        try {
          heardCount.relay++
          const m = JSON.parse(String(ev.data))
          if (m && typeof m.k === 'string') deliver(m.k, m.d)
        } catch {}
      }
      ws.onclose = () => {
        if (relay !== ws) return
        relayUp = false
        relayState = 'link dropped, retrying'
        relay = null
        retryRelay()
      }
      ws.onerror = () => {}
    } catch (e) {
      if (relayState === 'connecting') relayState = 'server unreachable, retrying'
      retryRelay()
    }
  })
}
function retryRelay() {
  relayTry++
  const wait = Math.min(30, 3 * relayTry)
  let t = 0
  const sys = (dt: number) => {
    t += dt
    if (t < wait) return
    engine.removeSystem(sys)
    connectRelay()
  }
  engine.addSystem(sys)
}
/** the explorer's own spelling of each address (avatar attachments need it exactly) */
const realId = new Map<string, string>()
const avatarOf = (id: string) => realId.get(id) ?? id

export type Status = {
  id: string
  n: string
  l: number
  hp: number
  mh: number
  run: boolean
  ar: boolean
  ob: number
  oa: number
  orr: number
  au: number
  k: number
  gd?: boolean
  tb?: number // orbit blade skill tier
  ta?: number // aura skill tier
  cs?: string | null // raid relic worn
  ti?: string | null // raid title
  w?: number // armory weapon in hand during a run (-1 none)
  sw?: boolean // Seraph Wings god power active
  wc?: number // spirit wisps
  wt?: number // wisp tier
  ps?: number[] // passives: index*10 + level
  pt?: string // their pet (defs.encodePet)
}
type RemoteInfo = Status & { seen: number; x: number; z: number; y?: number; fx?: number; fz?: number; entity?: Entity }

export const remotes = new Map<string, RemoteInfo>()
const remotePets = new Map<string, PetVis>()
export const feed: { text: string; color: string; t: number }[] = []
let now = 0

export function me() {
  const p = getPlayer()
  return { id: low(p?.userId ?? 'local'), name: p?.name || `Hunter${(p?.userId ?? '0000').slice(-4)}` }
}

export function pushFeed(text: string, color = '#FFFFFF') {
  feed.push({ text, color, t: now })
  if (feed.length > 6) feed.shift()
}

// ───────────── shared leaderboard (synced to everyone in the scene) ─────────────
export const Board = engine.defineComponent('wowsv::board', { runs: Schemas.String, pvp: Schemas.String })
let boardEntity: Entity
export type RunScore = { n: string; t: number; l: number; k: number }

export function topRuns(): RunScore[] {
  try {
    return JSON.parse(Board.get(boardEntity).runs || '[]')
  } catch {
    return []
  }
}
export function topPvp(): [string, number][] {
  try {
    const m = JSON.parse(Board.get(boardEntity).pvp || '{}') as Record<string, number>
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5)
  } catch {
    return []
  }
}
export function submitRun(s: RunScore) {
  const list = topRuns().filter((r) => r.n !== s.n || r.t > s.t)
  if (!list.some((r) => r.n === s.n)) list.push(s)
  list.sort((a, b) => b.t - a.t || b.k - a.k)
  Board.getMutable(boardEntity).runs = JSON.stringify(list.slice(0, 10))
}
function addPvpKill(name: string) {
  let m: Record<string, number> = {}
  try {
    m = JSON.parse(Board.get(boardEntity).pvp || '{}')
  } catch {}
  m[name] = (m[name] ?? 0) + 1
  Board.getMutable(boardEntity).pvp = JSON.stringify(Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 20)))
}

// ───────────── callbacks wired by the game ─────────────
type Handlers = {
  onHit: (dmg: number, fromId: string, fromName: string) => void
  onBounty: (victimName: string, victimLvl: number) => void
  onFx: (fromId: string, tiers: number[], evs: number[][]) => void
  onAscend: (name: string, x: number, z: number, id: string) => void
  onJackpot: (name: string, kind: 'divine' | 'dung', x: number, z: number) => void
}
let H: Handlers

export function setupNet(h: Handlers) {
  H = h
  boardEntity = engine.addEntity()
  Board.create(boardEntity, { runs: '[]', pvp: '{}' })
  syncEntity(boardEntity, [Board.componentId], 9101)

  on('st', (s: Status) => {
    if (!s) return
    s.id = low(s.id)
    if (s.id === me().id) return
    const r = remotes.get(s.id)
    remotes.set(s.id, { ...(r ?? { x: 0, z: 0 }), ...s, seen: now })
  })
  on('hit', (m: { to: string; from: string; fn: string; dmg: number }) => {
    if (m && low(m.to) === me().id) H.onHit(Number(m.dmg) || 0, low(m.from), m.fn)
  })
  on('ko', (m: { victim: string; vn: string; killer: string; kn: string; lvl: number }) => {
    if (!m || low(m.victim) === me().id) return
    pushFeed(`${m.kn} slew ${m.vn} (Lv ${m.lvl})`, '#FF5468')
    if (low(m.killer) === me().id) {
      H.onBounty(m.vn, m.lvl)
      addPvpKill(m.kn)
    }
  })
  // someone beat THE ALMIGHTY: everyone in the scene sees the ascension
  on('god', (m: { id: string; n: string; x: number; z: number }) => {
    if (!m || low(m.id) === me().id) return
    H.onAscend(String(m.n || 'A hunter').slice(0, 24), Number(m.x) || 32, Number(m.z) || 24, m.id)
  })
  // someone hit a fusion jackpot (divine or disaster): everyone hears about it
  on('jp', (m: { id: string; n: string; k: string; x: number; z: number }) => {
    if (!m || low(m.id) === me().id || (m.k !== 'divine' && m.k !== 'dung')) return
    H.onJackpot(String(m.n || 'A hunter').slice(0, 24), m.k, Number(m.x) || 32, Number(m.z) || 24)
  })
  on('fx', (m: { id: string; a: number[]; e: number[][] }) => {
    if (!m || !Array.isArray(m.e)) return
    m.id = low(m.id)
    if (m.id === me().id) return
    if (m.e.some((p) => Array.isArray(p) && (p[0] === 3 || p[0] === 5))) noteRemoteSwing(m.id)
    H.onFx(m.id, m.a || [0, 0, 0], m.e.slice(0, 24))
  })
  setupRemoteVisuals()
  connectRelay()
  // flush my skill effects to everyone ~5x a second
  let acc = 0
  engine.addSystem((dt) => {
    acc += dt
    if (acc < 0.2 || !fxOut.length) return
    acc = 0
    emit('fx', { id: me().id, a: fxTiers, e: fxOut.splice(0, 24) })
    fxOut.length = 0
    fxCount.clear()
  })
}

// ───────────── shared skill effects (others see my magic circles, slashes, lightning, nukes…) ─────────────
const fxOut: number[][] = []
const fxCount = new Map<number, number>()
let fxTiers: number[] = [0, 0, 0]
/** per-flush caps so a minigun or a maxed build never floods the channel */
const FX_CAP: Record<number, number> = { 0: 3, 1: 2, 2: 4, 3: 2, 4: 2, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 1, 21: 3, 22: 1, 23: 2, 24: 2, 25: 1, 26: 4, 27: 4, 28: 2, 29: 10, 30: 1, 31: 2, 32: 1, 33: 1, 34: 4 }
export function sendFx(code: number, nums: number[], tiers: number[]) {
  const c = fxCount.get(code) ?? 0
  if (c >= (FX_CAP[code] ?? 1)) return
  fxCount.set(code, c + 1)
  fxTiers = tiers
  fxOut.push([code, ...nums.map((v) => Math.round(v * 10) / 10)])
}

export function sendStatus(s: Omit<Status, 'id' | 'n'>) {
  const m = me()
  emit('st', { ...s, id: m.id, n: m.name })
}
export function sendAscend(x: number, z: number) {
  const m = me()
  emit('god', { id: m.id, n: m.name, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })
}
export function sendJackpot(kind: 'divine' | 'dung', x: number, z: number) {
  const m = me()
  emit('jp', { id: m.id, n: m.name, k: kind, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })
}
export function sendHit(to: string, dmg: number) {
  const m = me()
  emit('hit', { to: low(to), from: m.id, fn: m.name, dmg })
}
export function sendKo(killerId: string, killerName: string, lvl: number) {
  const m = me()
  const msg = { victim: m.id, vn: m.name, killer: killerId, kn: killerName, lvl }
  emit('ko', msg)
  pushFeed(`${killerName} slew ${m.name} (Lv ${lvl})`, '#FF5468')
}
export function nameOf(id: string) {
  return remotes.get(id)?.n ?? 'a rival'
}

/** remote players that my weapons may hit right now */
/** hunters I can hurt: both of us must stand in THE BLOOD RING */
export function attackable(myRunActive: boolean, meInZone: boolean): Remote[] {
  const out: Remote[] = []
  for (const r of remotes.values()) {
    const fresh = now - r.seen < 3
    out.push({ id: r.id, x: r.x, z: r.z, attackable: myRunActive && meInZone && fresh && r.run && r.ar && inPvpZone(r.x, r.z) })
  }
  return out.filter((r) => r.attackable)
}

// ───────────── remote player visuals: everything another hunter carries, drawn on their avatar ─────────────
// Always (lobby, casino, arena): worn relic / wings, title, divine form.
// During their run: level/HP tag, orbit glaives, aura, the armory weapon in hand, Seraph Wings, spirit wisps,
// passive rings and the level-rank aura. One-shot skill effects arrive on the 'fx' channel.
type Vis = {
  tag: Entity
  aura: Entity
  blades: Entity[]
  ta: number
  tb: number
  god?: Entity
  cos?: Entity
  cosId?: string | null
  wings?: Entity
  held?: Entity
  heldT: number
  swingT: number
  wisps: Entity[]
  wispT: number
  rings: Entity[]
  ringKey: string
  rank?: Entity
  rankShown: number
}
const SUF = ['', '_t2', '_t3', '_asc']
const tierN = (v: number | undefined) => Math.max(0, Math.min(3, Math.round(v ?? 0)))
const vis = new Map<string, Vis>()
const HIDE = Vector3.create(32, -40, 24)
const PASSIVE_IDS = Object.keys(PASSIVES) as PassiveId[]

function ent(): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: HIDE })
  return e
}

function visFor(id: string): Vis {
  let v = vis.get(id)
  if (v) return v
  const tag = ent()
  TextShape.create(tag, { text: '', fontSize: 2.4, textColor: Color4.White(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.2, outlineColor: Color3.Black() })
  Billboard.create(tag, { billboardMode: BillboardMode.BM_Y })
  // their aura magic circle and orbiting glaives, drawn with the real skill models at their tier
  const aura = ent()
  GltfContainer.create(aura, { src: 'models/fx_bloom.glb' })
  v = { tag, aura, blades: [], ta: 0, tb: 0, heldT: -1, swingT: 0, wisps: [], wispT: -1, rings: [], ringKey: '', rankShown: -1 }
  for (let i = 0; i < 8; i++) {
    const b = ent()
    GltfContainer.create(b, { src: 'models/fx_glaive.glb' })
    v.blades.push(b)
  }
  vis.set(id, v)
  return v
}

/** their attack landed (swing / shot): swing the weapon in their hand */
export function noteRemoteSwing(id: string) {
  const v = vis.get(id)
  if (v) v.swingT = 0.2
}

function takeOff(v: Vis) {
  v.god = detach(v.god)
  v.cos = detach(v.cos)
  v.cosId = undefined
  v.wings = detach(v.wings)
}
function hideRun(v: Vis) {
  const hide = (e: Entity | undefined) => {
    if (e) Transform.getMutable(e).position = HIDE
  }
  ;[v.aura, ...v.blades, v.held, ...v.wisps, ...v.rings, v.rank].forEach(hide)
}
function dropVis(id: string) {
  const v = vis.get(id)
  if (!v) return
  takeOff(v)
  for (const e of [v.tag, v.aura, ...v.blades, ...v.wisps, ...v.rings]) engine.removeEntity(e)
  if (v.held) engine.removeEntity(v.held)
  if (v.rank) engine.removeEntity(v.rank)
  vis.delete(id)
}

function glowMat(e: Entity, tex: string, col: string, glow: number) {
  const c = Color4.fromHexString(col + 'FF')
  Material.setPbrMaterial(e, {
    texture: Material.Texture.Common({ src: tex }),
    emissiveTexture: Material.Texture.Common({ src: tex }),
    albedoColor: c,
    emissiveColor: Color3.create(c.r, c.g, c.b),
    emissiveIntensity: glow,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    castShadows: false
  })
}

function setupRemoteVisuals() {
  let spin = 0
  engine.addSystem((dt) => {
    now += dt
    spin += dt * 200
    // read real avatar positions + facing
    const yawOf = new Map<string, number>()
    for (const [entity, ident, t] of engine.getEntitiesWith(PlayerIdentityData, Transform)) {
      if (entity === engine.PlayerEntity) continue
      const id = low(ident.address)
      realId.set(id, ident.address)
      const r = remotes.get(id)
      if (r) {
        r.x = t.position.x
        r.z = t.position.z
        r.y = t.position.y
        r.entity = entity
        const f = Vector3.rotate(Vector3.Forward(), t.rotation)
        r.fx = f.x
        r.fz = f.z
        yawOf.set(id, (Math.atan2(f.x, f.z) * 180) / Math.PI)
      }
    }
    // other hunters' pets walk beside them
    for (const [id, pv] of remotePets) {
      const r = remotes.get(id)
      if (!r) {
        pv.destroy()
        remotePets.delete(id)
      }
    }
    for (const [id, r] of remotes) {
      const look = now - r.seen < 3 && r.entity ? decodePet(r.pt) : null
      let pv = remotePets.get(id)
      if (!look) {
        if (pv && pv.key) {
          pv.hide()
          pv.key = ''
        }
        continue
      }
      if (!pv) {
        if (remotePets.size >= 24) continue
        pv = new PetVis()
        remotePets.set(id, pv)
      }
      pv.dress(look)
      pv.move(dt, (r.y ?? 0) > 30 ? 40 : 0, { x: r.x, z: r.z, fx: r.fx ?? 0, fz: r.fz ?? 1 })
    }
    for (const [id, r] of remotes) {
      const v = visFor(id)
      if (now - r.seen >= 3) {
        // gone quiet (left, or loading): take everything off
        if (v.god || v.cos || v.wings) takeOff(v)
        Transform.getMutable(v.tag).position = HIDE
        hideRun(v)
        if (now - r.seen > 30) {
          dropVis(id)
          remotes.delete(id)
        }
        continue
      }
      const inRun = !!r.run
      // ── what they wear, everywhere ──
      const seraph = inRun && !!r.sw
      const wear = seraph && anchorOf(r.cs) === 'back' ? null : r.cs ?? null // Seraph Wings cover a back relic
      if (wear !== (v.cosId ?? null)) {
        v.cosId = wear
        v.cos = attachCosmetic(avatarOf(id), wear, v.cos)
      }
      if (seraph && !v.wings) v.wings = attachCosmetic(avatarOf(id), 'seraph_wings')
      else if (!seraph && v.wings) v.wings = detach(v.wings)
      if (r.gd && !v.god) {
        v.god = engine.addEntity()
        GltfContainer.create(v.god, { src: 'models/god_aura.glb' })
        AvatarAttach.create(v.god, { avatarId: avatarOf(id), anchorPointId: AvatarAnchorPointType.AAPT_POSITION })
      } else if (!r.gd && v.god) v.god = detach(v.god)
      const title = titleOf(r.ti)
      const ts = TextShape.getMutable(v.tag)
      if (!inRun) {
        // in the lobby / casino: just their title over the name
        hideRun(v)
        if (title) {
          ts.text = `« ${title} »`
          ts.textColor = Color4.fromHexString('#FFD86A')
          Transform.getMutable(v.tag).position = Vector3.create(r.x, 2.75, r.z)
        } else Transform.getMutable(v.tag).position = HIDE
        continue
      }
      // ── their run: tag, skills, weapon ──
      const frac = Math.max(0, Math.min(1, r.hp / Math.max(1, r.mh)))
      ts.text = `${title ? `« ${title} »\n` : ''}${r.ar ? 'PVP · ' : 'SAFE · '}Lv ${r.l}\nHP ${Math.round(frac * 100)}% · ${r.k} kills`
      ts.textColor = r.ar ? Color4.fromHexString('#FF5468') : Color4.fromHexString('#9AA0AA')
      Transform.getMutable(v.tag).position = Vector3.create(r.x, 2.7, r.z)
      if (tierN(r.ta) !== v.ta) {
        v.ta = tierN(r.ta)
        GltfContainer.getMutable(v.aura).src = `models/fx_bloom${SUF[v.ta]}.glb`
      }
      if (tierN(r.tb) !== v.tb) {
        v.tb = tierN(r.tb)
        for (const b of v.blades) GltfContainer.getMutable(b).src = `models/fx_glaive${SUF[v.tb]}.glb`
      }
      const at = Transform.getMutable(v.aura)
      if (r.au > 0) {
        at.position = Vector3.create(r.x, 0.06, r.z)
        at.scale = Vector3.create(r.au * 2, 1 + r.au * 0.25, r.au * 2)
        at.rotation = Quaternion.fromEulerDegrees(0, spin * 0.3, 0)
      } else at.position = HIDE
      v.blades.forEach((b, i) => {
        const t = Transform.getMutable(b)
        if (i >= r.ob) {
          t.position = HIDE
          return
        }
        const a = spin + (i * 360) / r.ob
        const rad = (a * Math.PI) / 180
        t.position = Vector3.create(r.x + Math.sin(rad) * r.orr, 1.0, r.z + Math.cos(rad) * r.orr)
        t.rotation = Quaternion.fromEulerDegrees(0, a * 4, 0)
      })
      // the armory weapon in their right hand (swings when their attacks arrive)
      const w = r.w ?? -1
      if (w !== v.heldT) {
        v.heldT = w
        if (w >= 0 && ARMORY[w]) {
          if (!v.held) v.held = ent()
          GltfContainer.createOrReplace(v.held, { src: ARMORY[w].model })
        } else if (v.held) Transform.getMutable(v.held).position = HIDE
      }
      if (v.held && w >= 0 && ARMORY[w]) {
        const yaw = yawOf.get(id) ?? 0
        const a = (yaw * Math.PI) / 180
        const fx = Math.sin(a)
        const fz = Math.cos(a)
        const gun = !!ARMORY[w].gun
        if (v.swingT > 0) v.swingT -= dt
        const sk = Math.max(0, v.swingT) / 0.2
        const swing = gun ? 0 : (1 - sk) * 150 - 80
        const t = Transform.getMutable(v.held)
        t.position = Vector3.create(r.x + fz * 0.5 + fx * 0.25, gun ? 1.15 : 1.25, r.z - fx * 0.5 + fz * 0.25)
        t.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, yaw + (v.swingT > 0 ? swing : -20), 0), Quaternion.fromEulerDegrees(gun ? 0 : v.swingT > 0 ? 10 : -35, 0, 0))
        t.scale = Vector3.One()
      }
      // spirit wisps circling them
      const wc = Math.max(0, Math.min(6, Math.round(r.wc ?? 0)))
      const wt = tierN(r.wt)
      if (wt !== v.wispT) {
        v.wispT = wt
        for (const e of v.wisps) GltfContainer.getMutable(e).src = `models/fx_wisp${SUF[wt]}.glb`
      }
      while (v.wisps.length < wc) {
        const e = ent()
        GltfContainer.create(e, { src: `models/fx_wisp${SUF[wt]}.glb` })
        v.wisps.push(e)
      }
      v.wisps.forEach((e, i) => {
        const t = Transform.getMutable(e)
        if (i >= wc) {
          t.position = HIDE
          return
        }
        const a = ((spin * 0.45 + (i * 360) / wc) * Math.PI) / 180
        t.position = Vector3.create(r.x + Math.sin(a) * 1.5, 1.3 + Math.sin(a * 2 + i) * 0.15, r.z + Math.cos(a) * 1.5)
        t.rotation = Quaternion.fromEulerDegrees(0, (a * 180) / Math.PI + 90, 0)
      })
      // passive rings at their feet (one per passive, brighter with level)
      const ps = (Array.isArray(r.ps) ? r.ps : []).slice(0, 6)
      const key = ps.join(',')
      if (key !== v.ringKey) {
        v.ringKey = key
        while (v.rings.length < ps.length) {
          const e = ent()
          MeshRenderer.setPlane(e)
          v.rings.push(e)
        }
        ps.forEach((code, i) => {
          const pid = PASSIVE_IDS[Math.floor(code / 10)]
          const lv = code % 10
          if (!pid) return
          glowMat(v.rings[i], 'images/ring.png', PASSIVES[pid].color, 0.8 + lv * 0.7 + (lv >= MAX_PASSIVE_LVL ? 2 : 0))
        })
      }
      v.rings.forEach((e, i) => {
        const t = Transform.getMutable(e)
        if (i >= ps.length) {
          t.position = HIDE
          return
        }
        const R = 0.75 + i * 0.24
        t.position = Vector3.create(r.x, 0.05 + i * 0.01, r.z)
        t.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, spin * 0.2 * (i % 2 ? -1 : 1), 0), Quaternion.fromEulerDegrees(90, 0, 0))
        t.scale = Vector3.create(R * 2, R * 2, 1)
      })
      // level-rank aura (Lv 50 bronze → 200 void)
      const rk = rankOf(r.l)
      if (rk !== v.rankShown) {
        v.rankShown = rk
        if (rk >= 0) {
          if (!v.rank) {
            v.rank = ent()
            MeshRenderer.setPlane(v.rank)
          }
          glowMat(v.rank, 'images/rank.png', rankColor(rk), 2 + rk * 1.2)
        }
      }
      if (v.rank) {
        const t = Transform.getMutable(v.rank)
        if (rk >= 0) {
          const d = 4.2 + rk * 0.5
          t.position = Vector3.create(r.x, 0.04, r.z)
          t.rotation = Quaternion.multiply(Quaternion.fromEulerDegrees(0, -spin * 0.1, 0), Quaternion.fromEulerDegrees(90, 0, 0))
          t.scale = Vector3.create(d, d, 1)
        } else t.position = HIDE
      }
    }
  })
}

export function netTime() {
  return now
}

// Multiplayer: other players' status, PvP hits, kill bounties and the shared leaderboard.
import {
  engine, Entity, Schemas, Transform, PlayerIdentityData, MeshRenderer, Material, MaterialTransparencyMode,
  TextShape, Billboard, BillboardMode, Font, TextAlignMode, GltfContainer, AvatarAttach, AvatarAnchorPointType
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
import { attachCosmetic, titleOf, anchorOf, detach } from './cosmetics'
import { ARMORY, PASSIVES, PassiveId, MAX_PASSIVE_LVL } from './defs'
import { rankOf, rankColor } from './view'
import { syncEntity } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/players'
import { Remote } from './core'

const bus = new MessageBus()

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
}
type RemoteInfo = Status & { seen: number; x: number; z: number; entity?: Entity }

export const remotes = new Map<string, RemoteInfo>()
export const feed: { text: string; color: string; t: number }[] = []
let now = 0

export function me() {
  const p = getPlayer()
  return { id: p?.userId ?? 'local', name: p?.name || `Hunter${(p?.userId ?? '0000').slice(-4)}` }
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
}
let H: Handlers

export function setupNet(h: Handlers) {
  H = h
  boardEntity = engine.addEntity()
  Board.create(boardEntity, { runs: '[]', pvp: '{}' })
  syncEntity(boardEntity, [Board.componentId], 9101)

  bus.on('st', (s: Status) => {
    if (!s || s.id === me().id) return
    const r = remotes.get(s.id)
    remotes.set(s.id, { ...(r ?? { x: 0, z: 0 }), ...s, seen: now })
  })
  bus.on('hit', (m: { to: string; from: string; fn: string; dmg: number }) => {
    if (m && m.to === me().id) H.onHit(m.dmg, m.from, m.fn)
  })
  bus.on('ko', (m: { victim: string; vn: string; killer: string; kn: string; lvl: number }) => {
    if (!m) return
    pushFeed(`${m.kn} slew ${m.vn} (Lv ${m.lvl})`, '#FF5468')
    if (m.killer === me().id) {
      H.onBounty(m.vn, m.lvl)
      addPvpKill(m.kn)
    }
  })
  // someone beat THE ALMIGHTY: everyone in the scene sees the ascension
  bus.on('god', (m: { id: string; n: string; x: number; z: number }) => {
    if (!m || m.id === me().id) return
    H.onAscend(String(m.n || 'A hunter').slice(0, 24), Number(m.x) || 32, Number(m.z) || 24, m.id)
  })
  bus.on('fx', (m: { id: string; a: number[]; e: number[][] }) => {
    if (!m || m.id === me().id || !Array.isArray(m.e)) return
    if (m.e.some((p) => Array.isArray(p) && (p[0] === 3 || p[0] === 5))) noteRemoteSwing(m.id)
    H.onFx(m.id, m.a || [0, 0, 0], m.e.slice(0, 24))
  })
  setupRemoteVisuals()
  // flush my skill effects to everyone ~5x a second
  let acc = 0
  engine.addSystem((dt) => {
    acc += dt
    if (acc < 0.2 || !fxOut.length) return
    acc = 0
    bus.emit('fx', { id: me().id, a: fxTiers, e: fxOut.splice(0, 24) })
    fxOut.length = 0
    fxCount.clear()
  })
}

// ───────────── shared skill effects (others see my magic circles, slashes, lightning, nukes…) ─────────────
const fxOut: number[][] = []
const fxCount = new Map<number, number>()
let fxTiers: number[] = [0, 0, 0]
/** per-flush caps so a minigun or a maxed build never floods the channel */
const FX_CAP: Record<number, number> = { 0: 3, 1: 2, 2: 4, 3: 2, 4: 2, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 1, 21: 3, 22: 1, 23: 2, 24: 2, 25: 1, 26: 4, 27: 4, 28: 2 }
export function sendFx(code: number, nums: number[], tiers: number[]) {
  const c = fxCount.get(code) ?? 0
  if (c >= (FX_CAP[code] ?? 1)) return
  fxCount.set(code, c + 1)
  fxTiers = tiers
  fxOut.push([code, ...nums.map((v) => Math.round(v * 10) / 10)])
}

export function sendStatus(s: Omit<Status, 'id' | 'n'>) {
  const m = me()
  bus.emit('st', { ...s, id: m.id, n: m.name })
}
export function sendAscend(x: number, z: number) {
  const m = me()
  bus.emit('god', { id: m.id, n: m.name, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 })
}
export function sendHit(to: string, dmg: number) {
  const m = me()
  bus.emit('hit', { to, from: m.id, fn: m.name, dmg })
}
export function sendKo(killerId: string, killerName: string, lvl: number) {
  const m = me()
  const msg = { victim: m.id, vn: m.name, killer: killerId, kn: killerName, lvl }
  bus.emit('ko', msg)
  pushFeed(`${killerName} slew ${m.name} (Lv ${lvl})`, '#FF5468')
}
export function nameOf(id: string) {
  return remotes.get(id)?.n ?? 'a rival'
}

/** remote players that my weapons may hit right now */
export function attackable(myRunActive: boolean, meInArena: boolean): Remote[] {
  const out: Remote[] = []
  for (const r of remotes.values()) {
    const fresh = now - r.seen < 3
    out.push({ id: r.id, x: r.x, z: r.z, attackable: myRunActive && meInArena && fresh && r.run && r.ar })
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
      const r = remotes.get(ident.address)
      if (r) {
        r.x = t.position.x
        r.z = t.position.z
        r.entity = entity
        const f = Vector3.rotate(Vector3.Forward(), t.rotation)
        yawOf.set(ident.address, (Math.atan2(f.x, f.z) * 180) / Math.PI)
      }
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
        v.cos = attachCosmetic(id, wear, v.cos)
      }
      if (seraph && !v.wings) v.wings = attachCosmetic(id, 'seraph_wings')
      else if (!seraph && v.wings) v.wings = detach(v.wings)
      if (r.gd && !v.god) {
        v.god = engine.addEntity()
        GltfContainer.create(v.god, { src: 'models/god_aura.glb' })
        AvatarAttach.create(v.god, { avatarId: id, anchorPointId: AvatarAnchorPointType.AAPT_POSITION })
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

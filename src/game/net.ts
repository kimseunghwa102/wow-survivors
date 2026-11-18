// Multiplayer: other players' status, PvP hits, kill bounties and the shared leaderboard.
import {
  engine, Entity, Schemas, Transform, PlayerIdentityData, MeshRenderer, Material, MaterialTransparencyMode,
  TextShape, Billboard, BillboardMode, Font, TextAlignMode, GltfContainer, AvatarAttach, AvatarAnchorPointType
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { MessageBus } from '@dcl/sdk/message-bus'
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
  setupRemoteVisuals()
}

export function sendStatus(s: Omit<Status, 'id' | 'n'>) {
  const m = me()
  bus.emit('st', { ...s, id: m.id, n: m.name })
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

// ───────────── remote player visuals: level tag, HP bar, their blades & aura ─────────────
type Vis = { tag: Entity; aura: Entity; blades: Entity[]; god?: Entity }
const vis = new Map<string, Vis>()
const HIDE = Vector3.create(32, -40, 24)

function mk(kind: 'box' | 'cyl', hex: string, alpha: number, glow: number) {
  const e = engine.addEntity()
  Transform.create(e, { position: HIDE })
  if (kind === 'box') MeshRenderer.setBox(e)
  else MeshRenderer.setCylinder(e)
  const c = Color4.fromHexString(hex)
  Material.setPbrMaterial(e, {
    albedoColor: Color4.create(c.r, c.g, c.b, alpha),
    emissiveColor: Color3.create(c.r, c.g, c.b),
    emissiveIntensity: glow,
    transparencyMode: alpha < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : undefined
  })
  return e
}

function visFor(id: string): Vis {
  let v = vis.get(id)
  if (v) return v
  const tag = engine.addEntity()
  Transform.create(tag, { position: HIDE })
  TextShape.create(tag, { text: '', fontSize: 2.4, textColor: Color4.White(), font: Font.F_SANS_SERIF, textAlign: TextAlignMode.TAM_MIDDLE_CENTER, outlineWidth: 0.2, outlineColor: Color3.Black() })
  Billboard.create(tag, { billboardMode: BillboardMode.BM_Y })
  v = { tag, aura: mk('cyl', '#FFD86A', 0.15, 1.5), blades: [] }
  for (let i = 0; i < 8; i++) {
    const b = mk('box', '#5EF2FF', 1, 3)
    Transform.getMutable(b).scale = Vector3.create(0.12, 0.08, 0.75)
    v.blades.push(b)
  }
  vis.set(id, v)
  return v
}

function setupRemoteVisuals() {
  let spin = 0
  engine.addSystem((dt) => {
    now += dt
    spin += dt * 200
    // read real avatar positions
    for (const [entity, ident, t] of engine.getEntitiesWith(PlayerIdentityData, Transform)) {
      if (entity === engine.PlayerEntity) continue
      const r = remotes.get(ident.address)
      if (r) {
        r.x = t.position.x
        r.z = t.position.z
        r.entity = entity
      }
    }
    for (const [id, r] of remotes) {
      const v = visFor(id)
      const active = now - r.seen < 3 && r.run
      const hide = (e: Entity) => (Transform.getMutable(e).position = HIDE)
      if (!active) {
        ;[v.tag, v.aura, ...v.blades].forEach(hide)
        if (v.god) {
          engine.removeEntity(v.god)
          v.god = undefined
        }
        if (now - r.seen > 30) remotes.delete(id)
        continue
      }
      // remote god: show their divine form on their avatar
      if (r.gd && !v.god) {
        v.god = engine.addEntity()
        GltfContainer.create(v.god, { src: 'models/god_aura.glb' })
        AvatarAttach.create(v.god, { avatarId: id, anchorPointId: AvatarAnchorPointType.AAPT_POSITION })
      } else if (!r.gd && v.god) {
        engine.removeEntity(v.god)
        v.god = undefined
      }
      const ts = TextShape.getMutable(v.tag)
      const frac = Math.max(0, Math.min(1, r.hp / Math.max(1, r.mh)))
      ts.text = `${r.ar ? 'PVP · ' : 'SAFE · '}Lv ${r.l}\nHP ${Math.round(frac * 100)}% · ${r.k} kills`
      ts.textColor = r.ar ? Color4.fromHexString('#FF5468') : Color4.fromHexString('#9AA0AA')
      Transform.getMutable(v.tag).position = Vector3.create(r.x, 2.7, r.z)
      const at = Transform.getMutable(v.aura)
      if (r.au > 0) {
        at.position = Vector3.create(r.x, 0.08, r.z)
        at.scale = Vector3.create(r.au * 2, 0.02, r.au * 2)
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
        t.rotation = Quaternion.fromEulerDegrees(0, a + 90, 0)
      })
    }
  })
}

export function netTime() {
  return now
}

// WHO IS GOD? — the throne at the east end of the arena, straight ahead of the gate from the Sanctuary.
// The first hunter ever to defeat THE ALMIGHTY at Lv 1111 is enshrined here forever: their own avatar
// (fetched from their Decentraland profile) stands on the dais in the God skin, with their name below.
// Until then the dais stays empty with a floating "?". The save server decides who was first (board.firstGod).
import { engine, Transform, GltfContainer, AvatarShape, executeTask, Entity } from '@dcl/sdk/ecs'
import { Color3, Quaternion } from '@dcl/sdk/math'
import { text, setText, bob, V, FACE } from './helpers'
import { save } from './game/persist'

const CX = 44.2
const CZ = 8.0
const TOP = 0.9
const HIDE = V(0, -50, 0)

let plate: Entity
let mark: Entity
let shown = ''

export function buildThrone() {
  const base = engine.addEntity()
  Transform.create(base, { position: V(0, 0, 0) })
  GltfContainer.create(base, { src: 'models/god_throne.glb' })
  // readable from the gate (the viewer looks east, so the text faces west)
  text(V(CX + 0.9, 8.5, CZ), 'WHO IS GOD?', 6, '#FFD86A', { rot: FACE.west, outline: '#3A2400' })
  text(V(CX + 0.9, 7.55, CZ), 'the first hunter to defeat THE ALMIGHTY at Lv 1111 takes this throne forever', 1.5, '#FFF1C8', { rot: FACE.west, outline: '#2A1A00' })
  plate = text(V(CX - 3.3, 1.2, CZ), 'THE THRONE AWAITS', 2.4, '#FFE9A8', { rot: FACE.west, outline: '#2A1A00' })
  mark = text(V(CX, TOP + 1.4, CZ), '?', 10, '#FFD86A', { rot: FACE.west, outline: '#5A3A00' })
  bob(mark, 0.18, 2400)

  let t = 0
  engine.addSystem((dt) => {
    t += dt
    if (t < 3) return
    t = 0
    const g = save.board?.firstGod
    if (!g || !g.address || g.address === shown) return
    shown = g.address
    enshrine(g)
  })
}

function rgb(c: any): Color3 | undefined {
  return c && Number.isFinite(c.r) ? Color3.create(c.r, c.g, c.b) : undefined
}

function enshrine(g: { name: string; address: string; at: string }) {
  Transform.getMutable(mark).position = HIDE
  const day = (g.at || '').slice(0, 10)
  setText(plate, `☀ ${g.name} ☀\nTHE FIRST GOD${day ? ' · ' + day : ''}`, '#FFE9A8')

  // the statue: their own avatar, facing the gate
  const st = engine.addEntity()
  Transform.create(st, { position: V(CX - 0.15, TOP, CZ), rotation: Quaternion.fromEulerDegrees(0, -90, 0) })
  AvatarShape.create(st, { id: 'first-god', name: g.name, wearables: [], emotes: [], bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale' })
  // the God skin they won: the divine aura at their feet and the radiance on their back
  const aura = engine.addEntity()
  Transform.create(aura, { position: V(0, 0, 0), parent: st })
  GltfContainer.create(aura, { src: 'models/god_aura.glb' })
  const wings = engine.addEntity()
  Transform.create(wings, { position: V(0, 1.32, -0.18), parent: st })
  GltfContainer.create(wings, { src: 'models/cos_god.glb' })

  executeTask(async () => {
    try {
      const res = await fetch(`https://peer.decentraland.org/lambdas/profiles/${g.address}`)
      const j = await res.json()
      const av = j?.[0]?.avatars?.[0]?.avatar
      if (!av) return
      const m = AvatarShape.getMutable(st)
      if (av.bodyShape) m.bodyShape = av.bodyShape
      if (Array.isArray(av.wearables)) m.wearables = av.wearables
      m.skinColor = rgb(av.skin?.color) ?? m.skinColor
      m.hairColor = rgb(av.hair?.color) ?? m.hairColor
      m.eyeColor = rgb(av.eyes?.color) ?? m.eyeColor
    } catch (e) {
      console.log('first God profile not loaded', e)
    }
  })
}

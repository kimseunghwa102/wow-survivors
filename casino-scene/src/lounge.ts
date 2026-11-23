// 2F WOW Crypto Lounge: elevator between floors and a live BTC/USDT daily candle chart.
import {
  engine,
  Entity,
  Transform,
  GltfContainer,
  ColliderLayer,
  MeshRenderer,
  MeshCollider,
  Material,
  TextShape,
  TextAlignMode,
  Billboard,
  BillboardMode,
  VisibilityComponent,
  pointerEventsSystem,
  InputAction,
  LightSource,
  Tween,
  EasingFunction
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { sfx, schedule } from './holdem/fx'
import { fmt } from './holdem/text'

const V = Vector3.create
const FLIP = Quaternion.fromEulerDegrees(0, 180, 0)
const H = 6
const Y2 = H + 0.1 // 2F floor
const EZ = 9.5 // elevator centre z
const GREEN = Color4.fromHexString('#16F2A0FF')
const RED = Color4.fromHexString('#FF3D6EFF')
const GOLD = Color4.fromHexString('#FFD54FFF')
const CYAN = Color4.fromHexString('#7DF9FFFF')
const DIM = Color4.fromHexString('#8C96B0FF')

function txt(pos: Vector3, value: string, size: number, color: Color4, rotY = 0, align = TextAlignMode.TAM_MIDDLE_CENTER) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, rotation: Quaternion.fromEulerDegrees(0, rotY, 0) })
  TextShape.create(e, { text: value, fontSize: size, textColor: color, outlineWidth: 0.12, outlineColor: Color3.Black(), textAlign: align })
  return e
}

/* ---------- elevator ---------- */
type Cab = { y: number; doors: [Entity, Entity]; open: boolean }
const cabs: Cab[] = []
let riding = false
const DOOR_X = 14.12
const doorZ = (side: number, open: boolean) => EZ + side * (open ? 1.48 : 0.5)
function setDoors(c: Cab, open: boolean, ms: number) {
  c.open = open
  c.doors.forEach((d, i) => {
    const side = i === 0 ? -1 : 1
    const from = Transform.get(d).position
    const to = V(DOOR_X, c.y + 1.42, doorZ(side, open))
    if (ms <= 0) {
      Transform.getMutable(d).position = to
      return
    }
    Tween.createOrReplace(d, { mode: Tween.Mode.Move({ start: from, end: to }), duration: ms, easingFunction: EasingFunction.EF_EASESINE })
  })
}
function buildCab(y: number, toFloor: 1 | 2) {
  const doors: Entity[] = []
  for (const side of [-1, 1]) {
    const d = engine.addEntity()
    Transform.create(d, { position: V(DOOR_X, y + 1.42, doorZ(side, true)), scale: V(0.05, 2.82, 1.0) })
    MeshRenderer.setBox(d)
    Material.setPbrMaterial(d, { albedoColor: Color4.fromHexString('#16161CFF'), metallic: 0.9, roughness: 0.15 })
    doors.push(d)
  }
  const cab: Cab = { y, doors: [doors[0], doors[1]], open: true }
  cabs.push(cab)
  txt(V(14.06, y + 3.15, EZ), toFloor === 2 ? 'ELEVATOR   2F CRYPTO LOUNGE' : 'ELEVATOR   1F CASINO', 0.95, CYAN, 90)
  // click anywhere on the cabin front
  const hot = engine.addEntity()
  Transform.create(hot, { position: V(14.9, y + 1.4, EZ), scale: V(1.6, 2.8, 2.1) })
  MeshCollider.setBox(hot, ColliderLayer.CL_POINTER)
  pointerEventsSystem.onPointerDown(
    { entity: hot, opts: { button: InputAction.IA_POINTER, hoverText: toFloor === 2 ? 'Go up to 2F  Crypto Lounge' : 'Go down to 1F  Casino', maxDistance: 7 } },
    () => ride(cab, toFloor)
  )
}
function ride(from: Cab, toFloor: 1 | 2) {
  if (riding) return
  riding = true
  const to = cabs[toFloor - 1]
  setDoors(from, false, 700)
  setDoors(to, false, 0)
  sfx('elevator', 300)
  schedule(1500, () => {
    void movePlayerTo({ newRelativePosition: V(15.0, to.y + 0.15, EZ), cameraTarget: V(8, to.y + 1.6, EZ) })
    schedule(350, () => setDoors(to, true, 800))
    schedule(900, () => setDoors(from, true, 800))
    schedule(1900, () => (riding = false))
  })
}

/* ---------- live BTC/USDT 1D chart on the LED wall ---------- */
type Candle = { t: number; o: number; h: number; l: number; c: number }
const N = 28
const CH_X0 = 3.1
const CH_X1 = 12.0
const CH_Y0 = Y2 + 1.0
const CH_Y1 = Y2 + 4.0
const CH_Z = 15.76
const bodies: Entity[] = []
const wicks: Entity[] = []
let tTitle: Entity
let tPrice: Entity
let tChange: Entity
let tHi: Entity
let tMid: Entity
let tLo: Entity
let ticker: Entity
const SOURCES: [string, (j: any) => Candle[]][] = [
  ['https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=' + N, binance],
  ['https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=' + N, binance],
  ['https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400', coinbase]
]
function binance(j: any): Candle[] {
  return (j as any[]).map((k) => ({ t: Number(k[0]), o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]) }))
}
function coinbase(j: any): Candle[] {
  return (j as any[])
    .slice(0, N)
    .map((k) => ({ t: Number(k[0]) * 1000, l: Number(k[1]), h: Number(k[2]), o: Number(k[3]), c: Number(k[4]) }))
    .reverse()
}
let src = 0
let fails = 0
async function load() {
  for (let k = 0; k < SOURCES.length; k++) {
    const i = (src + k) % SOURCES.length
    try {
      const r = await fetch(SOURCES[i][0])
      if (!r.ok) throw new Error('http ' + r.status)
      const cs = SOURCES[i][1](await r.json()).filter((c) => c.h > 0 && c.l > 0)
      if (cs.length < 5) throw new Error('short')
      src = i
      fails = 0
      draw(cs.slice(-N), i < 2 ? 'Binance' : 'Coinbase')
      return
    } catch (e) {
      // try the next source
    }
  }
  fails++
  TextShape.getMutable(tTitle).text = 'BTC / USDT  ·  1D   <color=#FF3D6E>offline, retrying</color>'
}
function draw(cs: Candle[], from: string) {
  const hi = Math.max(...cs.map((c) => c.h))
  const lo = Math.min(...cs.map((c) => c.l))
  const pad = (hi - lo) * 0.05 || 1
  const top = hi + pad
  const bot = lo - pad
  const Y = (p: number) => CH_Y0 + ((p - bot) / (top - bot)) * (CH_Y1 - CH_Y0)
  const step = (CH_X1 - CH_X0) / N
  for (let i = 0; i < N; i++) {
    const c = cs[i - (N - cs.length)]
    const b = bodies[i]
    const w = wicks[i]
    if (!c) {
      VisibilityComponent.getMutable(b).visible = false
      VisibilityComponent.getMutable(w).visible = false
      continue
    }
    const up = c.c >= c.o
    const x = CH_X0 + step * (i + 0.5)
    const y0 = Y(Math.min(c.o, c.c))
    const y1 = Y(Math.max(c.o, c.c))
    const bh = Math.max(0.025, y1 - y0)
    Transform.getMutable(b).position = V(x, (y0 + y1) / 2, CH_Z)
    Transform.getMutable(b).scale = V(step * 0.68, bh, 0.06)
    Transform.getMutable(w).position = V(x, (Y(c.l) + Y(c.h)) / 2, CH_Z + 0.01)
    Transform.getMutable(w).scale = V(0.035, Math.max(0.025, Y(c.h) - Y(c.l)), 0.03)
    Material.setBasicMaterial(b, { diffuseColor: up ? GREEN : RED })
    Material.setBasicMaterial(w, { diffuseColor: up ? GREEN : RED })
    VisibilityComponent.getMutable(b).visible = true
    VisibilityComponent.getMutable(w).visible = true
  }
  const last = cs[cs.length - 1]
  const prev = cs.length > 1 ? cs[cs.length - 2].c : last.o
  const chg = ((last.c - prev) / prev) * 100
  const col = chg >= 0 ? GREEN : RED
  const price = '$' + fmt(Math.round(last.c))
  const pct = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'
  TextShape.getMutable(tTitle).text = 'BTC / USDT  ·  1D   <color=#FF3D6E>LIVE</color>   <size=60%><color=#8C96B0>' + from + '</color></size>'
  const tp = TextShape.getMutable(tPrice)
  tp.text = price
  tp.textColor = col
  const tc = TextShape.getMutable(tChange)
  tc.text = pct
  tc.textColor = col
  TextShape.getMutable(tHi).text = fmt(Math.round(hi))
  TextShape.getMutable(tLo).text = fmt(Math.round(lo))
  TextShape.getMutable(tMid).text = fmt(Math.round((hi + lo) / 2))
  Transform.getMutable(tHi).position = V(12.25, Y(hi), CH_Z - 0.02)
  Transform.getMutable(tLo).position = V(12.25, Y(lo), CH_Z - 0.02)
  Transform.getMutable(tMid).position = V(12.25, Y((hi + lo) / 2), CH_Z - 0.02)
  ;(globalThis as any).__btc = { price, pct, from, n: cs.length }
  const tk = TextShape.getMutable(ticker)
  tk.text = 'BTC  ' + price + '\n<size=60%>' + pct + ' today</size>'
  tk.textColor = col
}
function buildChart() {
  for (let i = 0; i < N; i++) {
    const w = engine.addEntity()
    Transform.create(w, { position: V(8, CH_Y0, CH_Z), scale: V(0.03, 0.1, 0.03) })
    MeshRenderer.setBox(w)
    Material.setBasicMaterial(w, { diffuseColor: GREEN })
    VisibilityComponent.create(w, { visible: false })
    wicks.push(w)
    const b = engine.addEntity()
    Transform.create(b, { position: V(8, CH_Y0, CH_Z), scale: V(0.2, 0.1, 0.06) })
    MeshRenderer.setBox(b)
    Material.setBasicMaterial(b, { diffuseColor: GREEN })
    VisibilityComponent.create(b, { visible: false })
    bodies.push(b)
  }
  const ty = Y2 + 4.5
  tTitle = txt(V(3.1, ty, CH_Z - 0.02), 'BTC / USDT  ·  1D   loading...', 1.6, Color4.White(), 0, TextAlignMode.TAM_MIDDLE_LEFT)
  tPrice = txt(V(9.0, ty, CH_Z - 0.02), '', 2.0, GREEN, 0, TextAlignMode.TAM_MIDDLE_LEFT)
  tChange = txt(V(13.3, ty, CH_Z - 0.02), '', 1.5, GREEN, 0, TextAlignMode.TAM_MIDDLE_RIGHT)
  tHi = txt(V(12.25, CH_Y1, CH_Z - 0.02), '', 0.8, DIM, 0, TextAlignMode.TAM_MIDDLE_LEFT)
  tMid = txt(V(12.25, (CH_Y0 + CH_Y1) / 2, CH_Z - 0.02), '', 0.8, DIM, 0, TextAlignMode.TAM_MIDDLE_LEFT)
  tLo = txt(V(12.25, CH_Y0, CH_Z - 0.02), '', 0.8, DIM, 0, TextAlignMode.TAM_MIDDLE_LEFT)
  // floating price over the hologram stage
  ticker = txt(V(8, Y2 + 2.0, 10), 'BTC', 2.6, GOLD)
  Billboard.create(ticker, { billboardMode: BillboardMode.BM_Y })
  Tween.create(ticker, { mode: Tween.Mode.Move({ start: V(8, Y2 + 1.9, 10), end: V(8, Y2 + 2.15, 10) }), duration: 2600, easingFunction: EasingFunction.EF_EASESINE })
  let t = 0
  engine.addSystem((dt) => {
    t += dt
    if (t < (fails > 0 ? 30 : 60)) return
    t = 0
    void load()
  })
  void load()
}

export function buildLounge() {
  const f2 = engine.addEntity()
  const IN_S = 0.998
  Transform.create(f2, { position: V(8 * (1 - IN_S), 0, 8 * (1 - IN_S)), rotation: FLIP, scale: V(IN_S, 1, IN_S) })
  GltfContainer.create(f2, { src: 'models/floor2.glb', visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS, invisibleMeshesCollisionMask: ColliderLayer.CL_NONE })
  buildCab(0, 2)
  buildCab(Y2, 1)
  // outside sign on the 2F facade
  txt(V(8, Y2 + 2.7, 2.8), 'WOW CRYPTO LOUNGE', 3.2, Color4.fromHexString('#FF5FA8FF'), 0)
  for (const [pos, col, int] of [
    [V(8, Y2 + 4.2, 10), '#7DF9FF', 16000],
    [V(2.2, Y2 + 3.2, 10), '#FF5FA8', 7000],
    [V(8, Y2 + 3.5, 14.2), '#FFD9A6', 6000]
  ] as [Vector3, string, number][]) {
    const e = engine.addEntity()
    Transform.create(e, { position: pos })
    LightSource.create(e, { type: LightSource.Type.Point({}), color: Color3.fromHexString(col), intensity: int, range: 9 })
  }
  buildChart()
}

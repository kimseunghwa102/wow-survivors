// In-world rendering of the shared GYBM Hold'em table: seats, cards, bets, pot, dealer button, ranking board.
import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  TextShape,
  Billboard,
  BillboardMode,
  VisibilityComponent,
  pointerEventsSystem,
  InputAction,
  ColliderLayer,
  TextAlignMode,
  GltfContainer,
  ColliderLayer as CL,
  AvatarShape,
  Tween,
  TweenSequence,
  TweenLoop,
  EasingFunction
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math'
import { openExternalUrl } from '~system/RestrictedActions'
import { store, toast, View } from './store'
import { act, autoLogin, SERVER } from './net'
import { displayName, hasHangul, KR_FONT, handName, logLine, fmt } from './text'
import { buildFx, registerCard, dealCard, flipCard, stopCard, sfx, fly, popText, stopPop, fireworks, schedule } from './fx'

const V = Vector3.create
const TX = 8
const TZ = 10
const FELT_Y = 0.935
const RX = 3.7
const RZ = 2.22
/** seat 0..4 clockwise seen from above; the dealer side faces the back wall (90°) */
export const SEAT_ANG = [30, -30, -90, -150, 150]
const rad = (d: number) => (d * Math.PI) / 180

/* ---------- card atlas: 13 x 5 cells of 157 x 204 px on 2048 x 1024 ---------- */
const ATLAS = 'images/casino/cards.png'
const CW = 157 / 2048
const CH = 204 / 1024
const RANKS = '23456789TJQKA'
const SUITS = 'shdc'
function cell(code: string | null): [number, number] {
  if (!code) return [0, 4] // card back
  return [RANKS.indexOf(code[0]), SUITS.indexOf(code[1])]
}
function rect(col: number, row: number, square = false): [number, number, number, number] {
  const e = 0.6 / 2048
  let u0 = col * CW + e
  let u1 = (col + 1) * CW - e
  let vTop = 1 - row * CH - e
  let vBot = 1 - (row + 1) * CH + e
  if (square) {
    const pad = (CH - CW * 2) / 2 // keep a square region (atlas is 2:1)
    vTop -= pad
    vBot += pad
  }
  return [u0, vBot, u1, vTop]
}
/** plane uvs for both sides. Decentraland's plane maps the texture turned 180° compared with
 *  the docs' bottom-left-first order (seen in-world), so the corners are given rotated back. */
function planeUvs(r: [number, number, number, number]) {
  const [u0, v0, u1, v1] = r
  const side = [u0, v0, u0, v1, u1, v1, u1, v0]
  return [...side, ...side]
}
/** UI uvs: bottom-left clockwise (BL, TL, TR, BR) */
export function uiCardUvs(code: string | null) {
  const [c, r] = cell(code)
  const [u0, v0, u1, v1] = rect(c, r)
  return [u0, v0, u0, v1, u1, v1, u1, v0]
}
export const CARD_TEXTURE = ATLAS

/* ---------- entity helpers ---------- */
function cardEntity(pos: Vector3, yawDeg: number, w: number, h: number): Entity {
  const e = engine.addEntity()
  Transform.create(e, {
    position: pos,
    rotation: Quaternion.multiply(Quaternion.fromEulerDegrees(0, yawDeg, 0), Quaternion.fromEulerDegrees(90, 0, 0)),
    scale: V(w, h, 1)
  })
  MeshRenderer.setPlane(e, planeUvs(rect(0, 4)))
  Material.setBasicMaterial(e, { texture: Material.Texture.Common({ src: ATLAS }) })
  VisibilityComponent.create(e, { visible: false })
  return e
}
const shown = new Map<Entity, string>()
function setFace(e: Entity, code: string | null) {
  const [c, r] = cell(code)
  MeshRenderer.setPlane(e, planeUvs(rect(c, r)))
}
/** Shows a card (undefined = hidden, null = back). New cards are dealt in with an animation,
 *  a back that becomes a face is flipped over. Returns 'deal' or 'flip' when an animation started. */
function showCard(e: Entity, code: string | null | undefined, delayMs = 0): '' | 'deal' | 'flip' {
  const prev = shown.get(e)
  if (code === undefined) {
    if (prev !== undefined) {
      shown.delete(e)
      stopCard(e)
      VisibilityComponent.getMutable(e).visible = false
    }
    return ''
  }
  const key = code || 'back'
  if (prev === key) return ''
  shown.set(e, key)
  VisibilityComponent.getMutable(e).visible = true
  if (prev === 'back' && key !== 'back') {
    flipCard(e, delayMs, () => setFace(e, code))
    return 'flip'
  }
  setFace(e, code)
  dealCard(e, delayMs)
  return 'deal'
}
function label(pos: Vector3, size: number, color: Color4, billboard = true, align = TextAlignMode.TAM_MIDDLE_CENTER): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: pos })
  TextShape.create(e, { text: '', fontSize: size, textColor: color, outlineWidth: 0.18, outlineColor: Color3.Black(), textAlign: align })
  if (billboard) Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
  return e
}
function setText(e: Entity, text: string, color?: Color4) {
  const t = TextShape.get(e)
  const kr = hasHangul(text)
  const tc = t.textColor
  const sameColor = !color || (!!tc && tc.r === color.r && tc.g === color.g && tc.b === color.b)
  if (t.text === text && sameColor && !!t.fontSrc === kr) return
  const m = TextShape.getMutable(e)
  m.text = text
  if (color) m.textColor = color
  m.fontSrc = kr ? KR_FONT : undefined
}

/* ---------- build ---------- */
type SeatEnts = { name: Entity; cards: [Entity, Entity]; bet: Entity; chip: Entity; glow: Entity; hot: Entity; flyer: Entity; win: Entity }
const seats: SeatEnts[] = []
const board: Entity[] = []
let potText: Entity
let potPile: Entity
const POT_POS = V(TX, FELT_Y + 0.005, TZ + 0.55)
let statusText: Entity
let dealer: Entity
let rankNames: Entity
let rankChips: Entity
let rankNums: Entity
let rankWin: Entity

const GOLD = Color4.fromHexString('#FFD54FFF')
const CYAN = Color4.fromHexString('#7DF9FFFF')
const WHITE = Color4.White()
const DIM = Color4.fromHexString('#9E9E9EFF')
const PINK = Color4.fromHexString('#FF6FB1FF')

export function buildTable() {
  for (let i = 0; i < 5; i++) {
    const a = rad(SEAT_ANG[i])
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const chairX = TX + ca * 4.48
    const chairZ = TZ + sa * 3.0
    // cards lie in the seat's card zone, top of the card toward the table centre
    const zx = TX + ca * RX * 0.78
    const zz = TZ + sa * RZ * 0.78
    const yaw = 90 - SEAT_ANG[i] // local +z (card top after laying flat) → toward the centre
    const tx = -sa
    const tz = ca // tangent
    // hole cards stand upright above the seat's card zone and turn toward whoever looks
    const hr = engine.addEntity()
    Transform.create(hr, { position: V(zx, 1.2, zz) })
    Billboard.create(hr, { billboardMode: BillboardMode.BM_Y })
    const mk = (dx: number) => {
      const e = engine.addEntity()
      Transform.create(e, { parent: hr, position: V(dx, 0, 0), scale: V(0.3, 0.39, 1) })
      registerCard(e, V(dx, 0, 0), V(0.3, 0.39, 1))
      MeshRenderer.setPlane(e, planeUvs(rect(0, 4)))
      Material.setBasicMaterial(e, { texture: Material.Texture.Common({ src: ATLAS }) })
      VisibilityComponent.create(e, { visible: false })
      return e
    }
    const c1 = mk(-0.2)
    const c2 = mk(0.2)
    void yaw
    void tx
    void tz
    const name = label(V(chairX, 2.05, chairZ), 1.4, WHITE)
    const bx = TX + ca * RX * 0.5
    const bz = TZ + sa * RZ * 0.5
    const chip = engine.addEntity()
    Transform.create(chip, { position: V(bx, FELT_Y + 0.03, bz), scale: V(0.2, 0.05, 0.2) })
    MeshRenderer.setCylinder(chip)
    Material.setPbrMaterial(chip, { albedoColor: Color4.fromHexString('#C8102EFF'), metallic: 0.2, roughness: 0.4 })
    VisibilityComponent.create(chip, { visible: false })
    const bet = label(V(bx, FELT_Y + 0.35, bz), 1.0, GOLD)
    const glow = engine.addEntity()
    Transform.create(glow, { position: V(chairX, 0.03, chairZ), scale: V(1.3, 0.02, 1.3) })
    MeshRenderer.setCylinder(glow)
    Material.setPbrMaterial(glow, { albedoColor: Color4.fromHexString('#FFC24AFF'), emissiveColor: Color3.fromHexString('#FFC24A'), emissiveIntensity: 4 })
    VisibilityComponent.create(glow, { visible: false })
    const hot = engine.addEntity()
    Transform.create(hot, { position: V(chairX, 0.9, chairZ), scale: V(0.9, 1.8, 0.9) })
    MeshCollider.setBox(hot, ColliderLayer.CL_POINTER)
    const seatNo = i
    pointerEventsSystem.onPointerDown({ entity: hot, opts: { button: InputAction.IA_POINTER, hoverText: 'Seat ' + (i + 1), maxDistance: 8 } }, () => onSeat(seatNo))
    const flyer = engine.addEntity()
    Transform.create(flyer, { position: V(bx, FELT_Y + 0.05, bz), scale: V(0.17, 0.05, 0.17) })
    MeshRenderer.setCylinder(flyer)
    Material.setPbrMaterial(flyer, { albedoColor: Color4.fromHexString('#C8102EFF'), metallic: 0.2, roughness: 0.4 })
    VisibilityComponent.create(flyer, { visible: false })
    const win = engine.addEntity()
    Transform.create(win, { position: V(chairX, 2.85, chairZ), scale: V(0, 0, 0) })
    TextShape.create(win, { text: '', fontSize: 3.2, textColor: GOLD, outlineWidth: 0.22, outlineColor: Color3.fromHexString('#5A2A00') })
    Billboard.create(win, { billboardMode: BillboardMode.BM_Y })
    seats.push({ name, cards: [c1, c2], bet, chip, glow, hot, flyer, win })
  }
  // community cards stand upright above the table centre and turn to face whoever is looking
  const boardRoot = engine.addEntity()
  Transform.create(boardRoot, { position: V(TX, 1.85, TZ) })
  Billboard.create(boardRoot, { billboardMode: BillboardMode.BM_Y })
  Tween.create(boardRoot, {
    mode: Tween.Mode.Move({ start: V(TX, 1.8, TZ), end: V(TX, 1.92, TZ) }),
    duration: 2400,
    easingFunction: EasingFunction.EF_EASESINE
  })
  TweenSequence.create(boardRoot, { sequence: [], loop: TweenLoop.TL_YOYO })
  for (let k = 0; k < 5; k++) {
    const e = engine.addEntity()
    Transform.create(e, { parent: boardRoot, position: V((k - 2) * 0.66, 0, 0), scale: V(0.58, 0.8, 1) })
    registerCard(e, V((k - 2) * 0.66, 0, 0), V(0.58, 0.8, 1))
    MeshRenderer.setPlane(e, planeUvs(rect(0, 4)))
    Material.setBasicMaterial(e, { texture: Material.Texture.Common({ src: ATLAS }) })
    VisibilityComponent.create(e, { visible: false })
    board.push(e)
  }
  potText = label(V(TX, 1.25, TZ), 1.4, GOLD)
  potPile = engine.addEntity()
  Transform.create(potPile, { position: POT_POS })
  VisibilityComponent.create(potPile, { visible: false, propagateToChildren: true })
  const pile: [number, number, string][] = [[-0.13, 0.09, '#C8102EFF'], [0.02, 0.14, '#C8102EFF'], [0.16, 0.06, '#C8102EFF'], [0.07, 0.1, '#C8102EFF']]
  pile.forEach(([dx, hgt, col], i) => {
    const e = engine.addEntity()
    Transform.create(e, { parent: potPile, position: V(dx, hgt / 2, i === 3 ? 0.15 : 0), scale: V(0.17, hgt, 0.17) })
    MeshRenderer.setCylinder(e)
    Material.setPbrMaterial(e, { albedoColor: Color4.fromHexString(col), metallic: 0.2, roughness: 0.4 })
  })
  buildFx()
  statusText = label(V(TX, 3.05, TZ), 2.0, CYAN)
  dealer = engine.addEntity()
  Transform.create(dealer, { position: V(TX, FELT_Y + 0.016, TZ), rotation: Quaternion.fromEulerDegrees(90, 0, 0), scale: V(0.18, 0.18, 1) })
  MeshRenderer.setPlane(dealer, planeUvs(rect(1, 4, true)))
  Material.setBasicMaterial(dealer, { texture: Material.Texture.Common({ src: ATLAS }) })
  VisibilityComponent.create(dealer, { visible: false })
  buildRanking()
  buildCharacters()
}

/* ---------- characters: the house AI's reaper and the dealer ---------- */
const BASE = 'urn:decentraland:off-chain:base-avatars:'
let reaper: Entity
let dealerAvatar: Entity
let reaperSeat = -2
let lastHandNo = -1
let lastOver = false
function buildCharacters() {
  reaper = engine.addEntity()
  Transform.create(reaper, { position: V(TX, 0, TZ - 3.4) })
  GltfContainer.create(reaper, { src: 'models/casino/reaper.glb', visibleMeshesCollisionMask: CL.CL_NONE, invisibleMeshesCollisionMask: CL.CL_NONE })
  VisibilityComponent.create(reaper, { visible: false })

  dealerAvatar = engine.addEntity()
  Transform.create(dealerAvatar, { position: V(TX, 0, TZ + 2.85), rotation: Quaternion.fromEulerDegrees(0, 180, 0) })
  AvatarShape.create(dealerAvatar, {
    id: 'gybm-dealer',
    name: 'Sophia',
    bodyShape: BASE + 'BaseFemale',
    wearables: [
      BASE + 'croupier_shirt',
      BASE + 'f_brown_skirt',
      BASE + 'ruby_red_loafer',
      BASE + 'hair_stylish_hair',
      BASE + 'pearls_earring',
      BASE + 'f_eyes_08',
      BASE + 'f_eyebrows_02',
      BASE + 'f_mouth_05'
    ],
    emotes: [],
    hairColor: Color3.fromHexString('#2B1A12'),
    skinColor: Color3.fromHexString('#F1C7A5'),
    eyeColor: Color3.fromHexString('#3B2A1A')
  })

  // the reaper hovers and sways a little
  let t = 0
  engine.addSystem((dt) => {
    t += dt
    if (reaperSeat < 0) return
    const a = rad(SEAT_ANG[reaperSeat])
    const tr = Transform.getMutable(reaper)
    tr.position = V(TX + Math.cos(a) * 5.0, 0.12 + Math.sin(t * 1.6) * 0.1, TZ + Math.sin(a) * 3.45)
    const face = (Math.atan2(-Math.cos(a), -Math.sin(a)) * 180) / Math.PI
    tr.rotation = Quaternion.fromEulerDegrees(0, face + 180 + Math.sin(t * 0.7) * 6, 0)
  })
}
function dealerEmote(id: string) {
  const a = AvatarShape.getMutable(dealerAvatar)
  a.expressionTriggerId = id
  a.expressionTriggerTimestamp = Date.now()
}
function renderCharacters(v: View) {
  const seat = v.seats.findIndex((s) => !!s && s.bot)
  if (seat !== reaperSeat) {
    reaperSeat = seat
    VisibilityComponent.getMutable(reaper).visible = seat >= 0
  }
  const h = v.hand
  if (h && h.no !== lastHandNo && !h.over) {
    lastHandNo = h.no
    lastOver = false
    dealerEmote('raiseHand')
  }
  if (h && h.over && !lastOver) {
    lastOver = true
    dealerEmote(h.result && h.result.reason === 'show' ? 'clap' : 'shrug')
  }
}

/* ---------- ranking board (back wall, left panel) ---------- */
function buildRanking() {
  const X = 4.15
  const Z = 15.68
  const title = engine.addEntity()
  Transform.create(title, { position: V(X, 4.15, Z) })
  TextShape.create(title, { text: 'GOLD RANKING', fontSize: 2.4, textColor: GOLD, outlineWidth: 0.15, outlineColor: Color3.fromHexString('#5A3A00') })
  const mk = (x: number, align: TextAlignMode) => {
    const e = engine.addEntity()
    Transform.create(e, { position: V(x, 3.85, Z) })
    TextShape.create(e, { text: '', fontSize: 1.05, textColor: WHITE, textAlign: align, outlineWidth: 0.1, outlineColor: Color3.Black() })
    return e
  }
  rankNums = mk(X - 1.1, TextAlignMode.TAM_TOP_LEFT)
  rankNames = mk(X - 0.85, TextAlignMode.TAM_TOP_LEFT)
  rankChips = mk(X + 0.72, TextAlignMode.TAM_TOP_RIGHT)
  rankWin = mk(X + 1.12, TextAlignMode.TAM_TOP_RIGHT)
  const foot = engine.addEntity()
  Transform.create(foot, { position: V(X, 1.65, Z) })
  TextShape.create(foot, { text: 'Chips = your WOW NIGHTSWARM gold\n<color=#7DF9FF>net gold won at this table</color>', fontSize: 0.75, textColor: DIM })
}
let rankKey = ''
function renderRanking(v: View) {
  const rows = v.ranking.slice(0, 10)
  const key = rows.map((r) => r.name + r.chips + r.handsWon + r.handsPlayed).join('|')
  if (key === rankKey) return
  rankKey = key
  const medal = ['1', '2', '3']
  setText(rankNums, ['#', ...rows.map((_, i) => (i < 3 ? `<color=#FFD54F>${medal[i]}</color>` : String(i + 1)))].join('\n'))
  setText(rankNames, ['PLAYER', ...rows.map((r) => (r.name.length > 10 ? r.name.slice(0, 10) : r.name))].join('\n'))
  setText(rankChips, ['NET', ...rows.map((r) => (r.net >= 0 ? '+' : '') + fmt(r.net))].join('\n'))
  setText(rankWin, ['WIN%', ...rows.map((r) => (r.handsPlayed ? Math.round((100 * r.handsWon) / r.handsPlayed) + '%' : '-'))].join('\n'))
}

/* ---------- interaction ---------- */
async function onSeat(i: number) {
  const v = store.view
  if (!v) return toast('Connecting to the table...')
  const s = v.seats[i]
  if (!v.me) {
    if (!(await autoLogin())) toast('Log in to take a seat.')
    return
  }
  if (s && s.me) return toast('This is your seat. Use "Stand up" to leave.')
  if (s) return toast(s.bot ? 'AI Alpha is sitting here. Pick an open seat.' : displayName(s.name) + ' is sitting here.')
  if (v.me.seat != null) return toast('You are already seated.')
  if (v.me.chips <= 0) return toast('Your stack is empty. Rebuy first.')
  await act('sit', { seat: i }, 'You sat down. Good luck!')
}


/* ---------- hand events: sounds, flying chips, WIN / LOSE ---------- */
const chipH = (bet: number) => Math.min(0.12, 0.03 + Math.log10(bet + 1) * 0.025)
const landAt = [0, 0, 0, 0, 0]
const prevBet = [0, 0, 0, 0, 0]
let potLandAt = 0
let potHideAt = 0
let evHand = -1
let evLog = 0
let evOver = false
let evToAct = -2
let firstView = true
function seatXZ(i: number, r: number) {
  const a = rad(SEAT_ANG[i])
  return { x: TX + Math.cos(a) * RX * r, z: TZ + Math.sin(a) * RZ * r }
}
const edgePos = (i: number) => {
  const p = seatXZ(i, 0.95)
  return V(p.x, FELT_Y + 0.25, p.z)
}
const betPos = (i: number) => {
  const p = seatXZ(i, 0.5)
  return V(p.x, FELT_Y + 0.04, p.z)
}
function actionSound(line: string) {
  if (line.indexOf('(올인)') >= 0) return sfx('allin')
  if (line.indexOf('폴드') >= 0) return sfx('fold')
  if (line.indexOf('체크') >= 0) return sfx('check')
  if (line.indexOf(' 콜 ') >= 0) return sfx('call')
  if (line.indexOf(' 벳 ') >= 0) return sfx('bet')
  if (line.indexOf(' 레이즈 ') >= 0) return sfx('raise')
}
function clearWins() {
  for (const S of seats) {
    stopPop(S.win)
    TextShape.getMutable(S.win).text = ''
  }
}
function events(v: View) {
  const h = v.hand
  if (!h) {
    if (evHand !== -1) clearWins()
    evHand = -1
    firstView = false
    return
  }
  const t = Date.now()
  if (h.no !== evHand) {
    evHand = h.no
    clearWins()
    evLog = firstView && h.log.length > 2 ? h.log.length : 0
    evOver = firstView && h.over
    evToAct = -2
    for (let i = 0; i < 5; i++) {
      const p = h.ps[i]
      prevBet[i] = firstView && p && !h.over ? p.bet : 0
      landAt[i] = 0
    }
    potLandAt = 0
  }
  firstView = false
  // action sounds
  for (let k = evLog; k < h.log.length; k++) actionSound(h.log[k])
  evLog = h.log.length
  // chips flying in (bets) and out to the pot (end of a betting round)
  let collected = false
  for (let i = 0; i < 5; i++) {
    const p = h.ps[i]
    const bet = p && !h.over ? p.bet : 0
    const S = seats[i]
    if (bet > prevBet[i]) {
      Transform.getMutable(S.flyer).scale = V(0.17, chipH(bet - prevBet[i]), 0.17)
      fly(S.flyer, edgePos(i), betPos(i), 0, 420, 0.35)
      if (prevBet[i] === 0) landAt[i] = t + 420
    } else if (bet === 0 && prevBet[i] > 0) {
      Transform.getMutable(S.flyer).scale = V(0.17, chipH(prevBet[i]), 0.17)
      fly(S.flyer, betPos(i), POT_POS, 0, 480, 0.3)
      collected = true
    }
    prevBet[i] = bet
  }
  if (collected) {
    sfx('collect', 120)
    if (!h.over) potLandAt = Math.max(potLandAt, t + 480)
  }
  // my turn
  if (!h.over && h.toAct !== evToAct) {
    evToAct = h.toAct
    const me = v.me
    if (me && me.seat != null && me.seat === h.toAct) sfx('turn', 150)
  }
  if (h.over && !evOver) {
    evOver = true
    handOver(v, collected ? 650 : 250)
  }
}
function handOver(v: View, wait: number) {
  const h = v.hand
  if (!h || !h.result) return
  const res = h.result
  const show = res.reason === 'show'
  const winners = Object.keys(res.wins).map(Number)
  const me = v.me
  const mySeat = me && me.seat != null ? me.seat : -1
  const iWon = winners.indexOf(mySeat) >= 0
  const myP = mySeat >= 0 ? h.ps[mySeat] : null
  const iLost = !iWon && !!myP && !!myP.current && (show ? res.shown[String(mySeat)] != null : false)
  potHideAt = Date.now() + wait + 100
  potLandAt = 0
  schedule(wait, () => {
    for (const w of winners) {
      const S = seats[w]
      Transform.getMutable(S.flyer).scale = V(0.17, 0.12, 0.17)
      const a = rad(SEAT_ANG[w])
      fly(S.flyer, POT_POS, V(TX + Math.cos(a) * 4.0, 1.2, TZ + Math.sin(a) * 2.7), 0, 750, 0.8)
      const tm = TextShape.getMutable(S.win)
      tm.text = 'WIN!\n<size=45%>+' + fmt(res.wins[String(w)]) + (res.shown[String(w)] ? '  ' + handName(res.shown[String(w)]) : '') + '</size>'
      tm.textColor = GOLD
      popText(S.win, 1)
      fireworks(V(TX + Math.cos(a) * 4.2, 3.3, TZ + Math.sin(a) * 2.9), show ? 3 : 1)
    }
    if (show) {
      for (const k of Object.keys(res.shown)) {
        const i = Number(k)
        if (winners.indexOf(i) >= 0) continue
        const tm = TextShape.getMutable(seats[i].win)
        tm.text = 'LOSE'
        tm.textColor = Color4.fromHexString('#FF5A5AFF')
        popText(seats[i].win, 0.7)
      }
    }
    sfx(iLost ? 'lose' : 'win')
    if (iWon) {
      store.banner = 'YOU WIN  +' + fmt(res.wins[String(mySeat)])
      store.bannerWin = true
      store.bannerUntil = Date.now() + 3500
    } else if (iLost) {
      const w = winners[0]
      const wp = h.ps[w]
      store.banner = 'YOU LOSE' + (wp ? '  ·  ' + displayName(wp.name) + ' wins' : '')
      store.bannerWin = false
      store.bannerUntil = Date.now() + 3000
    }
  })
}

/* ---------- per-frame render from the server view ---------- */
export function renderTable() {
  const v = store.view
  if (!v) {
    setText(statusText, store.status === 'waking' ? 'Waking the table up...' : 'Connecting...')
    return
  }
  renderRanking(v)
  renderCharacters(v)
  events(v)
  const h = v.hand
  const live = h && !h.over
  for (let i = 0; i < 5; i++) {
    const S = seats[i]
    const s = v.seats[i]
    const p = h ? h.ps[i] : null
    // name plate
    if (!s) setText(S.name, 'OPEN SEAT\n<size=70%>click to sit</size>', DIM)
    else {
      let line2 = fmt(s.chips)
      if (s.away) line2 += ' · away'
      else if (!s.online) line2 += ' · offline'
      if (p && p.allin && live) line2 = 'ALL-IN'
      const win = h && h.over && h.result && h.result.wins[String(i)]
      if (win) line2 = '+' + fmt(win) + (h && h.result && h.result.shown[String(i)] ? ' ' + handName(h.result.shown[String(i)]) : '')
      const col = win ? GOLD : live && h && h.toAct === i ? GOLD : s.me ? CYAN : p && p.folded ? DIM : WHITE
      setText(S.name, displayName(s.name) + '\n<size=75%>' + line2 + '</size>', col)
    }
    // bet stack (hidden while its chips are still flying in)
    const bet = p && live ? p.bet : 0
    const stackOn = bet > 0 && Date.now() >= landAt[i]
    VisibilityComponent.getMutable(S.chip).visible = stackOn
    if (stackOn) Transform.getMutable(S.chip).scale = V(0.2, chipH(bet), 0.2)
    setText(S.bet, stackOn ? fmt(bet) : '')
    VisibilityComponent.getMutable(S.glow).visible = !!(live && h && h.toAct === i)
  }
  // hole cards: dealt one at a time around the table, starting left of the button
  const want: (string | null | undefined)[][] = []
  for (let i = 0; i < 5; i++) {
    const s = v.seats[i]
    const p = h ? h.ps[i] : null
    let c: (string | null | undefined)[] = [undefined, undefined]
    if (p && !p.folded && s && p.current) {
      if (p.cards) c = [p.cards[0], p.cards[1]]
      else if (live) c = [null, null]
    }
    want.push(c)
  }
  const start = h ? (h.button + 1) % 5 : 0
  let dealN = 0
  const flipSeats: number[] = []
  for (let k = 0; k < 5; k++) {
    const i = (start + k) % 5
    const c = want[i][0]
    if (shown.get(seats[i].cards[0]) === 'back' && c) flipSeats.push(i)
  }
  for (let ci = 0; ci < 2; ci++) {
    for (let k = 0; k < 5; k++) {
      const i = (start + k) % 5
      const prev = shown.get(seats[i].cards[ci])
      const next = want[i][ci]
      const willFlip = prev === 'back' && next !== undefined && next !== null
      const r = showCard(seats[i].cards[ci], next, willFlip ? Math.max(0, flipSeats.indexOf(i)) * 450 + ci * 150 : dealN * 140)
      if (r === 'deal') dealN++
    }
  }
  // board: the flop turns up card by card
  let boardN = 0
  for (let k = 0; k < 5; k++) {
    const r = showCard(board[k], h && h.board[k] ? h.board[k] : undefined, 250 + boardN * 280)
    if (r) boardN++
  }
  // chips in the middle
  const sumBets = h && live ? h.ps.reduce((a, q) => a + (q ? q.bet : 0), 0) : 0
  const middle = h ? h.pot - sumBets : 0
  const pileOn = !!h && middle > 0 && Date.now() >= potLandAt && (live || Date.now() < potHideAt)
  VisibilityComponent.getMutable(potPile).visible = pileOn
  if (pileOn) {
    const k = Math.min(1.8, 0.7 + Math.log10(middle + 1) * 0.25)
    Transform.getMutable(potPile).scale = V(1, k, 1)
  }
  setText(potText, h && h.pot > 0 ? 'POT ' + fmt(h.pot) : '')
  // dealer button
  const btn = h ? h.button : v.button
  const dv = VisibilityComponent.getMutable(dealer)
  dv.visible = btn >= 0 && !!v.seats[btn]
  if (dv.visible) {
    const a = rad(SEAT_ANG[btn])
    const t = Transform.getMutable(dealer)
    t.position = V(TX + Math.cos(a) * RX * 0.62 - Math.sin(a) * 0.45, FELT_Y + 0.016, TZ + Math.sin(a) * RZ * 0.62 + Math.cos(a) * 0.45)
  }
  // status line above the table
  setText(statusText, statusLine(v), CYAN)
}

function statusLine(v: View): string {
  const h = v.hand
  const now = Date.now()
  if (h && !h.over) {
    const who = h.toAct >= 0 && v.seats[h.toAct] ? displayName(v.seats[h.toAct]!.name) : ''
    const left = Math.max(0, Math.ceil((store.turnEnd - now) / 1000))
    const last = h.log.length ? logLine(h.log[h.log.length - 1]) : ''
    return (last ? last + '\n' : '') + (who ? `<size=70%>${who}'s turn · ${left}s</size>` : '')
  }
  if (h && h.over && h.result) {
    const parts = Object.keys(h.result.wins).map((i) => {
      const s = h.ps[Number(i)]
      const hn = h.result!.shown[i]
      return (s ? displayName(s.name) : '?') + ' wins ' + fmt(h.result!.wins[i]) + (hn ? ` (${handName(hn)})` : '')
    })
    const nxt = v.nextIn ? `\n<size=70%>Next hand in ${Math.max(0, Math.ceil((v.nextIn - (now - store.viewAt)) / 1000))}s</size>` : ''
    return parts.join('\n') + nxt
  }
  const seated = v.seats.filter((s) => s).length
  if (v.nextIn) return `Next hand in ${Math.max(0, Math.ceil((v.nextIn - (now - store.viewAt)) / 1000))}s`
  if (seated < 2) return "TEXAS HOLD'EM\n<size=60%>click an open seat to play vs AI Alpha</size>"
  return "TEXAS HOLD'EM"
}

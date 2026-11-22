import { engine, Transform, GltfContainer, LightSource, SkyboxTime, TextAlignMode, pointerEventsSystem, InputAction, Tween } from '@dcl/sdk/ecs'
import { openExternalUrl, teleportTo } from '~system/RestrictedActions'
import { Color3, Quaternion } from '@dcl/sdk/math'
import LAYOUT from '../layout.json'
import { node, text, setText, hitbox, bob, V, FACE } from './helpers'
import { topRuns, topPvp } from './game/net'
import { save, loadBoard, raidPublic } from './game/persist'
import { G, equipped, openGoldShop } from './game/game'
import { ARMORY, RAID_PARCEL } from './game/defs'

export function buildWorld() {
  // night sky
  SkyboxTime.create(engine.RootEntity, { fixedTime: 79200 })

  // all static geometry = one GLB made in Blender (blender/build_arena.py)
  const arena = engine.addEntity()
  Transform.create(arena)
  GltfContainer.create(arena, { src: 'models/arena.glb' })
  // THE BLOOD RING: the PvP block at the north end (parcels -106..-105, 79..80)
  const blood = engine.addEntity()
  Transform.create(blood, { position: V(0, 0, 0) })
  GltfContainer.create(blood, { src: 'models/pvp_zone.glb' })
  text(V(24, 7.1, 47.55), '⚔ THE BLOOD RING ⚔', 4.2, '#FF3B4E', { rot: FACE.south, outline: '#200000' })
  text(V(24, 6.35, 47.55), 'PvP ZONE · hunters can attack each other here', 2.0, '#FFD0D6', { rot: FACE.south, outline: '#200000' })
  text(V(24, 7.1, 48.45), 'leave the ring to be safe from hunters', 2.0, '#FFD0D6', { rot: FACE.north, outline: '#200000' })

  // floating rift cores above each rune circle (Blender GLB, slow spin)
  for (const [x, y, z] of [[32, 7.5, 24], [16, 7.5, 64]]) {
    const holder = node(V(x, y, z))
    bob(holder, 0.35, 3200)
    const core = node(V(0, 0, 0), undefined, holder)
    GltfContainer.create(core, { src: 'models/rift_core.glb' })
    Tween.setRotateContinuous(core, Quaternion.fromEulerDegrees(0, 1, 0), 25)
  }

  // lights: fire lamps, rift cores, gates, cathedral
  const fire = Color3.create(1, 0.55, 0.22)
  for (const [x, z] of [[24, 10], [40, 10], [24, 38], [40, 38], [8, 58], [24, 70]])
    LightSource.create(node(V(x, 4.2, z)), { type: LightSource.Type.Point({}), color: fire, intensity: 2200, range: 14 })
  const soul = Color3.create(0.6, 0.3, 1)
  LightSource.create(node(V(32, 6, 24)), { type: LightSource.Type.Point({}), color: soul, intensity: 5000, range: 20 })
  LightSource.create(node(V(16, 6, 64)), { type: LightSource.Type.Point({}), color: soul, intensity: 5000, range: 20 })
  LightSource.create(node(V(16, 6, 74)), { type: LightSource.Type.Point({}), color: Color3.create(0.75, 0.35, 1), intensity: 3500, range: 16 })
  // warm lantern light under each dome's oculus ring
  LightSource.create(node(V(32, 14, 24)), { type: LightSource.Type.Point({}), color: fire, intensity: 6000, range: 24 })
  LightSource.create(node(V(16, 13, 64)), { type: LightSource.Type.Point({}), color: fire, intensity: 5000, range: 20 })
  LightSource.create(node(V(8, 4, 8)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.8, 0.45), intensity: 2500, range: 14 })
  // (the -103,78 cell is the GYBM casino now; it brings its own lights)

  // ── Sanctuary ──
  const title = node(V(8, 4.2, 8))
  bob(title, 0.15, 2200)
  text(V(0, 0.4, 0), 'WOW NIGHTSWARM', 9, '#FFD86A', { parent: title, billboard: true, outline: '#2A0A3A' })
  text(V(0, -0.45, 0), 'Hold the rift. Break the swarm. Hunt your rivals.', 2.6, '#E8E2FF', { parent: title, billboard: true })
  // ── Hall of Gods: the ones who defeated THE ALMIGHTY (Lv 1111) ──
  const gods = node(V(8, 6.7, 8))
  bob(gods, 0.12, 2600)
  text(V(0, 0.35, 0), '☀ HALL OF GODS ☀', 4.4, '#FFD86A', { parent: gods, billboard: true, outline: '#2A1A00' })
  const godsT = text(V(0, -0.55, 0), '', 2.6, '#FFF6D8', { parent: gods, billboard: true, outline: '#2A1A00' })
  let godsAcc = 3
  engine.addSystem((dt) => {
    godsAcc += dt
    if (godsAcc < 3) return
    godsAcc = 0
    const g = save.board?.gods ?? []
    setText(godsT, g.length ? g.slice(0, 6).join('  ·  ') : 'No one has become God… yet.\nDefeat THE ALMIGHTY at Lv 1111.')
  })
  const [hx, , hz] = LAYOUT.howto
  text(V(hx, 2.75, hz - 0.13), 'HOW TO PLAY', 4.2, '#FFD86A', { rot: FACE.south })
  text(
    V(hx - 1.95, 1.45, hz - 0.13),
    'Walk through the gate to start a run.\nSkills fire on their own · HOLD LEFT CLICK to\nattack with your Armory weapon · F = nuke.\nGems → level up → upgrades. Max a skill + its\npartner passive, open a vault to ASCEND it.\nA BOSS rises every few levels — the World Eater\nat Lv 200, tyrants to Lv 1000, GOD at Lv 1111.\nClaim your DAILY reward · first run = 2x gold.\nOther hunters can hurt you in the rift!',
    2.15,
    '#FFFFFF',
    { rot: FACE.south, align: TextAlignMode.TAM_MIDDLE_LEFT }
  )
  const [sx, , sz] = LAYOUT.shrine
  const shrineHit = hitbox(V(sx, 1.4, sz), V(2.6, 2.8, 2.6))
  pointerEventsSystem.onPointerDown({ entity: shrineHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Arcane Forge — spend gold', maxDistance: 8 } }, () => {
    G.shopOpen = true
  })
  text(V(sx, 3.4, sz), 'ARCANE FORGE', 3.2, '#5EF2FF', { billboard: true, outline: '#001A22' })

  // creator credit at the spawn point — click to open X
  const xHolder = node(V(9.2, 3.0, 12.2))
  bob(xHolder, 0.08, 2600)
  text(V(0, 0.45, 0), 'Created by', 1.6, '#CFC8E8', { billboard: true, parent: xHolder })
  text(V(0, 0, 0), 'X / Twitter  @bitcoinisnotall', 3.4, '#FFFFFF', { billboard: true, outline: '#1D9BF0', parent: xHolder })
  text(V(0, -0.45, 0), 'click to follow', 1.4, '#1D9BF0', { billboard: true, parent: xHolder })
  const xHit = hitbox(V(9.2, 3.0, 12.2), V(3.4, 1.6, 1.0))
  pointerEventsSystem.onPointerDown({ entity: xHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Follow @bitcoinisnotall on X', maxDistance: 12 } }, () => {
    void openExternalUrl({ url: 'https://x.com/bitcoinisnotall' })
  })

  // GATE TO THE REAPER'S REALM — co-op world boss on parcel -91,71
  const gate = node(V(6.0, 0, 14.4), Quaternion.fromEulerDegrees(0, 180, 0))
  GltfContainer.create(gate, { src: 'models/raid_gate.glb' })
  const swirl = node(V(0, 2.2, 0.05), Quaternion.fromEulerDegrees(0, 180, 0), gate)
  GltfContainer.create(swirl, { src: 'models/fx_r_portal.glb' })
  Tween.setRotateContinuous(swirl, Quaternion.fromEulerDegrees(0, 0, 1), 60)
  text(V(6.0, 6.3, 14.2), "THE REAPER'S REALM", 2.6, '#FF7A4A', { outline: '#2A0006', billboard: true })
  const raidSign = text(V(6.0, 5.5, 14.2), 'co-op world boss', 1.5, '#E8C8FF', { billboard: true })
  LightSource.create(node(V(6.0, 2.5, 13.6)), { type: LightSource.Type.Point({}), color: Color3.create(0.7, 0.4, 1), intensity: 3000, range: 8 })
  const gateHit = hitbox(V(6.0, 2.2, 14.2), V(3.4, 4.2, 1.2))
  pointerEventsSystem.onPointerDown({ entity: gateHit, opts: { button: InputAction.IA_POINTER, hoverText: "Enter the Reaper's Realm (-91,71)", maxDistance: 12 } }, () => {
    void teleportTo({ worldCoordinates: { x: RAID_PARCEL.x, y: RAID_PARCEL.y } })
  })
  let raidT = 99
  engine.addSystem((dt) => {
    raidT += dt
    if (raidT < 30) return
    raidT = 0
    raidPublic()
      .then((r) => {
        if (!r) return
        const left = Math.max(0, r.respawnAt - r.now)
        setText(
          raidSign,
          r.alive
            ? `THE PALE SOVEREIGN · ${Math.ceil((r.hp / r.maxHp) * 100)}% HP\nhunt him together · relics for every hunter\n<size=70%>click the rift to enter</size>`
            : `the reaper is slain${r.killer ? ` (by ${r.killer})` : ''}\nrises again in ${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m`
        )
      })
      .catch(() => {})
  })

  // THE TREASURY (gold shop) — overflowing chest kiosk facing the spawn; click to open
  const [tx, , tz] = LAYOUT.treasury
  const tre = node(V(tx, 0, tz), Quaternion.fromEulerDegrees(0, -92, 0))
  GltfContainer.create(tre, { src: 'models/treasury.glb' })
  const coinHolder = node(V(0, 2.7, 0.1), undefined, tre)
  bob(coinHolder, 0.25, 1600)
  const bigCoin = node(V(0, 0, 0), undefined, coinHolder, V(4, 4, 4))
  GltfContainer.create(bigCoin, { src: 'models/coin.glb' })
  Tween.setRotateContinuous(bigCoin, Quaternion.fromEulerDegrees(0, 1, 0), 120)
  text(V(0, 3.2, -1.0), 'THE TREASURY', 3.0, '#FFD86A', { parent: tre, outline: '#3A1A00', rot: Quaternion.fromEulerDegrees(0, 180, 0) })
  text(V(0, 5.6, -1.2), 'BUY GOLD', 4.2, '#FFFFFF', { parent: tre, outline: '#9A3BFF', rot: Quaternion.fromEulerDegrees(0, 180, 0) })
  text(V(0, 1.6, 1.9), 'first purchase +50% gold', 1.8, '#3DFF8E', { parent: tre, billboard: true })
  LightSource.create(node(V(tx, 3.5, tz)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.78, 0.35), intensity: 3000, range: 10 })
  const treHit = hitbox(V(tx, 1.5, tz), V(4, 3, 4))
  pointerEventsSystem.onPointerDown({ entity: treHit, opts: { button: InputAction.IA_POINTER, hoverText: 'The Treasury — buy gold', maxDistance: 10 } }, () => openGoldShop())

  // Armory: the weapon you'd swing floats over a pedestal; click to open the shop
  const [ax, , az] = LAYOUT.armory
  const showHolder = node(V(ax, 1.7, az))
  bob(showHolder, 0.15, 1800)
  const show = node(V(0, 0, 0), undefined, showHolder, V(1.4, 1.4, 1.4))
  Tween.setRotateContinuous(show, Quaternion.fromEulerDegrees(0, 1, 0), 60)
  let shown = -1
  engine.addSystem(() => {
    const t = equipped()
    if (t !== shown) {
      shown = t
      GltfContainer.createOrReplace(show, { src: ARMORY[t].model })
    }
  })
  const armHit = hitbox(V(ax, 1.3, az), V(2.4, 2.6, 2.4))
  pointerEventsSystem.onPointerDown({ entity: armHit, opts: { button: InputAction.IA_POINTER, hoverText: 'Armory — your own weapons', maxDistance: 8 } }, () => {
    G.armoryOpen = true
  })
  text(V(ax, 3.1, az), 'ARMORY', 3.2, '#FFB84A', { billboard: true, outline: '#2A1400' })
  text(V(ax, 2.7, az), 'fists → pan → hammer → swords → minigun → ☢', 1.6, '#FFFFFF', { billboard: true })

  // gate signs
  const lg = LAYOUT.lobby
  const gz = (lg.gateZ0 + lg.gateZ1) / 2
  text(V(15.84, 8.3, gz), 'THE RIFT', 3.4, '#FF5468', { rot: FACE.west, outline: '#200000' })
  text(V(17.48, 8.3, gz), 'SANCTUARY · SAFE', 3.4, '#5EF2FF', { rot: FACE.east, outline: '#001A22' })
  const lgd = LAYOUT.legends
  const gz2 = (lgd.gateZ0 + lgd.gateZ1) / 2
  text(V(46.44, 8.3, gz2), 'GYBM CASINO · GOLD HOLD\'EM', 3.0, '#FFD86A', { rot: FACE.west, outline: '#2A1A00' })
  text(V(16, 10.4, 78.22), 'THE HOLLOW KING AWAITS', 4, '#C79BFF', { outline: '#10001A' })

  // ── Hall of Legends leaderboard ──
  // the board hangs on the arena side of the R1 east wall, facing west: board-local u (reader's right) = −z
  const [lx, , lz] = LAYOUT.leaderboard
  const bp = (u: number, y: number) => V(lx - 0.12, y, lz - u)
  const W = { rot: FACE.west }
  text(bp(0, 6.85), 'HALL OF LEGENDS', 7.5, '#FFD86A', { ...W, outline: '#2A1A00' })
  text(bp(-5.9, 5.75), 'THIS WEEK (LIVE)', 3.4, '#3DFF8E', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  text(bp(-1.7, 5.75), 'ALL-TIME (LIVE)', 3.4, '#5EF2FF', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  text(bp(2.5, 5.75), 'PvP · SLAYERS', 3.4, '#FF5468', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  const weekT = text(bp(-5.9, 3.2), '', 2.5, '#FFFFFF', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  const runsT = text(bp(-1.7, 3.2), '', 2.5, '#FFFFFF', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  const pvpT = text(bp(2.5, 3.2), '', 2.5, '#FFFFFF', { ...W, align: TextAlignMode.TAM_MIDDLE_LEFT })
  let acc = 2
  let boardT = 0
  engine.addSystem((dt) => {
    acc += dt
    boardT += dt
    // live boards: refresh every 15 s (players mid-run show up with a red dot)
    if (boardT > 15) {
      boardT = 0
      void loadBoard()
    }
    if (acc < 2) return
    acc = 0
    const row = (r: { n: string; t: number; l: number; live?: boolean }, i: number) => `${i + 1}. ${r.live ? '● ' : ''}${r.n.substring(0, 10)}  ${mmss(r.t)}  Lv${r.l}`
    const wk = save.board?.weekly ?? []
    setText(weekT, wk.length ? wk.slice(0, 8).map(row).join('\n') : 'Nobody yet this week.\nTop 10 win gold!')
    // all-time board from the save server; falls back to this session's synced board
    const runs = save.board?.allTime?.length ? save.board.allTime : save.board?.runs?.length ? save.board.runs : topRuns()
    setText(runsT, runs.length ? runs.slice(0, 8).map(row).join('\n') : 'No legends yet.\nBe the first!')
    const pv = save.board?.pvp?.length ? save.board.pvp : topPvp()
    const sl = save.board?.slayers ?? []
    setText(
      pvpT,
      (pv.length ? pv.map(([n, k], i) => `${i + 1}. ${n.substring(0, 11)}  ${k}`).join('\n') : 'No duels yet.') +
        `\n\n✦ NIGHTSWARM SLAYERS\n${sl.length ? sl.slice(0, 4).join('\n') : '— none yet —'}`
    )
  })
}

export function mmss(t: number) {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

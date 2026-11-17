// Headless balance simulation: a kiting bot plays full runs with different armory tiers.
// Build+run: node_modules/.bin/esbuild tools/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js
import { Run, Option, setRandom } from '../src/game/core'
import { WEAPONS, PASSIVES, WeaponId, PassiveId, BOSSES, bossFor, ARMORY } from '../src/game/defs'

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function score(r: Run, o: Option): number {
  if (o.kind === 'weapon') return r.w(o.id) > 0 ? 3 + o.to * 0.1 : r.weapons.size < 6 ? 2.6 : 0
  if (o.kind === 'passive') {
    const partner = (Object.keys(WEAPONS) as WeaponId[]).some((w) => WEAPONS[w].evoWith === o.id && r.w(w) > 0)
    return (partner ? 2.8 : 1.5) + (o.id === 'might' || o.id === 'vitality' || o.id === 'plating' ? 0.6 : 0)
  }
  if (o.kind === 'boost') return o.id === 'dmg' ? 2.2 : o.id === 'hp' ? 2.1 : o.id === 'regen' ? 1.5 : 1
  return 1
}

type Res = { tier: number; died: number; level: number; gold: number; kills: number; marks: Record<number, number>; bossKill: { name: string; at: number; took: number }[] }

function play(seed: number, tier: number, meta: { might: number; hp: number; magnet: number; xp: number }, maxT = 3600, skill = 1): Res {
  setRandom(mulberry(seed))
  const start: WeaponId[] = ['lash', 'bolt', 'orbit']
  const r = new Run(start[seed % 3], meta, tier)
  r.x = 32
  r.z = 24
  const dt = 0.1
  let ang = 0
  const marks: Record<number, number> = {}
  const bossKill: Res['bossKill'] = []
  let bossSpawnT = 0
  let bossName = ''
  while (r.alive && r.time < maxT) {
    // steer: toward gems/vaults, away from nearby foes (bosses and slams weigh more)
    let vx = 0
    let vz = 0
    let gBest = 1e9
    let gx = 32
    let gz = 24
    for (const p of r.pickups)
      if (p.alive) {
        const d = Math.hypot(p.x - r.x, p.z - r.z) - (p.kind === 'chest' ? 6 : 0)
        if (d < gBest) {
          gBest = d
          gx = p.x
          gz = p.z
        }
      }
    const gd = Math.hypot(gx - r.x, gz - r.z) || 1
    vx += ((gx - r.x) / gd) * 1.0
    vz += ((gz - r.z) / gd) * 1.0
    for (const e of r.enemies)
      if (e.alive) {
        const dx = r.x - e.x
        const dz = r.z - e.z
        const d = Math.max(0.3, Math.hypot(dx, dz) - e.r)
        const w = (e.kind === 'boss' ? (e.wind !== undefined ? 60 : 12) : 1.4) / (d * d)
        if (d < (e.kind === 'boss' ? 12 : 4)) {
          vx += (dx / d) * w
          vz += (dz / d) * w
        }
      }
    // pull toward the middle so we don't pin ourselves on walls
    vx += (32 - r.x) * 0.02
    vz += (24 - r.z) * 0.02
    const vl = Math.hypot(vx, vz) || 1
    const sp = 5.5 * skill * r.speedMul
    r.x = Math.min(47, Math.max(17, r.x + (vx / vl) * sp * dt))
    r.z = Math.min(47, Math.max(1, r.z + (vz / vl) * sp * dt))
    r.yaw = (Math.atan2(vx, vz) * 180) / Math.PI
    const ev = r.step(dt, false)
    // manual attack at nearest foe
    let best = 1e9
    let ay = r.yaw
    for (const e of r.enemies)
      if (e.alive) {
        const d = Math.hypot(e.x - r.x, e.z - r.z)
        if (d < best) {
          best = d
          ay = (Math.atan2(e.x - r.x, e.z - r.z) * 180) / Math.PI
        }
      }
    if (best < 20) r.manualAttack(ay)
    if (r.canNuke && r.enemies.filter((e) => e.alive).length > 60) r.nuke(ay)
    for (const e of ev) {
      if (e.t === 'chest') r.openChest(e.big)
      if (e.t === 'bossSpawn') {
        bossSpawnT = r.time
        bossName = bossFor(e.boss).name
      }
      if (e.t === 'bossDown') bossKill.push({ name: bossName, at: Math.round(r.time), took: Math.round(r.time - bossSpawnT) })
    }
    while (r.pendingLevels > 0) {
      r.pendingLevels--
      const ch = r.levelChoices()
      ch.sort((a, b) => score(r, b) - score(r, a))
      r.apply(ch[0])
    }
    if (process.env.DBG && Math.round(r.time * 10) % 600 === 0) { const gm = r.pickups.filter((p) => p.alive && p.kind === "gem"); console.log(Math.round(r.time), "lv", r.level, "pend", r.pendingLevels, "xp", Math.round(r.xp), "need", r.need, "gems", gm.length, "val", gm.reduce((a, g) => a + g.value, 0), "pos", r.x.toFixed(1), r.z.toFixed(1), "alive", r.enemies.filter((e) => e.alive).length, "nanG", gm.filter((g) => !Number.isFinite(g.x)).length, "nanE", r.enemies.filter((e) => e.alive && !Number.isFinite(e.x)).length, "far", gm.filter((g) => Math.hypot(g.x - r.x, g.z - r.z) > 40).length, "fly", gm.filter((g) => g.flying).length, "ex", gm[0] && gm[0].x.toFixed(1), gm[0] && gm[0].z.toFixed(1), gm[0] && gm[0].value) }
    for (const L of [10, 20, 35, 50, 70, 90, 115, 140, 170, 200, 250]) if (r.level >= L && marks[L] === undefined) marks[L] = Math.round(r.time)
  }
  return { tier, died: Math.round(r.time), level: r.level, gold: r.gold, kills: r.kills, marks, bossKill }
}

const metaMid = { might: 3, hp: 3, magnet: 2, xp: 2 }
const metaMax = { might: 5, hp: 5, magnet: 5, xp: 5 }
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
if (process.env.DBG) { play(97 * 1 + 4, 4, metaMid); process.exit(0) }
for (const [label, meta, tier] of [
  ['new player, fists', { might: 0, hp: 0, magnet: 0, xp: 0 }, 0],
  ['mid meta, hammer', metaMid, 2],
  ['mid meta, reaper', metaMid, 4],
  ['max meta, minigun', metaMax, 5],
  ['max meta, nuke', metaMax, 6]
] as [string, any, number][]) {
  const rs = [1, 2, 3, 4].map((s) => play(s * 97 + tier, tier, meta))
  const avg = (f: (x: Res) => number) => Math.round(rs.reduce((a, x) => a + f(x), 0) / rs.length)
  console.log(`\n== ${label} (${ARMORY[tier].name}) ==  survive avg ${fmt(avg((x) => x.died))}  level avg ${avg((x) => x.level)}  gold avg ${avg((x) => x.gold)} (${(avg((x) => x.gold) / Math.max(1, avg((x) => x.died))).toFixed(1)}/s)`)
  for (const x of rs) {
    console.log(`  died ${fmt(x.died)} lv${x.level} gold ${x.gold} | lv: ` + Object.entries(x.marks).map(([l, t]) => `${l}@${fmt(t)}`).join(' '))
    console.log(`     bosses: ` + x.bossKill.map((b) => `${b.name.split(' ')[0]} ${b.took}s`).join(', '))
  }
}

// Compact wire format for sharing skill effects between players (see net.ts 'fx' channel).
import { Ev } from './core'

/** my run events → [code, ...numbers] packets (null = not shared) */
export function encodeFx(e: Ev, x: number, z: number): [number, number[]] | null {
  switch (e.t) {
    case 'slash': return [0, [e.x, e.z, e.yaw, e.w, e.l]]
    case 'nova': return [1, [e.x, e.z, e.r]]
    case 'strike': return [2, [e.x, e.z, e.r]]
    case 'swing': return [3, [e.x, e.z, e.yaw, e.range, e.arc, e.tier]]
    case 'quake': return [4, [e.x, e.z, e.r]]
    case 'tracer': return [5, [e.x, e.z, e.yaw, e.len]]
    case 'zeus': return [6, e.pts.slice(0, 9).flat()]
    case 'divine': return [7, [e.x, e.z, e.r]]
    case 'nukeLaunch': return [8, [e.x, e.z, e.tx, e.tz, e.delay]]
    case 'nuke': return [9, [e.x, e.z, e.r]]
    case 'slamWarn': return [10, [e.x, e.z, e.r, e.dur]]
    case 'slam': return [11, [e.x, e.z, e.r]]
    case 'levelup': return [12, [x, z]]
    case 'bossSpawn': return [13, [e.boss, x, z]]
    case 'bossDown': return [14, [e.boss, x, z]]
  }
  return null
}

/** packet → event for the renderer (boss events are returned as-is for the feed) */
export function decodeFx(p: number[]): Ev | null {
  const [c, a = 0, b = 0, d = 0, f = 0, g = 0, h = 0] = p
  switch (c) {
    case 0: return { t: 'slash', x: a, z: b, yaw: d, w: f, l: g }
    case 1: return { t: 'nova', x: a, z: b, r: d }
    case 2: return { t: 'strike', x: a, z: b, r: d }
    case 3: return { t: 'swing', x: a, z: b, yaw: d, range: f, arc: g, tier: Math.max(0, Math.min(5, Math.round(h))) }
    case 4: return { t: 'quake', x: a, z: b, r: d }
    case 5: return { t: 'tracer', x: a, z: b, yaw: d, len: Math.min(30, f) }
    case 6: {
      const pts: [number, number][] = []
      for (let i = 1; i + 1 < p.length && pts.length < 9; i += 2) pts.push([p[i], p[i + 1]])
      return { t: 'zeus', pts }
    }
    case 7: return { t: 'divine', x: a, z: b, r: Math.min(14, d) }
    case 8: return { t: 'nukeLaunch', x: a, z: b, tx: d, tz: f, delay: Math.min(3, g) }
    case 9: return { t: 'nuke', x: a, z: b, r: Math.min(20, d) }
    case 10: return { t: 'slamWarn', x: a, z: b, r: Math.min(12, d), dur: Math.min(3, f) }
    case 11: return { t: 'slam', x: a, z: b, r: Math.min(12, d) }
    case 12: return { t: 'levelup', x: a, z: b } as any
    case 13: return { t: 'bossSpawn', boss: Math.max(0, Math.round(a)) }
    case 14: return { t: 'bossDown', boss: Math.max(0, Math.round(a)) }
  }
  return null
}

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
    case 'comet': return [15, [e.x, e.z, e.r]]
    case 'frostHit': return [16, [e.x, e.z, e.r]]
    case 'arc': return [17, e.pts.slice(0, 9).flat()]
    case 'chakram': return [18, [e.x, e.z, e.yaw, e.d, e.dur]]
    case 'boom': return [19, [e.x, e.z, e.r]]
    case 'sweep': return [20, [e.x, e.z, e.yaw, e.len, e.dur, e.n]]
    case 'dash': return [21, [e.x0, e.z0, e.x1, e.z1]]
    case 'kame': return [22, [e.x, e.z, e.yaw, e.len, e.w, e.dur, e.max ? 1 : 0]]
    case 'meteorFall': return [23, [e.x, e.z, e.delay, e.big ? 1 : 0]]
    case 'gnuke': return [24, [e.x, e.z, e.r]]
    case 'hole': return [25, [e.x, e.z, e.r, e.dur, e.max ? 1 : 0]]
    case 'gsword': return [26, [e.x, e.z, e.delay, e.max ? 1 : 0]]
    case 'proj': return [27, [e.x, e.z, e.vx, e.vz, e.life, e.k]]
    case 'mine': return [28, [e.x, e.z]]
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
    case 15: return { t: 'comet', x: a, z: b, r: Math.min(6, d) }
    case 16: return { t: 'frostHit', x: a, z: b, r: Math.min(6, d) }
    case 17: {
      const pts: [number, number][] = []
      for (let i = 1; i + 1 < p.length && pts.length < 9; i += 2) pts.push([p[i], p[i + 1]])
      return { t: 'arc', pts }
    }
    case 18: return { t: 'chakram', x: a, z: b, yaw: d, d: Math.min(14, f), dur: Math.min(2, g) }
    case 19: return { t: 'boom', id: 0, x: a, z: b, r: Math.min(8, d) }
    case 20: return { t: 'sweep', x: a, z: b, yaw: d, len: Math.min(16, f), dur: Math.min(1.5, g), n: Math.max(1, Math.min(3, Math.round(h))) }
    case 21: return { t: 'dash', x0: a, z0: b, x1: d, z1: f }
    case 22: return { t: 'kame', x: a, z: b, yaw: d, len: Math.min(40, f), w: Math.min(8, g), dur: Math.min(2, h), max: !!p[7] }
    case 23: return { t: 'meteorFall', x: a, z: b, delay: Math.min(3, d), big: !!f }
    case 24: return { t: 'gnuke', x: a, z: b, r: Math.min(12, d) }
    case 25: return { t: 'hole', x: a, z: b, r: Math.min(12, d), dur: Math.min(3, f), max: !!g }
    case 26: return { t: 'gsword', x: a, z: b, delay: Math.min(2, d), max: !!f }
    case 27: return { t: 'proj', x: a, z: b, vx: Math.max(-25, Math.min(25, d)), vz: Math.max(-25, Math.min(25, f)), life: Math.max(0.1, Math.min(2, g)), k: Math.max(0, Math.min(5, Math.round(h))) }
    case 28: return { t: 'mine', id: 0, x: a, z: b }
  }
  return null
}

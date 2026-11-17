// Must stay in sync with src/game/game.ts (META, metaCost) on the scene side.
export const META_KEYS = ['might', 'hp', 'magnet', 'xp'] as const
export type MetaKey = (typeof META_KEYS)[number]
export const META_MAX = 5
export const metaCost = (lvl: number) => 80 * (lvl + 1) * (lvl + 1)

/** Anti-cheat ceilings. The game runs on the player's client, so the server only accepts plausible results. */
export const LIMITS = {
  goldPerSecond: 12, // strongest simulated runs earn ~6.5 gold/s
  goldPerPvpKill: 150,
  goldBase: 0, // no free allowance, otherwise run-spam would farm gold
  killsPerSecond: 20,
  pvpKillsPerMinute: 4,
  timeSlackSec: 10, // network delay allowance between start and end
  maxRunSec: 3 * 3600,
  minSecondsBetweenStarts: 4,
  pvpDeathKeep: 0.7 // gold kept when killed by another player
}

export function clampRun(claim: { time: number; level: number; kills: number; gold: number; pvpKills: number; killedByPlayer: boolean }, elapsedSec: number) {
  const time = Math.max(0, Math.min(claim.time, elapsedSec + LIMITS.timeSlackSec, LIMITS.maxRunSec))
  const pvpKills = Math.max(0, Math.min(Math.floor(claim.pvpKills), Math.floor((time / 60) * LIMITS.pvpKillsPerMinute)))
  const goldCap = Math.floor(LIMITS.goldBase + LIMITS.goldPerSecond * time + LIMITS.goldPerPvpKill * pvpKills)
  const rawGold = Math.max(0, Math.min(Math.floor(claim.gold), goldCap))
  const gold = Math.floor(rawGold * (claim.killedByPlayer ? LIMITS.pvpDeathKeep : 1))
  const kills = Math.max(0, Math.min(Math.floor(claim.kills), Math.ceil(LIMITS.killsPerSecond * time) + 50))
  const level = Math.max(1, Math.min(Math.floor(claim.level), 1 + Math.ceil(time / 4) + 5 * pvpKills))
  const flagged = claim.time > elapsedSec + LIMITS.timeSlackSec || claim.gold > goldCap || claim.kills > kills
  return { time: Math.floor(time), level, kills, gold, pvpKills, flagged }
}

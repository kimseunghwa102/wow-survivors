import { engine, Entity, Transform, AudioSource } from '@dcl/sdk/ecs'

export type Sfx =
  | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'hurt' | 'jackpot' | 'death' | 'boss' | 'pvp' | 'evolve'
  | 'slash' | 'shard' | 'sigil' | 'pulse' | 'elite' | 'ring' | 'click'
  | 'punch' | 'bonk' | 'smash' | 'flameslash' | 'reaper' | 'gun' | 'nukelaunch' | 'nuke' | 'roar' | 'slam' | 'warn' | 'buy'
const VOL: Record<Sfx, number> = {
  hit: 0.22, kill: 0.3, gem: 0.3, coin: 0.5, levelup: 0.8, hurt: 0.55, jackpot: 0.85, death: 0.9, boss: 1, pvp: 0.9, evolve: 1,
  slash: 0.35, shard: 0.22, sigil: 0.45, pulse: 0.5, elite: 0.85, ring: 0.8, click: 0.5,
  punch: 0.5, bonk: 0.6, smash: 0.7, flameslash: 0.55, reaper: 0.6, gun: 0.3, nukelaunch: 0.9, nuke: 1, roar: 1, slam: 0.85, warn: 0.6, buy: 0.8
}
const MIN_GAP: Partial<Record<Sfx, number>> = { hit: 0.07, kill: 0.06, gem: 0.05, shard: 0.12, sigil: 0.15, slash: 0.1, gun: 0.06 }
let music: Entity | undefined
const chans = new Map<Sfx, Entity>()
const last = new Map<Sfx, number>()
let clock = 0

export function setupSfx() {
  for (const k of Object.keys(VOL) as Sfx[]) {
    const e = engine.addEntity()
    Transform.create(e)
    AudioSource.create(e, { audioClipUrl: `sounds/${k}.wav`, playing: false, volume: VOL[k], global: true })
    chans.set(k, e)
  }
  // ambient score (seamless loop)
  music = engine.addEntity()
  Transform.create(music)
  AudioSource.create(music, { audioClipUrl: 'sounds/music.mp3', playing: true, loop: true, volume: 0.28, global: true })
  engine.addSystem((dt) => {
    clock += dt
  })
}

export function play(k: Sfx, pitch = 1) {
  const gap = MIN_GAP[k] ?? 0
  if (clock - (last.get(k) ?? -9) < gap) return
  last.set(k, clock)
  const e = chans.get(k)
  if (!e) return
  const a = AudioSource.getMutable(e)
  a.pitch = pitch
  AudioSource.playSound(e, `sounds/${k}.wav`, true)
}

/** duck the score a little during runs so combat sounds cut through */
let musicBase = -1
let ducked = false
export function musicLevel(v: number) {
  musicBase = v
  if (music) AudioSource.getMutable(music).volume = ducked ? 0 : v
}
/** silence the castle music (the casino plays its own lounge jazz) */
export function duckMusic(on: boolean) {
  if (on === ducked || !music) return
  ducked = on
  const a = AudioSource.getMutable(music)
  if (musicBase < 0) musicBase = a.volume ?? 0.2
  a.volume = on ? 0 : musicBase
}

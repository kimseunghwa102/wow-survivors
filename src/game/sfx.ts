import { engine, Entity, Transform, AudioSource } from '@dcl/sdk/ecs'

export type Sfx =
  | 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'hurt' | 'jackpot' | 'death' | 'boss' | 'pvp' | 'evolve'
  | 'slash' | 'shard' | 'sigil' | 'pulse' | 'elite' | 'ring' | 'click'
const VOL: Record<Sfx, number> = {
  hit: 0.22, kill: 0.3, gem: 0.3, coin: 0.5, levelup: 0.8, hurt: 0.55, jackpot: 0.85, death: 0.9, boss: 1, pvp: 0.9, evolve: 1,
  slash: 0.35, shard: 0.22, sigil: 0.45, pulse: 0.5, elite: 0.85, ring: 0.8, click: 0.5
}
const MIN_GAP: Partial<Record<Sfx, number>> = { hit: 0.07, kill: 0.06, gem: 0.05, shard: 0.12, sigil: 0.15, slash: 0.1 }
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
export function musicLevel(v: number) {
  if (music) AudioSource.getMutable(music).volume = v
}

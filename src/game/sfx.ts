import { engine, Entity, Transform, AudioSource } from '@dcl/sdk/ecs'

export type Sfx = 'hit' | 'kill' | 'gem' | 'coin' | 'levelup' | 'hurt' | 'jackpot' | 'death' | 'boss' | 'pvp' | 'evolve'
const VOL: Record<Sfx, number> = {
  hit: 0.25, kill: 0.3, gem: 0.35, coin: 0.6, levelup: 0.8, hurt: 0.6, jackpot: 0.9, death: 0.9, boss: 1, pvp: 0.9, evolve: 1
}
const MIN_GAP: Partial<Record<Sfx, number>> = { hit: 0.07, kill: 0.06, gem: 0.05 }
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

import { engine, Entity, Transform, AudioSource } from '@dcl/sdk/ecs'

export type Sfx = 'r_roar' | 'r_laugh' | 'r_swing' | 'r_slam' | 'r_erupt' | 'r_bolt' | 'r_timestop' | 'r_hit' | 'r_hurt' | 'r_death' | 'r_loot' | 'r_portal'
const VOL: Record<Sfx, number> = {
  r_roar: 1, r_laugh: 0.95, r_swing: 0.9, r_slam: 1, r_erupt: 0.75, r_bolt: 0.55, r_timestop: 0.8, r_hit: 0.35, r_hurt: 0.7, r_death: 1, r_loot: 0.9, r_portal: 0.8
}
const GAP: Partial<Record<Sfx, number>> = { r_hit: 0.08, r_erupt: 0.2, r_bolt: 0.15 }
const chans = new Map<Sfx, Entity>()
const last = new Map<Sfx, number>()
let clock = 0
let music: Entity

export function setupSfx() {
  for (const k of Object.keys(VOL) as Sfx[]) {
    const e = engine.addEntity()
    Transform.create(e)
    AudioSource.create(e, { audioClipUrl: `sounds/${k}.wav`, playing: false, volume: VOL[k], global: true })
    chans.set(k, e)
  }
  music = engine.addEntity()
  Transform.create(music)
  AudioSource.create(music, { audioClipUrl: 'sounds/raid_music.mp3', playing: true, loop: true, volume: 0.55, global: true })
  engine.addSystem((dt) => {
    clock += dt
  })
}

export function play(k: Sfx, pitch = 1) {
  if (clock - (last.get(k) ?? -9) < (GAP[k] ?? 0)) return
  last.set(k, clock)
  const e = chans.get(k)
  if (!e) return
  AudioSource.getMutable(e).pitch = pitch
  AudioSource.playSound(e, `sounds/${k}.wav`, true)
}

export function musicLevel(v: number) {
  if (music) AudioSource.getMutable(music).volume = v
}

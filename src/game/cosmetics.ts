import { engine, Entity, Transform, GltfContainer, AvatarAttach, AvatarAnchorPointType, Tween, Animator } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import { COSMETICS } from './defs'

/** wear a raid relic on an avatar (undefined = me). returns the attachment entity (or undefined) */
export function attachCosmetic(avatarId: string | undefined, id: string | null | undefined, prev?: Entity) {
  if (prev) engine.removeEntity(prev)
  const c = COSMETICS.find((x) => x.id === id)
  if (!c || !c.model) return undefined
  const e = engine.addEntity()
  const anchor = {
    head: AvatarAnchorPointType.AAPT_NAME_TAG,
    over: AvatarAnchorPointType.AAPT_NAME_TAG,
    hand_l: AvatarAnchorPointType.AAPT_LEFT_HAND,
    hand_r: AvatarAnchorPointType.AAPT_RIGHT_HAND,
    feet: AvatarAnchorPointType.AAPT_POSITION,
    back: AvatarAnchorPointType.AAPT_SPINE2
  }[c.anchor ?? 'over']
  AvatarAttach.create(e, avatarId ? { avatarId, anchorPointId: anchor } : { anchorPointId: anchor })
  const holder = engine.addEntity()
  const off = c.anchor === 'head' ? -0.35 : c.anchor === 'over' ? 0.45 : c.anchor === 'feet' ? -0.9 : 0
  Transform.create(holder, { parent: e, position: Vector3.create(0, off, c.anchor === 'back' ? -0.12 : 0) })
  GltfContainer.create(holder, { src: c.model })
  if (c.anim) Animator.create(holder, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 0.7 }] })
  if (c.anchor === 'over') Tween.setRotateContinuous(holder, Quaternion.fromEulerDegrees(0, 1, 0), 40)
  return e
}
export const titleOf = (id: string | null | undefined) => COSMETICS.find((x) => x.id === id)?.title ?? ''

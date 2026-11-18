import { engine, Transform, GltfContainer, LightSource, Tween, TextShape, Billboard, BillboardMode, Font, TextAlignMode, MeshCollider, InputAction, pointerEventsSystem, ColliderLayer } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math'
import { teleportTo } from '~system/RestrictedActions'
import { CASTLE } from './defs'
import { play } from './sfx'

export const PORTAL = { x: 8, z: 1.05 }

/** one cursed parcel: burning cracked earth, rotting trees, a 20 m storm-painted enclosure and the way home */
export function buildWorld() {
  const arena = engine.addEntity()
  Transform.create(arena)
  GltfContainer.create(arena, { src: 'models/raid_arena.glb', visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER })

  // lava light pools + a cold moon wash
  for (const [x, y, z, c, i, r] of [
    [4.0, 0.8, 11.5, '#FF5A14', 6, 7],
    [12.3, 0.8, 5.2, '#FF5A14', 5, 6],
    [11.8, 0.8, 12.6, '#FF5A14', 4, 5],
    [8, 12, 9.5, '#8A5BFF', 4, 14],
    [8, 2.5, 2.2, '#B26BFF', 5, 6]
  ] as [number, number, number, string, number, number][]) {
    const l = engine.addEntity()
    Transform.create(l, { position: Vector3.create(x, y, z) })
    LightSource.create(l, { type: LightSource.Type.Point({}), color: Color3.fromHexString(c), intensity: i * 1000, range: r })
  }

  // the dimensional rift home
  const portal = engine.addEntity()
  Transform.create(portal, { position: Vector3.create(PORTAL.x, 2.2, PORTAL.z), scale: Vector3.create(1, 1, 1) })
  GltfContainer.create(portal, { src: 'models/fx_r_portal.glb' })
  Tween.setRotateContinuous(portal, Quaternion.fromEulerDegrees(0, 0, -1), 60)
  const sign = engine.addEntity()
  Transform.create(sign, { position: Vector3.create(PORTAL.x, 5.0, PORTAL.z + 0.2) })
  TextShape.create(sign, {
    text: 'RETURN TO THE CASTLE\n<size=60%>click the rift</size>',
    fontSize: 2.2,
    textColor: Color4.fromHexString('#E8C8FF'),
    outlineWidth: 0.2,
    outlineColor: Color3.Black(),
    font: Font.F_SANS_SERIF,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  Billboard.create(sign, { billboardMode: BillboardMode.BM_Y })
  const hit = engine.addEntity()
  Transform.create(hit, { position: Vector3.create(PORTAL.x, 2.2, PORTAL.z + 0.3), scale: Vector3.create(3.2, 4.2, 0.4) })
  MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
  pointerEventsSystem.onPointerDown({ entity: hit, opts: { button: InputAction.IA_POINTER, hoverText: 'Return to the castle', maxDistance: 12 } }, () => goHome())
}

export function goHome() {
  play('r_portal')
  void teleportTo({ worldCoordinates: { x: CASTLE.x, y: CASTLE.y } })
}

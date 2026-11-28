// PET SHOP — the menagerie stall beside the WHO IS GOD throne (arena east end). The three free pets sit on its
// cushions; click the stall (or stand at the counter) to open your pets. New pets can only be unlocked here.
// Art: models/pet_shop.glb (blender/build_petshop.py).
import { engine, Transform, GltfContainer, Animator, LightSource, pointerEventsSystem, InputAction, MeshCollider, ColliderLayer } from '@dcl/sdk/ecs'
import { Color3, Quaternion, Vector3 } from '@dcl/sdk/math'
import { node, text, bob, V, FACE } from './helpers'
import { G } from './game/game'
import { ENEMIES } from './game/defs'

const SX = 44.4
const SZ = 16.2
const FX = 42.2

export function buildPetShop() {
  const shop = engine.addEntity()
  Transform.create(shop)
  GltfContainer.create(shop, { src: 'models/pet_shop.glb' })
  text(V(FX - 0.48, 4.2, SZ), '🐾 PET SHOP', 3.4, '#FFD86A', { rot: FACE.west, outline: '#2A1400' })
  text(V(FX - 0.48, 3.72, SZ), 'tame · unlock · grow your pets', 1.4, '#FFF1C8', { rot: FACE.west, outline: '#1A0A00' })
  const hint = node(V(FX - 1.2, 2.35, SZ))
  bob(hint, 0.08, 2600)
  text(V(0, 0, 0), '3 pets are FREE · the rest open one by one\nraise a pet to full size (×6) + GOLD → the next one appears\nthe 10th and last: PET GOD', 1.05, '#E8DAFF', { parent: hint, rot: FACE.west, outline: '#14001E' })
  LightSource.create(node(V(SX, 3.0, SZ)), { type: LightSource.Type.Point({}), color: Color3.create(1, 0.75, 0.45), intensity: 2200, range: 9 })

  // the three free pets on their cushions
  const free: [keyof typeof ENEMIES, number][] = [['bat', SZ - 1.5], ['slime', SZ], ['ghoul', SZ + 1.5]]
  for (const [k, z] of free) {
    const e = node(V(SX + 0.9, 0.72, z), Quaternion.fromEulerDegrees(0, -90, 0), undefined, Vector3.create(0.7, 0.7, 0.7))
    GltfContainer.create(e, { src: ENEMIES[k].model })
    Animator.create(e, { states: [{ clip: 'Idle', playing: true, loop: true, speed: 1 }] })
  }

  const hit = node(V(SX, 2.0, SZ), undefined, undefined, Vector3.create(5.4, 4, 6))
  MeshCollider.setBox(hit, ColliderLayer.CL_POINTER)
  pointerEventsSystem.onPointerDown({ entity: hit, opts: { button: InputAction.IA_POINTER, hoverText: '🐾 PET SHOP — your pets', maxDistance: 12 } }, () => {
    G.atPetShop = true
    G.petOpen = true
  })

  engine.addSystem(() => {
    const pt = Transform.getOrNull(engine.PlayerEntity)
    if (!pt) return
    const p = pt.position
    G.atPetShop = p.y < 6 && Math.hypot(p.x - SX, p.z - SZ) < 7.5
  })
}

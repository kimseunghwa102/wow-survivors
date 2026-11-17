import {
  engine,
  Entity,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  MaterialTransparencyMode,
  TextShape,
  TextAlignMode,
  Font,
  Billboard,
  BillboardMode,
  Tween,
  TweenSequence,
  TweenLoop,
  EasingFunction
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

// Static architecture lives in models/wow_exchange.glb (built in Blender, see blender/build_exchange.py).
// These helpers only create the live / animated pieces on top of it.

export const V = (x: number, y: number, z: number) => Vector3.create(x, y, z)
export const Q = (x: number, y: number, z: number) => Quaternion.fromEulerDegrees(x, y, z)
export const hex = (h: string, a = 1): Color4 => {
  const c = Color4.fromHexString(h)
  return Color4.create(c.r, c.g, c.b, a)
}
export const c3 = (h: string): Color3 => {
  const c = Color4.fromHexString(h)
  return Color3.create(c.r, c.g, c.b)
}

export type Look = { color: string; alpha?: number; emissive?: string; glow?: number; metal?: number; rough?: number }

export const M = {
  gold: { color: '#E9B949', metal: 0.6, rough: 0.3, emissive: '#7A5200', glow: 0.4 } as Look,
  goldGlow: { color: '#FFD86A', emissive: '#FFB61E', glow: 3 } as Look,
  white: { color: '#FFFFFF', emissive: '#FFF4E0', glow: 2.5 } as Look,
  red: { color: '#FF2A3D', emissive: '#FF1030', glow: 3 } as Look,
  green: { color: '#22E07A', emissive: '#10C060', glow: 3 } as Look,
  velvet: { color: '#8E0D1C', rough: 0.9 } as Look,
  beam: { color: '#FFF6C8', alpha: 0.16, emissive: '#FFF0A0', glow: 2 } as Look
}

export function paint(e: Entity, l: Look) {
  const alpha = l.alpha ?? 1
  Material.setPbrMaterial(e, {
    albedoColor: hex(l.color, alpha),
    emissiveColor: l.emissive ? c3(l.emissive) : undefined,
    emissiveIntensity: l.glow ?? 0,
    metallic: l.metal ?? 0,
    roughness: l.rough ?? 0.5,
    transparencyMode: alpha < 1 ? MaterialTransparencyMode.MTM_ALPHA_BLEND : undefined
  })
}

export function node(pos: Vector3, rot?: Quaternion, parent?: Entity, scale?: Vector3): Entity {
  const e = engine.addEntity()
  Transform.create(e, { position: pos, rotation: rot ?? Quaternion.Identity(), scale: scale ?? Vector3.One(), parent })
  return e
}

type Opts = { rot?: Quaternion; parent?: Entity; collide?: boolean }

export function box(pos: Vector3, size: Vector3, look: Look, o: Opts = {}): Entity {
  const e = node(pos, o.rot, o.parent, size)
  MeshRenderer.setBox(e)
  if (o.collide) MeshCollider.setBox(e)
  paint(e, look)
  return e
}

/** invisible collider box */
export function wall(pos: Vector3, size: Vector3): Entity {
  const e = node(pos, undefined, undefined, size)
  MeshCollider.setBox(e)
  return e
}

/** invisible click target */
export const hitbox = wall

export function text(
  pos: Vector3,
  value: string,
  size: number,
  color: string,
  o: { rot?: Quaternion; parent?: Entity; align?: TextAlignMode; outline?: string; billboard?: boolean } = {}
): Entity {
  const e = node(pos, o.rot, o.parent)
  TextShape.create(e, {
    text: value,
    fontSize: size,
    textColor: hex(color),
    font: Font.F_SANS_SERIF,
    textAlign: o.align ?? TextAlignMode.TAM_MIDDLE_CENTER,
    outlineWidth: o.outline ? 0.12 : 0,
    outlineColor: o.outline ? c3(o.outline) : undefined
  })
  if (o.billboard) Billboard.create(e, { billboardMode: BillboardMode.BM_Y })
  return e
}

export function setText(e: Entity, value: string, color?: string) {
  const t = TextShape.getMutable(e)
  if (t.text !== value) t.text = value
  if (color) t.textColor = hex(color)
}

/** facing helpers for wall-mounted text (text faces −Z by default) */
export const FACE = {
  south: Q(0, 0, 0), // readable from the south (viewer at lower z)
  north: Q(0, 180, 0), // readable from the north
  east: Q(0, -90, 0), // readable from the east (viewer at higher x)
  west: Q(0, 90, 0) // readable from the west
}

export function bob(e: Entity, amp = 0.08, ms = 1600) {
  const p = Transform.get(e).position
  Tween.create(e, {
    mode: Tween.Mode.Move({ start: p, end: V(p.x, p.y + amp, p.z) }),
    duration: ms,
    easingFunction: EasingFunction.EF_EASESINE
  })
  TweenSequence.create(e, { sequence: [], loop: TweenLoop.TL_YOYO })
}

export function spin(e: Entity, degPerSec = 45) {
  Tween.setRotateContinuous(e, Q(0, 1, 0), degPerSec)
}

export function fmt(n: number, digits: number) {
  const s = n.toFixed(digits)
  const [a, b] = s.split('.')
  const withComma = a.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return b ? `${withComma}.${b}` : withComma
}

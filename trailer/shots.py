"""Render trailer stills from the real game assets.  python3 shots.py -- <outdir> <w> <h> <spp> [shot ...]"""
import bpy, sys, math, mathutils, os, random

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, W, H, SPP = argv[0], int(argv[1]), int(argv[2]), int(argv[3])
ONLY = argv[4:]
M = '/home/claude/wow-survivors/models/'
os.makedirs(OUT, exist_ok=True)


def to_b(v):
    return (-v[0], -v[2], v[1])


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = SPP
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.view_settings.view_transform = 'Filmic' if 'Filmic' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    sc.view_settings.look = 'None'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.025, 0.03, 0.08, 1)
    return sc


def place(glb, pos, yaw=0, s=1.0, pitch=0):
    sc = bpy.context.scene
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=M + glb + '.glb')
    e = bpy.data.objects.new('off', None)
    sc.collection.objects.link(e)
    e.location = to_b(pos)
    e.rotation_euler = (math.radians(pitch), 0, math.radians(yaw))
    e.scale = (s, s, s)
    for o in set(bpy.data.objects) - before:
        if 'collider' in o.name.lower():
            bpy.data.objects.remove(o)
            continue
        if o.parent is None and o is not e:
            o.parent = e
    return e


def light(p, c, e, kind='POINT', size=1.5):
    sc = bpy.context.scene
    l = bpy.data.lights.new('l', kind)
    l.energy = e
    l.color = c
    if kind == 'POINT':
        l.shadow_soft_size = size
    o = bpy.data.objects.new('l', l)
    sc.collection.objects.link(o)
    o.location = to_b(p)
    return o


def moon(e=1.3, rx=55, rz=160):
    sc = bpy.context.scene
    l = bpy.data.lights.new('moon', 'SUN')
    l.energy = e
    l.color = (0.6, 0.65, 1.0)
    o = bpy.data.objects.new('moon', l)
    sc.collection.objects.link(o)
    o.rotation_euler = (math.radians(rx), 0, math.radians(rz))


def shoot(name, frm, to, lens=24, frame=6):
    sc = bpy.context.scene
    sc.frame_set(frame)
    cam = bpy.data.cameras.new('c')
    cam.lens = lens
    co = bpy.data.objects.new('c', cam)
    sc.collection.objects.link(co)
    co.location = to_b(frm)
    d = mathutils.Vector(to_b(to)) - co.location
    co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)


def arena_lights():
    moon()
    for (p, c, e) in [((32, 9, 26), (0.7, 0.3, 1), 9000), ((32, 4, 12), (1, 0.6, 0.3), 2500), ((24, 4, 10), (1, 0.5, 0.2), 1500),
                      ((40, 4, 10), (1, 0.5, 0.2), 1500), ((32, 12, 36), (1, 0.2, 0.1), 6000)]:
        light(p, c, e)


MONS = ['ghoul', 'skeleton', 'wraith', 'bat', 'ghoul', 'skeleton', 'bat', 'ghoul']


def horde(cx, cz, n, spread, face=180, seed=3, zmin=None):
    rnd = random.Random(seed)
    for i in range(n):
        x = cx + rnd.uniform(-spread, spread)
        z = cz + rnd.uniform(-spread * 0.6, spread * 0.9)
        k = MONS[i % len(MONS)]
        if rnd.random() < 0.12:
            k = 'ghoul_elite'
        place(k, (x, 0, z), face + rnd.uniform(-25, 25), 1.7 if k == 'ghoul_elite' else rnd.uniform(0.95, 1.1))


def s_aerial():
    fresh(); place('arena', (0, 0, 0)); moon(1.6, 50, 200)
    for (p, c, e) in [((32, 10, 24), (0.7, 0.35, 1), 20000), ((16, 10, 64), (0.8, 0.4, 1), 12000), ((8, 6, 8), (1, 0.7, 0.3), 6000)]:
        light(p, c, e)
    shoot('aerial', (54, 38, -16), (31, 2, 32), 24)


def s_cathedral():
    fresh(); place('arena', (0, 0, 0)); moon()
    light((16, 6, 66), (0.8, 0.3, 1), 6000); light((16, 3, 58), (1, 0.6, 0.3), 2500); light((8, 4, 60), (1, 0.5, 0.2), 1500); light((24, 4, 60), (1, 0.5, 0.2), 1500)
    horde(16, 64, 9, 6, 180, 5)
    shoot('cathedral', (16, 2.4, 51), (16, 9, 76), 20)


def s_hero():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    place('dragon_wyrm', (32, 0, 31), 180, 1.0)
    for (k, p, y) in [('ghoul', (27, 0, 17), 160), ('skeleton', (37, 0, 18), 200), ('wraith', (30, 0, 21), 180), ('ghoul_elite', (39, 0, 23), 210),
                      ('bat', (25, 0, 20), 150), ('bat', (35, 0, 15), 190), ('skeleton', (23, 0, 23), 150), ('ghoul', (41, 0, 16), 220)]:
        place(k, p, y, 1.7 if k == 'ghoul_elite' else 1.0)
    place('fx_glaive_asc', (31, 1, 11.5), 0, 1.3); place('fx_glaive_asc', (33.5, 1, 10), 40, 1.3)
    place('fx_bloom', (32, 0.05, 10), 0, 5.0); place('fx_sigil', (36, 0, 17), 0, 3.0)
    place('w_reaper', (32.7, 1.3, 9.6), 20, 1.0)
    shoot('hero', (32, 4.2, 3.0), (32, 6.5, 30), 24)


def s_swarm():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    light((32, 2, 12), (0.6, 0.3, 1), 2500)
    horde(32, 22, 34, 11, 180, 9)
    place('lich', (32, 0, 30), 180, 1.3)
    for (x, z) in [(26, 16), (38, 18), (30, 26)]:
        place('fx_spawn', (x, 0.05, z), 0, 1.5)
    shoot('swarm', (32, 1.1, 7.5), (32, 2.6, 30), 22)


def s_skills():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    light((32, 3, 24), (0.4, 0.8, 1), 3000)
    c = (32, 0, 24)
    place('rift_core', (32, 1.4, 24), 0, 0.6)
    for k, (fx, r, a, s) in enumerate([('fx_glaive_asc', 3.0, 0, 1.4), ('fx_glaive_asc', 3.0, 120, 1.4), ('fx_glaive_asc', 3.0, 240, 1.4),
                                        ('fx_sigil_asc', 7.5, 40, 3.0), ('fx_sigil_asc', 7.0, 200, 3.0), ('fx_bloom_asc', 0, 0, 7.0),
                                        ('fx_shard_asc', 5.5, 300, 1.6), ('fx_shard_asc', 6.0, 90, 1.6), ('fx_slash_asc', 4.5, 160, 2.5)]):
        x = c[0] + r * math.sin(math.radians(a)); z = c[2] + r * math.cos(math.radians(a))
        place(fx, (x, 1.0 if 'glaive' in fx or 'shard' in fx else 0.05, z), a, s)
    horde(32, 24, 14, 10, 0, 11)
    shoot('skills', (32, 11, 12), (32, 0, 25), 24)


def s_armory():
    fresh(); moon(0.4)
    pl = bpy.data.meshes.new('pl'); pl.from_pydata([(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)], [], [[0, 1, 2, 3]])
    po = bpy.data.objects.new('pl', pl); bpy.context.scene.collection.objects.link(po)
    m = bpy.data.materials.new('g'); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (0.03, 0.02, 0.05, 1); bs.inputs['Roughness'].default_value = 0.25
    pl.materials.append(m)
    ws = ['w_fist', 'w_pan', 'w_hammer', 'w_flame', 'w_reaper', 'w_minigun', 'w_nuke', 'w_zeus', 'w_god']
    for i, wname in enumerate(ws):
        x = (i - 4) * 1.45
        if wname == 'w_god':
            place(wname, (x, 1.2, 0), 0, 1.3)
        else:
            place(wname, (x, 0.15, 0), 0, 1.25 if wname != 'w_fist' else 2.4, pitch=-90)
        light((x, 3.4, -1.4), (1, 0.75, 0.35), 160)
    light((0, 6, -6), (0.6, 0.4, 1), 1500)
    shoot('armory', (0, 1.5, -7.2), (0, 1.15, 0), 21)


def s_boss():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    place('dragon_fire', (32, 0, 29), 180, 1.7)
    place('fx_slam_warn', (32, 0.06, 22), 0, 5.0)
    light((32, 3, 22), (1, 0.35, 0.1), 7000); light((32, 14, 24), (1, 0.5, 0.2), 6000)
    horde(32, 20, 8, 9, 180, 21)
    shoot('boss', (32, 1.4, 11), (32, 8.5, 30), 20)


def s_nuke():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    place('fx_nuke', (32, 0.05, 26), 0, 2.6)
    light((32, 6, 26), (1, 0.6, 0.2), 30000); light((32, 1, 26), (1, 0.9, 0.6), 12000)
    horde(32, 26, 18, 14, 0, 31)
    shoot('nuke', (32, 5, 6), (32, 5, 28), 22, frame=10)


def s_god():
    fresh(); place('arena', (0, 0, 0)); arena_lights()
    place('god_aura', (32, 0, 24), 180, 1.0)
    place('w_god', (32.9, 1.3, 23.6), 0, 1.0)
    light((32, 6, 24), (1, 0.8, 0.4), 9000); light((32, 3, 18), (0.6, 0.4, 1), 4000)
    rnd = random.Random(4)
    for i in range(8):
        a = math.radians(i * 45 + rnd.uniform(-10, 10)); r = rnd.uniform(6, 9)
        x, z = 32 + r * math.sin(a), 24 + r * math.cos(a)
        if z < 21:
            continue
        place(MONS[i], (x, 0, z), math.degrees(a) + 180, 1.0)
        if i in (2, 5, 7):
            place('fx_sigil_asc', (x, 0.05, z), 0, 1.4)
    bpy.context.scene.view_settings.exposure = -1.8
    shoot('god', (32, 2.8, 15.0), (32, 2.0, 24), 26)


def s_treasury():
    fresh(); place('arena', (0, 0, 0)); moon()
    place('treasury', (12.6, 0, 3.2), -92, 1.0)
    light((10, 4, 3.2), (1, 0.8, 0.4), 2500); light((12.6, 3.5, 5.5), (1, 0.7, 0.3), 1200)
    shoot('treasury', (7.8, 2.0, 3.6), (12.6, 1.6, 3.2), 26)


SHOTS = {'aerial': s_aerial, 'cathedral': s_cathedral, 'hero': s_hero, 'swarm': s_swarm, 'skills': s_skills, 'armory': s_armory,
         'boss': s_boss, 'nuke': s_nuke, 'god': s_god, 'treasury': s_treasury}
for k, fn in SHOTS.items():
    if ONLY and k not in ONLY:
        continue
    fn()
    print('SHOT DONE', k, flush=True)

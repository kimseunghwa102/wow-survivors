"""Trailer v2 stills: real game states captured by the simulation (/tmp/tr/shots.json) rebuilt with the game's models.
python3 shots2.py -- <outdir> <w> <h> <spp> [shot ...]"""
import bpy, sys, math, mathutils, os, random, json

_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots.py')).read().split('def s_aerial')[0]
exec(_src)
D = json.load(open(os.environ.get('SHOTS', '/tmp/tr/shots.json')))
BOSS = D['_bosses']
EN = D['_enemies']
RAIN = ('spear', 'cannon', 'kunai', 'fire', 'fist', 'bolt', 'star')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def model_of(path):
    return path.replace('models/', '').replace('.glb', '')


def face(x, z, tx, tz):
    # models face +z; place() yaw is Blender Z rotation; DCL yaw a → Blender rotation a (to_b flips x and z)
    return math.degrees(math.atan2(tx - x, tz - z))


def hero(p, s=1.0, weapon='w_zeus'):
    x, z = p['x'], p['z']
    place(weapon, (x + 0.5, 1.3, z), p.get('yaw', 0), 1.1)
    for k in range(3):
        a = math.radians(k * 120 + 20)
        place('fx_glaive_asc', (x + math.sin(a) * 2.0, 1.0, z + math.cos(a) * 2.0), k * 120, 1.3)
    place('fx_bloom_asc', (x, 0.05, z), 0, 4.0 * s)
    light((x, 2.5, z), (0.6, 0.8, 1.0), 900)


def build(name, cam_from=None, cam_to=None, lens=22, exposure=0.0, extra=None, back=7.5, up=3.6, nopillar=False):
    S = D[name]
    fresh()
    place('arena', (0, 0, 0))
    arena_lights()
    p = S['player']
    px, pz = p['x'], p['z']
    boss = None
    for e in S['enemies']:
        if e['k'] == 'boss':
            boss = e
            b = BOSS[e['boss']]
            place(model_of(b['model']), (e['x'], b['fly'], e['z']), face(e['x'], e['z'], px, pz), b['scale'])
            c = hexrgb(b['color'])
            light((e['x'], b['fly'] + 6, e['z'] + 2), c, 9000)
            light((e['x'], 3, e['z'] - 4), c, 3000)
        else:
            if math.hypot(e['x'] - px, e['z'] - pz) > 26 or (cam_from and math.hypot(e['x'] - cam_from[0], e['z'] - cam_from[2]) < 6):
                continue
            d = EN['elite' if e['k'] == 'elite' else e['k']]
            m = 'ghoul_elite' if e['k'] == 'elite' else model_of(d['model'])
            place(m, (e['x'], d.get('hover', 0), e['z']), face(e['x'], e['z'], px, pz), d['scale'])
    for h in S['hostile']:
        place('fx_shade' if h.get('k') == 'shade' else 'fx_fox' if h.get('k') == 'fox' else 'fx_borb', (h['x'], 0 if h.get('k') else 1.1, h['z']), 0, 1.0)
    for a in S['allies']:
        place('fx_fox' if a['k'] == 'fox' else 'fx_shade', (a['x'], 0.2, a['z']), 0, 1.0)
    for ev in S['active']:
        t = ev['t']
        if t == 'mStrike':
            f = min(1.0, ev['age'] / max(0.05, ev['delay']))
            k = ev['k']
            if not ev.get('own'):
                place('fx_slam_warn', (ev['x'], 0.05, ev['z']), 0, ev['r'] * 2)
            if k == 'pillar':
                if f > 0.55 and not nopillar:
                    place('fx_mpillar', (ev['x'], 0, ev['z']), 0, 1.0)
            elif k == 'sun':
                s = ev['r'] * (0.45 + 0.65 * f)
                place('fx_msun', (ev['x'], 0.6 + 15 * (1 - f) ** 1.6, ev['z']), 0, s)
            elif k == 'bolt':
                if f > 0.6:
                    place('fx_rain_bolt', (ev['x'], 0, ev['z']), 0, 1.0)
            else:
                ff = f * f
                place('fx_rain_' + (k if k in RAIN else 'star'), (ev['x'] - 3.2 * (1 - ff), 18 * (1 - ff), ev['z'] - 2.1 * (1 - ff)), 0, 1.25)
        elif t == 'mRingWarn':
            i = max(0, min(5, round((ev['r0'] - 2.2) / 4)))
            place(f'fx_mring{i}_warn', (ev['x'], 0, ev['z']), 0, 1.0)
        elif t == 'slamWarn':
            place('fx_slam_warn', (ev['x'], 0.05, ev['z']), 0, ev['r'] * 2)
        elif t == 'mSpokes':
            age = max(0, ev['age'] - ev['warm'])
            for i in range(int(ev['n'])):
                yaw = ev['a0'] + ev['omega'] * age + i * 360 / ev['n']
                e = place('fx_bbeam', (ev['x'], 1.0, ev['z']), yaw, 1.0)
                e.scale = (ev['w'], ev['len'], ev['w'])  # Blender axes: x, y(=−dcl z), z(=dcl y)
        elif t == 'mLight':
            for (x, z, r) in ev['safe']:
                e = place('fx_safe', (x, 0, z), 0, 1.0)
                e.scale = (r * 2, r * 2, 1.0)
                light((x, 2, z), (1, 0.85, 0.4), 2500)
            pass  # the light wall itself would surround the camera
    hero(p)
    if extra:
        extra(S)
    bpy.context.scene.view_settings.exposure = exposure
    if cam_from is None:
        if boss:
            b = BOSS[boss['boss']]
            dx, dz = boss['x'] - px, boss['z'] - pz
            dl = math.hypot(dx, dz) or 1
            cam_from = (px - dx / dl * back, up, pz - dz / dl * back)
            cam_to = (boss['x'], b['fly'] + 3.2 * b['scale'], boss['z'])
        else:
            cam_from = (px - 6, 10, pz - 17)
            cam_to = (px, 0.5, pz + 3)
    shoot(name, cam_from, cam_to, lens)


def s_bloodring():
    fresh()
    place('arena', (0, 0, 0))
    place('pvp_zone', (0, 0, 0))
    arena_lights()
    light((16, 8, 64), (1, 0.15, 0.1), 14000)
    light((24, 5, 50), (1, 0.3, 0.2), 4000)
    for (x, z, w, yaw) in [(13, 62, 'w_flame', 60), (19, 66, 'w_reaper', 240)]:
        place(w, (x, 1.3, z), yaw, 1.2)
        place('fx_bloom_asc', (x, 0.05, z), 0, 3.0)
    place('fx_slash_asc', (16, 1.0, 64), 60, 3.0)
    place('fx_sigil_asc', (18.5, 0.05, 66), 0, 2.5)
    place('fx_rain_bolt', (13.5, 0, 61.5), 0, 1.0)
    shoot('bloodring', (16, 3.4, 51.5), (16, 3.0, 70), 18)


def s_ascend():
    fresh()
    place('arena', (0, 0, 0))
    moon(0.6)
    x, z = 32, 24
    e = place('fx_mpillar', (x, 0, z), 0, 1.0)
    e.scale = (7, 7, 9)
    for i, s in enumerate((18, 34)):
        place('fx_ascend_ring', (x, 0.1 + i * 0.04, z), 0, s)
    place('cos_god', (x, 1.55, z), 180, 1.6)
    place('w_god', (x, 1.2, z), 0, 1.0)
    light((x, 6, z), (1, 0.85, 0.5), 30000)
    light((x, 1.5, z - 4), (1, 0.9, 0.7), 5000)
    bpy.context.scene.view_settings.exposure = -2.3
    shoot('ascend', (x, 2.2, z - 9.5), (x, 4.2, z), 24)


SHOTS2 = {k: (lambda k=k: build(k)) for k in D if not k.startswith('_')}
SHOTS2['arts'] = lambda: build('arts', None, None, 24, -0.9)
SHOTS2['m_almighty'] = lambda: build('m_almighty', (44.5, 4.2, 26), (29.8, 10.5, 15.5), 18, -1.3, nopillar=True)
SHOTS2['m_morthael'] = lambda: build('m_morthael', None, None, 22, -0.3, None, 15, 4.2)
SHOTS2['m_yorumi'] = lambda: build('m_yorumi', None, None, 20, -0.9, None, 13, 5.5)
SHOTS2['bloodring'] = s_bloodring
SHOTS2['ascend'] = s_ascend
for k, fn in SHOTS2.items():
    if ONLY and k not in ONLY:
        continue
    fn()
    print('SHOT DONE', k, flush=True)

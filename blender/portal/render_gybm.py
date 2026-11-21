import sys, os, time
sys.path.insert(0, '/home/claude/pano')
from recon import *
import recon
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
W, H, SPP = int(args[0]), int(args[1]), int(args[2])
OUT = args[3]
LON = float(os.environ.get('LON', '180')); LAT = float(os.environ.get('LAT', '90')); AMB = float(os.environ.get('AMB', '0'))
PORTAL = args[4] if len(args) > 4 else ''
recon.LIGHT_K = float(os.environ.get('LK', '0.05'))
G = '/home/claude/gybm/dcl-scene/models/'
sc = reset()
FLIP = q_euler(0, 180, 0)
S = 0.998
IP = (8 * (1 - S), 0, 8 * (1 - S))
place(G + 'casino_static.glb', dcl_m(IP, FLIP, (S, 1, S)))
place(G + 'chandelier.glb', dcl_m((8, 5.95, 10), FLIP))
place(G + 'roulette.glb', dcl_m((8, 2.85, 15.68), FLIP))
place(G + 'bulbs_a.glb', dcl_m(IP, FLIP, (S, 1, S)))
# lights (src/index.ts)
point((8, 3.6, 10), '#FFD9A6', 30000)
point((8, 4.0, 1.4), '#FFC870', 16000)
point((1.8, 4.0, 10), '#FF5FA8', 9000)
point((14.2, 4.0, 9.4), '#7C9BFF', 9000)
spot((4, 5.7, 12), q_euler(65, 0, 0), '#FF3EA5', 25000, 15, 28)
spot((12, 5.7, 12), q_euler(65, 180, 0), '#3EE7FF', 25000, 15, 28)
SIDE = os.environ.get('SIDE', 'gybm')  # gybm: the GYBM land (portal back to NIGHTSWARM) · ns: the NIGHTSWARM copy (portal to GYBM)
point((11.0, 2.0, 5.0), '#9A4BFF' if SIDE == 'gybm' else '#FFB347', 14000)
EYE = (8, 1.9, 0.55)
GOLD = '#FFD700'
text((4.15, 4.15, 15.6), 'GOLD RANKING', 2.4, GOLD, 0, outline='#5A3A00')
text((4.15, 3.25, 15.6), '#   PLAYER        NET    WIN%', 1.05, '#FFFFFF', 0)
CAM = os.environ.get('CAM')
VIEW = tuple(float(v) for v in CAM.split(',')) if CAM else EYE
if SIDE == 'gybm':
    text((11.0, 4.6, 5.0), 'WORMHOLE\nWOW NIGHTSWARM', 3.0, GOLD, face=VIEW, outline='#3A0A00')
    text((11.0, 3.95, 5.0), 'walk in → -103,78 · hunt for gold', 1.3, '#7DF9FF', face=VIEW)
else:
    text((11.0, 4.6, 5.0), 'WORMHOLE\nGYBM CASINO', 3.0, GOLD, face=VIEW, outline='#3A0A00')
    text((11.0, 3.95, 5.0), 'walk in → -76,-48 · same table, same gold', 1.3, '#7DF9FF', face=VIEW)
for z in (6.4, 9.4, 12.4):
    text((14.62, 1.95, z), 'SPIN ME', 0.7, '#FFFFFF', 90)
# the GYBM portal back to NIGHTSWARM is in view on the right: put its window + rim in the shot
PD, PN = ('/home/claude/pano/out_gybm/', 'portal_ns') if SIDE == 'gybm' else ('/home/claude/pano/out_ns/', 'portal_gybm')
if os.path.exists(PD + PN + '_win.glb'):
    pm = dcl_m((11.0, 1.75, 5.0), q_euler(0, 34, 0))
    place(PD + PN + '_win.glb', pm)
    place(PD + PN + '_rim.glb', pm, name='rim')
ground(0.0, '#0A0A0E')
night_world(strength=0.6, amb_strength=AMB)
if CAM:
    persp_camera(VIEW, tuple(float(v) for v in os.environ.get('LOOK', '11,1.75,5').split(',')), float(os.environ.get('FOV', '60')))
else:
    pano_camera(EYE, 0, LON, LAT)
t = time.time()
render(OUT, W, H, SPP)
print('render s', round(time.time() - t, 1))

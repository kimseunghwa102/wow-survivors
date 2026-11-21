import sys, math
sys.path.insert(0, '/home/claude/pano')
from recon import *
a = sys.argv[sys.argv.index('--') + 1:]
GLB, OUT, LOOKYAW = a[0], a[1], float(a[2])
reset()
YAW = 34
place(GLB, dcl_m((0, 0, 0), q_euler(0, YAW, 0), (0.7, 0.7, 0.7)))
t = math.radians(LOOKYAW)
persp_camera((0, 0, 0), (math.sin(t), 0, math.cos(t)), 90)
render(OUT, 640, 360, 8)

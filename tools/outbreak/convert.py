# Kenney 키트 → 게임용 압축 모델 (키트마다 .bin 하나 + index.json)
#   꼭짓점: 위치 int16(모델별 배율) · 법선 int8 · UV int16(/2048) · 삼각형 uint16
#   재질: 텍스처 번호(없으면 -1) + 기본색
import glob, os, json, shutil, sys, numpy as np
from PIL import Image
from gltf import load
S = '/tmp/claude-0/-home-user-test-mod/97c24a57-7ac8-5d65-afbb-e7e2c529deb0/scratchpad/kenney/'
OUT = '/home/user/test-mod/games/outbreak/m/'
os.makedirs(OUT, exist_ok=True)
KITS = {   # 게임 속 키트 이름: 폴더
    'nature': 'kenney_nature-kit', 'town': 'kenney_fantasy-town-kit_2.0', 'urban': 'kenney_retro-urban-kit', 'bld': 'kenney_modular-buildings',
    'build': 'kenney_building-kit', 'car': 'kenney_car-kit', 'food': 'kenney_food-kit', 'shop': 'kenney_mini-shop_2.1', 'blaster': 'kenney_blaster-kit_2.1',
    'factory': 'kenney_factory-kit_3.0', 'holiday': 'kenney_holiday-kit', 'golf': 'kenney_minigolf-kit', 'proto': 'kenney_prototype-kit', 'pets': 'kenney_cube-pets_1.0',
    'train': 'kenney_train-kit', 'boat': 'kenney_watercraft-pack', 'coaster': 'kenney_coaster-kit', 'station': 'kenney_space-station-kit', 'space': 'kenney_space-kit',
    'mspace': 'kenney_modular-space-kit_1.0', 'cave': 'kenney_modular-cave-kit_1.0', 'dungeon': 'kenney_modular-dungeon-kit_1.0',
}
# 큰 키트는 게임에서 쓰는 모델만 남김 (used.json: 지도를 여러 번 만들어 모은 목록)
SUBSET = {'nature', 'car', 'coaster', 'train', 'space', 'boat', 'factory', 'holiday', 'golf', 'town', 'food'}
USED = set(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'used.json')))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'used.json')) else None
GAME_KITS = ['nature', 'urban', 'build', 'bld', 'car', 'food', 'shop', 'station', 'factory', 'holiday', 'golf', 'coaster', 'boat', 'train', 'town', 'proto', 'blaster', 'pets', 'space']
only = sys.argv[1:] or GAME_KITS
idx = json.load(open(OUT + 'index.json')) if os.path.exists(OUT + 'index.json') else {}
idx = {k: v for k, v in idx.items() if k in GAME_KITS}
for kn in only:
    d = S + KITS[kn] + '/Models/'
    fs = sorted(glob.glob(d + 'GLB format/*.glb') + glob.glob(d + 'GLTF format/*.glb'))
    if USED and kn in SUBSET: fs = [f for f in fs if kn + '/' + os.path.basename(f)[:-4] in USED]
    texdir = os.path.dirname(fs[0]) + '/Textures/' if fs else ''
    texs = []; P = []; N = []; U = []; I = []; models = {}; vo = io = 0
    for f in fs:
        name = os.path.basename(f)[:-4]
        gs = load(f)
        allp = np.concatenate([g['pos'] for g in gs]); q = max(1e-4, float(np.abs(allp).max())) / 32000
        mg = []
        for g in gs:
            if len(g['pos']) > 65535: print('too big', name); continue
            tex, col, mname = g['mat']
            ti = -1
            if tex:
                if tex not in texs: texs.append(tex)
                ti = texs.index(tex)
            c = '#%02x%02x%02x' % tuple(int(max(0, min(1, v)) * 255) for v in col[:3])
            n = len(g['pos'])
            P.append(np.round(g['pos'] / q).astype(np.int16)); N.append(np.c_[np.round(g['nrm'] * 127).astype(np.int8), np.zeros((n, 1), np.int8)])
            uv = g['uv'].copy(); uv[:, 1] = 1 - uv[:, 1]
            U.append(np.round(np.clip(uv, -15.9, 15.9) * 2048).astype(np.int16)); I.append(g['idx'].astype(np.uint16))
            mg.append([ti, c, vo, n, io, len(g['idx'])]); vo += n; io += len(g['idx'])
        mn = allp.min(0); mx = allp.max(0)
        models[name] = dict(q=q, g=mg, bb=[round(float(v), 3) for v in list(mn) + list(mx)])
    P = np.concatenate(P); N = np.concatenate(N); U = np.concatenate(U); I = np.concatenate(I)
    blob = P.tobytes() + N.tobytes() + U.tobytes() + I.tobytes()
    open(OUT + kn + '.bin', 'wb').write(blob)
    os.makedirs(OUT + 'tex', exist_ok=True); tn = []
    for t in texs:
        dst = kn + '_' + os.path.splitext(t)[0] + '.png'
        im = Image.open(texdir + t).convert('RGBA'); im.save(OUT + 'tex/' + dst, optimize=True); tn.append(dst)
    idx[kn] = dict(v=vo, i=io, tex=tn, models=models, sec=[0, P.nbytes, P.nbytes + N.nbytes, P.nbytes + N.nbytes + U.nbytes])
    print(kn, len(models), 'v', vo, 'kb', len(blob) // 1024, 'tex', len(tn))
json.dump(idx, open(OUT + 'index.json', 'w'), separators=(',', ':'))
print('index kb', os.path.getsize(OUT + 'index.json') // 1024)

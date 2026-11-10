# 바이오 킹덤 에셋 가공: Kenney 팩(CC0) → games/bio-kingdom/a/
#   python3 build_assets.py <kenney 압축 푼 폴더> <영웅 렌더 폴더>
import sys, os, glob, json, subprocess
from PIL import Image
K, PETS = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../games/bio-kingdom/a/')
os.makedirs(OUT, exist_ok=True)

def trim(im):
    bb = im.getchannel('A').getbbox() or (0, 0, 1, 1); return im.crop(bb), bb
def pack(items, width, name, pad=2):
    """items: [(key, Image, meta)] → 한 장 + json (선반 배치)"""
    items = sorted(items, key=lambda t: -t[1].height)
    x = y = sh = 0; pos = {}
    for k, im, meta in items:
        if x + im.width + pad > width: x = 0; y += sh + pad; sh = 0
        pos[k] = [x, y, im.width, im.height] + list(meta); x += im.width + pad; sh = max(sh, im.height)
    H = y + sh; sheet = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    for k, im, meta in items: sheet.alpha_composite(im, tuple(pos[k][:2]))
    sheet.save(OUT + name + '.webp', 'WEBP', quality=88, method=6)
    print(name, sheet.size, os.path.getsize(OUT + name + '.webp') // 1024, 'KB', len(items))
    return pos
meta = json.load(open(OUT + 'atlas.json')) if os.path.exists(OUT + 'atlas.json') else {}
ONLY = sys.argv[3] if len(sys.argv) > 3 else None
if ONLY == 'tiles':
    pass
# 1) 영웅: 동작 시트(160칸 7줄×8) + 얼굴
os.makedirs(OUT + 'h', exist_ok=True)
for f in sorted(glob.glob(PETS + '/animal-*.png')):
    n = os.path.basename(f)[7:-4]
    im = Image.open(f).convert('RGBA')
    if n.endswith('_face'): im.resize((192, 192), Image.LANCZOS).save(OUT + 'h/' + n + '.webp', 'WEBP', quality=88)
    else: im.save(OUT + 'h/' + n + '.webp', 'WEBP', quality=86, method=6)
print('heroes', len(os.listdir(OUT + 'h')))
# 2) 왕국 타일 (스케치 마을 + 확장): 절반 크기, 투명 여백 잘라 내고 원래 칸(128×176) 안 위치 기록
items = []
ALLDIR = ('grass_path', 'grass_river', 'fence_', 'castle_wall', 'castle_bend', 'cliff', 'grass_slope', 'grass_water', 'bridge')
for d in ['kenney_sketch-town/Tiles', 'kenney_sketch-town-expansion/Tiles']:
    for f in sorted(glob.glob(K + '/' + d + '/*.png')):
        n = os.path.basename(f)[:-4]
        if not (n.endswith('_S') or n.endswith('_N') or n.endswith('_E') and n.startswith('castle_corner') or n.startswith(ALLDIR)): continue
        im = Image.open(f).convert('RGBA').resize((128, 176), Image.LANCZOS); t, bb = trim(im)
        items.append((n, t, (bb[0], bb[1])))
meta['tiles'] = pack(items, 2048, 'tiles')
# 3) 주민 (미니어처 던전 캐릭터: 8방향 × 달리기 10 + 들기 10 + 서기)
items = []
for f in sorted(glob.glob(K + '/kenney_isometric-miniature-dungeon/Characters/Male/*.png')):
    n = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGBA'); im = im.resize((im.width * 3 // 10, im.height * 3 // 10), Image.LANCZOS); t, bb = trim(im)
    items.append((n, t, (bb[0], bb[1], im.width, im.height)))
meta['folk'] = pack(items, 2048, 'folk')
# 4) 전투 배경 요소 + 블록 땅
items = []
for f in sorted(glob.glob(K + '/kenney_background-elements-remastered/PNG/Default/*.png')):
    im = Image.open(f).convert('RGBA'); items.append((os.path.basename(f)[:-4], im, ()))
for f in sorted(glob.glob(K + '/kenney_block-pack/PNG/Default (64px)/*.png')):
    im = Image.open(f).convert('RGBA'); items.append(('b_' + os.path.basename(f)[:-4], im, ()))
meta['bgel'] = pack(items, 2048, 'bgel')
os.makedirs(OUT + 'bg', exist_ok=True)
for f in glob.glob(K + '/kenney_background-elements-remastered/Backgrounds/*.png') + glob.glob(K + '/kenney_background-elements-remastered/Backgrounds/Elements/*.png'):
    im = Image.open(f).convert('RGBA'); n = os.path.basename(f)[:-4]
    if im.width >= 1024: im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(OUT + 'bg/' + n + '.webp', 'WEBP', quality=86)
# 5) 아이콘 (흰색) + 계급장
items = []; seen = set()
for f in sorted(glob.glob(K + '/kenney_game-icons/PNG/White/2x/*.png')) + sorted(glob.glob(K + '/kenney_game-icons-expansion/PNG/White/2x/*.png')):
    n = os.path.basename(f)[:-4]
    if n in seen: continue
    seen.add(n); im = Image.open(f).convert('RGBA').resize((64, 64), Image.LANCZOS); items.append((n, im, ()))
meta['icons'] = pack(items, 1024, 'icons')
items = []
for col in ['Gold', 'Silver', 'Bronze']:
    for f in sorted(glob.glob(K + '/kenney_ranks-pack/PNG/Default size/' + col + '/*.png')):
        im = Image.open(f).convert('RGBA'); t, bb = trim(im); items.append((col[0].lower() + '_' + os.path.basename(f)[:-4], t, ()))
meta['ranks'] = pack(items, 1024, 'ranks')
# 6) UI 패널 (9조각용 원본 그대로)
os.makedirs(OUT + 'ui', exist_ok=True)
for f in glob.glob(K + '/kenney_ui-pack-rpg-expansion/PNG/*.png'):
    Image.open(f).save(OUT + 'ui/' + os.path.basename(f), optimize=True)
json.dump(meta, open(OUT + 'atlas.json', 'w'), separators=(',', ':'))
# 7) 소리 → mp3 (iPhone·iPad에서도 재생)
os.makedirs(OUT + 's', exist_ok=True)
SND = {
  'click': 'kenney_ui-audio/Audio/click3.ogg', 'tap': 'kenney_interface-sounds/Audio/select_002.ogg', 'open': 'kenney_interface-sounds/Audio/open_002.ogg', 'close': 'kenney_interface-sounds/Audio/close_002.ogg',
  'ok': 'kenney_interface-sounds/Audio/confirmation_002.ogg', 'err': 'kenney_interface-sounds/Audio/error_004.ogg', 'coin': 'kenney_interface-sounds/Audio/drop_002.ogg', 'build': 'kenney_impact-sounds/Audio/impactWood_heavy_001.ogg',
  'pluck': 'kenney_interface-sounds/Audio/pluck_001.ogg', 'up': 'kenney_interface-sounds/Audio/maximize_006.ogg', 'glass': 'kenney_interface-sounds/Audio/glass_003.ogg',
  'hit1': 'kenney_impact-sounds/Audio/impactSoft_heavy_001.ogg', 'hit2': 'kenney_impact-sounds/Audio/impactPunch_medium_001.ogg', 'hit3': 'kenney_impact-sounds/Audio/impactGeneric_light_002.ogg',
  'heal': 'kenney_sci-fi-sounds/Audio/forceField_001.ogg', 'laser': 'kenney_sci-fi-sounds/Audio/laserSmall_002.ogg', 'boom': 'kenney_sci-fi-sounds/Audio/explosionCrunch_002.ogg', 'slime': 'kenney_sci-fi-sounds/Audio/slime_000.ogg', 'skill': 'kenney_sci-fi-sounds/Audio/laserLarge_001.ogg',
  'v_ready': 'kenney_voiceover-pack-fighter/Audio/ready.ogg', 'v_fight': 'kenney_voiceover-pack-fighter/Audio/fight.ogg', 'v_win': 'kenney_voiceover-pack-fighter/Audio/you_win.ogg', 'v_lose': 'kenney_voiceover-pack-fighter/Audio/you_lose.ogg', 'v_combo': 'kenney_voiceover-pack-fighter/Audio/combo.ogg', 'v_final': 'kenney_voiceover-pack-fighter/Audio/final_round.ogg', 'v_flawless': 'kenney_voiceover-pack-fighter/Audio/flawless_victory.ogg', 'v_round1': 'kenney_voiceover-pack-fighter/Audio/round_1.ogg', 'v_winner': 'kenney_voiceover-pack-fighter/Audio/winner.ogg'
}
for k, f in SND.items():
    src = K + '/' + f
    if not os.path.exists(src): print('missing', f); continue
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '64k', OUT + 's/' + k + '.mp3'])
print('sounds', len(os.listdir(OUT + 's')))

# 적 그림 묶기: 적마다 동작별 시트(idle, move, attack…)를 한 장으로 합쳐 파일 수를 줄임
#   python3 atlas.py [mobs 폴더]   → <id>.webp + mobs.json의 각 동작에 x, y(묶음 안 위치)와 atlas 파일 이름 기록
# 동작 시트를 선반처럼 줄지어 놓되 한 장이 4096×4096을 넘지 않게 함 (휴대폰 그림 크기 제한 안쪽)
# 넘치면 여러 장(<id>.webp, <id>_2.webp …)으로 나눔
import sys, os, json
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../games/helix/assets/mobs')
MAXW = 4400; MAXH = 4096   # 한 장 최대 약 1,600만 화소
meta = json.load(open(os.path.join(D, 'mobs.json')))
before = after = 0
for mid, m in meta.items():
    sheets = []
    for a in m['anims']:
        fn = os.path.join(D, a.get('src') or a['file'])
        im = Image.open(fn).convert('RGBA'); sheets.append((a, im)); before += os.path.getsize(fn)
    pages = [[]]; x = y = rowh = 0
    for a, im in sorted(sheets, key=lambda t: -t[1].width):
        if x and x + im.width > MAXW: x = 0; y += rowh; rowh = 0
        if y and y + im.height > MAXH: pages.append([]); x = y = rowh = 0
        a['x'], a['y'], a['page'] = x, y, len(pages) - 1; pages[-1].append((a, im)); x += im.width; rowh = max(rowh, im.height)
    files = []
    for k, pg in enumerate(pages):
        W = max(a['x'] + im.width for a, im in pg); H = max(a['y'] + im.height for a, im in pg)
        at = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for a, im in pg: at.paste(im, (a['x'], a['y']))
        name = mid + ('.webp' if k == 0 else f'_{k + 1}.webp'); out = os.path.join(D, name)
        at.save(out, 'WEBP', lossless=True, method=6); after += os.path.getsize(out); files.append(name)
        print(mid, k + 1, (W, H), os.path.getsize(out) // 1024, 'KB')
    for a, im in sheets: a['src'] = a.get('src') or a['file']; a['file'] = files[a['page']]
    m['atlas'] = files
json.dump(meta, open(os.path.join(D, 'mobs.json'), 'w'), ensure_ascii=False, indent=1)
print('합계', before // 1024, 'KB →', after // 1024, 'KB')
# 묶은 뒤 동작별 원본 시트는 지움 (build.py가 다시 만듦)
for m in meta.values():
    for a in m['anims']:
        p = os.path.join(D, a['src'])
        if a['src'] not in m['atlas'] and os.path.exists(p): os.remove(p)

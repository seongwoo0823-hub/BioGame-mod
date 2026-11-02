# 미리보기 페이지에 그림·데이터를 직접 넣어 파일 하나로도 열리게 함 (앱 미리보기·파일로 열기 대응)
#   python3 bundle.py
import os, re, json, base64, glob
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../games/helix/')
HERO_FOR_MOBS = ['hero.json', 'fx.json', 'fx_spark.webp'] + [f'hero_{a}.webp' for a in ('idle', 'run', 'atk1', 'atk2', 'atk3', 'spin', 'hit')]
PAGES = {
    'hero-viewer.html': sorted(glob.glob(ROOT + 'assets/hero/*')),
    'mob-viewer.html': sorted(glob.glob(ROOT + 'assets/mobs/*')) + [ROOT + 'assets/hero/' + f for f in HERO_FOR_MOBS],
}
for page, files in PAGES.items():
    data = {}
    for f in files:
        key = os.path.relpath(f, ROOT).replace(os.sep, '/')
        if f.endswith('.json'): data[key] = json.load(open(f))
        elif f.endswith('.webp'): data[key] = 'data:image/webp;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
    p = ROOT + page; s = open(p).read()
    blob = '<!--BUNDLE--><script>window.BUNDLE=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';</script><!--/BUNDLE-->'
    s = re.sub(r'<!--BUNDLE-->.*?<!--/BUNDLE-->', lambda m: blob, s, flags=re.S)
    open(p, 'w').write(s)
    print(page, len(data), 'files', os.path.getsize(p) // 1024, 'KB')

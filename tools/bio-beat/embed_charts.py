# games/bio-beat/*.json(make_chart.py가 만든 곡 분석·채보)을 games/bio-beat.html의 AUDIO_CHARTS에 넣습니다.
#   python3 embed_charts.py
# 곡 id = 파일 이름에서 '-'를 뺀 것 (cell-world.json → cellworld). SONGS의 id와 같아야 합니다.
#
# 새 노래 추가 순서
#   1) ffmpeg -i 원본.mp3 -map_metadata -1 -ac 2 -b:a 128k games/bio-beat/<이름>.mp3
#   2) python3 make_chart.py games/bio-beat/<이름>.mp3 games/bio-beat/<이름>.json
#      → 출력의 onsetHit(노트가 실제 소리에 맞는 비율, 0.8 이상이면 좋음)과 레벨을 확인.
#        템포를 반/두 배로 잡으면 make_chart.py의 BPM_FIX에 적거나 세 번째 인자로 BPM을 줌
#   3) bio-beat.html의 SONGS·CAT·QUIZ에 곡 정보 추가 (audio:'bio-beat/<이름>.mp3', bpm은 출력값 반올림)
#   4) python3 embed_charts.py
import os, re, json, glob
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '../../games/bio-beat.html')
charts = {}
for f in sorted(glob.glob(os.path.join(HERE, '../../games/bio-beat/*.json'))):
    j = json.load(open(f))
    for c in j['charts']: c.pop('stats', None)   # 확인용 통계는 게임에 넣지 않음
    charts[os.path.basename(f)[:-5].replace('-', '')] = j
s = open(GAME, encoding='utf-8').read()
line = 'const AUDIO_CHARTS=' + json.dumps(charts, ensure_ascii=False, separators=(',', ':')) + ';'
s, n = re.subn(r'^const AUDIO_CHARTS=.*;$', lambda m: line, s, count=1, flags=re.M)
assert n == 1, 'AUDIO_CHARTS 줄을 찾지 못함'
open(GAME, 'w', encoding='utf-8').write(s)
print('embedded', list(charts), f'{len(line) // 1024}KB')

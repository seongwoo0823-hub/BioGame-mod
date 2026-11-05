# games/bio-beat/*.json(곡 분석 결과)을 games/bio-beat.html의 AUDIO_CHARTS에 넣습니다.
#   python3 embed_charts.py
# 곡 id = 파일 이름에서 '-'를 뺀 것 (cell-world.json → cellworld). SONGS의 id와 같아야 합니다.
#
# 새 노래 추가 순서
#   1) ffmpeg -i 원본.mp3 -map_metadata -1 -ac 2 -b:a 128k games/bio-beat/<이름>.mp3
#   2) python3 analyze_song.py games/bio-beat/<이름>.mp3 games/bio-beat/<이름>.json [BPM]
#      (python3 check_tempo.py 로 박자가 곡 전체에서 맞는지 확인. 어긋나면 BPM을 직접 넣어 다시)
#   3) bio-beat.html의 SONGS·CAT·QUIZ에 곡 정보 추가 (audio:'bio-beat/<이름>.mp3')
#   4) python3 embed_charts.py
import os, re, json, glob
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '../../games/bio-beat.html')
charts = {}
for f in sorted(glob.glob(os.path.join(HERE, '../../games/bio-beat/*.json'))):
    charts[os.path.basename(f)[:-5].replace('-', '')] = json.load(open(f))
s = open(GAME, encoding='utf-8').read()
line = 'const AUDIO_CHARTS=' + json.dumps(charts, ensure_ascii=False, separators=(',', ':')) + ';'
s, n = re.subn(r'^const AUDIO_CHARTS=.*;$', lambda m: line, s, count=1, flags=re.M)
assert n == 1, 'AUDIO_CHARTS 줄을 찾지 못함'
open(GAME, 'w', encoding='utf-8').write(s)
print('embedded', list(charts), f'{len(line) // 1024}KB')

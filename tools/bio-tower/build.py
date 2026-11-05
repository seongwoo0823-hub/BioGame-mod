# 바이오 타워 에셋 만들기: python3 build.py [출력 폴더]
# 조각·섬·배경은 art/의 원화(Glif로 새로 그린 그림)에서 잘라 만듭니다 → from_art.py
# (pieces.py는 충돌 모양 계산 collision()에 계속 쓰임)
import os, runpy
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'from_art.py'), run_name='__main__')

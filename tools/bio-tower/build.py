# 바이오 타워 에셋 만들기: python3 build.py [출력 폴더]
# 예전에는 조각을 코드로 그렸지만, 이제는 첨부 원화(ref/)에서 잘라 만듭니다 → from_ref.py
# (pieces.py는 충돌 모양 계산 collision()에 계속 쓰임)
import os, sys, runpy
sys.argv = [sys.argv[0]] + sys.argv[1:]
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'from_ref.py'), run_name='__main__')

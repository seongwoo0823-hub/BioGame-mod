# BIO ARCADE · 생명과학 게임 아케이드

생명과학을 소재로 한 픽셀 게임 4종을 한곳에 모은 정적 웹사이트입니다.
빌드 과정 없이 `index.html`을 열거나 GitHub Pages로 배포하면 바로 실행됩니다.

| 게임 | 장르 | 파일 |
| --- | --- | --- |
| BIO BEAT | 4키 리듬게임 (25곡, OX 퀴즈) | `games/bio-beat.html` |
| 면역 특공대 IMMUNE STRIKE | 횡스크롤 런앤건 액션 | `games/immune-strike.html` |
| 바이오 카트 레이서 | 카트 레이싱 (15트랙) | `games/bio-kart.html` |
| 혈관 협곡 : 세포 대전 | 5대5 대전 (칼바람 모드) | `games/vessel-canyon.html` |

```
index.html        메인 화면 (게임 선택, 이 기기에 저장된 기록 표시)
games/            게임 4종 (각각 하나의 HTML 파일)
assets/           메인 화면 썸네일
```

각 게임의 타이틀·메뉴·일시정지 화면에 있는 **게임 목록** 버튼으로 메인 화면에 돌아올 수 있습니다.

## 로컬에서 실행

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

파일을 더블클릭해서 열어도 동작합니다.

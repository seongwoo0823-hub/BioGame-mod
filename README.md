# BIO ARCADE · 생명과학 게임 아케이드

생명과학을 소재로 한 픽셀 게임 5종을 한곳에 모은 정적 웹사이트입니다.
빌드 과정 없이 `index.html`을 열거나 GitHub Pages로 배포하면 바로 실행됩니다.

| 게임 | 장르 | 파일 |
| --- | --- | --- |
| BIO BEAT | 4키 리듬게임 (25곡, OX 퀴즈) | `games/bio-beat.html` |
| 면역 특공대 IMMUNE STRIKE | 횡스크롤 런앤건 액션 | `games/immune-strike.html` |
| 바이오 카트 레이서 | 카트 레이싱 (15트랙) | `games/bio-kart.html` |
| 혈관 협곡 : 세포 대전 | 5대5 대전 (칼바람 모드) | `games/vessel-canyon.html` |
| BIOTRO · 세포 포커 | 포커 덱빌딩 로그라이크 | `games/biotro.html` |

```
index.html        메인 화면 (게임 선택, 이 기기에 저장된 기록 표시)
games/            게임 5종 (각각 하나의 HTML 파일)
assets/           메인 화면 썸네일
icons/            앱 아이콘
manifest.webmanifest, sw.js   앱 설치(PWA) · 오프라인 실행
```

각 게임의 타이틀·메뉴·일시정지 화면에 있는 **게임 목록** 버튼으로 메인 화면에 돌아올 수 있습니다.

## 로컬에서 실행

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

파일을 더블클릭해서 열어도 동작합니다.

## 앱으로 설치 (PWA)

GitHub Pages처럼 `https`로 배포된 주소에서 열면 앱으로 설치할 수 있습니다.

- **안드로이드 · PC 크롬/엣지**: 메인 화면의 **앱으로 설치하기** 버튼, 또는 주소창의 설치 아이콘
- **아이폰 · 아이패드**: Safari 공유 버튼 → **홈 화면에 추가**

처음 접속할 때 게임 5종이 모두 기기에 저장되므로, 설치한 뒤에는 인터넷 없이도 실행됩니다.
파일을 수정하면 다음 실행 때 자동으로 새 버전이 반영됩니다. 파일을 추가하거나 지웠다면 `sw.js`의 `CORE` 목록과 `VERSION`도 함께 바꿔 주세요.

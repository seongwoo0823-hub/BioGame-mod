# BIO ARCADE · 생명과학 게임 아케이드

생명과학을 소재로 한 게임 14종을 한곳에 모은 정적 웹사이트입니다.
빌드 과정 없이 `index.html`을 열거나 GitHub Pages로 배포하면 바로 실행됩니다.

| 게임 | 장르 | 파일 |
| --- | --- | --- |
| BIO BEAT | 4키 리듬게임 (생명과학 노래 43곡 · 레벨 1~20 · 롱노트 콤보 · 음원 분석 채보, OX 퀴즈) | `games/bio-beat.html` |
| 바이오 카트 레이서 | 3D 카트 레이싱 (15트랙) | `games/bio-kart.html` |
| 혈관 협곡 : 세포 대전 | 3D 5대5 대전 (칼바람 모드) | `games/vessel-canyon.html` |
| BIOTRO · 세포 포커 | 포커 덱빌딩 로그라이크 | `games/biotro.html` |
| 셀 브롤 : 면역 대작전 | 3D 실시간 난투 (3대3 · 생존) | `games/cell-brawl.html` |
| ONLY UP : 거꾸로 소화 대탈출 | 3D 점프 플랫포머 | `games/only-up.html` |
| 바이오 스트라이크 BIO STRIKE | 3D 1인칭 슈팅 (스토리 5장 · 생존 · 온라인 8인) | `games/bio-strike.html` |
| 세포 개척단 CELL FRONTIER | 땅따먹기 아케이드 (나라 4 · 지역 16 · 숨은 그림 16장 · 보스 8) | `games/cell-frontier.html` |
| 바이오 타워 BIO TOWER | 물리 탑 쌓기 대결 (조각 48종 · 멈추면 고정 · 온라인 최대 4명 · CPU · 한 기기) | `games/bio-tower.html` |
| 코돈 글래스 CODON GLASS | mRNA 번역 퍼즐 (모드 3 · 온라인 최대 4명 같은 판 경쟁) | `games/codon-glass.html` |
| 바이오 피라미드 타이쿤 | 3D 생명과학 타이쿤 (펫 뽑기 · 온천 · 엔딩) | `games/bio-pyramid.html` |
| 랩 포지 LAB FORGE | 3D 복셀 실험기구 30단계 강화·채굴 시뮬레이션 (광산 5 · 석사 펫 7 · 지원금 슬롯 · 보호권 · 자동 강화) | `games/lab-forge.html` |
| 생명과학 보드게임 천국 | 3D 보드게임 4종 (코돈 타일 · 모두의 세포 · 게놈 해독 코드 · 혈류 윷놀이 · AI 3단계 · 온라인 방 · 한 기기 다인) | `games/bio-board.html` |
| 바이오 스포츠 천국 | 3D 복셀 스포츠 5종 (축구 11:11 · 농구 5:5 · 야구 9이닝 · 배구 5:5 · 8볼 포켓볼 · 10개 대학 20인 로스터 · 라인업/포메이션/타순 · AI 3단계 · 온라인 방) | `games/bio-sports.html` |
| 생물의 번제 BIO OFFERING | 방 탐험 로그라이크 슈터 (6구역 · 병원체 40 · 보스 21 · 아이템 138) | `games/cell-raid.html` |

```
index.html        메인 화면 (휴대폰은 목록형, 태블릿·PC는 바둑판형으로 자동 구성 · 분류/검색 · 이어하기 · 목표 달성)
rank.js           공용 랭킹·성공 기준 (Firebase Firestore). 맨 위 FIREBASE에 apiKey·projectId를 넣으면 켜짐
icons.js          픽토그램: 사이트와 모든 게임의 이모지를 단순한 선 그림(SVG)으로 바꿈 (HTML 글자와 캔버스 글자 모두, 각 게임 <head>에서 불러옴)
games/            게임 14종 (각각 하나의 HTML 파일)
assets/           메인 화면 썸네일
games/bio-tower/  바이오 타워 조각·섬·배경 그림과 충돌 형태(pieces.json). tools/bio-tower/art/ 원화(Glif로 새로 그린 그림)에서 tools/bio-tower/from_art.py로 다시 만듦
games/cell-frontier/  세포 개척단 그림(숨은 그림 16장·덮개·지도·스프라이트). tools/cell-frontier/build.py로 다시 만듦 (숨은 그림·적·아이템은 tools/cell-frontier/art/ 원화(Glif로 새로 그린 그림)에서 from_art.py가 만듦)
games/bio-beat/    바이오 비트 노래 음원(mp3)과 채보(json), art/cover(K-pop 앨범풍 커버 43장) — tools/bio-beat/covers/의 생성기(cover.html·render.js)가 만듦. 뮤직비디오는 게임 안에서 곡마다 다른 도트 장면(SCENES)으로 그림. tools/bio-beat/make_chart.py가 음원을 분석해 하·중·상 채보를 만들고 embed_charts.py가 게임에 넣음
games/codon-glass/ 코돈 글래스 Tailwind CSS(tw.css). tools/codon-glass/build-css.sh로 다시 만듦 (썸네일 원본: tools/codon-glass/concept.html)
games/bio-board/  보드게임 천국 코드 (core.js 3D·소리·UI, app.js 로비·모드·온라인, rummi/cell/code/yut.js 게임별 규칙·AI·화면)
games/bio-sports/ 스포츠 천국 코드 (core.js 3D·소리·입력·팀 데이터, app.js 로비·프리매치·현황·온라인, soccer/basketball/baseball/volleyball/pool.js 종목별 규칙·AI·화면)
vendor/           three.js r128 (3D 게임용), Matter.js 0.19 (바이오 타워 물리), PeerJS — 모두 MIT 라이선스
icons/            앱 아이콘
manifest.webmanifest, sw.js   앱 설치(PWA) · 오프라인 실행
```

각 게임의 타이틀·메뉴·일시정지 화면에 있는 **게임 목록** 버튼으로 메인 화면에 돌아올 수 있습니다.

## 교실 서버 (온라인 게임용)

선생님 컴퓨터에서 `start-server-windows.bat`(윈도우) 또는 `start-server-mac.command`(맥)를 더블클릭하면
게임 사이트와 온라인 중계 서버가 함께 켜지고, 학생들은 화면에 나오는 주소(예: `http://192.168.0.12:8080`)로 접속합니다.
Node.js만 있으면 되고 추가 설치는 필요 없어요. 자세한 방법: [server/README.md](server/README.md)

## 로컬에서 실행

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

파일을 더블클릭해서 열어도 동작합니다.

## 앱으로 설치 (PWA)

GitHub Pages처럼 `https`로 배포된 주소에서 열면 앱으로 설치할 수 있습니다.

- **안드로이드 · PC 크롬/엣지**: 메인 화면 오른쪽 위의 **설치(아래 화살표)** 버튼, 또는 주소창의 설치 아이콘
- **아이폰 · 아이패드**: Safari 공유 버튼 → **홈 화면에 추가**

처음 접속할 때 게임 14종이 모두 기기에 저장되므로, 설치한 뒤에는 인터넷 없이도 실행됩니다.
파일을 수정하면 다음 실행 때 자동으로 새 버전이 반영됩니다. 파일을 추가하거나 지웠다면 `sw.js`의 `CORE` 목록과 `VERSION`도 함께 바꿔 주세요.

## 목표 점수 (성공 / 실패)

랭킹 대신, 게임을 아주 잘하지 않아도 넘을 수 있는 목표를 게임마다 정해 두었습니다. 게임을 열면 위쪽에 목표가 잠깐 나오고, 판이 끝나면 **성공** 또는 **실패**를 알려 줍니다. 메인 화면 카드에도 목표와 달성 여부가 보입니다. 목표 값은 `goal.js`의 `GOALS`에서 바꿀 수 있습니다.

## 플레이어별 입력 기록

모든 게임이 공통 스크립트 `ilog.js`로 플레이를 세 단계로 나눠 기록합니다. "눌렀는데 안 됐어요" 같은 문제가 어느 단계에서 끊겼는지 확인하는 용도입니다.

| 단계 | 남기는 내용 |
|---|---|
| 1. 사용자 입력 | 키·마우스·터치 (누를 때·뗄 때만, 입력창에 치는 글자는 제외) |
| 2. 게임 입력 | 게임이 입력을 어떤 행동으로 바꿨는지 (`ILOG.game('돌진')` 한 줄) |
| 3. 입력 결과 | 위치·점수·체력·화면 상태가 바뀐 것 (게임별 상태를 0.2초마다 비교) |

- **끊긴 곳 자동 표시**: 입력은 있는데 0.5초 안에 행동이 없거나(1→2), 행동은 있는데 1초 안에 결과가 없으면(2→3) 빨간 줄로 표시합니다.
- **저장**: 기기 안(IndexedDB)에 게임마다 최근 5판까지만 저장합니다. 판이 끝나거나 창을 떠날 때 한 번에 씁니다.
- **보기와 제출**
  - 메인 화면 관리자 모드의 **입력 기록 보기** 또는 아무 게임에서나 `Ctrl+Shift+L`로 엽니다.
  - CSV로 내보낼 수 있습니다.
  - 구글 시트(`input_log` 시트)에는 판 수와 끊김 횟수 같은 요약만 올라갑니다.
- 처음 실행할 때 학생에게 기록한다는 사실을 안내합니다.


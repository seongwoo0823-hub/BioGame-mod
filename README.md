# BIO ARCADE · 생명과학 게임 아케이드 (실시간 멀티플레이 서버 통합판)

생명과학을 소재로 한 게임 9종을 한곳에 모은 웹 아케이드입니다.
정적 웹사이트(GitHub Pages 등)로 바로 배포할 수 있을 뿐 아니라, 포함된 **`uWebSockets.js` 기반 초저지연 실시간 매칭·릴레이 서버(`server.js`)**를 실행하면 4종의 온라인 멀티플레이 게임을 **0.1초 빠른 매칭 + 10~25ms 초저지연 환경**으로 즐길 수 있습니다.

| 게임 | 장르 | 멀티플레이 지원 | 파일 |
| --- | --- | --- | --- |
| BIO BEAT | 4키 리듬게임 (25곡, OX 퀴즈) | 🌐 2~4인 실시간 대결 (빠른 매칭·코드 참가) | `games/bio-beat.html` |
| 면역 특공대 IMMUNE STRIKE | 횡스크롤 런앤건 액션 | 싱글플레이 | `games/immune-strike.html` |
| 바이오 카트 레이서 | 3D 카트 레이싱 (15트랙) | 🌐 최대 8인 레이싱 (빠른 매칭·예측 보간) | `games/bio-kart.html` |
| 혈관 협곡 : 세포 대전 | 3D 5대5 대전 (칼바람 모드) | 🌐 최대 10인 5:5 대전 (빠른 매칭·포지션 배정) | `games/vessel-canyon.html` |
| BIOTRO · 세포 포커 | 포커 덱빌딩 로그라이크 | 싱글플레이 | `games/biotro.html` |
| CELL BOUND · 세포의 속박 | 방 탐험 로그라이크 슈터 | 싱글플레이 | `games/cell-bound.html` |
| 세포 탐사대 CELL CADET | 생명과학 핀볼 | 싱글플레이 | `games/cell-pinball.html` |
| 셀 브롤 : 면역 대작전 | 3D 실시간 난투 (3대3 · 생존) | 🌐 최대 6인 3:3·생존 (빠른 매칭·예측 보간) | `games/cell-brawl.html` |
| ONLY UP : 거꾸로 소화 대탈출 | 3D 점프 플랫포머 | 싱글플레이 | `games/only-up.html` |

```
index.html                  메인 화면 (게임 선택, 이 기기에 저장된 기록 표시)
server.js                   통합 실시간 매칭·릴레이 서버 (uWebSockets.js 우선 구동 + 내장 Node.js 폴백)
package.json                실시간 서버 패키지 설정
games/                      게임 9종 (각각 하나의 독립된 HTML 파일)
assets/                     메인 화면 썸네일
vendor/                     three.js r128, peerjs + biogame-realtime 하이브리드 네트워크 엔진
icons/                      앱 아이콘
manifest.webmanifest, sw.js 앱 설치(PWA) · 오프라인 실행
```

## 1. 전용 실시간 서버로 실행하기 (권장 · 초저지연 온라인 매칭)

Node.js(v18 이상)가 설치되어 있다면 별도 패키지 설치 없이도 아래 명령 한 줄로 웹 서버와 실시간 매칭·릴레이 서버가 동시에 실행됩니다.

```bash
# 기본 실행 (uWebSockets.js 설치 시 자동 활성화, 미설치 시 내장 TCP_NODELAY WebSocket 엔진으로 즉시 구동)
node server.js
# 브라우저에서 http://localhost:9001 접속

# C++ 네이티브 uWebSockets.js 엔진 설치 후 실행 (선택 사항 · 대규모 동시접속 시 권장)
npm run install-uws
npm start
```

### 실시간 네트워크 아키텍처 개선 사항
1. **전용 실시간 서버(`server.js`) 자동 연결 및 1:N 브로드캐스트 팬아웃**:
   - 방장이 20~30Hz로 월드 스냅샷(`state`)을 보낼 때 동일 틱의 패킷을 1개의 `bcast` 프레임으로 병합해 서버로 전송하고, 서버가 모든 게스트에게 복제 전달하여 방장의 업로드 대역폭 부담을 **1/N**로 줄입니다.
2. **백프레셔(Backpressure) 자동 드롭**:
   - 특정 플레이어의 와이파이/모바일 네트워크가 일시적으로 밀려 송신 버퍼(16KB)가 차오르면, 이전 `state`/`input` 패킷을 즉시 건너뛰어 **Head-of-Line Blocking(화면이 멈췄다가 배속으로 순간이동하는 현상)**을 차단합니다.
3. **0.1초 즉시 빠른 매칭 (`quick_match`)**:
   - 4개 멀티플레이 게임 모두 서버 메모리의 대기 방 목록을 즉시 조회하여 **0.1초 이내**에 열린 방에 입장하거나 새 방을 생성합니다.
4. **정적 호스팅(GitHub Pages) 시 개선된 하이브리드 P2P 자동 폴백**:
   - 전용 서버 없이 정적 페이지로만 열었을 때도 **제어 채널(`reliable: true`)과 실시간 위치/입력 채널(`reliable: false, maxRetransmits: 0`, UDP 모드)**을 자동으로 분리하고, 후보 매칭 방을 **병렬 탐색**하여 기존 대비 매칭 속도와 끊김 현상을 대폭 개선했습니다.
   - 정적 호스팅 주소 뒤에 `?ws=wss://내서버주소/ws`를 붙이거나 콘솔에서 `BIO_RT.setServerUrl('wss://내서버주소/ws')`를 호출하면 외부 전용 실시간 서버로 즉시 연동됩니다.
5. **Web Worker 백그라운드 타이머 (방장 탭 비활성화 방어)**:
   - 방장이 브라우저 탭을 전환하거나 창을 내려도 인라인 Web Worker가 25Hz 물리·네트워크 틱을 유지하여 게스트들의 게임이 멈추지 않습니다.

## 2. 정적 파일로만 실행하기

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 3. 앱으로 설치 (PWA)

GitHub Pages 또는 HTTPS가 적용된 서버에서 열면 모바일·PC 앱으로 설치할 수 있습니다.
- **안드로이드 · PC 크롬/엣지**: 메인 화면의 **앱으로 설치하기** 버튼, 또는 주소창의 설치 아이콘
- **아이폰 · 아이패드**: Safari 공유 버튼 → **홈 화면에 추가**

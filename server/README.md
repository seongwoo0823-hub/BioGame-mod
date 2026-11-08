# BIO ARCADE 실시간 중계 서버

빠르게 움직이는 온라인 게임(바이오 스트라이크·혈관 협곡·바이오 카트 등)이 학교 와이파이에서 끊기지 않도록,
학생 기기들이 서로 직접 연결하는 대신 **이 서버 하나에 웹소켓(wss)으로 접속**하고 서버가 메시지를 전달합니다.

- `server.js` 중계 서버 (Node.js + ws). 방 코드로 만나고, 게임 데이터는 해석하지 않고 바로 전달
- `setup.sh` Oracle Cloud(Ubuntu)에 한 번에 설치: Node.js · Caddy(https 인증서) · 서비스 등록 · 방화벽
- 게임 쪽: 루트의 `net.js` (`RELAY_URL`에 서버 주소). 서버에 닿지 않으면 자동으로 예전 P2P 방식으로 돌아감

## 설치 (Oracle Cloud 무료 서버, 서울)
1. Oracle Cloud 가입 — 홈 지역(Home Region)을 **South Korea Central (Seoul)** 로 고르기 (나중에 못 바꿈)
2. 컴퓨트 → 인스턴스 → 인스턴스 생성: 이미지 **Ubuntu 22.04**, 모양 **VM.Standard.A1.Flex(1 OCPU, 6GB)** 또는 **VM.Standard.E2.1.Micro** (Always Free)
3. 네트워킹 → 가상 클라우드 네트워크 → 서브넷 → 보안 목록 → **수신 규칙 추가**: 소스 `0.0.0.0/0`, TCP, 대상 포트 `80,443`
4. 인스턴스 화면 위쪽 **Cloud Shell** 또는 SSH로 접속해 실행:
   ```
   curl -fsSL https://seongwoo0823-hub.github.io/BioGame-mod/server/setup.sh | sudo bash
   ```
5. 끝에 나오는 `wss://…sslip.io` 주소를 `net.js`의 `RELAY_URL`에 넣기

상태 확인: 브라우저로 `https://주소/` → `{"ok":true,"peers":…}`
로그 보기: `sudo journalctl -u bio-relay -f` · 다시 시작: `sudo systemctl restart bio-relay`

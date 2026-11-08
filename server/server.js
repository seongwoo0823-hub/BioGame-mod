// BIO ARCADE 실시간 중계 서버 (WebSocket)
//   학생 기기들이 서로 직접 연결(P2P)하는 대신, 모두 이 서버 하나에 웹소켓으로 접속하고
//   서버가 같은 방의 메시지를 바로바로 전달합니다. 게임 쪽은 net.js가 PeerJS와 똑같은 모양으로 감싸 줌.
//
//   주고받는 형식 (문자열)
//     {"t":"open","id":"방코드 또는 생략"}        → {"t":"open","id":…} 또는 {"t":"error","type":"unavailable-id"}
//     {"t":"connect","to":id,"cid":연결id,"meta":…} → 상대에게 {"t":"conn","from":…,"cid":…,"meta":…}, 나에게 {"t":"connopen","cid":…}
//                                                    상대가 없으면 {"t":"error","type":"peer-unavailable","cid":…}
//     "D" + cid(8글자) + 내용                       → 연결 상대에게 그대로 전달 (서버는 내용을 해석하지 않아 빠름)
//     {"t":"close","cid":…}                         → 상대에게 {"t":"close","cid":…}
//
//   실행: PORT=8080 node server.js   (앞에 Caddy가 https/wss 인증서를 붙여 줌 — setup.sh 참고)
'use strict';
const http = require('http');
const {WebSocketServer} = require('ws');

const PORT = +process.env.PORT || 8080;
const MAX_MSG = 256 * 1024;          // 메시지 하나 최대 크기
const MAX_PEERS = 2000;              // 동시에 열 수 있는 연결 수
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const peers = new Map();             // id → socket
const links = new Map();             // cid → [socketA, socketB]
let served = 0;

const rid = n => { const s = 'abcdefghijkmnpqrstuvwxyz23456789'; let o = ''; for (let i = 0; i < n; i++) o += s[Math.random() * s.length | 0]; return o; };
const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };

const server = http.createServer((req, res) => {
  // 상태 확인용: https://주소/  → 접속 수
  res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'});
  res.end(JSON.stringify({ok: true, name: 'bio-arcade-relay', peers: peers.size, links: links.size, served}));
});
const wss = new WebSocketServer({server, maxPayload: MAX_MSG, perMessageDeflate: false});

wss.on('connection', (ws, req) => {
  if (peers.size >= MAX_PEERS) { ws.close(1013, 'full'); return; }
  ws.id = null; ws.cids = new Set(); ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf, isBin) => {
    const s = isBin ? null : buf.toString();
    if (!s) return;
    if (s.charCodeAt(0) === 68 /* D */) {                    // 게임 데이터: 그대로 전달
      const cid = s.slice(1, 9), L = links.get(cid);
      if (!L) return;
      const other = L[0] === ws ? L[1] : L[0];
      if (other && other.readyState === 1 && other.bufferedAmount < 4 * 1024 * 1024) { other.send(s); served++; }
      return;
    }
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (m.t === 'open') {
      if (ws.id) return;
      let id = m.id;
      if (id != null) {
        if (!ID_RE.test(id)) return send(ws, {t: 'error', type: 'invalid-id'});
        if (peers.has(id)) return send(ws, {t: 'error', type: 'unavailable-id'});
      } else { do { id = rid(16); } while (peers.has(id)); }
      ws.id = id; peers.set(id, ws); send(ws, {t: 'open', id});
    } else if (m.t === 'connect') {
      if (!ws.id || typeof m.cid !== 'string' || m.cid.length !== 8 || links.has(m.cid)) return;
      const target = peers.get(m.to);
      if (!target || target === ws) return send(ws, {t: 'error', type: 'peer-unavailable', cid: m.cid, message: 'Could not connect to peer ' + m.to});
      links.set(m.cid, [ws, target]); ws.cids.add(m.cid); target.cids.add(m.cid);
      send(target, {t: 'conn', from: ws.id, cid: m.cid, meta: m.meta === undefined ? null : m.meta});
      send(ws, {t: 'connopen', cid: m.cid});
    } else if (m.t === 'close') {
      drop(m.cid, ws);
    } else if (m.t === 'ping') {
      send(ws, {t: 'pong', ts: m.ts});
    }
  });
  ws.on('close', () => {
    for (const cid of [...ws.cids]) drop(cid, ws);
    if (ws.id && peers.get(ws.id) === ws) peers.delete(ws.id);
  });
  ws.on('error', () => {});
});

function drop(cid, from) {
  const L = links.get(cid); if (!L) return;
  links.delete(cid);
  for (const s of L) { s.cids.delete(cid); if (s !== from) send(s, {t: 'close', cid}); }
}

// 끊긴 연결 정리 (20초마다 확인)
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (e) {} }
}, 20000);

server.listen(PORT, () => console.log('bio-arcade-relay on :' + PORT));

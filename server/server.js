// BIO ARCADE 실시간 중계 서버 (WebSocket) · v3
//   학생 기기들이 서로 직접 연결(P2P)하는 대신, 모두 이 서버 하나에 웹소켓으로 접속하고
//   서버가 같은 방의 메시지를 바로바로 전달합니다. 게임 쪽은 net.js가 PeerJS와 똑같은 모양으로 감싸 줌.
//
//   주고받는 형식 (문자열)
//     {"t":"open","id":"방장 아이디(접두어+방코드) 또는 생략","key":"재접속 열쇠"}
//         → {"t":"open","id":…,"v":3} 또는 {"t":"error","type":"unavailable-id"}
//         같은 key로 다시 열면(와이파이가 잠깐 끊겼다 붙은 경우) 예전 연결을 밀어내고 그 아이디를 되찾음
//     {"t":"connect","to":id,"cid":연결id,"meta":…} → 상대에게 {"t":"conn","from":…,"cid":…,"meta":…}, 나에게 {"t":"connopen","cid":…}
//                                                    상대가 없으면 {"t":"error","type":"peer-unavailable","cid":…}
//     "D" + cid(8글자) + 내용                       → 연결 상대에게 그대로 전달 (서버는 내용을 해석하지 않아 빠름)
//     "M" + cid들(8글자씩 이어 붙임) + "|" + 내용    → 각 상대에게 "D"+cid+내용 (방장이 같은 상태를 한 번만 올리면 서버가 나눠 줌)
//     {"t":"close","cid":…}                         → 상대에게 {"t":"close","cid":…}
//     {"t":"info","info":{…}}                       → 방 정보(방 이름·진행 중 여부 등)를 방 목록에 함께 보여 줌
//     {"t":"ping","ts":…}                           → {"t":"pong","ts":…}
//
//   HTTP
//     GET /                → {"ok":true, peers, links, rooms, served}  (상태 확인 · 잠든 서버 깨우기)
//     GET /rooms?p=접두어   → {"ok":true, rooms:[{code, players, age, info}]}  (그 게임의 열린 방 목록)
//
//   실행: PORT=8080 node server.js
'use strict';
const http = require('http');
const {WebSocketServer} = require('ws');

const PORT = +process.env.PORT || 8080;
const MAX_MSG = 256 * 1024;          // 메시지 하나 최대 크기
const MAX_PEERS = 3000;              // 동시에 열 수 있는 연결 수
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BUF_LIMIT = 4 * 1024 * 1024;   // 받는 쪽이 이만큼 밀려 있으면 그 메시지는 건너뜀 (느린 기기 하나가 서버를 붙잡지 않게)

const peers = new Map();             // id → socket
const links = new Map();             // cid → [socketA(연결을 건 쪽), socketB(받은 쪽)]
let served = 0;
const started = Date.now();

const rid = n => { const s = 'abcdefghijkmnpqrstuvwxyz23456789'; let o = ''; for (let i = 0; i < n; i++) o += s[Math.random() * s.length | 0]; return o; };
const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };

function roomsOf(prefix) {
  const out = [];
  if (!prefix || prefix.length < 3) return out;
  for (const [id, ws] of peers) {
    if (!ws.named || !id.startsWith(prefix) || ws.readyState !== 1) continue;
    const guests = new Set();
    for (const cid of ws.cids) { const L = links.get(cid); if (L && L[1] === ws && L[0].readyState === 1) guests.add(L[0]); }
    out.push({code: id.slice(prefix.length), players: guests.size + 1, age: Math.round((Date.now() - ws.since) / 1000), info: ws.info || null});
  }
  out.sort((a, b) => a.age - b.age);
  return out.slice(0, 50);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'});
  if (u.pathname === '/rooms') { res.end(JSON.stringify({ok: true, rooms: roomsOf(u.searchParams.get('p') || '')})); return; }
  let rooms = 0; for (const ws of peers.values()) if (ws.named) rooms++;
  res.end(JSON.stringify({ok: true, name: 'bio-arcade-relay', v: 3, peers: peers.size, links: links.size, rooms, served, up: Math.round((Date.now() - started) / 1000)}));
});
const wss = new WebSocketServer({server, maxPayload: MAX_MSG, perMessageDeflate: false});

function relay(ws, cid, body, whole) {
  const L = links.get(cid);
  if (!L || (L[0] !== ws && L[1] !== ws)) return;
  const other = L[0] === ws ? L[1] : L[0];
  if (other && other.readyState === 1 && other.bufferedAmount < BUF_LIMIT) { other.send(whole || ('D' + cid + body)); served++; }
}

wss.on('connection', ws => {
  if (wss.clients.size > MAX_PEERS) { ws.close(1013, 'full'); return; }
  ws.id = null; ws.cids = new Set(); ws.alive = true; ws.since = Date.now();
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf, isBin) => {
    if (isBin) return;
    const s = buf.toString();
    if (!s) return;
    ws.alive = true;
    const c0 = s.charCodeAt(0);
    if (c0 === 68 /* D */) { relay(ws, s.slice(1, 9), null, s); return; }
    if (c0 === 77 /* M */) {                                   // 같은 내용을 여러 연결에 나눠 보냄
      const bar = s.indexOf('|'); if (bar < 9) return;
      const ids = s.slice(1, bar), body = s.slice(bar + 1);
      for (let i = 0; i + 8 <= ids.length; i += 8) relay(ws, ids.slice(i, i + 8), body);
      return;
    }
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    switch (m.t) {
      case 'open': {
        if (ws.id) return;
        let id = m.id; const key = typeof m.key === 'string' ? m.key.slice(0, 40) : '';
        if (id != null) {
          if (!ID_RE.test(id)) return send(ws, {t: 'error', type: 'invalid-id', message: 'Invalid id'});
          const old = peers.get(id);
          if (old && old !== ws) {
            // 같은 기기가 다시 붙은 경우(열쇠가 같음) 또는 예전 연결이 이미 죽은 경우 → 아이디를 넘겨줌
            if ((key && old.key === key) || old.readyState !== 1 || !old.alive) { peers.delete(id); old.id = null; try { old.terminate(); } catch (e) { } cleanup(old); }
            else return send(ws, {t: 'error', type: 'unavailable-id', message: 'ID "' + id + '" is taken'});
          }
          ws.named = true;
        } else { do { id = rid(16); } while (peers.has(id)); }
        ws.id = id; ws.key = key; ws.since = Date.now(); peers.set(id, ws);
        send(ws, {t: 'open', id, v: 3});
        break;
      }
      case 'connect': {
        if (!ws.id || typeof m.cid !== 'string' || m.cid.length !== 8 || links.has(m.cid)) return;
        const target = peers.get(m.to);
        if (!target || target === ws || target.readyState !== 1) return send(ws, {t: 'error', type: 'peer-unavailable', cid: m.cid, message: 'Could not connect to peer ' + m.to});
        links.set(m.cid, [ws, target]); ws.cids.add(m.cid); target.cids.add(m.cid);
        send(target, {t: 'conn', from: ws.id, cid: m.cid, meta: m.meta === undefined ? null : m.meta});
        send(ws, {t: 'connopen', cid: m.cid});
        break;
      }
      case 'close': drop(m.cid, ws); break;
      case 'info': if (ws.named && m.info && typeof m.info === 'object') { const j = JSON.stringify(m.info); if (j.length < 600) ws.info = m.info; } break;
      case 'ping': send(ws, {t: 'pong', ts: m.ts}); break;
    }
  });
  ws.on('close', () => cleanup(ws));
  ws.on('error', () => { });
});

function cleanup(ws) {
  for (const cid of [...ws.cids]) drop(cid, ws);
  if (ws.id && peers.get(ws.id) === ws) peers.delete(ws.id);
}
function drop(cid, from) {
  const L = links.get(cid); if (!L) return;
  if (from && L[0] !== from && L[1] !== from) return;
  links.delete(cid);
  for (const s of L) { s.cids.delete(cid); if (s !== from) send(s, {t: 'close', cid}); }
}

// 끊긴 연결 정리: 15초마다 확인, 응답이 없으면 끊음 (방 목록에 죽은 방이 남지 않게)
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; try { ws.ping(); } catch (e) { } }
}, 15000);

server.listen(PORT, () => console.log('bio-arcade-relay v3 on :' + PORT));

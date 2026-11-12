// BIO ARCADE 실시간 중계 및 로컬 제어 서버 (개선판 v2.1)
//   1. /health 엔드포인트 지원으로 index.html 상단 서버 표시줄 및 Render 헬스체크 100% 호환
//   2. connect 요청 시 즉시 connopen 응답을 내려 핸드셰이크 대기 시간(RTT) 절반 단축 + 구버전/신버전 net.js 모두 호환
//   3. TCP_NODELAY(Nagle 알고리즘 비활성화) 적용으로 소형 게임 패킷 지연(40~200ms) 제거
//   4. http://localhost:8080/admin 웹 컨트롤 패널 및 정적 게임 서버 내장
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 8080;
const MAX_MSG = 256 * 1024;
const MAX_PEERS = 2000;
const MAX_BUFFER = 2 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const ROOT_DIR = fs.existsSync(path.join(__dirname, 'index.html'))
  ? __dirname
  : path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const peers = new Map(); // id -> ws
const links = new Map(); // cid -> [wsA, wsB]
let served = 0;
const startedAt = Date.now();

const rid = n => {
  const s = 'abcdefghijkmnpqrstuvwxyz23456789';
  let o = '';
  for (let i = 0; i < n; i++) o += s[Math.floor(Math.random() * s.length)];
  return o;
};

const send = (ws, o) => {
  if (ws && ws.readyState === 1) {
    ws.send(typeof o === 'string' ? o : JSON.stringify(o));
  }
};

function getLanIps() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Chrome Private Network Access(HTTPS -> 127.0.0.1 요청) 허용 헤더
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. index.html의 BioRelay.check() 및 바탕화면 컨트롤러가 호출하는 상태 확인 엔드포인트
  if (pathname === '/health' || pathname === '/api/status' || pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'ok',
      ok: true,
      name: 'bio-arcade-relay-v2',
      port: PORT,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      peers: peers.size,
      links: links.size,
      served,
      lanIps: getLanIps()
    }));
    return;
  }

  // 2. 로컬 바탕화면 컨트롤러에서 안전하게 서버를 종료하는 엔드포인트
  if (pathname === '/api/stop' && (req.method === 'POST' || req.method === 'GET')) {
    const remote = req.socket.remoteAddress || '';
    if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, msg: 'Server stopping' }));
      setTimeout(() => process.exit(0), 150);
      return;
    }
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 3. BioGame-mod 정적 파일 서빙 (로컬에서 http://localhost:8080 접속 시 게임 실행)
  let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Render 서버처럼 server/ 폴더만 단독 배포된 경우 '/' 요청에도 상태 JSON을 반환해 기존 동작 완벽 호환
      if (safePath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          status: 'ok',
          ok: true,
          peers: peers.size,
          links: links.size,
          served
        }));
        return;
      }
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// TCP_NODELAY 활성화: Nagle 알고리즘으로 인한 40~200ms 패킷 묶임 지연 제거
server.on('connection', socket => {
  try { socket.setNoDelay(true); } catch (e) {}
});

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_MSG,
  perMessageDeflate: false
});

wss.on('connection', (ws, req) => {
  if (peers.size >= MAX_PEERS) {
    ws.close(1013, 'full');
    return;
  }
  if (ws._socket && typeof ws._socket.setNoDelay === 'function') {
    try { ws._socket.setNoDelay(true); } catch (e) {}
  }

  ws.id = null;
  ws.cids = new Set();
  ws.alive = true;

  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', (buf, isBin) => {
    ws.alive = true;
    const s = isBin ? null : buf.toString();
    if (!s) return;

    const code = s.charCodeAt(0);

    // 1. 다중 전송 ('M' + 8자리 cid 목록 + '|' + payload)
    if (code === 77 /* 'M' */) {
      const bar = s.indexOf('|');
      if (bar < 9) return;
      const ids = s.slice(1, bar);
      const body = s.slice(bar + 1);
      for (let i = 0; i + 8 <= ids.length; i += 8) {
        const cid = ids.slice(i, i + 8);
        const L = links.get(cid);
        if (!L || (L[0] !== ws && L[1] !== ws)) continue;
        const other = L[0] === ws ? L[1] : L[0];
        if (other && other.readyState === 1 && other.bufferedAmount < MAX_BUFFER) {
          other.send('D' + cid + body);
          served++;
        }
      }
      return;
    }

    // 2. 단일 전송 ('D' + 8자리 cid + payload)
    if (code === 68 /* 'D' */) {
      const cid = s.slice(1, 9);
      const L = links.get(cid);
      if (!L) return;
      const other = L[0] === ws ? L[1] : L[0];
      if (other && other.readyState === 1 && other.bufferedAmount < MAX_BUFFER) {
        other.send(s);
        served++;
      }
      return;
    }

    // 3. 제어 메시지 (JSON)
    let m;
    try { m = JSON.parse(s); } catch (e) { return; }

    if (m.t === 'open') {
      if (ws.id) return;
      let id = m.id != null ? String(m.id).trim() : '';
      if (id) {
        if (!ID_RE.test(id)) {
          return send(ws, { t: 'error', type: 'invalid-id', message: '유효하지 않은 방 코드입니다' });
        }
        const prev = peers.get(id);
        if (prev && prev !== ws) {
          // 방장이 새로고침했을 때 이전 좀비 소켓이 남아있다면 즉시 정리 후 방 코드 재사용 허용
          if (prev.readyState !== 1 || prev.cids.size === 0) {
            for (const cid of [...prev.cids]) drop(cid, prev);
            try { prev.terminate(); } catch (e) {}
            peers.delete(id);
          } else {
            return send(ws, { t: 'error', type: 'unavailable-id', message: '이미 사용 중인 방 코드입니다' });
          }
        }
      } else {
        do { id = rid(16); } while (peers.has(id));
      }
      ws.id = id;
      peers.set(id, ws);
      send(ws, { t: 'open', id, v: 2 });
    } else if (m.t === 'connect') {
      if (!ws.id || typeof m.cid !== 'string' || m.cid.length !== 8 || links.has(m.cid)) return;
      const target = peers.get(m.to);
      if (!target || target === ws || target.readyState !== 1) {
        return send(ws, { t: 'error', type: 'peer-unavailable', cid: m.cid, message: '상대를 찾을 수 없습니다' });
      }
      links.set(m.cid, [ws, target]);
      ws.cids.add(m.cid);
      target.cids.add(m.cid);
      send(target, { t: 'conn', from: ws.id, cid: m.cid, meta: m.meta === undefined ? null : m.meta });
      // 구버전/신버전 클라이언트 모두 대기 없이 즉시 열린 상태로 전환되도록 connopen 즉시 발송
      send(ws, { t: 'connopen', cid: m.cid });
    } else if (m.t === 'connack') {
      const L = links.get(m.cid);
      if (L) {
        const initiator = L[0] === ws ? L[1] : L[0];
        send(initiator, { t: 'connopen', cid: m.cid });
      }
    } else if (m.t === 'close') {
      drop(m.cid, ws);
    } else if (m.t === 'ping') {
      send(ws, { t: 'pong', ts: m.ts });
    }
  });

  ws.on('close', () => {
    for (const cid of [...ws.cids]) drop(cid, ws);
    if (ws.id && peers.get(ws.id) === ws) peers.delete(ws.id);
  });

  ws.on('error', () => {});
});

function drop(cid, from) {
  const L = links.get(cid);
  if (!L) return;
  links.delete(cid);
  for (const s of L) {
    s.cids.delete(cid);
    if (s !== from) send(s, { t: 'close', cid });
  }
}

// 20초마다 끊긴 연결 정리
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    try { ws.ping(); } catch (e) {}
  }
}, 20000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('bio-arcade-relay v2.1 on :' + PORT);
});
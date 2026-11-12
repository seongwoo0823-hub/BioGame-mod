// BIO ARCADE 실시간 중계 및 로컬 웹 서버 (개선판 v2.0)
//   1. TCP_NODELAY(Nagle 알고리즘 비활성화) 적용으로 소형 게임 패킷 지연(40~200ms) 즉시 제거
//   2. 정적 웹 서버 내장: http://localhost:8080 접속 시 BioGame-mod 전체 게임을 바로 실행 가능
//   3. 방장이 새로고침할 때 기존 좀비 피어 ID가 방 코드 생성을 막는 현상(unavailable-id) 자동 교체 해결
//   4. 실시간 핑(ping/pong) 응답 및 바탕화면 컨트롤러용 상태/종료 API(/api/status, /api/stop) 제공
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = +process.env.PORT || 8080;
const MAX_MSG = 256 * 1024;
const MAX_PEERS = 2000;
const MAX_BUFFER = 1024 * 1024; // 1MB 백프레셔 임계값 (오래된 패킷 누적 방지)
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// server/ 폴더 안에서 실행되든 루트에서 실행되든 BioGame-mod 루트 폴더를 자동 탐색
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'index.html'))
  ? __dirname
  : path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
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
  for (let i = 0; i < n; i++) o += s[Math.random() * s.length | 0];
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
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. 서버 상태 확인 API (바탕화면 런처 및 헬스체크용)
  if (pathname === '/api/status' || pathname === '/ping') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
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

  // 2. 로컬 바탕화면 컨트롤러에서 안전하게 서버를 종료하는 API (로컬호스트 요청만 허용)
  if (pathname === '/api/stop' && req.method === 'POST') {
    const remote = req.socket.remoteAddress || '';
    if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, msg: '서버를 종료합니다.' }));
      console.log('[종료 요청 수신] 서버를 안전하게 닫습니다...');
      setTimeout(() => process.exit(0), 150);
      return;
    }
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 3. BioGame-mod 정적 파일 서빙 (브라우저에서 http://localhost:8080 으로 즉시 플레이 가능)
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
      // 루트에 index.html이 없을 때는 상태 JSON 반환 (기존 서버 동작 호환)
      if (safePath === '/index.html') {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          ok: true,
          name: 'bio-arcade-relay-v2',
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

// TCP_NODELAY 활성화: 소형 실시간 좌표 패킷이 OS 커널 버퍼에서 묶여 지연되는 현상(Nagle 알고리즘) 제거
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

    const firstChar = s.charCodeAt(0);

    // 1. 멀티캐스트 브로드캐스트 ('M' + 8자리 cid 묶음 + '|' + payload)
    if (firstChar === 77 /* 'M' */) {
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

    // 2. 단일 다이렉트 패킷 ('D' + 8자리 cid + payload)
    if (firstChar === 68 /* 'D' */) {
      const cid = s.slice(1, 9);
      const L = links.get(cid);
      if (!L || (L[0] !== ws && L[1] !== ws)) return;
      const other = L[0] === ws ? L[1] : L[0];
      if (other && other.readyState === 1 && other.bufferedAmount < MAX_BUFFER) {
        other.send(s);
        served++;
      }
      return;
    }

    // 3. 제어 명령 (JSON)
    let m;
    try { m = JSON.parse(s); } catch (e) { return; }

    if (m.t === 'ping') {
      send(ws, { t: 'pong' });
      return;
    }

    if (m.t === 'open') {
      let id = m.id && typeof m.id === 'string' ? m.id.trim() : '';
      if (id) {
        if (!ID_RE.test(id)) {
          send(ws, { t: 'error', type: 'unavailable-id', msg: 'Invalid ID format' });
          return;
        }
        const existing = peers.get(id);
        if (existing && existing !== ws) {
          // 기존 소켓이 이미 닫혔거나 활성 연결이 없는 좀비 소켓이면 즉시 교체 허용
          if (existing.readyState !== 1 || existing.cids.size === 0) {
            try { existing.terminate(); } catch (e) {}
            peers.delete(id);
          } else {
            send(ws, { t: 'error', type: 'unavailable-id', msg: 'ID already taken' });
            return;
          }
        }
      } else {
        do { id = rid(12); } while (peers.has(id));
      }
      ws.id = id;
      peers.set(id, ws);
      send(ws, { t: 'open', id });
    } else if (m.t === 'connect') {
      const target = peers.get(m.to);
      const cid = m.cid || rid(8);
      if (!target || target === ws || target.readyState !== 1) {
        send(ws, { t: 'error', type: 'peer-unavailable', cid, msg: 'Target peer not found' });
        return;
      }
      links.set(cid, [ws, target]);
      ws.cids.add(cid);
      target.cids.add(cid);
      send(target, { t: 'conn', from: ws.id, cid, meta: m.meta });
    } else if (m.t === 'connack') {
      const L = links.get(m.cid);
      if (L) {
        const initiator = L[0] === ws ? L[1] : L[0];
        send(initiator, { t: 'connopen', cid: m.cid });
      }
    } else if (m.t === 'close') {
      cleanupCid(m.cid, ws);
    }
  });

  ws.on('close', () => {
    if (ws.id && peers.get(ws.id) === ws) peers.delete(ws.id);
    for (const cid of Array.from(ws.cids)) cleanupCid(cid, ws);
  });

  ws.on('error', () => {});
});

function cleanupCid(cid, fromWs) {
  const L = links.get(cid);
  if (!L) return;
  links.delete(cid);
  const other = L[0] === fromWs ? L[1] : L[0];
  if (other) {
    other.cids.delete(cid);
    send(other, { t: 'close', cid });
  }
  if (fromWs) fromWs.cids.delete(cid);
}

// 15초마다 죽은 소켓 빠르게 정리
setInterval(() => {
  for (const [id, ws] of peers) {
    if (!ws.alive) {
      ws.terminate();
      peers.delete(id);
      continue;
    }
    ws.alive = false;
    try { ws.ping(); } catch (e) {}
  }
}, 15000);

server.listen(PORT, '0.0.0.0', () => {
  const lanIps = getLanIps();
  console.log('====================================================');
  console.log(' [BIO ARCADE 로컬 Node.js 서버 가동 완료]');
  console.log(` - 내 PC 접속 주소 : http://localhost:${PORT}`);
  if (lanIps.length > 0) {
    console.log(` - 같은 와이파이(LAN) 친구 접속 주소 : http://${lanIps[0]}:${PORT}`);
    console.log(` - 릴레이 전용 주소 : ws://${lanIps[0]}:${PORT}`);
  }
  console.log('====================================================');
});
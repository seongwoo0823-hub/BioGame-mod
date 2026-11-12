// BIO ARCADE 교실 서버 (선생님 컴퓨터에서 실행) · v4
//   이 컴퓨터 하나가 ① 게임 사이트(html·그림·소리)와 ② 온라인 게임 중계(웹소켓)를 함께 맡습니다.
//   학생들은 같은 와이파이에서 화면에 나오는 주소(예: http://192.168.0.12:8080)로 접속하면 끝.
//   추가 설치 없이 Node.js만 있으면 돌아갑니다 (npm install 필요 없음).
//
//   실행: 저장소 폴더의 start-server-windows.bat (윈도우) / start-server-mac.command (맥) 더블클릭
//         또는 터미널에서  node server/server.js   (포트 바꾸기: PORT=9000 node server/server.js)
//
//   중계 형식 (net.js가 PeerJS와 같은 모양으로 감싸 줌, 게임 코드는 그대로)
//     {"t":"open","id":"방장 아이디(접두어+방코드) 또는 생략","key":"재접속 열쇠"} → {"t":"open","id":…,"v":4} | {"t":"error","type":"unavailable-id"}
//     {"t":"connect","to":id,"cid":8글자,"meta":…} → 상대 {"t":"conn",…}, 나 {"t":"connopen",…} | {"t":"error","type":"peer-unavailable","cid":…}
//     "D"+cid+내용 → 연결 상대에게 그대로 전달 · "M"+cid들+"|"+내용 → 여러 상대에게 나눠 전달
//     {"t":"close","cid"} · {"t":"info","info":{…}} · {"t":"ping","ts"} → {"t":"pong","ts"}
//   HTTP
//     /__status → 서버 상태 · /__rooms?p=접두어 → 열린 방 목록 · /__info → 학생 접속 주소
//     그 밖의 주소 → 저장소 폴더의 파일 (index.html, games/… 등)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8080;
const ROOT = path.resolve(__dirname, '..');           // 저장소 폴더 (index.html이 있는 곳)
const MAX_MSG = 1024 * 1024;                          // 메시지 하나 최대 크기
const MAX_CLIENTS = 3000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BUF_LIMIT = 4 * 1024 * 1024;                    // 받는 쪽이 이만큼 밀려 있으면 그 메시지는 건너뜀
const started = Date.now();

// ---------------------------------------------------------------- 학생 접속 주소
function lanUrls() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue;
      if (/vmware|virtualbox|vEthernet|docker|hyper-v|loopback|tailscale|zerotier/i.test(name)) continue;
      out.push('http://' + a.address + (PORT === 80 ? '' : ':' + PORT));
    }
  }
  // 학교·집 와이파이에서 흔한 주소(192.168, 10, 172.16~31)를 앞에
  return out.sort((x, y) => (/\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(y) ? 1 : 0) - (/\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(x) ? 1 : 0));
}

// ---------------------------------------------------------------- 파일 보내기
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.avif': 'image/avif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm'
};
const HIDDEN = /(^|\/)(\.git|\.github|node_modules|tools)(\/|$)|\/\.[^/]*$/;
// net.js를 보낼 때 맨 앞에 이 한 줄을 붙여 '교실 서버로 중계하기'를 켬 (GitHub Pages에서 열면 붙지 않아 예전처럼 P2P)
const NET_FLAG = 'window.BIO_LOCAL_RELAY=1;\n';

function sendFile(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch (e) { res.writeHead(400); res.end(); return; }
  if (rel.includes('\0')) { res.writeHead(400); res.end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); res.end(); return; }
  if (HIDDEN.test(path.relative(ROOT, file).split(path.sep).join('/'))) { res.writeHead(404); res.end('Not found'); return; }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) { res.writeHead(301, {Location: urlPath.replace(/\/?$/, '/')}); res.end(); return; }
    if (err || !st.isFile()) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('파일이 없어요: ' + rel); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const head = {'Content-Type': type, 'Cache-Control': /\.(html|js|json|webmanifest)$/i.test(file) ? 'no-cache' : 'public, max-age=3600', 'Accept-Ranges': 'bytes'};
    if (path.relative(ROOT, file) === 'net.js') {
      fs.readFile(file, (e, buf) => {
        if (e) { res.writeHead(500); res.end(); return; }
        const body = Buffer.concat([Buffer.from(NET_FLAG), buf]);
        res.writeHead(200, Object.assign(head, {'Content-Length': body.length})); res.end(req.method === 'HEAD' ? undefined : body);
      });
      return;
    }
    // 소리·영상 건너뛰기를 위한 부분 요청(Range)
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? +range[1] : st.size - +range[2], end = range[1] && range[2] ? +range[2] : st.size - 1;
      if (start < 0) start = 0; if (end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, {'Content-Range': 'bytes */' + st.size}); res.end(); return; }
      res.writeHead(206, Object.assign(head, {'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1}));
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(file, {start, end}).pipe(res);
      return;
    }
    res.writeHead(200, Object.assign(head, {'Content-Length': st.size}));
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------------------------------------------------------- 중계 상태
const peers = new Map();             // id → client
const links = new Map();             // cid → [clientA(연결을 건 쪽), clientB(받은 쪽)]
const clients = new Set();
let served = 0;

function roomsOf(prefix) {
  const out = [];
  if (!prefix || prefix.length < 3) return out;
  for (const [id, c] of peers) {
    if (!c.named || !id.startsWith(prefix) || !c.open) continue;
    const guests = new Set();
    for (const cid of c.cids) { const L = links.get(cid); if (L && L[1] === c && L[0].open) guests.add(L[0]); }
    out.push({code: id.slice(prefix.length), players: guests.size + 1, age: Math.round((Date.now() - c.since) / 1000), info: c.info || null});
  }
  out.sort((a, b) => a.age - b.age);
  return out.slice(0, 50);
}

const json = (res, o) => { res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(o)); };
const server = http.createServer((req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); res.end(); return; }
  if (u.pathname === '/__status') { let rooms = 0; for (const c of peers.values()) if (c.named) rooms++; return json(res, {ok: true, name: 'bio-arcade-classroom', v: 4, peers: peers.size, clients: clients.size, links: links.size, rooms, served, up: Math.round((Date.now() - started) / 1000)}); }
  if (u.pathname === '/__rooms') return json(res, {ok: true, rooms: roomsOf(u.searchParams.get('p') || '')});
  if (u.pathname === '/__info') return json(res, {ok: true, urls: lanUrls(), port: PORT, clients: clients.size});
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  sendFile(req, res, u.pathname);
});
server.keepAliveTimeout = 65000;

// ---------------------------------------------------------------- 웹소켓 (RFC 6455, 직접 구현)
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket' || clients.size >= MAX_CLIENTS) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = new Client(socket);
  clients.add(c);
});

class Client {
  constructor(sock) {
    this.sock = sock; this.open = true; this.alive = true; this.buf = Buffer.alloc(0); this.frag = null;
    this.id = null; this.key = ''; this.named = false; this.cids = new Set(); this.since = Date.now(); this.info = null;
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => { });
  }
  get backlog() { return this.sock.writableLength; }
  frame(op, payload) {
    const n = payload.length; let h;
    if (n < 126) { h = Buffer.alloc(2); h[1] = n; }
    else if (n < 65536) { h = Buffer.alloc(4); h[1] = 126; h.writeUInt16BE(n, 2); }
    else { h = Buffer.alloc(10); h[1] = 127; h.writeUInt32BE(Math.floor(n / 4294967296), 2); h.writeUInt32BE(n >>> 0, 6); }
    h[0] = 0x80 | op;
    return Buffer.concat([h, payload]);
  }
  send(s) { if (this.open && !this.sock.destroyed) this.sock.write(this.frame(1, Buffer.from(typeof s === 'string' ? s : JSON.stringify(s)))); }
  ping() { if (this.open && !this.sock.destroyed) this.sock.write(this.frame(9, Buffer.alloc(0))); }
  close(code) { if (!this.open) return; const p = Buffer.alloc(2); p.writeUInt16BE(code || 1000, 0); try { this.sock.write(this.frame(8, p)); } catch (e) { } this.open = false; this.sock.end(); setTimeout(() => this.sock.destroy(), 1000); }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = this.buf.readUInt32BE(2) * 4294967296 + this.buf.readUInt32BE(6); off = 10; }
      if (len > MAX_MSG) { this.close(1009); return; }
      if (!masked) { this.close(1002); return; }       // 브라우저가 보내는 프레임은 반드시 마스크가 있음
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4), data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.alive = true;
      if (op === 8) { this.close(1000); return; }
      if (op === 9) { if (!this.sock.destroyed) this.sock.write(this.frame(10, data)); continue; }
      if (op === 10) continue;
      if (op === 0) { if (!this.frag) continue; this.frag.parts.push(data); if (fin) { const all = Buffer.concat(this.frag.parts), t = this.frag.op; this.frag = null; if (t === 1) onMessage(this, all.toString()); } continue; }
      if (!fin) { this.frag = {op, parts: [data]}; continue; }
      if (op === 1) onMessage(this, data.toString());
    }
  }
  onClose() {
    if (this.dead) return; this.dead = true; this.open = false; clients.delete(this);
    for (const cid of [...this.cids]) drop(cid, this);
    if (this.id && peers.get(this.id) === this) peers.delete(this.id);
  }
}

// ---------------------------------------------------------------- 중계
function relay(c, cid, body, whole) {
  const L = links.get(cid);
  if (!L || (L[0] !== c && L[1] !== c)) return;
  const other = L[0] === c ? L[1] : L[0];
  if (other && other.open && other.backlog < BUF_LIMIT) { other.send(whole || ('D' + cid + body)); served++; }
}
function onMessage(c, s) {
  if (!s) return;
  const c0 = s.charCodeAt(0);
  if (c0 === 68 /* D */) { relay(c, s.slice(1, 9), null, s); return; }
  if (c0 === 77 /* M */) {
    const bar = s.indexOf('|'); if (bar < 9) return;
    const ids = s.slice(1, bar), body = s.slice(bar + 1);
    for (let i = 0; i + 8 <= ids.length; i += 8) relay(c, ids.slice(i, i + 8), body);
    return;
  }
  let m; try { m = JSON.parse(s); } catch (e) { return; }
  switch (m.t) {
    case 'open': {
      if (c.id) return;
      let id = m.id; const key = typeof m.key === 'string' ? m.key.slice(0, 40) : '';
      if (id != null) {
        if (!ID_RE.test(id)) return c.send({t: 'error', type: 'invalid-id', message: 'Invalid id'});
        const old = peers.get(id);
        if (old && old !== c) {
          // 같은 기기가 다시 붙은 경우(열쇠가 같음) 또는 예전 연결이 이미 죽은 경우 → 아이디를 넘겨줌
          if ((key && old.key === key) || !old.open || !old.alive) { peers.delete(id); old.id = null; old.close(4000); old.onClose(); }
          else return c.send({t: 'error', type: 'unavailable-id', message: 'ID "' + id + '" is taken'});
        }
        c.named = true;
      } else { do { id = crypto.randomBytes(8).toString('hex'); } while (peers.has(id)); }
      c.id = id; c.key = key; c.since = Date.now(); peers.set(id, c);
      c.send({t: 'open', id, v: 4});
      break;
    }
    case 'connect': {
      if (!c.id || typeof m.cid !== 'string' || m.cid.length !== 8 || links.has(m.cid)) return;
      const target = peers.get(m.to);
      if (!target || target === c || !target.open) return c.send({t: 'error', type: 'peer-unavailable', cid: m.cid, message: 'Could not connect to peer ' + m.to});
      links.set(m.cid, [c, target]); c.cids.add(m.cid); target.cids.add(m.cid);
      target.send({t: 'conn', from: c.id, cid: m.cid, meta: m.meta === undefined ? null : m.meta});
      c.send({t: 'connopen', cid: m.cid});
      break;
    }
    case 'close': drop(m.cid, c); break;
    case 'info': if (c.named && m.info && typeof m.info === 'object') { if (JSON.stringify(m.info).length < 600) c.info = m.info; } break;
    case 'ping': c.send({t: 'pong', ts: m.ts}); break;
  }
}
function drop(cid, from) {
  const L = links.get(cid); if (!L) return;
  if (from && L[0] !== from && L[1] !== from) return;
  links.delete(cid);
  for (const s of L) { s.cids.delete(cid); if (s !== from) s.send({t: 'close', cid}); }
}

// 끊긴 연결 정리: 15초마다 확인, 응답이 없으면 끊음
setInterval(() => {
  for (const c of clients) { if (!c.alive) { c.sock.destroy(); c.onClose(); continue; } c.alive = false; c.ping(); }
}, 15000);

// ---------------------------------------------------------------- 시작
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`\n  ⚠ ${PORT}번 포트를 이미 다른 프로그램이 쓰고 있어요. 서버 창이 이미 열려 있는지 확인하거나,\n    다른 포트로 실행하세요 (예: PORT=8081).\n`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  const urls = lanUrls();
  const line = '─'.repeat(58);
  console.log('\n' + line);
  console.log('  🧬 BIO ARCADE 교실 서버가 켜졌어요!');
  console.log(line);
  console.log('  이 컴퓨터에서:   http://localhost' + (PORT === 80 ? '' : ':' + PORT));
  if (urls.length) {
    console.log('  학생 접속 주소 (같은 와이파이에서 주소창에 입력):');
    for (const u of urls) console.log('     ▶ ' + u);
  } else console.log('  ⚠ 네트워크 주소를 찾지 못했어요. 와이파이(또는 유선) 연결을 확인하세요.');
  console.log(line);
  console.log('  · 이 창을 닫으면 서버가 꺼져요. 수업이 끝날 때까지 열어 두세요.');
  console.log('  · 윈도우에서 "방화벽 허용" 창이 뜨면 [개인 네트워크]에 체크하고 [허용]을 눌러 주세요.');
  console.log(line + '\n');
});
setInterval(() => {
  let rooms = 0; for (const c of peers.values()) if (c.named) rooms++;
  process.stdout.write(`\r  접속 ${clients.size}명 · 열린 방 ${rooms}개 · 전달한 메시지 ${served.toLocaleString()}개     `);
}, 5000).unref();

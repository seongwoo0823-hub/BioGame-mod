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
const { execFile, execFileSync } = require('child_process');
const { Worker } = require('worker_threads');

const PORT = +process.env.PORT || 8080;
const ROOT = path.resolve(__dirname, '..');           // 저장소 폴더 (index.html이 있는 곳)
const MAX_MSG = 1024 * 1024;                          // 메시지 하나 최대 크기
const MAX_CLIENTS = 3000;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BUF_LIMIT = 4 * 1024 * 1024;                    // 받는 쪽이 이만큼 밀려 있으면 그 메시지는 건너뜀
const started = Date.now();

// ---------------------------------------------------------------- 학생 접속 주소
// 와이파이 장치 이름을 운영체제에 직접 물어봄 (이름만 보고 짐작하면 맥 en1·USB 와이파이 등을 랜선으로 착각함)
const WIFI_IF = new Set();
(function findWifi() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netsh', ['wlan', 'show', 'interfaces'], { timeout: 5000, windowsHide: true, encoding: 'utf8' });
      String(out || '').split(/\r?\n/).forEach(l => { const m = /^\s*(?:Name|이름)\s*:\s*(.+?)\s*$/.exec(l); if (m) WIFI_IF.add(m[1]); });
    } else if (process.platform === 'darwin') {
      const out = execFileSync('networksetup', ['-listallhardwareports'], { timeout: 5000, encoding: 'utf8' });
      String(out || '').split(/\n\s*\n/).forEach(b => { if (/Hardware Port:\s*(Wi-?Fi|AirPort)/i.test(b)) { const m = /Device:\s*(\S+)/.exec(b); if (m) WIFI_IF.add(m[1]); } });
    } else {
      for (const n of Object.keys(os.networkInterfaces())) if (fs.existsSync('/sys/class/net/' + n + '/wireless')) WIFI_IF.add(n);
    }
  } catch (e) {}
})();
function lanList() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || a.address.startsWith('169.254.')) continue;
      if (/vmware|virtualbox|vEthernet|docker|hyper-v|loopback|tailscale|zerotier/i.test(name)) continue;
      const kind = WIFI_IF.has(name) || /wi-?fi|wlan|wireless|무선|airport|802\.11/i.test(name) || (!WIFI_IF.size && /^en0$/.test(name)) ? '와이파이' : /ethernet|이더넷|^eth|^en\d|lan/i.test(name) ? '유선(랜선)' : name;
      out.push({name, kind, ip: a.address, url: 'http://' + a.address + (PORT === 80 ? '' : ':' + PORT)});
    }
  }
  return out;
}
// 요청이 이 컴퓨터의 어느 네트워크로 들어왔는지 → 'wifi'(빨강 아이콘) 또는 'lan'(초록 아이콘)
//   학생이 와이파이 주소로 접속하면 와이파이용, 랜선 주소로 접속하면 랜선용 앱 아이콘·이름으로 설치됨
function netPick(req) { const m = /(?:^|;\s*)bionet=(wifi|lan)\b/.exec(String(req.headers.cookie || '')); return m ? m[1] : ''; }
function netAuto(req) {
  const list = lanList();
  const host = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const loc = String((req.socket && req.socket.localAddress) || '').replace(/^::ffff:/, '');
  const n = list.find(x => x.ip === host) || list.find(x => x.ip === loc);
  return n && n.kind === '와이파이' ? 'wifi' : 'lan';
}
function netVariant(req) { return netPick(req) || netAuto(req); }
const installLog = new Map();
const VARIANT = {
  lan:  {id: './?pwa=lan',  name: 'BIO ARCADE 교실 서버 (랜선)',    short: 'BIO 랜선',    color: '#06140c'},
  wifi: {id: './?pwa=wifi', name: 'BIO ARCADE 교실 서버 (와이파이)', short: 'BIO 와이파이', color: '#170607'},
};
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

// ---------------------------------------------------------------- 접속 문제 진단 (윈도우)
//   랜선으로 연결된 노트북은 네트워크가 '공용'으로 잡히는 경우가 많은데, 방화벽 창에서 '개인 네트워크'만 허용하면
//   휴대폰·태블릿의 접속이 조용히 막혀 빈 화면에서 멈춤 → 직접 확인해서 알려 줌
const RULE = 'BIO ARCADE Classroom Server';
const diag = { warnings: [], publicNets: [], ruleOk: null, checked: false };
function runDiag(cb) {
  if (process.platform !== 'win32') { diag.checked = true; cb && cb(); return; }
  let left = 2; const done = () => { if (--left) return; diag.checked = true;
    diag.warnings = [];
    if (diag.publicNets.length && !diag.ruleOk)
      diag.warnings.push('이 컴퓨터의 네트워크(' + diag.publicNets.join(', ') + ')가 \'공용\'으로 설정되어 있어 휴대폰·태블릿이 접속하지 못할 수 있어요. ' +
        '폴더의 \'방화벽 허용.vbs\'를 한 번 실행해 주세요 (관리자 확인 창에서 \'예\').');
    cb && cb(); };
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-NetConnectionProfile | ForEach-Object { $_.InterfaceAlias + \'|\' + $_.NetworkCategory }'],
    { timeout: 6000, windowsHide: true }, (e, out) => {
      if (!e) diag.publicNets = String(out).split(/\r?\n/).map(l => l.trim().split('|')).filter(x => x[1] === 'Public').map(x => x[0]);
      done();
    });
  execFile('netsh', ['advfirewall', 'firewall', 'show', 'rule', 'name=' + RULE], { timeout: 6000, windowsHide: true }, (e) => { diag.ruleOk = !e; done(); });
}

// 새 기기가 처음 접속하면 창에 한 줄 남김 → 휴대폰에서 열었는데 이 줄이 안 나오면 '네트워크/방화벽에서 막힘'
const seen = new Map();
function noteDevice(req) {
  let ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (!ip || ip === '127.0.0.1' || ip === '::1' || seen.has(ip)) return;
  const ua = String(req.headers['user-agent'] || '');
  const dev = /iPhone/.test(ua) ? '아이폰' : /iPad|Macintosh.*Mobile/.test(ua) ? '아이패드' : /Android/.test(ua) ? (/Mobile/.test(ua) ? '안드로이드 폰' : '안드로이드 태블릿') : /Windows/.test(ua) ? '윈도우 PC' : /Mac OS X/.test(ua) ? '맥' : /CrOS/.test(ua) ? '크롬북' : '기기';
  seen.set(ip, { dev, t: Date.now() });
  if (seen.size > 2000) seen.delete(seen.keys().next().value);
  console.log(`\n  📱 새 기기 접속: ${dev} (${ip})`);
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
    const head = {'Content-Type': type, 'Cache-Control': /\.(html|js|json|webmanifest)$/i.test(file) || /[\\/]icons[\\/]/.test(file) ? 'no-cache' : 'public, max-age=3600', 'Accept-Ranges': 'bytes'};
    // 설치 아이콘 3종: GitHub Pages = 파랑(기본 파일 그대로) · 교실 서버 랜선 주소 = 초록 · 와이파이 주소 = 빨강
    const relp = path.relative(ROOT, file).split(path.sep).join('/');
    const vk = netVariant(req), V = VARIANT[vk];
    if (relp === 'manifest.webmanifest') {
      fs.readFile(file, 'utf8', (e, txt) => {
        if (e) { res.writeHead(500); res.end(); return; }
        let m; try { m = JSON.parse(txt); } catch (x) { res.writeHead(500); res.end(); return; }
        const who = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
        const lk = who + vk; if (Date.now() - (installLog.get(lk) || 0) > 60000) { installLog.set(lk, Date.now()); console.log('  📲 앱 설치 정보: ' + who + ' → ' + (vk === 'wifi' ? '🔴 와이파이용(빨간 아이콘)' : '🟢 랜선용(초록 아이콘)') + (netPick(req) ? '  [직접 고름]' : '  [주소로 자동 판단: ' + String(req.headers.host || '') + ']')); }
        m.id = V.id; m.name = V.name; m.short_name = V.short;
        m.start_url = './index.html?pwa=' + vk; m.theme_color = m.background_color = V.color;
        const sw = ic => Object.assign({}, ic, {src: String(ic.src).replace('icon-v2-', 'icon-' + vk + '-')});
        m.icons = (m.icons || []).map(sw);
        (m.shortcuts || []).forEach(sc => { if (sc.icons) sc.icons = sc.icons.map(sw); });
        const body = Buffer.from(JSON.stringify(m, null, 2));
        res.writeHead(200, Object.assign(head, {'Content-Length': body.length, 'Cache-Control': 'no-cache'})); res.end(req.method === 'HEAD' ? undefined : body);
      });
      return;
    }
    // 페이지가 쓰는 파란 아이콘 파일(로고·즐겨찾기·홈 화면 아이콘)을 접속한 네트워크 색으로 바꿔 보냄
    const am = /^icons\/(icon-v2-(192|512|maskable-512)|apple-touch-icon-v2|favicon-v2-32)\.png$/.exec(relp);
    if (am) {
      const alt = 'icons/' + am[1].replace('-v2', '-' + vk) + '.png';
      if (fs.existsSync(path.join(ROOT, alt))) { sendFile(req, res, '/' + alt); return; }
    }
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
    out.push({code: id.slice(prefix.length), players: guests.size + (c.virtual ? 0 : 1), age: Math.round((Date.now() - c.since) / 1000), info: c.info || null});
  }
  out.sort((a, b) => a.age - b.age);
  return out.slice(0, 50);
}

const json = (res, o) => { res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(o)); };
const server = http.createServer((req, res) => {
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); res.end(); return; }
  if (u.pathname === '/__status') { let rooms = 0; for (const c of peers.values()) if (c.named) rooms++; return json(res, {ok: true, name: 'bio-arcade-classroom', v: 5, peers: peers.size, clients: clients.size, links: links.size, rooms, srvRooms: srvRooms.size, kartRooms: kartRooms.size, srvGames: Object.keys(SRV_GAMES), served, up: Math.round((Date.now() - started) / 1000)}); }
  if (u.pathname === '/__rooms') return json(res, {ok: true, rooms: roomsOf(u.searchParams.get('p') || '')});
  noteDevice(req);
  if (u.pathname === '/__kart/new') return roomNew('bio-kart', req, res, u.searchParams);
  if (u.pathname === '/__kart/list') return json(res, {ok: true, max: MAX_SRV_ROOMS, rooms: roomList().filter(r => r.game === 'bio-kart')});
  if (u.pathname === '/__room/new') return roomNew(String(u.searchParams.get('game') || ''), req, res, u.searchParams);
  if (u.pathname === '/__room/list') return json(res, {ok: true, max: MAX_SRV_ROOMS, games: Object.keys(SRV_GAMES), rooms: roomList()});
  if (u.pathname === '/__net') {
    const v = u.searchParams.get('set');
    const ck = v === 'wifi' || v === 'lan' ? 'bionet=' + v + '; Path=/; Max-Age=31536000; SameSite=Lax' : 'bionet=; Path=/; Max-Age=0; SameSite=Lax';
    const now = v === 'wifi' || v === 'lan' ? v : netAuto(req);
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': ck});
    return res.end(JSON.stringify({ok: true, net: now, picked: v === 'wifi' || v === 'lan' ? v : '', auto: netAuto(req)}));
  }
  if (u.pathname === '/__info') return json(res, {ok: true, net: netVariant(req), picked: netPick(req), auto: netAuto(req), urls: lanUrls(), nets: lanList(), port: PORT, clients: clients.size, devices: seen.size, warnings: diag.warnings, diagReady: diag.checked});
  // 휴대폰 연결 확인용 아주 가벼운 페이지 (이게 열리면 네트워크는 정상)
  if (u.pathname === '/__hello' || u.pathname === '/hello') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>연결 확인</title>' +
      '<body style="font-family:sans-serif;text-align:center;padding:40px 16px;background:#0b1020;color:#e8f0ff"><div style="font-size:64px">✅</div>' +
      '<h2>교실 서버에 연결됐어요!</h2><p>네트워크는 정상이에요.</p><p><a style="color:#7cf" href="/">게임 사이트 열기 →</a></p>');
    return;
  }
  // 바탕화면 컨트롤러 등 예전 도구와 호환되는 주소
  if (u.pathname === '/health' || u.pathname === '/api/status' || u.pathname === '/ping') return json(res, {status: 'ok', ok: true, name: 'bio-arcade-classroom', port: PORT, uptimeSec: Math.round((Date.now() - started) / 1000), peers: peers.size, clients: clients.size, links: links.size, served, lanIps: lanUrls().map(x => x.replace(/^http:\/\/|:\d+$/g, ''))});
  if (u.pathname === '/api/stop') {
    const ra = req.socket.remoteAddress || '';
    if (ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1') { json(res, {ok: true, msg: 'Server stopping'}); setTimeout(() => process.exit(0), 150); return; }
    res.writeHead(403); res.end('Forbidden'); return;
  }
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

// ---------------------------------------------------------------- 서버 방장 (온라인 게임 7종: 서버가 판을 계산)
//   학생이 '방 만들기'를 누르면 /__room/new?game=… 로 요청 → 이 컴퓨터가 방마다 일꾼을 띄워 방장 역할을 맡음.
//   일꾼은 게임 코드를 그대로 돌리고(바이오 카트: kart-room.js, 나머지: game-room.js), 중계에는 보통 접속자와 같은 모양(VirtualClient)으로 붙음.
const SRV_GAMES = {
  'bio-kart':      {file: 'games/bio-kart.html',      prefix: 'biokart-p2p-v1-', worker: 'kart-room.js'},
  'bio-beat':      {file: 'games/bio-beat.html',      prefix: 'biobeat-v1-'},
  'vessel-canyon': {file: 'games/vessel-canyon.html', prefix: 'biocanyon-room-'},
  'cell-brawl':    {file: 'games/cell-brawl.html',    prefix: 'cellbrawl-v2-'},
  'bio-strike':    {file: 'games/bio-strike.html',    prefix: 'biostrike-v1-'},
  'bio-tower':     {file: 'games/bio-tower.html',     prefix: 'biotower-v1-'},
  'codon-glass':   {file: 'games/codon-glass.html',   prefix: 'codonglass-v1-'},
};
const MAX_SRV_ROOMS = +process.env.SRV_ROOMS || +process.env.KART_ROOMS || 16;   // 측정 결과(i7-1255U: 카트 방 여유 22개)보다 낮게 잡음
const srvRooms = new Map();   // 'game:code' → {game, code, worker, vc, players, playing, since}
const kartRooms = {get size() { let n = 0; for (const r of srvRooms.values()) if (r.game === 'bio-kart') n++; return n; }};
class VirtualClient {
  constructor(worker) {
    this.worker = worker; this.open = true; this.alive = true; this.virtual = true;
    this.id = null; this.key = ''; this.named = false; this.cids = new Set(); this.since = Date.now(); this.info = null;
  }
  get backlog() { return 0; }
  send(s) { if (this.open) this.worker.postMessage({t: 'ws', s: typeof s === 'string' ? s : JSON.stringify(s)}); }
  ping() { }
  close() { this.onClose(); }
  onClose() {
    if (this.dead) return; this.dead = true; this.open = false;
    for (const cid of [...this.cids]) drop(cid, this);
    if (this.id && peers.get(this.id) === this) peers.delete(this.id);
  }
}
function srvCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let n = 0; n < 200; n++) {
    let c = ''; for (let i = 0; i < 4; i++) c += chars[Math.random() * chars.length | 0];
    if (!peers.has(prefix + c)) return c;
  }
  return null;
}
function roomNew(game, req, res, q) {
  const G = SRV_GAMES[game];
  if (!G) return json(res, {ok: false, reason: 'game'});
  if (srvRooms.size >= MAX_SRV_ROOMS) return json(res, {ok: false, reason: 'full'});
  let code = String(q.get('code') || '').toUpperCase();
  if (code) { if (!/^[A-Z0-9]{2,8}$/.test(code)) return json(res, {ok: false, reason: 'bad'}); if (peers.has(G.prefix + code) || srvRooms.has(game + ':' + code)) return json(res, {ok: false, reason: 'taken'}); }
  else code = srvCode(G.prefix);
  if (!code) return json(res, {ok: false, reason: 'full'});
  const opts = {};
  for (const [k, v] of q) if (k !== 'game' && k !== 'code' && Object.keys(opts).length < 20) opts[k] = String(v).replace(/[<>]/g, '').slice(0, 40);
  opts.name = String(opts.name || '교실').slice(0, 20);
  if (game === 'bio-kart') Object.assign(opts, {map: +opts.map || 0, mode: opts.mode === 'item' ? 'item' : 'speed', diff: Math.max(0, Math.min(2, +(opts.diff ?? 1))), ai: opts.ai !== '0', priv: opts.priv === '1'});
  let worker;
  try { worker = new Worker(path.join(__dirname, G.worker || 'game-room.js'), {workerData: {code, opts, file: G.file, game}, resourceLimits: {maxOldGenerationSizeMb: 384}}); }
  catch (e) { return json(res, {ok: false, reason: 'error'}); }
  const vc = new VirtualClient(worker), key = game + ':' + code;
  const room = {game, code, worker, vc, players: 0, playing: false, since: Date.now(), name: opts.name};
  srvRooms.set(key, room);
  let answered = false;
  const answer = o => { if (answered) return; answered = true; clearTimeout(tm); json(res, o); };
  const tm = setTimeout(() => answer({ok: false, reason: 'timeout'}), 20000);
  worker.on('message', m => {
    if (!m) return;
    // 바이오 카트는 아이디를 받는 즉시, 나머지는 게임이 '준비 끝'(ready)을 알리면 방 코드를 돌려줌
    const opened = () => { if (answered) return; answer({ok: true, code}); console.log(`\n  🏁 서버 방 열림: ${game} [${code}] (${opts.name})`); };
    if (m.t === 'ws') { onMessage(vc, m.s); if (!answered && vc.id === G.prefix + code && G.worker) opened(); }
    else if (m.t === 'ready') { if (vc.id === G.prefix + code) opened(); else setTimeout(() => { if (vc.id === G.prefix + code) opened(); }, 500); }
    else if (m.t === 'wsclose') vc.onClose();
    else if (m.t === 'stat') { room.players = m.players; room.playing = m.playing; room.mem = m.mem; room.stat = m; }
    else if (m.t === 'log') { if (process.env.KART_DEBUG || process.env.GAME_DEBUG) console.log(`\n  [${game} ${code}] ${m.msg}`); }
    else if (m.t === 'error') console.log(`\n  ⚠ 서버 방 ${game} [${code}] 오류로 닫힘: ${String(m.msg).split('\n')[0]}`);
  });
  const end = () => { vc.onClose(); if (srvRooms.get(key) === room) srvRooms.delete(key); answer({ok: false, reason: 'error'}); };
  worker.on('error', e => { console.log(`\n  ⚠ 서버 방 ${game} [${code}] 오류: ${e && e.message}`); end(); });
  worker.on('exit', end);
}
function roomList() {
  return [...srvRooms.values()].map(r => ({game: r.game, code: r.code, name: r.name, players: r.players, playing: r.playing, mem: r.mem, age: Math.round((Date.now() - r.since) / 1000),
    screen: r.stat && r.stat.scr, map: r.stat && r.stat.map, mode: r.stat && r.stat.mode, ready: r.stat && r.stat.names, info: r.stat && r.stat.info}));
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
  const nets = lanList();
  if (urls.length) {
    console.log('  학생 접속 주소 (같은 네트워크에서 주소창에 입력):');
    for (const u of urls) { const n = nets.find(x => x.url === u); console.log('     ▶ ' + u + (n ? '   (' + n.kind + ')' : '')); }
    console.log('  휴대폰 연결 확인: 위 주소 뒤에 /hello 를 붙여 열어 보세요 (예: ' + urls[0] + '/hello)');
  } else console.log('  ⚠ 네트워크 주소를 찾지 못했어요. 와이파이(또는 유선) 연결을 확인하세요.');
  console.log(line);
  console.log('  · 이 창을 닫으면 서버가 꺼져요. 수업이 끝날 때까지 열어 두세요.');
  console.log('  · 윈도우에서 "방화벽 허용" 창이 뜨면 [개인]과 [공용] 네트워크를 모두 체크하고 [허용]을 눌러 주세요.');
  console.log(line + '\n');
  runDiag(() => { for (const w of diag.warnings) console.log('  ⚠ ' + w + '\n'); });
});
setInterval(() => {
  let rooms = 0; for (const c of peers.values()) if (c.named) rooms++;
  process.stdout.write(`\r  접속 ${clients.size}명 · 열린 방 ${rooms}개 (서버 방장 ${srvRooms.size}개) · 전달한 메시지 ${served.toLocaleString()}개     `);
}, 5000).unref();

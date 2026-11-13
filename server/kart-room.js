// 바이오 카트 '서버 방장' 일꾼 (server.js가 방마다 하나씩 띄움)
//   게임 화면 없이 games/bio-kart.html 의 게임 코드와 net.js 중계 코드를 그대로 불러와,
//   교실 서버 안에서 방장 역할(판 계산·판정·상태 전송)을 맡는다. 학생 기기는 모두 참가자.
//   한 방에서 오류가 나도 이 일꾼만 멈추고 다른 방과 서버는 그대로 돌아간다.
'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs'), vm = require('vm'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { code, opts } = workerData;
const post = m => { try { parentPort.postMessage(m); } catch (e) { } };
process.on('uncaughtException', e => { post({ t: 'error', msg: String(e && e.stack || e).slice(0, 500) }); process.exit(1); });

// ---- 게임 화면(DOM·3D·소리) 자리에 넣는 '무엇이든 받아 주는' 가짜 객체
const any = new Proxy(function () { }, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : k === Symbol.iterator ? function* () { } : k === 'then' ? undefined : any),
  apply: () => any, construct: () => any, set: () => true, has: () => true,
});

// document: 나머지는 가짜지만 '화면이 보이는 중'으로 알려 줌 (숨김 탭용 보조 루프가 판을 두 번 계산하지 않게)
const doc = new Proxy({}, { get: (t, k) => (k === 'hidden' ? false : k === 'visibilityState' ? 'visible' : any), set: () => true, has: () => true });

// ---- 중계 서버와의 연결: 진짜 웹소켓 대신 server.js(부모 스레드)와 메시지로 주고받음
let sock = null;
class FakeWS {
  constructor() {
    this.readyState = 0; this.bufferedAmount = 0; sock = this;
    setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 0);
  }
  send(s) { if (this.readyState === 1) post({ t: 'ws', s: String(s) }); }
  close() { if (this.readyState === 3) return; this.readyState = 3; post({ t: 'wsclose' }); setTimeout(() => this.onclose && this.onclose(), 0); }
}
parentPort.on('message', m => {
  if (!m) return;
  if (m.t === 'ws' && sock && sock.readyState === 1 && sock.onmessage) sock.onmessage({ data: m.s });
  else if (m.t === 'stop') process.exit(0);
});

const quiet = { log() { }, warn() { }, error() { }, info() { } };
const ctx = {
  console: quiet, Math, JSON, Date, Array, Object, Map, Set, WeakMap, Promise, Error, TypeError, RegExp, Symbol, Number, String, Boolean,
  Float32Array, Float64Array, Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, ArrayBuffer, URLSearchParams,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, requestAnimationFrame: () => 0, cancelAnimationFrame() { },
  performance: { now: () => performance.now() }, localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  navigator: { userAgent: 'BioArcadeServer', maxTouchPoints: 0 }, location: { protocol: 'http:', host: '127.0.0.1', hostname: '127.0.0.1', search: '?nobc=1', hash: '', href: 'http://127.0.0.1/games/bio-kart.html', pathname: '/games/bio-kart.html' },
  document: doc, THREE: any, AudioContext: any, webkitAudioContext: any, Image: any, ICONS: any, Event: any, MessageEvent: any, BroadcastChannel: undefined,
  addEventListener() { }, removeEventListener() { }, matchMedia: () => ({ matches: false, addEventListener() { } }),
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, fetch: () => new Promise(() => { }), WebSocket: FakeWS, BIO_LOCAL_RELAY: 1,
};
ctx.window = ctx.globalThis = ctx.self = ctx;
vm.createContext(ctx);

// net.js (중계 연결) → window.Peer 를 교실 서버 중계로
vm.runInContext(fs.readFileSync(path.join(ROOT, 'net.js'), 'utf8'), ctx, { filename: 'net.js' });
ctx.Peer = function (id, o) { return ctx.BioRelay.create(typeof id === 'string' ? id : null, typeof id === 'string' ? o : id); };

// 게임 본 코드 (가장 긴 <script>)
const html = fs.readFileSync(path.join(ROOT, 'games', 'bio-kart.html'), 'utf8');
const main = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).reduce((a, b) => (b.length > a.length ? b : a));
vm.runInContext(main + '\n;globalThis.__K={G,S,NET,stepRace,handleEvents,STEP,MAPS};', ctx, { filename: 'bio-kart.js' });
const K = ctx.__K;
// 화면·소리 관련 함수는 서버에서 할 일이 없으므로 비움 (판 계산에는 영향 없음)
for (const f of ['buildAssets', 'camReset', 'render', 'hud', 'audioTick', 'sfx', 'showMsg', 'showSub', 'showFeed', 'auInit', 'newDemo', 'renderMaps'])
  if (typeof ctx[f] === 'function') ctx[f] = function () { };
K.G.demo = true; K.G.R = null;

// ---- 방장 시작
const st = K.NET.serverHost(code, opts || {});

// ---- 1초에 60번 판 계산 + 상태 전송
let hevErr = false, doneT = 0;
let last = performance.now(), acc = 0, emptySince = performance.now(), joined = false, ready = false;
function frame() {
  const now = performance.now();
  let dt = (now - last) / 1000; last = now; if (dt > 0.25) dt = 0.25;
  const R = K.G.R;
  if (R && !K.G.demo) {
    acc += dt; let n = 0;
    while (acc >= K.STEP && n < 12) { K.stepRace(R, {}, K.STEP); acc -= K.STEP; n++; }
    if (n >= 12) acc = 0;
    try { K.handleEvents(R); } catch (e) { R.ev.length = 0; if (!hevErr) { hevErr = true; post({ t: 'log', msg: 'handleEvents: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); } }
    K.NET.tick(R, dt);
    // 경주가 끝나면 2초 뒤 대기실 상태로 (다음 경기 출발·새 참가자 받기)
    if (R.state === 'done') { doneT += dt; if (doneT > 2 && K.G.screen === 'race') K.G.screen = 'result'; } else doneT = 0;
  }
  const wait = Math.max(1, 1000 / 60 - (performance.now() - now));
  setTimeout(frame, wait);
}
frame();

// ---- 상태 보고 · 빈 방 정리
setInterval(() => {
  const players = Object.keys(st.players || {}).length;
  if (!ready && st.active) { ready = true; post({ t: 'ready' }); }
  if (players) { joined = true; emptySince = performance.now(); }
  const idle = performance.now() - emptySince;
  // 아무도 없으면 닫음: 한 번도 안 들어왔으면 2분, 다 나갔으면 1분
  if (idle > (joined ? 60000 : 120000)) { post({ t: 'empty' }); setTimeout(() => process.exit(0), 200); }
  post({ t: 'stat', players, playing: !!(K.G.R && !K.G.demo && K.G.screen === 'race'), mem: Math.round(process.memoryUsage().heapUsed / 1048576),
    scr: K.G.screen, map: K.S.map, mode: K.S.mode, names: Object.values(st.players || {}).map(p => [p.name, !!p.ready]), owner: st.ownerId || null });
}, 1000);

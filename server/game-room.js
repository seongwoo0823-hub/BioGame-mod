// 온라인 게임 '서버 방장' 공용 일꾼 (server.js가 방마다 하나씩 띄움)
//   게임 html을 화면 없이 그대로 불러와(가짜 화면·진짜 타이머·로컬 파일 읽기) 교실 서버 안에서 방장 역할을 맡긴다.
//   게임 쪽은 window.BIO_SRV 가 있으면 '서버 방장 모드'로 방을 열고(자기 캐릭터 없음), 처음 들어온 학생을 방 관리자로 둔다.
//   게임이 알려 주는 것: window.BIO_SRV_STAT = () => ({players, playing}) — 빈 방 정리와 상태 표시용
'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs'), vm = require('vm'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { file, code, opts } = workerData;
const post = m => { try { parentPort.postMessage(m); } catch (e) { } };
process.on('uncaughtException', e => { post({ t: 'error', msg: String(e && e.stack || e).slice(0, 600) }); process.exit(1); });
process.on('unhandledRejection', e => { post({ t: 'log', msg: 'promise: ' + String(e && e.stack || e).slice(0, 300) }); });

// ---------------------------------------------------------------- 가짜 화면 (DOM)
const any = new Proxy(function () { }, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : k === Symbol.iterator ? function* () { } : k === 'then' ? undefined : any),
  apply: () => any, construct: () => any, set: () => true, has: () => true,
});
// 2D 그리기 도구: 알려진 '값' 속성은 저장, 나머지는 모두 아무것도 안 하는 함수
const CTX_PROPS = new Set(['canvas', 'fillStyle', 'strokeStyle', 'font', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalAlpha', 'globalCompositeOperation',
  'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'textAlign', 'textBaseline', 'direction', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'filter', 'letterSpacing', 'wordSpacing', 'fontKerning']);
const noop = () => { };
const ctx2d = () => {
  const t = {
    measureText: s => ({ width: String(s || '').length * 7, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s || '').length * 7 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), createConicGradient: () => ({ addColorStop: noop }), createPattern: () => ({ setTransform: noop }),
    getImageData: (x, y, w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray(Math.max(0, Math.min(4e6, (w | 0) * (h | 0) * 4))) }),
    createImageData: (w, h) => ({ width: w | 0, height: h | 0, data: new Uint8ClampedArray(Math.max(0, Math.min(4e6, (w | 0) * (h | 0) * 4))) }),
    isPointInPath: () => false, isPointInStroke: () => false, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, invertSelf() { return this; } }), getLineDash: () => [],
    fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif', lineWidth: 1, globalAlpha: 1, textAlign: 'start', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over',
  };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && !CTX_PROPS.has(k) ? noop : undefined), set: (o, k, v) => { o[k] = v; return true; } });
};
class FakeClassList { constructor() { this.s = new Set(); } add(...a) { a.forEach(x => this.s.add(x)); } remove(...a) { a.forEach(x => this.s.delete(x)); } toggle(x, f) { const on = f === undefined ? !this.s.has(x) : !!f; on ? this.s.add(x) : this.s.delete(x); return on; } contains(x) { return this.s.has(x); } replace(a, b) { this.s.delete(a); this.s.add(b); } }
let elemSeq = 0;
function El(tag, id) {
  const ev = {};
  const base = {
    tagName: String(tag || 'div').toUpperCase(), nodeName: String(tag || 'div').toUpperCase(), id: id || '', _n: ++elemSeq,
    value: '', textContent: '', innerHTML: '', innerText: '', className: '', checked: false, disabled: false, hidden: false, selected: false, type: '',
    width: 300, height: 150, clientWidth: 1280, clientHeight: 720, offsetWidth: 1280, offsetHeight: 720, scrollTop: 0, scrollHeight: 0, offsetParent: null, isConnected: true,
    style: new Proxy({}, { get: (t, k) => (k === 'setProperty' || k === 'removeProperty' ? () => { } : t[k] ?? ''), set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {}, classList: new FakeClassList(), children: emptyList(), childNodes: emptyList(), options: [], nextSibling: null, previousSibling: null,
    get firstChild() { return P.children.length ? P.children[0] : (P._fc || (P._fc = El('span'))); }, get lastChild() { return P.children[P.children.length - 1] || P.firstChild; }, get firstElementChild() { return P.firstChild; },
    addEventListener(t, f) { (ev[t] = ev[t] || []).push(f); }, removeEventListener(t, f) { const a = ev[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
    dispatchEvent(e) { const t = e && e.type; if (!e.target) try { e.target = P; } catch (x) { } (ev[t] || []).slice().forEach(f => f.call(P, e)); const h = P['on' + t]; if (typeof h === 'function') h.call(P, e); return true; },
    click() { P.dispatchEvent({ type: 'click', target: P, preventDefault() { }, stopPropagation() { } }); },
    appendChild(c) { P.children.push(c); try { c.parentNode = P; } catch (e) { } return c; }, append(...c) { c.forEach(x => typeof x === 'object' && P.children.push(x)); }, prepend() { }, insertBefore(c) { return c; }, replaceChildren() { P.children.length = 0; },
    removeChild(c) { return c; }, remove() { }, cloneNode() { return El(tag); }, contains() { return false; }, closest() { return null; }, matches() { return false; },
    querySelector(s) { return doc.querySelector(s); }, querySelectorAll() { return emptyList(); }, getElementsByTagName() { return emptyList(); }, getElementsByClassName() { return emptyList(); },
    getContext(k) { if (k === '2d') { const c = ctx2d(); c.canvas = P; return c; } return null; }, toDataURL() { return 'data:,'; }, toBlob(f) { f && f(null); },
    getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }; },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; }, hasAttribute(k) { return k in attrs; },
    focus() { }, blur() { }, select() { }, scrollIntoView() { }, scrollTo() { }, animate() { return { finished: Promise.resolve(), cancel() { }, onfinish: null }; },
    play() { return Promise.resolve(); }, pause() { }, load() { }, requestFullscreen() { return Promise.resolve(); }, setPointerCapture() { }, releasePointerCapture() { }, showModal() { }, close() { },
  };
  const attrs = {};
  const P = new Proxy(base, { get: (t, k) => (k in t ? t[k] : (k === 'parentNode' || k === 'parentElement') ? (typeof doc !== 'undefined' && doc.body !== P ? doc.body : null) : typeof k === 'symbol' ? undefined : any), set: (t, k, v) => { t[k] = v; return true; } });
  return P;
}
// 페이지 '다 불러옴' 이벤트(DOMContentLoaded·load)는 모아 두었다가 스크립트를 다 불러온 뒤 실행
const loadEvs = [];
let loadedFired = false;
function onLoadEv(t, f) { if ((t === 'load' || t === 'DOMContentLoaded' || t === 'pageshow') && typeof f === 'function') { if (loadedFired) setTimeout(() => f({ type: t }), 0); else loadEvs.push([t, f]); } }
// querySelectorAll: 비어 있지만(반복문은 0번), 번호로 꺼내면 가짜 요소를 돌려줌 (lv[0].textContent= 같은 코드가 멈추지 않게)
const emptyList = () => new Proxy([], { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^\d+$/.test(k) ? El('div') : t[k]) });
const byId = new Map(), bySel = new Map();
const doc = new Proxy({
  hidden: false, visibilityState: 'visible', readyState: 'complete', title: '', cookie: '', fullscreenElement: null, pointerLockElement: null,
  body: El('body'), head: El('head'), documentElement: El('html'),
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, add() { } },
  getElementById(id) { if (!byId.has(id)) byId.set(id, El('div', id)); return byId.get(id); },
  querySelector(s) { s = String(s); if (/^#[\w-]+$/.test(s)) return doc.getElementById(s.slice(1)); if (!bySel.has(s)) bySel.set(s, El('div')); return bySel.get(s); },
  querySelectorAll() { return emptyList(); }, getElementsByTagName() { return emptyList(); }, getElementsByClassName() { return emptyList(); }, getElementsByName() { return emptyList(); },
  createElement: t => El(t), createElementNS: (n, t) => El(t), createTextNode: s => ({ textContent: s }), createDocumentFragment: () => El('fragment'),
  addEventListener: (t, f) => onLoadEv(t, f), removeEventListener() { }, dispatchEvent() { return true; }, exitFullscreen() { return Promise.resolve(); }, exitPointerLock() { }, execCommand() { return false; }, hasFocus: () => true,
}, { get: (t, k) => (k in t ? t[k] : typeof k === 'symbol' ? undefined : any), set: (t, k, v) => { t[k] = v; return true; } });

// 그림: 바로 '불러옴'으로 처리 (서버는 그림을 그리지 않음)
class FakeImage { constructor() { this.width = 1; this.height = 1; this.naturalWidth = 1; this.naturalHeight = 1; this.complete = true; this.onload = null; this.onerror = null; this._src = ''; this._ev = {}; }
  set src(v) { this._src = v; setTimeout(() => { this.onload && this.onload({ target: this }); (this._ev.load || []).forEach(f => f({ target: this })); }, 0); } get src() { return this._src; }
  addEventListener(t, f) { (this._ev[t] = this._ev[t] || []).push(f); } removeEventListener() { } decode() { return Promise.resolve(); } }

// 파일 읽기: 게임이 fetch('bio-tower/pieces.json') 처럼 부르는 로컬 파일은 디스크에서 바로 읽어 줌
const pageDir = path.dirname(path.join(ROOT, file));
function localFetch(u) {
  try {
    const s = String(u && u.url || u);
    if (/^https?:\/\//.test(s) || s.startsWith('/__') || s.startsWith('data:')) return new Promise(() => { });
    const p = path.normalize(s.startsWith('/') ? path.join(ROOT, s) : path.join(pageDir, s.split('?')[0]));
    if (!p.startsWith(ROOT)) return Promise.reject(new Error('blocked'));
    const buf = fs.readFileSync(p);
    const res = { ok: true, status: 200, url: s, headers: { get: () => null }, json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8'),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), blob: async () => ({ size: buf.length }), clone() { return res; } };
    return Promise.resolve(res);
  } catch (e) { return Promise.resolve({ ok: false, status: 404, json: async () => { throw e; }, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }); }
}

// ---------------------------------------------------------------- 중계 서버와의 연결 (부모 스레드와 메시지로)
let sock = null;
class FakeWS {
  constructor() { this.readyState = 0; this.bufferedAmount = 0; sock = this; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 0); }
  send(s) { if (this.readyState === 1) post({ t: 'ws', s: String(s) }); }
  close() { if (this.readyState === 3) return; this.readyState = 3; post({ t: 'wsclose' }); setTimeout(() => this.onclose && this.onclose(), 0); }
}
parentPort.on('message', m => {
  if (!m) return;
  if (m.t === 'ws' && sock && sock.readyState === 1 && sock.onmessage) sock.onmessage({ data: m.s });
  else if (m.t === 'stop') process.exit(0);
});

// ---------------------------------------------------------------- 화면 갱신 타이머 (1초 60번)
let rafQ = [], rafId = 0;
const raf = f => { rafQ.push([++rafId, f]); return rafId; };
const caf = id => { rafQ = rafQ.filter(x => x[0] !== id); };
let rafErr = false;
(function pump() {
  const q = rafQ; rafQ = []; const now = performance.now();
  for (const [, f] of q) { try { f(now); } catch (e) { if (!rafErr) { rafErr = true; post({ t: 'log', msg: 'frame: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); } } }
  setTimeout(pump, 16);
})();

const quiet = { log() { }, warn() { }, error() { }, info() { }, debug() { }, time() { }, timeEnd() { }, table() { }, group() { }, groupEnd() { } };
const store = new Map();
const ctx = {
  console: process.env.GAME_DEBUG ? console : quiet, Math, JSON, Date, Array, Object, Map, Set, WeakMap, WeakSet, Promise, Error, TypeError, RangeError, RegExp, Symbol, Number, String, Boolean, Reflect, Proxy, BigInt,
  Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, ArrayBuffer, DataView, URL, URLSearchParams, TextEncoder, TextDecoder,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, structuredClone, atob, btoa, encodeURIComponent, decodeURIComponent, isFinite, isNaN, parseFloat, parseInt,
  requestAnimationFrame: raf, cancelAnimationFrame: caf, requestIdleCallback: f => setTimeout(() => f({ timeRemaining: () => 10, didTimeout: false }), 1),
  performance: { now: () => performance.now(), mark() { }, measure() { } },
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear(), key: () => null, get length() { return store.size; } },
  sessionStorage: { getItem: () => null, setItem() { }, removeItem() { } },
  navigator: { userAgent: 'BioArcadeServer', maxTouchPoints: 0, language: 'ko-KR', languages: ['ko-KR'], onLine: true, hardwareConcurrency: 4, vibrate() { }, clipboard: { writeText: () => Promise.resolve() }, getGamepads: () => [], serviceWorker: undefined, wakeLock: undefined },
  location: { protocol: 'http:', host: '127.0.0.1', hostname: '127.0.0.1', port: '', origin: 'http://127.0.0.1', search: '?nobc=1', hash: '', href: 'http://127.0.0.1/' + file + '?nobc=1', pathname: '/' + file, reload() { }, replace() { }, assign() { } },
  history: { replaceState() { }, pushState() { } }, screen: { width: 1280, height: 720, orientation: { type: 'landscape-primary', lock: () => Promise.resolve() } },
  document: doc, Image: FakeImage, Audio: function () { return El('audio'); }, AudioContext: any, webkitAudioContext: any, OfflineAudioContext: any,
  Event: function (t, o) { return Object.assign({ type: t, preventDefault() { }, stopPropagation() { } }, o); }, CustomEvent: function (t, o) { return { type: t, detail: o && o.detail }; }, MessageEvent: function (t, o) { return Object.assign({ type: t }, o); },
  KeyboardEvent: function (t, o) { return Object.assign({ type: t }, o); }, PointerEvent: function (t, o) { return Object.assign({ type: t }, o); },
  BroadcastChannel: undefined, Worker: undefined, ResizeObserver: function () { return { observe() { }, disconnect() { }, unobserve() { } }; }, IntersectionObserver: function () { return { observe() { }, disconnect() { } }; }, MutationObserver: function () { return { observe() { }, disconnect() { } }; },
  matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { }, addListener() { } }), getComputedStyle: () => new Proxy({}, { get: () => '' }),
  addEventListener: (t, f) => onLoadEv(t, f), removeEventListener() { }, dispatchEvent() { return true; }, scrollTo() { }, open() { return null; }, alert() { }, confirm() { return false; }, prompt() { return null; }, focus() { }, getSelection: () => ({ removeAllRanges() { } }),
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, outerWidth: 1280, outerHeight: 720, isSecureContext: false,
  fetch: localFetch, WebSocket: FakeWS, BIO_LOCAL_RELAY: 1, AbortController, Blob: function () { return {}; }, FileReader: function () { return { readAsDataURL() { }, readAsText() { } }; },
  createImageBitmap: () => Promise.resolve({ width: 1, height: 1, close() { } }), OffscreenCanvas: function (w, h) { const e = El('canvas'); e.width = w; e.height = h; return e; },
  HTMLCanvasElement: function () { }, HTMLElement: function () { }, HTMLImageElement: function () { }, HTMLInputElement: function () { }, Element: function () { }, Node: function () { },
  CanvasRenderingContext2D: function () { }, OffscreenCanvasRenderingContext2D: function () { }, WebGLRenderingContext: function () { }, WebGL2RenderingContext: function () { },
  Path2D: function () { return { moveTo() { }, lineTo() { }, arc() { }, rect() { }, closePath() { }, bezierCurveTo() { }, quadraticCurveTo() { }, ellipse() { }, roundRect() { }, addPath() { } }; },
  DOMMatrix: function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, multiply() { return this; }, inverse() { return this; }, translate() { return this; }, scale() { return this; }, rotate() { return this; } }; },
  FontFace: function () { return { load: () => Promise.resolve(this) }; }, AudioBuffer: function () { }, GainNode: function () { }, MediaMetadata: function () { },
  // 게임이 '참가 받을 준비 끝'을 알릴 때 BIO_SRV.ready() 호출 → 그때 방 만든 학생에게 방 코드를 돌려줌
  BIO_SRV: { code, name: (opts && opts.name) || '교실', opts: opts || {}, ready: () => post({ t: 'ready' }) },
};
ctx.window = ctx.globalThis = ctx.self = ctx.top = ctx.parent = ctx;
vm.createContext(ctx);

// ---------------------------------------------------------------- 게임 불러오기 (문서 순서대로 스크립트 실행)
const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
const SKIP = /peerjs|goal\.js|rank\.js|ilog\.js|icons\.js|firebase|gtag|googletagmanager/;
// 스크립트 하나에서 오류가 나도(화면 전용 코드 등) 기록만 남기고 다음 스크립트를 계속 불러옴
const run = (src, name) => { try { vm.runInContext(src, ctx, { filename: name }); } catch (e) { post({ t: 'log', msg: 'load ' + name + ': ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); } };
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  const attr = m[1], body = m[2];
  const srcM = /\bsrc\s*=\s*["']([^"']+)["']/.exec(attr);
  if (/type\s*=\s*["'](?!text\/javascript|module)[^"']+["']/.test(attr)) continue;   // JSON 데이터 등
  if (srcM) {
    const s = srcM[1];
    if (/^https?:/.test(s) || SKIP.test(s)) continue;
    const p = path.normalize(path.join(pageDir, s));
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) continue;
    run(fs.readFileSync(p, 'utf8'), path.basename(p));
    if (/net\.js$/.test(p)) ctx.Peer = function (id, o) { return ctx.BioRelay.create(typeof id === 'string' ? id : null, typeof id === 'string' ? o : id); };
    if (/three\.min\.js$/.test(p) && ctx.THREE) {   // 3D 계산(벡터·충돌)은 진짜 three.js 그대로, 그리기만 비움
      ctx.THREE.WebGLRenderer = function () { return new Proxy({ domElement: El('canvas'), shadowMap: {}, info: { render: {}, memory: {} }, capabilities: { getMaxAnisotropy: () => 1 }, xr: {}, getSize: v => v, getPixelRatio: () => 1 }, { get: (t, k) => (k in t ? t[k] : () => { }), set: (t, k, v) => { t[k] = v; return true; } }); };
    }
  } else if (body.trim()) {
    if (/type\s*=\s*["']module["']/.test(attr)) continue;
    if (/serviceWorker|휴대폰에서 두 손가락/.test(body) && body.length < 3000) continue;
    run(body, 'inline-' + m.index);
  }
}
loadedFired = true;
for (const t of ['DOMContentLoaded', 'load', 'pageshow']) for (const [tt, f] of loadEvs) if (tt === t) { try { f({ type: t, persisted: false }); } catch (e) { post({ t: 'log', msg: 'onload: ' + String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); } }
post({ t: 'loaded' });

// ---------------------------------------------------------------- 상태 보고 · 빈 방 정리
let emptySince = performance.now(), joined = false;
setInterval(() => {
  let s = { players: 0, playing: false };
  try { if (typeof ctx.BIO_SRV_STAT === 'function') s = ctx.BIO_SRV_STAT() || s; } catch (e) { }
  const players = s.players | 0;
  if (players) { joined = true; emptySince = performance.now(); }
  if (performance.now() - emptySince > (joined ? 60000 : 120000)) { post({ t: 'empty' }); setTimeout(() => process.exit(0), 200); }
  post({ t: 'stat', players, playing: !!s.playing, mem: Math.round(process.memoryUsage().heapUsed / 1048576), info: s.info || null });
}, 1000);

// 바이오 알 도둑: 게임 진행(훔치기·경비·부화·수입·융합·속도·점프·트레일·판매·환생·잠금·봇 습격·이벤트·저장)과 화면
import * as THREE from 'three';
import { RAR, EGGS, PETS, MUTS, TRAILS, SHOP, EVENTS, BOT_NAMES, BOT_COLS, ME_COL, START, lv2cost, rebirthCost, fmt } from './data.js';
import { petMesh, eggMesh, personMesh, guardMesh, Kit, meshOf } from './models.js';
import { buildWorld, buildBase, baseFrame, toWorld, toLocal, slotPos, incuPos, PAD, LOCKPAD, TRAY, BASE_W, BASE_D, ISLAND, PLAZA, ZONES, zoneAt, GRAV, jumpV, jumpH } from './world.js';

const $ = (s) => document.querySelector(s);
const rnd = Math.random, clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t;
const SLOT_ON = new THREE.MeshToonMaterial({ color: '#d4ecc6' }), SLOT_OFF = new THREE.MeshToonMaterial({ color: '#efe9de', transparent: true, opacity: 0.55 });
const PETBY = Object.fromEntries(PETS.map((p) => [p.id, p])), EGGBY = Object.fromEntries(EGGS.map((e) => [e.id, e])), MUTBY = Object.fromEntries(MUTS.map((m) => [m.id, m]));
const TRAILBY = Object.fromEntries(TRAILS.map((t) => [t.id, t]));
const SAVE_KEY = 'bioEggThief1', PREF_KEY = 'bioEggPrefs';
const prefs = { q: 'auto', snd: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch {}
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} };
const touchUI = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', touchUI);

// ---------------------------------------------------------------- 저장 상태
const fresh = () => ({ v: 1, ...START, spd: 0, reb: 0, trails: ['none'], trail: 'none', pets: [], eggs: [], incu: [], codex: {}, pad: 0, stolen: 0, hatched: 0, earned: 0, raids: 0, tut: 0, nid: 1, t: Date.now(), locked: 0 });
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? Object.assign(fresh(), s) : null; } catch { return null; } }
let S = loadSave() || fresh();
const hadSave = !!loadSave();
function save() {
  S.t = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {}
  try { const b = JSON.parse(localStorage.getItem('bioEggBest') || '{}'); b.inc = Math.max(b.inc || 0, Math.floor(income(true))); b.pets = Math.max(b.pets || 0, S.pets.length); b.reb = Math.max(b.reb || 0, S.reb); b.codex = Math.max(b.codex || 0, Object.keys(S.codex).length); localStorage.setItem('bioEggBest', JSON.stringify(b)); } catch {}
}
const penCap = () => Math.min(36, 4 + S.penLv + 2 * S.reb), incuCap = () => 1 + S.incuLv, bagCap = () => 1 + S.bagLv, mult = () => 1 + 0.5 * S.reb;
const petInc = (p) => PETBY[p.s].inc * 2 ** p.st * MUTBY[p.m].mul;
let EV = null; // 진행 중 이벤트 {id,t}
function income(noEvent) { let s = 0; for (const p of S.pets) s += petInc(p); return s * mult() * (!noEvent && EV?.id === 'gold' ? 2 : 1); }
const spdOf = (pts) => 8 + Math.min(18, 3 * Math.log2(1 + pts / 20));
const lockDur = () => 60 + 10 * S.reb;

// ---------------------------------------------------------------- 렌더러
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const QMAX = prefs.q === 'low' ? 1 : prefs.q === 'high' ? 2 : 1.6;
let dpr = Math.min(devicePixelRatio || 1, QMAX);
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = prefs.q !== 'low';
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
{ const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6ec0ee'); gr.addColorStop(0.55, '#a8dcf4'); gr.addColorStop(1, '#e6f6fb'); g.fillStyle = gr; g.fillRect(0, 0, 2, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }
scene.fog = new THREE.Fog('#cdeefa', 110, 260);
const camera = new THREE.PerspectiveCamera(55, 1, 0.4, 600);
const hemi = new THREE.HemisphereLight('#ffffff', '#8fb87a', 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2dc', 2.3); scene.add(sun, sun.target);
sun.castShadow = true; { const sc = sun.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 140; } sun.shadow.mapSize.set(prefs.q === 'high' ? 2048 : 1024, prefs.q === 'high' ? 2048 : 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const W = buildWorld(scene);
const { colliders, nests, machines } = W;
// 구름
const clouds = [];
for (let i = 0; i < 9; i++) { const k = new Kit({ outline: 0 }); for (let j = 0; j < 5; j++) k.sph('#ffffff', [(j - 2) * 2.4 + rnd(), rnd() * 1.2, rnd() * 2], 2 + rnd() * 1.6, { outline: false }); const m = meshOf(k.build(), undefined, false); const a = rnd() * 6.28, r = 90 + rnd() * 70; m.position.set(Math.cos(a) * r, 34 + rnd() * 18, Math.sin(a) * r); m.scale.setScalar(1 + rnd()); scene.add(m); clouds.push({ m, a, r, v: 0.006 + rnd() * 0.01 }); }

// ---------------------------------------------------------------- 글자 표지(스프라이트)
function label(text, o = {}) {
  const cw = o.w || 256, ch = o.hpx || 64, cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 2;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest ?? true }));
  sp.scale.set((cw / ch) * (o.h || 0.6), o.h || 0.6, 1); sp.renderOrder = 5;
  let last = null;
  const BG0 = 'bg' in o ? o.bg : 'rgba(255,255,255,.94)';
  sp.userData.set = (t, fg = o.fg || '#2a1a28', bg = BG0) => {
    const key = t + fg + bg; if (key === last) return; last = key;
    g.clearRect(0, 0, cw, ch);
    let fs = ch * 0.62; g.font = `800 ${fs}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    let tw = g.measureText(t).width; if (tw > cw - ch * 0.6) { fs *= (cw - ch * 0.6) / tw; g.font = `800 ${fs}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; tw = g.measureText(t).width; }
    if (bg) { const bw = Math.min(cw - 4, tw + ch * 0.6), x = (cw - bw) / 2, r = ch * 0.42; g.fillStyle = bg; g.beginPath(); g.roundRect(x, 4, bw, ch - 8, r); g.fill(); if (o.border) { g.lineWidth = 4; g.strokeStyle = o.border; g.stroke(); } }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cw / 2, ch / 2 + 2);
    tex.needsUpdate = true;
  };
  sp.userData.set(text);
  return sp;
}
// 광장 기계 이름표
const MNAME = { belt: '🏃 러닝 벨트', fuse: '🧬 융합기', trail: '✨ 트레일 상점', sell: '💰 판매대', rebirth: '🔁 환생 DNA 탑' };
for (const m of machines) { const l = label(MNAME[m.id], { w: 320, h: 0.95, border: '#2a1a28' }); l.position.set(m.x, m.id === 'rebirth' ? 7.8 : 4.4, m.z); scene.add(l); }

// ---------------------------------------------------------------- 기지 6곳
const OWN = []; // 0 = 나, 1~5 = 봇
const botNames = [...BOT_NAMES].sort(() => rnd() - 0.5);
for (let i = 0; i < 6; i++) {
  const me = i === 0, col = me ? ME_COL : BOT_COLS[i - 1], name = me ? '나' : botNames[i - 1];
  const view = buildBase(scene, i, col, name);
  const sign = label(me ? '⭐ 내 기지' : `${name}의 기지`, { w: 320, h: 1, bg: col, fg: '#ffffff' });
  const [sx, sz] = toWorld(view.f, 0, -BASE_D - 0.55); sign.position.set(sx, 3.05, sz); scene.add(sign);
  const padL = label('', { w: 256, h: 0.7, bg: '#fff3c0', border: '#d8a020' }); padL.position.set(...pos3(view.f, PAD, 1.4)); scene.add(padL);
  const lockL = label('', { w: 256, h: 0.6, bg: '#e0f6ff', border: '#3ac8ff' }); lockL.position.set(...pos3(view.f, LOCKPAD, 1.3)); scene.add(lockL);
  const incL = []; if (me) for (let k = 0; k < 7; k++) { const l = label('', { w: 160, h: 0.42, bg: 'rgba(255,255,255,.9)' }); l.position.set(...pos3(view.f, incuPos(k), 1.55)); l.visible = false; scene.add(l); incL.push(l); }
  OWN.push({ i, me, col, name, view, pets: me ? S.pets : [], tray: me ? S.eggs : [], incu: me ? S.incu : [], lockT: 0, lockCd: 0, padL, lockL, incL, sigKey: '', cash: 0 });
}
function pos3(f, [lx, lz], y) { const [x, z] = toWorld(f, lx, lz); return [x, y, z]; }
const inBase = (i, x, z, pad = 0) => { const [lx, lz] = toLocal(OWN[i].view.f, x, z); return Math.abs(lx) < BASE_W + pad && Math.abs(lz) < BASE_D + pad; };
const ownerCap = (o) => (o.me ? penCap() : o.cap);

// ---------------------------------------------------------------- 캐릭터
const HAIR = ['#4a3020', '#2a2a3a', '#c88a3a', '#8a3a2a', '#e0c070', '#5a3a6a'];
function makeChar(col, base, name, hair) {
  const m = personMesh(col, { hair }); m.traverse((o) => { if (o.isMesh && o.material !== undefined && o.material.type === 'MeshToonMaterial') o.castShadow = true; }); scene.add(m);
  const stars = label('💫', { w: 64, h: 0.7, bg: null }); stars.position.y = 2.25; stars.visible = false; m.add(stars);
  const c = { m, stars, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, ground: true, carry: [], carryKey: '', stun: 0, inv: 0, base, name, col, phase: 0, face: 0, punch: 0 };
  const f = baseFrame(base), [x, z] = toWorld(f, 0, 3); c.x = x; c.z = z; c.face = f.yaw;
  return c;
}
const P = makeChar(ME_COL, 0, '나', '#3a2a1a');
const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; scene.add(ring);
const BOTS = [];
for (let i = 1; i < 6; i++) {
  const b = makeChar(BOT_COLS[i - 1], i, OWN[i].name, HAIR[i]);
  const tag = label(OWN[i].name, { w: 192, h: 0.5, bg: BOT_COLS[i - 1], fg: '#fff' }); tag.position.y = 2.55; b.m.add(tag);
  Object.assign(b, { st: 'idle', wait: 1 + rnd() * 3, tgt: null, jumpLv: Math.floor(rnd() * 2), pts: 10 + rnd() * 40, lvT: 90 + rnd() * 60, stuck: 0, lastD: 0, hold: 0, cd: 0, o: OWN[i] });
  OWN[i].cap = 10; OWN[i].bot = b;
  // 처음 생물 몇 마리
  for (let k = 0, n = 2 + Math.floor(rnd() * 3); k < n; k++) OWN[i].pets.push(rollPet(rnd() < 0.6 ? 'amph' : 'bird', 1, true));
  BOTS.push(b);
}
const CHARS = [P, ...BOTS];

// ---------------------------------------------------------------- 경비 세포
const GUARDS = [];
const GCOUNT = [3, 4, 4, 4];
for (let z = 0; z < 4; z++) for (let k = 0; k < GCOUNT[z]; k++) {
  const m = guardMesh(); m.traverse((o) => { if (o.isMesh && o.material.type === 'MeshToonMaterial') o.castShadow = true; }); scene.add(m);
  const Z = ZONES[z], r = (Z.r0 + Z.r1) / 2, a = (k / GCOUNT[z]) * Math.PI * 2 + z;
  const alert = label('❗', { w: 64, h: 0.8, bg: null }); alert.position.y = 2.1; alert.visible = false; m.add(alert);
  const zz = label('💤', { w: 64, h: 0.7, bg: null }); zz.position.y = 2; zz.visible = false; m.add(zz);
  GUARDS.push({ m, alert, zz, zone: z, r, a, dir: rnd() < 0.5 ? 1 : -1, x: Math.cos(a) * r, z: Math.sin(a) * r, st: 'patrol', tgt: null, t: 0, cool: 0, wob: rnd() * 6, face: 0, spd: 0 });
}

// ---------------------------------------------------------------- 알·생물 뽑기
function rollPet(e, boost = 1, bot = false) {
  const list = PETS.filter((p) => p.egg === e); let r = rnd() * list.reduce((s, p) => s + p.w, 0), pick = list[0];
  for (const p of list) { if ((r -= p.w) <= 0) { pick = p; break; } }
  let m = 'none'; for (const M of [...MUTS].reverse()) { if (M.p && rnd() < M.p * boost) { m = M.id; break; } }
  return { id: bot ? -(S.nid++) : S.nid++, s: pick.id, m, st: 0 };
}
const respawnT = (E) => 7 + E.tier * 3 + rnd() * 4;

// ---------------------------------------------------------------- 둥지 알 모델
for (const n of nests) { n.eggMesh = eggMesh(n.E); n.eggMesh.position.y = n.h + 0.12; n.g.add(n.eggMesh); n.eggMesh.traverse((o) => { if (o.isMesh && o.material.type === 'MeshToonMaterial') o.castShadow = true; }); }
const RAIN = []; // 알 소나기 {x,y,z,vy,e,m}

// ---------------------------------------------------------------- 입자
const PN = 220, pGeo = new THREE.IcosahedronGeometry(1, 0), pMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const PI = new THREE.InstancedMesh(pGeo, pMat, PN); PI.instanceMatrix.setUsage(THREE.DynamicDrawUsage); PI.frustumCulled = false; scene.add(PI);
const parts = []; for (let i = 0; i < PN; i++) { parts.push({ life: 0 }); PI.setColorAt(i, new THREE.Color('#fff')); }
let pNext = 0; const _m4 = new THREE.Matrix4(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function emit(x, y, z, col, o = {}) {
  const p = parts[pNext]; pNext = (pNext + 1) % PN;
  Object.assign(p, { x, y, z, vx: o.vx ?? (rnd() - 0.5) * (o.spread ?? 4), vy: o.vy ?? 2 + rnd() * 4, vz: o.vz ?? (rnd() - 0.5) * (o.spread ?? 4), life: o.life ?? 0.9, max: o.life ?? 0.9, size: o.size ?? 0.14, g: o.g ?? 9, rot: rnd() * 6 });
  PI.setColorAt(parts.indexOf(p), _c.set(col)); PI.instanceColor.needsUpdate = true;
}
function burst(x, y, z, cols, n = 18, o = {}) { for (let i = 0; i < n; i++) emit(x, y, z, cols[i % cols.length], o); }
function stepParts(dt) {
  for (let i = 0; i < PN; i++) {
    const p = parts[i];
    if (p.life > 0) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; } p.rot += dt * 5; }
    const s = p.life > 0 ? p.size * Math.min(1, p.life / p.max * 2.2) : 0;
    _m4.compose(_v.set(p.x || 0, p.y || 0, p.z || 0), _q.setFromAxisAngle(_s.set(0.3, 1, 0.2).normalize(), p.rot || 0), _s.set(s, s, s)); PI.setMatrixAt(i, _m4);
  }
  PI.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- 길잡이 화살표
const guide = (() => { const k = new Kit({ outline: 0.05 }); k.add('cone', '#ffd84a', { p: [0, 0, 0], s: [0.5, 0.9, 0.5], r: [Math.PI, 0, 0] }); k.add('cyl', '#ffd84a', { p: [0, 0.75, 0], s: [0.22, 0.7, 0.22] }); const m = meshOf(k.build(), undefined, false); scene.add(m); return m; })();

// ---------------------------------------------------------------- 소리
let AC = null;
function tone(f, t0, d, type = 'sine', v = 0.12, f2) {
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + t0; o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
}
function snd(k) {
  if (!prefs.snd) return;
  try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { return; }
  switch (k) {
    case 'steal': tone(520, 0, 0.12, 'triangle', 0.14, 900); tone(900, 0.08, 0.14, 'triangle', 0.1, 1300); break;
    case 'drop': tone(420, 0, 0.3, 'sawtooth', 0.06, 120); break;
    case 'hatch': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.12)); break;
    case 'coin': tone(1320, 0, 0.08, 'square', 0.05); tone(1760, 0.07, 0.16, 'square', 0.05); break;
    case 'buy': tone(660, 0, 0.1, 'triangle', 0.12); tone(990, 0.08, 0.18, 'triangle', 0.12); break;
    case 'stun': tone(300, 0, 0.35, 'square', 0.06, 90); tone(800, 0.05, 0.3, 'sine', 0.06, 1600); break;
    case 'jump': tone(380, 0, 0.14, 'sine', 0.07, 640); break;
    case 'bonk': tone(180, 0, 0.12, 'square', 0.1, 80); break;
    case 'lock': tone(300, 0, 0.4, 'sine', 0.1, 900); tone(600, 0.1, 0.4, 'triangle', 0.06, 1500); break;
    case 'event': [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.3, 'triangle', 0.1)); break;
    case 'alarm': tone(880, 0, 0.15, 'square', 0.06); tone(660, 0.18, 0.15, 'square', 0.06); tone(880, 0.36, 0.15, 'square', 0.06); break;
    case 'tap': tone(700, 0, 0.05, 'triangle', 0.06); break;
    case 'deliver': tone(600, 0, 0.1, 'triangle', 0.1); tone(800, 0.06, 0.1, 'triangle', 0.1); tone(1000, 0.12, 0.18, 'triangle', 0.1); break;
  }
}

// ---------------------------------------------------------------- 입력
const keys = new Set();
let joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, camDrag = { id: null, x: 0, y: 0 }, camYaw = 0, camPitch = 0.55, camDist = touchUI ? 14.5 : 13.5, lastDragT = 0;
let actHeld = false, actEdge = false, jumpEdge = false;
const panelOpen = () => !$('#panel').classList.contains('hidden');
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (!keys.has(e.code)) { if (e.code === 'KeyE' || e.code === 'KeyF') actEdge = true; if (e.code === 'Space') jumpEdge = true; }
  keys.add(e.code);
  if (e.code === 'Escape' && panelOpen()) closePanel();
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); actHeld = false; });
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && joy.id === null) { joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 }; showJoy(true); }
  else if (camDrag.id === null) camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) { const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, d = Math.hypot(dx, dy), R = 56; const k = d > R ? R / d : 1; joy.x = (dx * k) / R; joy.y = (dy * k) / R; if (d > R * 1.6) { joy.ox += dx * (1 - R / d) * 0.5; joy.oy += dy * (1 - R / d) * 0.5; } showJoy(true); }
  else if (e.pointerId === camDrag.id) { const s = e.pointerType === 'touch' ? 0.0075 : 0.005; camYaw -= (e.clientX - camDrag.x) * s; camPitch = clamp(camPitch + (e.clientY - camDrag.y) * s * 0.7, 0.12, 1.15); camDrag.x = e.clientX; camDrag.y = e.clientY; lastDragT = performance.now(); }
});
const endPtr = (e) => { if (e.pointerId === joy.id) { joy = { id: null, x: 0, y: 0 }; showJoy(false); } if (e.pointerId === camDrag.id) camDrag = { id: null }; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { camDist = clamp(camDist + e.deltaY * 0.01, 6, 22); e.preventDefault(); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
function showJoy(on) { const j = $('#joy'); j.classList.toggle('on', on); if (on) { j.style.left = joy.ox + 'px'; j.style.top = joy.oy + 'px'; $('#knob').style.transform = `translate(${joy.x * 44}px, ${joy.y * 44}px)`; } }
const holdBtn = (el, down, up) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); down(); }); const u = () => { el.classList.remove('down'); up && up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u); };
holdBtn($('#bAct'), () => { actHeld = true; actEdge = true; }, () => { actHeld = false; });
holdBtn($('#bJump'), () => { jumpEdge = true; });

// ---------------------------------------------------------------- 물리
const PR = 0.45;
function physics(c, dt, grounded = true) {
  c.x += c.vx * dt; c.z += c.vz * dt;
  if (grounded) { c.vy -= GRAV * dt; c.y += c.vy * dt; }
  let floor = 0;
  for (const k of colliders) {
    const dx = c.x - k.x, dz = c.z - k.z, rr = k.r + PR; if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
    const d = Math.hypot(dx, dz);
    if (k.top && c.y >= k.h - 0.4) { if (d < k.r + 0.15) floor = Math.max(floor, k.h); continue; }
    if (d < rr && d > 1e-4) { c.x = k.x + (dx / d) * rr; c.z = k.z + (dz / d) * rr; }
  }
  // 잠긴 기지 방어막
  for (const o of OWN) if (o.lockT > 0 && c.base !== o.i) { const f = o.view.f, dx = c.x - f.x, dz = c.z - f.z, d = Math.hypot(dx, dz); if (d < 13.6) { c.x = f.x + (dx / d) * 13.6; c.z = f.z + (dz / d) * 13.6; } }
  const r = Math.hypot(c.x, c.z); if (r > ISLAND - 1.2) { c.x *= (ISLAND - 1.2) / r; c.z *= (ISLAND - 1.2) / r; }
  if (grounded) { if (c.y <= floor) { if (!c.ground && c.vy < -8 && c === P) burst(c.x, floor + 0.1, c.z, ['#ffffff', '#e8f0e0'], 6, { spread: 3, vy: 1.5, life: 0.4, size: 0.1 }); c.y = floor; c.vy = 0; c.ground = true; } else c.ground = false; }
}
function stunChar(c, why) {
  if (c.inv > 0 || c.stun > 0) return;
  c.stun = 1.7; c.inv = 3.5; c.vx = c.vz = 0;
  for (const o of c.carry) {
    if (o.t === 'egg') { if (o.nest) { if (!o.nest.has) { o.nest.has = true; o.nest.timer = 0; } } else spawnRain(o.e, c.x + (rnd() - 0.5) * 2, c.z + (rnd() - 0.5) * 2, 1.5); }
    else { OWN[o.from].pets.push(o.pet); if (o.from === 0) toast('되찾았어요! 생물이 내 기지로 돌아갔어요. 🛡️'); }
  }
  const had = c.carry.length; c.carry = [];
  burst(c.x, c.y + 1.8, c.z, ['#ffd84a', '#ffffff'], 12, { spread: 5 });
  if (c === P) { snd('stun'); if (had) toast(why === 'guard' ? '경비 세포에게 잡혔어요! 알이 둥지로 돌아갔어요.' : `${why}에게 맞아서 떨어뜨렸어요!`, 'bad'); }
  else snd('bonk');
}

// ---------------------------------------------------------------- 알 소나기
function spawnRain(e, x, z, y = 28) {
  const E = EGGBY[e], m = eggMesh(E); m.position.set(x, y, z); scene.add(m);
  RAIN.push({ x, y, z, vy: 0, e, m, life: 60 });
}
function startRain() {
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = 16 + rnd() * 36, z = zoneAt(r); const pool = EGGS.filter((e) => e.tier <= 1 + (3 - Math.max(0, z)) * 1.4); spawnRain(pool[Math.floor(rnd() * pool.length)].id, Math.cos(a) * r, Math.sin(a) * r, 26 + rnd() * 14); }
}

// ---------------------------------------------------------------- 경비 움직임
function stepGuards(dt) {
  const nap = EV?.id === 'nap';
  for (const g of GUARDS) {
    g.wob += dt; g.alert.visible = false; g.zz.visible = nap;
    if (nap) { g.m.position.set(g.x, 0, g.z); g.m.rotation.z = Math.sin(g.wob * 1.5) * 0.12; continue; }
    g.m.rotation.z = 0; g.cool = Math.max(0, g.cool - dt);
    const Z = ZONES[g.zone];
    if (g.st === 'patrol' || g.st === 'return') {
      if (g.st === 'patrol') { g.a += (g.dir * 2.6 * dt) / g.r; if (rnd() < dt * 0.08) g.dir *= -1; }
      const rr = g.r + Math.sin(g.wob * 0.6) * (Z.r1 - Z.r0) * 0.3, tx = Math.cos(g.a) * rr, tz = Math.sin(g.a) * rr;
      moveTo(g, tx, tz, g.st === 'return' ? 5 : 2.8, dt);
      if (g.st === 'return' && Math.hypot(tx - g.x, tz - g.z) < 1) g.st = 'patrol';
      // 알을 든 도둑 찾기
      if (!g.cool) for (const c of CHARS) {
        if (!c.carry.some((o) => o.t === 'egg') || c.stun > 0 || c.y > 1.3) continue;
        const cr = Math.hypot(c.x, c.z); if (cr < Z.r0 - 2 || cr > Z.r1 + 2) continue;
        if (Math.hypot(c.x - g.x, c.z - g.z) < 7.5) { g.st = 'chase'; g.tgt = c; g.t = 5.5; if (c === P) snd('alarm'); break; }
      }
    } else if (g.st === 'chase') {
      const c = g.tgt; g.t -= dt; g.alert.visible = true;
      const cr = Math.hypot(c.x, c.z), d = Math.hypot(c.x - g.x, c.z - g.z);
      if (g.t <= 0 || !c.carry.some((o) => o.t === 'egg') || cr < Z.r0 - 5 || cr > Z.r1 + 5 || d > 16 || c.stun > 0) { g.st = 'return'; g.cool = 2.5; g.a = Math.atan2(g.z, g.x); continue; }
      moveTo(g, c.x, c.z, 6.3 + g.zone * 0.75, dt);
      if (d < 1.35 && c.y < 1.5) { stunChar(c, 'guard'); g.st = 'return'; g.cool = 3; g.a = Math.atan2(g.z, g.x); }
    }
    g.m.position.set(g.x, Math.abs(Math.sin(g.wob * 6)) * 0.12 * Math.min(1, g.spd / 3), g.z);
  }
}
function moveTo(g, tx, tz, spd, dt) {
  const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
  if (d > 0.05) { const s = Math.min(spd, d / dt); g.vx = (dx / d) * s; g.vz = (dz / d) * s; } else g.vx = g.vz = 0;
  g.spd = Math.hypot(g.vx, g.vz); g.y = 0;
  physics(g, dt, false);
  if (g.spd > 0.3) { const want = Math.atan2(g.vx, g.vz); g.face += (((want - g.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 8); g.m.rotation.y = g.face; }
}

// ---------------------------------------------------------------- 봇
let raidT = 110 + rnd() * 60;
function botThink(b, dt) {
  const o = b.o;
  b.lvT -= dt; if (b.lvT <= 0 && b.jumpLv < 10) { b.jumpLv++; b.lvT = 100 + rnd() * 60 + b.jumpLv * 15; o.cap = Math.min(36, 10 + b.jumpLv * 2); }
  b.pts = Math.min(900, b.pts + dt * 0.5);
  b.cd = Math.max(0, b.cd - dt);
  if (b.stun > 0) { b.vx = b.vz = 0; return; }
  const bag = 1 + Math.floor(b.jumpLv / 4);
  let tx = b.x, tz = b.z, spd = spdOf(b.pts) * 0.76 * (b.carry.length ? 0.8 : 1), want = false;
  const home = () => toWorld(o.view.f, 0, 1);
  // 내가 이 봇의 생물을 들고 있으면 쫓아옴
  const stolen = P.carry.some((c) => c.t === 'pet' && c.from === o.i);
  if (stolen && b.st !== 'chase' && Math.hypot(P.x - b.x, P.z - b.z) < 40) { b.st = 'chase'; }
  switch (b.st) {
    case 'idle': {
      b.wait -= dt; if (b.wait > 0) break;
      if (raidT <= 0 && S.pets.length >= 3 && OWN[0].lockT <= 0 && !BOTS.some((x) => x.st === 'raid')) { b.st = 'raid'; raidT = 120 + rnd() * 90; break; }
      // 알 소나기 우선
      let best = null, bs = -1e9;
      for (const r of RAIN) { if (r.y > 1 || r.claim) continue; const sc = 8 + EGGBY[r.e].tier * 3 - Math.hypot(r.x - b.x, r.z - b.z) / 8; if (sc > bs) { bs = sc; best = { rain: r }; } }
      for (const n of nests) { if (!n.has || (n.E.jump || 0) > b.jumpLv || n.claim) continue; const sc = n.E.tier * 3 - Math.hypot(n.x - b.x, n.z - b.z) / 10 + rnd() * 3; if (sc > bs) { bs = sc; best = { nest: n }; } }
      if (best) { b.tgt = best; (best.nest || best.rain).claim = b; b.st = 'go'; b.stuck = 0; } else b.wait = 2;
      break;
    }
    case 'go': {
      const t = b.tgt, n = t.nest, r = t.rain;
      if ((n && !n.has) || (r && !RAIN.includes(r))) { release(b); b.st = b.carry.length ? 'home' : 'idle'; b.wait = 0.5; break; }
      const X = n ? n.x : r.x, Z = n ? n.z : r.z, H = n ? n.h : 0, d = Math.hypot(X - b.x, Z - b.z);
      tx = X; tz = Z;
      if (H > 0 && d < 3.4 && b.ground && b.y < H - 0.3) want = true;
      if (d < 1.7 && Math.abs(b.y - H) < 1) { b.hold += dt; tx = b.x; tz = b.z; if (b.hold > 0.7) { b.hold = 0; if (n) { n.has = false; n.timer = respawnT(n.E); b.carry.push({ t: 'egg', e: n.egg, nest: n }); } else { RAIN.splice(RAIN.indexOf(r), 1); scene.remove(r.m); b.carry.push({ t: 'egg', e: r.e, nest: null }); } release(b); b.st = b.carry.length < bag && rnd() < 0.45 ? 'idle' : 'home'; b.wait = 0; } }
      else b.hold = 0;
      break;
    }
    case 'home': {
      [tx, tz] = home();
      if (inBase(o.i, b.x, b.z, -1)) {
        for (const c of b.carry) { if (c.t === 'egg') o.tray.push(c.e); else { c.pet.id = -(S.nid++); o.pets.push(c.pet); if (c.from === 0) { toast(`😱 ${o.name}이(가) 내 ${PETBY[c.pet.s].name}을(를) 훔쳐 갔어요!`, 'bad'); } } }
        b.carry = []; b.st = 'idle'; b.wait = 3 + rnd() * 4;
        if (o.lockCd <= 0 && rnd() < 0.35) { o.lockT = 30 + rnd() * 30; o.lockCd = 40; }
      }
      break;
    }
    case 'raid': {
      const me = OWN[0];
      if (me.lockT > 0 || !S.pets.length) { b.st = 'idle'; break; }
      if (!b.raidIdx || b.raidIdx >= S.pets.length) b.raidIdx = Math.floor(rnd() * S.pets.length);
      const [lx, lz] = slotPos(b.raidIdx); [tx, tz] = toWorld(me.view.f, lx, lz);
      if (!b.warned && inBase(0, b.x, b.z, 5)) { b.warned = true; toast(`⚠️ ${o.name}이(가) 내 기지에 숨어들었어요! 때려서 막아요!`, 'bad'); snd('alarm'); }
      if (Math.hypot(tx - b.x, tz - b.z) < 1.2) { b.hold += dt; tx = b.x; tz = b.z; if (b.hold > 1.4) { b.hold = 0; const pet = S.pets.splice(b.raidIdx, 1)[0]; b.carry.push({ t: 'pet', pet, from: 0 }); b.st = 'home'; b.warned = false; b.raidIdx = 0; } }
      else b.hold = 0;
      break;
    }
    case 'chase': {
      if (!stolen || Math.hypot(P.x - b.x, P.z - b.z) > 45 || inBase(0, P.x, P.z)) { b.st = b.carry.length ? 'home' : 'idle'; break; }
      tx = P.x; tz = P.z; spd *= 1.05;
      if (Math.hypot(P.x - b.x, P.z - b.z) < 1.5 && b.cd <= 0 && Math.abs(P.y - b.y) < 1.2) { b.cd = 1.6; b.punch = 0.3; stunChar(P, o.name); }
      break;
    }
  }
  // 이동
  const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d > 0.3) { b.vx = lerp(b.vx, (dx / d) * spd, Math.min(1, dt * 8)); b.vz = lerp(b.vz, (dz / d) * spd, Math.min(1, dt * 8)); } else { b.vx *= 0.8; b.vz *= 0.8; }
  // 막힘 풀기
  b.stuck += dt; if (b.stuck > 1) { if (Math.abs(b.lastD - d) < 0.4 && d > 2 && b.ground) { want = true; b.vx += (rnd() - 0.5) * 12; b.vz += (rnd() - 0.5) * 12; } b.lastD = d; b.stuck = 0; }
  if (want && b.ground) { b.vy = jumpV(b.jumpLv); b.ground = false; }
}
function release(b) { const t = b.tgt; if (t) { const x = t.nest || t.rain; if (x && x.claim === b) x.claim = null; } b.tgt = null; }

// ---------------------------------------------------------------- 경제(부화·수입)
function stepEconomy(dt) {
  const boost = EV?.id === 'mutstorm' ? 5 : 1;
  for (const o of OWN) {
    const cap = o.me ? incuCap() : 1 + Math.floor((o.bot?.jumpLv || 0) / 3);
    for (let k = 0; k < cap; k++) {
      if (!o.incu[k] && o.tray.length) { const e = o.tray.shift(); o.incu[k] = { e, t: EGGBY[e].hatch, T: EGGBY[e].hatch }; }
      const it = o.incu[k]; if (!it) continue;
      it.t = Math.max(0, it.t - (o.me ? dt : dt * 0.6));
      if (it.t <= 0) {
        if (o.pets.length < ownerCap(o)) {
          const pet = rollPet(it.e, boost, !o.me); o.pets.push(pet); o.incu[k] = null;
          if (o.me) onHatch(pet, k);
        } else if (!o.me) { // 봇은 가장 약한 생물을 정리
          let lo = 0; o.pets.forEach((p, i) => { if (petInc(p) < petInc(o.pets[lo])) lo = i; }); o.pets.splice(lo, 1);
        }
      }
    }
    o.lockT = Math.max(0, o.lockT - dt); o.lockCd = Math.max(0, o.lockCd - dt);
    if (o.bot) { let s = 0; for (const p of o.pets) s += petInc(p); o.inc = s; }
  }
  S.pad += income() * dt;
}
function onHatch(pet, k) {
  S.hatched++;
  const P_ = PETBY[pet.s], first = !S.codex[pet.s];
  const cx = (S.codex[pet.s] ||= []); if (!cx.includes(pet.m)) cx.push(pet.m);
  const f = OWN[0].view.f, [x, z] = toWorld(f, ...incuPos(k));
  burst(x, 1, z, [RAR[P_.r].col, '#ffffff', '#ffd84a'], 26, { spread: 6, vy: 6 });
  snd('hatch');
  hatchCard(pet, first);
  window.ILOG?.game?.('부화', `${P_.name}${pet.m !== 'none' ? ' ' + MUTBY[pet.m].name : ''}`);
}

// ---------------------------------------------------------------- 상호작용(행동 버튼)
let ctx = null, holdT = 0, holdKey = '';
function findCtx() {
  if (P.stun > 0) return null;
  const free = bagCap() - P.carry.length, petCarry = P.carry.some((c) => c.t === 'pet');
  if (free > 0 && !petCarry) {
    let best = null, bd = 9;
    for (const n of nests) { if (!n.has) continue; const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < 2 && Math.abs(P.y - n.h) < 1.15 && d < bd) { bd = d; best = n; } }
    if (best) return { k: 'steal', key: 'n' + best.id, n: best, hold: 0.55, label: `${best.E.name} 훔치기` };
    for (const r of RAIN) { if (r.y > 1.2) continue; const d = Math.hypot(r.x - P.x, r.z - P.z); if (d < 1.9) return { k: 'pick', key: 'r' + RAIN.indexOf(r), r, hold: 0.2, label: '알 줍기' }; }
  }
  for (let i = 1; i < 6; i++) {
    const o = OWN[i]; if (!inBase(i, P.x, P.z)) continue;
    if (o.lockT > 0) return { k: 'none', key: 'lk', label: '🔒 잠긴 기지' };
    for (let s = 0; s < o.pets.length && s < 36; s++) {
      const [x, z] = toWorld(o.view.f, ...slotPos(s));
      if (Math.hypot(x - P.x, z - P.z) < 1.25) {
        if (P.carry.length) return { k: 'none', key: 'full', label: '손이 꽉 찼어요' };
        if (S.pets.length >= penCap()) return { k: 'none', key: 'pen', label: '내 우리가 가득' };
        return { k: 'raid', key: `p${i}:${o.pets[s].id}`, o, s, hold: 1.1, label: `${PETBY[o.pets[s].s].name} 훔치기` };
      }
    }
  }
  for (const b of BOTS) { if (b.stun > 0 || b.inv > 0) continue; if (Math.hypot(b.x - P.x, b.z - P.z) < 2.4 && Math.abs(b.y - P.y) < 1.4) return { k: 'bonk', key: 'b' + b.base, b, label: `${b.name} 때리기` }; }
  for (const m of machines) if (Math.hypot(m.x - P.x, m.z - P.z) < m.r + 0.6) return { k: 'open', key: 'm' + m.id, m, label: MNAME[m.id] + ' 열기' };
  if (inBase(0, P.x, P.z)) return { k: 'open', key: 'mpets', m: { id: 'pets' }, label: '🐾 내 생물 보기' };
  return null;
}
function doAction(c) {
  switch (c.k) {
    case 'steal': { const n = c.n; n.has = false; n.timer = respawnT(n.E); if (n.claim) { const b = n.claim; release(b); b.st = 'idle'; } P.carry.push({ t: 'egg', e: n.egg, nest: n }); S.stolen++; snd('steal'); burst(n.x, n.h + 0.6, n.z, [n.E.col, '#ffffff'], 10, { spread: 3 }); floaty(`+ ${n.E.name}`, n.x, n.h + 1.8, n.z, n.E.col); window.ILOG?.game?.('훔치기', n.E.name); break; }
    case 'pick': { const r = c.r; RAIN.splice(RAIN.indexOf(r), 1); scene.remove(r.m); if (r.claim) { release(r.claim); r.claim.st = 'idle'; } P.carry.push({ t: 'egg', e: r.e, nest: null }); snd('steal'); break; }
    case 'raid': { const pet = c.o.pets.splice(c.s, 1)[0]; P.carry.push({ t: 'pet', pet, from: c.o.i }); snd('steal'); S.raids++; toast(`${PETBY[pet.s].name}을(를) 훔쳤어요! ${c.o.name}이(가) 쫓아와요. 기지로 달려요!`, 'warn'); c.o.bot.st = 'chase'; window.ILOG?.game?.('생물 훔치기', c.o.name); break; }
    case 'bonk': { P.punch = 0.3; const b = c.b, dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz) || 1; stunChar(b); b.vx = (dx / d) * 6; b.vz = (dz / d) * 6; floaty('퍽!', b.x, b.y + 2.4, b.z, '#ff5a5a'); if (b.st === 'raid') b.st = 'idle'; window.ILOG?.game?.('때리기', b.name); break; }
    case 'open': openPanel(c.m.id); break;
  }
}

// ---------------------------------------------------------------- 내 기지 처리
let lockToast = 0;
function stepMyBase(dt) {
  const me = OWN[0], f = me.view.f;
  if (!inBase(0, P.x, P.z)) return;
  if (P.carry.length) {
    const keep = [];
    for (const c of P.carry) {
      if (c.t === 'egg') { if (S.eggs.length < 12) { S.eggs.push(c.e); } else keep.push(c); }
      else { if (S.pets.length < penCap()) { c.pet.id = S.nid++; S.pets.push(c.pet); if (c.from > 0) { const cx = (S.codex[c.pet.s] ||= []); if (!cx.includes(c.pet.m)) cx.push(c.pet.m); toast(`🎉 ${PETBY[c.pet.s].name}이(가) 내 우리에 들어왔어요!`); } } else keep.push(c); }
    }
    if (keep.length < P.carry.length) { snd('deliver'); burst(P.x, 2, P.z, ['#7af0ff', '#ffffff'], 12); }
    if (keep.length && lockToast <= 0) { toast(keep[0].t === 'egg' ? '알 받침이 가득해요(12개). 부화기를 늘려 보세요!' : '우리가 가득해요! 우리 칸을 늘려요.', 'warn'); lockToast = 4; }
    P.carry = keep;
  }
  const [lx, lz] = toLocal(f, P.x, P.z);
  if (Math.hypot(lx - PAD[0], lz - PAD[1]) < 1.6 && S.pad >= 1) {
    const v = Math.floor(S.pad); S.cash += v; S.earned += v; S.pad -= v; snd('coin');
    const [x, z] = toWorld(f, ...PAD); burst(x, 0.6, z, ['#ffd84a', '#ffe88a', '#f0b020'], Math.min(24, 6 + Math.log10(v + 1) * 4), { spread: 4, vy: 6 }); floaty(`+${fmt(v)}`, x, 2.2, z, '#f0a020');
  }
  if (Math.hypot(lx - LOCKPAD[0], lz - LOCKPAD[1]) < 1.2) {
    if (me.lockT <= 0 && me.lockCd <= 0) { me.lockT = lockDur(); me.lockCd = me.lockT + 10; S.locked++; snd('lock'); toast(`🔒 기지를 ${lockDur()}초 동안 잠갔어요!`); }
    else if (me.lockT <= 0 && lockToast <= 0) { toast(`잠금 버튼 충전 중… ${Math.ceil(me.lockCd)}초`); lockToast = 3; }
  }
}

// ---------------------------------------------------------------- 이벤트
let evNext = 110 + rnd() * 40;
function stepEvents(dt) {
  if (EV) { EV.t -= dt; if (EV.t <= 0) { if (EV.id === 'rain') for (const r of [...RAIN]) if (r.y > -1 && r.life > 0 && !r.keep) { /* 남은 알은 천천히 사라짐 */ r.life = Math.min(r.life, 6); } EV = null; evNext = 170 + rnd() * 70; } }
  else { evNext -= dt; if (evNext <= 0) { const E = EVENTS[Math.floor(rnd() * EVENTS.length)]; EV = { id: E.id, t: E.dur, E }; snd('event'); toast(`🎉 이벤트: ${E.name}! ${E.desc}`, 'event'); if (E.id === 'rain') startRain(); } }
  for (let i = RAIN.length - 1; i >= 0; i--) {
    const r = RAIN[i]; r.life -= dt;
    if (r.y > 0.05) { r.vy -= 20 * dt; r.y = Math.max(0.05, r.y + r.vy * dt); if (r.y <= 0.05) { burst(r.x, 0.3, r.z, [EGGBY[r.e].col, '#ffffff'], 8, { spread: 3, vy: 3 }); } }
    r.m.position.set(r.x, r.y, r.z); r.m.rotation.y += dt;
    if (r.life <= 0) { scene.remove(r.m); RAIN.splice(i, 1); if (r.claim) { release(r.claim); r.claim.st = 'idle'; } }
  }
}

// ---------------------------------------------------------------- 그림(캐릭터·기지·라벨)
function syncCarry(c) {
  const key = c.carry.map((o) => (o.t === 'egg' ? o.e : o.pet.s + o.pet.m)).join();
  if (key === c.carryKey) return; c.carryKey = key;
  const g = c.m.userData.carry; g.clear();
  let y = 0;
  for (const o of c.carry) { const m = o.t === 'egg' ? eggMesh(EGGBY[o.e]) : petMesh(o.pet.s, o.pet.m); if (o.t === 'pet') m.scale.multiplyScalar(0.85); m.position.y = y; y += o.t === 'egg' ? 0.6 : 1; g.add(m); }
}
function animChar(c, dt, t) {
  const sp = Math.hypot(c.vx, c.vz), k = Math.min(1, sp / 5);
  c.phase += dt * (3 + sp * 1.3);
  const sw = Math.sin(c.phase) * k * 0.95, U = c.m.userData;
  U.legs[0].rotation.x = c.ground ? sw : -0.5; U.legs[1].rotation.x = c.ground ? -sw : 0.3;
  c.punch = Math.max(0, c.punch - dt);
  if (c.carry.length) { U.arms[0].rotation.x = U.arms[1].rotation.x = -2.75; }
  else if (c.punch > 0) { U.arms[1].rotation.x = -1.6; U.arms[0].rotation.x = 0.3; }
  else { U.arms[0].rotation.x = -sw * 0.8; U.arms[1].rotation.x = sw * 0.8; }
  U.body.position.y = Math.abs(Math.sin(c.phase)) * 0.07 * k;
  if (sp > 0.4 && c.stun <= 0) { const want = Math.atan2(c.vx, c.vz); c.face += (((want - c.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 12); }
  c.m.rotation.y = c.face;
  c.m.rotation.z = c.stun > 0 ? Math.sin(t * 18) * 0.12 : 0;
  c.stars.visible = c.stun > 0; if (c.stun > 0) c.stars.material.rotation = t * 4;
  c.m.position.set(c.x, c.y, c.z);
  c.m.visible = c.inv <= 0 || c.stun > 0 || Math.sin(t * 30) > -0.6;
  U.carry.position.y = 2.05 + Math.sin(t * 5) * 0.04;
  syncCarry(c);
}
function syncBase(o, t) {
  const v = o.view, cap = Math.min(36, ownerCap(o));
  const key = o.pets.map((p) => p.id).join() + '|' + cap;
  if (key !== o.sigKey) {
    o.sigKey = key; v.petHold.clear();
    v.slots.forEach((s, k) => { s.material = k < cap ? SLOT_ON : SLOT_OFF; });
    o.pets.slice(0, 36).forEach((p, k) => { const m = petMesh(p.s, p.m); const [x, z] = slotPos(k); m.position.set(x, 0.22, z); m.rotation.y = (rnd() - 0.5) * 0.6; m.userData.ph = rnd() * 6; m.userData.base = m.scale.x; m.traverse((q) => { if (q.isMesh && q.material.type === 'MeshToonMaterial') q.castShadow = true; }); v.petHold.add(m);
      if (p.st > 0) { const l = label('★'.repeat(p.st), { w: 192, h: 0.32, bg: null, fg: '#f0a020' }); l.position.set(x, 1.55 * m.scale.x, z); v.petHold.add(l); } });
  }
  // 근처만 움직임
  const near = Math.hypot(v.f.x - camera.position.x, v.f.z - camera.position.z) < 70;
  if (near) for (const m of v.petHold.children) if (m.userData.ph !== undefined) { m.position.y = 0.22 + Math.abs(Math.sin(t * 2.4 + m.userData.ph)) * 0.14; m.scale.y = m.userData.base * (1 + Math.sin(t * 4.8 + m.userData.ph) * 0.04); }
  // 부화기
  const icap = o.me ? incuCap() : 1 + Math.floor((o.bot?.jumpLv || 0) / 3);
  v.incs.forEach((it, k) => {
    it.g.visible = k < icap;
    const e = o.incu[k], ek = e ? e.e : '';
    if (ek !== it.key) { it.key = ek; it.hold.clear(); if (e) { const m = eggMesh(EGGBY[e.e]); m.scale.setScalar(1.1); it.hold.add(m); } }
    if (e && near) { const shake = e.t < 3 ? Math.sin(t * 30) * 0.12 : Math.sin(t * 2 + k) * 0.03; it.hold.rotation.z = shake; }
    if (o.me) { const l = o.incL[k]; l.visible = k < icap; if (l.visible) { if (!e) l.userData.set('비어 있음', '#8a8a9a'); else if (e.t <= 0) l.userData.set('우리 가득!', '#e04a4a'); else l.userData.set(`${Math.ceil(e.t)}초`, '#2a1a28'); } }
  });
  // 알 받침
  const tk = o.tray.slice(0, 6).join();
  if (tk !== v.trayKey) { v.trayKey = tk; v.trayHold.clear(); o.tray.slice(0, 6).forEach((e, k) => { const m = eggMesh(EGGBY[e]); m.scale.setScalar(0.8); m.position.set((k % 2 - 0.5) * 0.7, 0, (Math.floor(k / 2) - 1) * 0.75); v.trayHold.add(m); }); }
  // 방어막·발판 글자
  v.shield.visible = v.ring.visible = o.lockT > 0;
  if (o.lockT > 0) { v.shield.material.opacity = 0.12 + Math.sin(t * 3) * 0.04; }
  if (o.me) o.padL.userData.set(`💰 ${fmt(S.pad)}`);
  else o.padL.userData.set(`💰 ${fmt(o.inc || 0)}/초`);
  o.lockL.userData.set(o.lockT > 0 ? `🔒 ${Math.ceil(o.lockT)}초` : o.lockCd > 0 ? `⏳ ${Math.ceil(o.lockCd)}초` : '🔓 잠금');
}
function stepNests(dt, t) {
  for (const n of nests) {
    if (!n.has) { n.timer -= dt; if (n.timer <= 0 && !CHARS.some((c) => c.carry.some((o) => o.nest === n))) { n.has = true; burst(n.x, n.h + 0.5, n.z, [n.E.col, '#ffffff'], 8, { spread: 2, vy: 3 }); } }
    n.eggMesh.visible = n.has;
    if (n.has) { n.eggMesh.rotation.z = Math.sin(t * 2 + n.id) * 0.06; }
    if (n.beam) n.beam.visible = n.has;
  }
}

// ---------------------------------------------------------------- 트레일
let trailT = 0;
function stepTrail(dt) {
  const T = TRAILBY[S.trail]; if (!T || T.id === 'none') return;
  const sp = Math.hypot(P.vx, P.vz); if (sp < 1.5) return;
  trailT -= dt; if (trailT > 0) return; trailT = 0.035;
  const c = T.col[Math.floor(rnd() * T.col.length)];
  if (T.helix) { const a = performance.now() / 120; for (const s of [-1, 1]) emit(P.x + Math.cos(a) * 0.45 * s, P.y + 0.6 + Math.sin(a) * 0.3 * s, P.z + Math.sin(a) * 0.45 * s, T.col[s > 0 ? 0 : 1], { vx: 0, vy: 0.2, vz: 0, g: 0, life: 0.8, size: 0.11 }); }
  else emit(P.x + (rnd() - 0.5) * 0.4, P.y + 0.3 + rnd() * 0.6, P.z + (rnd() - 0.5) * 0.4, c, { vx: (rnd() - 0.5), vy: T.id === 'bubble' ? 1.2 : 0.4, vz: (rnd() - 0.5), g: T.id === 'bubble' ? -0.5 : 1, life: 0.9, size: T.id === 'rainbow' ? 0.16 : 0.11 });
}

// ---------------------------------------------------------------- 튜토리얼 목표
const TUT = [
  { t: '초록 들판의 둥지에서 알을 훔쳐요', h: touchUI ? '둥지 옆에서 ✋ 버튼을 꾹' : '둥지 옆에서 E 키를 꾹', done: () => S.stolen > 0 },
  { t: '알을 들고 내 기지로 돌아가요', h: '하늘색 깃발이 내 기지예요', done: () => S.eggs.length > 0 || S.incu.some(Boolean) || S.hatched > 0 },
  { t: '부화기에서 생물이 깨어나길 기다려요', h: '그동안 알을 더 훔쳐 와도 좋아요', done: () => S.hatched > 0 },
  { t: '노란 돈 발판을 밟아 돈을 모아요', h: '생물이 1초마다 돈을 벌어요', done: () => S.earned > 0 },
  { t: '업그레이드에서 점프력을 올려요', h: '높은 받침대 위 희귀한 알에 닿아요', done: () => S.jumpLv > 0 },
  { t: '광장의 러닝 벨트에서 달려 속도를 올려요', h: '빠르면 경비 세포를 따돌려요', done: () => S.spd >= 40 },
  { t: '잠금 버튼을 밟아 기지를 지켜요', h: '다른 연구원이 생물을 훔치러 와요', done: () => S.locked > 0 },
];
function tutTarget() {
  switch (S.tut) {
    case 0: { let b = null, bd = 1e9; for (const n of nests) if (n.has && n.zone === 0) { const d = Math.hypot(n.x - P.x, n.z - P.z); if (d < bd) { bd = d; b = n; } } return P.carry.length ? null : b && [b.x, b.h + 2.4, b.z]; }
    case 1: return pos3(OWN[0].view.f, [0, 1], 3);
    case 3: return pos3(OWN[0].view.f, PAD, 2.6);
    case 5: { const m = machines.find((q) => q.id === 'belt'); return [m.x, 3, m.z]; }
    case 6: return pos3(OWN[0].view.f, LOCKPAD, 2.4);
  }
  return null;
}

// ---------------------------------------------------------------- 카메라
const camT = new THREE.Vector3();
function stepCamera(dt) {
  camT.lerp(_v.set(P.x, P.y + 1.4, P.z), Math.min(1, dt * 10));
  const cp = Math.cos(camPitch);
  camera.position.set(camT.x + Math.sin(camYaw) * cp * camDist, camT.y + Math.sin(camPitch) * camDist, camT.z + Math.cos(camYaw) * cp * camDist);
  camera.lookAt(camT);
  sun.position.set(P.x + 28, 55, P.z + 18); sun.target.position.set(P.x, 0, P.z);
}

// ---------------------------------------------------------------- 메인 루프
let mode = 'title', last = performance.now(), T = 0, hudT = 0, saveT = 0, fpsAcc = 0, fpsN = 0, fpsT = 0, slowT = 0;
function update(dt) {
  T += dt;
  // 입력
  let ix = 0, iy = 0;
  if (!panelOpen()) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (joy.id !== null) { ix += joy.x; iy -= joy.y; }
  }
  const im = Math.hypot(ix, iy); if (im > 1) { ix /= im; iy /= im; }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let wx = rx * ix + fx * iy, wz = rz * ix + fz * iy;
  P.stun = Math.max(0, P.stun - dt); P.inv = Math.max(0, P.inv - dt);
  if (P.stun > 0) wx = wz = 0;
  const petC = P.carry.some((c) => c.t === 'pet'), eggs = P.carry.filter((c) => c.t === 'egg').length;
  const spd = spdOf(S.spd) * (1 + (TRAILBY[S.trail]?.spd || 0)) * (petC ? 0.72 : eggs ? 0.8 - 0.04 * (eggs - 1) : 1);
  const acc = P.ground ? 14 : 5;
  P.vx = lerp(P.vx, wx * spd, Math.min(1, dt * acc)); P.vz = lerp(P.vz, wz * spd, Math.min(1, dt * acc));
  if (jumpEdge && P.ground && P.stun <= 0 && !panelOpen()) { P.vy = jumpV(S.jumpLv); P.ground = false; snd('jump'); }
  // 러닝 벨트
  const belt = machines.find((m) => m.id === 'belt');
  P.onBelt = Math.abs(P.x - belt.x) < 1.4 && Math.abs(P.z - belt.z) < 2.4 && P.y < 0.8;
  if (P.onBelt) { const rate = (1.5 + S.beltLv * 1.3) * (im > 0.2 ? 2.2 : 1); S.spd += rate * dt; P.vz -= 12 * dt; if (Math.random() < dt * 8) emit(P.x, 0.5, P.z + 0.5, '#7af0a0', { vy: 2, life: 0.5, size: 0.08, spread: 1 }); if (Math.floor(T * 2) !== Math.floor((T - dt) * 2)) floaty(`+${(rate * 0.5).toFixed(1)} 속도`, P.x, P.y + 2.6, P.z, '#3ab86a', 0.7); }
  physics(P, dt);
  for (const b of BOTS) { b.stun = Math.max(0, b.stun - dt); b.inv = Math.max(0, b.inv - dt); botThink(b, dt); physics(b, dt); }
  raidT -= S.pets.length >= 3 ? dt : 0;
  stepGuards(dt); stepNests(dt, T); stepEvents(dt); stepEconomy(dt); stepMyBase(dt); lockToast -= dt;
  // 행동
  const c = findCtx();
  if (!c || c.key !== holdKey) { holdT = 0; holdKey = c ? c.key : ''; }
  ctx = c;
  const held = (actHeld || keys.has('KeyE') || keys.has('KeyF')) && !panelOpen();
  if (c && c.k !== 'none') {
    if (c.hold) { if (held) { holdT += dt; if (holdT >= c.hold) { doAction(c); holdT = 0; holdKey = ''; } } else holdT = 0; }
    else if (actEdge && !panelOpen()) doAction(c);
  }
  actEdge = jumpEdge = false;
  // 튜토리얼
  while (S.tut < TUT.length && TUT[S.tut].done()) { S.tut++; if (S.tut < TUT.length) snd('tap'); }
  // 그림
  for (const ch of CHARS) animChar(ch, dt, T);
  for (const o of OWN) syncBase(o, T);
  stepTrail(dt); stepParts(dt); stepCamera(dt);
  ring.position.set(P.x, (P.ground ? P.y : groundUnder(P)) + 0.04, P.z); ring.material.opacity = P.ground ? 0.0 : 0.55;
  const gt = tutTarget(); guide.visible = !!gt; if (gt) guide.position.set(gt[0], gt[1] + Math.sin(T * 4) * 0.3, gt[2]);
  for (const cl of clouds) { cl.a += cl.v * dt; cl.m.position.x = Math.cos(cl.a) * cl.r; cl.m.position.z = Math.sin(cl.a) * cl.r; }
  W.foam.material.opacity = 0.6 + Math.sin(T * 1.5) * 0.15;
  stepFloaties(dt);
  hudT -= dt; if (hudT <= 0) { hudT = 0.15; hud(); minimap(); }
  saveT -= dt; if (saveT <= 0) { saveT = 8; save(); window.BioGoal?.progress?.('bio-egg', Math.floor(income(true))); }
  ACT.update();
}
function groundUnder(c) { let f = 0; for (const k of colliders) if (k.top && Math.hypot(c.x - k.x, c.z - k.z) < k.r && c.y >= k.h - 0.4) f = Math.max(f, k.h); return f; }
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === 'play') update(dt);
  else { T += dt; const a = T * 0.05; camera.position.set(Math.cos(a) * 70, 42, Math.sin(a) * 70); camera.lookAt(0, 0, 0); stepGuards(dt); for (const o of OWN) syncBase(o, T); for (const ch of CHARS) animChar(ch, dt, T); stepParts(dt); sun.position.set(28, 60, 18); sun.target.position.set(0, 0, 0); }
  renderer.render(scene, camera);
  // 자동 화질
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT > 2) { const fps = fpsN / fpsAcc; fpsAcc = fpsN = fpsT = 0; if (prefs.q === 'auto') { if (fps < 40 && dpr > 0.75) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); } else if (fps < 28 && renderer.shadowMap.enabled && ++slowT > 2) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } else if (fps > 57 && dpr < Math.min(devicePixelRatio || 1, QMAX)) { dpr = Math.min(QMAX, dpr + 0.25); renderer.setPixelRatio(dpr); resize(); } } }
}

// ---------------------------------------------------------------- HUD
const ACT = {
  el: $('#bAct'), lab: $('#actLabel'), ringEl: $('#actRing'), last: '',
  update() {
    const c = ctx, txt = c ? c.label : '';
    if (txt !== this.last) { this.last = txt; this.lab.textContent = txt; this.lab.classList.toggle('show', !!txt); this.el.classList.toggle('dim', !c || c.k === 'none'); $('#actIcon').textContent = !c ? '✋' : { steal: '🥚', pick: '🥚', raid: '🐾', bonk: '👊', open: '💬', none: '✋' }[c.k]; }
    const p = c && c.hold ? holdT / c.hold : 0; this.ringEl.style.strokeDashoffset = String(176 * (1 - p));
  },
};
function hud() {
  $('#cash').textContent = fmt(S.cash);
  $('#inc').textContent = `+${fmt(income())}/초`;
  $('#spd').textContent = spdOf(S.spd).toFixed(1);
  $('#jmp').textContent = `${S.jumpLv}`;
  $('#bag').textContent = `${P.carry.length}/${bagCap()}`;
  $('#mult').textContent = S.reb ? `×${mult()}` : '';
  $('#mult').classList.toggle('hidden', !S.reb);
  const me = OWN[0]; $('#lockS').textContent = me.lockT > 0 ? `🔒 ${Math.ceil(me.lockT)}초` : '🔓 열림'; $('#lockS').classList.toggle('open', me.lockT <= 0);
  // 이벤트
  const ev = $('#event'); if (EV) { ev.classList.remove('hidden'); ev.innerHTML = `<b>${EV.E.name}</b> ${Math.ceil(EV.t)}초`; } else ev.classList.add('hidden');
  // 목표
  const td = $('#todo'); if (S.tut < TUT.length) { td.classList.remove('hidden'); td.innerHTML = `<i>${S.tut + 1}/${TUT.length}</i><b>${TUT[S.tut].t}</b><span>${TUT[S.tut].h}</span>`; } else td.classList.add('hidden');
  // 순위
  const rows = OWN.map((o) => ({ n: o.me ? '나' : o.name, c: o.col, v: o.me ? income(true) : (o.inc || 0) * 1, me: o.me })).sort((a, b) => b.v - a.v);
  $('#board').innerHTML = rows.map((r, i) => `<div class="${r.me ? 'me' : ''}"><i style="background:${r.c}"></i>${i + 1}. ${r.n}<b>${fmt(r.v)}/초</b></div>`).join('');
}
// 미니맵
const mm = $('#mini'), mg = mm.getContext('2d');
function minimap() {
  const S_ = mm.width, c = S_ / 2, k = (S_ / 2 - 4) / ISLAND;
  mg.clearRect(0, 0, S_, S_);
  mg.save(); mg.translate(c, c); mg.rotate(camYaw); // 화면 위 = 카메라 앞
  mg.beginPath(); mg.arc(0, 0, ISLAND * k, 0, 7); mg.fillStyle = '#a8dc80'; mg.fill();
  for (let i = 0; i < 4; i++) { mg.beginPath(); mg.arc(0, 0, ZONES[i].r1 * k, 0, 7); mg.fillStyle = ZONES[i].col; mg.fill(); }
  mg.beginPath(); mg.arc(0, 0, PLAZA * k, 0, 7); mg.fillStyle = '#f6eedf'; mg.fill();
  const W2 = (x, z) => [x * k, z * k];
  for (const o of OWN) { const [x, z] = W2(o.view.f.x, o.view.f.z); mg.save(); mg.translate(x, z); mg.rotate(-o.view.f.yaw); mg.fillStyle = o.col; mg.fillRect(-BASE_W * k, -BASE_D * k, BASE_W * 2 * k, BASE_D * 2 * k); if (o.lockT > 0) { mg.strokeStyle = '#3ac8ff'; mg.lineWidth = 2; mg.beginPath(); mg.arc(0, 0, 13 * k, 0, 7); mg.stroke(); } mg.restore(); }
  for (const n of nests) if (n.has) { const [x, z] = W2(n.x, n.z); mg.beginPath(); mg.arc(x, z, n.E.tier >= 3 ? 2.6 : 1.8, 0, 7); mg.fillStyle = n.E.col; mg.fill(); mg.lineWidth = 0.8; mg.strokeStyle = '#2a1a28'; mg.stroke(); }
  for (const r of RAIN) { const [x, z] = W2(r.x, r.z); mg.fillStyle = '#ffd84a'; mg.fillRect(x - 1.5, z - 1.5, 3, 3); }
  for (const g of GUARDS) { const [x, z] = W2(g.x, g.z); mg.beginPath(); mg.arc(x, z, 1.8, 0, 7); mg.fillStyle = g.st === 'chase' ? '#ff4a4a' : '#ffffff'; mg.fill(); }
  for (const b of BOTS) { const [x, z] = W2(b.x, b.z); mg.beginPath(); mg.arc(x, z, 2.4, 0, 7); mg.fillStyle = b.col; mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1; mg.stroke(); }
  const [px, pz] = W2(P.x, P.z); mg.translate(px, pz); mg.rotate(-camYaw); mg.beginPath(); mg.moveTo(0, -5); mg.lineTo(3.6, 3.5); mg.lineTo(-3.6, 3.5); mg.closePath(); mg.fillStyle = ME_COL; mg.fill(); mg.strokeStyle = '#fff'; mg.lineWidth = 1.5; mg.stroke();
  mg.restore();
}

// ---------------------------------------------------------------- 알림·떠오르는 글자
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; $('#toasts').prepend(t);
  while ($('#toasts').children.length > 4) $('#toasts').lastChild.remove();
  setTimeout(() => t.classList.add('out'), 3400); setTimeout(() => t.remove(), 3900);
}
const FL = [];
function floaty(text, x, y, z, col = '#2a1a28', life = 1.1) {
  const el = document.createElement('div'); el.className = 'floaty'; el.textContent = text; el.style.color = col; $('#floats').appendChild(el);
  FL.push({ el, x, y, z, life, max: life }); if (FL.length > 14) { FL[0].el.remove(); FL.shift(); }
}
function stepFloaties(dt) {
  for (let i = FL.length - 1; i >= 0; i--) {
    const f = FL[i]; f.life -= dt; f.y += dt * 1.2;
    if (f.life <= 0) { f.el.remove(); FL.splice(i, 1); continue; }
    _v.set(f.x, f.y, f.z).project(camera);
    if (_v.z > 1) { f.el.style.opacity = 0; continue; }
    f.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
    f.el.style.opacity = Math.min(1, f.life / f.max * 2.5);
  }
}

// ---------------------------------------------------------------- 생물 썸네일(3D 렌더 → 그림)
const TH = new Map(), thQ = [];
const thRT = new THREE.WebGLRenderTarget(160, 160, { samples: 4 }); thRT.texture.colorSpace = THREE.SRGBColorSpace;
const thScene = new THREE.Scene(); thScene.add(new THREE.HemisphereLight('#ffffff', '#b0a8c0', 1.8)); { const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(2, 4, 5); thScene.add(d); }
const thCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const thBuf = new Uint8Array(160 * 160 * 4), thCv = document.createElement('canvas'); thCv.width = thCv.height = 160; const thG = thCv.getContext('2d'), thImg = thG.createImageData(160, 160);
function thumb(id, mut = 'none', kind = 'pet') {
  const key = kind + id + mut; if (TH.has(key)) return TH.get(key);
  if (!thQ.some((q) => q.key === key)) thQ.push({ key, id, mut, kind });
  return '';
}
function renderThumb(q) {
  const m = q.kind === 'pet' ? petMesh(q.id, q.mut) : eggMesh(EGGBY[q.id]);
  if (q.mut === 'giant') m.scale.setScalar(1);
  const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  thScene.add(m); const r = Math.max(size.x, size.y, size.z) * 0.95;
  thCam.position.set(ctr.x + r * 1.1, ctr.y + r * 0.9, ctr.z + r * 2.6); thCam.lookAt(ctr);
  const prev = renderer.getRenderTarget(), bg = scene.background; renderer.setRenderTarget(thRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(thScene, thCam);
  renderer.readRenderTargetPixels(thRT, 0, 0, 160, 160, thBuf); renderer.setRenderTarget(prev);
  thScene.remove(m);
  for (let y = 0; y < 160; y++) thImg.data.set(thBuf.subarray((159 - y) * 640, (160 - y) * 640), y * 640);
  thG.putImageData(thImg, 0, 0); const url = thCv.toDataURL('image/png'); TH.set(q.key, url);
  for (const img of document.querySelectorAll(`img[data-th="${q.key}"]`)) img.src = url;
}
setInterval(() => { for (let i = 0; i < 2 && thQ.length; i++) renderThumb(thQ.shift()); }, 30);
const thImgTag = (id, mut = 'none', kind = 'pet', cls = '') => { const key = kind + id + mut, u = thumb(id, mut, kind); return `<img class="th ${cls}" data-th="${key}" src="${u || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}" alt="">`; };

// ---------------------------------------------------------------- 부화 카드
function hatchCard(pet, first) {
  const p = PETBY[pet.s], R = RAR[p.r], M = MUTBY[pet.m];
  const el = $('#hatch'); el.style.setProperty('--rc', R.col);
  el.innerHTML = `${thImgTag(pet.s, pet.m)}<div><small style="color:${R.col}">${R.name}${first ? ' · 새로 발견!' : ''}</small><b>${M.name ? `<em class="mut ${M.id}">${M.name}</em> ` : ''}${p.name} 탄생!</b><span>초당 +${fmt(petInc(pet) * mult())}</span></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(hatchCard.t); hatchCard.t = setTimeout(() => el.classList.remove('show'), 3600);
}

// ---------------------------------------------------------------- 패널
const petName = (p) => `${MUTBY[p.m].name ? `<em class="mut ${p.m}">${MUTBY[p.m].name}</em> ` : ''}${PETBY[p.s].name}`;
const stars = (n) => (n ? `<span class="stars">${'★'.repeat(n)}</span>` : '');
function petCard(p, extra = '') { const P_ = PETBY[p.s], R = RAR[P_.r]; return `<div class="pc" style="--rc:${R.col}">${thImgTag(p.s, p.m)}<div class="pi"><small style="color:${R.col}">${R.name}</small><b>${petName(p)}</b>${stars(p.st)}<span>+${fmt(petInc(p) * mult())}/초</span></div>${extra}</div>`; }
let panelKind = '';
function openPanel(kind) {
  panelKind = kind; snd('tap');
  const el = $('#panel'); el.classList.remove('hidden'); renderPanel();
  window.ILOG?.game?.('패널', kind);
}
function closePanel() { $('#panel').classList.add('hidden'); panelKind = ''; }
$('#panel').addEventListener('pointerdown', (e) => { if (e.target.id === 'panel') closePanel(); });
function renderPanel() {
  const k = panelKind, box = $('#pbox');
  let h = '';
  const head = (t, sub = '') => `<header><h2>${t}</h2>${sub ? `<p>${sub}</p>` : ''}<button class="x" data-a="close">✕</button></header>`;
  if (k === 'pets') {
    const list = [...S.pets].sort((a, b) => petInc(b) - petInc(a));
    h = head('🐾 내 생물', `우리 ${S.pets.length}/${penCap()}칸 · 초당 수입 ${fmt(income())}`) + `<div class="grid">${list.map((p) => petCard(p)).join('') || '<p class="empty">아직 생물이 없어요. 알을 훔쳐 와서 부화시켜요!</p>'}</div><p class="hint">팔기는 광장의 💰 판매대, 합치기는 🧬 융합기에서 할 수 있어요.</p>`;
  } else if (k === 'shop') {
    h = head('⬆️ 업그레이드', `가진 돈 ${fmt(S.cash)}`) + '<div class="list">' + Object.entries(SHOP).map(([id, s]) => {
      const lv = S[id + 'Lv'], max = lv >= s.max, cost = lv2cost(id, lv);
      const val = { jump: `최고 높이 ${jumpH(lv).toFixed(1)}m${max ? '' : ` → ${jumpH(lv + 1).toFixed(1)}m`}`, bag: `${1 + lv}개${max ? '' : ` → ${2 + lv}개`}`, incu: `${1 + lv}대${max ? '' : ` → ${2 + lv}대`}`, pen: `${penCap()}칸${max ? '' : ` → ${Math.min(36, penCap() + 1)}칸`}`, belt: `초당 ${(1.5 + lv * 1.3).toFixed(1)}${max ? '' : ` → ${(1.5 + (lv + 1) * 1.3).toFixed(1)}`} 속도 점수` }[id];
      return `<div class="row"><div><b>${s.name} <i>Lv.${lv}</i></b><span>${s.desc}</span><small>${val}</small></div><button data-a="buy" data-k="${id}" ${max || S.cash < cost ? 'disabled' : ''}>${max ? '최고' : '💰 ' + fmt(cost)}</button></div>`;
    }).join('') + '</div>';
  } else if (k === 'fuse') {
    const groups = {}; for (const p of S.pets) { if (p.st >= 5) continue; const g = p.s + ':' + p.st; (groups[g] ||= []).push(p); }
    const ok = Object.values(groups).filter((g) => g.length >= 3).sort((a, b) => petInc(b[0]) - petInc(a[0]));
    h = head('🧬 융합기', '같은 생물 3마리(같은 별 수) → 별 +1 (수입 2배). 가장 좋은 돌연변이를 이어받고, 15% 확률로 한 단계 더 좋아져요.') +
      `<div class="list">${ok.map((g) => { const best = g.reduce((a, b) => (MUTBY[b.m].mul > MUTBY[a.m].mul ? b : a)); return `<div class="row">${thImgTag(best.s, best.m)}<div><b>${PETBY[best.s].name} ${stars(best.st) || '☆'}</b><span>${g.length}마리 있음 → ★${best.st + 1} 1마리</span></div><button data-a="fuse" data-k="${best.s}:${best.st}">융합</button></div>`; }).join('') || '<p class="empty">같은 생물이 3마리 모이면 합칠 수 있어요.</p>'}</div>`;
  } else if (k === 'trail') {
    h = head('✨ 트레일 상점', '달릴 때 뒤에 남는 자국. 사면 이동 속도가 올라요!') + '<div class="list">' + TRAILS.map((t) => {
      const own = S.trails.includes(t.id), on = S.trail === t.id;
      return `<div class="row"><span class="sw">${(t.col || ['#ddd']).map((c) => `<i style="background:${c}"></i>`).join('')}</span><div><b>${t.name}</b><span>${t.spd ? `속도 +${Math.round(t.spd * 100)}%` : '기본'}</span></div><button data-a="trail" data-k="${t.id}" ${!own && S.cash < t.cost ? 'disabled' : ''} class="${on ? 'on' : ''}">${on ? '사용 중' : own ? '쓰기' : '💰 ' + fmt(t.cost)}</button></div>`;
    }).join('') + '</div>';
  } else if (k === 'sell') {
    const list = [...S.pets].sort((a, b) => petInc(a) - petInc(b));
    h = head('💰 판매대', `생물을 팔면 초당 수입의 30배를 받아요. 가진 돈 ${fmt(S.cash)}`) + `<div class="grid">${list.map((p) => petCard(p, `<button data-a="sell" data-k="${p.id}">💰 ${fmt(petInc(p) * mult() * 30)}</button>`)).join('') || '<p class="empty">팔 생물이 없어요.</p>'}</div>`;
  } else if (k === 'rebirth') {
    const cost = rebirthCost(S.reb);
    h = head('🔁 환생 DNA 탑', `지금 ${S.reb}번 환생 · 수입 ×${mult()}`) + `<div class="reb"><p>환생하면 <b>돈 · 속도 점수 · 점프력 · 러닝 벨트 레벨</b>이 처음으로 돌아가요.</p><p>대신 <b>생물·우리·부화기·가방·트레일은 그대로</b>이고,</p><ul><li>모든 수입 <b>×${mult()} → ×${mult() + 0.5}</b></li><li>우리 칸 <b>+2</b></li><li>잠금 시간 <b>+10초</b></li></ul><button data-a="rebirth" ${S.cash < cost ? 'disabled' : ''}>💰 ${fmt(cost)} 내고 환생하기</button></div>`;
  } else if (k === 'codex') {
    const found = Object.keys(S.codex).length;
    h = head('📖 생물 도감', `${found}/${PETS.length}종 발견`) + EGGS.map((E) => `<h3><span class="eg" style="background:${E.col}"></span>${E.name} <small>부화 ${E.hatch}초${E.jump ? ` · 점프 Lv.${E.jump}` : ''}</small></h3><p class="fact">${E.fact}</p><div class="grid cx">${PETS.filter((p) => p.egg === E.id).map((p) => { const c = S.codex[p.id], R = RAR[p.r]; return c ? `<div class="pc" style="--rc:${R.col}">${thImgTag(p.id)}<div class="pi"><small style="color:${R.col}">${R.name} · 기본 +${fmt(p.inc)}/초</small><b>${p.name}</b><span class="muts">${MUTS.slice(1).map((m) => `<i class="mut ${m.id} ${c.includes(m.id) ? '' : 'no'}" title="${m.name}">${m.name[0]}</i>`).join('')}</span><p>${p.fact}</p></div></div>` : `<div class="pc unk"><div class="q">?</div><div class="pi"><small style="color:${R.col}">${R.name}</small><b>???</b><p>${E.name}에서 나와요.</p></div></div>`; }).join('')}</div>`).join('') + `<h3>🧪 돌연변이</h3><div class="list">${MUTS.slice(1).map((m) => `<div class="row"><i class="mut ${m.id}">${m.name}</i><div><b>수입 ×${m.mul}</b><span>${m.fact} (확률 ${+(m.p * 100).toFixed(1)}%)</span></div></div>`).join('')}</div>`;
  } else if (k === 'settings') {
    h = head('⚙️ 설정') + `<div class="list"><div class="row"><div><b>화질</b><span>느리면 '낮음'을 골라요.</span></div><div class="seg" id="sQ">${['auto:자동', 'low:낮음', 'high:높음'].map((s) => { const [v, n] = s.split(':'); return `<button data-a="q" data-k="${v}" class="${prefs.q === v ? 'on' : ''}">${n}</button>`; }).join('')}</div></div>
      <div class="row"><div><b>소리</b></div><button data-a="snd" class="${prefs.snd ? 'on' : ''}">${prefs.snd ? '켜짐' : '꺼짐'}</button></div>
      <div class="row"><div><b>조작법</b><span>${touchUI ? '왼쪽 화면을 끌어 이동 · 오른쪽 화면을 끌어 시점 · ✋ 꾹 누르기 = 훔치기/열기 · ⤒ = 점프' : 'WASD/방향키 이동 · 마우스 끌기 시점 · 휠 확대 · Space 점프 · E 꾹 = 훔치기/열기 · Esc 닫기'}</span></div></div>
      <div class="row"><div><b>처음부터 하기</b><span>모든 기록이 지워져요.</span></div><button data-a="reset" class="danger">초기화</button></div></div>`;
  } else if (k === 'help') {
    h = head('❓ 게임 방법') + `<div class="help"><p>🥚 <b>알 훔치기</b> — 섬 곳곳 둥지의 알을 꾹 눌러 훔쳐요. 안쪽 구역일수록 희귀한 알이에요.</p><p>🛡️ <b>경비 세포</b> — 알을 든 도둑을 쫓아와요. 닿으면 기절하고 알이 둥지로 돌아가요. 받침대 위로 피하거나 빨리 달려 따돌려요.</p><p>🐣 <b>부화</b> — 기지로 가져가면 부화기에서 생물이 깨어나요. 운이 좋으면 돌연변이(알비노·흑색증·형광·거대화·키메라)!</p><p>💰 <b>수입</b> — 생물이 초마다 돈을 벌어 노란 발판에 쌓여요. 밟아서 모아요.</p><p>🏃 <b>속도</b> — 광장 러닝 벨트에서 달리면 영원히 빨라져요(환생 전까지). 트레일도 속도를 올려요.</p><p>🐾 <b>습격</b> — 다른 연구원 기지의 생물을 훔칠 수 있어요. 반대로 내 기지도 노려요! 잠금 버튼으로 방어막을 켜고, 침입자는 때려서 막아요.</p><p>🧬 <b>융합 · 🔁 환생</b> — 같은 생물 3마리를 합쳐 별을 올리고, 돈이 모이면 환생해 수입 배율을 올려요.</p></div>`;
  }
  box.innerHTML = h;
  box.dataset.kind = k;
}
$('#pbox').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  const a = b.dataset.a, k = b.dataset.k;
  if (a === 'close') return closePanel();
  if (a === 'buy') { const lv = S[k + 'Lv'], cost = lv2cost(k, lv); if (lv >= SHOP[k].max || S.cash < cost) return; S.cash -= cost; S[k + 'Lv']++; snd('buy'); toast(`${SHOP[k].name} Lv.${S[k + 'Lv']}!`); window.ILOG?.game?.('업그레이드', SHOP[k].name); }
  if (a === 'trail') { const t = TRAILBY[k]; if (!S.trails.includes(k)) { if (S.cash < t.cost) return; S.cash -= t.cost; S.trails.push(k); snd('buy'); toast(`✨ ${t.name} 트레일을 샀어요!`); } S.trail = k; }
  if (a === 'sell') { const i = S.pets.findIndex((p) => String(p.id) === k); if (i < 0) return; const p = S.pets[i], v = Math.floor(petInc(p) * mult() * 30); S.pets.splice(i, 1); S.cash += v; snd('coin'); toast(`${PETBY[p.s].name}을(를) ${fmt(v)}에 팔았어요.`); }
  if (a === 'fuse') {
    const [s, st] = k.split(':'), g = S.pets.filter((p) => p.s === s && p.st === +st); if (g.length < 3) return;
    g.sort((a_, b_) => MUTBY[b_.m].mul - MUTBY[a_.m].mul); const use = [g[0], g[g.length - 1], g[g.length - 2]];
    let mi = MUTS.findIndex((m) => m.id === g[0].m); if (rnd() < 0.15 && mi < MUTS.length - 1) mi++;
    for (const u of use) S.pets.splice(S.pets.indexOf(u), 1);
    const np = { id: S.nid++, s, m: MUTS[mi].id, st: +st + 1 }; S.pets.push(np);
    const cx = (S.codex[s] ||= []); if (!cx.includes(np.m)) cx.push(np.m);
    snd('hatch'); const fm = machines.find((m) => m.id === 'fuse'); burst(fm.x, 2.5, fm.z, ['#e8a0ff', '#ffd84a', '#ffffff'], 30, { spread: 7, vy: 7 });
    hatchCard(np, false); window.ILOG?.game?.('융합', `${PETBY[s].name} ★${np.st}`);
  }
  if (a === 'rebirth') { const cost = rebirthCost(S.reb); if (S.cash < cost) return; Object.assign(S, { cash: START.cash, spd: 0, jumpLv: 0, beltLv: 0, reb: S.reb + 1 }); snd('event'); toast(`🔁 환생 완료! 이제 수입 ×${mult()}`, 'event'); burst(0, 4, 0, ['#ff6a8a', '#5a8aff', '#ffd84a'], 40, { spread: 9, vy: 9 }); save(); window.ILOG?.game?.('환생', String(S.reb)); }
  if (a === 'q') { prefs.q = k; savePrefs(); save(); location.reload(); return; }
  if (a === 'snd') { prefs.snd = !prefs.snd; savePrefs(); }
  if (a === 'reset') { if (!confirm('정말 처음부터 할까요? 모든 생물과 돈이 사라져요.')) return; try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); return; }
  renderPanel(); hud();
});
for (const b of document.querySelectorAll('#menu [data-p]')) b.addEventListener('click', () => (panelKind === b.dataset.p ? closePanel() : openPanel(b.dataset.p)));

// ---------------------------------------------------------------- 시작 화면
function start() {
  if (mode === 'play') return;
  mode = 'play'; $('#title').classList.add('hidden'); $('#hud').classList.remove('hidden');
  camYaw = OWN[0].view.f.yaw + Math.PI; camT.set(P.x, 1.4, P.z);
  snd('tap');
  if (hadSave) {
    const away = Math.min(7200, (Date.now() - (S.t || Date.now())) / 1000);
    if (away > 30) { const earn = income(true) * away * 0.5; S.pad += earn; for (const it of S.incu) if (it) it.t = Math.max(0, it.t - away); if (earn >= 1) toast(`😴 자리를 비운 동안 ${fmt(earn)}을(를) 벌었어요! 돈 발판에서 받아요.`); }
  } else setTimeout(() => { if (!panelOpen()) openPanel('help'); }, 400);
  window.BioGoal?.show?.('bio-egg');
}
$('#bStart').addEventListener('click', start);
$('#bStart').textContent = hadSave ? '▶ 이어하기' : '▶ 모험 시작';
if (hadSave) $('#tStat').innerHTML = `생물 <b>${S.pets.length}</b>마리 · 초당 <b>${fmt(income(true))}</b> · 환생 <b>${S.reb}</b>번`;
addEventListener('keydown', (e) => { if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) start(); });
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') save(); });
$('#loading').classList.add('hidden'); $('#title').classList.remove('hidden');
requestAnimationFrame(frame);
window.BIOEGG = { S, P, BOTS, GUARDS, nests, OWN, scene, renderer, camera, start, openPanel, closePanel, income, setCam: (y, p, d) => { camYaw = y; camPitch = p ?? camPitch; camDist = d ?? camDist; }, update, frameOnce: (dt = 1 / 30) => { update(dt); renderer.render(scene, camera); }, act: (v) => { actHeld = v; if (v) actEdge = true; }, jump: () => { jumpEdge = true; }, sim: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) update(dt); }, ctx: () => ctx, RAIN, machines, get EV() { return EV; }, setEV: (id) => { evNext = 0; } };

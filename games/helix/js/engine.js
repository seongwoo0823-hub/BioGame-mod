// 헬릭스 엔진: 화면, 에셋 로딩, 입력(키보드·마우스·터치·게임패드), 카메라, 입자, 공용 그리기
'use strict';
const VW = 960, VH = 540, K = 0.625, TS = 48;   // K: 바닥 눌림 비율(월드 z → 화면 y), TS: 타일 크기(월드)
const cv = document.getElementById('game'), ctx = cv.getContext('2d', {alpha: false});
ctx.imageSmoothingEnabled = false;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angTo = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);
// 8방향: 0=남(화면 아래), 2=동, 4=북, 6=서
const dir8 = ang => ((Math.round((Math.PI / 2 - ang) / (Math.PI / 4)) % 8) + 8) % 8;
const dirVec = d => { const a = Math.PI / 2 - d * Math.PI / 4; return [Math.cos(a), Math.sin(a)]; };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------- 화면 맞춤 (정수 배율 우선, 남는 공간은 검은 띠)
let SCALE = 1;
function resize() {
  const w = innerWidth, h = innerHeight;
  const s = Math.min(w / VW, h / VH);
  SCALE = s >= 1 ? (s >= 2 && Math.abs(s - Math.round(s)) < 0.15 ? Math.round(s) : s) : s;
  cv.width = VW; cv.height = VH;
  cv.style.width = Math.floor(VW * SCALE) + 'px'; cv.style.height = Math.floor(VH * SCALE) + 'px';
  ctx.imageSmoothingEnabled = false;
  const ui = document.getElementById('ui'); ui.style.width = cv.style.width; ui.style.height = cv.style.height;
  ui.style.setProperty('--s', Math.min(SCALE, 2.2));
}
addEventListener('resize', resize);

// ---------------- 에셋
const IMG = {}, JS = {};
let loadDone = 0, loadTotal = 0;
function loadImg(key, url) {
  if (IMG[key]) return Promise.resolve(IMG[key]);
  loadTotal++;
  return new Promise(ok => { const i = new Image(); i.onload = () => { IMG[key] = i; loadDone++; ok(i); }; i.onerror = () => { console.warn('불러오기 실패', url); loadDone++; ok(null); }; i.src = url; });
}
async function loadJSON(key, url) { if (JS[key]) return JS[key]; const r = await fetch(url); JS[key] = await r.json(); return JS[key]; }

// ---------------- 입력
const INPUT = {
  keys: new Set(), down: new Set(), mouse: {x: VW / 2, y: VH / 2, l: false, r: false, moved: 0}, touch: {active: false, mx: 0, my: 0, id: null},
  pad: null, padPrev: {}, lastDevice: 'kb', aimAng: Math.PI / 2,
};
const KEYMAP = {
  attack: ['j', 'mouse0'], special: ['k', 'mouse2'], cast: ['q', 'i'], dash: [' ', 'shift'], leap: ['r', 'l'], ult: ['f', 'u'], interact: ['e', 'enter'],
  pause: ['escape', 'p'], up: ['w', 'arrowup'], down: ['s', 'arrowdown'], left: ['a', 'arrowleft'], right: ['d', 'arrowright'], codex: ['tab'],
};
const pressed = new Set();   // 이번 프레임에 눌린 동작
function press(act) { pressed.add(act); }
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); INPUT.lastDevice = 'kb';
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
  if (!e.repeat) for (const a in KEYMAP) if (KEYMAP[a].includes(k)) press(a);
  INPUT.keys.add(k);
});
addEventListener('keyup', e => INPUT.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { INPUT.keys.clear(); INPUT.mouse.l = INPUT.mouse.r = false; });
function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH]; }
cv.addEventListener('mousemove', e => { [INPUT.mouse.x, INPUT.mouse.y] = toLogical(e); INPUT.mouse.moved = performance.now(); INPUT.lastDevice = 'kb'; });
cv.addEventListener('mousedown', e => {
  if (e.pointerType === 'touch') return;
  [INPUT.mouse.x, INPUT.mouse.y] = toLogical(e); INPUT.lastDevice = 'kb';
  if (e.button === 0) { INPUT.mouse.l = true; press('attack'); }
  if (e.button === 2) { INPUT.mouse.r = true; press('special'); }
});
addEventListener('mouseup', e => { if (e.button === 0) INPUT.mouse.l = false; if (e.button === 2) INPUT.mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
function held(act) {
  for (const k of KEYMAP[act]) { if (k === 'mouse0' && INPUT.mouse.l) return true; if (k === 'mouse2' && INPUT.mouse.r) return true; if (INPUT.keys.has(k)) return true; }
  if (INPUT.touchHeld && INPUT.touchHeld.has(act)) return true;
  const p = INPUT.pad; if (p && PADMAP[act] !== undefined && p.buttons[PADMAP[act]] && p.buttons[PADMAP[act]].pressed) return true;
  return false;
}
// 게임패드 (표준 배치)
const PADMAP = {attack: 2, special: 3, cast: 1, dash: 0, leap: 5, ult: 4, interact: 7, pause: 9, codex: 8};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []; let p = null;
  for (const g of pads) if (g && g.connected) { p = g; break; }
  INPUT.pad = p; if (!p) return;
  for (const a in PADMAP) {
    const b = p.buttons[PADMAP[a]]; const now = !!(b && b.pressed);
    if (now && !INPUT.padPrev[a]) { press(a); INPUT.lastDevice = 'pad'; }
    INPUT.padPrev[a] = now;
  }
  // 십자키로도 메뉴 이동
  const dp = {up: 12, down: 13, left: 14, right: 15};
  for (const a in dp) { const now = !!(p.buttons[dp[a]] && p.buttons[dp[a]].pressed); if (now && !INPUT.padPrev['d' + a]) press('nav_' + a); INPUT.padPrev['d' + a] = now; }
  if (Math.hypot(p.axes[0], p.axes[1]) > 0.3 || Math.hypot(p.axes[2] || 0, p.axes[3] || 0) > 0.3) INPUT.lastDevice = 'pad';
}
function moveVec() {
  let x = 0, y = 0;
  if (held('left')) x -= 1; if (held('right')) x += 1; if (held('up')) y -= 1; if (held('down')) y += 1;
  if (INPUT.pad) { const ax = INPUT.pad.axes[0], ay = INPUT.pad.axes[1]; if (Math.hypot(ax, ay) > 0.22) { x = ax; y = ay; } }
  if (INPUT.touch.active) { x = INPUT.touch.mx; y = INPUT.touch.my; }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return [x, y];
}
// 터치: 왼쪽 반은 가상 조이스틱, 버튼은 화면 요소
function setupTouch() {
  const zone = document.getElementById('stick'), knob = document.getElementById('knob');
  let cx = 0, cy = 0;
  const upd = (e, t) => { const r = zone.getBoundingClientRect(); let dx = t.clientX - cx, dy = t.clientY - cy; const R = r.width * 0.42, l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; INPUT.touch.mx = dx / R; INPUT.touch.my = dy / R; };
  zone.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; const r = zone.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; INPUT.touch.active = true; INPUT.touch.id = t.identifier; INPUT.lastDevice = 'touch'; upd(e, t); }, {passive: false});
  zone.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === INPUT.touch.id) upd(e, t); }, {passive: false});
  const end = e => { for (const t of e.changedTouches) if (t.identifier === INPUT.touch.id) { INPUT.touch.active = false; INPUT.touch.mx = INPUT.touch.my = 0; knob.style.transform = ''; } };
  zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
  INPUT.touchHeld = new Set();
  document.querySelectorAll('[data-act]').forEach(b => {
    const a = b.dataset.act;
    b.addEventListener('touchstart', e => { e.preventDefault(); INPUT.lastDevice = 'touch'; press(a); INPUT.touchHeld.add(a); b.classList.add('on'); }, {passive: false});
    const off = e => { e.preventDefault(); INPUT.touchHeld.delete(a); b.classList.remove('on'); };
    b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
  });
  addEventListener('touchstart', () => { if (INPUT.lastDevice !== 'touch') { INPUT.lastDevice = 'touch'; document.body.classList.add('touch'); } }, {passive: true});
}

// ---------------- 카메라
const CAM = {x: 0, y: 0, tx: 0, ty: 0, shake: 0, sx: 0, sy: 0, zoom: 1, punch: 0};
function shake(a) { CAM.shake = Math.max(CAM.shake, a * (window.SETTINGS ? SETTINGS.shake : 1)); }
function camUpdate(dt, bounds) {
  CAM.x += (CAM.tx - CAM.x) * (1 - Math.exp(-dt * 7)); CAM.y += (CAM.ty - CAM.y) * (1 - Math.exp(-dt * 7));
  if (bounds) { CAM.x = clamp(CAM.x, bounds[0], Math.max(bounds[0], bounds[2] - VW)); CAM.y = clamp(CAM.y, bounds[1], Math.max(bounds[1], bounds[3] - VH)); }
  CAM.shake *= Math.exp(-dt * 10); if (CAM.shake < 0.2) CAM.shake = 0;
  CAM.sx = (Math.random() * 2 - 1) * CAM.shake; CAM.sy = (Math.random() * 2 - 1) * CAM.shake;
}
const camX = () => Math.round(CAM.x + CAM.sx), camY = () => Math.round(CAM.y + CAM.sy);
// 월드 → 화면
const SX = x => Math.round(x) - camX(), SY = (z, h = 0) => Math.round(z * K - h) - camY();

// ---------------- 입자 · 떠오르는 글자
const PARTS = [], TEXTS = [];
function burst(x, z, h, col, n, spd = 160, life = 0.5, size = 2, grav = 300) {
  if (PARTS.length > 600) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = spd * (0.3 + Math.random() * 0.7);
    PARTS.push({x, z, h, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vh: rand(40, 220), col: Array.isArray(col) ? pick(col) : col, t: 0, life: life * rand(0.6, 1.2), size, grav});
  }
}
function floatText(x, z, h, text, col, big = false) { TEXTS.push({x: x + rand(-8, 8), z, h, text, col, t: 0, big}); }
function updParts(dt) {
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i]; p.t += dt; if (p.t > p.life) { PARTS.splice(i, 1); continue; }
    p.x += p.vx * dt; p.z += p.vz * dt; p.h += p.vh * dt; p.vh -= p.grav * dt; p.vx *= 0.96; p.vz *= 0.96;
    if (p.h < 0) { p.h = 0; p.vh *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
  }
  for (let i = TEXTS.length - 1; i >= 0; i--) { const t = TEXTS[i]; t.t += dt; t.h += dt * 40; if (t.t > 0.9) TEXTS.splice(i, 1); }
}
function drawParts() {
  for (const p of PARTS) {
    const a = 1 - p.t / p.life; ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = p.col;
    ctx.fillRect(SX(p.x) - (p.size >> 1), SY(p.z, p.h) - (p.size >> 1), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of TEXTS) {
    const a = t.t < 0.6 ? 1 : 1 - (t.t - 0.6) / 0.3; const pop = t.t < 0.08 ? 1 + (0.08 - t.t) * 6 : 1;
    ctx.globalAlpha = a; ctx.font = `bold ${Math.round((t.big ? 20 : 14) * pop)}px "Galmuri11", system-ui, sans-serif`;
    const x = SX(t.x), y = SY(t.z, t.h + 70);
    ctx.fillStyle = '#05040a'; ctx.fillText(t.text, x + 1, y + 1); ctx.fillText(t.text, x - 1, y + 1); ctx.fillStyle = t.col; ctx.fillText(t.text, x, y);
  }
  ctx.globalAlpha = 1;
}

// ---------------- 스프라이트 그리기 + 피격 번쩍임
const flashCv = document.createElement('canvas'), flashCtx = flashCv.getContext('2d');
function drawFrame(img, sx, sy, w, h, dx, dy, flash = 0, alpha = 1) {
  if (!img) return;
  if (flash > 0) {
    if (flashCv.width < w || flashCv.height < h) { flashCv.width = Math.max(flashCv.width, w); flashCv.height = Math.max(flashCv.height, h); }
    flashCtx.globalCompositeOperation = 'source-over'; flashCtx.clearRect(0, 0, w, h); flashCtx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    flashCtx.globalCompositeOperation = 'source-atop'; flashCtx.fillStyle = `rgba(255,255,255,${flash})`; flashCtx.fillRect(0, 0, w, h);
    ctx.globalAlpha = alpha; ctx.drawImage(flashCv, 0, 0, w, h, dx, dy, w, h); ctx.globalAlpha = 1; return;
  }
  ctx.globalAlpha = alpha; ctx.drawImage(img, sx, sy, w, h, dx, dy, w, h); ctx.globalAlpha = 1;
}
function shadow(x, z, rx, a = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(SX(x), SY(z), rx, rx * 0.45, 0, 0, TAU); ctx.fill();
}
// 아이콘 시트에서 아이콘 하나
function icon(name, dx, dy, size = 32) {
  const I = JS.icons, im = IMG.icons; if (!I || !im) return; const i = I.index[name]; if (i === undefined) return;
  const S = I.size, c = i % I.cols, r = Math.floor(i / I.cols);
  ctx.drawImage(im, c * S, r * S, S, S, Math.round(dx), Math.round(dy), size, size);
}
function iconURL(name) {   // 메뉴(HTML)용 아이콘 데이터 주소 (한 번 만들어 보관)
  iconURL.c = iconURL.c || {}; if (iconURL.c[name]) return iconURL.c[name];
  const I = JS.icons, im = IMG.icons; if (!I || !im || I.index[name] === undefined) return '';
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const i = I.index[name];
  x.drawImage(im, (i % I.cols) * 32, Math.floor(i / I.cols) * 32, 32, 32, 0, 0, 32, 32);
  return iconURL.c[name] = c.toDataURL();
}

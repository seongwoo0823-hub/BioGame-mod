// BIO KART RACING - game shell: screens, race flow, camera, HUD, results
import * as THREE from 'three';
import { loadManifest, list, thumb, icon, load, preload, byId } from './assets.js';
import { TRACKS, Track, THEMES, THEME_ORDER } from './track.js';
import { makeSkyDome, groundTexture, Ambient, skyCanvas } from './sky.js';
import { Kart, PHYS } from './kart.js';
import { AIDriver } from './ai.js';
import { ItemSystem, ITEMS, rollItem } from './items.js';
import { FX } from './fx.js';
import { Audio } from './audio.js';

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('biokart_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem('biokart_' + k, JSON.stringify(v)); } catch {} } };
const settings = Object.assign({ music: 0.5, sfx: 0.8, shadow: true, mirror: true, lines: true }, store.get('settings', {}));
const fmt = t => { if (!isFinite(t) || t <= 0) return '--:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`; };
const AI_NAMES = ['미토', '리보', '골지', '엔자임', '뉴클레오', '사이토', '플라즈마', '리소좀', '크로마틴', '펩티드'];
const COLORS = [0xff9a1f, 0x40e8ff, 0x7dff5a, 0xff5ae0, 0xffe14a, 0xa070ff, 0xff4d4d, 0x3dd6a8];

// ------------------------------------------------------------------ renderer / scenes
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = settings.shadow; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.domElement.id = 'game'; document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 1500);
const rearCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function skyTexture(cols) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, cols[0]); gr.addColorStop(0.55, cols[1]); gr.addColorStop(1, cols[2]); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function lights(scene, th = THEMES.garden) {
  scene.add(new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]));
  const sun = new THREE.DirectionalLight(th.sun, th.sunI); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 160 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target); return sun;
}
// menu / garage showroom scene
const menu = { scene: new THREE.Scene(), turn: new THREE.Group(), combo: null, kartObj: null, t: 0 };
menu.scene.background = skyTexture(['#2f6fff', '#8cc4ff', '#e8f4ff']); menu.scene.add(makeSkyDome(THEMES.garden.sky)); lights(menu.scene);
menu.scene.add(menu.turn);
{ const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.4, 48), new THREE.MeshStandardMaterial({ color: 0x2a3060, metalness: 0.3, roughness: 0.4 }));
  disc.position.y = -0.2; disc.receiveShadow = true; menu.scene.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: 0x7dff5a })); ring.rotation.x = Math.PI / 2; menu.scene.add(ring);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshStandardMaterial({ color: 0x86d39c })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true; menu.scene.add(ground); }

// ------------------------------------------------------------------ world / events
const events = { h: {}, on(n, f) { (this.h[n] ||= []).push(f); }, emit(n, ...a) { (this.h[n] || []).forEach(f => f(...a)); } };
const audio = new Audio(); audio.setVolumes(settings.music, settings.sfx);
const world = { scene: null, track: null, fx: null, events, items: null };
const race = { state: 'menu', mode: 'speed', trackIdx: 0, karts: [], ais: [], player: null, t: 0, countdown: 0, finishT: 0, camMode: 0, skill: 0.95, best: {} };
let combo = Object.assign({ kart: 'K01_LeafRacer', driver: 'C01_Chloe_GreenCell', pet: 'P01_Moeba_Amoeba', balloon: 'B01_Heart' }, store.get('combo', {}));

// ------------------------------------------------------------------ screens
let screen = 'title', garageReturn = 'title';
const MENU_SCREENS = ['title', 'modes', 'tracks', 'garage', 'settings', 'help', 'lobby'];
function show(name) {
  if (screen === 'lobby' && name !== 'lobby') stopLobby();
  screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === name));
  $('hud').classList.toggle('on', ['race', 'pause'].includes(name));
  if (name === 'garage') renderGarage();
  if (name === 'tracks') renderTracks();
  if (name === 'lobby') enterLobby();
  if (MENU_SCREENS.includes(name)) { renderer.toneMappingExposure = 1.05; if (!audio.bgmOn || audio.kind !== 'menu') audio.startMusic('menu'); setMenuCombo(); }
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { audio.init(); audio.play('click'); if (b.dataset.go === 'garage' || b.dataset.go === 'settings') garageReturn = screen; show(b.dataset.go); }));
$('garageBack').onclick = () => { audio.play('click'); show(garageReturn); };
$('setBack').onclick = () => { audio.play('click'); show(garageReturn === 'lobby' ? 'lobby' : 'title'); };
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { audio.play('select'); race.mode = b.dataset.mode; show('lobby'); });
document.querySelectorAll('[data-gtab]').forEach(b => b.onclick = () => { audio.play('click'); gTab = b.dataset.gtab; garageReturn = 'lobby'; show('garage'); });
addEventListener('pointerdown', () => audio.init(), { once: true });
race.trackIdx = Math.min(TRACKS.length - 1, store.get('trackIdx', 0));

// ------------------------------------------------------------------ track picker (5 themes x 4 tracks)
let pickTheme = TRACKS[race.trackIdx].theme;
function renderTracks() {
  $('modeLabel').textContent = { speed: '· 스피드전', item: '· 아이템전', time: '· 타임어택' }[race.mode];
  $('themeTabs').innerHTML = THEME_ORDER.map(k => `<button class="${k === pickTheme ? 'on' : ''}" data-k="${k}">${THEMES[k].icon} ${THEMES[k].name}</button>`).join('');
  $('themeTabs').querySelectorAll('button').forEach(b => b.onclick = () => { pickTheme = b.dataset.k; audio.play('click'); renderTracks(); });
  const list = TRACKS.map((t, i) => [t, i]).filter(([t]) => t.theme === pickTheme);
  $('trackList').innerHTML = list.map(([t, i]) => `<button class="track ${i === race.trackIdx ? 'on' : ''}" data-t="${i}"><canvas width="280" height="160"></canvas>
    <b>${t.name}<span class="tbadge" style="background:${THEMES[t.theme].color}">${THEMES[t.theme].en}</span></b><span class="stars">${'★'.repeat(t.diff)}${'☆'.repeat(3 - t.diff)}</span>
    <small>${t.desc}<br>길이 <span class="len">…</span> · 최고 기록: ${fmt(store.get('best_' + t.id + '_' + race.mode, 0))}</small></button>`).join('');
  $('trackList').querySelectorAll('.track').forEach(b => {
    const i = +b.dataset.t;
    b.onclick = () => { race.trackIdx = i; store.set('trackIdx', i); audio.play('click'); renderTracks(); };
    b.ondblclick = () => show('lobby');
    setTimeout(() => { const tr = trackObj(i); drawTrackPreview(b.querySelector('canvas'), tr); b.querySelector('.len').textContent = Math.round(tr.L) + 'm'; }, 0);
  });
}
$('trackOk').onclick = () => { audio.play('select'); show('lobby'); };
const trackCache = {};
const trackObj = i => (trackCache[i] ||= new Track(TRACKS[i]));
/** themed preview: sky painting + track outline */
function drawTrackPreview(cv, tr) {
  const g = cv.getContext('2d'), th = tr.theme, sc = skyCanvas(th.sky);
  g.drawImage(sc, 0, sc.height * 0.02, sc.width * 0.3, sc.height * 0.42, 0, 0, cv.width, cv.height);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, cv.height * 0.55, cv.width, cv.height);
  drawTrackMap(cv, tr, null, th.wall[0], true);
}
function drawTrackMap(cv, tr, karts, col = 0xffffff, keepBg = false) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, pts = tr.samples;
  if (!tr._mm || tr._mm.w !== w || tr._mm.h !== h) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const sc = Math.min((w - 24) / (x1 - x0), (h - 24) / (z1 - z0)); tr._mm = { sc, w, h, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; }
  const { sc, cx, cz } = tr._mm, P = (x, z) => [w / 2 - (x - cx) * sc, h / 2 - (z - cz) * sc];
  if (!keepBg) g.clearRect(0, 0, w, h);
  if (!karts && !keepBg) { g.fillStyle = 'rgba(10,20,50,.6)'; g.fillRect(0, 0, w, h); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (const [lw, st] of [[karts ? 11 : 14, 'rgba(0,0,0,.45)'], [karts ? 7 : 9, karts ? 'rgba(255,255,255,.85)' : '#' + col.toString(16).padStart(6, '0')]]) {
    g.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.lineWidth = lw; g.strokeStyle = st; g.stroke();
  }
  const s0 = P(pts[0].x, pts[0].z); g.fillStyle = '#fff'; g.fillRect(s0[0] - 5, s0[1] - 2, 10, 4);
  if (karts) for (const k of [...karts].sort((a, b) => a.isPlayer - b.isPlayer)) {
    const [x, y] = P(k.x, k.z);
    if (k.isPlayer) { g.save(); g.translate(x, y); g.rotate(-k.heading + Math.PI); g.fillStyle = '#ff9a1f'; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 9); g.lineTo(-7, -6); g.lineTo(7, -6); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    else { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fillStyle = '#' + k.color.toString(16).padStart(6, '0'); g.fill(); g.lineWidth = 2; g.strokeStyle = '#0008'; g.stroke(); }
  }
}

// ------------------------------------------------------------------ garage
const GCATS = [['kart', 'Karts', '카트'], ['driver', 'Characters', '드라이버'], ['pet', 'Pets', '펫'], ['balloon', 'Balloons', '풍선']];
let gTab = 'kart';
function renderGarage() {
  $('gTabs').innerHTML = GCATS.map(([k, , ko]) => `<button class="${k === gTab ? 'on' : ''}" data-k="${k}">${ko}</button>`).join('');
  $('gTabs').querySelectorAll('button').forEach(b => b.onclick = () => { gTab = b.dataset.k; audio.play('click'); renderGarage(); });
  const cat = GCATS.find(c => c[0] === gTab)[1];
  $('gGrid').innerHTML = list(cat).map(a => `<button class="${combo[gTab] === a.id ? 'on' : ''}" data-id="${a.id}"><img src="${thumb(a.id)}" alt="">${a.name_ko}</button>`).join('');
  $('gGrid').querySelectorAll('button').forEach(b => b.onclick = () => { combo[gTab] = b.dataset.id; store.set('combo', combo); audio.play('select'); renderGarage(); setMenuCombo(); });
  $('gPick').innerHTML = GCATS.map(([k, , ko]) => `${ko}: <b>${byId[combo[k]]?.name_ko || '-'}</b>`).join(' · ');
  $('gName').textContent = byId[combo.kart]?.name_ko + ' × ' + byId[combo.driver]?.name_ko.split(' ')[0];
}
let menuLoadId = 0;
async function setMenuCombo() {
  const key = JSON.stringify(combo); if (menu.combo === key) return; menu.combo = key; const my = ++menuLoadId;
  const [k, d, p, b] = await Promise.all([load(combo.kart), load(combo.driver), load(combo.pet), load(combo.balloon)]);
  if (my !== menuLoadId) return;
  menu.turn.clear(); const sock = byId[combo.kart].sockets;
  const bal = new THREE.Group(); bal.add(b); bal.position.set(sock.Balloon[0], sock.Balloon[2], -sock.Balloon[1]); bal.scale.setScalar(0.8);
  p.position.set(sock.Pet[0], sock.Pet[2], -sock.Pet[1]); menu.pet = p; menu.turn.add(k, d, bal, p);
}

// ------------------------------------------------------------------ waiting room (8 slots: host + 7 AI, track preview, chat, ready states)
const portrait = { r: null, scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(32, 240 / 252, 0.1, 50), cache: {} };
{ const s = portrait.scene; s.add(new THREE.HemisphereLight(0xffffff, 0x8090b0, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(-3, 5, -4); s.add(d); }
async function portraitOf(c) {
  const key = [c.kart, c.driver, c.pet, c.balloon].join('|'); if (portrait.cache[key]) return portrait.cache[key];
  if (!portrait.r) { portrait.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); portrait.r.setSize(240, 252); portrait.r.toneMapping = THREE.ACESFilmicToneMapping; }
  const [k, d, p, b] = await Promise.all([load(c.kart), load(c.driver), load(c.pet), load(c.balloon)]);
  const g = new THREE.Group(), sock = byId[c.kart].sockets;
  const bal = new THREE.Group(); bal.add(b); bal.position.set(sock.Balloon[0], sock.Balloon[2], -sock.Balloon[1]); bal.scale.setScalar(0.8);
  p.position.set(sock.Pet[0], sock.Pet[2] + 0.1, -sock.Pet[1]); g.add(k, d, bal, p); g.rotation.y = 0.6;
  portrait.scene.add(g); portrait.cam.position.set(0, 2.1, 5.6); portrait.cam.lookAt(0, 0.95, 0);
  portrait.r.render(portrait.scene, portrait.cam); const url = portrait.r.domElement.toDataURL(); portrait.scene.remove(g);
  return (portrait.cache[key] = url);
}
const CHAT = ['레디~ 잘 부탁해요!', '오늘은 1등 각!', '드리프트 연습 많이 했어요 ㅎㅎ', '부스터 아껴뒀다 쓸게요', '미사일 조심하세요~', '이 트랙 좋아요!', '시작 언제 해요?', '렛츠고!!', '세포 분열급 속도 보여드림', 'ATP 충전 완료!', '슬립스트림 타야지~', 'ㅋㅋㅋ 다들 화이팅'];
const randCombo = i => { const pool = cat => list(cat).map(a => a.id); const r = n => Math.floor(Math.random() * n);
  return { kart: pool('Karts')[(i * 3 + r(10)) % 10], driver: pool('Characters')[r(7)], pet: pool('Pets')[r(7)], balloon: pool('Balloons')[r(7)] }; };
const lobby = { slots: null, timers: [] };
function initLobby() {
  const names = [...AI_NAMES].sort(() => Math.random() - 0.5);
  lobby.slots = Array.from({ length: 8 }, (_, i) => i === 0 ? { type: 'me', name: '나', color: COLORS[0], lv: 12 }
    : { type: 'ai', name: names[i - 1], combo: randCombo(i), color: COLORS[i], lv: 3 + Math.floor(Math.random() * 40), ready: false });
}
function lobbyChat(who, txt, sys = false) {
  const log = $('lbChatLog'); const d = document.createElement('div'); if (sys) { d.className = 'sys'; d.textContent = txt; } else d.innerHTML = `<b>${who}</b> : ${txt.replace(/</g, '&lt;')}`;
  log.appendChild(d); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = 1e6;
}
function stopLobby() { lobby.timers.forEach(clearTimeout); lobby.timers = []; }
function enterLobby() {
  if (!lobby.slots) initLobby();
  stopLobby();
  lobby.slots.forEach(s => s.ready = false);
  const def = TRACKS[race.trackIdx];
  $('lbChatLog').innerHTML = ''; lobbyChat('', `[알림] ${THEMES[def.theme].name} · ${def.name} 방에 입장했습니다.`, true);
  // AIs get ready one by one (and chat a bit)
  lobby.slots.forEach((s, i) => { if (s.type !== 'ai') return;
    lobby.timers.push(setTimeout(() => { s.ready = true; audio.play('ready'); renderLobby(); if (Math.random() < 0.5) { lobbyChat(s.name, CHAT[Math.floor(Math.random() * CHAT.length)]); } }, 500 + i * 380 + Math.random() * 600)); });
  const idle = () => { lobby.timers.push(setTimeout(() => { const ai = lobby.slots.filter(s => s.type === 'ai'); if (ai.length && screen === 'lobby') { const s = ai[Math.floor(Math.random() * ai.length)]; lobbyChat(s.name, CHAT[Math.floor(Math.random() * CHAT.length)]); audio.play('chat'); } idle(); }, 6000 + Math.random() * 7000)); };
  idle();
  renderLobby(true);
}
const modeName = { speed: '스피드 개인전', item: '아이템 개인전', time: '타임어택' };
function renderLobby(full) {
  const def = TRACKS[race.trackIdx], th = THEMES[def.theme], tm = race.mode === 'time';
  $('lbRoomName').textContent = race.mode === 'item' ? '아이템 대난투!' : tm ? '기록 도전 중' : '함께 달려요!';
  $('lbModeTxt').textContent = `${modeName[race.mode]} · ${th.name} 채널`;
  document.querySelectorAll('#lbMode button').forEach(b => b.classList.toggle('on', b.dataset.m === race.mode));
  document.querySelectorAll('#lbDiff button').forEach(b => b.classList.toggle('on', +b.dataset.d === race.skill));
  const slots = lobby.slots, grid = $('lbGrid');
  const slotHTML = (s, i) => {
    const off = tm && i > 0;
    if (s.type === 'empty' || s.type === 'closed' || off) return `<div class="slotc ${off || s.type === 'closed' ? 'closed' : 'empty'}" data-i="${i}"><div class="sh"><span class="lv">-</span><span class="sb">${off ? '' : '<button class="add" title="AI 추가">+</button>'}</span></div>
      <div class="nm">${off ? '타임어택' : s.type === 'closed' ? '닫힌 자리' : '빈 자리'}</div><div class="pv">${off ? '🔒' : '+ AI 초대'}</div></div>`;
    const me = s.type === 'me', c = me ? combo : s.combo;
    return `<div class="slotc ${me ? 'host me' : ''}" data-i="${i}"><div class="sh"><span class="lv">Lv.${s.lv}</span><span class="badge">${['🧬', '🦠', '🧫', '🔬', '🧪', '🌿', '🩸', '🧠'][i]}</span>
      <span class="sb">${me ? '' : '<button class="add" title="카트 바꾸기">↻</button><button class="del" title="강퇴">✕</button>'}</span></div>
      <div class="nm" style="border-left:5px solid #${s.color.toString(16).padStart(6, '0')}">${s.name}</div>
      <div class="pv"><img alt="" data-por="${i}"><span class="kartname">${byId[c.kart]?.name_ko.split(' (')[0] || ''}</span>${me ? '<span class="hosttag">방 장</span>' : s.ready ? '<span class="ready">READY</span>' : ''}</div></div>`;
  };
  const trackHTML = `<div class="lb-track" id="lbTrack"><div class="tn">${def.name}</div><div class="tv"><canvas width="460" height="220"></canvas>
      <span class="diff">난이도 <i>${'●'.repeat(def.diff + 1)}${'○'.repeat(4 - def.diff)}</i></span><span class="theme">${th.icon} ${th.name}</span>
      <span class="info">${def.laps}바퀴 · ${def.desc}</span></div></div>`;
  grid.innerHTML = slotHTML(slots[0], 0) + slots.slice(1, 5).map((s, k) => slotHTML(s, k + 1)).join('') + trackHTML + slots.slice(5).map((s, k) => slotHTML(s, k + 5)).join('');
  setTimeout(() => drawTrackPreview(grid.querySelector('#lbTrack canvas'), trackObj(race.trackIdx)), 0);
  $('lbTrack').onclick = () => { audio.play('click'); pickTheme = def.theme; show('tracks'); };
  grid.querySelectorAll('.slotc').forEach(el => {
    const i = +el.dataset.i, s = slots[i];
    const add = el.querySelector('.add'), del = el.querySelector('.del'), pv = el.querySelector('.pv');
    const invite = () => { if (tm) return; const names = AI_NAMES.filter(n => !slots.some(x => x.name === n));
      Object.assign(s, { type: 'ai', name: names[Math.floor(Math.random() * names.length)] || 'AI', combo: randCombo(i), color: COLORS[i], lv: 3 + Math.floor(Math.random() * 40), ready: false });
      audio.play('select'); lobbyChat('', `[알림] ${s.name} 님이 입장했습니다.`, true); renderLobby();
      lobby.timers.push(setTimeout(() => { s.ready = true; audio.play('ready'); renderLobby(); lobbyChat(s.name, '안녕하세요~ 레디!'); }, 900)); };
    if (s.type === 'ai' && !tm) {
      if (add) add.onclick = e => { e.stopPropagation(); s.combo = randCombo(i + Math.floor(Math.random() * 10)); audio.play('click'); renderLobby(); };
      if (del) del.onclick = e => { e.stopPropagation(); lobbyChat('', `[알림] ${s.name} 님이 퇴장했습니다.`, true); s.type = 'empty'; audio.play('click'); renderLobby(); };
    } else if (s.type !== 'me') { if (add) add.onclick = e => { e.stopPropagation(); invite(); }; if (pv) pv.onclick = invite; }
    if (s.type === 'me') pv.onclick = () => { gTab = 'kart'; garageReturn = 'lobby'; show('garage'); };
  });
  grid.querySelectorAll('img[data-por]').forEach(img => { const s = slots[+img.dataset.por]; portraitOf(s.type === 'me' ? combo : s.combo).then(u => img.src = u); });
  const racers = tm ? 1 : slots.filter(s => s.type === 'me' || s.type === 'ai').length, ready = slots.filter(s => s.type === 'ai').every(s => s.ready);
  $('lbStatus').innerHTML = `모드: <b>${modeName[race.mode]}</b><br>트랙: <b>${def.name}</b> (${def.laps}바퀴)<br>참가: <b>${racers}명</b> · AI ${({ 0.88: '쉬움', 0.95: '보통', 1.02: '어려움' })[race.skill] || '보통'}<br>${tm ? '혼자 최고 기록에 도전!' : ready ? '<span style="color:#b6ff6a">✔ 모두 준비 완료! 시작을 누르세요</span>' : '다른 레이서 준비 중…'}`;
  $('lbStart').classList.toggle('go', tm || ready);
}
document.querySelectorAll('#lbMode button').forEach(b => b.onclick = () => { race.mode = b.dataset.m; audio.play('click'); renderLobby(); });
document.querySelectorAll('#lbDiff button').forEach(b => b.onclick = () => { race.skill = +b.dataset.d; audio.play('click'); renderLobby(); });
$('lbStart').onclick = () => { audio.rev(); startRace(); };
$('lbChatIn').addEventListener('keydown', e => {
  e.stopPropagation(); if (e.key !== 'Enter' || !e.target.value.trim()) return;
  lobbyChat('나', e.target.value.trim()); e.target.value = ''; audio.play('chat');
  const ai = lobby.slots.filter(s => s.type === 'ai'); if (ai.length) lobby.timers.push(setTimeout(() => { const s = ai[Math.floor(Math.random() * ai.length)]; lobbyChat(s.name, ['ㅋㅋㅋ 좋아요', '오케이!', '저도요~', '빨리 시작해요!', 'ㅎㅎ 화이팅'][Math.floor(Math.random() * 5)]); audio.play('chat'); }, 900 + Math.random() * 1200));
});

// ------------------------------------------------------------------ input
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { if (screen === 'race') { race.prevState = race.state; race.state = 'paused'; show('pause'); } else if (screen === 'pause') resume(); }
  if (screen === 'race') {
    if (e.code === 'KeyC') race.camMode = (race.camMode + 1) % 3;
    if (e.code === 'KeyR' && race.player && race.state === 'race') { const p = race.player; p.place(world.track, p.s, 0); p.lap = Math.max(p.lap, p.lap); }
    if ((e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyZ') && !e.repeat) race.useQueued = true;
  }
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function playerInput() {
  return { throttle: (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0),
           steer: (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0),
           drift: !!(keys.ShiftLeft || keys.ShiftRight || keys.Space), use: false };
}

// ------------------------------------------------------------------ race setup
let raceScene = null, sun = null;
async function startRace() {
  audio.init(); audio.play('select'); show('loading');
  const def = TRACKS[race.trackIdx], th = THEMES[def.theme];
  $('loadText').textContent = `${th.icon} ${th.name} · ${def.name} 준비 중…`;
  if (raceScene) { race.karts.forEach(k => k.dispose(raceScene)); world.items?.clear(); }
  raceScene = new THREE.Scene(); raceScene.background = new THREE.Color(th.fog); raceScene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  world.skyDome = makeSkyDome(th.sky); raceScene.add(world.skyDome);
  sun = lights(raceScene, th); world.scene = raceScene; renderer.toneMappingExposure = th.exposure;
  const track = world.track = new Track(def); track.build(raceScene, groundTexture(th.groundKind, th.ground));
  world.ambient = new Ambient(raceScene, th.particles);
  world.fx = new FX(raceScene); world.items = new ItemSystem(world);
  // racers come from the waiting room slots
  if (!lobby.slots) initLobby();
  const entrants = race.mode === 'time' ? [lobby.slots[0]] : lobby.slots.filter(s => s.type === 'me' || s.type === 'ai');
  const n = entrants.length;
  const combos = entrants.map(s => s.type === 'me' ? combo : s.combo);
  await preload(combos.flatMap(c => [c.kart, c.driver, c.pet, c.balloon]));
  $('loadText').textContent = '트랙 오브젝트 · 하늘 배치 중…';
  await Promise.all([track.populate(race.mode), world.items.init()]);
  race.karts = await Promise.all(combos.map((c, i) => new Kart(world, c, entrants[i].name, entrants[i].color, entrants[i].type === 'me').build(raceScene)));
  race.player = race.karts.find(k => k.isPlayer);
  race.ais = race.karts.filter(k => !k.isPlayer).map((k, i, arr) => { k.ai = true; return new AIDriver(k, race.skill * (0.95 + (i / Math.max(1, arr.length - 1)) * 0.08)); });
  // grid behind the start line (2 columns); player starts mid-pack unless alone
  const order = race.karts.filter(k => !k.isPlayer); order.splice(Math.min(order.length, Math.floor(n * 0.6)), 0, race.player);
  order.forEach((k, i) => { const row = Math.floor(i / 2), lat = (i % 2 ? -1 : 1) * 3.2 * (n > 1 ? 1 : 0); k.place(track, track.L - 7 - row * 6.5, lat); k.lap = -1; k.progress = -7 - row * 6.5; });
  race.t = 0; race.finishT = 0; race.state = 'countdown'; race.countdown = 4.0; race.lastCount = 5; race.useQueued = false;
  race.best[def.id] = store.get('best_' + def.id + '_' + race.mode, 0);
  $('rankTot').textContent = '/' + n; $('lapTot').textContent = `/${def.laps} LAP`; $('finalTag').style.display = 'none';
  $('tBest').textContent = fmt(race.best[def.id]); $('rankList').style.display = n > 1 ? '' : 'none';
  $('itemBar').style.display = ''; $('boostGauge').style.display = race.mode === 'item' ? 'none' : '';
  $('mirrorFrame').style.display = settings.mirror ? 'block' : 'none';
  updateSlots(true);
  renderer.shadowMap.enabled = settings.shadow;
  audio.startMusic('race'); audio.setTempo(th.bpm); race.bpm = th.bpm;
  show('race');
}
$('resRetry').onclick = startRace; $('restart').onclick = startRace;
$('resTracks').onclick = () => { audio.play('click'); race.state = 'menu'; show('lobby'); };
$('resMain').onclick = $('quit').onclick = () => { audio.play('click'); race.state = 'menu'; show('title'); };
function resume() { race.state = race.prevState || 'race'; show('race'); }
$('resume').onclick = resume;

// ------------------------------------------------------------------ event reactions (fx + audio + HUD)
const isP = k => k === race.player;
const notice = (txt, color = '#fff') => { const d = document.createElement('div'); d.textContent = txt; d.style.color = color; $('notice').prepend(d); setTimeout(() => d.remove(), 1700); while ($('notice').children.length > 3) $('notice').lastChild.remove(); };
const center = (txt, dur = 1.2) => { const c = $('center'); c.textContent = txt; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); clearTimeout(center.h); if (dur) center.h = setTimeout(() => c.textContent = '', dur * 1000); };
events.on('boost', (k, kind) => { if (isP(k)) { audio.play(kind === 'mini' || kind === 'draft' ? 'mini' : 'boost'); if (kind === 'draft') notice('슬립스트림 부스트!', '#ffd23a'); if (kind === 'mini') notice('순간 부스터!', '#9dff5a'); } world.fx.ring(k.x, k.y + 0.3, k.z, kind === 'draft' ? 0xffe14a : 0x66ccff, 18); });
events.on('hit', (k, kind, from) => { world.fx.burst(k.x, k.y + 0.8, k.z, [0xff5050, 0xffe14a, 0xffffff], 30, 7);
  if (isP(k)) { audio.play(kind === 'trap' ? 'bubble' : kind === 'spin' ? 'spin' : 'hit'); world.fx.shake = 1; notice(from && from !== k ? `${from.name}에게 공격당함!` : '공격당함!', '#ff6b6b'); }
  else if (isP(from)) { audio.play('hit'); notice(`${k.name} 명중!`, '#7dff5a'); } });
events.on('blocked', k => { if (isP(k)) { audio.play('shield'); notice('실드로 방어!', '#40e8ff'); } world.fx.ring(k.x, k.y + 1, k.z, 0x66e8ff); });
events.on('wall', (k, vn) => { if (isP(k)) { audio.play('wall'); world.fx.shake = Math.min(0.6, vn * 0.04); } for (let i = 0; i < 10; i++) world.fx.sparks.emit(k.x, k.y + 0.4, k.z, (Math.random() - .5) * 8, Math.random() * 4, (Math.random() - .5) * 8, 0xffd060, 0.4, 1.5, 10); });
events.on('jump', k => isP(k) && audio.play('jump'));
events.on('land', (k, imp) => { if (isP(k)) { audio.play('land'); world.fx.shake = Math.min(0.5, imp * 0.04); } for (let i = 0; i < 16; i++) world.fx.voxels.emit(k.x, k.y + 0.1, k.z, (Math.random() - .5) * 6, Math.random() * 3, (Math.random() - .5) * 6, 0xdddddd, 0.5, 1.4); });
events.on('bounce', k => { if (isP(k)) { audio.play('bounce'); notice('트램펄린!', '#ff5ae0'); } });
events.on('slime', k => { if (isP(k)) { audio.play('slime'); notice('끈적끈적… 감속!', '#9dff5a'); } });
events.on('gotItem', (k, it) => { if (isP(k)) { audio.play('item'); updateSlots(); } });
events.on('useItem', (k, it) => { if (it === 'missile' || it === 'bubble') { if (isP(k) || Math.hypot(k.x - race.player.x, k.z - race.player.z) < 40) audio.play(it === 'missile' ? 'missile' : 'bubble'); } else if (isP(k) && it !== 'booster') audio.play(it === 'shield' ? 'shield' : 'use'); if (isP(k)) updateSlots(); });
events.on('targeted', (k, type, from) => { if (isP(k)) { audio.play('warn'); notice(type === 'missile' ? '⚠ 항체 미사일 접근!' : '⚠ 산소 버블 접근!', '#ffb020'); } });
events.on('explode', (x, y, z, c) => world.fx.burst(x, y, z, [c, 0xffffff, 0xffe14a], 40, 9));
events.on('trail', e => world.fx.trail(e));
events.on('driftStart', k => { if (isP(k)) audio.chirp(); });
events.on('gaugeFull', k => { if (isP(k)) { audio.play('gauge'); notice('⚡ 부스터 게이지 충전! Ctrl로 사용', '#40e8ff'); } }); events.on('driftEnd', k => {});
events.on('lap', k => {
  const def = world.track.def;
  if (k.lap >= 1) { const lt = race.t - k.lapStart; k.lapTimes.push(lt); if (isP(k) && race.mode !== 'item' && (!race.best[def.id] || lt < race.best[def.id] || true)) {} }
  k.lapStart = race.t;
  if (k.lap >= def.laps && !k.finished) {
    k.finished = true; k.finishTime = race.t;
    if (isP(k)) {
      audio.play('finish'); center('FINISH!', 0); race.finishT = race.t;
      const best = Math.min(...k.lapTimes); const key = 'best_' + def.id + '_' + race.mode;
      if (!store.get(key, 0) || best < store.get(key, 0)) { store.set(key, best); notice('🏆 최고 랩 기록 갱신!', '#ffd23a'); }
    }
  } else if (isP(k) && k.lap >= 1) {
    if (k.lap === def.laps - 1) { audio.play('final'); center('FINAL LAP', 1.6); $('finalTag').style.display = 'block'; audio.setTempo(race.bpm + 14); }
    else { audio.play('lap'); center(`${k.lap + 1} / ${def.laps} LAP`, 1.2); }
  }
});

// ------------------------------------------------------------------ HUD
function updateSlots(force) {
  const p = race.player; if (!p) return;
  const key = p.items.join(',');
  if (!force && key === updateSlots.key) return; updateSlots.key = key;
  [0, 1].forEach(i => { const el = $('slot' + i), it = p.items[i]; el.innerHTML = it ? `<img src="${icon(ITEMS[it].icon)}" alt="${ITEMS[it].name}">` : ''; if (it) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); } });
}
const mm = $('minimap');
function updateHUD() {
  const p = race.player, sorted = [...race.karts].sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.progress - a.progress));
  sorted.forEach((k, i) => k.rank = i + 1);
  $('rankNum').textContent = p.rank;
  if (race.karts.length > 1) {
    const html = sorted.map(k => `<li class="${k.isPlayer ? 'me' : ''} ${k.finished ? 'done' : ''}"><span class="n" style="background:#${k.color.toString(16).padStart(6, '0')}">${k.rank}</span>${k.name}${k.finished ? `<span class="tm">${fmt(k.finishTime)}</span>` : ''}</li>`).join('');
    if (html !== updateHUD.list) { $('rankList').innerHTML = html; updateHUD.list = html; }
  }
  const def = world.track.def;
  $('lapNum').textContent = Math.max(1, Math.min(def.laps, p.lap + 1));
  $('tLap').textContent = fmt(race.state === 'countdown' ? 0 : race.t - p.lapStart);
  $('tTotal').textContent = fmt(p.finished ? p.finishTime : race.t);
  const kmh = Math.round(p.speed * 3.6 * 1.25);
  $('spd').textContent = String(kmh).padStart(3, '0');
  $('gArc').style.strokeDasharray = `${Math.min(1, kmh / 240) * 396} 528`;
  $('gArc').style.stroke = p.boostT > 0 ? '#40e8ff' : '#ffffff';
  $('draft').classList.toggle('on', p.draftOn > 0); $('draftBar').firstElementChild.style.width = p.draft + '%';
  $('boostGauge').firstElementChild.style.width = p.gauge + '%';
  $('vignette').style.opacity = p.boostT > 0 ? 1 : 0;
  drawTrackMap(mm, world.track, race.karts);
  updateSlots();
  if (p.wrongWay > 1.2 && !p.finished) { if (!updateHUD.ww) { center('역주행!', 0); audio.play('warn'); updateHUD.ww = true; } }
  else if (updateHUD.ww) { updateHUD.ww = false; $('center').textContent = ''; }
}

// ------------------------------------------------------------------ results
let podium = null;
async function showResults() {
  race.state = 'results'; audio.startMusic('menu');
  const sorted = [...race.karts].sort((a, b) => (b.finished - a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.progress - a.progress));
  const def = world.track.def;
  $('resTitle').innerHTML = `${def.name} <small style="opacity:.7">${{ speed: '스피드전', item: '아이템전', time: '타임어택' }[race.mode]}</small>`;
  $('resTable').innerHTML = sorted.map((k, i) => `<tr class="${k.isPlayer ? 'me' : ''} ${i === 0 ? 'gold' : ''}"><td>${i + 1}</td><td><span style="color:#${k.color.toString(16).padStart(6, '0')}">●</span> ${k.name} <small style="opacity:.6">${byId[k.combo.kart].name_ko.split(' (')[0]}</small></td><td>${k.finished ? fmt(k.finishTime) : '미완료'}</td></tr>`).join('')
    + (race.player.lapTimes.length ? `<tr><td>⏱</td><td>나의 베스트 랩</td><td>${fmt(Math.min(...race.player.lapTimes))}</td></tr>` : '');
  // 3D podium near the finish line
  const tr = world.track, p0 = tr.place(-30, tr.W / 2 + 14);
  if (!podium) podium = await load('T14_Podium');
  podium.position.set(p0.x, 0, p0.z); podium.rotation.y = p0.yaw - Math.PI / 2; raceScene.add(podium);
  const socks = byId['T14_Podium'].sockets;
  sorted.slice(0, 3).forEach((k, i) => {
    const s = socks['P' + (i + 1)]; const local = new THREE.Vector3(s[0], s[2], -s[1]); podium.updateMatrixWorld(); const w = podium.localToWorld(local);
    k.x = w.x; k.z = w.z; k.y = w.y; k.heading = podium.rotation.y; k.vx = k.vz = k.vy = 0; k.grounded = true; k.boostT = 0; k.drifting = false; k.spinT = k.trapT = k.flipT = 0;
    k.podium = true;
  });
  race.karts.slice(0).forEach(k => { if (!k.podium) { k.root.visible = false; k.pet.visible = false; } });
  race.podiumCenter = podium.localToWorld(new THREE.Vector3(0, 1.5, 0));
  race.podiumFront = podium.localToWorld(new THREE.Vector3(0, 3.2, 9));
  show('results');
  audio.play('finish');
}

// ------------------------------------------------------------------ main loop
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (screen === 'race' || screen === 'results' || screen === 'pause' || screen === 'loading') {
    if (raceScene && world.track && race.karts.length && race.state !== 'paused') stepRace(dt);
    if (raceScene && race.karts.length) renderRace(dt);
  } else renderMenu(dt);
  requestAnimationFrame(frame);
}
function stepRace(dt) {
  const tr = world.track, p = race.player;
  if (race.state === 'countdown') {
    race.countdown -= dt; const c = Math.ceil(race.countdown - 1);
    if (c !== race.lastCount && c >= 0) { race.lastCount = c; if (c > 0) { center(String(c), 0.9); audio.play('count'); } else { center('GO!', 0.8); audio.play('go'); race.state = 'race'; race.karts.forEach(k => k.lapStart = 0); } }
    // start lights: rows light up red, then green
    const lit = 3 - Math.max(0, Math.ceil(race.countdown - 1));
    for (const L of tr.dynamic.lamps) { const on = race.state === 'race' ? L.row === 2 : (L.row < 2 && L.col < lit + (lit >= 3 ? 1 : 0)); L.m.material.emissive.setHex(on ? (L.row === 2 ? 0x33ff55 : 0xff2222) : 0); L.m.material.emissiveIntensity = 4; }
    // rev engines + standing-start boost if accelerating right at GO
  }
  if (race.state === 'race' && tr.dynamic.lamps.length && race.t < 2) for (const L of tr.dynamic.lamps) L.m.material.emissive.setHex(L.row === 2 ? 0x33ff55 : 0);
  if (race.state === 'race' || race.state === 'results') race.t += race.state === 'race' ? dt : 0;
  // inputs
  if (p && !p.finished && race.state !== 'results') p.input = playerInput();
  if (race.state !== 'results') for (const ai of race.ais) ai.think(dt, race, tr, world.items);
  if (p && p.finished) { // autopilot after finish
    const look = tr.at(p.s + 14); let w = Math.atan2(look.x - p.x, look.z - p.z) - p.heading; w = Math.atan2(Math.sin(w), Math.cos(w));
    p.input = { throttle: p.speed < 18 ? 1 : 0, steer: Math.max(-1, Math.min(1, w * 2)), drift: false };
  }
  if (race.state === 'race') {
    if (race.useQueued && p.items.length && !p.finished) world.items.use(p, race);
    for (const k of race.karts) if (k.ai && k.input.use && k.items.length) world.items.use(k, race);
  }
  race.useQueued = false;
  if (race.state !== 'results') {
    for (const k of race.karts) k.update(dt, race);
    collideKarts();
    pickups(dt);
    world.items.update(dt, race);
  }
  updateBlocks(dt);
  for (const s of tr.dynamic.spinners) s.o.rotation[s.axis] += s.sp * dt;
  tr.animateSky(race.t + performance.now() / 1000, dt); world.ambient?.update(dt, camera.position);
  for (const k of race.karts) { k.animate(dt, race.t + performance.now() / 1000, camera); if (race.state !== 'results' && k.root.visible) world.fx.kart(k, dt); }
  world.fx.update(dt, settings.lines && race.state === 'race' ? Math.max(0, (p.speed - 30) / 20) + (p.boostT > 0 ? 0.6 : 0) : 0);
  audio.engine(p.speed, p.input.throttle, p.boostT > 0, p.drifting, race.state === 'race' || race.state === 'countdown');
  if (race.state === 'race' || race.state === 'countdown') updateHUD();
  // finish handling
  if (race.state === 'race' && p.finished) {
    const allDone = race.karts.every(k => k.finished);
    if (allDone || race.t - race.finishT > 6) showResults();
  }
  // time-out: if leader finished long ago and player still racing (20s), end
  if (race.state === 'race' && !p.finished) { const leader = race.karts.find(k => k.finished); if (leader && race.t - leader.finishTime > 25) { center('TIME OVER', 0); race.finishT = race.t; p.dnf = true; setTimeout(showResults, 1500); race.state = 'over'; } }
}
function collideKarts() {
  const ks = race.karts, R = PHYS.RADIUS * 2;
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i], b = ks[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d > R || d < 1e-4 || Math.abs(a.y - b.y) > 1.5) continue;
    const nx = dx / d, nz = dz / d, push = (R - d) / 2;
    a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel < 0) { const jimp = -(1 + 0.45) * rel / 2; a.vx -= jimp * nx; a.vz -= jimp * nz; b.vx += jimp * nx; b.vz += jimp * nz;
      if ((isP(a) || isP(b)) && -rel > 4) { audio.play('knock'); world.fx.shake = Math.min(0.4, -rel * 0.03); } }
  }
}
function pickups(dt) {
  const T = race.t + performance.now() / 1000;
  for (const it of world.track.dynamic.items) {
    if (it.t > 0) { it.t -= dt; if (it.t <= 0) it.obj.visible = true; }
    it.obj.rotation.y += dt * (it.coin ? 3 : 1.4); it.obj.position.y = it.y + (it.coin ? 0.25 : 0.4) + Math.sin(T * 2.5 + it.ph) * 0.15;
    if (!it.obj.visible) continue;
    for (const k of race.karts) {
      if ((k.x - it.x) ** 2 + (k.z - it.z) ** 2 < (it.coin ? 2.6 : 3.4) && Math.abs(k.y - it.y) < 2) {
        it.obj.visible = false; it.t = it.coin ? 8 : 3;
        if (it.coin) { k.gauge = Math.min(100, k.gauge + 20); if (isP(k)) audio.play('coin'); world.fx.ring(it.x, it.y + 0.6, it.z, 0xffd23a, 12); }
        else { world.fx.burst(it.x, it.y + 0.8, it.z, [0x40e8ff, 0xff5ae0, 0xffe14a, 0x7dff5a], 24, 6, 1.6);
          if (k.items.length < 2) { const sortedIdx = [...race.karts].sort((a, b) => b.progress - a.progress).indexOf(k) + 1; const item = rollItem(sortedIdx, race.karts.length); k.items.push(item); events.emit('gotItem', k, item); if (isP(k)) notice(ITEMS[item].name + ' 획득!', '#7dff5a'); } }
        break;
      }
    }
  }
}
function updateBlocks(dt) {
  for (const b of world.track.dynamic.blocks) {
    for (const k of race.karts) { const dx = b.p.x - k.x, dz = b.p.z - k.z, d = Math.hypot(dx, dz);
      if (d < 1.6 && b.p.y < k.y + 1.6 && k.speed > 3) { const sp = Math.max(5, k.speed * 0.7);
        b.v.set(dx / d * sp + Math.sin(k.heading) * k.speed * 0.5, 4 + Math.random() * 4, dz / d * sp + Math.cos(k.heading) * k.speed * 0.5);
        b.w.set(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5); if (b.sleep && isP(k)) audio.play('knock'); b.sleep = false; k.vx *= 0.96; k.vz *= 0.96; } }
    if (b.sleep) continue;
    b.v.y -= PHYS.GRAVITY * dt; b.p.addScaledVector(b.v, dt);
    const n = world.track.nearest(b.p.x, b.p.z); const g = Math.abs(n.lat) < world.track.W / 2 + 1 ? world.track.heightAt(n.s) : 0;
    if (b.p.y < g) { b.p.y = g; b.v.y = Math.abs(b.v.y) * 0.35; b.v.x *= 0.7; b.v.z *= 0.7; b.w.multiplyScalar(0.7); if (b.v.length() < 0.5) b.sleep = true; }
    b.obj.position.copy(b.p); b.obj.rotation.x += b.w.x * dt; b.obj.rotation.y += b.w.y * dt; b.obj.rotation.z += b.w.z * dt;
  }
}
function renderRace(dt) {
  const p = race.player; if (!p) return;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  let want, look;
  if (race.state === 'results' && race.podiumCenter) {
    const t = performance.now() / 1000; want = race.podiumFront.clone().add(new THREE.Vector3(Math.sin(t * 0.3) * 3, 0, 0)); look = race.podiumCenter;
  } else if (race.state === 'countdown' && race.countdown > 1.5) {
    // intro: swing from in front of the driver to the chase position, staying high enough to clear the walls
    const a = Math.min(1, (race.countdown - 1.5) / 2.5), ang = p.heading + Math.PI * (1 - a) * 0.9 + Math.PI * a;
    want = new THREE.Vector3(p.x + Math.sin(ang + Math.PI) * (6 - a), p.y + 2.6 + a * 1.5, p.z + Math.cos(ang + Math.PI) * (6 - a)); look = new THREE.Vector3(p.x, p.y + 1, p.z);
  } else if (race.camMode === 0) { const back = 7 + Math.min(2, p.speed * 0.03); want = new THREE.Vector3(p.x - fx * back, p.y + 3.1, p.z - fz * back); look = new THREE.Vector3(p.x + fx * 5, p.y + 1.1, p.z + fz * 5); }
  else if (race.camMode === 1) { want = new THREE.Vector3(p.x - fx * 4.2, p.y + 2.0, p.z - fz * 4.2); look = new THREE.Vector3(p.x + fx * 8, p.y + 1.0, p.z + fz * 8); }
  else { want = new THREE.Vector3(p.x - fx * 15, p.y + 9, p.z - fz * 15); look = new THREE.Vector3(p.x + fx * 6, p.y, p.z + fz * 6); }
  // keep the camera above the road / ground
  camPos.lerp(want, Math.min(1, dt * (race.state === 'results' ? 2 : 6))); camLook.lerp(look, Math.min(1, dt * 10));
  const sh = world.fx.shake; camera.position.set(camPos.x + (Math.random() - 0.5) * sh * 0.5, Math.max(camPos.y, 0.8) + (Math.random() - 0.5) * sh * 0.5, camPos.z + (Math.random() - 0.5) * sh * 0.5);
  camera.lookAt(camLook);
  // karts that pass right next to the lens would fill the screen -> hide them for that moment
  if (race.state !== 'results') for (const k of race.karts) if (k !== p) { const near = k.root.position.distanceTo(camera.position) < 3.2; k.root.visible = !near; k.pet.visible = !near; }
  const tf = 64 + (p.boostT > 0 ? 12 : 0) + Math.min(6, p.speed * 0.1); camera.fov += (tf - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  sun.position.set(p.x + 30, 60, p.z - 20); sun.target.position.set(p.x, 0, p.z);
  world.skyDome?.position.copy(camera.position);
  renderer.setViewport(0, 0, innerWidth, innerHeight); renderer.setScissorTest(false);
  renderer.render(raceScene, camera);
  // rear-view mirror (bottom-left inset)
  if (settings.mirror && screen === 'race') {
    const w = Math.round(Math.min(300, innerWidth * 0.2)), h = Math.round(w * 9 / 16), x = 24, y = 24;
    rearCam.position.set(p.x + fx * 0.5, p.y + 2.0, p.z + fz * 0.5); rearCam.lookAt(p.x - fx * 20, p.y + 0.8, p.z - fz * 20);
    rearCam.aspect = w / h; rearCam.updateProjectionMatrix();
    renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
    p.root.visible = false; renderer.render(raceScene, rearCam); p.root.visible = true; renderer.setScissorTest(false);
    const mf = $('mirrorFrame'); mf.style.width = w + 'px'; mf.style.height = h + 'px';
  }
}
function renderMenu(dt) {
  menu.t += dt; menu.turn.rotation.y += dt * 0.5;
  if (menu.pet) menu.pet.position.y = 1.25 + Math.sin(menu.t * 2) * 0.12;
  const garageView = screen === 'garage';
  // title: kart sits low in frame under the logo/menu ; garage: kart on the left, panel on the right
  camera.position.set(garageView ? -3.2 : 2.6, garageView ? 2.2 : 1.6, garageView ? -5.6 : -7.5); camera.lookAt(garageView ? -1.2 : -2.2, garageView ? 0.8 : 1.9, 0);
  camera.fov = 50; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, innerHeight);
  renderer.render(menu.scene, camera);
  world.fx?.update?.(0, 0);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ settings
const bind = (id, key, prop = 'value') => { const el = $(id); el[prop] = settings[key]; el.oninput = el.onchange = () => { settings[key] = prop === 'checked' ? el.checked : +el.value; store.set('settings', settings); audio.setVolumes(settings.music, settings.sfx); renderer.shadowMap.enabled = settings.shadow; }; };
bind('volMusic', 'music'); bind('volSfx', 'sfx'); bind('optShadow', 'shadow', 'checked'); bind('optMirror', 'mirror', 'checked'); bind('optLines', 'lines', 'checked');

// ------------------------------------------------------------------ boot
(async () => {
  show('loading'); $('loadText').textContent = '에셋 라이브러리 불러오는 중…';
  try {
    await loadManifest();
    for (const k of Object.keys(combo)) if (!byId[combo[k]]) combo[k] = list(GCATS.find(c => c[0] === k)[1])[0].id;
    await setMenuCombo();
    show('title');
  } catch (e) { $('loadText').textContent = '로드 실패: ' + e.message + ' — bio_kart_assets 폴더에서 node serve.js 실행 후 /game/ 으로 접속하세요.'; console.error(e); }
})();
window.BK = { race, world, combo, lobby, TRACKS, startRace, show, keys, sim(sec, dt = 1 / 60) { for (let i = 0; i < sec / dt; i++) stepRace(dt); renderRace(dt); } };

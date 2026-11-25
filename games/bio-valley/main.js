// 바이오 밸리 타이쿤: 시작 · 입력 · 화면 · 소리 · 저장
import * as THREE from 'three';
import { World, detectQuality, N, tileX, tileZ, toTile } from './world.js';
import { Game } from './game.js';
import { BIOMES, BIOME_IDS } from './biomes.js';
import * as D from './data.js';
import { icon, paperBackground, $, fmt, toast, modal, veil } from './ui.js';
import { PaperSound } from './lib/paper-sound.js';

const SAVE_KEY = 'bioValley1', PREF_KEY = 'bioValleyPrefs';
let prefs = { blur: true, sound: true, music: true };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch {}
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} };
const quality = detectQuality();
paperBackground();

const world = new World($('#gl'), { quality });
world.blurOn = prefs.blur;
const game = new Game(world, {});
window.BV = { world, game, D };

// ---------------------------------------------------------------------------------------------------------------
// 소리: 종이 펄럭(건설·철거), 동전, 오르골 배경음
// ---------------------------------------------------------------------------------------------------------------
const snd = new PaperSound({ volume: 0.8 });
let actx = null, musicT = 0, musicOn = false;
function unlockAudio() { try { actx = snd.unlock(); if (prefs.music && !musicOn) startMusic(); } catch {} }
function chime(f0 = 880) {
  if (!actx || !prefs.sound) return;
  const t = actx.currentTime;
  for (const [f, d] of [[f0, 0], [f0 * 1.5, 0.08]]) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.06, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.5); o.connect(g); g.connect(actx.destination); o.start(t + d); o.stop(t + d + 0.55); }
}
function tick() { if (!actx || !prefs.sound) return; const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'triangle'; o.frequency.value = 520; g.gain.setValueAtTime(0.025, t); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.07); o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.08); }
game.hooks.sound = (k, n = 1) => {
  if (!prefs.sound) return;
  if (k === 'build') snd.flap({ size: Math.min(1, 0.3 + n * 0.2), up: true });
  else if (k === 'fold') snd.flap({ size: Math.min(1, 0.3 + n * 0.2), up: false });
  else if (k === 'coin') chime(988);
};
const SCALES = { autumn: [0, 2, 4, 7, 9], pine: [0, 3, 5, 7, 10], desert: [0, 1, 4, 7, 8], snow: [0, 2, 4, 7, 11], spring: [0, 2, 4, 7, 9] };
let mBus = null;
function startMusic() {
  if (!actx || musicOn) return; musicOn = true;
  mBus = actx.createGain(); mBus.gain.value = 0.05;
  const dl = actx.createDelay(1); dl.delayTime.value = 0.36; const fb = actx.createGain(); fb.gain.value = 0.32; const lp = actx.createBiquadFilter(); lp.frequency.value = 2200;
  mBus.connect(lp); lp.connect(actx.destination); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(actx.destination);
  musicT = actx.currentTime + 0.3;
}
let mStep = 0, mNote = 2;
function music() {
  if (!musicOn || !actx || !prefs.music) return;
  const sc = SCALES[game.biome ? game.biome.id : 'autumn'], base = game.biome && game.biome.id === 'snow' ? 69 : 64;
  while (musicT < actx.currentTime + 0.4) {
    const beat = 0.42;
    if (mStep % 16 === 0) for (const k of [0, 2, 4]) note(base - 24 + sc[(k + (mStep / 16 | 0) % 2) % 5], musicT, beat * 7, 0.35, 'sine');
    if (Math.random() < 0.62) { mNote = Math.max(0, Math.min(9, mNote + Math.round((Math.random() - 0.5) * 3))); note(base + sc[mNote % 5] + 12 * Math.floor(mNote / 5) - 12, musicT, beat * 1.6, 0.8, 'triangle'); }
    musicT += beat; mStep++;
  }
}
function note(m, t, d, v, type) { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.5, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(mBus); o.start(t); o.stop(t + d + 0.05); }

// ---------------------------------------------------------------------------------------------------------------
// 저장
// ---------------------------------------------------------------------------------------------------------------
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch { return null; } }
function saveGame(silent = true) {
  if (game.preview || !game.biome) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.toSave())); if (!silent) toast('저장했어요.'); } catch { if (!silent) toast('저장 공간이 부족해요.'); }
  try { const best = JSON.parse(localStorage.getItem('bioValleyBest') || '{}'); best.pop = Math.max(best.pop || 0, game.pop); best.value = Math.max(best.value || 0, game.value()); best.games = best.games || 1; localStorage.setItem('bioValleyBest', JSON.stringify(best)); } catch {}
}
game.hooks.save = () => saveGame(true);
addEventListener('visibilitychange', () => { if (document.hidden) saveGame(true); });
addEventListener('pagehide', () => saveGame(true));

// ---------------------------------------------------------------------------------------------------------------
// 시작 화면
// ---------------------------------------------------------------------------------------------------------------
let screen = 'title', previewBiome = 'autumn';
function buildWorld(biomeId, opts) {
  veil(true, opts.preview ? '종이로 땅을 접는 중…' : '마을 터를 펼치는 중…');
  return new Promise((res) => setTimeout(() => {
    game.start(biomeId, opts);
    game.raiseWorld(true);
    veil(false);
    res();
  }, 60));
}
function showTitle() {
  screen = 'title';
  $('#hud').classList.add('hidden'); $('#title').classList.remove('hidden'); $('#biomes').classList.add('hidden'); $('#menu1').classList.remove('hidden');
  const s = loadSave();
  const m = $('#menu1');
  m.innerHTML = '';
  if (s) m.innerHTML += `<button class="bigbtn sheet primary" id="bCont">${icon('play')}<span>이어하기<small>${BIOMES[s.biome].name} · ${s.year}년차 ${s.month}월 · ${fmt(s.money)} 코인</small></span></button>`;
  m.innerHTML += `<button class="bigbtn sheet ${s ? '' : 'primary'}" id="bNew">${icon('flag')}<span>새 마을 만들기<small>빈 땅에서 바이오 산업 단지를 세워요</small></span></button>`;
  m.innerHTML += `<button class="bigbtn sheet" id="bHelp">${icon('info')}<span>하는 법</span></button>`;
  m.innerHTML += `<button class="bigbtn sheet" id="bHub">${icon('home2')}<span>BIO ARCADE로 돌아가기</span></button>`;
  if (s) $('#bCont').onclick = () => { unlockAudio(); startPlay(s.biome, { save: s }); };
  $('#bNew').onclick = () => { unlockAudio(); pickBiome(s); };
  $('#bHelp').onclick = () => help();
  $('#bHub').onclick = () => { location.href = '../index.html'; };
}
function pickBiome(hasSave) {
  $('#menu1').classList.add('hidden'); $('#biomes').classList.remove('hidden');
  const box = $('#bcards'); box.innerHTML = '';
  for (const id of BIOME_IDS) {
    const b = BIOMES[id], sw = [b.ground.base, b.trees[Object.keys(b.trees)[0]].leaf[0], b.style.roof, b.style.accent, b.bush.leaf[0]];
    const el = document.createElement('button');
    el.className = 'bcard sheet' + (id === previewBiome ? ' on' : '');
    el.innerHTML = `<div class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</div><b>${b.name}</b><span>${b.desc}</span><em>${b.bonusText}</em>`;
    el.onclick = async () => { if (previewBiome === id) return; tick(); previewBiome = id; for (const c of box.children) c.classList.toggle('on', c === el); await buildWorld(id, { preview: true, seed: 7 }); };
    box.appendChild(el);
  }
  const go = $('#bgo');
  go.innerHTML = `<button class="bigbtn sheet" id="bBack">뒤로</button><button class="bigbtn sheet primary" id="bStart">${icon('flag')}<span>이 땅에서 시작</span></button>`;
  $('#bBack').onclick = () => showTitle();
  $('#bStart').onclick = () => {
    const doIt = () => startPlay(previewBiome, {});
    if (hasSave) modal(`<h2>새 마을을 시작할까요?</h2><p>지금 저장된 마을은 사라져요.</p><div class="btns"><button class="btn" id="mNo">취소</button><button class="btn bad" id="mYes">새로 시작</button></div>`, (b, close) => { $('#mNo', b).onclick = close; $('#mYes', b).onclick = () => { close(); doIt(); }; });
    else doIt();
  };
  if (game.biome && game.biome.id !== previewBiome) buildWorld(previewBiome, { preview: true, seed: 7 });
}
async function startPlay(biomeId, opts) {
  $('#title').classList.add('hidden');
  await buildWorld(biomeId, opts);
  screen = 'play';
  $('#hud').classList.remove('hidden');
  buildHud();
  setMode('view');
  if (!opts.save) {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    setTimeout(() => toast(`<b>${BIOMES[biomeId].name}</b>에 오신 걸 환영해요!`, '아래 「도로」를 눌러 입구에서부터 길을 깔아 보세요. 건물은 도로 옆에만 지을 수 있어요.', 9000), 1600);
    game.say('바이오 밸리 개척을 시작했어요.');
    saveGame(true);
  } else toast('이어서 해요!', `${game.year}년차 ${game.month}월`);
}

// ---------------------------------------------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------------------------------------------
const TOOLS = [
  ['road', '도로', 'road'], ['home', '주거', 'home'], ['farm', '생산', 'leaf'], ['factory', '가공', 'factory'], ['lab', '연구', 'flask'], ['life', '편의', 'heart'], ['deco', '조경', 'tree'],
  ['sep'], ['demolish', '철거', 'shovel'], ['land', '땅', 'flag'], ['sep'], ['research', '연구실', 'micro'], ['finance', '재정', 'chart'], ['goals', '목표', 'star'], ['menu', '메뉴', 'gear'],
];
function buildHud() {
  $('#top').innerHTML = `
    <div class="chip sheet" id="city"><b></b><small></small></div>
    <div class="chip sheet" id="cMoney" title="돈">${icon('coin')}<span class="num"></span></div>
    <div class="chip sheet" id="cPop" title="인구/집 크기">${icon('people')}<span class="num"></span><small></small></div>
    <div class="chip sheet" id="cHappy" title="평균 행복">${icon('smile')}<span class="num"></span></div>
    <div class="chip sheet" id="cBio" title="바이오매스(원료)">${icon('sprout')}<span class="num"></span><small></small></div>
    <div class="chip sheet" id="cRes" title="연구">${icon('micro')}<span class="num"></span></div>
    <div class="chip sheet" id="cDate">${icon('cal')}<span class="num"></span></div>
    <div class="chip sheet" id="spd">
      <button class="sb" data-s="0">${icon('pause')}</button><button class="sb" data-s="1">${icon('play')}</button><button class="sb" data-s="2">${icon('ff')}</button><button class="sb" data-s="4">${icon('fff')}</button>
    </div>`;
  for (const b of $('#spd').querySelectorAll('.sb')) b.onclick = () => { tick(); setSpeed(+b.dataset.s); };
  $('#cMoney').onclick = () => openPanel('finance'); $('#cRes').onclick = () => openPanel('research'); $('#cPop').onclick = () => openPanel('goals'); $('#cHappy').onclick = () => openPanel('goals');
  $('#side').innerHTML = `<button class="rb sheet" id="rL" title="왼쪽으로 돌리기 (Q)">${icon('rotl')}</button><button class="rb sheet" id="rR" title="오른쪽으로 돌리기 (E)">${icon('rotr')}</button><button class="rb sheet" id="zI" title="가까이">${icon('zin')}</button><button class="rb sheet" id="zO" title="멀리">${icon('zout')}</button><button class="rb sheet" id="vPol" title="오염 보기">${icon('smoke')}</button>`;
  $('#rL').onclick = () => { tick(); world.rotate(-1); }; $('#rR').onclick = () => { tick(); world.rotate(1); };
  $('#zI').onclick = () => world.zoom(0.75); $('#zO').onclick = () => world.zoom(1.33);
  $('#vPol').onclick = () => { polView = !polView; world.setPolView(polView); $('#vPol').classList.toggle('on', polView); if (polView) toast('오염 보기', '초록은 깨끗, 갈색일수록 오염이 심해요. 폐기물 처리장이 오염을 줄여요.'); };
  const t = $('#tools'); t.innerHTML = '';
  for (const [id, name, ic] of TOOLS) {
    if (id === 'sep') { const s = document.createElement('i'); s.className = 'tb sep'; t.appendChild(s); continue; }
    const b = document.createElement('button'); b.className = 'tb'; b.dataset.t = id; b.innerHTML = icon(ic) + name;
    b.onclick = () => { tick(); toolClick(id); };
    t.appendChild(b);
  }
  updateHud(true);
}
let polView = false, hudT = 0;
function setSpeed(s) { if (s === 0) game.paused = true; else { game.paused = false; game.speed = s; } updateHud(true); }
function updateHud(force) {
  if (screen !== 'play') return;
  const g = game, L = g.level();
  $('#city b').textContent = L.name; $('#city small').textContent = BIOMES[g.biome.id].name;
  $('#cMoney .num').textContent = fmt(g.money); $('#cMoney').classList.toggle('bad', g.money < 0);
  $('#cPop .num').textContent = fmt(g.pop); $('#cPop small').textContent = '/ ' + fmt(g.cap);
  $('#cHappy .num').textContent = g.happy; $('#cHappy .ic').outerHTML = icon(g.happy >= 45 ? 'smile' : 'frown');
  $('#cBio .num').textContent = fmt(g.biomass); $('#cBio small').textContent = '/ ' + fmt(g.store || 60);
  const t = D.TECH.find((x) => x.id === g.research);
  $('#cRes .num').textContent = t ? Math.min(99, Math.floor(g.rp / t.cost * 100)) + '%' : (g.techDone.size === D.TECH.length ? '완료' : '—');
  $('#cDate .num').textContent = `${g.year}년차 ${g.month}월`;
  for (const b of document.querySelectorAll('#spd .sb')) b.classList.toggle('on', g.paused ? b.dataset.s === '0' : +b.dataset.s === g.speed);
  // 할 일(다음 목표)
  const m = D.MILESTONES.find((x) => !g.milestones.has(x.id)), td = $('#todo');
  if (m) { td.classList.remove('hidden'); td.innerHTML = `${icon('star')}<span><b>할 일</b> ${m.text} <span class="num" style="color:var(--accent2)">+${m.reward}</span></span>`; }
  else td.classList.add('hidden');
  if (panelKind && (force || panelKind !== 'menu')) refreshPanel();
}

// ---------------------------------------------------------------------------------------------------------------
// 도구·모드
// ---------------------------------------------------------------------------------------------------------------
let mode = 'view', buildType = null, ghost = null, ghostAt = null, roadDrag = null, sel = null, drawerCat = null, hover = null;
function toolClick(id) {
  if (['research', 'finance', 'goals', 'menu'].includes(id)) { openPanel(id); return; }
  if (id === 'road') { setMode(mode === 'road' ? 'view' : 'road'); return; }
  if (id === 'demolish') { setMode(mode === 'demolish' ? 'view' : 'demolish'); return; }
  if (id === 'land') { setMode(mode === 'land' ? 'view' : 'land'); return; }
  if (drawerCat === id) { closeDrawer(); setMode('view'); return; }
  openDrawer(id);
}
function setMode(m, type = null) {
  mode = m; buildType = type;
  if (ghost) { world.baker.kill(ghost); ghost = null; }
  ghostAt = null; roadDrag = null;
  world.setPreview([]); world.setGrid(m !== 'view');
  $('#confirm').classList.add('hidden'); $('#tip').classList.add('hidden');
  for (const b of document.querySelectorAll('#tools .tb')) {
    const t = b.dataset.t;
    b.classList.toggle('on', (t === 'road' && m === 'road') || (t === 'demolish' && m === 'demolish') || (t === 'land' && m === 'land') || (t === drawerCat && m === 'build'));
  }
  if (m !== 'build') { if (m !== 'view') closeDrawer(); }
  if (m === 'road') toast('도로 깔기', isTouch ? '한 손가락으로 끌어서 도로를 그려요. 두 손가락으로 화면을 움직여요.' : '누른 채로 끌어서 도로를 그려요. 오른쪽 버튼으로 화면 이동.', 3500);
  if (m === 'demolish') toast('철거', '건물·도로·나무를 눌러 치워요. 건물은 값의 40%를 돌려받아요.', 3500);
  if (m === 'land') toast('땅 사기', '어두운 땅(8×8 구역)을 눌러 사요. 지금 가진 땅과 붙어 있어야 해요.', 3500);
  if (m === 'view' && sel === null) {}
}
function openDrawer(cat) {
  drawerCat = cat; closePanel();
  const list = D.ORDER[cat], dr = $('#drawer');
  $('#dtitle').innerHTML = `${icon(TOOLS.find((t) => t[0] === cat)[2])}${D.CATS.find((c) => c.id === cat).name} <small>${{ home: '주민이 살 집', farm: '바이오매스(원료)를 만들어요', factory: '원료를 가공해 돈을 벌어요', lab: '연구 점수와 높은 수입', life: '주변 집의 행복을 올려요', deco: '작은 장식(행복 조금)' }[cat]}</small>`;
  const box = $('#cards'); box.innerHTML = '';
  for (const type of list) {
    const d = D.BUILD[type];
    if (d.biome && d.biome !== game.biome.id && !game.unlocked.has(type)) continue;
    const lock = !game.unlocked.has(type), tech = lock && D.TECH.find((t) => (t.unlock || []).includes(type));
    const el = document.createElement('button');
    el.className = 'card' + (lock ? ' lock' : '') + (buildType === type ? ' on' : '');
    const tag = d.res ? `주민 ${d.res[d.res.length - 1]}명까지` : d.prod ? `원료 +${d.prod}/일 · 일손 ${d.jobs}` : d.use ? `원료 ${d.use} → ${d.use * d.val}코인/일` : d.rev ? `수입 ${d.rev}/일 · 일손 ${d.jobs}` : d.rp ? `연구 +${d.rp}/일` : d.clean ? '오염 줄이기' : d.store ? `저장 +${d.store}` : d.waterR ? '물 공급' : d.hap ? `행복 +${d.hap}` : '';
    el.innerHTML = `<div class="ph">${icon(TOOLS.find((t) => t[0] === cat)[2])}</div><b>${d.name}</b><span class="price num">${fmt(d.cost)} 코인</span><span class="tag">${d.size}×${d.size} · ${tag}</span>${lock ? `<span class="lk">${tech ? tech.name : '잠김'}</span>` : ''}`;
    el.onclick = () => {
      tick();
      if (lock) { toast(`${d.name}은(는) 아직 잠겨 있어요.`, tech ? `연구실에서 「${tech.name}」을(를) 연구하면 열려요.` : ''); return; }
      for (const c of box.children) c.classList.toggle('on', c === el);
      setMode('build', type);
      if (isTouch && innerWidth < 700) closeDrawer();
      toast(d.name, d.desc + (isTouch ? ' 땅을 눌러 자리를 고른 뒤 「짓기」를 눌러요.' : ''), 3500);
    };
    box.appendChild(el);
    // 실제 종이 모형 사진(천천히 하나씩)
    iconQueue.push([type, el.querySelector('.ph')]);
  }
  dr.classList.remove('closed');
  setMode('view');
  drawerCat = cat;
}
function closeDrawer() { drawerCat = null; $('#drawer').classList.add('closed'); }
const iconCache = new Map(), iconQueue = [];
function pumpIcons() {
  const it = iconQueue.shift(); if (!it) return;
  const [type, ph] = it;
  if (!ph.isConnected) return;
  let url = iconCache.get(game.biome.id + type);
  if (!url) { const key = type === 'house' ? 'b:house:1:0' : type === 'tree' ? `d:${game.mainTree}:0` : 'b:' + type; try { url = world.iconOf(key, 192); iconCache.set(game.biome.id + type, url); } catch (e) { console.warn(e); return; } }
  ph.outerHTML = `<img src="${url}" alt="">`;
}

// ---------------------------------------------------------------------------------------------------------------
// 입력
// ---------------------------------------------------------------------------------------------------------------
const cv = $('#gl'), isTouch = matchMedia('(pointer: coarse)').matches;
const ptrs = new Map();
let gesture = null;   // { kind: 'pan'|'pinch'|'road'|'tap', ... }
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  unlockAudio(); cv.focus();
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, b: e.button, t: performance.now() });
  if (screen !== 'play') { gesture = { kind: 'pan' }; return; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; roadDrag = null; if (mode === 'road') world.setPreview([]); return; }
  if (e.button === 2 || e.button === 1) { gesture = { kind: 'pan' }; return; }
  if (mode === 'road') { const t = tileAt(e.clientX, e.clientY); if (t) { roadDrag = { a: t, b: t }; previewRoad(); } gesture = { kind: 'road' }; return; }
  if (mode === 'demolish' && !isTouch) { gesture = { kind: 'demo' }; demolishAt(e.clientX, e.clientY, true); return; }
  gesture = { kind: 'tap' };
});
cv.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') hoverAt(e.clientX, e.clientY); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.kind === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    world.zoom(gesture.d / Math.max(10, d)); world.pan(cx - gesture.cx, cy - gesture.cy);
    gesture.d = d; gesture.cx = cx; gesture.cy = cy; return;
  }
  if (gesture.kind === 'tap' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 8) gesture = { kind: 'pan' };
  if (gesture.kind === 'pan') { world.pan(dx, dy); return; }
  if (gesture.kind === 'road' && roadDrag) { const t = tileAt(e.clientX, e.clientY); if (t && (t[0] !== roadDrag.b[0] || t[1] !== roadDrag.b[1])) { roadDrag.b = t; previewRoad(); } return; }
  if (gesture.kind === 'demo') { demolishAt(e.clientX, e.clientY, true); return; }
  if (e.pointerType === 'mouse') hoverAt(e.clientX, e.clientY);
});
const endPtr = (e) => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (!p || !gesture) return;
  if (gesture.kind === 'pinch') { if (ptrs.size < 2) gesture = ptrs.size ? { kind: 'none' } : null; return; }
  if (gesture.kind === 'road') { if (roadDrag) placeRoadPath(); gesture = null; return; }
  if (gesture.kind === 'tap' && e.type === 'pointerup') tapAt(e.clientX, e.clientY, e.pointerType);
  gesture = ptrs.size ? { kind: 'none' } : null;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', (e) => { e.preventDefault(); world.zoom(Math.pow(1.0015, e.deltaY)); }, { passive: false });
const keys = new Set();
addEventListener('keydown', (e) => {
  if (screen !== 'play' || e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.code === 'KeyQ') world.rotate(-1); else if (e.code === 'KeyE') world.rotate(1);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') world.zoom(0.8); else if (e.code === 'Minus' || e.code === 'NumpadSubtract') world.zoom(1.25);
  else if (e.code === 'Space') { e.preventDefault(); setSpeed(game.paused ? game.speed || 1 : 0); }
  else if (e.code === 'Escape') { if (panelKind) closePanel(); else { closeDrawer(); setMode('view'); deselect(); } }
  else if (e.code === 'KeyR') toolClick('road'); else if (e.code === 'KeyX' || e.code === 'Delete') toolClick('demolish');
  else if (/^Digit[1-7]$/.test(e.code)) toolClick(['road', 'home', 'farm', 'factory', 'lab', 'life', 'deco'][+e.code.slice(5) - 1]);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('resize', () => world.resize());

function tileAt(sx, sy) { const p = world.pick(sx, sy); if (!p) return null; const i = toTile(p.x), j = toTile(p.z); return i >= 0 && j >= 0 && i < N && j < N ? [i, j] : null; }
function hoverAt(sx, sy) {
  if (screen !== 'play') return;
  hover = [sx, sy];
  const t = tileAt(sx, sy), tip = $('#tip');
  if (mode === 'build' && t) { moveGhost(t); showTip(sx, sy); return; }
  if (mode === 'demolish' && t) { const b = game.at(t[0], t[1]); const cells = b ? cellsOf(b, 1, 1) : [[t[0], t[1], 1, 1]]; world.setPreview(cells); const what = b ? `${D.BUILD[b.type].name} 철거 (+${D.BUILD[b.type].deco ? 0 : Math.round(D.BUILD[b.type].cost * 0.4)})` : game.isRoad(t[0], t[1]) ? '도로 철거' : game.decor[t[1] * N + t[0]].length ? `나무·바위 치우기 (-${game.decor[t[1] * N + t[0]].length * D.CLEAR_COST})` : ''; tipText(sx, sy, what); return; }
  if (mode === 'land' && t) { const { pi, pj } = game.parcelOf(t[0], t[1]), e = game.canBuy(pi, pj), cells = []; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) cells.push([pi * 8 + x, pj * 8 + y, e ? 0 : 1]); world.setPreview(e === 'owned' ? [] : cells); tipText(sx, sy, e === 'owned' ? '' : e ? landErr(e) : `이 땅 사기: ${fmt(game.landPrice())} 코인`, !!e); return; }
  if (mode === 'road' && t && !roadDrag) { const e = game.canRoad(t[0], t[1]); world.setPreview([[t[0], t[1], e && e !== 'dup' ? 0 : 1]]); tipText(sx, sy, e && e !== 'dup' ? errText(e) : `도로 ${fmt(game.roadPrice(t[0], t[1]))}`, !!e && e !== 'dup'); return; }
  tip.classList.add('hidden');
}
function tipText(sx, sy, txt, err = false) { const tip = $('#tip'); if (!txt || isTouch) { tip.classList.add('hidden'); return; } tip.textContent = txt; tip.className = 'sheet' + (err ? ' err' : ''); tip.style.left = sx + 'px'; tip.style.top = sy + 'px'; }
const errText = (e) => ({ own: '내 땅이 아니에요(땅 사기)', water: '물 위에는 지을 수 없어요', occupied: '이미 무언가 있어요', bld: '건물이 있어요', road: '도로 옆에 지어야 해요', money: '돈이 모자라요', lock: '연구가 필요해요', map: '맵 밖이에요', dup: '' }[e] || e);
const landErr = (e) => ({ far: '가진 땅과 붙어 있어야 해요', money: `돈이 모자라요 (${fmt(game.landPrice())})`, map: '' }[e] || e);
function cellsOf(b, ok, sp) { const c = []; for (let y = b.j; y < b.j + b.n; y++) for (let x = b.i; x < b.i + b.n; x++) c.push([x, y, ok, sp]); return c; }

// 건설 미리보기(유령 모형)
function anchorFor(t, n) { return [t[0] - Math.floor((n - 1) / 2), t[1] - Math.floor((n - 1) / 2)]; }
function moveGhost(t) {
  const d = D.BUILD[buildType], [i, j] = anchorFor(t, d.size), c = game.check(buildType, i, j);
  ghostAt = { i, j, c };
  world.setPreview(c.cells);
  const key = buildType === 'house' ? 'b:house:1:0' : buildType === 'tree' ? `d:${game.mainTree}:0` : 'b:' + buildType;
  const x = tileX(i) + (d.size - 1) * 3, z = tileZ(j) + (d.size - 1) * 3, yaw = c.face ? c.face.yaw : 0, tint = c.ok ? '#d8f0c8' : '#f2b8a8';
  if (!ghost || ghost.b.key !== key) { if (ghost) world.baker.kill(ghost); ghost = world.baker.add(key, { x, z, yaw, s: d.deco ? 0.8 : 1, tint }); }
  else { world.baker.move(ghost, x, z, yaw); if (ghost.tint !== tint) world.baker.setTint(ghost, tint); }
}
function showTip(sx, sy) {
  if (!ghostAt) return;
  const { c } = ghostAt, d = D.BUILD[buildType];
  tipText(sx, sy, c.ok ? `${d.name} · ${fmt(c.cost)} 코인${c.cost > d.cost ? ' (나무 치우기 포함)' : ''}` : errText(c.err), !c.ok);
}
function tapAt(sx, sy, ptype) {
  const t = tileAt(sx, sy);
  if (mode === 'build') {
    if (!t) return;
    const d = D.BUILD[buildType], [i, j] = anchorFor(t, d.size);
    if (ptype === 'mouse' || (ghostAt && ghostAt.i === i && ghostAt.j === j)) { tryBuild(i, j); return; }
    moveGhost(t); showConfirm(); return;
  }
  if (mode === 'demolish') { demolishAt(sx, sy, false); return; }
  if (mode === 'land') { if (!t) return; const { pi, pj } = game.parcelOf(t[0], t[1]); landBuy(pi, pj); return; }
  if (mode === 'road') return;
  // 보기: 사람 → 건물 순으로 고르기
  const a = pickAgent(sx, sy);
  if (a) { select({ agent: a }); return; }
  if (t) { const b = game.at(t[0], t[1]); if (b) { select({ b }); return; } }
  deselect();
}
function showConfirm() {
  const box = $('#confirm'), c = ghostAt && ghostAt.c, d = D.BUILD[buildType];
  if (!c) return;
  box.classList.remove('hidden');
  box.innerHTML = `<button class="btn" id="cfNo">${icon('x')} 그만</button><button class="btn pri" id="cfYes" ${c.ok ? '' : 'disabled'}>${icon('check')} ${c.ok ? `짓기 ${fmt(c.cost)}` : errText(c.err)}</button>`;
  $('#cfNo').onclick = () => { tick(); setMode('view'); closeDrawer(); };
  $('#cfYes').onclick = () => tryBuild(ghostAt.i, ghostAt.j);
}
function tryBuild(i, j) {
  const r = game.build(buildType, i, j);
  if (!r.ok) { toast(errText(r.err)); if (r.err === 'road') toast('건물 앞에 도로가 있어야 주민과 트럭이 드나들어요.'); return; }
  if (ghost) { world.baker.kill(ghost); ghost = null; }
  game.recalc();
  ghostAt = null; $('#confirm').classList.add('hidden');
  const d = D.BUILD[buildType];
  if (!d.deco && !d.res) toast(`${d.name}을(를) 지었어요!`, d.sci);
  if (hover) hoverAt(hover[0], hover[1]);
  updateHud(true);
}
function roadCells() {
  if (!roadDrag) return [];
  const [a0, a1] = roadDrag.a, [b0, b1] = roadDrag.b, out = [];
  const horiz = Math.abs(b0 - a0) >= Math.abs(b1 - a1);
  const step = (v, t) => (t > v ? 1 : -1);
  if (horiz) { for (let x = a0; ; x += step(a0, b0)) { out.push([x, a1]); if (x === b0) break; } for (let y = a1; y !== b1;) { y += step(a1, b1); out.push([b0, y]); } }
  else { for (let y = a1; ; y += step(a1, b1)) { out.push([a0, y]); if (y === b1) break; } for (let x = a0; x !== b0;) { x += step(a0, b0); out.push([x, b1]); } }
  return out;
}
function previewRoad() {
  let cost = 0, okAll = true;
  const cells = roadCells().map(([i, j]) => { const e = game.canRoad(i, j); if (!e) cost += game.roadPrice(i, j); if (e && e !== 'dup') okAll = false; return [i, j, e && e !== 'dup' ? 0 : 1]; });
  world.setPreview(cells);
  const p = ptrs.size ? [...ptrs.values()][0] : null;
  if (p) tipText(p.x, p.y, `도로 ${cells.length}칸 · ${fmt(cost)} 코인${okAll ? '' : ' (빨간 칸은 못 깔아요)'}`, !okAll || cost > game.money);
}
function placeRoadPath() {
  let n = 0, fail = null;
  for (const [i, j] of roadCells()) { const e = game.placeRoad(i, j); if (!e) n++; else if (e !== 'dup' && !fail) fail = e; }
  roadDrag = null; world.setPreview([]); $('#tip').classList.add('hidden');
  if (n) { game.hooks.sound('build', 0.2); game.recalc(); }
  if (fail && fail !== 'dup') toast(errText(fail));
  updateHud(true);
}
function demolishAt(sx, sy, drag) {
  const t = tileAt(sx, sy); if (!t) return;
  const [i, j] = t, b = game.at(i, j);
  if (b) {
    if (drag && !D.BUILD[b.type].deco) { if (!gesture || gesture.kind !== 'demo' || gesture.first) return; }
    const d = D.BUILD[b.type];
    const go = () => { game.demolish(b); if (sel && sel.b === b) deselect(); game.recalc(); updateHud(true); };
    if (d.cost >= 800) modal(`<h2>${d.name} 철거</h2><p>${b.residents ? `사는 주민 ${b.residents}명이 떠나요. ` : ''}${fmt(d.cost * 0.4)} 코인을 돌려받아요.</p><div class="btns"><button class="btn" id="mNo">취소</button><button class="btn bad" id="mYes">철거</button></div>`, (bx, close) => { $('#mNo', bx).onclick = close; $('#mYes', bx).onclick = () => { close(); go(); }; });
    else go();
    if (gesture) gesture.first = true;
    return;
  }
  if (game.isRoad(i, j)) { const e = game.removeRoad(i, j); if (e === 'gate') toast('입구 도로는 치울 수 없어요.'); else { game.hooks.sound('fold', 0.2); game.recalc(); } return; }
  const k = j * N + i;
  if (game.decor[k].length && game.owned[k]) { const c = game.decor[k].length * D.CLEAR_COST; if (game.money < c) { toast('돈이 모자라요.'); return; } game.spend(c, '건설'); game.clearDecor(i, j); game.hooks.sound('fold', 0.3); }
  else if (game.decor[k].length && !drag) toast('내 땅이 아니에요.');
}
function landBuy(pi, pj) {
  const e = game.canBuy(pi, pj);
  if (e === 'owned') return;
  if (e) { toast(landErr(e)); return; }
  modal(`<h2>땅 사기</h2><p>8×8 칸 구역을 <b>${fmt(game.landPrice())}</b> 코인에 살까요? 살수록 값이 올라요.</p><div class="btns"><button class="btn" id="mNo">취소</button><button class="btn pri" id="mYes">${icon('flag')} 사기</button></div>`, (bx, close) => { $('#mNo', bx).onclick = close; $('#mYes', bx).onclick = () => { close(); const r = game.buyParcel(pi, pj); if (r) toast(landErr(r)); else { toast('새 땅을 샀어요!'); world.setPreview([]); updateHud(true); } }; });
}
function pickAgent(sx, sy) {
  let best = null, bd = 30;
  const v = new THREE.Vector3();
  for (const a of game.agents) {
    if (a.done || a.truck) continue;
    v.set(a.h.x, 1.3, a.h.z).project(world.camera);
    const x = (v.x + 1) / 2 * world.W, y = (1 - v.y) / 2 * world.H, d = Math.hypot(x - sx, y - sy);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function select(s) {
  deselect();
  sel = s;
  if (s.b && s.b.h) world.baker.setTint(s.b.h, '#fff2c0');
  openPanel(s.b ? 'building' : 'person');
}
function deselect() { if (sel && sel.b && sel.b.h && sel.b.h.alive) world.baker.setTint(sel.b.h, null); sel = null; if (panelKind === 'building' || panelKind === 'person') closePanel(); }

// ---------------------------------------------------------------------------------------------------------------
// 패널(종이 한 장)
// ---------------------------------------------------------------------------------------------------------------
let panelKind = null;
function openPanel(kind) { panelKind = kind; if (kind !== 'building' && kind !== 'person') closeDrawer(); refreshPanel(true); $('#panel').classList.remove('closed'); }
function closePanel() { const k = panelKind; panelKind = null; $('#panel').classList.add('closed'); if ((k === 'building' || k === 'person') && sel) { const s = sel; sel = null; if (s.b && s.b.h && s.b.h.alive) world.baker.setTint(s.b.h, null); } }
let lastPanelHtml = '';
function refreshPanel(force = false) {
  const p = $('#panel');
  const html = panelHtml(panelKind);
  if (html == null) { closePanel(); return; }
  if (!force && html === lastPanelHtml) return;
  // 입력 중인 버튼 깜빡임을 막기 위해 바뀔 때만
  lastPanelHtml = html;
  const st = p.scrollTop;
  p.innerHTML = `<button class="x" id="pX">${icon('x')}</button>` + html;
  p.scrollTop = st;
  $('#pX').onclick = () => { tick(); closePanel(); };
  bindPanel(panelKind, p);
}
const pct = (v) => Math.round(v * 100) + '%';
function bar(v, col) { return `<div class="bar"><i style="width:${Math.max(0, Math.min(100, v * 100))}%;${col ? 'background:' + col : ''}"></i></div>`; }
function panelHtml(kind) {
  const g = game;
  if (kind === 'building') {
    const b = sel && sel.b; if (!b || !g.buildings.has(b.id)) return null;
    const d = D.BUILD[b.type];
    let h = `<h2>${d.name}${d.res ? ` <small class="num" style="font-size:13px">${b.level}단계</small>` : ''}</h2><p>${d.desc}</p>`;
    if (d.road && !b.conn) h += `<p style="color:var(--bad);font-weight:700">입구까지 이어진 도로가 없어요! 도로를 이어 주세요.</p>`;
    if (d.res) {
      const cap = d.res[b.level];
      h += `<div class="row"><span>주민</span><b>${b.residents} / ${cap}명</b></div><div class="row"><span>행복</span><b>${b.happy}</b></div>${bar(b.happy / 100, b.happy < 40 ? '#c8603f' : null)}`;
      h += `<p style="font-style:italic">“${b.thought || '…'}”</p>`;
      if (b.type === 'house' && b.level < 3) h += `<p style="font-size:12.5px;color:var(--ink2)">행복이 ${b.level === 1 ? 66 : 78} 이상이고 집이 거의 차면 두 달 뒤 ${b.level + 1}층으로 커져요.</p>`;
    }
    if (d.jobs) h += `<div class="row"><span>일손</span><b>${Math.round(Math.ceil(d.jobs * g.techFx('jobs')) * g.staffRatio * 10) / 10} / ${Math.ceil(d.jobs * g.techFx('jobs'))}명</b></div>`;
    if (d.jobs || d.rev) h += `<div class="row"><span>가동률</span><b>${pct(b.eff || 0)}</b></div>${bar(Math.min(1, b.eff || 0))}`;
    if (d.prod) h += `<div class="row"><span>원료 생산</span><b>${(b.out || 0).toFixed(1)} / 일</b></div>`;
    if (d.needTrees) h += `<div class="row"><span>주변 나무</span><b>${b.trees || 0}그루</b></div>`;
    if (d.use) h += `<div class="row"><span>원료 사용</span><b>${(b.used || 0).toFixed(1)} / ${(d.use * (b.eff || 0)).toFixed(1)}</b></div>${b.short ? '<p style="color:var(--bad);font-size:13px">원료가 모자라요. 생산 시설을 더 지어요.</p>' : ''}`;
    if (d.use || d.rev) h += `<div class="row"><span>하루 수입</span><b class="num">${fmt(b.made || 0)} 코인</b></div>`;
    if (d.rp) h += `<div class="row"><span>연구</span><b>+${(d.rp * (b.eff || 0)).toFixed(1)} / 일</b></div>`;
    if (d.hap && !d.res) h += `<div class="row"><span>주변 행복</span><b>+${d.hap} (반경 ${d.hapR}칸)</b></div>`;
    if (d.pol) h += `<div class="row"><span>오염</span><b>${d.pol >= 0.4 ? '많음' : d.pol >= 0.2 ? '보통' : '적음'} (반경 ${d.polR}칸)</b></div>`;
    if (d.clean) h += `<div class="row"><span>오염 정화</span><b>반경 ${d.cleanR}칸</b></div>`;
    if (d.upkeep) h += `<div class="row"><span>유지비</span><b>${d.upkeep} / 달</b></div>`;
    if (g.biome.bonus[b.type]) h += `<div class="row"><span>${g.biome.name} 보너스</span><b style="color:${g.biome.bonus[b.type] >= 1 ? 'var(--ok)' : 'var(--bad)'}">×${g.biome.bonus[b.type]}</b></div>`;
    if (d.sci) h += `<div class="sci">${icon('micro')} ${d.sci}</div>`;
    h += `<div class="btns"><button class="btn bad" id="pDemo">${icon('shovel')} 철거${d.deco ? '' : ` (+${fmt(d.cost * 0.4)})`}</button></div>`;
    return h;
  }
  if (kind === 'person') {
    const a = sel && sel.agent; if (!a || a.done) return null;
    const what = { go: '일하러 가는 중', home: '집에 가는 중', arrive: '바이오 밸리로 이사 오는 중', leave: '마을을 떠나는 중' }[a.kind] || '산책 중';
    const home = a.home && g.buildings.has(a.home.id) ? a.home : null;
    return `<h2>${icon('people')} ${a.name}</h2><p>${what}</p>${home ? `<p style="font-style:italic">“${home.thought || '…'}”</p><div class="row"><span>집 행복</span><b>${home.happy}</b></div>${bar(home.happy / 100)}` : ''}<p style="font-size:12.5px;color:var(--ink2)">주민의 생각을 보면 마을에 무엇이 필요한지 알 수 있어요.</p>`;
  }
  if (kind === 'finance') {
    const last = g.history[g.history.length - 1];
    let h = `<h2>${icon('chart')} 재정</h2>`;
    h += `<div class="row"><span>돈</span><b class="num">${fmt(g.money)} 코인</b></div><div class="row"><span>기업 가치</span><b class="num">${fmt(g.value())}</b></div><div class="row"><span>이번 달</span><b class="num" style="color:${g.stats.income - g.stats.expense >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmt(g.stats.income - g.stats.expense)}</b></div>`;
    h += `<div class="row"><span>대출 (이자 1%/달)</span><b class="num">${fmt(g.loan)}</b></div><div class="btns" style="margin-top:4px"><button class="btn" id="fLoan">+5,000 빌리기</button><button class="btn" id="fRepay" ${g.loan > 0 ? '' : 'disabled'}>5,000 갚기</button></div>`;
    h += `<p class="cap" style="margin-top:12px">세율 ${g.tax}%</p><div class="seg" id="fTax">${[6, 8, 10, 12, 14, 16].map((t) => `<button data-v="${t}" class="${g.tax === t ? 'on' : ''}">${t}%</button>`).join('')}</div><p style="font-size:12.5px;color:var(--ink2)">세금이 높으면 돈은 더 들어오지만 주민 행복이 떨어져요.</p>`;
    h += `<p class="cap" style="margin-top:10px">연구비</p><div class="seg" id="fFund">${['조금', '보통', '많이', '최대'].map((t, i) => `<button data-v="${i}" class="${g.fund === i ? 'on' : ''}">${t}<br><small>${[0, 5, 10, 20][i] * 20}/달</small></button>`).join('')}</div>`;
    h += `<p class="cap" style="margin-top:10px">지난 달들 (수입 / 지출)</p><canvas class="chart" id="fChart"></canvas>`;
    if (last) { h += `<p class="cap" style="margin-top:8px">${last.m === 1 ? 12 : last.m - 1}월 내역</p>`; for (const [k, v] of Object.entries(last.cats).sort((a, b) => b[1] - a[1])) h += `<div class="row"><span>${k}</span><b class="num" style="color:${v >= 0 ? 'var(--ok)' : 'var(--bad)'}">${fmt(v)}</b></div>`; }
    return h;
  }
  if (kind === 'research') {
    const t = D.TECH.find((x) => x.id === g.research);
    let rpd = 0, school = 1; for (const b of g.buildings.values()) { const d = D.BUILD[b.type]; if (d.rp) rpd += d.rp * (b.eff || 0); if (d.research && b.eff > 0.3) school = d.research; }
    rpd *= school * [0.35, 1, 1.5, 2][g.fund];
    let h = `<h2>${icon('micro')} 연구실</h2>`;
    if (!g.count('lab')) h += `<p style="color:var(--bad);font-weight:700">연구소를 지어야 연구가 빨라져요. (연구 탭)</p>`;
    h += t ? `<div class="row"><span>연구 중</span><b>${t.name}</b></div>${bar(g.rp / t.cost, 'var(--teal)')}<div class="row"><span>진행</span><b class="num">${Math.floor(g.rp)} / ${t.cost} (하루 +${rpd.toFixed(1)})</b></div>` : `<p>연구할 기술을 골라요.</p>`;
    h += `<p class="cap" style="margin-top:10px">기술 (눌러서 고르기)</p>`;
    for (const x of D.TECH) {
      const done = g.techDone.has(x.id), on = x.id === g.research;
      const opens = (x.unlock || []).map((u) => D.BUILD[u].name).join(', ');
      h += `<button class="tech ${done ? 'done' : ''} ${on ? 'on' : ''}" data-t="${x.id}">${done ? icon('check') : ''}<b>${x.name}</b> <span class="num" style="float:right">${done ? '완료' : x.cost + '점'}</span><small>${opens ? '열림: ' + opens + ' · ' : ''}${x.sci}</small></button>`;
    }
    return h;
  }
  if (kind === 'goals') {
    const yrs = D.GOAL.years, left = Math.max(0, yrs * 12 - ((g.year - 1) * 12 + g.month - 1));
    let h = `<h2>${icon('star')} 목표</h2><p><b>${g.level().name}</b> · 인구 ${fmt(g.pop)}명</p>`;
    h += `<p class="cap">개척 목표 (${yrs}년 안에)</p><div class="row"><span>인구 ${D.GOAL.pop}명</span><b class="num">${fmt(g.pop)}</b></div>${bar(g.pop / D.GOAL.pop)}<div class="row"><span>기업 가치 ${fmt(D.GOAL.value)}</span><b class="num">${fmt(g.value())}</b></div>${bar(g.value() / D.GOAL.value)}`;
    h += g.goalDone ? `<p style="color:var(--ok);font-weight:700">목표를 이뤘어요! 이제 마음껏 도시를 키워요.</p>` : `<p style="font-size:12.5px;color:var(--ink2)">남은 기간: ${Math.floor(left / 12)}년 ${left % 12}달${left === 0 ? ' (기한이 지났지만 계속 도전할 수 있어요)' : ''}</p>`;
    h += `<p class="cap" style="margin-top:8px">할 일</p>`;
    for (const m of D.MILESTONES) { const done = g.milestones.has(m.id); h += `<div class="ms ${done ? 'done' : ''}">${icon(done ? 'check' : 'dot')}<span style="flex:1">${m.text}</span><span class="num">+${m.reward}</span></div>`; }
    h += `<p class="cap" style="margin-top:10px">${g.biome.name} 보너스</p><p>${g.biome.bonusText}</p>`;
    return h;
  }
  if (kind === 'menu') {
    return `<h2>${icon('gear')} 메뉴</h2>
      <div class="btns"><button class="btn pri" id="mSave">${icon('save')} 저장</button><button class="btn" id="mHelp">${icon('info')} 하는 법</button><button class="btn" id="mTitle">처음 화면</button><button class="btn" id="mHub">${icon('home2')} 아케이드</button></div>
      <p class="cap" style="margin-top:14px">그래픽 (다시 불러와요)</p><div class="seg" id="sGfx">${[['high', '선명'], ['mid', '보통'], ['low', '가볍게']].map(([k, n]) => `<button data-v="${k}" class="${quality === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="cap" style="margin-top:10px">미니어처 흐림</p><div class="seg" id="sBlur"><button data-v="1" class="${prefs.blur ? 'on' : ''}">켜기</button><button data-v="0" class="${prefs.blur ? '' : 'on'}">끄기</button></div>
      <p class="cap" style="margin-top:10px">효과음 · 배경음</p><div class="seg" id="sSnd"><button data-v="s" class="${prefs.sound ? 'on' : ''}">효과음</button><button data-v="m" class="${prefs.music ? 'on' : ''}">배경음</button></div>
      <p style="font-size:12px;color:var(--ink2);margin-top:10px">${{ high: '선명', mid: '보통', low: '가볍게' }[quality]} 그래픽 · ${Math.round(fps)} fps</p>`;
  }
  return null;
}
function bindPanel(kind, p) {
  const g = game;
  if (kind === 'building') { const b = sel.b; $('#pDemo', p).onclick = () => { demolishTarget(b); }; }
  if (kind === 'finance') {
    $('#fLoan', p).onclick = () => { const e = g.takeLoan(5000); if (e) toast('더 빌릴 수 없어요 (최대 30,000).'); else chime(660); refreshPanel(true); updateHud(true); };
    $('#fRepay', p).onclick = () => { g.repay(5000); refreshPanel(true); updateHud(true); };
    for (const b of p.querySelectorAll('#fTax button')) b.onclick = () => { g.tax = +b.dataset.v; g.recalc(); tick(); refreshPanel(true); updateHud(true); };
    for (const b of p.querySelectorAll('#fFund button')) b.onclick = () => { g.fund = +b.dataset.v; tick(); refreshPanel(true); };
    drawChart($('#fChart', p));
  }
  if (kind === 'research') for (const b of p.querySelectorAll('.tech')) b.onclick = () => { const id = b.dataset.t; if (g.techDone.has(id)) return; g.research = id; tick(); refreshPanel(true); updateHud(true); };
  if (kind === 'menu') {
    $('#mSave', p).onclick = () => saveGame(false);
    $('#mHelp', p).onclick = () => help();
    $('#mTitle', p).onclick = () => { saveGame(true); closePanel(); setMode('view'); previewBiome = g.biome.id; buildWorld(previewBiome, { preview: true, seed: 7 }).then(showTitle); };
    $('#mHub', p).onclick = () => { saveGame(true); location.href = '../index.html'; };
    for (const b of p.querySelectorAll('#sGfx button')) b.onclick = () => { if (b.dataset.v === quality) return; try { localStorage.setItem('bioValleyGfx', b.dataset.v); } catch {} saveGame(true); location.reload(); };
    for (const b of p.querySelectorAll('#sBlur button')) b.onclick = () => { prefs.blur = b.dataset.v === '1'; world.blurOn = prefs.blur; savePrefs(); refreshPanel(true); };
    for (const b of p.querySelectorAll('#sSnd button')) b.onclick = () => { if (b.dataset.v === 's') prefs.sound = !prefs.sound; else { prefs.music = !prefs.music; if (mBus) mBus.gain.value = prefs.music ? 0.05 : 0; if (prefs.music) startMusic(); } savePrefs(); refreshPanel(true); };
  }
}
function demolishTarget(b) {
  const d = D.BUILD[b.type];
  modal(`<h2>${d.name} 철거</h2><p>${b.residents ? `사는 주민 ${b.residents}명이 떠나요. ` : ''}${d.deco ? '' : fmt(d.cost * 0.4) + ' 코인을 돌려받아요.'}</p><div class="btns"><button class="btn" id="mNo">취소</button><button class="btn bad" id="mYes">철거</button></div>`, (bx, close) => { $('#mNo', bx).onclick = close; $('#mYes', bx).onclick = () => { close(); game.demolish(b); deselect(); game.recalc(); updateHud(true); }; });
}
function drawChart(c) {
  const h = game.history.slice(-12); if (!c) return;
  const dpr = devicePixelRatio || 1, W = c.clientWidth || 320, H = 120; c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  if (!h.length) { g.fillStyle = 'rgba(74,48,32,.6)'; g.font = '13px sans-serif'; g.fillText('한 달이 지나면 그래프가 나와요.', 8, 60); return; }
  const mx = Math.max(100, ...h.map((x) => Math.max(x.inc, x.exp))), bw = W / 12;
  h.forEach((x, k) => {
    const x0 = k * bw + 4;
    g.fillStyle = '#6f9a50'; g.fillRect(x0, H - 16 - (x.inc / mx) * (H - 24), bw * 0.36, (x.inc / mx) * (H - 24));
    g.fillStyle = '#c8603f'; g.fillRect(x0 + bw * 0.4, H - 16 - (x.exp / mx) * (H - 24), bw * 0.36, (x.exp / mx) * (H - 24));
    g.fillStyle = 'rgba(74,48,32,.7)'; g.font = '10px sans-serif'; g.fillText((x.m === 1 ? 12 : x.m - 1) + '월', x0, H - 3);
  });
}
function help() {
  modal(`<h2>하는 법</h2>
    <p><b>1. 도로</b> — 입구(아래쪽 문)에서부터 길을 깔아요. 건물은 도로 옆에만 지을 수 있어요.</p>
    <p><b>2. 숙소</b> — 주민이 살 집을 지어요. 주민이 생기면 세금이 들어오고 일손이 생겨요.</p>
    <p><b>3. 생산 → 가공</b> — 온실 같은 생산 시설이 <b>바이오매스(원료)</b>를 만들고, 발효 공장 같은 가공 시설이 원료를 제품으로 바꿔 돈을 벌어요.</p>
    <p><b>4. 연구</b> — 연구소에서 점수를 모아 새 기술과 건물을 열어요.</p>
    <p><b>5. 행복</b> — 공원·카페가 가깝고 공장 오염이 적으면 집이 2층, 3층으로 커져요. 오염은 폐기물 처리장으로 줄여요.</p>
    <p><b>6. 땅</b> — 돈이 모이면 「땅」 도구로 옆 구역을 사서 넓혀요.</p>
    <p style="font-size:13px;color:var(--ink2)">${isTouch ? '한 손가락: 화면 이동 · 두 손가락: 확대/이동 · 오른쪽 버튼: 화면 돌리기' : '끌기·오른쪽 버튼: 화면 이동 · 휠: 확대 · Q/E: 돌리기 · 1~7: 건설 메뉴 · R: 도로 · X: 철거 · 스페이스: 멈춤'}</p>
    <div class="btns"><button class="btn pri" id="mOk">알겠어요</button></div>`, (b, close) => { $('#mOk', b).onclick = close; });
}

// ---------------------------------------------------------------------------------------------------------------
// 게임 알림
// ---------------------------------------------------------------------------------------------------------------
game.hooks.news = (text, sub) => toast(text, sub, sub ? 7000 : 4200);
game.hooks.month = (st) => { try { if (window.BioGoal) window.BioGoal.progress('bio-valley', game.pop, { text: `${BIOMES[game.biome.id].name} · ${game.year}년차 ${game.month}월 · 인구 ${game.pop}명` }); } catch {}
  const net = st.income - st.expense; toast(`${game.month === 1 ? 12 : game.month - 1}월 결산 <b class="num" style="color:${net >= 0 ? 'var(--ok)' : 'var(--bad)'}">${net >= 0 ? '+' : ''}${fmt(net)}</b> 코인`, `수입 ${fmt(st.income)} · 지출 ${fmt(st.expense)} · 인구 ${game.pop}명`); if (net > 0) chime(784); if (game.money < -3000) toast('돈이 많이 모자라요!', '재정에서 대출을 받거나 세율을 조금 올려 보세요.'); };
game.hooks.tech = () => { chime(1046); if (drawerCat) openDrawer(drawerCat); };
game.hooks.goal = () => { chime(1318); modal(`<h2>${icon('star')} 개척 목표 달성!</h2><p>인구 ${D.GOAL.pop}명, 기업 가치 ${fmt(D.GOAL.value)}을 넘었어요. ${game.year}년차 ${game.month}월에 이뤘어요!</p><p>이제 자유롭게 바이오 메트로폴리스를 만들어 보세요.</p><div class="btns"><button class="btn pri" id="mOk">계속하기</button></div>`, (b, close) => { $('#mOk', b).onclick = close; }); saveGame(true); };

// ---------------------------------------------------------------------------------------------------------------
// 고리
// ---------------------------------------------------------------------------------------------------------------
let last = performance.now(), fps = 60, slow = 0, fast = 0, dprMax = world.renderer.getPixelRatio(), iconT = 0, titleT = 0;
function frame(now) {
  const rdt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  fps = fps * 0.95 + (1 / Math.max(1e-3, rdt)) * 0.05;
  if (screen === 'play') {
    // 키보드 이동
    const sp = world.cam.dist * 0.9 * rdt;
    let dx = 0, dz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (dx || dz) { const y = world.cam.yaw, c = Math.cos(y), s = Math.sin(y); world.cam.tx += (dx * c + dz * s) * sp; world.cam.tz += (-dx * s + dz * c) * sp; }
    hudT -= rdt; if (hudT <= 0) { hudT = 0.25; updateHud(false); }
    iconT -= rdt; if (iconT <= 0 && iconQueue.length) { iconT = 0.05; pumpIcons(); }
  } else if (game.biome) {
    titleT += rdt; world.cam.tx = Math.sin(titleT * 0.05) * 40; world.cam.tz = 40 + Math.cos(titleT * 0.04) * 20;
  }
  if (game.biome) { game.update(rdt); world.render(rdt); }
  music();
  // 해상도 자동 조절
  if (rdt > 1 / 34) { slow += rdt; fast = 0; } else if (rdt < 1 / 57) { fast += rdt; slow = 0; }
  const pr = world.renderer.getPixelRatio();
  if (slow > 2 && pr > 0.75) { world.renderer.setPixelRatio(Math.max(0.75, pr - 0.25)); world.resize(); slow = 0; }
  if (fast > 8 && pr < dprMax) { world.renderer.setPixelRatio(Math.min(dprMax, pr + 0.25)); world.resize(); fast = 0; }
  requestAnimationFrame(frame);
}

// 시작
(async () => {
  const s = loadSave();
  previewBiome = s ? s.biome : 'autumn';
  await buildWorld(previewBiome, { preview: true, seed: 7 });
  showTitle();
  requestAnimationFrame(frame);
})();

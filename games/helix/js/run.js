// 헬릭스 진행: 마을, 출정, 방 순서, 웨이브, 보상과 문, 챕터 이동, 그리기, 메인 루프
'use strict';
// 챕터 안의 방 순서 (9개)
const PLAN = ['combat', 'combat', 'combat', 'midboss', 'combat', 'choice', 'combat', 'preboss', 'boss'];
const REWARD_ICON = {trait: null, atp: 'atp', dna: 'dna', maxhp: 'maxhp', heal: 'heal', upgrade: 'upgrade', shop: 'shop', rest: 'rest', midboss: 'midboss', boss: 'boss', preboss: 'rest', nextch: 'key'};
const REWARD_NAME = {trait: '유전자 변이', atp: 'ATP 결정', dna: 'DNA 샘플', maxhp: '최대 체력', heal: '회복', upgrade: '변이 강화', shop: '상점', rest: '재생 배양조', midboss: '중간 보스', boss: '챕터 보스', preboss: '보스 전 휴식', nextch: '다음 구역'};
const LIN_KEYS = Object.keys(LINEAGE);
let CH = null;   // chapters.json

// ---------------- 에셋 불러오기
const HERO_ANIMS = ['idle', 'run', 'dash', 'atk1', 'atk2', 'atk3', 'spin', 'leap', 'cast', 'throw', 'hit', 'death', 'spawn'];
async function loadCore(onProg) {
  const B = 'helix/assets/';
  const [hero, hfx, tiles, props, npcs, icons, mobs, mfx, chap] = await Promise.all([
    loadJSON('hero', B + 'hero/hero.json'), loadJSON('hfx', B + 'hero/fx.json'), loadJSON('tiles', B + 'world/tiles.json'), loadJSON('props', B + 'world/props.json'),
    loadJSON('npcs', B + 'world/npcs.json'), loadJSON('icons', B + 'world/icons.json'), loadJSON('mobs', B + 'mobs/mobs.json'), loadJSON('mfx', B + 'mobs/fx.json'), loadJSON('chapters', B + 'mobs/chapters.json')]);
  CH = chap;
  for (const a of hero.anims) HA[a.id] = a;
  const jobs = [];
  for (const a of HERO_ANIMS) jobs.push(loadImg('h_' + a, B + 'hero/hero_' + a + '.webp'));
  for (const f of hfx) jobs.push(loadImg(f.id, B + 'hero/' + f.file));
  for (const f of mfx) jobs.push(loadImg(f.id, B + 'mobs/' + f.file));
  for (const k in tiles) jobs.push(loadImg('tiles_' + k, B + 'world/' + tiles[k].file));
  for (const k in npcs) jobs.push(loadImg('npc_' + k, B + 'world/' + npcs[k].file));
  jobs.push(loadImg('props', B + 'world/props.webp'), loadImg('icons', B + 'world/icons.webp'), loadImg('portrait', B + 'hero/portrait.webp'), loadImg('portrait_front', B + 'hero/portrait_front.webp'));
  const t = setInterval(() => onProg && onProg(loadDone / Math.max(1, loadTotal)), 50);
  await Promise.all(jobs); clearInterval(t);
  JS.fxm = {}; for (const f of [...hfx, ...mfx]) JS.fxm[f.id] = f;
}
function chapterMobs(ch) {
  const c = CH[ch - 1]; const s = new Set([...c.mobs, ...c.mid, c.boss]);
  if (ch === 1) ['phage', 'amoeba'].forEach(x => s.add(x)); if (ch === 2) s.add('tick'); if (ch === 3) s.add('clone'); if (ch === 4) s.add('prion');
  return [...s];
}
function loadMobs(ids) {
  const jobs = [];
  for (const id of ids) for (const a of JS.mobs[id].anims) jobs.push(loadImg('m_' + id + '_' + a.id, 'helix/assets/mobs/' + a.file));
  return Promise.all(jobs);
}

// ---------------- 마을
function enterHub(fromDeath = false) {
  G.state = 'hub'; G.run = null; G.room = genHub();
  G.foes = []; G.projs = []; G.zones = []; G.pickups = []; G.allies = []; G.fx = []; PARTS.length = 0; TEXTS.length = 0;
  const P = G.player = newPlayer(); recalcPlayer(P); P.hp = P.maxhp;
  P.x = G.room.entry.x; P.z = G.room.entry.z; P.d = 4; P.ang = -Math.PI / 2; setAct(P, 'spawn');
  G.dummy = {x: 11.2 * TS, z: 6.2 * TS + 4, flash: 0, wob: 0};
  CAM.x = CAM.tx = P.x - VW / 2; CAM.y = CAM.ty = P.z * K - VH / 2;
  AUDIO.music('hub', 0); AUDIO.play('spawn', 0.6);
  G.banner = {t: 0, text: '쉼터', sub: fromDeath ? '재생 장치가 당신을 되살렸습니다' : '연구소 지하의 마지막 안전지대'};
  fadeIn();
  // 다음 출정 지역 미리 불러오기
  loadMobs(chapterMobs(1));
}
function interactables() {
  const R = G.room, L = [];
  if (G.state === 'hub') {
    for (const n of R.npcs) L.push({x: n.x, z: n.z, label: JS.npcs[n.id].name + ' · 대화', act: () => talkTo(n.id), npc: n});
    const alt = R.props.find(p => p.name === 'altar'); if (alt) L.push({x: alt.x, z: alt.z + 20, label: '유전체 강화대', act: openAltar});
    L.push({x: R.portal.x, z: R.portal.z + 30, label: '출정 (1장 배양실)', act: confirmStart});
  } else if (G.state === 'run') {
    for (const p of R.props) {
      if (p.name === 'fountain' && !p.used) L.push({x: p.x, z: p.z + 30, label: '재생 배양조 (체력 40% 회복)', act: () => { p.used = true; heal(G.player, Math.round(G.player.maxhp * 0.4)); AUDIO.play('heal'); G.fx.push({k: 'pillar', x: G.player.x, z: G.player.z, t: 0}); }});
      if (p.name === 'shopkeep_stand') L.push({x: p.x, z: p.z + 34, label: '상점 · ATP로 구매', act: openShop});
    }
  }
  return L;
}
let NEAR = null;
function updInteract() {
  const P = G.player; NEAR = null; let bd = 75;
  if (!P || !['idle', 'run'].includes(P.act)) return;
  for (const it of interactables()) { const d = Math.hypot(it.x - P.x, it.z - P.z); if (d < bd) { bd = d; NEAR = it; } }
  if (NEAR && pressed.has('interact')) { AUDIO.play('click'); NEAR.act(); }
}

// ---------------- 출정 · 방 진행
function startRun() {
  SAVE.runs++; writeSave();
  G.run = {ch: 1, room: 1, slots: {attack: null, special: null, cast: null, dash: null}, passives: [], atp: metaL('gold') * 30, dna: 0, kills: 0, bonusHp: 0, cleared: 0, firstBoost: SAVE.charm === 'charm_d', t0: performance.now()};
  const P = G.player; recalcPlayer(P); P.hp = P.maxhp; P.revives = metaL('revive');
  G.dummy = null;
  goRoom({k: 'trait', lin: pick(LIN_KEYS)}, true);
}
function planKind() { return PLAN[G.run.room - 1]; }
async function goRoom(reward, first = false) {
  const run = G.run;
  fadeOut(async () => {
    const need = chapterMobs(run.ch).filter(id => !IMG['m_' + id + '_idle']);
    if (need.length) { showLoading(true); await loadMobs(chapterMobs(run.ch)); showLoading(false); }
    buildRoom(reward); fadeIn();
  });
}
function buildRoom(reward) {
  const run = G.run, area = AREA_OF[run.ch];
  let kind = planKind();
  if (kind === 'choice') kind = reward.k === 'shop' ? 'shop' : 'rest';
  G.foes = []; G.projs = []; G.zones = []; G.pickups = []; G.allies = []; G.fx = []; G.tele = []; PARTS.length = 0; TEXTS.length = 0;
  if (kind === 'shop' || kind === 'rest' || kind === 'preboss') {
    G.room = genSpecialRoom(area, kind === 'preboss' ? 'rest' : kind);
    if (kind === 'preboss') G.room.addProp('shopkeep_stand', 13.4 * TS, 5.2 * TS);
    G.room.shop = makeShopStock();
  } else G.room = genRoom(area, kind, 0);
  G.room.kind = kind; G.room.reward = reward;
  const P = G.player; P.x = G.room.entry.x; P.z = G.room.entry.z; P.vx = P.vz = 0; P.ang = -Math.PI / 2; P.d = 4; setAct(P, 'idle'); P.inv = 1.0; P.charmBlock = true;
  P.lift = 0; P.afterimg = [];
  CAM.x = CAM.tx = P.x - VW / 2; CAM.y = CAM.ty = P.z * K - VH / 2 - 60;
  G.state = 'run'; G.cleared = false; G.waveT = 0.9; G.rewardDone = false;
  const ch = CH[run.ch - 1];
  if (kind === 'combat') { G.waves = 2 + (run.ch >= 3 ? 1 : 0) + (run.room >= 7 ? 1 : 0) - (run.room === 1 ? 1 : 0); G.waveN = 0; }
  else if (kind === 'midboss') { G.waves = 1; G.waveN = 0; G.midId = pick(ch.mid); }
  else if (kind === 'boss') { G.waves = 1; G.waveN = 0; }
  else { G.waves = 0; G.cleared = true; G.rewardDone = true; openDoors(); }
  const music = kind === 'boss' ? 'boss' : area;
  AUDIO.music(music, kind === 'shop' || kind === 'rest' || kind === 'preboss' ? 0.1 : 0.9);
  G.banner = {t: 0, text: run.room === 1 ? `${run.ch}장 · ${ch.name}` : kind === 'boss' ? JS.mobs[ch.boss].name : kind === 'midboss' ? '중간 보스' : (REWARD_NAME[kind] || ''), sub: run.room === 1 ? ch.desc : `${run.ch}장 · 방 ${run.room} / 9`};
  if (kind === 'combat' || kind === 'midboss' || kind === 'boss') if (run.room !== 1 && kind === 'combat') G.banner = null;
}
function spawnWave() {
  const run = G.run, ch = CH[run.ch - 1], R = G.room, P = G.player, kind = R.kind;
  G.waveN++;
  if (kind === 'midboss') { const s = R.randomFloor(40, P, 280); spawnFoe(G.midId, s.x, s.z); AUDIO.play('roar'); shake(6); return; }
  if (kind === 'boss') { const s = {x: R.gw * TS / 2, z: (R.mainRect[1] + 5) * TS}; spawnFoe(ch.boss, s.x, s.z); AUDIO.play('roar'); shake(10); return; }
  const n = Math.min(9, 2 + Math.floor(run.room / 2) + run.ch + (G.waveN > 1 ? 1 : 0));
  for (let k = 0; k < n; k++) { const s = R.randomFloor(22, P, 230); spawnFoe(pick(ch.mobs), s.x, s.z); }
}
function updRoom(dt) {
  if (G.state !== 'run' || G.cleared) return;
  const alive = G.foes.filter(f => f.st !== 'dead').length;
  if (alive === 0) {
    G.waveT -= dt;
    if (G.waveT <= 0) {
      if (G.waveN < G.waves) { spawnWave(); G.waveT = 0.7; }
      else roomClear();
    }
  } else if (alive <= 1 && G.waveN < G.waves && G.room.kind === 'combat') { G.waveT -= dt * 0.5; if (G.waveT <= -1.2) { spawnWave(); G.waveT = 0.7; } }
}
function roomClear() {
  G.cleared = true; const run = G.run, P = G.player, R = G.room;
  run.cleared++; AUDIO.play('clear'); AUDIO.intensity(0.15);
  if (has('s_pho')) heal(P, traitV('s_pho'));
  G.projs = G.projs.filter(p => p.owner === 'hero'); G.zones = G.zones.filter(z => z.owner === 'hero');
  const c0 = R.nearestFree(R.gw * TS / 2, (R.mainRect[1] + (R.mainRect[3] - R.mainRect[1]) * 0.45) * TS, 56), c = {x: c0[0], z: c0[1]};
  const rw = R.reward;
  if (R.kind === 'boss') {
    dropPickup('dna', c.x - 40, c.z, 25, {isReward: false}); dropPickup('maxhp', c.x + 40, c.z, 25, {isReward: false});
    SAVE.best = Math.max(SAVE.best, run.ch); writeSave();
    G.banner = {t: 0, text: '보스 처치!', sub: run.ch < 4 ? '다음 구역으로 가는 문이 열렸습니다' : '유전체 금고가 잠잠해졌습니다'};
    if (run.ch === 4) { setTimeout(() => victory(), 2600); return; }
    rewardTaken(); return;
  }
  dropPickup('dna', c.x + 60, c.z + 30, R.kind === 'midboss' ? 10 : 1);
  if (R.kind === 'midboss') { const p = dropPickup('trait', c.x, c.z, 0, {lin: pick(LIN_KEYS), minRar: 1, isReward: true}); return; }
  dropReward(rw, c);
}
function dropReward(rw, c) {
  if (!rw) { rewardTaken(); return; }
  if (rw.k === 'trait') dropPickup('trait', c.x, c.z, 0, {lin: rw.lin, isReward: true});
  else if (rw.k === 'upgrade') { if (ownedTraits().length) dropPickup('upgrade', c.x, c.z, 0, {isReward: true}); else dropPickup('trait', c.x, c.z, 0, {lin: pick(LIN_KEYS), isReward: true}); }
  else if (rw.k === 'atp') { for (let k = 0; k < 6; k++) dropPickup('atp', c.x + rand(-20, 20), c.z + rand(-20, 20), 8 + Math.floor(Math.random() * 6), {isReward: k === 0}); }
  else if (rw.k === 'dna') dropPickup('dna', c.x, c.z, 6 + Math.floor(Math.random() * 6) + G.run.ch * 2, {isReward: true});
  else if (rw.k === 'maxhp') dropPickup('maxhp', c.x, c.z, 25, {isReward: true});
  else if (rw.k === 'heal') dropPickup('heal', c.x, c.z, 0.5, {isReward: true});
  else rewardTaken();
}
function rewardTaken() { if (G.rewardDone) return; G.rewardDone = true; openDoors(); }
function ownedTraits() { const r = G.run; const o = []; for (const s in r.slots) if (r.slots[s]) o.push(r.slots[s]); return o.concat(r.passives); }
function openDoors() {
  const run = G.run, R = G.room;
  const next = run.room + 1;
  let rewards;
  if (R.kind === 'boss') rewards = [{k: run.ch < 4 ? 'nextch' : 'nextch'}];
  else if (next > 9) rewards = [{k: 'nextch'}];
  else {
    const nk = PLAN[next - 1];
    if (nk === 'midboss') rewards = [{k: 'midboss'}];
    else if (nk === 'boss') rewards = [{k: 'boss'}];
    else if (nk === 'choice') rewards = [{k: 'shop'}, {k: 'rest'}];
    else if (nk === 'preboss') rewards = [{k: 'preboss'}];
    else {
      const n = Math.random() < 0.3 ? 3 : 2, pool = ['trait', 'trait', 'trait', 'atp', 'dna', 'maxhp', 'heal'];
      if (ownedTraits().length >= 2) pool.push('upgrade', 'upgrade');
      const used = new Set(), lins = shuffle(LIN_KEYS.slice());
      rewards = [];
      for (let k = 0; k < n; k++) { let kk; let tries = 0; do { kk = pick(pool); tries++; } while (used.has(kk) && kk !== 'trait' && tries < 20); used.add(kk); rewards.push(kk === 'trait' ? {k: 'trait', lin: lins.pop()} : {k: kk}); }
    }
  }
  // 문 배치 (특수방은 이미 문 1개)
  if (!R.doors.length || R.doors.length !== rewards.length) {
    R.doors = [];
    const [i0, j0, i1] = R.mainRect, ci = Math.floor((i0 + i1) / 2) + 0.5, w = i1 - i0;
    const cols = rewards.length === 1 ? [ci] : rewards.length === 2 ? [ci - w * 0.25, ci + w * 0.25] : [ci - w * 0.32, ci, ci + w * 0.32];
    for (const c of cols) { const ii = Math.floor(c); R.doors.push({i: ii, x: (ii + 0.5) * TS, z: j0 * TS + 4}); }
  }
  R.doors.forEach((d, k) => { d.reward = rewards[k]; d.open = true; d.openT = 0; });
  AUDIO.play('door');
}
function updDoors() {
  if (G.state !== 'run') return;
  const P = G.player;
  for (const d of G.room.doors) {
    if (!d.open) continue;
    if (Math.abs(P.x - d.x) < 36 && P.z < d.z + 34 && ['idle', 'run'].includes(P.act)) { useDoor(d); break; }
  }
}
function useDoor(d) {
  const run = G.run; if (G.leaving) return; G.leaving = true;
  AUDIO.play('portal', 0.6);
  if (d.reward.k === 'nextch') {
    if (run.ch >= 4) { victory(); return; }
    run.ch++; run.room = 1; SAVE.best = Math.max(SAVE.best, run.ch - 1); writeSave();
    goRoom({k: 'trait', lin: pick(LIN_KEYS)}); setTimeout(() => G.leaving = false, 800); return;
  }
  run.room++;
  goRoom(d.reward); setTimeout(() => G.leaving = false, 800);
}
function onPlayerDead() {
  const run = G.run;
  if (!run) { enterHub(true); return; }
  SAVE.bestRooms = Math.max(SAVE.bestRooms, (run.ch - 1) * 9 + run.room); writeSave();
  setTimeout(() => showResults(false), 300);
}
function victory() {
  const run = G.run; if (!run || run.won) return; run.won = true;
  SAVE.wins++; SAVE.best = 4; writeSave(); AUDIO.music('title', 0);
  showResults(true);
}

// ---------------- 화면 전환
function fadeOut(cb) { G.fadeTo = 1; G.fadeCb = cb; }
function fadeIn() { G.fade = 1; G.fadeTo = 0; G.fadeCb = null; }
function updFade(dt) {
  if (G.fade < G.fadeTo) { G.fade = Math.min(G.fadeTo, G.fade + dt * 3.5); if (G.fade >= G.fadeTo && G.fadeCb) { const cb = G.fadeCb; G.fadeCb = null; cb(); } }
  else if (G.fade > G.fadeTo) G.fade = Math.max(G.fadeTo, G.fade - dt * 2.5);
}

// ================================================================ 그리기
function heroImgDraw(P, alpha = 1) {
  const A = ACT[P.act]; const anim = A ? A.anim : P.act === 'run' ? 'run' : 'idle';
  const n = HFR[anim], img = IMG['h_' + anim];
  let f;
  if (P.act === 'idle') f = Math.floor(G.time * 8) % n;
  else if (P.act === 'run') f = Math.floor(P.at * 15) % n;
  else f = Math.min(n - 1, Math.floor(P.at / P.alen * n));
  const C = JS.hero.cell, foot = JS.hero.foot;
  const flash = P.flash > 0 ? Math.min(1, P.flash) * 0.8 : 0;
  const blink = P.inv > 0 && P.hurtT > 0 && Math.floor(G.time * 30) % 2 ? 0.45 : alpha;
  drawFrame(img, f * C, P.d * C, C, C, SX(P.x) - C / 2, SY(P.z, P.lift) - foot, flash, blink);
  if (P.shield > 0) { ctx.strokeStyle = 'rgba(90,176,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(SX(P.x), SY(P.z, 40), 26, 34, 0, 0, TAU); ctx.stroke(); }
}
function drawHeroAfter(P) {
  const img = IMG.h_dash, C = JS.hero.cell, foot = JS.hero.foot;
  ctx.globalCompositeOperation = 'lighter';
  for (const a of P.afterimg) { ctx.globalAlpha = 0.35 * (1 - a.t / 0.25); ctx.drawImage(img, a.f * C, a.d * C, C, C, SX(a.x) - C / 2, SY(a.z) - foot, C, C); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawFoe(f) {
  const {a, i} = foeFrame(f); const img = IMG['m_' + f.id + '_' + a.id]; const C = f.cell;
  let alpha = 1;
  if (f.st === 'spawn') alpha = Math.min(1, f.t / 0.6);
  if (f.st === 'dead') { const L = f.tier === 'boss' ? 1.6 : 0.9; if (f.t > L) alpha = Math.max(0, 1 - (f.t - L) / 0.5); }
  if (f.hidden) return;
  drawFrame(img, i * C, f.d * C, C, C, SX(f.x) - C / 2, SY(f.z) - f.foot, f.flash > 0 ? f.flash * 0.85 : f.buff > 0 ? 0.12 : 0, alpha);
  if (f.acid > 0 && Math.random() < 0.15) burst(f.x + rand(-f.r, f.r), f.z, rand(10, f.foot * 0.6), '#ff8a2a', 1, 30, 0.4, 2, -60);
  if (f.mark > 0) { ctx.fillStyle = '#5ab0ff'; const x = SX(f.x), y = SY(f.z, f.foot * 0.75 + 14); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.fill(); }
  if (f.tier === 'normal' && f.hp < f.maxhp && f.st !== 'dead') hpBar(SX(f.x) - 14, SY(f.z) + 6, 28, 3, f.hp / f.maxhp, '#ff5a6a');
  if (f.tier === 'mid' && f.st !== 'dead') hpBar(SX(f.x) - 34, SY(f.z) + 8, 68, 5, f.hp / f.maxhp, '#ffc040');
}
function hpBar(x, y, w, h, v, col) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#3a1620'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * clamp(v, 0, 1)), h); }
function drawProp(p) {
  const m = p.m, f = p.anim ? Math.floor(G.time * 6) % m.n : p.frame || 0;
  ctx.drawImage(IMG.props, m.x + f * m.w, m.y, m.w, m.h, SX(p.x) - m.w / 2, SY(p.z) - m.foot, m.w, m.h);
}
function drawNPC(n) {
  const M = JS.npcs[n.id], img = IMG['npc_' + n.id], C = M.cell, P = G.player;
  const d = Math.hypot(P.x - n.x, P.z - n.z) < 160 ? dir8(Math.atan2(P.z - n.z, P.x - n.x)) : n.d;
  const f = Math.floor(G.time * 7 + n.x) % M.frames;
  ctx.drawImage(img, f * C, d * C, C, C, SX(n.x) - C / 2, SY(n.z) - M.foot, C, C);
}
function drawDoor(d) {
  const m = JS.props.gate;
  ctx.drawImage(IMG.props, m.x + (d.open ? m.w : 0), m.y, m.w, m.h, SX(d.x) - m.w / 2, SY(d.z) - m.foot, m.w, m.h);
  if (d.open && d.reward) {
    const bob = Math.sin(G.time * 3 + d.x) * 3, x = SX(d.x), y = SY(d.z) - m.foot - 24 + bob;
    ctx.fillStyle = 'rgba(8,10,16,.7)'; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
    const rk = d.reward.k; const ic = rk === 'trait' ? 'orb_' + d.reward.lin : REWARD_ICON[rk];
    const col = rk === 'trait' ? LINEAGE[d.reward.lin].col : rk === 'boss' ? '#ff5a6a' : rk === 'midboss' ? '#ffc040' : '#3cffae';
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.stroke();
    icon(ic, x - 16, y - 16, 32);
    const P = G.player; if (Math.abs(P.x - d.x) < 110 && P.z - d.z < 220) {
      ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; const t = rk === 'trait' ? LINEAGE[d.reward.lin].name : REWARD_NAME[rk];
      ctx.fillStyle = '#05040a'; ctx.fillText(t, x + 1, y + 33); ctx.fillStyle = col; ctx.fillText(t, x, y + 32);
    }
  }
}
function drawPickup(p) {
  const bob = Math.sin(G.time * 4 + p.x) * 3, x = SX(p.x), y = SY(p.z, p.h + 18 + bob);
  shadow(p.x, p.z, 8, 0.3);
  let ic = p.k === 'trait' ? 'orb_' + p.lin : REWARD_ICON[p.k] || 'atp';
  const s = p.k === 'atp' ? 18 : p.k === 'trait' || p.k === 'upgrade' ? 36 : 28;
  if (p.k === 'trait' || p.k === 'upgrade' || p.k === 'dna') {
    const col = p.k === 'trait' ? LINEAGE[p.lin].col : '#3cffae';
    const g = ctx.createRadialGradient(x, y, 2, x, y, s); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }
  icon(ic, x - s / 2, y - s / 2, s);
}
function drawZone(z) {
  const a = Math.min(1, (z.life - z.t) * 2) * 0.55;
  const col = z.kind === 'acid' ? `rgba(255,138,42,${a * 0.6})` : z.kind === 'shock' ? `rgba(255,224,64,${a * 0.45})` : `rgba(140,255,60,${a * 0.55})`;
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(SX(z.x), SY(z.z), z.r, z.r * K, 0, 0, TAU); ctx.fill();
  if (z.kind === 'shock' && Math.random() < 0.3) { ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 1; ctx.beginPath(); const a0 = Math.random() * TAU, r = z.r * Math.random(); ctx.moveTo(SX(z.x + Math.cos(a0) * r), SY(z.z + Math.sin(a0) * r)); ctx.lineTo(SX(z.x + Math.cos(a0 + 0.6) * r * 0.6), SY(z.z + Math.sin(a0 + 0.6) * r * 0.6)); ctx.stroke(); }
  if (Math.random() < 0.08) burst(z.x + rand(-z.r, z.r) * 0.7, z.z + rand(-z.r, z.r) * 0.7, 2, z.kind === 'foeAcid' ? '#a8ff3a' : '#ffb060', 1, 20, 0.6, 2, -40);
}
function drawTele(T, f) {
  const u = clamp(T.t / T.life, 0, 1), x = SX(T.x), y = SY(T.z);
  ctx.save();
  const fill = T.thin ? `rgba(255,70,90,${0.25 + 0.3 * u})` : `rgba(255,50,70,${0.12 + 0.22 * u})`, edge = `rgba(255,90,110,${0.5 + 0.5 * u})`;
  ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2;
  if (T.shape === 'circle') {
    ctx.beginPath(); ctx.ellipse(x, y, T.r, T.r * K, 0, 0, TAU); ctx.stroke(); ctx.fill();
    ctx.fillStyle = `rgba(255,60,80,${0.3})`; ctx.beginPath(); ctx.ellipse(x, y, T.r * u, T.r * K * u, 0, 0, TAU); ctx.fill();
  } else if (T.shape === 'cone') {
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k <= 16; k++) { const a = T.ang - T.arc / 2 + T.arc * k / 16; ctx.lineTo(x + Math.cos(a) * T.r, y + Math.sin(a) * T.r * K); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (T.shape === 'line') {
    ctx.translate(x, y); ctx.scale(1, K); ctx.rotate(T.ang);
    ctx.fillRect(0, -T.w / 2, T.len, T.w); ctx.strokeRect(0, -T.w / 2, T.len, T.w);
    if (!T.thin) { ctx.fillStyle = 'rgba(255,60,80,0.3)'; ctx.fillRect(0, -T.w / 2, T.len * u, T.w); }
  }
  ctx.restore();
}
function drawFxSprite(id, f, x, z, h = 0, anchorY = 0.62) {
  const m = JS.fxm[id], img = IMG[id]; if (!m || !img || f < 0 || f >= m.frames) return;
  ctx.drawImage(img, f * m.w, 0, m.w, m.h, SX(x) - m.w / 2, SY(z, h) - Math.round(m.h * anchorY), m.w, m.h);
}
function updFx(dt) { for (let i = G.fx.length - 1; i >= 0; i--) { const e = G.fx[i]; e.t += dt; if (e.t > (e.life || 1.2)) G.fx.splice(i, 1); } }
function drawFxAll() {
  for (const e of G.fx) {
    const u = e.life ? e.t / e.life : 0;
    if (e.k === 'ring' || e.k === 'slam') {
      const r = lerp(e.r0, e.r1, Math.min(1, u * 1.2)); ctx.strokeStyle = e.col; ctx.globalAlpha = 1 - u; ctx.lineWidth = e.k === 'slam' ? 4 : 2;
      ctx.beginPath(); ctx.ellipse(SX(e.x), SY(e.z), r, r * K, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      if (e.k === 'slam' && e.t < 0.05) burst(e.x, e.z, 2, ['#8a7a6a', e.col], 14, 260, 0.5, 3);
    } else if (e.k === 'bolt') {
      if (e.t > 0.18) { e.life = 0.18; continue; }
      ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2; ctx.beginPath();
      const n = 7; for (let k = 0; k <= n; k++) { const t = k / n; const x = lerp(SX(e.x0), SX(e.x1), t) + (k && k < n ? rand(-8, 8) : 0), y = lerp(SY(e.z0, e.h0), SY(e.z1, e.h1), t) + (k && k < n ? rand(-8, 8) : 0); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.strokeStyle = '#ffe040'; ctx.lineWidth = 1; ctx.stroke();
    } else if (e.k === 'shock') { drawFxSprite('fx_shock', Math.floor(e.t * 20), e.x, e.z); e.life = 0.5; }
    else if (e.k === 'splash') { drawFxSprite('fx_splash', Math.floor(e.t * 18), e.x, e.z); e.life = 0.56; }
    else if (e.k === 'pillar') { drawFxSprite('fx_ritual', Math.floor(e.t * 14), e.x, e.z, 0, 0.5); drawFxSprite('fx_pillar', Math.floor(e.t * 12), e.x, e.z, 0, 0.94); e.life = 0.85; }
    else if (e.k === 'ritual') { drawFxSprite('fx_ritual', Math.floor(e.t * 14), e.x, e.z, 0, 0.5); e.life = 0.86; }
    else if (e.k === 'burst') { const id = e.col && /^#(?:[0-9a-f]{2})(?:[0-9a-f]{2})/i.test(e.col) ? (['#ff', '#e0'].some(s => e.col.startsWith(s)) ? 'fx_burst_r' : ['#a8', '#7a', '#3c', '#46', '#5a', '#c8'].some(s => e.col.startsWith(s)) ? 'fx_burst_y' : 'fx_burst_p') : 'fx_burst_p'; drawFxSprite(id, Math.floor(e.t * 16), e.x, e.z); e.life = 0.5; }
    else if (e.k === 'spawnring') { const r = 30 * (1 - Math.min(1, e.t / 0.6)) + 8; ctx.strokeStyle = e.col; ctx.globalAlpha = 1 - e.t / 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(SX(e.x), SY(e.z), r * 1.6, r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = e.col; ctx.globalAlpha *= 0.25; ctx.fillRect(SX(e.x) - 3, SY(e.z) - 120 * (1 - e.t), 6, 120 * (1 - e.t)); ctx.globalAlpha = 1; e.life = 0.7; }
  }
}
function drawProjs() {
  ctx.globalCompositeOperation = 'source-over';
  for (const p of G.projs) {
    if (p.k === 'flask') { drawFxSprite('fx_flask', Math.floor(p.t * 16) % 4, p.x, p.z, p.h, 0.5); shadow(p.x, p.z, 6, 0.3); continue; }
    shadow(p.x, p.z, 5, 0.25);
    const x = SX(p.x), y = SY(p.z, p.h), col = p.col || '#a8ff3a';
    const g = ctx.createRadialGradient(x, y, 1, x, y, 14); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.fillRect(x - 14, y - 14, 28, 28);
    if (p.k === 'spore' || p.k === 'acid') drawFxSprite('fx_spore', Math.floor(p.t * 12) % 4, p.x, p.z, p.h, 0.5);
  }
}
function drawBeams() {
  for (const f of G.foes) if (f.beamT && f.st === 'atk') {
    const T = f.beamT, x = SX(T.x), y = SY(T.z, 60);
    const w = T.w * (0.6 + 0.4 * Math.sin(G.time * 40));
    ctx.save(); ctx.translate(x, y); ctx.scale(1, K); ctx.rotate(T.ang);
    ctx.fillStyle = 'rgba(60,255,174,0.5)'; ctx.fillRect(0, -w / 2, T.len, w); ctx.fillStyle = '#e8fff4'; ctx.fillRect(0, -w / 6, T.len, w / 3);
    ctx.restore();
  }
}
let VIG = null;
function vignette() {
  if (!VIG) { VIG = document.createElement('canvas'); VIG.width = VW; VIG.height = VH; const x = VIG.getContext('2d'); const g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g; x.fillRect(0, 0, VW, VH); }
  ctx.drawImage(VIG, 0, 0);
}
const TINT = {hub: 'rgba(40,90,70,0.06)', lab: 'rgba(60,120,160,0.06)', sewer: 'rgba(20,80,60,0.1)', ward: 'rgba(120,40,160,0.07)', vault: 'rgba(60,20,140,0.1)'};
function render() {
  const R = G.room;
  ctx.fillStyle = R ? JS.tiles[R.area].void : '#05060a'; ctx.fillRect(0, 0, VW, VH);
  if (!R || !G.player) return;
  const cx = camX(), cy = camY();
  ctx.drawImage(R.canvas, cx, cy + OY, VW, VH, 0, 0, VW, VH);
  // 바닥에 붙는 것들
  for (const z of G.zones) drawZone(z);
  for (const f of G.foes) if (f.tele && f.st === 'wind') { f.tele.t = f.t; f.tele.life = f.windT; drawTele(f.tele, f); }
  for (const f of G.foes) if (f.hidden && f.st === 'under') { ctx.fillStyle = 'rgba(80,60,40,0.8)'; ctx.beginPath(); ctx.ellipse(SX(f.x), SY(f.z), 34, 14, 0, 0, TAU); ctx.fill(); if (Math.random() < 0.4) burst(f.x, f.z, 0, ['#6a4a2a', '#8a6a4a'], 2, 120, 0.4, 3); }
  // 그림자
  const P = G.player;
  shadow(P.x, P.z, 15 * Math.max(0.5, 1 - P.lift / 120));
  for (const f of G.foes) if (!f.hidden && !(f.st === 'dead' && f.t > 1)) shadow(f.x, f.z, Math.max(10, f.r * 0.9), f.st === 'spawn' ? 0.15 : 0.32);
  // 깊이 순서로
  const L = [];
  for (const p of R.props) L.push({z: p.z, f: () => drawProp(p)});
  for (const d of R.doors) L.push({z: d.z - 2, f: () => drawDoor(d)});
  if (R.npcs && G.state === 'hub') for (const n of R.npcs) L.push({z: n.z, f: () => drawNPC(n)});
  if (G.dummy && G.state === 'hub') { const d = G.dummy; L.push({z: d.z + 1, f: () => { d.flash = Math.max(0, d.flash - 0.05); d.wob *= 0.9; const m = JS.props.dummy; ctx.save(); ctx.translate(SX(d.x), SY(d.z)); ctx.rotate(Math.sin(G.time * 30) * 0.08 * d.wob); drawFrame(IMG.props, m.x, m.y, m.w, m.h, -m.w / 2, -m.foot, d.flash * 0.8); ctx.restore(); }}); }
  for (const f of G.foes) L.push({z: f.z, f: () => drawFoe(f)});
  for (const p of G.pickups) L.push({z: p.z, f: () => drawPickup(p)});
  for (const a of G.allies) L.push({z: a.z, f: () => { const x = SX(a.x), y = SY(a.z); if (a.k === 'turret') { icon('orb_symbio', x - 14, y - 34 + Math.sin(G.time * 5) * 2, 28); } else { ctx.fillStyle = '#3cffae'; ctx.beginPath(); ctx.arc(x, y - 8, 6 + (a.t / a.life) * 4, 0, TAU); ctx.fill(); } }});
  L.push({z: P.z + 0.5, f: () => { drawHeroAfter(P); heroImgDraw(P); }});
  L.sort((a, b) => a.z - b.z);
  for (const o of L) o.f();
  drawBeams(); drawProjs(); drawFxAll(); drawParts(); drawTexts();
  // 상호작용 안내
  if (NEAR && !G.paused) {
    const x = SX(NEAR.x), y = SY(NEAR.z) - 92;
    const key = INPUT.lastDevice === 'pad' ? '[메뉴]' : INPUT.lastDevice === 'touch' ? '' : '[E]';
    const t = `${key} ${NEAR.label}`.trim(); ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(t).width + 16; ctx.fillStyle = 'rgba(8,10,16,.82)'; ctx.fillRect(x - w / 2, y - 12, w, 22); ctx.strokeStyle = '#3cffae'; ctx.strokeRect(x - w / 2 + 0.5, y - 11.5, w - 1, 21);
    ctx.fillStyle = '#e8fff4'; ctx.fillText(t, x, y);
  }
  // 분위기
  ctx.fillStyle = TINT[R.area] || 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, VW, VH);
  vignette();
  if (G.hurtVig > 0) { ctx.fillStyle = `rgba(200,20,40,${G.hurtVig * 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  if (G.player.hp / G.player.maxhp < 0.3 && G.state === 'run') { const a = 0.15 + 0.1 * Math.sin(G.time * 5); ctx.strokeStyle = `rgba(255,40,60,${a})`; ctx.lineWidth = 18; ctx.strokeRect(0, 0, VW, VH); }
  if (G.flashScreen > 0) { ctx.fillStyle = `rgba(220,255,240,${G.flashScreen})`; ctx.fillRect(0, 0, VW, VH); }
  drawHUD();
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}

// ---------------- 화면 정보 (체력, 돌진, 시약, 의식, 재화, 변이)
function drawHUD() {
  const P = G.player, run = G.run;
  ctx.textBaseline = 'middle';
  // 초상화 + 체력
  ctx.fillStyle = 'rgba(6,8,12,.78)'; ctx.fillRect(10, 10, 250, 74); ctx.strokeStyle = 'rgba(60,255,174,.35)'; ctx.strokeRect(10.5, 10.5, 249, 73);
  if (IMG.portrait) ctx.drawImage(IMG.portrait, 18, 8, 96, 96, 12, 12, 70, 70);
  ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = '#e8fff4'; ctx.fillText('이안', 88, 24);
  hpBar(88, 34, 162, 12, P.hp / P.maxhp, P.hp / P.maxhp < 0.3 ? '#ff5a6a' : '#3cffae');
  ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(P.hp)} / ${P.maxhp}`, 169, 40);
  // 돌진 칸 · 시약 · 도약 · 의식
  ctx.textAlign = 'left';
  for (let k = 0; k < P.dashMax; k++) { ctx.fillStyle = k < P.dashN ? '#3cffae' : '#24302c'; ctx.fillRect(88 + k * 14, 52, 10, 6); }
  for (let k = 0; k < P.ammoMax; k++) { ctx.fillStyle = k < P.ammo ? '#40d8ff' : '#1a2a34'; ctx.beginPath(); ctx.arc(130 + k * 12, 55, 4, 0, TAU); ctx.fill(); }
  if (G.state === 'run') {
    const lc = P.leapCd / 6; ctx.fillStyle = '#24302c'; ctx.fillRect(88, 64, 70, 6); ctx.fillStyle = lc > 0 ? '#5a7a70' : '#c0ffe8'; ctx.fillRect(88, 64, 70 * (1 - lc), 6);
    ctx.fillStyle = '#24302c'; ctx.fillRect(166, 64, 84, 6); ctx.fillStyle = P.ult >= 100 ? `hsl(${150 + Math.sin(G.time * 6) * 20},100%,60%)` : '#3a9a7a'; ctx.fillRect(166, 64, 84 * P.ult / 100, 6);
    ctx.font = '9px system-ui, sans-serif'; ctx.fillStyle = '#8a9aa0'; ctx.fillText('도약', 88, 76); ctx.fillText(P.ult >= 100 ? '의식 준비!' : '의식', 166, 76);
  }
  // 재화
  ctx.textAlign = 'right'; ctx.font = 'bold 14px system-ui, sans-serif';
  let y = 22;
  if (run) { icon('atp', VW - 120, y - 11, 22); ctx.fillStyle = '#ffe070'; ctx.fillText(run.atp, VW - 128 + 0, y); }
  icon('dna', VW - 40, y - 11, 22); ctx.fillStyle = '#c0ffe8'; ctx.fillText(SAVE.dna, VW - 46, y);
  if (run) {
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = '#a8b4c4'; ctx.fillText(`${run.ch}장 ${CH[run.ch - 1].name} · 방 ${run.room}/9`, VW - 14, 46);
    // 변이 아이콘
    const o = ownedTraits(); let x = 12;
    for (const t of o) {
      const T = TRAIT[t.id]; icon(`${T.lin}_${T.slot}`, x, VH - 44, 30);
      ctx.fillStyle = RARITY[t.rar].col; ctx.fillRect(x + 2, VH - 12, 26, 3); x += 34;
    }
  }
  // 보스 체력
  const boss = G.foes.find(f => f.tier === 'boss' && f.st !== 'dead');
  if (boss) {
    ctx.textAlign = 'center'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillStyle = '#ff8a96'; ctx.fillText(JS.mobs[boss.id].name + (boss.phase === 2 ? ' · 광폭화' : ''), VW / 2, VH - 42);
    hpBar(VW / 2 - 220, VH - 30, 440, 10, boss.hp / boss.maxhp, boss.phase === 2 ? '#ff3a4a' : '#ff6a7a');
  }
  // 알림 띠
  if (G.banner) {
    const b = G.banner; b.t += 1 / 60; if (b.t > 3.2) G.banner = null;
    else { const a = Math.min(1, b.t * 3, (3.2 - b.t) * 2); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(6,8,12,.7)'; ctx.fillRect(0, 120, VW, 72);
      ctx.font = 'bold 28px system-ui, sans-serif'; ctx.fillStyle = '#e8fff4'; ctx.fillText(b.text, VW / 2, 148); ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#9ab8b0'; ctx.fillText(b.sub || '', VW / 2, 176); ctx.globalAlpha = 1; }
  }
  // 방 정리 안내
  if (G.state === 'run' && G.cleared && G.rewardDone && G.room.doors.some(d => d.open) && G.room.kind !== 'shop' && G.room.kind !== 'rest' && G.room.kind !== 'preboss') {
    ctx.textAlign = 'center'; ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = `rgba(192,255,232,${0.6 + 0.3 * Math.sin(G.time * 4)})`; ctx.fillText('북쪽 문 중 하나를 골라 들어가세요', VW / 2, 70);
  }
}

// ================================================================ 메인 루프
let last = performance.now(), acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000) * (window.TIMESCALE || 1); last = now;
  pollPad();
  if (pressed.has('pause') && (G.state === 'run' || G.state === 'hub')) { pressed.delete('pause'); if (!G.paused) openPause(); else closePanel(); }
  uiTick();
  if (G.state === 'run' || G.state === 'hub') {
    if (!G.paused) {
      G.flashScreen = Math.max(0, (G.flashScreen || 0) - dt * 2); G.hurtVig = Math.max(0, (G.hurtVig || 0) - dt * 2);
      if (G.hitstop > 0) { G.hitstop -= dt; updParts(dt * 0.2); }
      else {
        const sdt = dt * G.slow; G.time += sdt;
        updPlayer(G.player, sdt);
        for (const f of G.foes) updFoe(f, sdt);
        G.foes = G.foes.filter(f => !(f.st === 'dead' && f.t > (f.tier === 'boss' ? 2.4 : 1.5)));
        updProjs(sdt); updPickups(sdt); updFx(sdt); updParts(sdt);
        updRoom(sdt); updDoors(); updInteract();
        if (G.state === 'hub' && G.dummy) {}
      }
      const P = G.player;
      // 카메라: 주인공 + 조준 방향으로 살짝 앞서기
      let lx = 0, ly = 0;
      if (G.state === 'run') { const a = P.ang; lx = Math.cos(a) * 40; ly = Math.sin(a) * 26; }
      CAM.tx = P.x + lx - VW / 2; CAM.ty = (P.z * K - 40) + ly - VH / 2;
      camUpdate(dt, G.room.bounds());
      if (G.state === 'run') AUDIO.intensity(G.cleared ? 0.15 : 0.9);
      // 체력이 낮으면 심장 소리
      if (G.state === 'run' && P.hp / P.maxhp < 0.25 && P.act !== 'death') { G.heartT = (G.heartT || 0) - dt; if (G.heartT <= 0) { AUDIO.play('heart', 0.5); G.heartT = 1.1; } }
    }
    updFade(dt);
    render();
  } else drawBackdrop(dt);
  pressed.clear();
}
// 제목·로딩 화면 배경: 떠다니는 나선
function drawBackdrop(dt) {
  G.time += dt; ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, VW, VH);
  for (let k = 0; k < 120; k++) {
    const t = G.time * 0.6 + k * 0.12, x = VW / 2 + Math.sin(t * 1.3 + k) * 60 + (k - 60) * 7, y = VH / 2 + Math.sin(t) * 120;
    ctx.fillStyle = k % 2 ? 'rgba(60,255,174,0.5)' : 'rgba(255,90,208,0.45)'; ctx.fillRect(x, y + Math.sin(k * 0.4 + G.time) * 30, 3, 3);
  }
  updFade(dt);
  if (G.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}

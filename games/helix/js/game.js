// 헬릭스 게임 본체: 주인공, 적, 투사체, 장판, 피해 계산, 변이 효과, 방 진행, 그리기
'use strict';
const G = {pending: [], slowT: 0, focus: null, state: 'boot', room: null, foes: [], projs: [], zones: [], pickups: [], allies: [], tele: [], beams: [], fx: [], hitstop: 0, time: 0, paused: false, run: null, slow: 1, fade: 0, fadeTo: 0, fadeCb: null, banner: null};
let SAVE = null;
const SETTINGS = window.SETTINGS = {shake: 1};
const HA = {};   // 주인공 동작 정보 (hero.json)
const HFR = {idle: 8, run: 8, dash: 6, blink: 8, atk1: 6, atk2: 6, atk3: 8, spin: 8, leap: 10, cast: 10, throw: 7, shoot: 6, hit: 4, death: 10, spawn: 10};

// ================================================================ 저장
const SAVE_KEY = 'helix-save-v1';
function loadSave() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  SAVE = Object.assign({v: 1, dna: 0, meta: {}, charms: [], charm: null, runs: 0, wins: 0, best: 0, kills: {}, metMerchant: false, talk: {}, seenIntro: false, totalDna: 0, bestRooms: 0,
    settings: {music: 0.6, sfx: 0.8, shake: 1}}, s || {});
  SETTINGS.shake = SAVE.settings.shake;
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
const metaL = id => SAVE.meta[id] || 0;

// ================================================================ 주인공
function newPlayer() {
  return {x: 0, z: 0, r: 15, vx: 0, vz: 0, d: 0, ang: Math.PI / 2, act: 'idle', at: 0, alen: 1, hp: 50, maxhp: 50, combo: 0, comboT: 0, buf: null, bufT: 0,
    dashN: 1, dashMax: 1, dashCd: 0, ammo: 3, ammoMax: 3, ammoT: 0, leapCd: 0, ult: 0, inv: 0, shield: 0, shieldCd: 0, charmBlock: false, flash: 0, hurtT: 0,
    hitDone: false, hit2: false, dashT: 0, afterimg: [], step: 0, revives: 0, lift: 0, healCd: 0, dead: false};
}
function traitV(id) {   // 보유 변이의 현재 수치 (없으면 0)
  const r = G.run; if (!r) return 0;
  for (const s in r.slots) if (r.slots[s] && r.slots[s].id === id) return TRAIT[id].v[r.slots[s].rar];
  const p = r.passives.find(p => p.id === id); return p ? TRAIT[id].v[p.rar] : 0;
}
const has = id => traitV(id) > 0;
function recalcPlayer(P, keepHpRatio = false) {
  const ratio = P.hp / P.maxhp;
  P.maxhp = 50 + metaL('vit') * 10 + (SAVE.charm === 'charm_a' ? 15 : 0) + traitV('s_hp') + (G.run ? G.run.bonusHp : 0);
  P.dashMax = 1 + metaL('dash'); P.ammoMax = 3 + metaL('ammo') + (G.run && G.run.ammoBonus || 0);
  if (keepHpRatio) P.hp = Math.round(P.maxhp * ratio);
  P.hp = Math.min(P.hp, P.maxhp);
}
const speedMul = () => 1 + traitV('n_ref') / 100;
const atkSpd = () => 1 + traitV('n_ref') * 0.66 / 100;
// 동작 길이(초)와 판정 시점
const ACT = {
  atk1: {len: 0.32, hit: 0.42, anim: 'atk1'}, atk2: {len: 0.32, hit: 0.42, anim: 'atk2'}, atk3: {len: 0.48, hit: 0.56, anim: 'atk3'},
  spin: {len: 0.44, hit: 0.3, hit2: 0.66, anim: 'spin'}, cast: {len: 0.36, hit: 0.45, anim: 'throw'}, dash: {len: 0.2, anim: 'dash'},
  leap: {len: 0.78, hit: 0.7, anim: 'leap'}, ult: {len: 0.9, hit: 0.62, anim: 'cast'}, hit: {len: 0.22, anim: 'hit'}, death: {len: 1.4, anim: 'death'}, spawn: {len: 0.9, anim: 'spawn'},
};
function setAct(P, a, lenMul = 1) { P.act = a; P.at = 0; P.alen = (ACT[a] ? ACT[a].len : 0.3) * lenMul; P.hitDone = false; P.hit2 = false; }
function aimAngle(P) {
  if (INPUT.lastDevice === 'kb') {
    const mx = INPUT.mouse.x + camX(), my = INPUT.mouse.y + camY();
    return Math.atan2((my - (P.z * K - 40)) / K, mx - P.x);
  }
  if (INPUT.lastDevice === 'pad' && INPUT.pad) { const ax = INPUT.pad.axes[2] || 0, ay = INPUT.pad.axes[3] || 0; if (Math.hypot(ax, ay) > 0.35) return Math.atan2(ay, ax); }
  // 터치·패드(조준 없음): 가까운 적 자동 조준 → 이동 방향
  const near = nearestFoe(P, 340); if (near) return angTo(P, near);
  const [mx, mz] = moveVec(); if (mx || mz) return Math.atan2(mz, mx);
  return P.ang;
}
function nearestFoe(p, maxD = 1e9, exclude) {
  let best = null, bd = maxD;
  for (const f of G.foes) { if (f.st === 'dead' || f.st === 'spawn' || f.hidden || (exclude && exclude.has(f))) continue; const d = dist(p, f) - f.r; if (d < bd) { bd = d; best = f; } }
  return best;
}
function canAct(P) { return !['death', 'spawn'].includes(P.act) && !G.paused; }

function updPlayer(P, dt) {
  const R = G.room;
  updHeroStatus(P, dt);
  P.at += dt; P.inv = Math.max(0, P.inv - dt); P.flash = Math.max(0, P.flash - dt * 4); P.hurtT -= dt;
  P.dashCd -= dt; if (P.dashCd <= 0 && P.dashN < P.dashMax) { P.dashN++; P.dashCd = P.dashN < P.dashMax ? 0.5 : 0; }
  P.leapCd = Math.max(0, P.leapCd - dt); P.shieldCd = Math.max(0, P.shieldCd - dt); P.healCd = Math.max(0, P.healCd - dt);
  if (P.ammo < P.ammoMax) { P.ammoT += dt; if (P.ammoT > 3.2) { P.ammoT = 0; P.ammo++; } }
  P.comboT -= dt;
  if (P.bufT > 0) P.bufT -= dt; else P.buf = null;
  const inCombat = G.state === 'run';
  // 입력 예약 (동작 중에 누른 입력을 잠깐 기억)
  for (const a of ['attack', 'special', 'cast', 'dash', 'leap', 'ult']) if (pressed.has(a)) { P.buf = a; P.bufT = 0.22; }
  if (held('attack') && !P.buf && (P.act === 'idle' || P.act === 'run')) { P.buf = 'attack'; P.bufT = 0.05; }
  const [mx, mz] = moveVec();
  // 동작 시작 판정
  const busy = !['idle', 'run'].includes(P.act);
  const cancelable = P.act === 'dash' ? P.at > P.alen * 0.6 : busy ? P.at > P.alen * (P.act.startsWith('atk') ? 0.58 : 0.8) : true;
  if (P.buf && canAct(P)) {
    const b = P.buf;
    // 돌진은 거의 언제나 동작을 끊고 나갈 수 있음
    const dashOK = b === 'dash' && P.dashN > 0 && (!busy || P.act.startsWith('atk') || ['spin', 'cast', 'hit', 'gfire', 'gblast', 'cmd'].includes(P.act) || (P.act === 'dash' && P.at > P.alen * 0.55));
    if (dashOK) { startDash(P, mx, mz); P.buf = null; }
    else if (b !== 'dash' && (!busy || cancelable)) {
      if (b === 'attack' && WPN() !== 'scythe') { weaponAttack(P); P.buf = null; }
      else if (b === 'attack') {
        const dashStrike = P.act === 'dash' || (P.lastDash && G.time - P.lastDash < 0.18);
        const next = dashStrike ? 'atk1' : P.comboT > 0 && P.act.startsWith('atk') ? (P.act === 'atk1' ? 'atk2' : P.act === 'atk2' ? 'atk3' : 'atk1') : P.comboT > 0 && P.lastAtk ? (P.lastAtk === 'atk1' ? 'atk2' : P.lastAtk === 'atk2' ? 'atk3' : 'atk1') : 'atk1';
        startAttack(P, next, dashStrike); P.buf = null;
      } else if (b === 'special') { if (!weaponSpecial(P)) startSpecial(P); P.buf = null; }
      else if (b === 'cast' && P.ammo > 0) { startCast(P); P.buf = null; }
      else if (b === 'leap' && P.leapCd <= 0 && inCombat) { startLeap(P); P.buf = null; }
      else if (b === 'ult' && P.ult >= 100 && inCombat) { startUlt(P); P.buf = null; }
      else if (b === 'cast' && P.ammo <= 0) { P.buf = null; AUDIO.play('deny', 0.4); }
    }
  }
  // 동작별 처리
  const A = ACT[P.act];
  let speed = 285 * speedMul() * (P.slowT > 0 ? 0.6 : 1);
  if (P.act === 'dash') {
    const k = P.dashDist / P.alen; P.vx = Math.cos(P.dashAng) * k; P.vz = Math.sin(P.dashAng) * k;
    R.move(P, P.vx * dt, P.vz * dt, P.r);
    if (G.time - (P.lastImg || 0) > 0.03) { P.afterimg.push({x: P.x, z: P.z, d: P.d, f: Math.min(5, Math.floor(P.at / P.alen * 6)), t: 0}); P.lastImg = G.time; }
    if (has('e_dsh') && G.time - (P.lastTrail || 0) > 0.06) { addZone(P.x, P.z, 34, 2.2, 'acid', traitV('e_dsh'), 'hero'); P.lastTrail = G.time; }
    if (P.at >= P.alen) { setAct(P, 'idle'); P.vx *= 0.3; P.vz *= 0.3; }
  } else if (P.act === 'gfire' || P.act === 'gblast' || P.act === 'cmd') {
    weaponActTick(P, dt, mx, mz, speed);
  } else if (P.act.startsWith('atk') || P.act === 'spin' || P.act === 'cast' || P.act === 'ult' || P.act === 'leap' || P.act === 'hit') {
    const u = P.at / P.alen;
    if (P.act.startsWith('atk')) {
      const lunge = P.act === 'atk3' ? 70 : P.dashStrike ? 90 : 40;
      if (u < 0.5) { const v = lunge / (P.alen * 0.5); R.move(P, Math.cos(P.ang) * v * dt, Math.sin(P.ang) * v * dt, P.r); }
      if (mx || mz) R.move(P, mx * speed * 0.18 * dt, mz * speed * 0.18 * dt, P.r);
      if (!P.hitDone && u >= A.hit) { P.hitDone = true; doSwing(P, P.act); }
    } else if (P.act === 'spin') {
      if (mx || mz) R.move(P, mx * speed * 0.45 * dt, mz * speed * 0.45 * dt, P.r);
      if (!P.hitDone && u >= A.hit) { P.hitDone = true; doSpin(P, 0); }
      if (!P.hit2 && u >= A.hit2) { P.hit2 = true; doSpin(P, 1); }
    } else if (P.act === 'cast') {
      if (!P.hitDone && u >= A.hit) { P.hitDone = true; throwFlask(P); }
    } else if (P.act === 'leap') {
      const f = Math.min(HFR.leap - 1, Math.floor(u * HFR.leap)); P.lift = HA.leap && HA.leap.lift ? HA.leap.lift[f] * 1.15 : 0;
      if (u > 0.15 && u < 0.7) { const v = P.leapDist / (P.alen * 0.55); R.move(P, Math.cos(P.ang) * v * dt, Math.sin(P.ang) * v * dt, P.r); }
      if (!P.hitDone && u >= A.hit) { P.hitDone = true; doLeapLand(P); }
    } else if (P.act === 'ult') {
      if (!P.hitDone && u >= A.hit) { P.hitDone = true; doUlt(P); }
    } else if (P.act === 'hit') {
      R.move(P, P.vx * dt, P.vz * dt, P.r); P.vx *= 0.85; P.vz *= 0.85;
    }
    if (P.at >= P.alen) { if (P.act.startsWith('atk')) { P.comboT = 0.38; P.lastAtk = P.act; } P.lift = 0; setAct(P, 'idle'); }
  } else if (P.act === 'death') {
    if (P.at >= P.alen && !P.dead) { P.dead = true; onPlayerDead(); }
  } else if (P.act === 'spawn') {
    if (P.at >= P.alen) setAct(P, 'idle');
  } else {
    // 이동: 부드럽게 가속·감속
    const tx = mx * speed, tz = mz * speed;
    const k = 1 - Math.exp(-dt * ((mx || mz) ? 16 : 22));
    P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
    if (Math.hypot(P.vx, P.vz) > 20) {
      R.move(P, P.vx * dt, P.vz * dt, P.r);
      if (mx || mz) { P.ang = Math.atan2(mz, mx); P.d = dir8(P.ang); }
      if (P.act !== 'run') { P.act = 'run'; P.at = 0; }
      const f = Math.floor(P.at * 15) % 8; if ((f === 2 || f === 6) && P.step !== f) { P.step = f; AUDIO.play('step', 0.5); if (Math.random() < 0.5) burst(P.x, P.z, 2, '#6a6a5a', 1, 40, 0.3, 2, 100); }
    } else if (P.act !== 'idle') { P.act = 'idle'; P.at = 0; }
  }
  for (const a of P.afterimg) a.t += dt;
  P.afterimg = P.afterimg.filter(a => a.t < 0.25);
}
function faceAim(P) {
  let a = aimAngle(P);
  // 조준 보정: 조준 방향 가까이에 있는 적 쪽으로 살짝 당김
  let best = null, bs = 0.62;
  for (const f of G.foes) { if (f.st === 'dead' || f.hidden || f.st === 'spawn') continue; const d = dist(P, f) - f.r; if (d > 170) continue; let da = angTo(P, f) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); const sc = Math.abs(da) + d / 600; if (Math.abs(da) < 0.62 && sc < bs) { bs = sc; best = da; } }
  if (best !== null) a += best * 0.75;
  P.ang = a; P.d = dir8(a);
}
function startAttack(P, a, dashStrike) {
  faceAim(P); setAct(P, a, 1 / atkSpd()); P.dashStrike = dashStrike;
  AUDIO.play(a === 'atk3' ? 'swing3' : a === 'atk2' ? 'swing2' : 'swing1', 0.9);
}
function startSpecial(P) { faceAim(P); setAct(P, 'spin', 1 / atkSpd()); AUDIO.play('spin'); }
function startCast(P) { faceAim(P); setAct(P, 'cast'); P.ammo--; AUDIO.play('throw'); }
function startDash(P, mx, mz) {
  P.dashAng = (mx || mz) ? Math.atan2(mz, mx) : P.ang; P.ang = P.dashAng; P.d = dir8(P.ang);
  setAct(P, 'dash'); P.dashDist = 210; P.inv = Math.max(P.inv, 0.26); P.dashN--; if (P.dashCd <= 0) P.dashCd = 0.55; P.lastDash = G.time;
  AUDIO.play('dash'); burst(P.x, P.z, 4, ['#3cffae', '#c0ffe8'], 6, 120, 0.35, 2, 50);
  if (has('i_dsh') && P.shieldCd <= 0) { P.shield = 1; P.shieldCd = traitV('i_dsh'); }
  if (has('s_dsh') && P.healCd <= 0) { heal(P, traitV('s_dsh')); P.healCd = 3; }
  if (has('n_dsh')) { const hit = foesIn(P.x, P.z, 120); for (const f of hit) { lightning(P, f); damage(f, traitV('n_dsh'), {type: 'proc'}); } if (hit.length) AUDIO.play('zap', 0.6); }
}
function startLeap(P) {
  faceAim(P); setAct(P, 'leap'); P.leapCd = 6; P.inv = P.alen * 0.72;
  let d = 230;
  if (INPUT.lastDevice === 'kb') { const mx = INPUT.mouse.x + camX(), my = INPUT.mouse.y + camY(); d = clamp(Math.hypot(mx - P.x, (my / K) - P.z), 60, 260); }
  P.leapDist = d; AUDIO.play('leap');
}
function startUlt(P) { setAct(P, 'ult'); P.ult = 0; P.inv = 1.0; AUDIO.play('ultCharge'); G.fx.push({k: 'ritual', x: P.x, z: P.z, t: 0}); }

// ---------------- 공격 판정
function foesIn(x, z, r, arcAng = null, arc = TAU) {
  const out = [];
  for (const f of G.foes) {
    if (f.st === 'dead' || f.st === 'spawn' || f.hidden) continue;
    const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
    if (d > r + f.r) continue;
    if (arcAng !== null && d > f.r) { let da = Math.atan2(dz, dx) - arcAng; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > arc / 2) continue; }
    out.push(f);
  }
  return out;
}
function doSwing(P, a) {
  const heavy = a === 'atk3', base = a === 'atk1' ? 20 : a === 'atk2' ? 24 : 42;
  let hits;
  if (heavy) hits = foesIn(P.x + Math.cos(P.ang) * 45, P.z + Math.sin(P.ang) * 45, 90);
  else hits = foesIn(P.x, P.z, 105, P.ang, Math.PI * 0.95);
  // 부술 수 있는 소품
  breakProps(P.x + Math.cos(P.ang) * 40, P.z + Math.sin(P.ang) * 40, heavy ? 80 : 70);
  if (G.dummy) { const d = G.dummy; if (Math.hypot(d.x - P.x, d.z - P.z) < 110) dummyHit(d, base); }
  let any = false;
  for (const f of hits) {
    any = true;
    damage(f, base * (P.dashStrike ? 1.5 : 1), {type: 'attack', knock: heavy ? 260 : 120, ang: angTo(P, f), heavy});
  }
  if (any) {
    if (has('s_atk')) heal(P, traitV('s_atk'));
    if (has('n_atk')) chainFrom(hits[0], traitV('n_atk'), 2);
    G.hitstop = Math.max(G.hitstop, heavy ? 0.075 : 0.045); shake(heavy ? 5 : 2.5);
    AUDIO.play(heavy ? 'hitHeavy' : 'hit', 0.9);
  }
  if (heavy) { G.fx.push({k: 'ring', x: P.x + Math.cos(P.ang) * 45, z: P.z + Math.sin(P.ang) * 45, r0: 20, r1: 90, t: 0, life: 0.25, col: '#5cffcf'}); shake(3); }
}
function doSpin(P, n) {
  const hits = foesIn(P.x, P.z, 118);
  breakProps(P.x, P.z, 100);
  if (G.dummy && Math.hypot(G.dummy.x - P.x, G.dummy.z - P.z) < 120) dummyHit(G.dummy, 16);
  for (const f of hits) {
    damage(f, 16, {type: 'special', knock: has('i_spc') ? -140 : 140, ang: angTo(P, f)});
  }
  if (hits.length) { G.hitstop = Math.max(G.hitstop, 0.04); shake(2.5); AUDIO.play('hit', 0.8, 1.1); }
  if (n === 0 && has('n_spc')) { const t = foesIn(P.x, P.z, 260).slice(0, traitV('n_spc')); for (const f of t) { lightning(P, f, true); damage(f, 20, {type: 'proc'}); } if (t.length) AUDIO.play('zap'); }
  if (n === 1 && has('s_spc')) for (let k = 0; k < 2; k++) { const a = P.ang + (k ? Math.PI / 2 : -Math.PI / 2); G.allies.push({k: 'pod', x: P.x + Math.cos(a) * 60, z: P.z + Math.sin(a) * 60, t: 0, life: 1.0, dmg: traitV('s_spc')}); }
  G.fx.push({k: 'ring', x: P.x, z: P.z, r0: 60, r1: 118, t: 0, life: 0.2, col: '#5cffcf'});
}
function throwFlask(P) {
  let tx = P.x + Math.cos(P.ang) * 260, tz = P.z + Math.sin(P.ang) * 260;
  if (INPUT.lastDevice === 'kb') { const mx = INPUT.mouse.x + camX(), my = INPUT.mouse.y + camY(); const d = Math.min(320, Math.hypot(mx - P.x, my / K - P.z)); tx = P.x + Math.cos(P.ang) * d; tz = P.z + Math.sin(P.ang) * d; }
  else { const f = nearestFoe(P, 340); if (f) { tx = f.x; tz = f.z; } }
  G.projs.push({k: 'flask', owner: 'hero', x: P.x, z: P.z, sx: P.x, sz: P.z, tx, tz, t: 0, life: 0.5, h: 40});
}
function splashAt(x, z) {
  const bigR = has('e_cst') ? 1.3 : 1, R = 90 * bigR;
  AUDIO.play('splash'); shake(2);
  G.fx.push({k: 'splash', x, z, t: 0});
  for (const f of foesIn(x, z, R)) {
    damage(f, 26, {type: 'cast', knock: 80, ang: Math.atan2(f.z - z, f.x - x)});
    if (has('i_cst')) f.mark = 4;
  }
  breakProps(x, z, R);
  addZone(x, z, R * 0.9, 3.2, 'acid', 5 * (1 + traitV('e_cst') / 100), 'hero');
  if (has('n_cst')) addZone(x, z, R, 3.2, 'shock', traitV('n_cst'), 'hero');
  if (has('s_cst')) G.allies.push({k: 'turret', x, z, t: 0, life: traitV('s_cst'), cd: 0.3});
}
function doLeapLand(P) {
  P.lift = 0; AUDIO.play('slam'); shake(7); G.hitstop = Math.max(G.hitstop, 0.06);
  G.fx.push({k: 'shock', x: P.x, z: P.z, t: 0});
  for (const f of foesIn(P.x, P.z, 125)) damage(f, 50, {type: 'leap', knock: 280, ang: angTo(P, f), heavy: true});
  breakProps(P.x, P.z, 120);
  burst(P.x, P.z, 4, ['#3cffae', '#8a8a7a'], 24, 260, 0.6, 3);
}
function doUlt(P) {
  AUDIO.play('ultBoom'); shake(12); G.hitstop = 0.12; G.flashScreen = 0.5;
  G.fx.push({k: 'pillar', x: P.x, z: P.z, t: 0});
  for (const f of foesIn(P.x, P.z, 260)) damage(f, 130, {type: 'ult', knock: 320, ang: angTo(P, f), heavy: true});
  heal(P, 10);
  burst(P.x, P.z, 20, ['#3cffae', '#36ccff', '#e0fff4'], 60, 380, 1.0, 3, 120);
}

// ---------------- 피해 계산
function damage(f, base, o = {}) {
  if (f.st === 'dead' || f.inv) return 0;
  const P = G.player, run = G.run;
  let mul = 1 + metaL('dmg') * 0.05;
  if (o.type === 'attack') mul += traitV('e_atk') / 100;
  if (o.type === 'special') mul += (traitV('e_spc') + traitV('i_spc')) / 100;
  if (f.tier !== 'normal') mul += traitV('i_mem') / 100;
  if (P.hp / P.maxhp <= 0.35) mul += traitV('i_fev') / 100;
  if (f.mark > 0) mul += traitV('i_cst') / 100;
  let crit = !!o.crit;
  if (o.type === 'attack' && Math.random() * 100 < traitV('i_atk')) { crit = true; mul *= 2.5; }
  const dmg = Math.max(1, Math.round(base * mul));
  f.hp -= dmg; f.flash = 1; f.lastHit = G.time;
  if (o.type !== 'dot') P.ult = Math.min(100, P.ult + dmg / 7);
  floatText(f.x, f.z, (f.foot || 60) * 0.5, crit ? dmg + '!' : '' + dmg, crit ? '#ffe040' : o.type === 'dot' ? '#ffa040' : o.type === 'proc' ? '#fff6b0' : '#ffffff', crit);
  if (crit) { AUDIO.play('crit', 0.8); G.hitstop = Math.max(G.hitstop, 0.07); }
  // 피격 반응
  const col = JS.mobs[f.id] ? JS.mobs[f.id].tint : '#c070ff';
  if (o.type !== 'dot') burst(f.x, f.z, 20, [col, '#ffffff'], o.heavy ? 10 : 5, 180, 0.4, 2);
  if (o.knock && f.st !== 'dead') {
    const w = FOE[f.id].weight, k = o.knock / w;
    f.kx = Math.cos(o.ang) * k; f.kz = Math.sin(o.ang) * k;
  }
  if (o.type === 'attack' && has('e_atk')) addAcid(f, 1);
  if (o.type === 'special' && has('e_spc')) addAcid(f, 2);
  if (f.hp <= 0) killFoe(f);
  else if (f.tier === 'normal' && o.type !== 'dot' && o.type !== 'proc' && f.st !== 'atk' && f.st !== 'under' && ((o.type !== 'gun' && o.type !== 'drone') || Math.random() < 0.22)) { f.st = 'hit'; f.t = 0; f.tele = null; f.lift = 0; f.sq = 1; }
  else if (f.tier === 'normal' && (o.type === 'proc') && f.st === 'move') { f.st = 'hit'; f.t = 0; }
  if (o.type !== 'dot' && o.type !== 'proc' && (o.type !== 'drone' || Math.random() < 0.4)) AUDIO.play('squish', o.type === 'gun' || o.type === 'drone' ? 0.3 : 0.5, 0.9 + Math.random() * 0.3);
  return dmg;
}
function addAcid(f, n) { f.acid = Math.min(5, (f.acid || 0) + n); f.acidT = 3; }
function killFoe(f) {
  f.st = 'dead'; f.t = 0; f.tele = null; f.hp = 0;
  AUDIO.play(f.tier === 'normal' ? 'die' : 'burst', f.tier === 'normal' ? 0.7 : 1);
  const col = JS.mobs[f.id] ? JS.mobs[f.id].tint : '#c070ff';
  burst(f.x, f.z, 20, [col, '#ffffff', '#202020'], f.tier === 'normal' ? 14 : 40, 240, 0.7, 3);
  G.fx.push({k: 'burst', x: f.x, z: f.z, col, t: 0});
  if (f.tier !== 'normal') { shake(10); G.hitstop = 0.15; }
  if (f.tier === 'boss') for (const o of G.foes) if (o !== f && o.st !== 'dead') { o.st = 'dead'; o.t = 0; o.tele = null; o.hp = 0; }
  if (f.elite) { dropPickup('atp', f.x, f.z, 12); dropPickup('heal', f.x + 20, f.z, 0.08); }
  // 방의 마지막 적: 잠깐 느리게
  if (G.state === 'run' && G.waveN >= G.waves && !(G.pending || []).length && G.foes.every(g => g.st === 'dead')) { G.slow = 0.3; G.slowT = f.tier === 'boss' ? 1.2 : 0.55; AUDIO.play('ultBoom', 0.45, 1.4); }
  SAVE.kills[f.id] = (SAVE.kills[f.id] || 0) + 1;
  if (G.run) G.run.kills++;
  if (f.acid > 0 && has('e_bom')) {
    const v = traitV('e_bom'); G.fx.push({k: 'ring', x: f.x, z: f.z, r0: 10, r1: 90, t: 0, life: 0.3, col: '#ff8a2a'});
    for (const g of foesIn(f.x, f.z, 90)) if (g !== f) damage(g, v, {type: 'proc'});
  }
  // 작은 보상: 가끔 ATP 조각
  if (f.tier === 'normal' && Math.random() < 0.25 && !f.summoned) dropPickup('atp', f.x, f.z, 3 + Math.floor(Math.random() * 4));
}
function heal(P, n) { if (n <= 0) return; const v = Math.round(n * (1 + metaL('heal') * 0.1)); const before = P.hp; P.hp = Math.min(P.maxhp, P.hp + v); if (P.hp > before) floatText(P.x, P.z, 90, '+' + (P.hp - before), '#5aff8a'); }
function hurtHero(dmg, src) {
  const P = G.player;
  if (!P || P.inv > 0 || P.act === 'death' || P.act === 'spawn' || G.state !== 'run') return false;
  if (P.shield > 0 || (P.charmBlock && SAVE.charm === 'charm_b')) {
    if (P.shield > 0) P.shield = 0; else P.charmBlock = false;
    P.inv = 0.4; AUDIO.play('block'); G.fx.push({k: 'ring', x: P.x, z: P.z, r0: 10, r1: 50, t: 0, life: 0.3, col: '#5ab0ff'}); return false;
  }
  P.hp -= dmg; P.flash = 1; P.inv = 0.55; P.hurtT = 0.4;
  floatText(P.x, P.z, 80, '-' + dmg, '#ff5a6a', dmg >= 15);
  AUDIO.play('hurt'); shake(6); G.hitstop = Math.max(G.hitstop, 0.06); G.hurtVig = 0.6;
  burst(P.x, P.z, 40, ['#ff4a5a', '#ffffff'], 8, 160, 0.4, 2);
  if (P.hp <= 0) {
    if (P.revives > 0) { P.revives--; P.hp = Math.round(P.maxhp * 0.4); P.inv = 2; G.flashScreen = 0.6; AUDIO.play('heal'); floatText(P.x, P.z, 100, '재생!', '#3cffae', true); G.fx.push({k: 'pillar', x: P.x, z: P.z, t: 0}); return true; }
    P.hp = 0; setAct(P, 'death'); AUDIO.play('die', 1, 0.7); AUDIO.music(AUDIO.name, 0); G.slow = 0.35; G.slowT = 0.9;
    return true;
  }
  if (['idle', 'run'].includes(P.act) && src) { setAct(P, 'hit'); const a = Math.atan2(P.z - src.z, P.x - src.x); P.vx = Math.cos(a) * 220; P.vz = Math.sin(a) * 220; }
  return true;
}
// 연쇄 전격
function chainFrom(first, dmg, jumps) {
  jumps += traitV('n_mye'); if (has('n_mye')) dmg *= 1.2;
  const seen = new Set([first]); let cur = first;
  for (let k = 0; k < jumps; k++) {
    const nx = nearestFoe(cur, 170, seen); if (!nx) break;
    lightning(cur, nx); damage(nx, Math.round(dmg), {type: 'proc'}); seen.add(nx); cur = nx;
  }
  if (seen.size > 1) AUDIO.play('zap', 0.5);
}
function lightning(a, b, sky = false) { G.fx.push({k: 'bolt', x0: a.x, z0: a.z, h0: sky ? 260 : 30, x1: b.x, z1: b.z, h1: 20, t: 0}); }
function addZone(x, z, r, life, kind, dmg, owner) { G.zones.push({x, z, r, life, t: 0, kind, dmg, owner, tick: 0}); }
function breakProps(x, z, r) {
  for (const p of G.room.props) if (p.brk && !p.broken && Math.hypot(p.x - x, p.z - z) < r + p.rad * 0.5) {
    p.broken = true; p.frame = 1; AUDIO.play('splash', 0.5, 1.3); burst(p.x, p.z, 10, ['#c8e8f0', '#8a8a7a', '#3cffae'], 12, 180, 0.5, 2);
    if (G.state === 'run' && Math.random() < 0.65) dropPickup('atp', p.x, p.z, 2 + Math.floor(Math.random() * 5));
  }
}
function dummyHit(d, base) {
  const dmg = Math.round(base * (1 + metaL('dmg') * 0.05)); d.flash = 1; d.wob = 1; floatText(d.x, d.z, 50, '' + dmg, '#ffffff'); AUDIO.play('hit', 0.6);
  G.hitstop = Math.max(G.hitstop, 0.035);
}

// ================================================================ 적
function spawnFoe(id, x, z, opt = {}) {
  const S = FOE[id], M = JS.mobs[id]; if (!S || !M) { console.warn('적 정보 없음', id); return null; }
  const run = G.run, ch = run ? run.ch : 1, room = run ? run.room : 1;
  const depth = run ? (ch - 1) * 9 + room : 0;   // 내려온 층 수
  const scale = S.ai === 'boss' ? 1 + (ch - 1) * 0.04 : 1 + (ch - 1) * 0.38 + depth * 0.022;
  const f = {id, x, z, r: S.r, hp: Math.round(S.hp * scale), maxhp: Math.round(S.hp * scale), tier: M.tier, st: 'spawn', t: 0, d: 0, kx: 0, kz: 0, cd: rand(0.4, 1.4), flash: 0,
    cell: M.cell, foot: M.foot, an: {}, dmgMul: S.ai === 'boss' ? 1 : 1 + (ch - 1) * 0.25 + depth * 0.012, tempo: 1 + Math.min(0.2, depth * 0.0055), lift: 0, sq: 1, buff: 0, summoned: !!opt.summoned, phase: 1, tele: null};
  for (const a of M.anims) f.an[a.id] = a;
  G.foes.push(f); AUDIO.play('spawn', 0.35);
  G.fx.push({k: 'spawnring', x, z, t: 0, col: M.tint});
  return f;
}
const fdmg = f => Math.round(FOE[f.id].dmg * f.dmgMul * (f.buff > 0 ? 1.35 : 1));
function foeFrame(f) {
  const A = f.an, st = f.st;
  const pick_ = (name, u, loop) => { const a = A[name] || A.idle; const n = a.frames; return {a, i: loop ? Math.floor(u) % n : Math.min(n - 1, Math.floor(u * n))}; };
  if (st === 'spawn') return pick_('idle', f.t * 8, true);
  if (st === 'move' || st === 'chase' || st === 'under') return pick_('move', f.t * 10, true);
  if (st === 'wind') { const a = A[f.atkAnim] || A.attack; const hitF = Math.max(1, Math.round(a.frames * 0.5)); return {a, i: Math.min(hitF - 1, Math.floor(f.t / f.windT * hitF))}; }
  if (st === 'atk') { const a = A[f.atkAnim] || A.attack; const hitF = Math.max(1, Math.round(a.frames * 0.5)); return {a, i: Math.min(a.frames - 1, hitF + Math.floor(f.t / f.atkT * (a.frames - hitF)))}; }
  if (st === 'hit') return pick_('hit', f.t / 0.3, false);
  if (st === 'dead') return pick_('death', f.t / (f.tier === 'boss' ? 1.6 : 0.9), false);
  return pick_('idle', f.t * 8, true);
}
// 공격 예고 도형: {shape, x, z, r, ang, arc, len, w}
function teleHit(T, x, z, rr = 0) {
  if (!T) return false;
  const dx = x - T.x, dz = z - T.z;
  if (T.shape === 'circle') return Math.hypot(dx, dz) < T.r + rr;
  if (T.shape === 'cone') { const d = Math.hypot(dx, dz); if (d > T.r + rr) return false; let da = Math.atan2(dz, dx) - T.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < T.arc / 2 || d < rr + 10; }
  if (T.shape === 'ring') { const d = Math.hypot(dx, dz); return d < T.r + rr && d > (T.r0 || 0) - rr; }
  if (T.shape === 'line') { const ca = Math.cos(T.ang), sa = Math.sin(T.ang); const along = dx * ca + dz * sa, perp = Math.abs(-dx * sa + dz * ca); return along > -rr && along < T.len + rr && perp < T.w / 2 + rr; }
  return false;
}
function startFoeAttack(f, anim, windT, atkT, tele, kind) {
  f.st = 'wind'; f.t = 0; f.atkAnim = anim; f.windT = windT / (f.tempo || 1); f.atkT = atkT; f.tele = tele; f.kind = kind; f.didHit = false;
  if (tele) { tele.t = 0; tele.life = f.windT; }
  if (f.tier !== 'normal' || Math.random() < 0.4) AUDIO.play('warn', f.tier === 'normal' ? 0.25 : 0.5);
}
function updFoe(f, dt) {
  const P = G.player, S = FOE[f.id], R = G.room;
  f.t += dt; f.flash = Math.max(0, f.flash - dt * 5); f.buff -= dt; f.mark = Math.max(0, (f.mark || 0) - dt); f.slow = Math.max(0, (f.slow || 0) - dt);
  // 부식 피해
  if (f.acid > 0 && f.st !== 'dead') {
    f.acidT -= dt; f.acidTick = (f.acidTick || 0) + dt;
    if (f.acidTick >= 0.5) { f.acidTick = 0; damage(f, Math.max(1, Math.round(2 * f.acid * (1 + traitV('e_cat') / 100))), {type: 'dot'}); if (Math.random() < 0.4) AUDIO.play('sizzle', 0.3); }
    if (f.acidT <= 0) f.acid = 0;
  }
  // 밀려남
  if (Math.abs(f.kx) + Math.abs(f.kz) > 1) { R.move(f, f.kx * dt, f.kz * dt, f.r * 0.7); f.kx *= Math.exp(-dt * 9); f.kz *= Math.exp(-dt * 9); }
  if (f.st === 'dead') return;
  if (f.st === 'spawn') { f.inv = true; if (f.t > 0.7) { f.inv = false; f.st = 'idle'; f.t = 0; } return; }
  if (f.stun > 0) { f.stun -= dt; f.tele = null; if (f.st !== 'hit') { f.st = 'hit'; f.t = 0; } if (Math.random() < dt * 8) burst(f.x, f.z, (f.foot || 50) * 0.8, '#fff6b0', 1, 40, 0.4, 2, -40); return; }
  if (f.st === 'hit') { if (f.t > 0.3) { f.st = 'chase'; f.t = 0; } return; }
  if (f.st === 'under' && S.ai !== 'boss') { foeUnder(f, dt); return; }
  const dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
  const spd = S.spd * (f.slow > 0 ? 0.55 : 1) * (f.buff > 0 ? 1.3 : 1) * (f.tempo || 1);
  if (S.ai === 'boss') return updBoss(f, dt, d, ang, spd);
  if (f.st === 'wind') {
    if (S.ai !== 'charge') f.d = dir8(f.tele && f.tele.shape !== 'circle' ? f.tele.ang : ang);
    if (f.tele && f.tele.track) { f.tele.ang = ang; f.d = dir8(ang); }
    if (ATK[f.kind] && ATK[f.kind].wind) ATK[f.kind].wind(f, dt);
    if (f.t >= f.windT) { f.st = 'atk'; f.t = 0; onFoeStrike(f); }
    return;
  }
  if (f.st === 'atk') {
    if (ATK[f.kind] && ATK[f.kind].upd) { if (ATK[f.kind].upd(f, dt) !== false) return; }
    if (f.kind === 'charge') {
      const v = S.dist / f.atkT; R.move(f, Math.cos(f.chargeAng) * v * dt, Math.sin(f.chargeAng) * v * dt, f.r * 0.7);
      if (!f.didHit && dist(f, P) < f.r + P.r + 4) { f.didHit = true; if (hurtHero(fdmg(f), f) && S.drain) { f.hp = Math.min(f.maxhp, f.hp + 6); } }
    }
    if (f.t >= f.atkT) { f.st = 'chase'; f.t = 0; f.cd = S.cd * rand(0.8, 1.25); f.tele = null; }
    return;
  }
  // 추적 · 거리 유지
  f.cd -= dt;
  const keep = S.keep || 0;
  if (P.act !== 'death' && G.state === 'run' && f.cd <= 0 && d < S.range + P.r && (S.ai !== 'ranged' || d > 60)) {
    beginFoeAttack(f, ang, d); return;
  }
  let mvx = 0, mvz = 0;
  if (S.ai === 'ranged' && d < keep) { mvx = -dx / d; mvz = -dz / d; }
  else if (d > (S.ai === 'ranged' ? keep + 40 : S.range * 0.7)) { mvx = dx / d; mvz = dz / d; }
  else { const s = Math.sin(f.t * 1.3 + f.x) > 0 ? 1 : -1; mvx = -dz / d * 0.4 * s; mvz = dx / d * 0.4 * s; }
  // 다른 적과 겹치지 않게
  for (const g of G.foes) if (g !== f && g.st !== 'dead') { const ex = f.x - g.x, ez = f.z - g.z, e = Math.hypot(ex, ez), rr = f.r + g.r; if (e < rr && e > 0.1) { mvx += ex / e * (rr - e) / rr * 1.5; mvz += ez / e * (rr - e) / rr * 1.5; } }
  const l = Math.hypot(mvx, mvz);
  if (l > 0.05) { R.move(f, mvx / l * spd * dt, mvz / l * spd * dt, f.r * 0.7); f.d = dir8(S.ai === 'ranged' ? ang : Math.atan2(mvz, mvx)); if (f.st !== 'move') { f.st = 'move'; f.t = 0; } }
  else if (f.st !== 'idle') { f.st = 'idle'; f.t = 0; }
}
function beginFoeAttack(f, ang, d) {
  const S = FOE[f.id], P = G.player;
  if (S.sp && f.tier === 'mid' && Math.random() < 0.3 && f.an.special) return midSpecial(f);
  if (S.roar && Math.random() < 0.2 && f.an.roar) { startFoeAttack(f, 'roar', 0.4, 0.6, null, 'roar'); f.buffSelf = true; return; }
  f.d = dir8(ang);
  if (BEGIN[f.id] && BEGIN[f.id](f, ang, d) !== false) return;
  if (S.ai === 'melee') {
    let T;
    if (S.shape === 'circle') T = {shape: 'circle', x: f.x + Math.cos(ang) * S.area * 0.45, z: f.z + Math.sin(ang) * S.area * 0.45, r: S.area * 0.75};
    else if (S.shape === 'cone') T = {shape: 'cone', x: f.x, z: f.z, r: S.area, ang, arc: Math.PI * 0.6};
    else T = {shape: 'line', x: f.x, z: f.z, ang, len: S.area, w: 36};
    startFoeAttack(f, 'attack', S.wind, 0.3, T, 'melee');
  } else if (S.ai === 'charge') {
    f.chargeAng = ang;
    startFoeAttack(f, 'attack', S.wind, Math.max(0.25, S.dist / 900), {shape: 'line', x: f.x, z: f.z, ang, len: S.dist + f.r, w: f.r * 2 + 10}, 'charge');
  } else if (S.ai === 'ranged') {
    startFoeAttack(f, 'attack', S.wind, 0.3, {shape: 'line', x: f.x, z: f.z, ang, len: Math.min(d, 380), w: 6, thin: true, track: true}, 'shoot');
  }
}
function onFoeStrike(f) {
  const S = FOE[f.id], P = G.player, T = f.tele;
  if (ATK[f.kind] && ATK[f.kind].strike) { ATK[f.kind].strike(f); return; }
  if (f.kind === 'melee') {
    if (T && teleHit(T, P.x, P.z, P.r)) hurtHero(fdmg(f), f);
    if (f.tier !== 'normal') { G.fx.push({k: T.shape === 'circle' ? 'slam' : 'ring', x: T.x, z: T.z, r0: 10, r1: T.r, t: 0, life: 0.3, col: '#ff5a6a'}); shake(5); AUDIO.play('slam', 0.7); }
    else AUDIO.play('swing1', 0.4, 0.7);
    f.tele = null;
  } else if (f.kind === 'charge') { AUDIO.play('dash', 0.45, 0.8); f.tele = null; }
  else if (f.kind === 'shoot') {
    const ang = T ? T.ang : angTo(f, P); const n = S.shots || 1;
    for (let k = 0; k < n; k++) { const a = ang + (k - (n - 1) / 2) * (S.spread || 0); foeShot(f, a, S.pspd || 250); }
    AUDIO.play('shoot', 0.5); f.tele = null;
  } else if (f.kind === 'roar') { AUDIO.play('roar', 0.6); f.buff = 5; shake(3); }
  else if (f.kind === 'special') { doMidSpecial(f); }
}
function makeElite(f) {
  f.elite = true; f.hp = f.maxhp = Math.round(f.maxhp * 2.4); f.dmgMul *= 1.3; f.r *= 1.1;
  floatText(f.x, f.z, 90, '변이체', '#ffc040', true);
}
// 몸끼리 부딪힘: 일반 적은 밀려나고, 큰 적은 주인공을 밀어냄 (돌진·도약 중엔 통과)
function bodyBlock(P) {
  if (G.state !== 'run' || P.act === 'dash' || P.act === 'leap' || P.act === 'death') return;
  for (const f of G.foes) {
    if (f.st === 'dead' || f.st === 'spawn' || f.hidden || (FOE[f.id].fly && f.tier === 'normal')) continue;
    const dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz), rr = f.r * 0.75 + P.r;
    if (d >= rr || d < 0.01) continue;
    const o = rr - d;
    if (f.tier === 'normal' && FOE[f.id].weight < 3) G.room.move(f, -dx / d * o, -dz / d * o, f.r * 0.7);
    else G.room.move(P, dx / d * o, dz / d * o, P.r);
  }
}
function foeShot(f, a, spd, kind = 'spore', dmg) {
  const M = JS.mobs[f.id];
  G.projs.push({k: kind, owner: 'foe', x: f.x + Math.cos(a) * f.r, z: f.z + Math.sin(a) * f.r, h: Math.min(40, f.foot * 0.4), vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, t: 0, life: 2.6, r: 10, dmg: dmg || fdmg(f), col: M.tint});
}
function midSpecial(f) {
  const S = FOE[f.id];
  const sp = S.sp; let T = null;
  if (sp === 'quake') T = {shape: 'circle', x: f.x, z: f.z, r: 190};
  startFoeAttack(f, 'special', 0.8, 0.6, T, 'special');
  AUDIO.play('roar', 0.5);
}
function doMidSpecial(f) {
  const S = FOE[f.id], P = G.player, sp = S.sp;
  if (sp.startsWith('summon')) { const [, id, n] = sp.split(':'); for (let k = 0; k < +n; k++) { if (G.foes.filter(g => g.st !== 'dead').length > 12) break; const a = k / n * TAU; const p = G.room.nearestFree(f.x + Math.cos(a) * 80, f.z + Math.sin(a) * 80, 16); spawnFoe(id, p[0], p[1], {summoned: true}); } }
  else if (sp.startsWith('nova')) { const n = +sp.split(':')[1]; for (let k = 0; k < n; k++) foeShot(f, k / n * TAU + f.t, 200, 'spore', Math.round(fdmg(f) * 0.6)); AUDIO.play('splash', 0.7); }
  else if (sp === 'drain') { f.hp = Math.min(f.maxhp, f.hp + f.maxhp * 0.08); floatText(f.x, f.z, 80, '흡혈', '#ff5a6a'); f.buff = 4; }
  else if (sp === 'quake') { if (f.tele && teleHit(f.tele, P.x, P.z, P.r)) hurtHero(fdmg(f), f); G.fx.push({k: 'slam', x: f.x, z: f.z, r0: 30, r1: 190, t: 0, life: 0.4, col: '#c070ff'}); shake(10); AUDIO.play('slam'); }
  else if (sp === 'rally') { for (const g of G.foes) if (g.st !== 'dead') g.buff = 6; floatText(f.x, f.z, 110, '돌격 명령!', '#7aff3a', true); if (G.foes.filter(g => g.st !== 'dead').length < 8) for (let k = 0; k < 2; k++) { const p = G.room.nearestFree(f.x + (k ? 90 : -90), f.z + 40, 16); spawnFoe('clone', p[0], p[1], {summoned: true}); } }
  f.tele = null;
}

// ---------------- 보스 행동
function updBoss(f, dt, d, ang, spd) {
  const P = G.player, R = G.room, S = FOE[f.id];
  if (f.phase === 1 && f.hp < f.maxhp * 0.5) { f.phase = 2; floatText(f.x, f.z, 160, '광폭화!', '#ff5a6a', true); AUDIO.play('roar'); shake(8); f.buff = 0; }
  const ph2 = f.phase === 2, spdMul = ph2 ? 1.2 : 1;
  if (f.st === 'under') {   // 기생충 왕 잠행
    f.hidden = true; const v = 220; if (d > 10) R.move(f, Math.cos(ang) * v * dt, Math.sin(ang) * v * dt, 20);
    if (f.t > 1.1) { f.hidden = false; f.st = 'wind'; f.t = 0; f.atkAnim = 'special'; f.windT = 0.7; f.atkT = 0.6; f.kind = 'emerge'; f.tele = {shape: 'circle', x: f.x, z: f.z, r: 120, t: 0, life: 0.7}; AUDIO.play('warn', 0.6); }
    return;
  }
  if (f.st === 'wind') {
    if (f.tele && f.tele.track) { f.tele.ang = ang; f.tele.x = f.x; f.tele.z = f.z; f.d = dir8(ang); }
    if (f.kind === 'beam' && f.t < 0.05) AUDIO.play('beamCharge', 0.8);
    if (ATK[f.kind] && ATK[f.kind].wind) ATK[f.kind].wind(f, dt);
    if (f.t >= f.windT) { f.st = 'atk'; f.t = 0; if (ATK[f.kind] && ATK[f.kind].strike) ATK[f.kind].strike(f); else bossStrike(f, ph2); }
    return;
  }
  if (f.st === 'atk') {
    if (ATK[f.kind] && ATK[f.kind].upd) { if (ATK[f.kind].upd(f, dt) !== false) return; }
    if (f.kind === 'lunge' || f.kind === 'dive' || f.kind === 'stab') {
      const v = f.lungeD / f.atkT; R.move(f, Math.cos(f.chargeAng) * v * dt, Math.sin(f.chargeAng) * v * dt, f.r * 0.6);
      if (!f.didHit && dist(f, P) < f.r + P.r) { f.didHit = true; hurtHero(fdmg(f), f); }
    }
    if (f.kind === 'beam') { const T = f.beamT; if (T && teleHit(T, P.x, P.z, P.r) && (f.beamTick = (f.beamTick || 0) + dt) > 0.12) { f.beamTick = 0; hurtHero(Math.round(fdmg(f) * 0.45), f); } }
    if (f.t >= f.atkT) {
      if (f.kind === 'dive') { if (f.diveT && teleHit(f.diveT, P.x, P.z, P.r)) hurtHero(fdmg(f), f); G.fx.push({k: 'slam', x: f.x, z: f.z, r0: 20, r1: 120, t: 0, life: 0.35, col: '#3cffae'}); shake(8); AUDIO.play('slam'); f.diveT = null; }
      if (f.kind === 'burrow') { f.st = 'under'; f.t = 0; AUDIO.play('slam', 0.5, 0.6); shake(4); return; }
      f.st = 'chase'; f.t = 0; f.cd = S.cd * (ph2 ? 0.75 : 1) * rand(0.8, 1.3); f.tele = null; f.beamT = null;
    }
    return;
  }
  f.cd -= dt;
  // 이동
  const want = f.id === 'helix' ? 260 : f.id === 'queen' ? 140 : 90;
  if (f.cd <= 0 && P.act !== 'death') { bossChoose(f, d, ang, ph2); return; }
  let mvx = 0, mvz = 0;
  if (d > want + 30) { mvx = Math.cos(ang); mvz = Math.sin(ang); } else if (d < want - 60) { mvx = -Math.cos(ang); mvz = -Math.sin(ang); } else { mvx = -Math.sin(ang) * 0.5; mvz = Math.cos(ang) * 0.5; }
  R.move(f, mvx * spd * spdMul * dt, mvz * spd * spdMul * dt, f.r * 0.6);
  f.d = dir8(ang); if (f.st !== 'move') { f.st = 'move'; f.t = 0; }
}
function bossChoose(f, d, ang, ph2) {
  const P = G.player, S = FOE[f.id], w = S.wind * (ph2 ? 0.8 : 1);
  const r = Math.random();
  f.d = dir8(ang);
  if (Math.random() < (ph2 ? 0.3 : 0.22) && BOSS_EXTRA[f.id]) { BOSS_EXTRA[f.id](f, d, ang, ph2); return; }
  if (f.id === 'queen') {
    if (r < 0.45) startFoeAttack(f, 'attack', w, 0.4, {shape: 'circle', x: P.x, z: P.z, r: 115}, 'slam');
    else if (r < 0.8) startFoeAttack(f, 'attack2', w * 0.9, 0.5, {shape: 'cone', x: f.x, z: f.z, r: 260, ang, arc: ph2 ? Math.PI * 0.9 : Math.PI * 0.55, thin: true}, 'spit');
    else startFoeAttack(f, 'special', 0.7, 0.6, null, 'summon');
  } else if (f.id === 'wormking') {
    if (r < 0.4 && d < 360) { f.chargeAng = ang; f.lungeD = Math.min(340, d + 60); startFoeAttack(f, 'attack', w, 0.38, {shape: 'line', x: f.x, z: f.z, ang, len: f.lungeD + 40, w: 80}, 'lunge'); }
    else if (r < 0.7 && d < 230) startFoeAttack(f, 'attack2', w, 0.45, {shape: 'cone', x: f.x, z: f.z, r: 200, ang, arc: Math.PI * 1.2}, 'sweep');
    else startFoeAttack(f, 'special', 0.5, 0.5, null, 'burrow');
  } else if (f.id === 'doctor') {
    if (r < 0.42) { f.chargeAng = ang; f.lungeD = 150; startFoeAttack(f, 'attack', w, 0.3, {shape: 'line', x: f.x, z: f.z, ang, len: 260, w: 48}, 'stab'); }
    else if (r < 0.8) startFoeAttack(f, 'attack2', w, 0.4, {shape: 'cone', x: f.x, z: f.z, r: 175, ang, arc: Math.PI * 0.95}, 'sweep');
    else startFoeAttack(f, 'special', 0.9, 0.7, null, 'serum');
  } else if (f.id === 'helix') {
    if (r < 0.4) startFoeAttack(f, 'attack', 0.95, 0.7, {shape: 'line', x: f.x, z: f.z, ang, len: 1000, w: 42, track: true, trackT: 0.55}, 'beam');
    else if (r < 0.72) { f.chargeAng = ang; f.lungeD = Math.max(60, d - 10); startFoeAttack(f, 'attack2', w, 0.35, {shape: 'circle', x: P.x, z: P.z, r: 120}, 'dive'); }
    else startFoeAttack(f, 'special', 0.9, 0.7, {shape: 'circle', x: f.x, z: f.z, r: 150}, 'unzip');
  }
}
function bossStrike(f, ph2) {
  const P = G.player, T = f.tele;
  const k = f.kind;
  if (k === 'slam' || k === 'sweep' || k === 'emerge' || k === 'unzip') {
    if (T && teleHit(T, P.x, P.z, P.r)) hurtHero(fdmg(f), f);
    G.fx.push({k: 'slam', x: T ? T.x : f.x, z: T ? T.z : f.z, r0: 20, r1: T ? T.r : 120, t: 0, life: 0.35, col: JS.mobs[f.id].tint}); shake(9); AUDIO.play('slam');
    if (k === 'emerge') { f.hidden = false; burst(f.x, f.z, 10, ['#6a4a2a', '#c09c76'], 30, 300, 0.8, 3); }
    if (k === 'unzip') { const n = ph2 ? 24 : 16; for (let i = 0; i < n; i++) foeShot(f, i / n * TAU, 210, 'spore', Math.round(fdmg(f) * 0.5)); for (let i = 0; i < (ph2 ? 3 : 2); i++) { const p = G.room.nearestFree(f.x + rand(-120, 120), f.z + rand(40, 120), 16); spawnFoe('prion', p[0], p[1], {summoned: true}); } }
    if (k === 'slam' && ph2) for (let i = 0; i < 8; i++) foeShot(f, i / 8 * TAU, 180, 'spore', Math.round(fdmg(f) * 0.45));
  } else if (k === 'spit') {
    const n = ph2 ? 9 : 6, base = T ? T.ang : angTo(f, P), arc = T ? T.arc : 1;
    for (let i = 0; i < n; i++) foeShot(f, base - arc / 2 + arc * i / (n - 1), 230, 'acid', Math.round(fdmg(f) * 0.55));
    AUDIO.play('splash');
  } else if (k === 'summon') {
    for (let i = 0; i < (ph2 ? 3 : 2); i++) { const p = G.room.nearestFree(f.x + (i - 1) * 140, f.z + 100, 20); spawnFoe('amoeba', p[0], p[1], {summoned: true}); }
  } else if (k === 'serum') {
    f.buff = 7; floatText(f.x, f.z, 180, '혈청 주입!', '#7aff3a', true); AUDIO.play('roar'); shake(6);
    if (ph2) for (let i = 0; i < 2; i++) { const p = G.room.nearestFree(f.x + (i ? 120 : -120), f.z + 60, 16); spawnFoe('clone', p[0], p[1], {summoned: true}); }
  } else if (k === 'beam') { f.beamT = Object.assign({}, T); AUDIO.play('beam'); shake(4); }
  else if (k === 'lunge' || k === 'stab' || k === 'dive') { AUDIO.play('dash', 0.8, 0.7); if (k === 'dive') { f.chargeAng = Math.atan2(T.z - f.z, T.x - f.x); f.lungeD = Math.hypot(T.x - f.x, T.z - f.z); f.diveT = T; } }
  if (k !== 'beam') f.tele = null;
}

// ================================================================ 투사체 · 장판 · 아군
function updProjs(dt) {
  const P = G.player, R = G.room;
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.t += dt;
    if (p.k === 'lob') { if (updLob(p, dt)) G.projs.splice(i, 1); continue; }
    if (p.k === 'flask') {
      const u = Math.min(1, p.t / p.life); p.x = lerp(p.sx, p.tx, u); p.z = lerp(p.sz, p.tz, u); p.h = 40 + Math.sin(u * Math.PI) * 90 - u * 30;
      if (u >= 1) { G.projs.splice(i, 1); splashAt(p.x, p.z); }
      continue;
    }
    p.x += p.vx * dt; p.z += p.vz * dt;
    let dead = p.t > p.life || !R.floorAt(p.x, p.z);
    if (p.owner === 'foe' && !dead && Math.hypot(p.x - P.x, p.z - P.z) < p.r + P.r) { if (hurtHero(p.dmg, p) || P.inv <= 0) dead = true; else dead = P.act !== 'dash'; }
    if (p.owner === 'hero' && !dead) for (const f of G.foes) if (f.st !== 'dead' && !f.hidden && f.st !== 'spawn' && !(p.hitSet && p.hitSet.has(f)) && Math.hypot(p.x - f.x, p.z - f.z) < p.r + f.r) {
      if (p.onHit) p.onHit(f, p); else damage(f, p.dmg, {type: 'proc', knock: 40, ang: Math.atan2(p.vz, p.vx)});
      if (p.pierce > 0) { p.pierce--; (p.hitSet = p.hitSet || new Set()).add(f); } else { dead = true; break; }
    }
    if (p.owner === 'hero' && !dead && p.k === 'hbolt') breakProps(p.x, p.z, 8);
    if (dead) {
      if (p.k === 'acid' && R.floorAt(p.x, p.z)) addZone(p.x, p.z, 40, 2.5, 'foeAcid', 4, 'foe');
      burst(p.x, p.z, p.h, [p.col || '#a8ff3a', '#ffffff'], 4, 80, 0.3, 2);
      G.projs.splice(i, 1);
    }
  }
  for (let i = G.zones.length - 1; i >= 0; i--) {
    const z = G.zones[i]; z.t += dt; z.tick += dt;
    if (z.t > z.life) { G.zones.splice(i, 1); continue; }
    if (z.tick >= 0.4) {
      z.tick = 0;
      if (z.owner === 'hero') for (const f of foesIn(z.x, z.z, z.r)) { damage(f, z.dmg, {type: 'dot'}); if (z.kind === 'shock') { f.slow = 0.6; if (Math.random() < 0.3) lightning({x: z.x, z: z.z}, f); } if (z.kind === 'acid' && has('e_atk')) addAcid(f, 0); }
      if (z.owner === 'foe' && Math.hypot(P.x - z.x, P.z - z.z) < z.r + P.r * 0.5) { if (z.kind === 'slime') P.slowT = 0.5; if (z.dmg > 0) hurtHero(z.dmg, z); }
    }
  }
  for (let i = G.allies.length - 1; i >= 0; i--) {
    const a = G.allies[i]; a.t += dt;
    if (a.k === 'pod' && a.t >= a.life) { for (const f of foesIn(a.x, a.z, 80)) damage(f, a.dmg, {type: 'proc'}); G.fx.push({k: 'ring', x: a.x, z: a.z, r0: 10, r1: 80, t: 0, life: 0.3, col: '#3cffae'}); AUDIO.play('burst', 0.4); G.allies.splice(i, 1); continue; }
    if (a.k === 'minidrone') { updMiniDrones(a, dt); if (a.t >= a.life) G.allies.splice(i, 1); continue; }
    if (a.k === 'turret') {
      a.cd -= dt;
      if (a.cd <= 0) { const f = nearestFoe(a, 360); if (f) { const an = angTo(a, f); G.projs.push({k: 'bolt', owner: 'hero', x: a.x, z: a.z, h: 24, vx: Math.cos(an) * 420, vz: Math.sin(an) * 420, t: 0, life: 1.2, r: 8, dmg: 10, col: '#3cffae'}); a.cd = 0.55; AUDIO.play('shoot', 0.25, 1.6); } }
      if (a.t >= a.life) G.allies.splice(i, 1);
    }
  }
}

// ================================================================ 보상 · 줍기
function dropPickup(k, x, z, v, extra = {}) {
  const p = Object.assign({k, x, z, v, t: 0, h: 0, vh: 180, vx: rand(-60, 60), vz: rand(-60, 60)}, extra);
  const fr = k === 'atp' ? 10 : 28;
  if (G.room && !G.room.free(x, z, fr)) { const s = G.room.nearestFree(x, z, fr); p.x = s[0]; p.z = s[1]; }
  if (k !== 'atp') { p.vx = p.vz = 0; }
  G.pickups.push(p); return p;
}
function updPickups(dt) {
  const P = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const p = G.pickups[i]; p.t += dt;
    if (p.vh || p.h > 0) { p.h += p.vh * dt; p.vh -= 600 * dt; G.room.move(p, p.vx * dt, p.vz * dt, 6); p.vx *= 0.95; p.vz *= 0.95; if (p.h <= 0) { p.h = 0; p.vh = Math.abs(p.vh) > 80 ? -p.vh * 0.35 : 0; } }
    const d = Math.hypot(p.x - P.x, p.z - P.z);
    const auto = p.k === 'atp' || p.k === 'heal' || p.k === 'dna' || p.k === 'maxhp';
    if (auto && p.t > 0.4 && d < 150) { const s = 600 * dt; p.x += (P.x - p.x) / d * Math.min(d, s); p.z += (P.z - p.z) / d * Math.min(d, s); }
    if (p.t > 0.35 && d < P.r + 16) {
      if (auto) { collect(p); G.pickups.splice(i, 1); }
      else if (!p.menuOpen && G.state === 'run') { p.menuOpen = true; collectBig(p, i); }
    } else if (d > 60) p.menuOpen = false;
  }
}
function collect(p) {
  const P = G.player, run = G.run;
  if (p.k === 'atp') { const v = Math.round(p.v * (SAVE.charm === 'charm_c' ? 1.3 : 1)); run.atp += v; AUDIO.play('coin', 0.6); floatText(p.x, p.z, 30, '+' + v + ' ATP', '#ffe070'); }
  if (p.k === 'dna') { SAVE.dna += p.v; SAVE.totalDna += p.v; run.dna += p.v; AUDIO.play('dna'); floatText(p.x, p.z, 40, '+' + p.v + ' DNA', '#c0ffe8', true); writeSave(); }
  if (p.k === 'heal') { heal(P, Math.round(P.maxhp * p.v)); AUDIO.play('heal'); }
  if (p.k === 'maxhp') { run.bonusHp += p.v; recalcPlayer(P); P.hp += p.v; AUDIO.play('heal'); floatText(p.x, p.z, 40, '최대 체력 +' + p.v, '#ff8a96', true); }
  if (p.isReward) rewardTaken();
}
function collectBig(p, idx) {
  if (p.k === 'trait') { openTraitChoice(p.lin, p.minRar || 0, () => { removePickup(p); rewardTaken(); }); }
  else if (p.k === 'upgrade') { openUpgrade(() => { removePickup(p); rewardTaken(); }); }
}
function removePickup(p) { const i = G.pickups.indexOf(p); if (i >= 0) G.pickups.splice(i, 1); }

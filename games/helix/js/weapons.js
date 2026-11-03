// 헬릭스 무기: 유전자총 · 공생 드론 (낫은 game.js)
'use strict';
Object.assign(ACT, {
  gfire: {len: 0.15, anim: 'shoot'}, gblast: {len: 0.5, hit: 0.25, anim: 'gblast'}, cmd: {len: 0.36, hit: 0.45, anim: 'command'},
});
Object.assign(HFR, {gidle: 8, grun: 8, gblast: 8, didle: 8, drun: 8, command: 8});
const IDLE_ANIM = {scythe: 'idle', gun: 'gidle', drone: 'didle'}, RUN_ANIM = {scythe: 'run', gun: 'grun', drone: 'drun'};

// 무기별 공격 시작 (updPlayer에서 부름). true를 돌려주면 처리 끝
function weaponAttack(P) {
  const w = WPN();
  if (w === 'gun') { faceAim(P); setAct(P, 'gfire', 1 / atkSpd()); gunFire(P); return true; }
  if (w === 'drone') { const D = G.drone; if (D && D.fireCd <= 0) droneFire(D, true); return true; }
  return false;
}
function weaponSpecial(P) {
  const w = WPN();
  if (w === 'gun') { faceAim(P); setAct(P, 'gblast', 1 / atkSpd()); AUDIO.play('throw', 0.5, 0.7); return true; }
  if (w === 'drone') {
    const D = G.drone; if (!D || D.st !== 'follow' || D.spCd > 0) { AUDIO.play('deny', 0.3); return true; }
    faceAim(P); setAct(P, 'cmd'); droneRush(D, P); return true;
  }
  return false;
}
// 동작 진행 (updPlayer의 동작별 처리에서 부름)
function weaponActTick(P, dt, mx, mz, speed) {
  const u = P.at / P.alen;
  if (P.act === 'gfire') { if (mx || mz) G.room.move(P, mx * speed * 0.62 * dt, mz * speed * 0.62 * dt, P.r); }
  else if (P.act === 'gblast') {
    if (!P.hitDone && u >= ACT.gblast.hit) { P.hitDone = true; gunBlast(P); }
    if (u > 0.25 && u < 0.55) G.room.move(P, -Math.cos(P.ang) * 220 * dt, -Math.sin(P.ang) * 220 * dt, P.r);
  } else if (P.act === 'cmd') { if (mx || mz) G.room.move(P, mx * speed * 0.5 * dt, mz * speed * 0.5 * dt, P.r); }
  if (P.at >= P.alen) { setAct(P, 'idle'); }
}

// ---------------------------------------------------------------- 유전자총
function gunMuzzle(P) { return {x: P.x + Math.cos(P.ang) * 30, z: P.z + Math.sin(P.ang) * 30}; }
function gunFire(P) {
  P.shots = (P.shots || 0) + 1;
  const m = gunMuzzle(P), a = P.ang + rand(-0.045, 0.045), spd = 980;
  const mul = 1 + traitV('g_e_atk') / 100;
  G.projs.push({k: 'hbolt', owner: 'hero', x: m.x, z: m.z, h: 46, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, t: 0, life: 0.52, r: 9, dmg: 9 * mul, col: '#7af0ff', streak: 26,
    pierce: traitV('g_i_atk'), chain: has('g_n_atk') && P.shots % 4 === 0, onHit: gunBoltHit});
  burst(m.x, m.z, 46, ['#e8fff4', '#7af0ff'], 3, 160, 0.15, 2);
  G.fx.push({k: 'muzzle', x: m.x, z: m.z, ang: a, t: 0, life: 0.06});
  AUDIO.play('gun', 0.7, 0.95 + Math.random() * 0.1);
  if (Math.random() < 0.5) shake(0.8);
}
function gunBoltHit(f, p) {
  const crit = has('g_i_atk') && Math.random() < 0.12;
  const dealt = damage(f, Math.round(p.dmg * (crit ? 2.5 : 1)), {type: 'gun', knock: 50, ang: Math.atan2(p.vz, p.vx), crit});
  if (has('g_e_atk')) addAcid(f, 1);
  if (p.chain) chainFrom(f, traitV('g_n_atk'), 2);
  if (f.st === 'dead' && has('g_s_atk')) heal(G.player, traitV('g_s_atk'));
  G.hitstop = Math.max(G.hitstop, 0.012);
  return dealt;
}
function gunBlast(P) {
  const m = gunMuzzle(P), n = 7, arc = 0.75;
  const mul = 1 + (traitV('g_e_spc') + (has('g_i_spc') ? 25 : 0)) / 100;
  for (let k = 0; k < n; k++) {
    const a = P.ang - arc / 2 + arc * k / (n - 1) + rand(-0.04, 0.04), spd = rand(700, 820);
    G.projs.push({k: 'hbolt', owner: 'hero', x: m.x, z: m.z, h: 44, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, t: 0, life: 0.3, r: 11, dmg: 11 * mul, col: '#bff8ff', streak: 18, pierce: 1, onHit: blastHit});
  }
  G.fx.push({k: 'cone', x: P.x, z: P.z, ang: P.ang, arc, r: 170, t: 0, life: 0.18, col: '#bff8ff'});
  burst(m.x, m.z, 44, ['#ffffff', '#7af0ff', '#3cffae'], 16, 380, 0.3, 2);
  shake(5); G.hitstop = Math.max(G.hitstop, 0.04); AUDIO.play('blast', 1);
  breakProps(m.x + Math.cos(P.ang) * 60, m.z + Math.sin(P.ang) * 60, 80);
  if (has('g_e_spc')) addZone(P.x + Math.cos(P.ang) * 110, P.z + Math.sin(P.ang) * 110, 70, 3, 'acid', 6, 'hero');
  if (has('g_n_spc')) { const t = foesIn(P.x, P.z, 260, P.ang, 1.4).slice(0, traitV('g_n_spc')); for (const f of t) { lightning(P, f); damage(f, 22, {type: 'proc'}); } if (t.length) AUDIO.play('zap'); }
  if (has('g_s_spc')) for (let k = 0; k < 3; k++) { const a = P.ang + (k - 1) * 0.5; G.allies.push({k: 'pod', x: P.x + Math.cos(a) * 100, z: P.z + Math.sin(a) * 100, t: 0, life: 1.0, dmg: traitV('g_s_spc')}); }
  if (G.dummy && Math.hypot(G.dummy.x - P.x, G.dummy.z - P.z) < 180) dummyHit(G.dummy, 30);
}
function blastHit(f, p) {
  damage(f, Math.round(p.dmg), {type: 'special', knock: 170, ang: Math.atan2(p.vz, p.vx)});
  if (has('g_i_spc') && f.tier !== 'boss') f.stun = Math.max(f.stun || 0, traitV('g_i_spc') * (f.tier === 'mid' ? 0.4 : 1));
}

// ---------------------------------------------------------------- 공생 드론
function makeDrone(P) { return {x: P.x - 30, z: P.z - 10, h: 70, ang: 0, d: 0, st: 'follow', t: 0, fireCd: 0.5, autoCd: 0.6, spCd: 0, hits: 0, tx: 0, tz: 0, bob: 0}; }
function droneTarget(D, range = 420) {
  const P = G.player; let best = null, bs = 1e9;
  const aim = INPUT.lastDevice === 'kb' ? aimAngle(P) : null;
  for (const f of G.foes) {
    if (f.st === 'dead' || f.st === 'spawn' || f.hidden) continue;
    const d = Math.hypot(f.x - P.x, f.z - P.z); if (d > range) continue;
    let sc = d;
    if (aim !== null) { let da = Math.atan2(f.z - P.z, f.x - P.x) - aim; da = Math.atan2(Math.sin(da), Math.cos(da)); sc += Math.abs(da) * 260; }
    if (sc < bs) { bs = sc; best = f; }
  }
  return best;
}
function droneFire(D, manual) {
  const P = G.player, f = droneTarget(D);
  D.fireCd = 0.2 / atkSpd(); D.autoCd = 0.75;
  if (!f) {
    if (!manual) return;
    const a = aimAngle(P);
    G.projs.push({k: 'hbolt', owner: 'hero', x: D.x, z: D.z, h: D.h, vx: Math.cos(a) * 900, vz: Math.sin(a) * 900, t: 0, life: 0.45, r: 8, dmg: 7, col: '#ffe040', streak: 20, onHit: (g, p) => droneHit(g, 7)});
    AUDIO.play('laser', 0.6); return;
  }
  D.ang = Math.atan2(f.z - D.z, f.x - D.x); D.d = dir8(D.ang);
  G.fx.push({k: 'laser', x0: D.x, z0: D.z, h0: D.h - 4, x1: f.x, z1: f.z, h1: Math.min(50, (f.foot || 50) * 0.45), t: 0, life: 0.09, col: has('d_e_atk') ? '#ffb060' : '#ffe040'});
  droneHit(f, manual ? 7 : 5);
  AUDIO.play('laser', 0.6, 0.95 + Math.random() * 0.15);
}
function droneHit(f, base) {
  const P = G.player, D = G.drone;
  const crit = Math.random() * 100 < traitV('d_i_atk');
  const dmg = base * (1 + traitV('d_e_atk') / 100) * (crit ? 2.5 : 1);
  damage(f, Math.round(dmg), {type: 'drone', knock: 25, ang: angTo(P, f), crit});
  if (has('d_e_atk')) addAcid(f, 1);
  if (has('d_n_atk')) { const nx = nearestFoe(f, 170, new Set([f])); if (nx) { lightning(f, nx); damage(nx, traitV('d_n_atk'), {type: 'proc'}); } }
  if (D) { D.hits++; if (has('d_s_atk') && D.hits % 8 === 0) heal(P, traitV('d_s_atk')); }
}
function droneRush(D, P) {
  let tx = P.x + Math.cos(P.ang) * 240, tz = P.z + Math.sin(P.ang) * 240;
  if (INPUT.lastDevice === 'kb') { const mx = INPUT.mouse.x + camX(), my = INPUT.mouse.y + camY(); const d = Math.min(320, Math.hypot(mx - P.x, my / K - P.z)); tx = P.x + Math.cos(P.ang) * d; tz = P.z + Math.sin(P.ang) * d; }
  else { const f = droneTarget(D, 360); if (f) { tx = f.x; tz = f.z; } }
  const s = G.room.free(tx, tz, 10) ? [tx, tz] : G.room.nearestFree(tx, tz, 10);
  D.st = 'rush'; D.t = 0; D.tx = s[0]; D.tz = s[1]; D.spCd = 1.1; D.spins = 0;
  AUDIO.play('dash', 0.6, 1.5);
  if (has('d_s_spc')) G.allies.push({k: 'minidrone', x: P.x, z: P.z, t: 0, life: traitV('d_s_spc'), cd: 0.3, a: Math.random() * TAU});
}
function droneSpinHit(D) {
  const mul = 1 + traitV('d_e_spc') / 100;
  const hits = foesIn(D.tx, D.tz, 92);
  for (const f of hits) damage(f, Math.round(12 * mul), {type: 'special', knock: 90, ang: Math.atan2(f.z - D.tz, f.x - D.tx)});
  breakProps(D.tx, D.tz, 80);
  if (G.dummy && Math.hypot(G.dummy.x - D.tx, G.dummy.z - D.tz) < 100) dummyHit(G.dummy, 12);
  G.fx.push({k: 'ring', x: D.tx, z: D.tz, r0: 30, r1: 92, t: 0, life: 0.2, col: '#ffe040'});
  if (hits.length) { AUDIO.play('hit', 0.7, 1.3); G.hitstop = Math.max(G.hitstop, 0.025); }
  burst(D.tx, D.tz, 20, ['#ffe040', '#ffffff'], 8, 260, 0.3, 2);
}
function updDrone(dt) {
  const P = G.player, D = G.drone; if (!D || !P) return;
  D.t += dt; D.bob += dt; D.fireCd -= dt; D.spCd -= dt; D.autoCd -= dt;
  if (D.st === 'follow') {
    // 주인공 뒤쪽 어깨 위를 따라다님
    const side = Math.sin(G.time * 0.7) * 0.6;
    const tx = P.x - Math.cos(P.ang + side) * 34 + Math.cos(P.ang + Math.PI / 2) * 22, tz = P.z - Math.sin(P.ang + side) * 20 - 6;
    const k = 1 - Math.exp(-dt * 7); D.x += (tx - D.x) * k; D.z += (tz - D.z) * k; D.h += (64 + Math.sin(D.bob * 3) * 5 - D.h) * k;
    // 스스로 가까운 적을 느리게 쏨 (전투 중)
    if (G.state === 'run' && D.autoCd <= 0 && D.fireCd <= 0 && P.act !== 'death') droneFire(D, false);
    if (D.fireCd > 0.05) {} else D.d = dir8(P.ang);
  } else if (D.st === 'rush') {
    const dx = D.tx - D.x, dz = D.tz - D.z, d = Math.hypot(dx, dz), v = 1100 * dt;
    if (d <= v) { D.x = D.tx; D.z = D.tz; D.st = 'spin'; D.t = 0; D.spinTick = 0; AUDIO.play('spin', 0.7, 1.4); }
    else { D.x += dx / d * v; D.z += dz / d * v; D.ang = Math.atan2(dz, dx); D.d = dir8(D.ang); D.h += (36 - D.h) * Math.min(1, dt * 10); }
    if (G.time - (D.lastImg || 0) > 0.03) { G.fx.push({k: 'dtrail', x: D.x, z: D.z, h: D.h, d: D.d, t: 0, life: 0.2}); D.lastImg = G.time; }
  } else if (D.st === 'spin') {
    D.spinTick -= dt; D.d = Math.floor(D.t * 24) % 8; D.h = 30 + Math.sin(D.t * 20) * 3;
    if (D.spinTick <= 0) { D.spinTick = 0.2; droneSpinHit(D); D.spins++; }
    if (D.t >= 0.6) {
      if (has('d_e_spc')) addZone(D.tx, D.tz, 70, 3, 'acid', 6, 'hero');
      if (has('d_n_spc')) { const t = foesIn(D.tx, D.tz, 150); for (const f of t) { lightning({x: D.tx, z: D.tz}, f); damage(f, traitV('d_n_spc'), {type: 'proc'}); } G.fx.push({k: 'ring', x: D.tx, z: D.tz, r0: 20, r1: 150, t: 0, life: 0.3, col: '#fff6b0'}); AUDIO.play('zap', 0.8); shake(3); }
      D.st = 'return'; D.t = 0;
    }
  } else if (D.st === 'return') {
    const dx = P.x - D.x, dz = P.z - D.z, d = Math.hypot(dx, dz), v = 900 * dt;
    if (d < 40 || D.t > 0.8) { D.st = 'follow'; if (has('d_i_spc') && P.shieldCd <= 0) { P.shield = 1; P.shieldCd = traitV('d_i_spc'); G.fx.push({k: 'ring', x: P.x, z: P.z, r0: 10, r1: 50, t: 0, life: 0.3, col: '#5ab0ff'}); } }
    else { D.x += dx / d * v; D.z += dz / d * v; D.h += (64 - D.h) * Math.min(1, dt * 6); D.d = dir8(Math.atan2(dz, dx)); }
  }
}
function drawDrone(D, alpha = 1) {
  const img = IMG.drone; if (!img) return;
  const f = Math.floor(G.time * 24) % 6, x = SX(D.x), y = SY(D.z, D.h);
  ctx.globalAlpha = alpha; ctx.drawImage(img, f * 64, D.d * 64, 64, 64, Math.round(x - 32), Math.round(y - 50), 64, 64); ctx.globalAlpha = 1;
  if (D.st === 'spin') { ctx.strokeStyle = 'rgba(255,224,64,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(SX(D.tx), SY(D.tz, 20), 70, 70 * K, 0, 0, TAU); ctx.stroke(); }
}
function updMiniDrones(a, dt) {
  a.a += dt * 3; const P = G.player; a.x = P.x + Math.cos(a.a) * 60; a.z = P.z + Math.sin(a.a) * 40; a.cd -= dt;
  if (a.cd <= 0) { const f = nearestFoe(a, 340); if (f) { G.fx.push({k: 'laser', x0: a.x, z0: a.z, h0: 50, x1: f.x, z1: f.z, h1: 26, t: 0, life: 0.08, col: '#3cffae'}); damage(f, 6, {type: 'proc'}); a.cd = 0.35; AUDIO.play('laser', 0.3, 1.4); } }
}

// ---------------------------------------------------------------- 주인공 상태 이상 (적이 걸어 둠)
function updHeroStatus(P, dt) {
  P.slowT = Math.max(0, (P.slowT || 0) - dt);
  if (P.bleed && P.bleed.t > 0 && G.state === 'run' && P.act !== 'death') {
    P.bleed.t -= dt; P.bleed.tick -= dt;
    if (P.bleed.tick <= 0) {
      P.bleed.tick = 0.5; const d = P.bleed.dmg;
      if (P.shield > 0) { P.bleed.t = 0; }
      else if (P.hp - d <= 0) hurtHero(d, null);
      else { P.hp -= d; P.flash = 0.6; floatText(P.x, P.z, 70, '-' + d, '#ff8a96'); burst(P.x, P.z, 40, '#ff3a50', 3, 60, 0.3, 2); }
    }
  }
}
function weaponSetup() {   // 쉼터·출정 시작 때 무기 준비
  G.drone = WPN() === 'drone' ? makeDrone(G.player) : null;
}
// 무기 고르기 카드에 쓸 그림
const WTHUMB = {};
function weaponThumb(w) {
  if (WTHUMB[w]) return WTHUMB[w];
  const [key, col, row] = WEAPON[w].spr, img = IMG[key]; if (!img) return '';
  const C = key === 'drone' ? 64 : JS.hero.cell, c = document.createElement('canvas'); c.width = c.height = C;
  const x = c.getContext('2d'); x.drawImage(img, col * C, row * C, C, C, 0, 0, C, C);
  return WTHUMB[w] = c.toDataURL();
}

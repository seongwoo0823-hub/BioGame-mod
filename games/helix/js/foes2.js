// 헬릭스 적 고유 공격: 적마다 다른 예고·동작·효과
//   BEGIN[적 id](f, 방향, 거리) → 공격 시작 (false면 기본 공격)
//   ATK[종류] = {wind(f, dt), strike(f), upd(f, dt)} → 예고 중 · 공격 순간 · 공격 동작 중
//   BOSS_EXTRA[보스 id] → 보스의 추가 기술
'use strict';
const BEGIN = {}, ATK = {}, BOSS_EXTRA = {};

// ---------------------------------------------------------------- 공용 도구
// 지연 위험 지역: 예고를 그리다가 시간이 되면 터짐
function hazard(o) { o.t = -(o.delay || 0); o.life = o.life || 0.7; (G.hz = G.hz || []).push(o); return o; }
function updHazards(dt) {
  const P = G.player;
  for (let i = (G.hz || []).length - 1; i >= 0; i--) {
    const h = G.hz[i]; h.t += dt;
    if (h.t < h.life) continue;
    G.hz.splice(i, 1);
    if (G.state !== 'run') continue;
    if (h.fx === 'none') continue;
    if (!h.nohit && h.dmg > 0 && teleHit(h, P.x, P.z, P.r)) { if (hurtHero(h.dmg, h) && h.onHit) h.onHit(P); }
    const col = h.col || '#ff5a6a';
    if (h.fx === 'spike') { burst(h.x, h.z, 6, [col, '#e8e0d0'], 12, 260, 0.5, 3, 200); G.fx.push({k: 'spike', x: h.x, z: h.z, t: 0, life: 0.45, col, r: h.r}); }
    else if (h.fx === 'rain') { burst(h.x, h.z, 4, [col, '#ffffff'], 10, 200, 0.5, 2); G.fx.push({k: 'ring', x: h.x, z: h.z, r0: 8, r1: h.r, t: 0, life: 0.25, col}); addZone(h.x, h.z, h.r * 0.7, 1.6, 'foeAcid', 3, 'foe'); }
    else if (h.fx === 'zap') { G.fx.push({k: 'ring', x: h.x, z: h.z, r0: h.r0 || 10, r1: h.r, t: 0, life: 0.3, col}); for (let k = 0; k < 5; k++) { const a = Math.random() * TAU; G.fx.push({k: 'bolt', x0: h.x, z0: h.z, h0: 30, x1: h.x + Math.cos(a) * h.r, z1: h.z + Math.sin(a) * h.r, h1: 5, t: 0}); } }
    else G.fx.push({k: 'slam', x: h.x, z: h.z, r0: 10, r1: h.r || 60, t: 0, life: 0.3, col});
    if (h.shake) shake(h.shake);
    if (h.snd !== false) AUDIO.play(h.snd || 'slam', h.vol || 0.45, h.pitch || 1);
    if (h.after) h.after(h);
  }
}
function drawHazards() { for (const h of G.hz || []) if (h.t >= 0) { h.tt = h.t; drawTele(Object.assign({}, h, {t: h.t, life: h.life}), null); } }
// 포물선 투척 (도착점에 예고)
function lob(f, tx, tz, o = {}) {
  const life = o.life || 0.8;
  const p = {k: 'lob', owner: 'foe', x: f.x, z: f.z, sx: f.x, sz: f.z, tx, tz, t: 0, life, h: 30, peak: o.peak || 140, r: 10, col: o.col || JS.mobs[f.id].tint, land: o.land, big: o.big, src: f};
  G.projs.push(p);
  if (o.tele !== false) hazard({shape: 'circle', x: tx, z: tz, r: o.r || 60, life, dmg: 0, snd: false, fx: 'none', nohit: true});
  return p;
}
function updLob(p, dt) {
  p.t += dt; const u = Math.min(1, p.t / p.life);
  p.x = lerp(p.sx, p.tx, u); p.z = lerp(p.sz, p.tz, u); p.h = 30 + Math.sin(u * Math.PI) * p.peak - u * 20;
  if (u >= 1) { if (p.land) p.land(p); return true; }
  return false;
}
const towardP = (f, k = 1) => { const P = G.player; return Math.atan2(P.z - f.z, P.x - f.x); };
const fspot = (x, z, r = 16) => { const R = G.room; return R.free(x, z, r) ? [x, z] : R.nearestFree(x, z, r); };
function lunge(f, ang, dist, dt, total) { const v = dist / total; G.room.move(f, Math.cos(ang) * v * dt, Math.sin(ang) * v * dt, f.r * 0.7); }
const hitHero = (f, mul = 1, src) => hurtHero(Math.round(fdmg(f) * mul), src || f);
const endAtk = f => { f.st = 'chase'; f.t = 0; f.cd = FOE[f.id].cd * rand(0.8, 1.25); f.tele = null; f.lift = 0; f.sq = 1; };
// 적 투사체 (특수 동작 포함)
function fshot(f, a, spd, o = {}) {
  const M = JS.mobs[f.id];
  const p = {k: o.k || 'spore', owner: 'foe', x: f.x + Math.cos(a) * f.r, z: f.z + Math.sin(a) * f.r, h: o.h || Math.min(40, f.foot * 0.4), vx: Math.cos(a) * spd, vz: Math.sin(a) * spd, t: 0, life: o.life || 2.6, r: o.r || 10, dmg: o.dmg || fdmg(f), col: o.col || M.tint, streak: o.streak, split: o.split, splitN: o.splitN, src: f};
  G.projs.push(p); return p;
}
function updFoeProjExtra(dt) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    if (p.owner !== 'foe' || !p.split || p.t < p.split) continue;
    G.projs.splice(i, 1);
    const n = p.splitN || 6, base = Math.atan2(G.player.z - p.z, G.player.x - p.x);
    for (let k = 0; k < n; k++) { const a = base + k / n * TAU; G.projs.push({k: 'shard', owner: 'foe', x: p.x, z: p.z, h: p.h, vx: Math.cos(a) * 300, vz: Math.sin(a) * 300, t: 0, life: 1.2, r: 8, dmg: Math.round(p.dmg * 0.7), col: p.col, streak: 12}); }
    G.fx.push({k: 'ring', x: p.x, z: p.z, r0: 4, r1: 40, t: 0, life: 0.2, col: p.col}); AUDIO.play('crystal', 0.35);
  }
  // 회전 발사 (나선)
  for (const f of G.foes) if (f.emit && f.st !== 'dead') {
    const E = f.emit; E.t += dt; E.acc += dt;
    while (E.acc >= E.every && E.t < E.dur) { E.acc -= E.every; for (let k = 0; k < E.arms; k++) fshot(f, E.a + k * TAU / E.arms, E.spd, {dmg: Math.round(fdmg(f) * 0.45), k: 'shard', streak: 10, life: 2.2}); E.a += E.step; if (Math.random() < 0.3) AUDIO.play('shoot', 0.2, 1.4); }
    if (E.t >= E.dur) f.emit = null;
  }
}
// 땅속 잠행 (일반·중간 보스)
function foeUnder(f, dt) {
  const P = G.player, U = f.under; f.hidden = true; U.t += dt;
  const a = Math.atan2(P.z - f.z, P.x - f.x), d = Math.hypot(P.x - f.x, P.z - f.z);
  if (d > 20) G.room.move(f, Math.cos(a) * U.spd * dt, Math.sin(a) * U.spd * dt, f.r * 0.6);
  if (Math.random() < dt * 14) burst(f.x, f.z, 0, ['#6a4a2a', '#8a6a4a'], 2, 100, 0.4, 3, 80);
  if (U.t >= U.dur || d < 30) {
    f.hidden = false; f.under = null; f.tele = null;
    startFoeAttack(f, 'attack', 0.45, 0.35, {shape: 'circle', x: f.x, z: f.z, r: U.r}, 'emergeF');
  }
}
// 몸 위 표시 효과 (draw에서 부름)
function drawUnder() { for (const f of G.foes) if (f.hidden && f.under) { ctx.fillStyle = 'rgba(70,52,34,0.85)'; ctx.beginPath(); ctx.ellipse(SX(f.x), SY(f.z), f.r * 1.2, f.r * 0.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(120,90,60,0.6)'; ctx.beginPath(); ctx.ellipse(SX(f.x) + Math.sin(G.time * 20) * 3, SY(f.z) - 3, f.r * 0.7, f.r * 0.28, 0, 0, TAU); ctx.fill(); } }

// ================================================================ 일반 적 16종
// 1 파지: 낮게 두 번 뛰어들기
BEGIN.phage = (f, ang, d) => { f.hops = 2; startFoeAttack(f, 'attack', FOE.phage.wind, 0.34, {shape: 'circle', x: f.x + Math.cos(ang) * Math.min(d, 120), z: f.z + Math.sin(ang) * Math.min(d, 120), r: 46}, 'hop'); };
ATK.hop = {
  wind(f, dt) { f.sq = 1 - 0.25 * Math.min(1, f.t / f.windT); },
  strike(f) { const T = f.tele; f.hopFrom = [f.x, f.z]; f.hopTo = [T.x, T.z]; f.sq = 1.15; AUDIO.play('jump', 0.4, 1.4); },
  upd(f, dt) {
    const u = Math.min(1, f.t / f.atkT), T = f.tele;
    const p = fspot(lerp(f.hopFrom[0], f.hopTo[0], u), lerp(f.hopFrom[1], f.hopTo[1], u), f.r * 0.6); f.x = p[0]; f.z = p[1];
    f.lift = Math.sin(u * Math.PI) * 46; f.sq = 1 + 0.15 * Math.sin(u * Math.PI);
    if (u >= 1) {
      f.lift = 0; if (T && teleHit(T, G.player.x, G.player.z, G.player.r)) hitHero(f); burst(f.x, f.z, 0, ['#8a7a6a', JS.mobs[f.id].tint], 6, 120, 0.3, 2); AUDIO.play('land', 0.4, 1.3);
      f.hops--;
      if (f.hops > 0 && f.st !== 'dead') { const a = towardP(f); startFoeAttack(f, 'attack', 0.22, 0.3, {shape: 'circle', x: f.x + Math.cos(a) * 90, z: f.z + Math.sin(a) * 90, r: 46}, 'hop'); f.d = dir8(a); return true; }
      endAtk(f);
    }
    return true;
  },
};
// 2 아메바: 몸을 부풀렸다가 주변을 삼키고 끈적한 점액을 남김
BEGIN.amoeba = (f, ang, d) => startFoeAttack(f, 'attack', 0.7, 0.35, {shape: 'circle', x: f.x, z: f.z, r: 92}, 'engulf');
ATK.engulf = {
  wind(f, dt) { f.sq = 1 + 0.3 * Math.min(1, f.t / f.windT); if (f.tele) { f.tele.x = f.x; f.tele.z = f.z; } },
  strike(f) {
    const P = G.player; if (teleHit(f.tele, P.x, P.z, P.r)) { if (hitHero(f)) P.slowT = 1.6; }
    addZone(f.x, f.z, 80, 3.5, 'slime', 0, 'foe');
    G.fx.push({k: 'slam', x: f.x, z: f.z, r0: 20, r1: 92, t: 0, life: 0.3, col: '#c8ff60'}); burst(f.x, f.z, 10, ['#c8ff60', '#7ab030'], 18, 220, 0.5, 3);
    AUDIO.play('squish', 0.9, 0.6); f.sq = 0.8; f.tele = null;
  },
  upd(f, dt) { f.sq = lerp(f.sq, 1, dt * 8); if (f.t >= f.atkT) endAtk(f); return true; },
};
// 3 막대균: 회전하며 돌진, 지나간 자리에 독 자국
BEGIN.bacillus = (f, ang, d) => { f.chargeAng = ang; startFoeAttack(f, 'attack', 0.55, 0.42, {shape: 'line', x: f.x, z: f.z, ang, len: 300, w: f.r * 2 + 12}, 'drill'); };
ATK.drill = {
  wind(f, dt) { f.sq = 1 - 0.1 * Math.sin(f.t * 40); },
  strike(f) { AUDIO.play('dash', 0.5, 1.2); f.tele = null; },
  upd(f, dt) {
    lunge(f, f.chargeAng, 300, dt, f.atkT); f.d = Math.floor(f.t * 30) % 8;
    if (G.time - (f.trailT || 0) > 0.07) { f.trailT = G.time; addZone(f.x, f.z, 22, 1.8, 'foeAcid', 3, 'foe'); }
    if (!f.didHit && dist(f, G.player) < f.r + G.player.r + 4) { f.didHit = true; hitHero(f); }
    if (f.t >= f.atkT) { f.d = dir8(f.chargeAng); endAtk(f); }
    return true;
  },
};
// 4 암세포 거수: 땅을 내려쳐 앞으로 나아가는 충격파
BEGIN.brute = (f, ang, d) => { f.waveAng = ang; startFoeAttack(f, 'attack', 0.85, 0.5, {shape: 'line', x: f.x, z: f.z, ang, len: 260, w: 70}, 'quakeLine'); };
ATK.quakeLine = {
  wind(f, dt) { f.lift = Math.min(1, f.t / f.windT) * 10; },
  strike(f) {
    f.lift = 0; shake(6); AUDIO.play('slam', 0.8, 0.8);
    const n = f.tier === 'mid' ? 6 : 4;
    for (let k = 0; k < n; k++) { const dd = 45 + k * 55; hazard({shape: 'circle', x: f.x + Math.cos(f.waveAng) * dd, z: f.z + Math.sin(f.waveAng) * dd, r: 48 + k * 4, delay: k * 0.09, life: 0.12, dmg: fdmg(f), fx: 'spike', col: '#c070ff', vol: 0.3, pitch: 1 + k * 0.1}); }
    f.tele = null;
  },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
BEGIN.brute_x = BEGIN.brute;
// 5 감염 연구원: 주사기 찌르기 또는 시약병 던지기
BEGIN.researcher = (f, ang, d) => {
  if (d > 110 && Math.random() < 0.6) { startFoeAttack(f, 'attack', 0.5, 0.3, null, 'vial'); return; }
  return false;
};
ATK.vial = {
  strike(f) { const P = G.player; lob(f, P.x + P.vx * 0.25, P.z + P.vz * 0.25, {r: 56, life: 0.75, col: '#b04aff', land: p => { hazard({shape: 'circle', x: p.x, z: p.z, r: 56, life: 0.01, dmg: fdmg(f), fx: 'rain', col: '#b04aff', snd: 'splash', vol: 0.5}); }}); AUDIO.play('throw', 0.4, 1.2); },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
// 6 모기: 위로 솟았다가 내리꽂아 피를 빨아감
BEGIN.mosquito = (f, ang, d) => { f.chargeAng = ang; startFoeAttack(f, 'attack', 0.55, 0.32, {shape: 'line', x: f.x, z: f.z, ang, len: Math.min(300, d + 50), w: 30}, 'stingDive'); f.diveLen = Math.min(300, d + 50); };
ATK.stingDive = {
  wind(f, dt) { f.lift = Math.min(1, f.t / f.windT) * 40; },
  strike(f) { AUDIO.play('buzz', 0.5); f.tele = null; },
  upd(f, dt) {
    const u = f.t / f.atkT; f.lift = 40 * (1 - u); lunge(f, f.chargeAng, f.diveLen, dt, f.atkT);
    if (!f.didHit && dist(f, G.player) < f.r + G.player.r + 6) { f.didHit = true; if (hitHero(f)) { G.player.bleed = {t: 1.6, tick: 0.5, dmg: 2}; f.hp = Math.min(f.maxhp, f.hp + 5); floatText(f.x, f.z, 50, '흡혈', '#ff5a6a'); } }
    if (u >= 1) endAtk(f);
    return true;
  },
};
// 7 기생충: 땅속으로 파고들어 발밑에서 솟아오름
BEGIN.worm = (f, ang, d) => {
  if (d < 90 && Math.random() < 0.5) return false;   // 가까우면 채찍질
  f.st = 'under'; f.t = 0; f.under = {t: 0, dur: 1.0, spd: 210, r: 66}; f.tele = null; AUDIO.play('dig', 0.5); burst(f.x, f.z, 0, ['#6a4a2a', '#c09c76'], 10, 160, 0.5, 3, 120);
};
ATK.emergeF = {
  wind(f, dt) { if (Math.random() < dt * 20) burst(f.x + rand(-20, 20), f.z + rand(-10, 10), 0, ['#6a4a2a', '#8a6a4a'], 1, 80, 0.4, 3, 100); },
  strike(f) { const T = f.tele; if (T && teleHit(T, G.player.x, G.player.z, G.player.r)) hitHero(f, 1.1); burst(f.x, f.z, 10, ['#6a4a2a', '#c09c76', JS.mobs[f.id].tint], 18, 300, 0.6, 3, 200); G.fx.push({k: 'slam', x: f.x, z: f.z, r0: 10, r1: T ? T.r : 60, t: 0, life: 0.3, col: '#c09c76'}); shake(4); AUDIO.play('slam', 0.6, 1.2); f.lift = 30; f.tele = null; },
  upd(f, dt) { f.lift = Math.max(0, f.lift - dt * 120); if (f.t >= f.atkT) endAtk(f); return true; },
};
// 8 버섯: 포자탄을 곡사로 날려 독구름
BEGIN.shroom = (f, ang, d) => { startFoeAttack(f, 'attack', 0.6, 0.4, null, 'mortar'); f.sq = 1; };
ATK.mortar = {
  wind(f, dt) { f.sq = 1 - 0.2 * Math.min(1, f.t / f.windT); },
  strike(f) {
    const P = G.player, n = f.tier === 'mid' ? 5 : 3;
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = k === 0 ? 0 : rand(40, 110); const t = fspot(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 8);
      lob(f, t[0], t[1], {r: 50, life: 0.8 + k * 0.1, col: '#7ae0ff', land: p => { addZone(p.x, p.z, 48, 2.6, 'foeAcid', 3, 'foe'); hazard({shape: 'circle', x: p.x, z: p.z, r: 48, life: 0.01, dmg: Math.round(fdmg(f) * 0.8), fx: 'ring', col: '#7ae0ff', snd: 'splash', vol: 0.35}); }}); }
    f.sq = 1.25; AUDIO.play('spit', 0.6, 0.8);
  },
  upd(f, dt) { f.sq = lerp(f.sq, 1, dt * 6); if (f.t >= f.atkT) endAtk(f); return true; },
};
// 9 프리온: 결정탄이 날아가다 사방으로 쪼개짐
BEGIN.prion = (f, ang, d) => startFoeAttack(f, 'attack', 0.6, 0.3, {shape: 'line', x: f.x, z: f.z, ang, len: Math.min(d, 260), w: 6, thin: true, track: true}, 'crystal');
ATK.crystal = {
  strike(f) { const a = f.tele ? f.tele.ang : towardP(f); fshot(f, a, 230, {k: 'shard', split: 0.55, splitN: 6, r: 12, streak: 14}); AUDIO.play('crystal', 0.5); f.tele = null; },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
// 10 플라나리아: 인두관을 길게 뻗어 끌어당김
BEGIN.planaria = (f, ang, d) => startFoeAttack(f, 'attack', 0.5, 0.35, {shape: 'line', x: f.x, z: f.z, ang, len: 210, w: 26}, 'tongue');
ATK.tongue = {
  strike(f) {
    const T = f.tele, P = G.player; G.fx.push({k: 'tongue', x: f.x, z: f.z, ang: T.ang, len: T.len, t: 0, life: 0.3, col: '#e8b090'});
    if (teleHit(T, P.x, P.z, P.r) && hitHero(f, 0.8)) { f.pull = 0.25; }
    AUDIO.play('whip', 0.5); f.tele = null;
  },
  upd(f, dt) {
    if (f.pull > 0) { f.pull -= dt; const P = G.player, a = Math.atan2(f.z - P.z, f.x - P.x); if (dist(f, P) > f.r + P.r + 10) G.room.move(P, Math.cos(a) * 520 * dt, Math.sin(a) * 520 * dt, P.r); }
    if (f.t >= f.atkT) endAtk(f); return true;
  },
};
// 11 상자해파리: 몸 둘레에 고리 모양 전기 촉수
BEGIN.jelly = (f, ang, d) => startFoeAttack(f, 'attack', 0.65, 0.35, {shape: 'ring', x: f.x, z: f.z, r: 125, r0: 40}, 'nettle');
ATK.nettle = {
  wind(f, dt) { f.lift = Math.sin(f.t * 12) * 4 + 6; if (f.tele) { f.tele.x = f.x; f.tele.z = f.z; } },
  strike(f) {
    const T = f.tele, P = G.player; if (teleHit(T, P.x, P.z, P.r) && hitHero(f)) P.slowT = 1.2;
    G.fx.push({k: 'ring', x: f.x, z: f.z, r0: 40, r1: 125, t: 0, life: 0.3, col: '#5ae0ff'});
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.random() * 0.5; G.fx.push({k: 'bolt', x0: f.x, z0: f.z, h0: 40, x1: f.x + Math.cos(a) * 120, z1: f.z + Math.sin(a) * 120, h1: 4, t: 0}); }
    AUDIO.play('zap', 0.6, 0.8); f.tele = null;
  },
  upd(f, dt) { f.lift = Math.max(0, f.lift - dt * 30); if (f.t >= f.atkT) endAtk(f); return true; },
};
// 12 진드기: 높이 뛰어올라 달라붙어 피를 빨기
BEGIN.tick = (f, ang, d) => { const P = G.player; startFoeAttack(f, 'attack', 0.6, 0.55, {shape: 'circle', x: P.x, z: P.z, r: 52}, 'latchLeap'); };
BEGIN.tick_m = (f, ang, d) => { if (Math.random() < 0.5) return false; startFoeAttack(f, 'attack', 0.6, 0.4, null, 'eggs'); };
ATK.latchLeap = {
  wind(f, dt) { f.sq = 1 - 0.3 * Math.min(1, f.t / f.windT); },
  strike(f) { const T = f.tele; f.hopFrom = [f.x, f.z]; f.hopTo = [T.x, T.z]; AUDIO.play('jump', 0.5, 1.1); },
  upd(f, dt) {
    const u = Math.min(1, f.t / f.atkT), T = f.tele;
    const p = fspot(lerp(f.hopFrom[0], f.hopTo[0], u), lerp(f.hopFrom[1], f.hopTo[1], u), f.r * 0.6); f.x = p[0]; f.z = p[1];
    f.lift = Math.sin(u * Math.PI) * 110; f.sq = 1.1;
    if (u >= 1) { f.lift = 0; if (T && teleHit(T, G.player.x, G.player.z, G.player.r) && hitHero(f)) { G.player.bleed = {t: 2, tick: 0.5, dmg: 2}; floatText(G.player.x, G.player.z, 90, '출혈', '#ff5a6a'); } burst(f.x, f.z, 0, ['#8a7a6a', '#a0a8c0'], 8, 140, 0.3, 2); AUDIO.play('land', 0.5); endAtk(f); }
    return true;
  },
};
ATK.eggs = {
  strike(f) {
    const P = G.player;
    for (let k = 0; k < 3; k++) { const a = towardP(f) + (k - 1) * 0.7, r = rand(90, 160); const t = fspot(f.x + Math.cos(a) * r, f.z + Math.sin(a) * r, 16);
      lob(f, t[0], t[1], {r: 34, life: 0.7, peak: 110, col: '#ffd820', land: p => { burst(p.x, p.z, 4, ['#ffd820', '#ffffff'], 8, 120, 0.4, 2); AUDIO.play('squish', 0.5, 1.4); if (G.foes.filter(g => g.st !== 'dead').length < 12) spawnFoe('tick', p.x, p.z, {summoned: true}); }}); }
    AUDIO.play('spit', 0.6, 0.6);
  },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
// 13 코로나: 벽에 튕기며 굴러다니는 돌진
BEGIN.corona = (f, ang, d) => { f.chargeAng = ang; f.bounces = f.tier === 'mid' ? 3 : 2; startFoeAttack(f, 'attack', 0.6, 1.0, {shape: 'line', x: f.x, z: f.z, ang, len: 280, w: f.r * 2 + 8}, 'roll'); };
BEGIN.corona_n = BEGIN.corona;
ATK.roll = {
  wind(f, dt) { f.d = Math.floor(f.t * 16) % 8; },
  strike(f) { AUDIO.play('dash', 0.5, 0.9); f.tele = null; },
  upd(f, dt) {
    const v = 420, ox = f.x, oz = f.z, mx = Math.cos(f.chargeAng) * v * dt, mz = Math.sin(f.chargeAng) * v * dt;
    G.room.move(f, mx, mz, f.r * 0.7); f.d = Math.floor(f.t * 24) % 8;
    const moved = Math.hypot(f.x - ox, f.z - oz);
    if (moved < v * dt * 0.4 && f.bounces > 0) {   // 벽에 부딪힘 → 튕김
      f.bounces--; const bx = !G.room.free(ox + mx * 2, oz, f.r * 0.7), bz = !G.room.free(ox, oz + mz * 2, f.r * 0.7);
      let ca = Math.cos(f.chargeAng), sa = Math.sin(f.chargeAng); if (bx || !bz) ca = -ca; if (bz || !bx) sa = -sa; f.chargeAng = Math.atan2(sa, ca);
      shake(2); AUDIO.play('land', 0.5, 1.4); burst(f.x, f.z, 20, JS.mobs[f.id].tint, 6, 120, 0.3, 2);
      if (f.tier === 'mid') for (let k = 0; k < 8; k++) fshot(f, k / 8 * TAU, 190, {dmg: Math.round(fdmg(f) * 0.5)});
    }
    if (!f.didHit && dist(f, G.player) < f.r + G.player.r + 4) { f.didHit = true; hitHero(f); }
    if (f.t >= f.atkT) endAtk(f);
    return true;
  },
};
// 14 거머리: 달라붙어 느리게 만들고 피를 빨기
BEGIN.leech = (f, ang, d) => { f.chargeAng = ang; startFoeAttack(f, 'attack', 0.5, 0.3, {shape: 'line', x: f.x, z: f.z, ang, len: 180, w: f.r * 2}, 'latch'); };
ATK.latch = {
  wind(f, dt) { f.lift = Math.min(1, f.t / f.windT) * 8; f.sq = 1 + 0.2 * Math.min(1, f.t / f.windT); },
  strike(f) { AUDIO.play('whip', 0.4, 0.7); f.tele = null; f.sq = 0.8; },
  upd(f, dt) {
    if (f.latched > 0) {
      f.latched -= dt; const P = G.player; f.x = P.x - Math.cos(f.chargeAng) * (f.r + P.r - 6); f.z = P.z - Math.sin(f.chargeAng) * (f.r + P.r - 6); P.slowT = 0.3;
      f.drainT = (f.drainT || 0) - dt; if (f.drainT <= 0) { f.drainT = 0.5; if (P.hp > 2 && P.inv <= 0 && P.shield <= 0) { P.hp -= 2; P.flash = 0.5; f.hp = Math.min(f.maxhp, f.hp + 3); floatText(P.x, P.z, 70, '-2', '#ff8a96'); burst(P.x, P.z, 40, '#ff3a50', 3, 60, 0.3, 2); } }
      if (f.latched <= 0 || P.act === 'dash') { f.latched = 0; endAtk(f); }
      return true;
    }
    lunge(f, f.chargeAng, 180, dt, f.atkT); f.lift = 0; f.sq = lerp(f.sq, 1, dt * 8);
    if (!f.didHit && dist(f, G.player) < f.r + G.player.r + 4) { f.didHit = true; if (hitHero(f, 0.7)) { f.latched = 1.6; floatText(f.x, f.z, 50, '달라붙음!', '#ff5a6a'); } }
    if (f.t >= f.atkT && !f.latched) endAtk(f);
    return true;
  },
};
// 15 클론 병사: 조준선을 겨누고 3연사
BEGIN.clone = (f, ang, d) => startFoeAttack(f, 'attack', 0.7, 0.42, {shape: 'line', x: f.x, z: f.z, ang, len: Math.min(d + 40, 380), w: 4, thin: true, track: true, laser: true}, 'burst3');
ATK.burst3 = {
  strike(f) { f.burstA = f.tele ? f.tele.ang : towardP(f); f.burstN = 0; f.tele = null; },
  upd(f, dt) {
    const n = f.tier === 'mid' ? 5 : 3;
    while (f.burstN < n && f.t >= f.burstN * 0.11) { const a = f.burstA + rand(-0.05, 0.05); fshot(f, a, 360, {k: 'acid', r: 8, streak: 16, dmg: Math.round(fdmg(f) * 0.6), col: '#7aff3a'}); f.burstN++; AUDIO.play('shoot', 0.4, 1.2); G.fx.push({k: 'muzzle', x: f.x + Math.cos(a) * f.r, z: f.z + Math.sin(a) * f.r, ang: a, t: 0, life: 0.05}); }
    if (f.t >= f.atkT + (n - 3) * 0.11) endAtk(f);
    return true;
  },
};
// 16 실험쥐: 재빠른 3연속 물기
BEGIN.rat = (f, ang, d) => { f.bites = 3; startFoeAttack(f, 'attack', 0.32, 0.14, {shape: 'cone', x: f.x, z: f.z, r: 72, ang, arc: Math.PI * 0.55}, 'frenzy'); };
ATK.frenzy = {
  strike(f) {
    const T = f.tele, P = G.player; if (T && teleHit(T, P.x, P.z, P.r)) hitHero(f, 0.6);
    G.fx.push({k: 'claw', x: f.x + Math.cos(T.ang) * 40, z: f.z + Math.sin(T.ang) * 40, ang: T.ang, t: 0, life: 0.15, col: '#ffd0e0'}); AUDIO.play('bite', 0.5, 1.2);
  },
  upd(f, dt) {
    lunge(f, f.tele ? f.tele.ang : f.d * Math.PI / 4, 30, dt, f.atkT);
    if (f.t >= f.atkT) {
      f.bites--; if (f.bites > 0) { const a = towardP(f); f.d = dir8(a); startFoeAttack(f, 'attack', 0.06, 0.14, {shape: 'cone', x: f.x, z: f.z, r: 72, ang: a, arc: Math.PI * 0.55}, 'frenzy'); f.windT = 0.06; return true; }
      endAtk(f);
    }
    return true;
  },
};

// ================================================================ 중간 보스 고유 공격 (특수기는 game.js의 midSpecial)
BEGIN.phage_q = (f, ang, d) => { if (Math.random() < 0.5) return false; const P = G.player; startFoeAttack(f, 'attack', 0.7, 0.5, {shape: 'circle', x: P.x, z: P.z, r: 105}, 'royalPounce'); };
ATK.royalPounce = {
  wind: ATK.latchLeap.wind, strike: ATK.latchLeap.strike,
  upd(f, dt) {
    const u = Math.min(1, f.t / f.atkT), T = f.tele;
    const p = fspot(lerp(f.hopFrom[0], f.hopTo[0], u), lerp(f.hopFrom[1], f.hopTo[1], u), f.r * 0.6); f.x = p[0]; f.z = p[1]; f.lift = Math.sin(u * Math.PI) * 130;
    if (u >= 1) { f.lift = 0; if (T && teleHit(T, G.player.x, G.player.z, G.player.r)) hitHero(f); G.fx.push({k: 'slam', x: f.x, z: f.z, r0: 20, r1: 105, t: 0, life: 0.35, col: '#ffb040'}); shake(8); AUDIO.play('slam'); for (let k = 0; k < 10; k++) fshot(f, k / 10 * TAU, 200, {dmg: Math.round(fdmg(f) * 0.45)}); endAtk(f); }
    return true;
  },
};
BEGIN.shroom_k = (f, ang, d) => { const r = Math.random(); if (r < 0.35) return false; if (r < 0.65) { startFoeAttack(f, 'attack', 0.6, 0.4, null, 'mortar'); return; } startFoeAttack(f, 'attack', 0.75, 0.6, null, 'roots'); };
ATK.roots = {
  strike(f) {
    const base = towardP(f);
    for (let l = -1; l <= 1; l++) { const a = base + l * 0.45; for (let k = 0; k < 6; k++) { const dd = 60 + k * 50; hazard({shape: 'circle', x: f.x + Math.cos(a) * dd, z: f.z + Math.sin(a) * dd, r: 34, delay: k * 0.08, life: 0.35, dmg: fdmg(f), fx: 'spike', col: '#8a6ae8', vol: 0.25, pitch: 1.2}); } }
    AUDIO.play('roar', 0.4, 1.3);
  },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
BEGIN.leech_l = (f, ang, d) => { if (Math.random() < 0.45) return false; startFoeAttack(f, 'attack2' in f.an ? 'attack' : 'attack', 0.6, 0.6, {shape: 'cone', x: f.x, z: f.z, r: 300, ang, arc: 1.0, thin: true}, 'bloodWave'); };
ATK.bloodWave = {
  strike(f) { f.waveN = 0; f.waveA = f.tele.ang; f.tele = null; },
  upd(f, dt) {
    while (f.waveN < 3 && f.t >= f.waveN * 0.18) { for (let k = 0; k < 7; k++) fshot(f, f.waveA - 0.5 + k / 6 + (f.waveN % 2) * 0.07, 260, {k: 'acid', col: '#ff3a3a', dmg: Math.round(fdmg(f) * 0.45)}); f.waveN++; AUDIO.play('splash', 0.4, 1.2); }
    if (f.t >= f.atkT) endAtk(f); return true;
  },
};
BEGIN.clone_c = (f, ang, d) => { const r = Math.random(); if (r < 0.4) return false; if (r < 0.7) { BEGIN.clone(f, ang, d); return; } startFoeAttack(f, 'attack', 0.5, 0.4, null, 'grenade'); };
ATK.grenade = {
  strike(f) { const P = G.player; for (let k = 0; k < 2; k++) { const t = fspot(P.x + rand(-70, 70), P.z + rand(-50, 50), 8); lob(f, t[0], t[1], {r: 80, life: 0.9 + k * 0.15, peak: 160, col: '#7aff3a', land: p => { hazard({shape: 'circle', x: p.x, z: p.z, r: 80, life: 0.01, dmg: fdmg(f), fx: 'slam', col: '#ffb040', shake: 5, snd: 'boom', vol: 0.6}); burst(p.x, p.z, 10, ['#ffb040', '#ffffff', '#3a3a3a'], 20, 300, 0.5, 3, 120); }}); } AUDIO.play('throw', 0.5); },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};
BEGIN.prion_g = (f, ang, d) => { const r = Math.random(); if (r < 0.35) { BEGIN.prion(f, ang, d); return; } if (r < 0.55) return false; startFoeAttack(f, 'attack', 0.7, 1.4, {shape: 'circle', x: f.x, z: f.z, r: 60, thin: true}, 'spiral'); };
ATK.spiral = {
  strike(f) { f.emit = {t: 0, acc: 0, every: 0.08, dur: 1.3, arms: 3, a: Math.random() * TAU, step: 0.21, spd: 210}; f.tele = null; AUDIO.play('crystal', 0.6, 0.8); },
  upd(f, dt) { if (f.t >= f.atkT) endAtk(f); return true; },
};

// ================================================================ 보스 추가 기술
BOSS_EXTRA.queen = (f, d, ang, ph2) => startFoeAttack(f, 'attack2', 0.6, 1.2, null, 'acidRain');
ATK.acidRain = {
  strike(f) { const P = G.player, n = f.phase === 2 ? 10 : 7; for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = k === 0 ? 0 : rand(30, 200); const t = fspot(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 8); hazard({shape: 'circle', x: t[0], z: t[1], r: 58, delay: k * 0.12, life: 0.75, dmg: Math.round(fdmg(f) * 0.7), fx: 'rain', col: '#c8ff20', snd: 'splash', vol: 0.4}); } AUDIO.play('roar', 0.5, 1.2); },
  upd(f, dt) { if (f.t >= f.atkT) { f.st = 'chase'; f.t = 0; f.cd = FOE[f.id].cd; f.tele = null; } return true; },
};
BOSS_EXTRA.wormking = (f, d, ang, ph2) => startFoeAttack(f, 'attack', 0.7, 0.9, {shape: 'line', x: f.x, z: f.z, ang, len: 520, w: 70}, 'spikeLine');
ATK.spikeLine = {
  strike(f) { const a = f.tele.ang; for (let k = 0; k < 10; k++) { const dd = 50 + k * 50; for (const s of (f.phase === 2 ? [-1, 0, 1] : [0])) { const aa = a + s * 0.3; hazard({shape: 'circle', x: f.x + Math.cos(aa) * dd, z: f.z + Math.sin(aa) * dd, r: 40, delay: k * 0.06, life: 0.1, dmg: fdmg(f), fx: 'spike', col: '#c09c76', vol: 0.3, pitch: 0.9 + k * 0.05, shake: 2}); } } f.tele = null; AUDIO.play('roar', 0.4, 0.8); },
  upd: ATK.acidRain.upd,
};
BOSS_EXTRA.doctor = (f, d, ang, ph2) => startFoeAttack(f, 'attack', 0.55, 0.8, {shape: 'cone', x: f.x, z: f.z, r: 420, ang, arc: 0.9, thin: true, track: true}, 'syringes');
ATK.syringes = {
  strike(f) { f.waveN = 0; f.waveA = f.tele ? f.tele.ang : towardP(f); f.tele = null; },
  upd(f, dt) {
    const waves = f.phase === 2 ? 3 : 2;
    while (f.waveN < waves && f.t >= f.waveN * 0.25) { for (let k = 0; k < 5; k++) fshot(f, f.waveA - 0.4 + k * 0.2 + (f.waveN % 2) * 0.1, 430, {k: 'syringe', streak: 22, r: 8, col: '#c060ff', dmg: Math.round(fdmg(f) * 0.5)}); f.waveN++; AUDIO.play('throw', 0.5, 1.5); }
    if (f.t >= f.atkT) { f.st = 'chase'; f.t = 0; f.cd = FOE[f.id].cd; } return true;
  },
};
BOSS_EXTRA.helix = (f, d, ang, ph2) => startFoeAttack(f, 'special', 0.8, 1.8, {shape: 'circle', x: f.x, z: f.z, r: 90, thin: true}, 'dnaSpiral');
ATK.dnaSpiral = {
  strike(f) { f.emit = {t: 0, acc: 0, every: f.phase === 2 ? 0.07 : 0.09, dur: 1.6, arms: 2, a: towardP(f), step: 0.26, spd: 230}; f.tele = null; AUDIO.play('beamCharge', 0.6); },
  upd: ATK.acidRain.upd,
};

// 매 프레임 (run.js에서 부름)
function updFoeExtra(dt) { updHazards(dt); updFoeProjExtra(dt); }

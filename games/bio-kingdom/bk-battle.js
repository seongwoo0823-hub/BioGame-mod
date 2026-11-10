/* 바이오 킹덤 · 전투 (옆 시점, 영웅 5명 vs 병원체 3웨이브) */
(function () {
  'use strict';
  const BK = window.BK, D = window.BKD;
  const B = BK.B = { on: false };
  const VH = 540, GY = 452;           // 화면 기준 높이, 땅 높이
  let cv, g, W = 0, H = 0, DPR = 1, SC = 1, VW = 960, OY = 0;
  let st = null, raf = 0, last = 0, root = null;

  B.init = function (canvas, overlay) { cv = canvas; g = cv.getContext('2d'); root = overlay; addEventListener('resize', resize); };
  function resize() { if (!cv) return; DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const c0 = root && root.querySelector('.bt-card'), cH = c0 ? c0.getBoundingClientRect().height + 18 : 120; SC = Math.min(H / VH, W / 760, (H - cH) / (GY + 40)); VW = W / SC; OY = Math.max(0, (H - cH) / SC - (GY + 40)); }

  // ---------- 유닛 ----------
  function mkHero(id, slot) {
    const h = BK.S.heroes[id], s = D.statsOf(id, h.lv, h.star, h.sk), H0 = D.HERO[id], R = D.ROLE[H0.role];
    return { side: 0, id, h: H0, slot, x: 120 + (2 - R.pos) * 85 + (slot % 2) * 20, y: GY - 52 + [0, 44, 18, 62, 30][slot], hp: s.hp, max: s.hp, atk: s.atk, def: s.def, aspd: s.aspd, range: R.range + (R.pos >= 2 ? 0 : 0), ranged: R.pos >= 2, skMul: s.skMul,
      cd: 0.6 + Math.random() * 0.4, sk: H0.sk.cd * 0.45, skMax: H0.sk.cd, anim: 'idle', at: 0, act: 0, buf: [], shield: 0, dead: false, spd: 120, flash: 0, scale: 0.78 };
  }
  function mkEnemy(id, lvl, k) {
    const E = D.ENEMIES[id], s = D.enemyStat(id, lvl), sz = E.size || 1;
    return { side: 1, id, e: E, x: VW + 20 + k * 55, y: GY - 52 + [14, 50, 0, 34, 62][k % 5], hp: s.hp, max: s.hp, atk: s.atk, def: s.def, aspd: 1 / E.spd * 1.1, range: E.range, ranged: !!E.ranged, cd: 1 + Math.random(), anim: 'walk', at: Math.random() * 5, act: 0, buf: [], shield: 0, dead: false, spd: 120, flash: 0, scale: 0.9 * sz, boss: !!E.boss, bossT: 6 };
  }
  const alive = side => st.units.filter(u => u.side === side && !u.dead);
  const has = (u, k) => u.buf.some(b => b.k === k);
  const bufV = (u, k) => u.buf.filter(b => b.k === k).reduce((a, b) => a + b.v, 0);
  const later = (ms, fn) => st.q.push({ t: ms / 1000, fn });
  const atkOf = u => u.atk * (1 + bufV(u, 'atk')) * (has(u, 'trans') ? u.transMul : 1);

  // ---------- 시작 ----------
  B.start = function (stage, team, onEnd) {
    resize(); B.on = true; B.onEnd = onEnd;
    const C = D.CHAPTERS[stage.ci];
    st = { stage, C, units: [], proj: [], fx: [], nums: [], wave: 0, phase: 'intro', pt: 0, t: 0, scroll: 0, speed: BK.S.opt && BK.S.opt.x2 ? 2 : 1, auto: !!(BK.S.opt && BK.S.opt.auto), slow: 0, cut: null, time: 150, deaths: 0, paused: false, shake: 0, q: [] };
    team.forEach((id, i) => st.units.push(mkHero(id, i)));
    st.heroes = st.units.slice();
    st.deco = []; for (let k = 0; k < 40; k++) st.deco.push({ x: k * 170 + Math.random() * 90, n: C.deco[k % C.deco.length], s: 0.5 + Math.random() * 0.35, back: Math.random() < 0.5 });
    st.clouds = []; for (let k = 0; k < 6; k++) st.clouds.push({ x: Math.random() * 1400, y: 30 + Math.random() * 120, n: 'cloud' + (1 + k % 8), s: 0.5 + Math.random() * 0.5, v: 4 + Math.random() * 8 });
    team.forEach(id => BK.hero(id)); BK.bgImg(C.bg); BK.bgImg(C.far);
    buildHud(); resize(); BK.music('battle');
    BK.snd('v_ready', 0.8);
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop);
  };
  B.stop = function () { B.on = false; cancelAnimationFrame(raf); root.innerHTML = ''; root.style.display = 'none'; };

  function spawnWave() {
    const L = st.stage.waves[st.wave]; L.forEach((id, k) => st.units.push(mkEnemy(id, st.stage.lvl, k)));
    banner(st.wave === 2 ? (st.stage.boss ? '보스 등장!' : '마지막 웨이브') : `웨이브 ${st.wave + 1}/3`, st.wave === 2 && st.stage.boss ? '#ff5a6a' : '#fff');
    if (st.wave === 2) BK.snd(st.stage.boss ? 'v_final' : 'v_round1', 0.7); else if (st.wave === 0) setTimeout(() => BK.snd('v_fight', 0.8), 400);
  }

  // ---------- 루프 ----------
  function loop(now) {
    if (!B.on) return; raf = requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!st.paused) {
      const sp = st.speed * (st.slow > 0 ? 0.25 : 1); st.slow -= dt;
      const n = st.speed > 1 ? 2 : 1; for (let k = 0; k < n; k++) step(dt * sp / n);
    }
    draw(dt); hud();
  }
  function step(dt) {
    st.t += dt; st.pt += dt;
    for (let k = st.q.length - 1; k >= 0; k--) { const q = st.q[k]; q.t -= dt; if (q.t <= 0) { st.q.splice(k, 1); if (st.phase !== 'end') q.fn(); } }
    if (st.phase === 'intro') { if (st.pt > 0.9) { st.phase = 'fight'; st.pt = 0; spawnWave(); } }
    else if (st.phase === 'march') {   // 다음 웨이브로 달려감 (배경이 흘러감)
      st.scroll += 260 * dt;
      for (const u of alive(0)) { u.anim = 'run'; u.x += (homeX(u) - u.x) * Math.min(1, dt * 2); }
      if (st.pt > 1.4) { st.phase = 'fight'; st.pt = 0; spawnWave(); }
    } else if (st.phase === 'fight') {
      st.time -= dt;
      if (!alive(1).length) {
        st.wave++; st.proj.length = 0;
        if (st.wave >= 3) return end(true);
        st.phase = 'march'; st.pt = 0;
      } else if (!alive(0).length || st.time <= 0) return end(false);
    }
    for (const u of st.units) updUnit(u, dt);
    for (let k = st.proj.length - 1; k >= 0; k--) { const p = st.proj[k]; p.t += dt; const tg = p.tg; const tx = tg.x, ty = tg.y - 40; p.x += (tx - p.x) * Math.min(1, dt * 9); p.y += (ty - p.y) * Math.min(1, dt * 9) - Math.sin(p.t * 6) * 0.5; if (Math.hypot(tx - p.x, ty - p.y) < 14 || p.t > 1.2) { st.proj.splice(k, 1); if (!tg.dead) hit(p.from, tg, p.dmg, p.col); } }
    for (let k = st.fx.length - 1; k >= 0; k--) { const f = st.fx[k]; f.t += dt; if (f.t > f.d) st.fx.splice(k, 1); }
    for (let k = st.nums.length - 1; k >= 0; k--) { const f = st.nums[k]; f.t += dt; if (f.t > 1) st.nums.splice(k, 1); }
    if (st.cut) { st.cut.t += dt / Math.max(0.25, st.speed * (st.slow > 0 ? 0.25 : 1)); if (st.cut.t > 1.1) st.cut = null; }
    st.shake = Math.max(0, st.shake - dt * 30);
    if (st.auto && st.phase === 'fight') for (const u of alive(0)) if (u.sk >= u.skMax && !st.cut) { cast(u); break; }
  }
  const homeX = u => 120 + (2 - D.ROLE[u.h.role].pos) * 85 + (u.slot % 2) * 20;

  function nearest(u) {
    const foes = alive(1 - u.side); if (!foes.length) return null;
    if (u.side === 1) { const tt = foes.find(f => has(f, 'taunt')); if (tt) return tt; }
    let best = null, bd = 1e9; for (const f of foes) { const d = Math.abs(f.x - u.x) + Math.abs(f.y - u.y) * 0.3; if (d < bd) { bd = d; best = f; } } return best;
  }
  function updUnit(u, dt) {
    u.at += dt * 10; u.flash = Math.max(0, u.flash - dt * 4);
    if (u.dead) { u.deadT = (u.deadT || 0) + dt; return; }
    for (let k = u.buf.length - 1; k >= 0; k--) { const b = u.buf[k]; b.t -= dt; if (b.t <= 0) u.buf.splice(k, 1); }
    if (u.side === 0 && st.phase === 'fight') u.sk = Math.min(u.skMax, u.sk + dt);
    if (st.phase !== 'fight') { if (u.side === 0 && st.phase === 'intro') u.anim = 'idle'; return; }
    if (u.act > 0) { u.act -= dt; if (u.act <= 0) u.anim = 'idle'; else return; }
    separate(u, dt);
    const tg = nearest(u); if (!tg) { u.anim = 'idle'; return; }
    const dx = tg.x - u.x, dist = Math.abs(dx), slow = has(u, 'slow') ? 0.5 : 1;
    const reach = u.range + (tg.boss ? 40 : 0) + (u.boss ? 40 : 0);
    if (dist > reach) {
      u.x += Math.sign(dx) * u.spd * slow * dt; u.anim = 'walk';
    } else {
      u.anim = u.side === 0 ? 'idle' : 'walk';
      u.cd -= dt * slow * (has(u, 'trans') ? 1.5 : 1);
      if (u.boss) { u.bossT -= dt; if (u.bossT <= 0) { u.bossT = 7; bossSkill(u); return; } }
      if (u.cd <= 0) { u.cd = 1 / u.aspd; attack(u, tg); }
    }
  }
  function separate(u, dt) {   // 같은 편끼리 겹치지 않게 살짝 밀어냄
    for (const o of st.units) { if (o === u || o.dead || o.side !== u.side) continue; const dx = u.x - o.x, dy = u.y - o.y; if (Math.abs(dx) < 44 && Math.abs(dy) < 18) { u.y += (dy >= 0 ? 1 : -1) * 40 * dt; u.x += (dx >= 0 ? 1 : -1) * 20 * dt; } }
    u.y = BK.clamp(u.y, GY - 58, GY + 14);
  }
  function attack(u, tg) {
    u.anim = 'atk'; u.at = 0; u.act = 0.45; const dmg = atkOf(u) * (0.9 + Math.random() * 0.2);
    if (u.ranged) {
      const col = u.side ? u.e.col : (u.h.role === 'sup' ? '#9aff8a' : '#9adfff');
      later(180, () => { if (!u.dead && !tg.dead) st.proj.push({ x: u.x + (u.side ? -30 : 30), y: u.y - 50, tg, dmg, from: u, col, t: 0 }); });
      BK.snd('laser', 0.18, 1.3 + Math.random() * 0.3);
    } else { later(200, () => { if (!u.dead && !tg.dead) hit(u, tg, dmg); }); }
  }
  function hit(from, tg, dmg, col, opt) {
    opt = opt || {}; if (tg.dead) return;
    let d = Math.max(dmg * 0.15, dmg - tg.def * 0.6); if (opt.crit) d *= 1.6; d = Math.round(d);
    if (tg.shield > 0) { const a = Math.min(tg.shield, d); tg.shield -= a; d -= a; if (a) num(tg, a, '#9adfff', '막음'); }
    tg.hp -= d; tg.flash = 1; if (d > 0) num(tg, d, from && from.side === 0 ? (opt.crit ? '#ffd84a' : '#fff') : '#ff6a6a', opt.crit ? '치명!' : '');
    if (!opt.silent) BK.snd('hit' + (1 + Math.floor(Math.random() * 3)), 0.25, 0.9 + Math.random() * 0.3);
    if (tg.side === 1 && opt.knock) tg.x += 40;
    if (tg.side === 0 && tg.act <= 0 && Math.random() < 0.3) { tg.anim = 'hurt'; tg.at = 0; tg.act = 0.25; }
    st.fx.push({ k: 'hit', x: tg.x, y: tg.y - 40 * tg.scale, t: 0, d: 0.3, col: col || '#fff' });
    if (tg.hp <= 0) {
      tg.hp = 0; tg.dead = true; tg.deadT = 0;
      if (tg.side === 0) { st.deaths++; BK.snd('err', 0.4); } else { BK.snd('pluck', 0.4); st.fx.push({ k: 'pop', x: tg.x, y: tg.y - 30 * tg.scale, t: 0, d: 0.5, col: tg.e.col }); if (tg.boss) { st.shake = 14; BK.snd('boom', 0.6); } }
    }
  }
  function heal(u, amt) { if (u.dead) return; const a = Math.round(Math.min(u.max - u.hp, amt)); u.hp += a; if (a > 0) num(u, a, '#7aff8a', '+'); st.fx.push({ k: 'heal', x: u.x, y: u.y - 30, t: 0, d: 0.7 }); }
  function num(u, n, col, tag) { st.nums.push({ x: u.x + (Math.random() - 0.5) * 30, y: u.y - 90 * u.scale - 10, n, col, tag, t: 0 }); }
  function bossSkill(u) {
    u.anim = 'atk'; u.at = 0; u.act = 0.8; st.shake = 8; BK.snd('boom', 0.5);
    banner(`${u.e.name}의 공격!`, '#ff8a8a', 0.9);
    for (const h of alive(0)) later(350, () => hit(u, h, atkOf(u) * 0.85, u.e.col));
    st.fx.push({ k: 'wave', x: u.x, y: u.y - 20, t: 0, d: 0.7, col: u.e.col, dir: -1 });
  }

  // ---------- 스킬 ----------
  function cast(u) {
    if (u.dead || u.sk < u.skMax || st.phase !== 'fight') return;
    u.sk = 0; const S = u.h.sk, P = S.p * u.skMul, foes = alive(1), pals = alive(0); if (!foes.length) return;
    u.anim = 'skill'; u.at = 0; u.act = 0.8;
    st.cut = { u, t: 0 }; st.slow = 0.45; BK.snd('skill', 0.6); BK.snd('v_combo', 0.25, 1.2);
    const A = atkOf(u), tg = nearest(u) || foes[0];
    const delay = f => later(450, f);
    st.fx.push({ k: 'aura', x: u.x, y: u.y, t: 0, d: 0.9, col: D.RARITY[u.h.rar].col });
    switch (S.k) {
      case 'dmg': delay(() => { hit(u, tg, A * P, '#ffd84a', { crit: S.crit && Math.random() < 0.5 }); st.fx.push({ k: 'star', x: tg.x, y: tg.y - 40, t: 0, d: 0.5 }); }); break;
      case 'aoe': delay(() => { const tgts = S.line ? foes : foes.filter(f => Math.abs(f.x - tg.x) < 230); tgts.forEach(f => hit(u, f, A * P, '#9adfff', { knock: S.knock, silent: 1 })); st.fx.push({ k: 'wave', x: u.x + 30, y: u.y - 20, t: 0, d: 0.7, col: '#7acfff', dir: 1 }); BK.snd('boom', 0.4); st.shake = 6; }); break;
      case 'heal': delay(() => { const L = S.all ? pals : [pals.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]]; L.forEach(p => { heal(p, p.max * P); if (S.buff) p.buf.push({ k: 'atk', v: S.buff, t: 6 }); }); BK.snd('heal', 0.5); }); break;
      case 'buff': delay(() => { pals.forEach(p => { p.buf.push({ k: 'atk', v: P, t: S.dur }); st.fx.push({ k: 'up', x: p.x, y: p.y - 60, t: 0, d: 1 }); }); BK.snd('up', 0.5); }); break;
      case 'shield': delay(() => { const L = S.self ? [u] : S.all ? pals : [pals.slice().sort((a, b) => a.hp / a.max - b.hp / b.max)[0]]; L.forEach(p => { p.shield += p.max * P; p.buf.push({ k: 'sh', v: 0, t: 8 }); if (S.heal) heal(p, p.max * S.heal); }); BK.snd('glass', 0.5); }); break;
      case 'taunt': delay(() => { u.buf.push({ k: 'taunt', v: 0, t: S.dur }); u.shield += u.max * P; u.buf.push({ k: 'sh', v: 0, t: S.dur }); BK.snd('glass', 0.5); }); break;
      case 'slow': delay(() => { foes.forEach(f => { hit(u, f, A * P, '#cfefff', { silent: 1 }); f.buf.push({ k: 'slow', v: 0, t: S.dur }); }); st.fx.push({ k: 'snow', x: VW * 0.7, y: GY - 120, t: 0, d: 1.2 }); BK.snd('glass', 0.4, 0.7); }); break;
      case 'multi': for (let i = 0; i < S.hits; i++) later(300 + i * 160, () => { const L = alive(1); if (!L.length) return; const f = L[Math.floor(Math.random() * L.length)]; st.proj.push({ x: u.x + 20, y: u.y - 60, tg: f, dmg: A * P, from: u, col: '#ffcf6a', t: 0 }); }); break;
      case 'snipe': delay(() => { const f = foes.slice().sort((a, b) => b.x - a.x)[0]; hit(u, f, A * P, '#ff9a5a', { crit: true }); st.fx.push({ k: 'line', x: u.x, y: u.y - 50, x2: f.x, y2: f.y - 40, t: 0, d: 0.35 }); BK.snd('laser', 0.5, 0.7); }); break;
      case 'cleanse': delay(() => { pals.forEach(p => { p.buf = p.buf.filter(b => b.k !== 'slow'); heal(p, p.max * P); }); BK.snd('heal', 0.5, 1.2); }); break;
      case 'drain': delay(() => { const before = tg.hp; hit(u, tg, A * P, '#ff6aa0'); heal(u, Math.max(0, before - tg.hp)); }); break;
      case 'transform': delay(() => { u.transMul = P; u.buf.push({ k: 'trans', v: 0, t: S.dur }); BK.snd('up', 0.5, 0.8); st.fx.push({ k: 'pop', x: u.x, y: u.y - 40, t: 0, d: 0.6, col: '#ffb0ff' }); }); break;
    }
  }
  B.cast = i => { const u = st && st.heroes[i]; if (u) cast(u); };

  // ---------- 끝 ----------
  function end(win) {
    if (st.phase === 'end') return; st.phase = 'end';
    const stars = win ? (st.deaths === 0 ? (st.time > 60 ? 3 : 2) : st.deaths <= 2 ? 2 : 1) : 0;
    for (const u of alive(0)) { u.anim = win ? 'win' : 'hurt'; u.act = 99; }
    BK.snd(win ? (stars === 3 ? 'v_flawless' : 'v_win') : 'v_lose', 0.8); BK.music(null);
    setTimeout(() => { if (B.onEnd) B.onEnd({ win, stars, stage: st.stage }); }, 1600);
  }

  // ---------- 그리기 ----------
  function cover(im, y, h, off, alpha) {
    if (!im.complete || !im.naturalWidth) return; const w = im.naturalWidth * h / im.naturalHeight; let x = -((off % w) + w) % w;
    if (alpha != null) g.globalAlpha = alpha; for (; x < VW; x += w) g.drawImage(im, x, y, w + 1, h); g.globalAlpha = 1;
  }
  function draw(dt) {
    const sh = st.shake ? (Math.random() - 0.5) * st.shake : 0;
    const C = st.C, s = st.scroll;
    if (OY > 0) { g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = skyCol(C); g.fillRect(0, 0, W, H); g.fillStyle = BK.shade(groundCol(C.ground), -0.15); g.fillRect(0, (OY + GY + 60) * SC, W, H); }
    g.setTransform(DPR * SC, 0, 0, DPR * SC, sh * DPR, (sh * 0.6 + OY * SC) * DPR);
    cover(BK.bgImg(C.bg), 0, VH, s * 0.1);
    for (const c of st.clouds) { c.x -= c.v * dt; const xx = ((c.x - s * 0.15) % (VW + 300) + VW + 300) % (VW + 300) - 150; BK.draw(g, 'bgel', c.n, xx, c.y, c.s, 0.85); }
    cover(BK.bgImg(C.far), GY - 230, 200, s * 0.3, 0.9);
    // 뒤쪽 장식
    for (const d of st.deco) if (d.back) { const e = BK.atlas.bgel[d.n]; if (!e) continue; const xx = d.x - s * 0.6; const w = 40 * 170; const X = ((xx % w) + w) % w - 100; if (X > VW + 50) continue; BK.draw(g, 'bgel', d.n, X, GY - 40 - e[3] * d.s * 0.9, d.s * 0.9, 0.9); }
    // 땅
    const T = 'b_tile' + C.ground, te = BK.atlas.bgel[T]; if (te) { const tw = 64; let x = -((s % tw) + tw) % tw; for (; x < VW; x += tw) { BK.draw(g, 'bgel', T, x, GY - 20, 1); g.fillStyle = BK.shade(groundCol(C.ground), -0.15); g.fillRect(x, GY + 80, tw, VH - GY + 400); } }
    // 유닛 (y 순서)
    const L = st.units.slice().sort((a, b) => a.y - b.y);
    for (const u of L) drawUnit(u);
    // 앞쪽 장식
    for (const d of st.deco) if (!d.back && /bush/.test(d.n)) { const e = BK.atlas.bgel[d.n]; if (!e) continue; const xx = d.x - s; const w = 40 * 170; const X = ((xx % w) + w) % w - 100; if (X > VW + 50) continue; BK.draw(g, 'bgel', d.n, X, VH - e[3] * 0.6 + 8, 0.6, 0.95); }
    // 투사체
    for (const p of st.proj) { g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 12; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.shadowBlur = 0; g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - 2, p.y - 2, 2.5, 0, 7); g.fill(); }
    for (const f of st.fx) drawFx(f);
    // 숫자
    g.textAlign = 'center';
    for (const n of st.nums) { const a = 1 - n.t; g.globalAlpha = Math.min(1, a * 2); g.font = `900 ${n.tag === '치명!' ? 26 : 20}px sans-serif`; g.lineWidth = 5; g.strokeStyle = '#2a1a10'; const y = n.y - n.t * 40; const txt = (n.tag === '+' ? '+' : '') + n.n; g.strokeText(txt, n.x, y); g.fillStyle = n.col; g.fillText(txt, n.x, y); if (n.tag && n.tag !== '+') { g.font = '900 13px sans-serif'; g.strokeText(n.tag, n.x, y - 20); g.fillText(n.tag, n.x, y - 20); } g.globalAlpha = 1; }
    // 스킬 컷인
    if (st.cut) drawCut(st.cut);
    if (st.slow > 0) { g.fillStyle = `rgba(20,10,40,${Math.min(0.25, st.slow)})`; g.fillRect(0, 0, VW, VH); }
  }
  const skyCol = C => '#cfeefd';
  const groundCol = n => ({ Grass: '#8a5a3a', Sand: '#d8b070', Dirt: '#8a5a3a', Stone: '#7a7a8a' })[n] || '#8a5a3a';
  function drawUnit(u) {
    const alpha = u.dead ? Math.max(0, 1 - u.deadT * 1.5) : 1; if (alpha <= 0) return;
    if (u.side === 0) {
      const tr = has(u, 'trans'), sc = u.scale * (tr ? 1.25 : 1);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(u.x, u.y + 2, 40 * sc, 10 * sc, 0, 0, 7); g.fill();
      if (has(u, 'taunt')) { g.strokeStyle = 'rgba(255,90,90,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(u.x, u.y, 52, 14, 0, 0, 7); g.stroke(); }
      if (tr) { g.save(); g.globalAlpha = 0.35 * alpha; g.fillStyle = '#ffb0ff'; g.beginPath(); g.arc(u.x, u.y - 60 * sc, 70 * sc, 0, 7); g.fill(); g.restore(); }
      const y = u.dead ? u.y + u.deadT * 20 : u.y;
      if (u.flash > 0.5) g.filter = 'brightness(1.8)';
      BK.drawHero(g, u.id, u.dead ? 'hurt' : u.anim, u.at, u.x, y, sc, false, alpha);
      g.filter = 'none';
      if (u.shield > 0) { g.strokeStyle = 'rgba(140,220,255,.8)'; g.lineWidth = 3; g.fillStyle = 'rgba(140,220,255,.15)'; g.beginPath(); g.arc(u.x, u.y - 55 * sc, 62 * sc, 0, 7); g.fill(); g.stroke(); }
      if (!u.dead) hpBar(u.x, u.y - 128 * sc, u.hp / u.max, '#5ae070', u.shield / u.max);
    } else {
      const sz = u.scale; const y = u.y;
      BK.drawEnemy(g, u.e, u.x, y, sz, u.at / 10 + u.x * 0.01, { hurt: u.flash > 0.5, atk: u.anim === 'atk' && u.act > 0 ? 1 - u.act / (u.boss ? 0.8 : 0.45) : 0, alpha });
      if (has(u, 'slow')) { g.fillStyle = 'rgba(180,230,255,.35)'; g.beginPath(); g.arc(u.x, y - 34 * sz, 40 * sz, 0, 7); g.fill(); }
      if (!u.dead) hpBar(u.x, y - (u.e.fly ? 110 : 82) * sz - 6, u.hp / u.max, u.boss ? '#ff4a5a' : '#ff8a5a', 0, u.boss ? 120 : 56);
    }
  }
  function hpBar(x, y, k, col, sh, w) { w = w || 62; g.fillStyle = 'rgba(30,20,10,.7)'; g.fillRect(x - w / 2 - 2, y - 2, w + 4, 10); g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, k), 6); if (sh > 0) { g.fillStyle = '#bfefff'; g.fillRect(x - w / 2, y + 6, w * Math.min(1, sh), 2); } }
  function drawFx(f) {
    const k = f.t / f.d;
    g.save(); g.globalAlpha = Math.max(0, 1 - k);
    switch (f.k) {
      case 'hit': g.strokeStyle = f.col; g.lineWidth = 4; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28 + f.x; g.beginPath(); g.moveTo(f.x + Math.cos(a) * 8, f.y + Math.sin(a) * 8); g.lineTo(f.x + Math.cos(a) * (14 + k * 22), f.y + Math.sin(a) * (14 + k * 22)); g.stroke(); } break;
      case 'pop': BK.burst(g, f.x, f.y, 60, f.col, k); break;
      case 'heal': g.fillStyle = '#7aff8a'; for (let i = 0; i < 5; i++) { const xx = f.x + Math.sin(i * 2.3) * 26, yy = f.y - k * 50 - i * 8; g.fillRect(xx - 2, yy - 7, 4, 14); g.fillRect(xx - 7, yy - 2, 14, 4); } break;
      case 'aura': g.strokeStyle = f.col; g.lineWidth = 6; g.beginPath(); g.ellipse(f.x, f.y, 30 + k * 80, 8 + k * 20, 0, 0, 7); g.stroke(); break;
      case 'wave': { g.fillStyle = f.col; g.globalAlpha *= 0.5; const x = f.x + f.dir * k * 500; g.beginPath(); g.ellipse(x, f.y - 30, 40, 70, 0, 0, 7); g.fill(); break; }
      case 'up': g.fillStyle = '#ffd84a'; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.fillText('▲', f.x, f.y - k * 30); break;
      case 'star': BK.burst(g, f.x, f.y, 70, '#ffd84a', k); break;
      case 'line': g.strokeStyle = '#ffcf6a'; g.lineWidth = 5 * (1 - k) + 1; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke(); break;
      case 'snow': g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const xx = f.x + Math.sin(i * 7.1) * 260, yy = f.y + ((i * 37 + k * 300) % 260) - 100; g.beginPath(); g.arc(xx, yy, 3, 0, 7); g.fill(); } break;
    }
    g.restore();
  }
  function drawCut(c) {
    const k = c.t, u = c.u, im = faceImg(u.id), R = D.RARITY[u.h.rar];
    const inK = Math.min(1, k * 5), outK = k > 0.85 ? (k - 0.85) / 0.25 : 0, x = -VW * (1 - inK) + VW * outK;
    g.save(); g.translate(x, 0);
    g.fillStyle = 'rgba(10,5,30,.55)'; g.beginPath(); g.moveTo(0, 150); g.lineTo(VW, 110); g.lineTo(VW, 250); g.lineTo(0, 290); g.fill();
    g.fillStyle = R.col; g.fillRect(0, 286, VW, 5);
    if (im.complete) g.drawImage(im, VW * 0.12, 95, 190, 190);
    g.fillStyle = '#fff'; g.font = '900 38px sans-serif'; g.textAlign = 'left'; g.strokeStyle = '#2a1050'; g.lineWidth = 7;
    g.strokeText(u.h.skill, VW * 0.12 + 210, 200); g.fillText(u.h.skill, VW * 0.12 + 210, 200);
    g.font = '800 18px sans-serif'; g.fillStyle = R.col; g.strokeText(u.h.name, VW * 0.12 + 212, 232); g.fillText(u.h.name, VW * 0.12 + 212, 232);
    g.restore();
  }
  const FI = {}; const faceImg = id => { if (!FI[id]) { FI[id] = new Image(); FI[id].src = BK.face(id); } return FI[id]; };

  // ---------- 화면 위 버튼 ----------
  function banner(txt, col, dur) { const b = document.createElement('div'); b.className = 'bt-banner'; b.textContent = txt; b.style.color = col || '#fff'; root.appendChild(b); setTimeout(() => b.remove(), (dur || 1.4) * 1000); }
  function buildHud() {
    root.style.display = 'block';
    root.innerHTML = `<div class="bt-top"><button class="bt-btn" id="btPause">${BK.ic('pause', 0.45)}</button><div class="bt-stage"><b>${st.stage.name}</b> ${st.C.name}<div class="bt-waves"><i></i><i></i><i></i></div></div><div class="bt-time" id="btTime">2:30</div></div>
    <div class="bt-side"><button class="bt-btn tog" id="btAuto">AUTO</button><button class="bt-btn tog" id="btSpd">×1</button></div>
    <div class="bt-cards">${st.heroes.map((u, i) => `<div class="bt-card r-${u.h.rar}" data-i="${i}"><div class="bt-face" style="background-image:url(${BK.face(u.id)})"></div><div class="bt-ring"></div><div class="bt-ready">스킬!</div><div class="bt-hp"><i></i></div><div class="bt-nm">${u.h.skill}</div></div>`).join('')}</div>`;
    root.querySelectorAll('.bt-card').forEach(el => el.addEventListener('pointerdown', e => { e.preventDefault(); BK.unlock(); B.cast(+el.dataset.i); }));
    root.querySelector('#btAuto').onclick = () => { st.auto = !st.auto; BK.S.opt.auto = st.auto; BK.snd('tap'); };
    root.querySelector('#btSpd').onclick = () => { st.speed = st.speed > 1 ? 1 : 2; BK.S.opt.x2 = st.speed > 1; BK.snd('tap'); };
    root.querySelector('#btPause').onclick = () => { st.paused = true; BK.snd('open'); B.onPause && B.onPause(); };
    B.hudEls = { cards: [...root.querySelectorAll('.bt-card')], time: root.querySelector('#btTime'), auto: root.querySelector('#btAuto'), spd: root.querySelector('#btSpd'), waves: [...root.querySelectorAll('.bt-waves i')] };
  }
  B.resume = () => { if (st) { st.paused = false; last = performance.now(); } };
  B.quit = () => { if (st) { st.phase = 'end'; B.stop(); } };
  function hud() {
    const E = B.hudEls; if (!E) return;
    E.time.textContent = `${Math.floor(Math.max(0, st.time) / 60)}:${String(Math.floor(Math.max(0, st.time) % 60)).padStart(2, '0')}`;
    E.auto.classList.toggle('on', st.auto); E.spd.classList.toggle('on', st.speed > 1); E.spd.textContent = '×' + st.speed;
    E.waves.forEach((w, i) => w.className = i < st.wave ? 'done' : i === st.wave ? 'cur' : '');
    st.heroes.forEach((u, i) => { const el = E.cards[i], k = u.sk / u.skMax, rdy = k >= 1 && !u.dead;
      el.classList.toggle('dead', u.dead); el.classList.toggle('rdy', rdy);
      el.style.setProperty('--k', u.dead ? 0 : k); el.querySelector('.bt-hp i').style.width = (u.hp / u.max * 100) + '%'; });
  }
  B.state = () => st;
  B._step = dt => step(dt);
})();

// 생물의 번제 — 게임 본체: 플레이어 · 탄도 · 병원체 AI · 보스 패턴 · 아이템 효과 · 방 진행 · 그리기
(function () {
  'use strict';
  const CR = window.CR, AU = CR.audio, IN = CR.input;
  const W = 384, H = 216, RX = 40, RY = 32, T = CR.T, COLS = CR.COLS, ROWS = CR.ROWS, RW = CR.RW, RH = CR.RH;
  CR.W = W; CR.H = H; CR.RX = RX; CR.RY = RY;
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false;
  const TAU = Math.PI * 2, rand = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const pickW = (arr) => { let s = 0; arr.forEach(x => s += x[1]); let r = Math.random() * s; for (const x of arr) { r -= x[1]; if (r <= 0) return x[0]; } return arr[0][0]; };

  const G = CR.G = { mode: 'title', stage: 1, floor: null, room: null, P: null, pb: [], eb: [], lasers: [], creeps: [], bombs: [], fx: [], fams: [], time: 0, shake: 0, sandbox: false, god: false, kills: 0, cleared: 0, killedTypes: new Set(), seen: new Set(), intro: null, tick: 0, slowAll: 0, msgQ: [] };

  /* ───────── 충돌 ───────── */
  function doorAt(tx, ty) { for (const d in CR.DOOR_TILE) { const [x, y] = CR.DOOR_TILE[d]; if (x === tx && y === ty) return d; } return null; }
  function doorOpen(room, d) { const dr = room.doors[d]; return !!dr && !dr.hidden && !dr.locked && room.cleared; }
  function solid(tx, ty, mode) {
    const v = CR.tileAt(G.room, tx, ty);
    if (v === 1) { if ((mode === 'player' || mode === 'pfly') && tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) { const d = doorAt(tx, ty); if (d && doorOpen(G.room, d)) return false; } return true; }
    if (v === 2 || v === 3 || v === 5 || v === 6 || v === 8 || v === 9) return !(mode === 'fly' || mode === 'ghost' || mode === 'spectral' || mode === 'pfly');
    return false;
  }
  function blocked(x, y, r, mode) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r - 0.01) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty, mode)) return true;
    return false;
  }
  function moveEnt(e, dx, dy, mode) {
    let hit = 0;
    if (mode === 'ghost') { e.x = clamp(e.x + dx, T + e.r, RW - T - e.r); e.y = clamp(e.y + dy, T + e.r, RH - T - e.r); return 0; }
    if (!blocked(e.x + dx, e.y, e.r, mode)) e.x += dx; else hit |= 1;
    if (!blocked(e.x, e.y + dy, e.r, mode)) e.y += dy; else hit |= 2;
    return hit;
  }
  function freeSpot(minFromPlayer, tries) {
    for (let i = 0; i < (tries || 80); i++) {
      const tx = ri(2, COLS - 3), ty = ri(2, ROWS - 3);
      if (CR.tileAt(G.room, tx, ty) !== 0 && CR.tileAt(G.room, tx, ty) !== 7) continue;
      const p = { x: tx * T + 8, y: ty * T + 8 };
      if (G.P && dist(p, G.P) < (minFromPlayer || 0)) continue;
      return p;
    }
    return { x: RW / 2, y: RH / 2 };
  }
  CR.freeSpot = freeSpot;

  /* ───────── 플레이어 ───────── */
  const BASE = { dmg: 3.5, rate: 2.6, range: 190, sspd: 1, speed: 1, crit: 3, size: 1 };
  function newPlayer() {
    return { x: RW / 2, y: RH / 2, vx: 0, vy: 0, r: 4.5, dir: 'down', aimA: Math.PI / 2, hp: 6, maxHp: 6, shield: 0, coins: 0, bombs: 1, keys: 1, items: [], flags: {}, active: null, tools: [], cons: [],
      bonus: { dmg: 0, rate: 0, range: 0, sspd: 0, speed: 0 }, room: {}, invuln: 0, fireCd: 0, shootT: 0, walkT: 0, peak: null, rage: 0, deadEye: 0, vampN: 0, helperN: 0, revive: 0, st: Object.assign({}, BASE), echoQ: [], doubleQ: [], costumes: [] };
  }
  const has = f => !!(G.P && (G.P.flags[f] || (G.P.room.flag === f)));
  CR.has = has;
  const toolFx = k => { let s = 0; for (const id of G.P.tools) { const t = CR.ALL[id]; if (t && t.fx[k]) s += t.fx[k]; } return s; };
  CR.toolFx = toolFx;
  function calcStats() {
    const P = G.P, s = Object.assign({}, BASE); let dmgMul = 1, rateMul = 1, sizeMul = 1;
    for (const id of P.items) { const it = CR.ALL[id]; if (!it || !it.stats) continue; const st = it.stats;
      s.dmg += st.dmg || 0; s.rate += st.rate || 0; s.range += st.range || 0; s.sspd += st.sspd || 0; s.speed += st.speed || 0; s.crit += st.crit || 0;
      if (st.dmgMul) dmgMul *= st.dmgMul; if (st.rateMul) rateMul *= st.rateMul; if (st.size) sizeMul *= st.size; }
    s.dmg += P.bonus.dmg + toolFx('dmg') + (P.room.dmg || 0) + P.rage * 2; s.rate += P.bonus.rate + toolFx('rate') + (P.room.rate || 0);
    s.range += P.bonus.range + toolFx('range'); s.sspd += P.bonus.sspd + toolFx('sspd'); s.speed += P.bonus.speed + (P.room.speed || 0); s.crit += toolFx('crit');
    sizeMul *= 1 + toolFx('size');
    if (has('lowHp') && P.hp <= 2) { dmgMul *= 1.5; rateMul *= 1.5; }
    if (has('fullHp') && P.hp >= P.maxHp) { s.dmg += 2; sizeMul *= 2; }
    if (P.room.dmgMul) dmgMul *= P.room.dmgMul; if (P.room.rateMul) rateMul *= P.room.rateMul;
    if (has('giant')) sizeMul *= 1.15;
    s.dmg = Math.max(0.5, s.dmg * dmgMul); s.rate = clamp(s.rate * rateMul, 0.7, 14); s.range = Math.max(70, s.range); s.speed = clamp(s.speed, 0.5, 2.2); s.sspd = clamp(s.sspd, 0.6, 2.6); s.crit = clamp(s.crit, 0, 90); s.size = clamp(sizeMul, 0.5, 3.2);
    if (has('statLock')) { if (!P.peak) P.peak = Object.assign({}, s); for (const k in s) { s[k] = Math.max(s[k], P.peak[k]); P.peak[k] = s[k]; } }
    P.st = s; P.r = has('giant') ? 6 : has('tiny') ? 2.8 : 4;
  }
  CR.calcStats = calcStats;
  const flagList = () => Object.keys(G.P.flags).concat(G.P.room.flag ? [G.P.room.flag] : []);

  /* ───────── 아이템 풀·지급 ───────── */
  function resetPools() { G.pool = { passive: CR.PASSIVES.map(p => p.id), active: CR.ACTIVES.map(a => a.id), tool: CR.TOOLS.map(t => t.id) }; }
  function takeFrom(listName, filter) {
    const L = G.pool[listName].filter(id => !filter || filter(CR.ALL[id]));
    if (!L.length) return null; const id = L[Math.floor(Math.random() * L.length)];
    G.pool[listName] = G.pool[listName].filter(x => x !== id); return id;
  }
  function rollItem(kind) {   // kind: treasure · boss · lab · shop · secret · sanct · bonus
    if ((kind === 'treasure' || kind === 'shop') && Math.random() < 0.22) { const a = takeFrom('active'); if (a) return a; }
    if (kind === 'treasure' && Math.random() < 0.08) { const t = takeFrom('tool'); if (t) return t; }
    const tierOk = { treasure: t => t.tier <= 3 || Math.random() < 0.03, boss: t => t.tier >= 2 && t.tier <= 3, lab: t => t.tier >= 3, shop: t => t.tier <= 3, secret: t => t.tier <= 2, sanct: t => t.tier >= 3, bonus: t => t.tier >= 3 }[kind] || (() => true);
    return takeFrom('passive', tierOk) || takeFrom('passive') || takeFrom('active') || 'P11';
  }
  CR.rollItem = rollItem;
  function toast(name, desc, col) { G.msgQ.push({ name, desc, col: col || '#ffe066' }); if (CR.ui) CR.ui.toast(name, desc, col); }
  CR.toast = toast;
  function applyItem(id, opts) {
    const it = CR.ALL[id], P = G.P; if (!it || !P) return;
    opts = opts || {};
    G.seen.add(id); if (CR.ui) CR.ui.markSeen(id);
    if (it.kind === 'passive') {
      P.items.push(id); P.flags = P.flags || {};
      it.flags.forEach(f => (P.flags[f] = (P.flags[f] || 0) + 1));
      const s = it.stats;
      if (s.maxhp) { P.maxHp = Math.min(24, P.maxHp + s.maxhp * 2); }
      if (s.heal) P.hp = Math.min(P.maxHp, P.hp + s.heal);
      if (s.shield) P.shield = Math.min(24 - P.maxHp, P.shield + s.shield);
      if (s.bombs) P.bombs = Math.min(99, P.bombs + s.bombs); if (s.keys) P.keys += s.keys; if (s.coins) P.coins += s.coins;
      if (it.costume && !P.costumes.includes(it.costume)) P.costumes.push(it.costume);
      if (it.flags.some(f => f.startsWith('fam') || f === 'laserRing')) spawnFamiliars();
      calcStats(); if (has('mapReveal')) revealMap();
      if (!opts.quiet) { toast(it.name, it.desc, it.tier === 4 ? '#ffd75e' : '#ffffff'); AU.sfx('item'); burstFx(P.x, P.y, it.col, 18); }
    } else if (it.kind === 'active') {
      if (P.active && !opts.noSwap) dropPedestal(P.active.id, P.x, P.y + 14);
      P.active = { id, charge: it.charge, max: it.charge };
      if (!opts.quiet) { toast(it.name, it.desc + '  (Space)', '#7fd4ff'); AU.sfx('item'); }
    } else if (it.kind === 'tool') {
      const max = has('tools2') ? 2 : 1;
      while (P.tools.length >= max) { const old = P.tools.shift(); dropPickup('tool', P.x + rand(-10, 10), P.y + 12, old).lock = true; }
      P.tools.push(id); calcStats();
      if (!opts.quiet) { toast(it.name, it.desc, '#cfe0f0'); AU.sfx('item'); }
    } else if (it.kind === 'chart' || it.kind === 'hormone') {
      const max = has('slots2') ? 2 : 1;
      while (P.cons.length >= max) { const old = P.cons.shift(); dropPickup(CR.ALL[old].kind, P.x + rand(-10, 10), P.y + 12, old).lock = true; }
      P.cons.push(id); if (!opts.quiet) { toast(it.name, it.desc + '  (Q)', it.col); AU.sfx('key'); }
    }
  }
  CR.applyItem = applyItem;
  function dropPedestal(id, x, y, extra) { const p = Object.assign({ x: clamp(x, 28, RW - 28), y: clamp(y, 28, RH - 28), id, taken: false, bob: Math.random() * 6 }, extra || {}); G.room.items.push(p); return p; }
  CR.dropPedestal = dropPedestal;
  function dropPickup(kind, x, y, id) { const p = { kind, x: clamp(x, 22, RW - 22), y: clamp(y, 22, RH - 22), id, vx: rand(-40, 40), vy: rand(-40, 40), t: 0 }; G.room.pickups.push(p); return p; }
  CR.dropPickup = dropPickup;

  /* ───────── 층·방 진행 ───────── */
  function startRun(opts) {
    opts = opts || {};
    G.P = newPlayer(); G.time = 0; G.kills = 0; G.cleared = 0; G.killedTypes = new Set(); G.sandbox = !!opts.sandbox; G.god = false; G.over = null; G.bonusNext = false;
    resetPools(); calcStats(); startStage(opts.stage || 1); G.mode = 'play';
    if (CR.ui) CR.ui.onStart();
  }
  CR.startRun = startRun;
  function startStage(n) {
    G.stage = n; G.floor = CR.genFloor(n, CR.rng((Date.now() ^ (n * 7919)) >>> 0));
    G.pb = []; G.eb = []; G.lasers = []; G.creeps = []; G.bombs = []; G.fx = []; G.hatch = null; G.trophy = null;
    if (n > 1 && toolFx('stageShield')) G.P.shield = Math.min(24 - G.P.maxHp, G.P.shield + 1);
    enterRoom(G.floor.start, null);
    if (G.bonusNext) { G.bonusNext = false; dropPedestal(rollItem('bonus'), RW / 2, RH / 2 - 26); toast('시간 단축 보상', '빠르게 돌파한 보상으로 특별한 아이템이 나왔어요', '#9effe0'); }
    if (has('mapReveal')) revealMap();
    AU.play(CR.STAGES[n - 1].music);
    if (CR.ui) CR.ui.banner('구역 ' + n, CR.STAGES[n - 1].name);
  }
  CR.startStage = startStage;
  function revealMap() { for (const r of G.floor.rooms.values()) { r.seen = true; if (r.type === 'secret' && (has('mapReveal') || toolFx('showSecret'))) r.revealed = true; } }
  function enterRoom(key, fromDir) {
    const room = G.floor.rooms.get(key); if (!room) return;
    G.room = room; const P = G.P;
    G.pb = []; G.eb = []; G.lasers = []; G.creeps = G.creeps.filter(c => c.persist && c.roomKey === key); G.bombs = [];
    P.room = {}; P.rage = 0; P.deadEye = 0; P.guardUsed = false;
    if (has('randomFlag')) { const pool = ['homing', 'pierce', 'bounce', 'poison', 'slow', 'splitHit', 'burstMid', 'chain', 'gravity', 'triple']; P.room.flag = pool[ri(0, pool.length - 1)]; }
    if (fromDir) { const od = CR.OPP[fromDir], [tx, ty] = CR.DOOR_TILE[od]; P.x = tx * T + 8 + (od === 'l' ? 22 : od === 'r' ? -22 : 0); P.y = ty * T + 8 + (od === 'u' ? 22 : od === 'd' ? -22 : 0); }
    else { P.x = RW / 2; P.y = RH / 2 + 24; }
    P.vx = P.vy = 0;
    room.seen = true;
    for (const d in room.doors) { const o = G.floor.rooms.get(room.doors[d].to); if (o && !room.doors[d].hidden) o.seen = true; }
    if (!room.visited) { room.visited = true; populate(room); }
    room.ents = room.ents || [];
    if (!room.ents.filter(e => !e.ally).length) room.cleared = true;
    if (room.ents.length && has('roomSlow')) room.ents.forEach(e => (e.slowT = Math.max(e.slowT || 0, 3)));
    spawnFamiliars();
    calcStats();
    if (room.type === 'boss' && !room.cleared) {
      const bs = room.ents.filter(e => e.boss); if (bs.length) { G.intro = { t: 1.9, def: bs[0].def }; AU.sfx('boss'); AU.play(Object.assign({}, CR.STAGES[G.stage - 1].music, { bpm: CR.STAGES[G.stage - 1].music.bpm + 24, intense: 1, seed: 99 + G.stage })); if (CR.ui) CR.ui.bossIntro(bs[0].def); }
    } else if (room.type !== 'boss') AU.play(CR.STAGES[G.stage - 1].music);
  }
  CR.enterRoom = enterRoom;
  function populate(room) {
    room.ents = [];
    const cx = RW / 2, cy = RH / 2;
    if (room.type === 'normal') {
      const pool = CR.ENEMIES.filter(e => e.st === G.stage).map(e => [e, 3]).concat(CR.ENEMIES.filter(e => e.st === G.stage - 1).map(e => [e, 1]));
      let n = ri(3, 5) + (G.stage >= 4 ? 1 : 0);
      while (n > 0) { const def = pickW(pool), g = def.group || 1; for (let i = 0; i < g; i++) { const p = freeSpot(70); room.ents.push(mkEnemy(def, p.x, p.y)); } n -= g; }
      const pair = room.ents.filter(e => e.def.tether); for (let i = 0; i + 1 < pair.length; i += 2) { pair[i].mate = pair[i + 1]; pair[i + 1].mate = pair[i]; }
    } else if (room.type === 'boss') {
      const pool = CR.BOSSES.filter(b => b.st === G.stage), def = G.forceBoss ? CR.ALL[G.forceBoss] : pool[ri(0, pool.length - 1)]; G.forceBoss = null;
      spawnBoss(def, room);
    } else if (room.type === 'treasure') dropPedestalIn(room, rollItem('treasure'), cx, cy);
    else if (room.type === 'shop') {
      const disc = has('discount') ? 0.5 : 1, pr = v => Math.max(1, Math.round(v * disc));
      dropPedestalIn(room, rollItem('shop'), cx - 54, cy, { price: pr(15) });
      dropPedestalIn(room, null, cx - 18, cy, { pk: 'heart', price: pr(3) });
      dropPedestalIn(room, null, cx + 18, cy, { pk: Math.random() < 0.5 ? 'bomb' : 'key', price: pr(5) });
      const cons = Math.random() < 0.5 ? CR.CHARTS : CR.HORMONES.filter(h => h.good); dropPedestalIn(room, cons[ri(0, cons.length - 1)].id, cx + 54, cy, { price: pr(6), small: 1 });
    } else if (room.type === 'secret') {
      for (let i = 0; i < ri(3, 5); i++) room.pickups.push({ kind: 'coin', x: cx + rand(-30, 30), y: cy + rand(-20, 20), vx: 0, vy: 0, t: 0 });
      room.pickups.push({ kind: 'bomb', x: cx, y: cy + 24, vx: 0, vy: 0, t: 0 });
      if (Math.random() < 0.4) dropPedestalIn(room, rollItem('secret'), cx, cy - 22);
    } else if (room.type === 'lab') {
      dropPedestalIn(room, rollItem('lab'), cx - 36, cy, { hpCost: 2, group: 'lab' });
      dropPedestalIn(room, rollItem('lab'), cx + 36, cy, { price: 20, group: 'lab' });
    } else if (room.type === 'sanct') {
      dropPedestalIn(room, rollItem('sanct'), cx, cy - 8);
      room.pickups.push({ kind: 'shield', x: cx - 28, y: cy + 26, vx: 0, vy: 0, t: 0 }, { kind: 'shield', x: cx + 28, y: cy + 26, vx: 0, vy: 0, t: 0 });
    }
  }
  function dropPedestalIn(room, id, x, y, extra) { room.items.push(Object.assign({ x, y, id, taken: false, bob: Math.random() * 6 }, extra || {})); }
  function onClear() {
    const room = G.room, P = G.P; room.cleared = true; G.cleared++;
    AU.sfx('door');
    if (P.active && P.active.charge < P.active.max) { P.active.charge = Math.min(P.active.max, P.active.charge + 1 + (Math.random() < toolFx('extraCharge') ? 1 : 0)); }
    if (has('regen')) heal(1);
    if (Math.random() < toolFx('clearHeal')) heal(1);
    if (has('famHelper')) { P.helperN = (P.helperN || 0) + 1; if (P.helperN % 3 === 0) spawnReward(true); }
    if (room.type === 'normal') spawnReward(false);
    if (room.type === 'boss') onBossDefeated();
  }
  function spawnReward(force) {
    const P = G.P; if (!force && Math.random() > (has('dropUp') ? 0.78 : 0.58)) return;
    const k = pickW([['coin', 34], ['heart', P.hp < P.maxHp ? 22 : 6], ['bomb', 15], ['key', 14], ['shield', 5], ['hormone', 4], ['chart', 3], ['chest', 3]]);
    const p = freeSpot(0);
    if (k === 'hormone') dropPickup('hormone', p.x, p.y, CR.HORMONES[ri(0, 7)].id);
    else if (k === 'chart') dropPickup('chart', p.x, p.y, CR.CHARTS[ri(0, 9)].id);
    else if (k === 'chest') { for (let i = 0; i < 3; i++) dropPickup(['coin', 'coin', 'bomb', 'key', 'heart'][ri(0, 4)], p.x, p.y); }
    else dropPickup(k === 'heart' && Math.random() < 0.4 ? 'half' : k, p.x, p.y);
  }
  function onBossDefeated() {
    const P = G.P, room = G.room;
    AU.sfx('clear'); G.shake = 10;
    dropPedestal(rollItem('boss'), RW / 2, RH / 2 - 28);
    dropPickup('heart', RW / 2 - 30, RH / 2 + 10);
    for (let i = 0; i < toolFx('bossDrop'); i++) dropPickup(['coin', 'bomb', 'key', 'heart', 'shield'][ri(0, 4)], RW / 2 + rand(-40, 40), RH / 2 + rand(10, 30));
    if (G.stage < 6) G.hatch = { x: RW / 2, y: RH / 2 + 30, t: 0 };
    else G.trophy = { x: RW / 2, y: RH / 2 + 26, t: 0 };
    if (G.time < G.stage * 270) { G.bonusNext = G.stage < 6; if (G.stage < 6) toast('시간 단축 성공!', '다음 구역 시작 방에 특별 보상이 기다려요', '#9effe0'); }
    // 이 층의 일반 방을 모두 비웠으면 변이 연구실이 열림
    const allClear = [...G.floor.rooms.values()].every(r => r.type !== 'normal' || r.cleared);
    if (allClear && CR.addLab(G.floor, Math.random)) { toast('변이 연구실 개방', '층의 모든 방을 탐사해 보스 방 옆 연구실 문이 열렸어요', '#ff6b8a'); }
    if (CR.ui) CR.ui.bossBar(null);
    AU.play(CR.STAGES[G.stage - 1].music);
  }
  function goThroughDoor(d) {
    const dr = G.room.doors[d]; if (!dr) return;
    AU.sfx('door'); enterRoom(dr.to, d); G.fade = 0.25;
  }
  function teleportTo(type) {
    let r = null; for (const x of G.floor.rooms.values()) if (x.type === type) { r = x; break; }
    if (type === 'lab' && !r) r = CR.addLab(G.floor, Math.random);
    if (!r) { toast('갈 곳이 없어요', '이 층에는 그런 방이 없어요', '#ff9e9e'); return false; }
    enterRoom(r.key, null); G.fade = 0.4; AU.sfx('stairs'); return true;
  }
  CR.teleportTo = teleportTo;

  /* ───────── 병원체 ───────── */
  function mkEnemy(def, x, y, o) {
    const hpMul = 1 + Math.max(0, G.stage - (def.st || G.stage)) * 0.35;
    const e = Object.assign({ def, x, y, r: (def.S || 16) * 0.32, hp: def.hp * hpMul, maxHp: def.hp * hpMul, vx: 0, vy: 0, t: Math.random() * 2, cd: rand(0.8, 2) + (def.atk ? def.atk.cd * 0.4 : 0), flash: 0, slowT: 0, freezeT: 0, stunT: 0, poisonT: 0, bleedT: 0, mark: 0, state: 'idle', st: 0, dir: Math.random() * TAU, z: 0 }, o || {});
    if (def.move === 'burrow') { e.hidden = true; e.st = rand(0.5, 1.5); }
    if (def.armor) { e.shut = true; e.st = 2; }
    G.seen.add(def.id); if (CR.ui) CR.ui.markSeen(def.id);
    return e;
  }
  CR.mkEnemy = mkEnemy;
  function spawnEnemyHere(id) { const def = CR.ALL[id]; if (!def) return; const p = freeSpot(50); const e = mkEnemy(def, p.x, p.y); G.room.ents.push(e); G.room.cleared = false; return e; }
  CR.spawnEnemyHere = spawnEnemyHere;
  function eShot(x, y, a, spd, o) { if (G.eb.length > 450) G.eb.splice(0, 40); const b = Object.assign({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 2.6, t: 0, life: 6, col: '#ff5d7a' }, o || {}); if (G.slowAll > 0) { b.vx *= 0.4; b.vy *= 0.4; } const slow = toolFx('ebSlow'); if (slow) { b.vx *= 1 - slow; b.vy *= 1 - slow; } G.eb.push(b); return b; }
  CR.eShot = eShot;
  function ring(x, y, n, spd, off, o) { for (let i = 0; i < n; i++) eShot(x, y, (off || 0) + i * TAU / n, spd, o); AU.sfx('eshot'); }
  function rayLen(x, y, a) { let l = 0; while (l < 420) { l += 4; const tx = Math.floor((x + Math.cos(a) * l) / T), ty = Math.floor((y + Math.sin(a) * l) / T); if (CR.tileAt(G.room, tx, ty) === 1) break; } return l; }
  function laser(x, y, a, o) { const L = Object.assign({ x, y, a, tele: 0.8, act: 0.55, t: 0, w: 5, owner: 'e', col: '#ff4d6d', spin: 0, follow: null }, o || {}); G.lasers.push(L); return L; }
  CR.laser = laser;
  function creep(x, y, r, life, kind, o) { const c = Object.assign({ x, y, r, life, t: 0, kind }, o || {}); G.creeps.push(c); return c; }
  CR.creep = creep;
  const SPD = 55;

  function updateEnemy(e, dt) {
    const d = e.def, P = G.P;
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.dormant) { e.dormant -= dt; if (e.dormant <= 0) { e.dormant = 0; e.hp = e.maxHp * 0.6; e.revived = true; burstFx(e.x, e.y, '#c070ff', 14); } return; }
    if (e.poisonT > 0) { e.poisonT -= dt; e.dotT = (e.dotT || 0) - dt; if (e.dotT <= 0) { e.dotT = 0.5; hurtEnemy(e, Math.max(1, G.P.st.dmg * 0.35), { dot: 1, col: '#7bdc5a' }); } }
    if (e.bleedT > 0) { e.bleedT -= dt; e.bdT = (e.bdT || 0) - dt; if (e.bdT <= 0) { e.bdT = 0.6; hurtEnemy(e, Math.max(1, G.P.st.dmg * 0.25), { dot: 1, col: '#ff5d5d' }); if (Math.random() < 0.5) G.fx.push({ x: e.x, y: e.y, vx: 0, vy: 20, t: 0, life: 0.5, col: '#c8202e', s: 1 }); } }
    if (e.dead) return;
    if (e.freezeT > 0) { e.freezeT -= dt; return; }
    if (e.stunT > 0) { e.stunT -= dt; return; }
    if (e.ally) return updateAlly(e, dt);
    const slow = (e.slowT > 0 ? 0.5 : 1) * (G.slowAll > 0 ? 0.4 : 1); if (e.slowT > 0) e.slowT -= dt;
    const sp = d.spd * SPD * slow, a = ang(e, P), dd = dist(e, P);
    const mode = d.move === 'fly' ? 'fly' : d.move === 'ghost' ? 'ghost' : 'walk';
    switch (d.move) {
      case 'chase': case 'fly': case 'ghost': { const wob = d.move === 'fly' ? Math.sin(e.t * 6) * 0.6 : 0; moveEnt(e, Math.cos(a + wob) * sp * dt, Math.sin(a + wob) * sp * dt, mode); break; }
      case 'wander': { e.st -= dt; if (e.st <= 0) { e.dir = Math.random() < 0.4 ? a : Math.random() * TAU; e.st = rand(0.8, 2); } if (moveEnt(e, Math.cos(e.dir) * sp * dt, Math.sin(e.dir) * sp * dt, mode)) e.dir += Math.PI * 0.7; if (d.creep) { e.cT = (e.cT || 0) - dt; if (e.cT <= 0) { e.cT = 0.45; creep(e.x, e.y, 7, 4, 'acid'); } } break; }
      case 'zigzag': { const z = Math.floor(e.t / 0.35) % 2 ? 0.8 : -0.8; moveEnt(e, Math.cos(a + z) * sp * dt, Math.sin(a + z) * sp * dt, mode); break; }
      case 'swim': { if (!e.vx) { e.vx = (Math.random() < 0.5 ? -1 : 1) * sp; e.vy = (Math.random() < 0.5 ? -1 : 1) * sp; } const h = moveEnt(e, e.vx * dt * slow, e.vy * dt * slow, mode); if (h & 1) e.vx = -e.vx; if (h & 2) e.vy = -e.vy; break; }
      case 'hop': {
        e.st -= dt;
        if (e.state === 'air') { e.z = Math.sin((1 - e.st / 0.5) * Math.PI) * 10; moveEnt(e, e.vx * dt, e.vy * dt, 'fly'); if (e.st <= 0) { e.state = 'idle'; e.z = 0; e.st = rand(0.6, 1.1); if (d.slam) { ring(e.x, e.y, d.slam, 70); G.shake = 4; } } }
        else if (e.st <= 0) { e.state = 'air'; e.st = 0.5; const tgt = Math.min(dd, 60 + sp); e.vx = Math.cos(a) * tgt / 0.5; e.vy = Math.sin(a) * tgt / 0.5; }
        break; }
      case 'charge': {
        if (e.state === 'dash') { const h = moveEnt(e, e.vx * dt, e.vy * dt, mode); if (h || e.st <= 0) { e.state = 'rest'; e.st = 0.7; } e.st -= dt; }
        else if (e.state === 'rest') { e.st -= dt; if (e.st <= 0) e.state = 'idle'; }
        else { e.dir += rand(-1, 1) * dt; if (moveEnt(e, Math.cos(e.dir) * sp * 0.5 * dt, Math.sin(e.dir) * sp * 0.5 * dt, mode)) e.dir += 2;
          const ax = Math.abs(P.x - e.x) < 10, ay = Math.abs(P.y - e.y) < 10, f = (d.fast ? 182 : 133) * slow;
          if ((ax || ay || dd < 50) && e.t > 0.8) { e.state = 'dash'; e.st = 1.4; if (dd < 50) { e.vx = Math.cos(a) * f; e.vy = Math.sin(a) * f; } else if (ax) { e.vx = 0; e.vy = Math.sign(P.y - e.y) * f; } else { e.vy = 0; e.vx = Math.sign(P.x - e.x) * f; } } }
        break; }
      case 'burrow': {
        e.st -= dt;
        if (e.hidden) { if (e.st <= 0) { const p = freeSpot(45); e.x = p.x; e.y = p.y; e.hidden = false; e.st = 2; e.cd = 0.5; burstFx(e.x, e.y, CR.STAGES[G.stage - 1].floor2, 8); } }
        else if (e.st <= 0) { e.hidden = true; e.st = rand(1.2, 2.2); }
        break; }
      case 'teleport': { e.st -= dt; moveEnt(e, Math.cos(a) * sp * 0.4 * dt, Math.sin(a) * sp * 0.4 * dt, mode); if (e.st <= 0) { e.st = rand(2.2, 3.4); burstFx(e.x, e.y, d.col, 8); const p = freeSpot(55); e.x = p.x; e.y = p.y; burstFx(e.x, e.y, d.col, 8); } break; }
    }
    if (d.pull && dd < 95 && !has('flight')) { const k = (1 - dd / 95) * 38 * dt; moveEnt(P, -Math.cos(a) * k, -Math.sin(a) * k, has('flight') ? 'pfly' : 'player'); }
    if (d.boomNear && dd < 20) { e.hp = 0; killEnemy(e); return; }
    if (d.armor) { e.st -= dt; if (e.st <= 0) { e.shut = !e.shut; e.st = e.shut ? 2.2 : 1.3; if (!e.shut) enemyAttack(e); } }
    else if (d.atk && !e.hidden) { e.cd -= dt * slow; if (e.cd <= 0) { e.cd = d.atk.cd * rand(0.85, 1.15); enemyAttack(e); } }
    if (e.burst) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.16; eShot(e.x, e.y, ang(e, P), d.atk.fast ? 120 : 90, { col: '#ffd34d' }); AU.sfx('eshot'); } }
    // 몸으로 부딪힘
    if (!e.hidden && e.z < 4 && dist(e, P) < e.r + P.r) hurtPlayer(1, 'contact');
  }
  function enemyAttack(e) {
    const d = e.def, a = d.atk, P = G.P, A = ang(e, P), sp = a.fast ? 125 : 85, col = d.col;
    switch (a.t) {
      case 'aim': if (a.burst) { e.burst = a.n || 3; e.burstT = 0; } else { const n = a.n || 1; for (let i = 0; i < n; i++) eShot(e.x, e.y, A + (i - (n - 1) / 2) * 0.22, sp, { push: a.push, slowShot: a.slowShot, col: a.slowShot ? '#8fd3f4' : a.push ? '#5fc4e0' : '#ff5d7a' }); AU.sfx('eshot'); } break;
      case 'spread': for (let i = -1; i <= 1; i++) eShot(e.x, e.y, A + i * 0.32, sp); AU.sfx('eshot'); break;
      case 'cross': for (let i = 0; i < 4; i++) eShot(e.x, e.y, i * Math.PI / 2, 80, { col: '#c8202e', r: 3 }); AU.sfx('eshot'); break;
      case 'ring': ring(e.x, e.y, a.n || 8, 72, a.spin ? e.t * 1.3 : 0); break;
      case 'homing': eShot(e.x, e.y, A, 60, { homing: 2.4, col: d.c2 || '#c486ff', r: 3 }); AU.sfx('eshot'); break;
      case 'laser': if (a.spin) { laser(e.x, e.y, e.t, { spin: 1.2, act: 2.2, follow: e }); laser(e.x, e.y, e.t + Math.PI / 2, { spin: 1.2, act: 2.2, follow: e }); laser(e.x, e.y, e.t + Math.PI, { spin: 1.2, act: 2.2, follow: e }); laser(e.x, e.y, e.t + Math.PI * 1.5, { spin: 1.2, act: 2.2, follow: e }); } else laser(e.x, e.y, A, { follow: e, col: '#b3e06b' }); break;
      case 'cloud': { if (Math.random() < 0.5) { const p = { x: P.x + rand(-30, 30), y: P.y + rand(-30, 30) }; creep(p.x, p.y, 11, 3.2, 'cloud', { col: d.col, delay: 0.85 }); } creep(e.x + rand(-10, 10), e.y + rand(-10, 10), 14, 3, 'cloud', { col: d.col, delay: 0.6 }); break; }
      case 'summon': { const kids = G.room.ents.filter(x => x.parent === e && !x.dead).length; if (kids < 3) { const k = mkEnemy(CR.ALL[a.id], e.x + rand(-10, 10), e.y + rand(-10, 10), { parent: e }); G.room.ents.push(k); burstFx(e.x, e.y, d.col, 6); } break; }
      case 'heal': for (const o of G.room.ents) if (o !== e && !o.dead && !o.ally && dist(o, e) < 90 && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + 4); G.fx.push({ x: o.x, y: o.y - 6, vx: 0, vy: -20, t: 0, life: 0.6, col: '#7dffb2', s: 2 }); } break;
      case 'cough': { G.pb = G.pb.filter(b => dist(b, e) > 56); if (dist(e, P) < 64) { P.vx += Math.cos(A) * 220; P.vy += Math.sin(A) * 220; } G.fx.push({ ring: 1, x: e.x, y: e.y, r0: 4, r1: 56, t: 0, life: 0.35, col: '#fff7c0' }); ring(e.x, e.y, 8, 60); break; }
    }
  }
  function updateAlly(e, dt) {
    let tgt = null, best = 1e9; for (const o of G.room.ents) if (!o.ally && !o.dead && !o.hidden) { const dd = dist(o, e); if (dd < best) { best = dd; tgt = o; } }
    e.life = (e.life || 12) - dt; if (e.life <= 0) { e.dead = true; return; }
    if (!tgt) { moveEnt(e, Math.cos(ang(e, G.P)) * 40 * dt, Math.sin(ang(e, G.P)) * 40 * dt, 'fly'); return; }
    const a = ang(e, tgt); moveEnt(e, Math.cos(a) * 110 * dt, Math.sin(a) * 110 * dt, 'fly');
    if (best < e.r + tgt.r + 2) { hurtEnemy(tgt, 14, { col: '#9fffe0' }); explodeFx(e.x, e.y, 14, '#9fffe0'); e.dead = true; }
  }
  function hurtEnemy(e, dmg, o) {
    o = o || {};
    if (e.dead || e.hidden || e.ally) return 0;
    if (e.dormant) { e.corpse = (e.corpse || 15) - dmg; e.flash = 0.08; if (e.corpse <= 0) { e.dormant = 0; e.def = Object.assign({}, e.def, { revive: 0 }); finishKill(e); } return dmg; }
    if (e.shell || (e.shut && !toolFx('armorPierce'))) { if (!o.dot) AU.sfx('tink'); return 0; }
    if (e.def.resist) dmg *= 1 - e.def.resist;
    if (e.mark > 0) dmg *= 1.3;
    if (G.room.weak) dmg *= 2;
    if (e.boss) dmg *= 1 + toolFx('bossDmg');
    e.hp -= dmg; e.flash = 0.1;
    if (!o.dot) AU.sfx('hit');
    if (e.hp <= 0) killEnemy(e);
    return dmg;
  }
  CR.hurtEnemy = hurtEnemy;
  function killEnemy(e) {
    if (e.dead) return;
    if (e.def.revive && !e.revived) { e.dormant = 3; e.corpse = 15; e.hp = 0; AU.sfx('edie'); return; }
    if (e.boss && e.def.split && (e.gen || 0) < e.def.split) {   // 분열 보스
      for (let i = 0; i < 2; i++) { const b = mkBoss(e.def, e.x + (i ? 14 : -14), e.y, { gen: (e.gen || 0) + 1, maxHp: e.maxHp * 0.5, scale: (e.scale || 1) * 0.75 }); G.room.ents.push(b); }
      burstFx(e.x, e.y, e.def.col, 24); AU.sfx('boom');
    }
    finishKill(e);
  }
  function finishKill(e) {
    const d = e.def, P = G.P; e.dead = true; AU.sfx('edie');
    burstFx(e.x, e.y, d.col, e.boss ? 40 : 12); G.fx.push({ splat: 1, x: e.x, y: e.y, t: 0, life: 8, col: CR.shade(d.col, -0.35), r: e.r + 2 });
    if (!d.id.endsWith('s') && d.kind === 'enemy') G.killedTypes.add(d.id);
    if (e.boss) G.killedTypes.add(d.id);
    G.kills++;
    if (d.death === 'burst4') for (let i = 0; i < 4; i++) eShot(e.x, e.y, i * Math.PI / 2, 80, { col: '#ffe3a0' });
    if (d.death === 'burst6') ring(e.x, e.y, 6, 80);
    if (d.death === 'burst8') ring(e.x, e.y, 8, 90, 0, { col: '#ffb0d8' });
    if (d.death === 'split' && !e.mini) { const mid = d.id === 'E10' ? 'E10s' : 'E20s'; for (let i = 0; i < 2; i++) G.room.ents.push(mkEnemy(CR.MINIS[mid], e.x + (i ? 6 : -6), e.y, { mini: 1 })); }
    if (d.death === 'explode') explosion(e.x, e.y, 26, 0, { enemy: 1 });
    if (has('fragKill')) for (let i = 0; i < 4; i++) pShot(e.x, e.y, i * Math.PI / 2 + Math.PI / 4, { dmg: P.st.dmg * 0.5, frag: 1 });
    if (has('convert') && !e.boss && Math.random() < 0.25) { const a = mkEnemy(CR.MINIS.ally, e.x, e.y, { ally: 1, life: 14 }); G.room.ents.push(a); }
    if (has('vampire')) { P.vampN = (P.vampN || 0) + 1; if (P.vampN % 10 === 0) heal(1); }
    if (Math.random() < 0.06 + toolFx('killCoin')) dropPickup('coin', e.x, e.y);
  }

  /* ───────── 보스 ───────── */
  function mkBoss(def, x, y, o) {
    o = o || {}; const sc = o.scale || 1;
    const b = mkEnemy(def, x, y, { boss: true, r: 11 * sc, scale: sc, gen: o.gen || 0, cur: null, pq: [], idle: 1.4, phase: 0, tint: null });
    b.hp = b.maxHp = o.maxHp || def.hp; if (def.segs) { b.trail = []; for (let i = 0; i < 96; i++) b.trail.push({ x, y }); }
    return b;
  }
  function spawnBoss(def, room) {
    const cx = RW / 2, cy = RH / 2 - 10;
    if (def.twins) { room.ents.push(mkBoss(def, cx - 50, cy), mkBoss(def, cx + 50, cy)); room.ents.forEach(b => (b.twin = true)); }
    else room.ents.push(mkBoss(def, cx, cy));
  }
  CR.spawnBossHere = function (id) { const def = CR.ALL[id]; if (!def) return; spawnBoss(def, G.room); G.room.cleared = false; G.room.type = G.room.type === 'boss' ? 'boss' : G.room.type; if (CR.ui) CR.ui.bossIntro(def); G.intro = { t: 1.6, def }; AU.sfx('boss'); };
  const parsePat = s => { const p = s.split(':'); return { name: p[0], a: p.slice(1) }; };
  function bossPhase(b) { const f = b.hp / b.maxHp; if (b.def.phases3) return f > 0.6 ? 0 : f > 0.25 ? 1 : 2; return f > 0.5 ? 0 : 1; }
  // 보스 패턴 사전: start → update(dt) true를 돌려주면 끝
  const PAT = {
    jump: { s(b) { b.c.tx = G.P.x; b.c.ty = G.P.y; b.c.sx = b.x; b.c.sy = b.y; }, u(b, dt) { const t = b.c.t; if (t < 0.3) return false; const k = Math.min(1, (t - 0.3) / 0.7); b.x = b.c.sx + (b.c.tx - b.c.sx) * k; b.y = b.c.sy + (b.c.ty - b.c.sy) * k; b.z = Math.sin(k * Math.PI) * 30; if (k >= 1) { b.z = 0; ring(b.x, b.y, b.phase ? 16 : 12, 80); G.shake = 6; AU.sfx('boom'); unstick(b); return true; } return false; } },
    scatter: { s(b) { b.c.hide = 1; }, u(b, dt) { const t = b.c.t; if (t < 1.1) { b.z = Math.min(200, t * 260); if (t > 0.5) { b.x += (G.P.x - b.x) * 3 * dt; b.y += (G.P.y - b.y) * 3 * dt; } return false; } b.z = Math.max(0, 200 - (t - 1.1) * 600); if (b.z <= 0) { for (let i = 0; i < 18; i++) eShot(b.x, b.y, Math.random() * TAU, rand(50, 120), { col: '#ffe3a0' }); G.shake = 8; AU.sfx('boom'); unstick(b); return true; } return false; } },
    aim: { u(b) { const n = +b.c.a[0] || 3, k = Math.floor(b.c.t / 0.35); if (k > b.c.k) { b.c.k = k; const A = ang(b, G.P); for (let i = 0; i < n; i++) eShot(b.x, b.y, A + (i - (n - 1) / 2) * 0.2, 95); AU.sfx('eshot'); } return b.c.t > 1.1; } },
    ring: { u(b) { const n = +b.c.a[0] || 10, k = Math.floor(b.c.t / 0.5); if (k > b.c.k && k < 3) { b.c.k = k; ring(b.x, b.y, n, 78, k * Math.PI / n); if (b.def.segs) b.trail.forEach((p, i) => { if (i % 16 === 8) { eShot(p.x, p.y, ang(p, G.P), 80); } }); } return b.c.t > 1.2; } },
    spiral: { u(b) { b.c.e = (b.c.e || 0) + 1; const arms = b.phase ? 3 : 2; if (b.c.e % 5 === 0) for (let i = 0; i < arms; i++) eShot(b.x, b.y, b.c.t * 2.6 + i * TAU / arms, 85, { col: '#ff8ad0' }); if (b.c.e % 15 === 0) AU.sfx('eshot'); return b.c.t > 2.6; } },
    charge: { s(b) { b.c.n = b.phase ? 2 : 1; b.c.w = 0.5; }, u(b, dt) { if (b.c.w > 0) { b.c.w -= dt; b.flash = 0.05; if (b.c.w <= 0) { const A = ang(b, G.P); b.c.vx = Math.cos(A) * 161; b.c.vy = Math.sin(A) * 161; } return false; } const h = moveEnt(b, b.c.vx * dt, b.c.vy * dt, 'walk'); if (h) { ring(b.x, b.y, 8, 70); G.shake = 5; AU.sfx('boom'); b.c.n--; if (b.c.n <= 0) return true; b.c.w = 0.4; } return b.c.t > 4; } },
    summon: { s(b) { const id = b.c.a[0], n = +b.c.a[1] || 1, alive = G.room.ents.filter(e => !e.boss && !e.dead && !e.ally).length; for (let i = 0; i < n && alive + i < 7; i++) { const e = mkEnemy(CR.ALL[id], b.x + rand(-20, 20), b.y + rand(-14, 20)); G.room.ents.push(e); burstFx(e.x, e.y, e.def.col, 8); } }, u(b) { return b.c.t > 0.6; } },
    teleport: { u(b) { const t = b.c.t; if (t < 0.4) { b.fade = 1 - t / 0.4; return false; } if (!b.c.m) { b.c.m = 1; const p = freeSpot(80); b.x = p.x; b.y = p.y; } if (t < 0.7) { b.fade = (t - 0.4) / 0.3; return false; } b.fade = 1; if (!b.c.s) { b.c.s = 1; const A = ang(b, G.P); for (let i = -1; i <= 1; i++) eShot(b.x, b.y, A + i * 0.25, 100); AU.sfx('eshot'); } return t > 0.9; } },
    laser8: { s(b) { const n = b.phase || b.def.phases3 ? 8 : 4, off = ang(b, G.P); for (let i = 0; i < n; i++) laser(b.x, b.y, off + i * TAU / n, { follow: b, w: 6 }); AU.sfx('charge'); }, u(b) { return b.c.t > 1.6; } },
    laser3: { s(b) { const A = ang(b, G.P); for (let i = -1; i <= 1; i++) laser(b.x, b.y, A + i * 0.38, { follow: b, w: 5, col: '#ffb0e0' }); AU.sfx('charge'); }, u(b) { return b.c.t > 1.5; } },
    cross: { s(b) { for (let i = 0; i < 4; i++) laser(b.x, b.y, i * Math.PI / 2, { follow: b, w: 7, col: '#ffe36b' }); AU.sfx('charge'); }, u(b) { return b.c.t > 1.5; } },
    xcross: { s(b) { for (let i = 0; i < 4; i++) laser(b.x, b.y, Math.PI / 4 + i * Math.PI / 2, { follow: b, w: 7, col: '#ffe36b' }); AU.sfx('charge'); }, u(b) { return b.c.t > 1.5; } },
    sweep: { s(b) { laser(b.x, b.y, ang(b, G.P), { follow: b, w: 7, tele: 0.7, act: 3.2, spin: (Math.random() < 0.5 ? 1 : -1) * 1.9, col: '#ff3d5a' }); AU.sfx('charge'); }, u(b) { return b.c.t > 4.1; } },
    rain: { s(b) { b.c.pts = []; for (let i = 0; i < 8; i++) { const p = i < 3 ? { x: G.P.x + rand(-30, 30), y: G.P.y + rand(-30, 30) } : freeSpot(0); b.c.pts.push(p); G.fx.push({ warn: 1, x: p.x, y: p.y, r: 12, t: 0, life: 1 }); } }, u(b) { if (b.c.t > 1 && !b.c.d) { b.c.d = 1; b.c.pts.forEach(p => { explodeFx(p.x, p.y, 12, '#ff8a3d'); if (Math.hypot(p.x - G.P.x, p.y - G.P.y) < 14) hurtPlayer(1); ring(p.x, p.y, 6, 60, Math.random()); }); AU.sfx('boom'); } return b.c.t > 1.4; } },
    pool: { s(b) { for (let i = 0; i < 5; i++) { const p = i === 0 ? { x: G.P.x, y: G.P.y } : freeSpot(0); creep(p.x, p.y, rand(16, 22), 6, 'acid', { delay: 0.9 }); } }, u(b) { return b.c.t > 0.8; } },
    wave: { s(b) { const side = ri(0, 3), gap = ri(2, 6); for (let i = 1; i < (side < 2 ? ROWS - 1 : COLS - 1); i++) { if (Math.abs(i - gap - (side < 2 ? 0 : 4)) <= 1) continue; const sp = 70; if (side === 0) eShot(T + 4, i * T + 8, 0, sp, { r: 3.2, col: '#ff7a3d', life: 9 }); else if (side === 1) eShot(RW - T - 4, i * T + 8, Math.PI, sp, { r: 3.2, col: '#ff7a3d', life: 9 }); else if (side === 2) eShot(i * T + 8, T + 4, Math.PI / 2, sp, { r: 3.2, col: '#ff7a3d', life: 9 }); else eShot(i * T + 8, RH - T - 4, -Math.PI / 2, sp, { r: 3.2, col: '#ff7a3d', life: 9 }); } AU.sfx('laser'); }, u(b) { return b.c.t > 1.4; } },
    shell: { s(b) { b.shell = true; }, u(b) { if (b.c.t > 2.6) { b.shell = false; ring(b.x, b.y, b.phase ? 20 : 16, 90); AU.sfx('boom'); return true; } return false; } },
    orbit: { s(b) { b.c.bs = []; for (let i = 0; i < 12; i++) b.c.bs.push(eShot(b.x, b.y, 0, 0, { orb: { o: b, a: i * TAU / 12, r: 26 }, life: 9, col: '#9fd2ff' })); }, u(b) { if (b.c.t > 1.4 && !b.c.f) { b.c.f = 1; b.c.bs.forEach(s => { const a = s.orb.a; s.orb = null; s.vx = Math.cos(a) * 95; s.vy = Math.sin(a) * 95; }); AU.sfx('eshot'); } return b.c.t > 1.6; } },
    homing: { s(b) { const n = +b.c.a[0] || 4; for (let i = 0; i < n; i++) eShot(b.x, b.y, i * TAU / n, 55, { homing: 3, col: '#c486ff', r: 3.2 }); AU.sfx('eshot'); }, u(b) { return b.c.t > 1; } },
    burst: { s(b) { ring(b.x, b.y, 24, 85, 0, { col: '#ffe3a0' }); const A = ang(b, G.P); for (let i = -2; i <= 2; i++) eShot(b.x, b.y, A + i * 0.15, 110); G.shake = 6; AU.sfx('boom'); }, u(b) { return b.c.t > 0.8; } },
    net: { s(b) { for (let i = 0; i < 6; i++) eShot(b.x, b.y, ang(b, G.P) + (i - 2.5) * 0.4, 70, { web: 1, col: '#f2e0b0' }); AU.sfx('eshot'); }, u(b) { return b.c.t > 0.8; } },
    cloud: { s(b) { for (let i = 0; i < 4; i++) creep(G.P.x + rand(-40, 40), G.P.y + rand(-30, 30), 14, 3.4, 'cloud', { col: b.def.col, delay: 0.85 }); }, u(b) { return b.c.t > 0.7; } },
    inflate: { u(b, dt) { const t = b.c.t; if (t < 1.2) { b.scale = 1 + t * 0.4; const A = ang(b, G.P); if (!has('giant')) moveEnt(G.P, Math.cos(A) * 50 * dt, Math.sin(A) * 50 * dt, has('flight') ? 'pfly' : 'player'); return false; } b.scale = 1; ring(b.x, b.y, b.phase ? 24 : 18, 85); AU.sfx('boom'); return true; } },
    web: { s(b) { for (let i = 0; i < 4; i++) { const y = T * (2 + i * 2) + 8; for (let x = 2; x < COLS - 2; x += 2) if (Math.random() < 0.6) creep(x * T + 8, y, 9, 5, 'web'); } }, u(b) { return b.c.t > 0.6; } },
    zap: { s(b) { G.fx.push({ ring: 1, x: b.x, y: b.y, r0: 8, r1: 150, t: 0, life: 1.2, col: '#9fd2ff', hurt: 1 }); AU.sfx('zap'); }, u(b) { return b.c.t > 1.2; } },
    tentacle: { s(b) { b.c.pts = []; for (let i = 0; i < 4; i++) { const p = { x: G.P.x + rand(-40, 40), y: G.P.y + rand(-30, 30) }; b.c.pts.push(p); G.fx.push({ warn: 1, x: p.x, y: p.y, r: 11, t: 0, life: 0.8 }); } }, u(b) { if (b.c.t > 0.8 && !b.c.d) { b.c.d = 1; b.c.pts.forEach(p => { G.fx.push({ tent: 1, x: p.x, y: p.y, t: 0, life: 0.9, col: b.def.c2 || b.def.col }); if (Math.hypot(p.x - G.P.x, p.y - G.P.y) < 12) hurtPlayer(2); ring(p.x, p.y, 6, 70); }); AU.sfx('boom'); } return b.c.t > 1.3; } },
  };
  function unstick(b) { if (blocked(b.x, b.y, b.r, 'walk')) { const p = freeSpot(40); b.x = p.x; b.y = p.y; } }
  function updateBoss(b, dt) {
    const d = b.def, P = G.P;
    b.t += dt; if (b.flash > 0) b.flash -= dt;
    if (b.poisonT > 0) { b.poisonT -= dt; b.dotT = (b.dotT || 0) - dt; if (b.dotT <= 0) { b.dotT = 0.5; hurtEnemy(b, Math.max(1, P.st.dmg * 0.35), { dot: 1 }); } }
    if (b.bleedT > 0) { b.bleedT -= dt; b.bdT = (b.bdT || 0) - dt; if (b.bdT <= 0) { b.bdT = 0.6; hurtEnemy(b, Math.max(1, P.st.dmg * 0.25), { dot: 1 }); } }
    if (b.dead) return;
    if (b.freezeT > 0) { b.freezeT -= dt * 2; return; }
    if (b.stunT > 0) { b.stunT -= dt * 2; return; }
    const ph = bossPhase(b); if (ph !== b.phase) { b.phase = ph; b.pq = []; b.cur = null; b.idle = 0.6; b.flash = 0.4; AU.sfx('boss'); G.shake = 6; }
    const rage = b.twin && G.room.ents.filter(e => e.boss && !e.dead).length === 1 ? 1.6 : 1;
    if (d.morph) { b.mt = (b.mt || 0) + dt; if (b.mt > 5) { b.mt = 0; b.tint = ['#7ec8a8', '#ff8a8a', '#8ab4ff', '#ffd36b', '#d68cff'][ri(0, 4)]; b.pq = []; burstFx(b.x, b.y, b.tint, 16); } }
    const slow = (b.slowT > 0 ? 0.6 : 1) * (G.slowAll > 0 ? 0.5 : 1); if (b.slowT > 0) b.slowT -= dt;
    const busy = b.cur && ['jump', 'scatter', 'charge', 'teleport', 'inflate'].includes(b.cur.name);
    let mv = d.move; if (d.phases3) mv = ['static', 'bounce', 'float'][b.phase];
    if (!busy) {
      const a = ang(b, P), s = slow * rage;
      if (mv === 'walk') moveEnt(b, Math.cos(a) * 26 * s * dt, Math.sin(a) * 26 * s * dt, 'walk');
      else if (mv === 'float') { const tx = RW / 2 + Math.cos(b.t * 0.6) * 90, ty = RH / 2 + Math.sin(b.t * 0.9) * 40; b.x += (tx - b.x) * 0.8 * dt * s; b.y += (ty - b.y) * 0.8 * dt * s; }
      else if (mv === 'bounce') { if (!b.bvx) { b.bvx = 70; b.bvy = 55; } const h = moveEnt(b, b.bvx * s * dt, b.bvy * s * dt, 'fly'); if (h & 1) b.bvx = -b.bvx; if (h & 2) b.bvy = -b.bvy; }
      else if (mv === 'snake') { b.sa = (b.sa || 0); const ta = ang(b, P); let da = ((ta - b.sa + Math.PI * 3) % TAU) - Math.PI; b.sa += clamp(da, -1.6 * dt, 1.6 * dt) + Math.sin(b.t * 3) * 0.02; if (moveEnt(b, Math.cos(b.sa) * 62 * s * dt, Math.sin(b.sa) * 62 * s * dt, 'fly')) b.sa += 2.2; }
    }
    if (b.trail) { b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 96) b.trail.length = 96; for (let i = 12; i < 96; i += 12) { const p = b.trail[i]; if (Math.hypot(p.x - P.x, p.y - P.y) < 7 + P.r) hurtPlayer(1, 'contact'); } }
    if (!b.cur) {
      b.idle -= dt * rage * slow;
      if (b.idle <= 0) { if (!b.pq.length) b.pq = d.pats[Math.min(b.phase, d.pats.length - 1)].slice(); if (d.morph) b.pq.sort(() => Math.random() - 0.5); const p = parsePat(b.pq.shift()); b.cur = p; b.c = { t: 0, k: -1, a: p.a, name: p.name }; if (PAT[p.name] && PAT[p.name].s) PAT[p.name].s(b); }
    } else {
      b.c.t += dt * slow; const fn = PAT[b.cur.name];
      if (!fn || fn.u(b, dt * slow)) { b.cur = null; b.c = null; b.idle = (b.phase ? 0.55 : 0.95) / rage; b.z = 0; b.fade = 1; }
    }
    if ((!b.z || b.z < 6) && dist(b, P) < b.r + P.r) hurtPlayer(G.stage >= 4 ? 2 : 1, 'contact');
  }

  /* ───────── 플레이어 사격 ───────── */
  function pShot(x, y, a, o) {
    // 성능 안전장치: 탄환이 너무 많으면 파생 탄환부터 만들지 않음
    if (G.pb.length > 260 && o && o.child) return null;
    if (G.pb.length > 420) G.pb.splice(0, G.pb.length - 420);
    const s = G.P.st, sp = 165 * s.sspd * (o && o.spdMul || 1);
    const b = Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, sp, r: 2.6 * s.size, dmg: s.dmg, life: s.range, trav: 0, hit: new Set(), bounce: has('bounce') ? 2 : 0, t: 0, ph: 0, col: '#bfe7ff' }, o || {});
    if (has('poison')) b.col = '#9ef07a'; if (has('homing')) b.col = '#d9a6ff'; if (has('chain')) b.col = '#a6e8ff'; if (has('fullHp') && G.P.hp >= G.P.maxHp) b.col = '#fff4b0';
    G.pb.push(b); return b;
  }
  CR.pShot = pShot;
  function fire(a, fromX, fromY, isEcho) {
    const P = G.P, s = P.st, x = fromX != null ? fromX : P.x, y = fromY != null ? fromY : P.y - 3;
    const base = { };
    if (has('moveShot')) { const mv = Math.hypot(P.vx, P.vy); if (mv > 20) { base.spdMul = 1.25; base.dmg = s.dmg * 1.2; } }
    const shots = [];
    if (has('shotgun')) for (let i = 0; i < 5; i++) shots.push([a + rand(-0.38, 0.38), { spdMul: rand(0.8, 1.15) }]);
    else if (has('triple')) [-0.22, 0, 0.22].forEach(o => shots.push([a + o, {}]));
    else shots.push([a, {}]);
    for (const [aa, o] of shots) {
      if (has('helix')) { pShot(x, y, aa, Object.assign({}, base, o, { helix: 1, ph: 0 })); pShot(x, y, aa, Object.assign({}, base, o, { helix: 1, ph: Math.PI })); }
      else if (has('orbitShot') && !isEcho) pShot(x, y, aa, Object.assign({}, base, o, { orbit: { a: aa, t: 0.6 } }));
      else pShot(x, y, aa, Object.assign({}, base, o));
    }
    if (P.room.pace) for (let i = 0; i < 8; i++) pShot(x, y, a + i * TAU / 8, { dmg: s.dmg * 0.5, r: 2 });
    for (const f of G.fams) if (f.kind === 'clone') pShot(f.x, f.y - 3, a, Object.assign({}, base));
    if (!isEcho) { if (has('echo')) P.echoQ.push({ t: 0.25, a, x, y }); if (has('double')) P.doubleQ.push({ t: 0.09, a }); }
    AU.sfx('shoot');
  }
  function updatePlayerBullets(dt) {
    const P = G.P;
    for (let i = G.pb.length - 1; i >= 0; i--) {
      const b = G.pb[i]; b.t += dt;
      if (b.orbit) { b.orbit.t -= dt; b.orbit.a += dt * 9; b.x = P.x + Math.cos(b.orbit.a) * 16; b.y = P.y - 3 + Math.sin(b.orbit.a) * 16; if (b.orbit.t <= 0) { const tg = nearestEnemy(b, 400); const a = tg ? ang(b, tg) : b.orbit.a; b.vx = Math.cos(a) * b.sp; b.vy = Math.sin(a) * b.sp; b.orbit = null; b.homing2 = 1; } else { hitEnemies(b); continue; } }
      if (has('homing') || b.homing2 || b.homing3) { const tg = nearestEnemy(b, 130); if (tg) { const want = ang(b, tg), cur = Math.atan2(b.vy, b.vx); let dA = ((want - cur + Math.PI * 3) % TAU) - Math.PI; const na = cur + clamp(dA, -5 * dt, 5 * dt); const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
      if (has('gravity')) for (const e of G.room.ents) if (!e.boss && !e.dead && !e.ally) { const dd = dist(e, b); if (dd < 40 && dd > 4) moveEnt(e, (b.x - e.x) / dd * 30 * dt, (b.y - e.y) / dd * 30 * dt, 'walk'); }
      let ox = 0, oy = 0;
      if (b.helix || has('wave')) { const amp = b.helix ? 7 : 6, w = b.helix ? 14 : 11, nx = -b.vy / (Math.hypot(b.vx, b.vy) || 1), ny = b.vx / (Math.hypot(b.vx, b.vy) || 1); const s0 = Math.sin((b.t - dt) * w + b.ph) * amp, s1 = Math.sin(b.t * w + b.ph) * amp; ox = nx * (s1 - s0); oy = ny * (s1 - s0); }
      const nx = b.x + b.vx * dt + ox, ny = b.y + b.vy * dt + oy, step = Math.hypot(b.vx * dt, b.vy * dt);
      const tx = Math.floor(nx / T), ty = Math.floor(ny / T), tile = CR.tileAt(G.room, tx, ty);
      const spectral = has('spectral') || has('wave');
      if (CR.isBreak(tile) && !spectral) { CR.hitProp(G.room, tx, ty, b.dmg, false); bulletEnd(b, i); continue; }
      if (tile === 1 || ((tile === 2 || tile === 3) && !spectral)) {
        if ((tile === 2) && toolFx('rockBreak')) { G.room.tiles[ty * COLS + tx] = 0; G.room.bgDirty = true; burstFx(tx * T + 8, ty * T + 8, CR.STAGES[G.stage - 1].rock, 10); AU.sfx('hit'); maybeRockDrop(tx, ty); }
        if (b.bounce > 0 && tile !== 2) { b.bounce--; if (CR.tileAt(G.room, Math.floor(nx / T), Math.floor(b.y / T)) !== 0) b.vx = -b.vx; else b.vy = -b.vy; continue; }
        if (has('splitHit') && !b.child) splitShot(b);
        bulletEnd(b, i); continue;
      }
      b.x = nx; b.y = ny; b.trav += step; b.life -= step;
      if (has('burstMid') && !b.mid && b.trav > G.P.st.range * 0.5 && !b.child) { b.mid = 1; for (let k = 0; k < 4; k++) pShot(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 4 + k * Math.PI / 2, { dmg: b.dmg * 0.5, child: 1, r: b.r * 0.7, life: 70 }); }
      if (toolFx('cutBullet')) for (let j = G.eb.length - 1; j >= 0; j--) { const e = G.eb[j]; if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r && Math.random() < toolFx('cutBullet')) { G.eb.splice(j, 1); burstFx(e.x, e.y, '#ffffff', 3); } }
      if (hitEnemies(b)) { G.pb.splice(i, 1); continue; }
      if (b.life <= 0) bulletEnd(b, i, true);
    }
  }
  function bulletEnd(b, i, expired) {
    const P = G.P; if (G.pb[i] === b) G.pb.splice(i, 1);
    if (expired && !b.hitAny && has('deadEye')) P.deadEye = 0;
    if (has('burstEnd') && !b.child) for (let k = 0; k < 8; k++) pShot(b.x, b.y, k * TAU / 8, { dmg: b.dmg * 0.4, child: 1, r: 1.8, life: 55 });
    G.fx.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0, life: 0.18, col: b.col, s: 2, pop: 1 });
  }
  function splitShot(b) { const a = Math.atan2(b.vy, b.vx); for (const o of [Math.PI * 0.75, -Math.PI * 0.75]) pShot(b.x - Math.cos(a) * 3, b.y - Math.sin(a) * 3, a + o, { dmg: b.dmg * 0.5, child: 1, r: b.r * 0.75, life: 90 }); }
  function nearestEnemy(p, maxD) { let best = null, bd = maxD || 1e9; for (const e of G.room.ents) { if (e.dead || e.ally || e.hidden || e.dormant) continue; const dd = dist(e, p); if (dd < bd) { bd = dd; best = e; } } return best; }
  function hitEnemies(b) {
    const P = G.P;
    for (const e of G.room.ents) {
      if (e.dead || e.ally || e.hidden || b.hit.has(e)) continue;
      let hit = dist(e, b) < e.r * (e.scale || 1) + b.r && (!e.z || e.z < 12);
      if (!hit && e.trail) for (let k = 12; k < 96; k += 12) { const p = e.trail[k]; if (Math.hypot(p.x - b.x, p.y - b.y) < 7 + b.r) { hit = true; break; } }
      if (!hit) continue;
      let dmg = b.dmg, crit = Math.random() * 100 < P.st.crit;
      if (crit) dmg *= 2;
      if (has('memory') && G.killedTypes.has(e.def.id)) dmg *= 2;
      if (has('nearDmg') && dist(P, e) < 48) dmg *= 1.5;
      if (has('distDmg')) dmg *= 1 + Math.min(1, b.trav / P.st.range);
      if (has('ramp')) dmg *= Math.pow(1.25, b.hit.size);
      if (has('deadEye')) { dmg *= 1 + 0.1 * P.deadEye; P.deadEye = Math.min(10, P.deadEye + 1); }
      const dealt = hurtEnemy(e, dmg, {}); b.hitAny = 1;
      if (crit) G.fx.push({ txt: 'CRIT', x: e.x, y: e.y - 10, t: 0, life: 0.6, col: '#ffe066' });
      if (dealt > 0) {
        if (has('poison') || (Math.random() < toolFx('procDot') && Math.random() < 0.5)) e.poisonT = 3;
        if (has('bleed') || (Math.random() < toolFx('procDot'))) e.bleedT = Math.max(e.bleedT, 4);
        if (has('slow')) e.slowT = 2;
        if (has('mark')) e.mark = 5;
        if (!e.boss) { const k = (toolFx('knock') ? 2 : 1) * 5; moveEnt(e, b.vx / (b.sp || 150) * k, b.vy / (b.sp || 150) * k, e.def.move === 'fly' ? 'fly' : 'walk'); }
        if (has('chain')) chainZap(e, dmg * 0.6, 3);
      }
      b.hit.add(e);
      if (has('pierce') || b.orbit) continue;
      if (has('splitHit') && !b.child) splitShot(b);
      if (has('burstEnd') && !b.child) for (let k = 0; k < 8; k++) pShot(b.x, b.y, k * TAU / 8, { dmg: b.dmg * 0.4, child: 1, r: 1.8, life: 55 });
      burstFx(b.x, b.y, b.col, 4);
      return true;
    }
    return false;
  }
  function chainZap(from, dmg, n) {
    let cur = from; const done = new Set([from]);
    for (let k = 0; k < n; k++) {
      let nx = null, bd = 75; for (const e of G.room.ents) if (!done.has(e) && !e.dead && !e.ally && !e.hidden) { const dd = dist(e, cur); if (dd < bd) { bd = dd; nx = e; } }
      if (!nx) break; G.fx.push({ bolt: 1, x: cur.x, y: cur.y, x2: nx.x, y2: nx.y, t: 0, life: 0.18, col: '#a6e8ff' }); hurtEnemy(nx, dmg, { dot: 1 }); done.add(nx); cur = nx;
    }
    if (n) AU.sfx('zap');
  }

  /* ───────── 적 탄환 · 광선 · 장판 · 폭탄 ───────── */
  function updateEnemyBullets(dt) {
    const P = G.P;
    for (let i = G.eb.length - 1; i >= 0; i--) {
      const b = G.eb[i]; b.t += dt;
      if (b.orb) { b.orb.a += dt * 3; b.x = b.orb.o.x + Math.cos(b.orb.a) * b.orb.r; b.y = b.orb.o.y + Math.sin(b.orb.a) * b.orb.r; if (b.orb.o.dead) b.orb = null; }
      else {
        if (b.homing && b.t < b.homing) { const want = ang(b, P), cur = Math.atan2(b.vy, b.vx); let dA = ((want - cur + Math.PI * 3) % TAU) - Math.PI; const na = cur + clamp(dA, -2.2 * dt, 2.2 * dt), sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
        const m = G.slowAll > 0 ? 0.4 : 1; b.x += b.vx * dt * m; b.y += b.vy * dt * m;
        const tile = CR.tileAt(G.room, Math.floor(b.x / T), Math.floor(b.y / T));
        if (tile === 1 || tile === 2 || tile === 3 || CR.isBreak(tile) || b.t > b.life) { if (b.web) creep(b.x, b.y, 10, 5, 'web'); G.eb.splice(i, 1); G.fx.push({ x: b.x, y: b.y, vx: 0, vy: 0, t: 0, life: 0.15, col: b.col, s: 2, pop: 1 }); continue; }
      }
      // 수호 동료가 막아 줌
      let blockedByFam = false; for (const f of G.fams) if ((f.kind === 'guard') && Math.hypot(f.x - b.x, f.y - b.y) < 8) { blockedByFam = true; break; }
      if (blockedByFam) { G.eb.splice(i, 1); burstFx(b.x, b.y, '#e8d6ff', 3); continue; }
      if (Math.hypot(b.x - P.x, b.y - (P.y - 2)) < b.r + P.r) {
        if (hurtPlayer(1)) { if (b.push) { P.vx += b.vx * 2.2; P.vy += b.vy * 2.2; } if (b.slowShot) P.room.slowed = 1.6; }
        G.eb.splice(i, 1);
      }
    }
  }
  function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1; let t = ((px - x1) * dx + (py - y1) * dy) / l2; t = clamp(t, 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
  function updateLasers(dt) {
    const P = G.P;
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const L = G.lasers[i]; L.t += dt;
      if (L.follow) { if (L.follow.dead) { G.lasers.splice(i, 1); continue; } L.x = L.follow.x; L.y = L.follow.y; }
      if (L.spin && L.t > L.tele) L.a += L.spin * dt;
      L.len = rayLen(L.x, L.y, L.a);
      if (L.t > L.tele + L.act) { G.lasers.splice(i, 1); continue; }
      if (L.t > L.tele) {
        const x2 = L.x + Math.cos(L.a) * L.len, y2 = L.y + Math.sin(L.a) * L.len;
        if (L.owner === 'e') { if (segDist(P.x, P.y - 2, L.x, L.y, x2, y2) < L.w / 2 + P.r - 1) hurtPlayer(L.big ? 2 : 1); }
        else { L.tick = (L.tick || 0) - dt; if (L.tick <= 0) { L.tick = 0.1; for (const e of G.room.ents) if (!e.dead && !e.ally && segDist(e.x, e.y, L.x, L.y, x2, y2) < L.w / 2 + e.r * (e.scale || 1)) hurtEnemy(e, L.dmg, { dot: 1 }); } }
        if (!L.snd) { L.snd = 1; AU.sfx('laser'); }
      }
    }
  }
  function updateCreeps(dt) {
    const P = G.P, immune = has('creepImmune') || P.room.antitox;
    for (let i = G.creeps.length - 1; i >= 0; i--) {
      const c = G.creeps[i]; c.t += dt; if (c.t > c.life) { G.creeps.splice(i, 1); continue; }
      if (c.delay && c.t < c.delay) continue;
      const onP = Math.hypot(P.x - c.x, P.y - c.y) < c.r;
      if ((c.kind === 'acid' || c.kind === 'cloud') && onP && !immune && (!has('flight') || c.kind === 'cloud')) hurtPlayer(1, 'creep');
      if (c.kind === 'web' && onP && !has('flight')) P.room.slowed = Math.max(P.room.slowed || 0, 0.2);
      if (c.kind === 'pacid' || c.kind === 'radio' || c.kind === 'pweb') { c.tk = (c.tk || 0) - dt; if (c.tk <= 0) { c.tk = 0.3; for (const e of G.room.ents) if (!e.dead && !e.ally && Math.hypot(e.x - c.x, e.y - c.y) < c.r + e.r) { if (c.kind === 'pweb') e.slowT = 1; else hurtEnemy(e, c.kind === 'radio' ? 3 : Math.max(1.5, P.st.dmg * 0.35), { dot: 1, col: '#9ef07a' }); } } }
    }
  }
  function explosion(x, y, R, dmgEnemy, o) {
    o = o || {}; AU.sfx('boom'); G.shake = Math.max(G.shake, 7); explodeFx(x, y, R, '#ffb347');
    for (const e of G.room.ents) if (!e.dead && !e.ally && dist(e, { x, y }) < R + e.r) hurtEnemy(e, dmgEnemy || 40, {});
    if (!o.noPlayer && Math.hypot(G.P.x - x, G.P.y - y) < R + G.P.r && !o.playerImmune) hurtPlayer(o.enemy ? 1 : 1, 'boom');
    const t0x = Math.floor((x - R) / T), t1x = Math.floor((x + R) / T), t0y = Math.floor((y - R) / T), t1y = Math.floor((y + R) / T);
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      if (Math.hypot(tx * T + 8 - x, ty * T + 8 - y) > R + 6) continue;
      const tv = CR.tileAt(G.room, tx, ty);
      if (tv === 2) { G.room.tiles[ty * COLS + tx] = 0; G.room.bgDirty = true; burstFx(tx * T + 8, ty * T + 8, CR.STAGES[G.stage - 1].rock, 8); maybeRockDrop(tx, ty); }
      else if (CR.isBreak(tv)) CR.hitProp(G.room, tx, ty, 999, true);
    }
    for (const d in G.room.doors) { const dr = G.room.doors[d]; if (dr.hidden) { const [tx, ty] = CR.DOOR_TILE[d]; if (Math.hypot(tx * T + 8 - x, ty * T + 8 - y) < R + 14) revealSecret(G.room, d); } }
  }
  CR.explosion = explosion;
  function revealSecret(room, d) {
    const dr = room.doors[d]; if (!dr || !dr.hidden) return; dr.hidden = false;
    const o = G.floor.rooms.get(dr.to); if (o) { o.revealed = true; o.seen = true; const back = o.doors[CR.OPP[d]]; if (back) back.hidden = false; }
    AU.sfx('door'); toast('숨은 방 발견!', '폭발로 벽 너머의 숨은 방이 드러났어요', '#c8b48a');
  }
  function maybeRockDrop(tx, ty) { if (Math.random() < 0.04) dropPickup(Math.random() < 0.5 ? 'coin' : 'bomb', tx * T + 8, ty * T + 8); }
  function updateBombs(dt) {
    for (let i = G.bombs.length - 1; i >= 0; i--) {
      const b = G.bombs[i]; b.t -= dt; if (Math.floor(b.t * 8) !== Math.floor((b.t + dt) * 8)) AU.sfx('fuse');
      if (b.t > 0) continue; G.bombs.splice(i, 1);
      const R = b.big ? 44 : 32, D = b.big ? 70 : 45;
      explosion(b.x, b.y, R, D, { playerImmune: b.thrown });
      if (has('bombBurst') && !b.mini) for (let k = 0; k < 8; k++) pShot(b.x, b.y, k * TAU / 8, { dmg: 6, col: '#ff9ad5', child: 1 });
      if (has('bombScatter') && !b.mini) for (let k = 0; k < 3; k++) G.bombs.push({ x: b.x + Math.cos(k * 2.1) * 26, y: b.y + Math.sin(k * 2.1) * 26, t: 0.35, mini: 1, thrown: 1 });
      if (has('bombWeb')) creep(b.x, b.y, 30, 6, 'pweb');
    }
  }

  /* ───────── 동료 ───────── */
  function spawnFamiliars() {
    const P = G.P; if (!P) return; const keep = G.fams.filter(f => f.kind === 'clone' && f.roomKey === (G.room && G.room.key)); G.fams = keep;
    const add = (kind, o) => G.fams.push(Object.assign({ kind, x: P.x, y: P.y, t: 0, a: Math.random() * TAU, cd: 0 }, o || {}));
    if (has('famShooter')) add('shooter');
    if (has('famGuard')) add('guard');
    if (has('famSeeker')) add('seeker');
    if (has('famCreep')) add('creepy');
    if (has('famMicrobe')) { add('microbe', { a: 0 }); add('microbe', { a: Math.PI }); }
    if (has('laserRing')) add('ring');
  }
  CR.spawnFamiliars = spawnFamiliars;
  function updateFams(dt) {
    const P = G.P; let trailI = 0;
    for (const f of G.fams) {
      f.t += dt; f.cd -= dt;
      if (f.kind === 'shooter' || f.kind === 'creepy') { trailI++; const tx = P.x - Math.cos(P.aimA) * 14 * trailI, ty = P.y + 6 * trailI; f.x += (tx - f.x) * 5 * dt; f.y += (ty - f.y) * 5 * dt;
        if (f.kind === 'shooter' && P.shooting && f.cd <= 0) { f.cd = 0.9; pShot(f.x, f.y, P.aimA, { dmg: 3.5, r: 2, col: '#ffe08a' }); }
        if (f.kind === 'creepy' && f.cd <= 0) { f.cd = 0.4; creep(f.x, f.y, 8, 2.5, 'pacid', { col: '#80c8ff' }); } }
      else if (f.kind === 'guard') { f.a += dt * 2.2; f.x = P.x + Math.cos(f.a) * 22; f.y = P.y - 2 + Math.sin(f.a) * 22; touchDmg(f, 7, 4, 0.25); }
      else if (f.kind === 'microbe') { f.a += dt * 3; f.x = P.x + Math.cos(f.a) * 15; f.y = P.y - 2 + Math.sin(f.a) * 15; touchDmg(f, 5, 3, 0.3, true); }
      else if (f.kind === 'seeker') { const tg = nearestEnemy(f, 999); const a = tg ? ang(f, tg) : ang(f, P); if (tg && dist(f, tg) < tg.r + 3) { f.x = tg.x; f.y = tg.y - 3; tg.slowT = 0.5; touchDmg(f, 8, 3, 0.3); } else moveEnt(f, Math.cos(a) * 80 * dt, Math.sin(a) * 80 * dt, 'fly'); f.r = 3; }
      else if (f.kind === 'ring') { f.a += dt * 3; f.cd2 = (f.cd2 || 0) - dt; if (f.cd2 <= 0) { f.cd2 = 0.2; for (const e of G.room.ents) if (!e.dead && !e.ally && Math.abs(dist(e, P) - 26) < 6 + e.r) hurtEnemy(e, Math.max(2, P.st.dmg * 0.5), { dot: 1 }); } }
      else if (f.kind === 'clone') { f.x += (P.x + 18 - f.x) * 6 * dt; f.y += (P.y - f.y) * 6 * dt; }
    }
  }
  function touchDmg(f, R, dmg, cd, poison) { f.tk = (f.tk || 0) - 1 / 60; if (f.tk > 0) return; for (const e of G.room.ents) if (!e.dead && !e.ally && dist(e, f) < R + e.r) { hurtEnemy(e, dmg, { dot: 1 }); if (poison) e.poisonT = 3; f.tk = cd; } }

  /* ───────── 플레이어 피해·회복 ───────── */
  function hurtPlayer(n, src) {
    const P = G.P; if (P.invuln > 0 || G.god || G.mode !== 'play' || P.room.vaccine) return false;
    if (src === 'contact' && Math.random() < toolFx('contactGuard')) return false;
    if (has('roomGuard') && !P.guardUsed) { P.guardUsed = true; P.invuln = 0.8; G.fx.push({ ring: 1, x: P.x, y: P.y, r0: 4, r1: 18, t: 0, life: 0.3, col: '#ffe08a' }); AU.sfx('tink'); return true; }
    G.hurtBy = G.hurtBy || {}; const hk = (src || 'shot') + (G.room.ents.find(e => !e.dead && dist(e, P) < e.r + P.r + 2) ? ':' + G.room.ents.find(e => !e.dead && dist(e, P) < e.r + P.r + 2).def.id : ''); G.hurtBy[hk] = (G.hurtBy[hk] || 0) + n;
    let left = n; if (P.shield > 0) { const s = Math.min(P.shield, left); P.shield -= s; left -= s; }
    P.hp -= left; P.invuln = 1.0 + toolFx('invuln'); G.shake = 5; AU.sfx('hurt');
    if (has('rageHit')) P.rage++;
    if (has('hurtBurst')) { for (let k = 0; k < 8; k++) pShot(P.x, P.y, k * TAU / 8, { dmg: P.st.dmg, child: 1 }); creep(P.x, P.y, 26, 4, 'pweb'); }
    const sh = toolFx('hurtShock'); if (sh) { for (const e of G.room.ents) if (!e.dead && !e.ally && dist(e, P) < 70) { hurtEnemy(e, sh, { dot: 1 }); G.fx.push({ bolt: 1, x: P.x, y: P.y, x2: e.x, y2: e.y, t: 0, life: 0.2, col: '#ffe36b' }); } AU.sfx('zap'); }
    if (Math.random() < toolFx('hurtCoin')) dropPickup('coin', P.x, P.y + 10);
    calcStats();
    if (P.hp <= 0) {
      if (has('revive') && !P.revived) { P.revived = true; P.maxHp = Math.max(P.maxHp, 6); P.hp = 6; P.invuln = 2.5; G.eb = []; toast('역분화 인자 발동!', '다시 태어났어요 — 체력 3칸', '#fff07a'); AU.sfx('heal'); burstFx(P.x, P.y, '#fff07a', 30); calcStats(); }
      else gameOver(false);
    }
    return true;
  }
  CR.hurtPlayer = hurtPlayer;
  function heal(n) { const P = G.P; const before = P.hp; P.hp = Math.min(P.maxHp, P.hp + n); if (P.hp > before) { G.fx.push({ txt: '+', x: P.x, y: P.y - 14, t: 0, life: 0.5, col: '#ff6b81' }); calcStats(); } }
  CR.heal = heal;

  /* ───────── 액티브 · 진단서 · 호르몬 ───────── */
  function allFoes() { return G.room.ents.filter(e => !e.dead && !e.ally && !e.hidden); }
  const ACT = {
    A01() { allFoes().forEach(e => { hurtEnemy(e, 40); e.bleedT = 4; G.fx.push({ bolt: 1, x: G.P.x, y: G.P.y, x2: e.x, y2: e.y, t: 0, life: 0.25, col: '#7fd4ff' }); }); AU.sfx('zap'); },
    A02() { G.P.shield = Math.min(24 - G.P.maxHp, G.P.shield + 2); AU.sfx('shield'); },
    A03() { G.P.room.dmg = (G.P.room.dmg || 0) + 2.5; G.P.room.rate = (G.P.room.rate || 0) + 1.5; AU.sfx('power'); },
    A04() { allFoes().forEach(e => { hurtEnemy(e, 30); e.stunT = 3; G.fx.push({ bolt: 1, x: G.P.x, y: G.P.y, x2: e.x, y2: e.y, t: 0, life: 0.3, col: '#ffe36b' }); }); AU.sfx('zap'); G.shake = 6; },
    A05() { allFoes().forEach(e => { const a = ang(G.P, e); for (let k = 0; k < 10; k++) moveEnt(e, Math.cos(a) * 9, Math.sin(a) * 9, e.boss ? 'fly' : 'walk'); hurtEnemy(e, 15); }); G.fx.push({ ring: 1, x: G.P.x, y: G.P.y, r0: 6, r1: 140, t: 0, life: 0.4, col: '#e0e8f0' }); AU.sfx('boom'); },
    A06() { dupPickups(); },
    A07() { let n = 0; G.room.items.forEach(p => { if (!p.taken && p.id && !p.pk) { const k = CR.ALL[p.id].kind; p.id = k === 'active' ? (takeFrom('active') || p.id) : rollItem(G.room.type === 'lab' ? 'lab' : 'treasure'); n++; burstFx(p.x, p.y, '#d68cff', 12); } }); if (!n) toast('바꿀 아이템이 없어요', '받침대 위 아이템이 있는 방에서 쓰세요', '#ff9e9e'); AU.sfx('power'); },
    A08() { G.creeps = G.creeps.filter(c => !['acid', 'cloud', 'web'].includes(c.kind)); heal(2); AU.sfx('heal'); },
    A09() { for (let i = 0; i < G.room.tiles.length; i++) { if (G.room.tiles[i] === 2) G.room.tiles[i] = 0; else if (CR.isBreak(G.room.tiles[i])) CR.hitProp(G.room, i % COLS, Math.floor(i / COLS), 999, true); } G.room.bgDirty = true; for (const d in G.room.doors) revealSecret(G.room, d); G.shake = 6; AU.sfx('boom'); },
    A10() { G.P.room.vaccine = 5; AU.sfx('shield'); },
    A11() { for (let i = 0; i < 4; i++) G.room.ents.push(mkEnemy(CR.MINIS.ally, G.P.x + rand(-12, 12), G.P.y + rand(-12, 12), { ally: 1, life: 14 })); AU.sfx('power'); },
    A12() { revealMap(); for (const r of G.floor.rooms.values()) if (r.type === 'secret') r.revealed = true; G.room.weak = 1; AU.sfx('power'); },
    A13() { const P = G.P; if (P.hp <= 1) { toast('체력이 부족해요', '체력이 반 칸보다 많을 때 쓸 수 있어요', '#ff9e9e'); return false; } P.hp -= 1; for (let i = 0; i < ri(2, 4); i++) dropPickup('coin', P.x, P.y + 8); AU.sfx('coin'); calcStats(); },
    A14() { const P = G.P; const b = { x: P.x, y: P.y, t: 0.9, big: 1, thrown: 1, vx: Math.cos(P.aimA) * 180, vy: Math.sin(P.aimA) * 180 }; G.bombs.push(b); AU.sfx('bombpick'); },
    A15() { const P = G.P; if (P.maxHp <= 2) { toast('최대 체력이 부족해요', '', '#ff9e9e'); return false; } P.maxHp -= 2; P.hp = Math.min(P.hp, P.maxHp); P.bonus.dmg += 1; P.bonus.speed += 0.15; calcStats(); AU.sfx('power'); },
    A16() { dropPickup('hormone', G.P.x, G.P.y + 14, CR.HORMONES[ri(0, 7)].id); AU.sfx('key'); },
    A17() { dropPickup('chart', G.P.x, G.P.y + 14, CR.CHARTS[ri(0, 9)].id); AU.sfx('key'); },
    A18() { allFoes().forEach(e => (e.freezeT = 4)); AU.sfx('freeze'); },
    A19() { creep(RW / 2, RH / 2, 220, 6, 'radio'); AU.sfx('power'); },
    A20() { heal(4); AU.sfx('heal'); },
    A21() { const P = G.P; laser(P.x, P.y - 3, P.aimA, { owner: 'p', tele: 0.05, act: 0.6, w: 12, dmg: Math.max(6, P.st.dmg * 2.2), col: '#5ad1ff', follow: P }); AU.sfx('laser'); },
    A22() { allFoes().forEach(e => { e.bleedT = 6; e.slowT = 5; }); AU.sfx('power'); },
    A23() { G.P.room.pace = 8; G.P.room.rateMul = 2; calcStats(); AU.sfx('power'); },
    A24() { allFoes().forEach(e => { if (e.boss) hurtEnemy(e, e.maxHp * 0.2); else { e.revived = true; e.hp = 0; killEnemy(e); } }); G.shake = 8; AU.sfx('boom'); },
    A25() { const fs = allFoes(); for (let i = 0; i < 6; i++) { const e = fs.length ? fs[i % fs.length] : null, p = e ? { x: e.x + rand(-4, 4), y: e.y + rand(-4, 4) } : freeSpot(0); setTimeout(() => { if (G.mode !== 'play') return; G.fx.push({ pillar: 1, x: p.x, y: p.y, t: 0, life: 0.4, col: '#efe0ff' }); for (const o of allFoes()) if (dist(o, p) < 16 + o.r) hurtEnemy(o, 30); AU.sfx('laser'); }, i * 160); } },
    A26() { G.slowAll = 8; AU.sfx('freeze'); },
    A27() { for (const d in G.room.doors) { const dr = G.room.doors[d]; dr.locked = false; const o = G.floor.rooms.get(dr.to); if (o && o.doors[CR.OPP[d]]) o.doors[CR.OPP[d]].locked = false; revealSecret(G.room, d); } AU.sfx('key'); },
    A28() { G.fams.push({ kind: 'clone', x: G.P.x + 18, y: G.P.y, t: 0, roomKey: G.room.key }); AU.sfx('power'); },
    A29() { G.eb = []; G.P.room.antitox = 1; heal(1); AU.sfx('heal'); },
    A30() { const P = G.P; G.eb = G.eb.filter(b => { const a = Math.abs(((ang(P, b) - P.aimA + Math.PI * 3) % TAU) - Math.PI); return !(a < 0.8 && dist(P, b) < 120); }); allFoes().forEach(e => { const a = Math.abs(((ang(P, e) - P.aimA + Math.PI * 3) % TAU) - Math.PI); if (a < 0.8 && dist(P, e) < 120) hurtEnemy(e, 12); }); G.fx.push({ cone: 1, x: P.x, y: P.y, a: P.aimA, t: 0, life: 0.25 }); AU.sfx('zap'); },
  };
  function useActive() {
    const P = G.P; if (!P.active) return;
    const def = CR.ALL[P.active.id]; if (P.active.charge < P.active.max) { AU.sfx('tink'); return; }
    const r = ACT[def.id] ? ACT[def.id]() : null; if (r === false) return;
    P.active.charge = 0; calcStats();
    G.fx.push({ txt: def.name, x: P.x, y: P.y - 18, t: 0, life: 1, col: def.col, ko: 1 });
  }
  CR.useActive = useActive;
  function dupPickups() { const add = []; G.room.pickups.forEach(p => { if (['coin', 'bomb', 'key', 'heart', 'half', 'shield'].includes(p.kind)) add.push({ kind: p.kind, x: p.x + rand(-10, 10), y: p.y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-30, 30), t: 0 }); }); G.room.pickups.push(...add); burstFx(G.P.x, G.P.y, '#8fffcf', 14); AU.sfx('power'); if (!add.length) toast('복제할 물건이 없어요', '', '#ff9e9e'); }
  const CHART = {
    C01() { enterRoom(G.floor.start, null); G.fade = 0.4; AU.sfx('stairs'); },
    C02() { G.P.room.dmg = (G.P.room.dmg || 0) + 3; G.P.room.speed = (G.P.room.speed || 0) + 0.5; AU.sfx('power'); },
    C03() { return teleportTo('boss'); }, C04() { return teleportTo('shop'); }, C05() { return teleportTo('treasure'); },
    C06() { const P = G.P; P.hp = P.maxHp; allFoes().forEach(e => hurtEnemy(e, 100)); revealMap(); AU.sfx('heal'); G.fx.push({ ring: 1, x: P.x, y: P.y, r0: 6, r1: 200, t: 0, life: 0.6, col: '#fff7c0' }); },
    C07() { G.P.room.dmgMul = 2; calcStats(); const r = CR.addLab(G.floor, Math.random); if (r) { enterRoom(r.key, null); G.P.room.dmgMul = 2; calcStats(); G.fade = 0.4; } AU.sfx('power'); },
    C08() { allFoes().forEach(e => hurtEnemy(e, 60)); G.shake = 6; AU.sfx('boom'); },
    C09() { dupPickups(); },
    C10() { const P = G.P; pShot(P.x, P.y, P.aimA, { dmg: 220, r: 5, col: '#ffe066', card: 1, life: 400 }); P.flags.pierceCard = 0; AU.sfx('power'); },
  };
  const HORM = {
    H01() { G.P.bonus.speed += 0.25; G.P.bonus.rate += 0.3; }, H02() { heal(4); }, H03() { G.P.bonus.dmg += 0.6; }, H04() { G.P.bonus.range += 50; G.P.bonus.sspd += 0.2; },
    H05() { G.P.shield = Math.min(24 - G.P.maxHp, G.P.shield + 2); },
    H06() { if (!has('statLock')) G.P.bonus.rate -= 0.2; }, H07() { if (!has('statLock')) G.P.hp = Math.max(1, G.P.hp - 1); }, H08() { if (!has('statLock')) G.P.bonus.speed -= 0.15; },
  };
  function useCons() {
    const P = G.P; if (!P.cons.length) return;
    const id = P.cons[0], def = CR.ALL[id];
    const r = def.kind === 'chart' ? CHART[id]() : (HORM[id](), null);
    if (r === false) return;
    P.cons.shift(); calcStats();
    if (def.kind === 'hormone') { AU.sfx(def.good ? 'heal' : 'bad'); toast(def.name, def.desc, def.good ? '#9dffb0' : '#ff9e9e'); }
    else toast(def.name, def.desc, def.col);
  }
  CR.useCons = useCons;

  /* ───────── 줍기 · 받침대 · 상점 ───────── */
  function updatePickups(dt) {
    const P = G.P, mag = toolFx('magnet');
    for (let i = G.room.pickups.length - 1; i >= 0; i--) {
      const p = G.room.pickups[i]; p.t += dt;
      const tmp = { x: p.x, y: p.y, r: 4 }; moveEnt(tmp, p.vx * dt, p.vy * dt, 'walk'); p.x = tmp.x; p.y = tmp.y; p.vx *= 0.9; p.vy *= 0.9;
      const dd = Math.hypot(P.x - p.x, P.y - p.y);
      if (p.lock) { if (dd > 20) p.lock = false; else continue; }
      if (mag && dd < 90 && dd > 4) { p.x += (P.x - p.x) / dd * 90 * dt; p.y += (P.y - p.y) / dd * 90 * dt; }
      if (dd > P.r + 6 || p.t < 0.3) continue;
      if (collect(p)) G.room.pickups.splice(i, 1);
    }
    for (const it of G.room.items) {
      if (it.taken) continue;
      if (Math.hypot(P.x - it.x, P.y - it.y) > P.r + 8) { it.touch = false; continue; }
      if (it.touch) continue; it.touch = true;
      if (it.price && P.coins < it.price) { if (!it.warned) { toast('ATP 코인이 부족해요', it.price + '코인이 필요해요', '#ff9e9e'); it.warned = 1; } continue; }
      if (it.hpCost && P.maxHp <= it.hpCost) { toast('최대 체력이 부족해요', '체력 1칸을 내고 가져가는 아이템이에요', '#ff9e9e'); continue; }
      if (it.pk) { if (it.pk === 'heart' && P.hp >= P.maxHp) continue; P.coins -= it.price; it.taken = true; collect({ kind: it.pk }); continue; }
      if (it.price) P.coins -= it.price;
      if (it.hpCost) { P.maxHp -= it.hpCost; P.hp = Math.min(P.hp, P.maxHp); }
      it.taken = true; applyItem(it.id);
      if (it.group) G.room.items.forEach(o => { if (o !== it && o.group === it.group) { o.taken = true; burstFx(o.x, o.y, '#ff3d6e', 10); } });
    }
  }
  // 버리기: F = 진단서·호르몬, G = 수술도구 (터치 [버리기]는 진단서·호르몬 먼저)
  function dropCons() { const P = G.P; if (!P.cons.length) return false; const id = P.cons.shift(); const pk = dropPickup(CR.ALL[id].kind, P.x, P.y + 10, id); pk.lock = true; pk.vx = pk.vy = 0; toast('버렸어요: ' + CR.ALL[id].name, '다시 가까이 가면 주울 수 있어요', '#cfc6ea'); AU.sfx('door'); return true; }
  function dropTool() { const P = G.P; if (!P.tools.length) return false; const id = P.tools.pop(); const pk = dropPickup('tool', P.x, P.y + 10, id); pk.lock = true; pk.vx = pk.vy = 0; calcStats(); toast('버렸어요: ' + CR.ALL[id].name, '다시 가까이 가면 주울 수 있어요', '#cfc6ea'); AU.sfx('door'); return true; }
  CR.dropCons = dropCons; CR.dropTool = dropTool;
  // 먹기 전 미리보기: 가까운 받침대 아이템·장신구·알약·카드
  function findPeek() {
    const P = G.P; let best = null, bd = 1e9;
    for (const it of G.room.items) { if (it.taken) continue; const d = Math.hypot(P.x - it.x, P.y - it.y); if (d < 38 && d < bd) { bd = d; best = { x: it.x, y: it.y - 14, id: it.id, pk: it.pk, price: it.price, hpCost: it.hpCost }; } }
    for (const p of G.room.pickups) { if (!['tool', 'chart', 'hormone'].includes(p.kind)) continue; const d = Math.hypot(P.x - p.x, P.y - p.y); if (d < 30 && d < bd) { bd = d; best = { x: p.x, y: p.y - 10, id: p.id, floor: 1 }; } }
    if (!best) best = CR.propPeek(G.room, P);
    return best;
  }
  function collect(p) {
    const P = G.P;
    switch (p.kind) {
      case 'coin': P.coins = Math.min(99, P.coins + 1); AU.sfx('coin'); break;
      case 'bomb': P.bombs = Math.min(99, P.bombs + 1); AU.sfx('bombpick'); break;
      case 'key': P.keys = Math.min(99, P.keys + 1); AU.sfx('key'); break;
      case 'heart': case 'half': if (P.hp >= P.maxHp) return false; heal(p.kind === 'heart' ? 2 : 1); AU.sfx('heart'); break;
      case 'shield': if (P.maxHp + P.shield >= 24) return false; P.shield += 2; AU.sfx('shield'); break;
      case 'chart': case 'hormone': case 'tool': applyItem(p.id); break;
      default: return false;
    }
    return true;
  }

  /* ───────── 이펙트 ───────── */
  function burstFx(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(20, 90); G.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.25, 0.6), col, s: Math.random() < 0.3 ? 2 : 1 }); } }
  function explodeFx(x, y, R, col) { G.fx.push({ ring: 1, x, y, r0: 3, r1: R, t: 0, life: 0.3, col: '#fff2c0' }); burstFx(x, y, col, 22); G.fx.push({ splat: 1, x, y, t: 0, life: 6, col: 'rgba(20,10,10,0.35)', r: R * 0.5 }); }
  CR.burstFx = burstFx;

  /* ───────── 메인 업데이트 ───────── */
  function update(dt) {
    G.tick++;
    if (G.mode !== 'play') return;
    if (G.intro) { G.intro.t -= dt; if (G.intro.t <= 0) { G.intro = null; if (CR.ui) CR.ui.bossIntro(null); } return; }
    G.time += dt;
    const P = G.P;
    if (G.slowAll > 0) G.slowAll -= dt;
    if (G.fade > 0) G.fade -= dt;
    if (P.invuln > 0) P.invuln -= dt;
    if (P.room.vaccine > 0) { P.room.vaccine -= dt; for (const e of allFoes()) if (dist(e, P) < e.r + P.r + 3) { e.vT = (e.vT || 0) - dt; if (e.vT <= 0) { e.vT = 0.2; hurtEnemy(e, 10); } } if (P.room.vaccine <= 0) P.room.vaccine = 0; }
    if (P.room.pace > 0) { P.room.pace -= dt; if (P.room.pace <= 0) { P.room.pace = 0; P.room.rateMul = 0; calcStats(); } }
    if (P.room.slowed > 0) P.room.slowed -= dt;
    // 이동
    let mx = 0, my = 0;
    if (IN.keys.a) mx -= 1; if (IN.keys.d) mx += 1; if (IN.keys.w) my -= 1; if (IN.keys.s) my += 1;
    if (IN.stickL) { mx = IN.stickL.x; my = IN.stickL.y; if (Math.hypot(mx, my) < 0.2) mx = my = 0; }
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const spd = 88 * P.st.speed * (P.room.slowed > 0 ? 0.55 : 1);
    P.vx += (mx * spd - P.vx) * Math.min(1, dt * 12); P.vy += (my * spd - P.vy) * Math.min(1, dt * 12);
    const pm = has('flight') ? 'pfly' : 'player';
    moveEnt(P, P.vx * dt, P.vy * dt, pm);
    if (has('giant')) { const tx = Math.floor((P.x + Math.sign(P.vx) * (P.r + 2)) / T), ty = Math.floor(P.y / T); if (CR.tileAt(G.room, tx, ty) === 2 && Math.abs(P.vx) > 20) { G.room.tiles[ty * COLS + tx] = 0; G.room.bgDirty = true; burstFx(tx * T + 8, ty * T + 8, CR.STAGES[G.stage - 1].rock, 8); AU.sfx('hit'); } }
    if (Math.hypot(P.vx, P.vy) > 15) { P.walkT += dt; if (Math.abs(P.vx) > Math.abs(P.vy)) P.dir = P.vx > 0 ? 'right' : 'left'; else P.dir = P.vy > 0 ? 'down' : 'up';
      if (has('trailCreep')) { P.trT = (P.trT || 0) - dt; if (P.trT <= 0) { P.trT = 0.25; creep(P.x, P.y + 3, 7, 2.2, 'pacid', { col: '#e6ff8a' }); } } }
    if (!has('flight') && !has('creepImmune') && CR.fireTouch(G.room, P)) hurtPlayer(1, 'fire');
    // 가시
    if (!has('flight') && !has('creepImmune') && CR.tileAt(G.room, Math.floor(P.x / T), Math.floor(P.y / T)) === 4) hurtPlayer(1, 'spike');
    // 문 통과
    if (P.x < 6) goThroughDoor('l'); else if (P.x > RW - 6) goThroughDoor('r'); else if (P.y < 6) goThroughDoor('u'); else if (P.y > RH - 6) goThroughDoor('d');
    // 잠긴 문: 열쇠로 열기
    for (const d in G.room.doors) { const dr = G.room.doors[d]; if (!dr.locked || !G.room.cleared) continue; const [tx, ty] = CR.DOOR_TILE[d]; if (Math.hypot(P.x - (tx * T + 8), P.y - (ty * T + 8)) < 20) { if (P.keys > 0) { P.keys--; dr.locked = false; const o = G.floor.rooms.get(dr.to); if (o && o.doors[CR.OPP[d]]) o.doors[CR.OPP[d]].locked = false; AU.sfx('key'); } else if (!dr.warned) { dr.warned = 1; toast('잠긴 문', '제한효소 열쇠가 있어야 열 수 있어요', '#f2c94c'); } } }
    // 조준·사격
    let aim = null;
    if (IN.keys.ArrowLeft) aim = Math.PI; else if (IN.keys.ArrowRight) aim = 0; else if (IN.keys.ArrowUp) aim = -Math.PI / 2; else if (IN.keys.ArrowDown) aim = Math.PI / 2;
    if (IN.mouse.down) aim = Math.atan2(IN.mouse.y - RY - (P.y - 3), IN.mouse.x - RX - P.x);
    if (IN.stickR && Math.hypot(IN.stickR.x, IN.stickR.y) > 0.3) aim = Math.atan2(IN.stickR.y, IN.stickR.x);
    P.shooting = aim !== null; P.fireCd -= dt;
    if (aim !== null) { P.aimA = aim; const dg = ((aim * 180 / Math.PI) + 360) % 360; P.dir = dg > 315 || dg < 45 ? 'right' : dg < 135 ? 'down' : dg < 225 ? 'left' : 'up';
      if (P.fireCd <= 0) { P.fireCd = 1 / P.st.rate; P.shootT = 0.12; fire(aim); } }
    if (P.shootT > 0) P.shootT -= dt;
    for (let i = P.echoQ.length - 1; i >= 0; i--) { const q = P.echoQ[i]; q.t -= dt; if (q.t <= 0) { fire(q.a, q.x, q.y, true); P.echoQ.splice(i, 1); } }
    for (let i = P.doubleQ.length - 1; i >= 0; i--) { const q = P.doubleQ[i]; q.t -= dt; if (q.t <= 0) { fire(q.a, null, null, true); P.doubleQ.splice(i, 1); } }
    // 버튼
    if (IN.take(' ')) useActive();
    if (IN.take('q')) useCons();
    if (IN.take('f')) dropCons();
    if (IN.take('g')) dropTool();
    if (IN.take('x')) { if (!dropCons()) dropTool(); }
    if (IN.take('e') && P.bombs > 0) { P.bombs--; G.bombs.push({ x: P.x, y: P.y + 2, t: 1.5 }); AU.sfx('bombpick'); }
    // 던진 폭탄 이동
    for (const b of G.bombs) if (b.vx) { const tmp = { x: b.x, y: b.y, r: 4 }; if (moveEnt(tmp, b.vx * dt, b.vy * dt, 'walk')) { b.vx = 0; b.vy = 0; } b.x = tmp.x; b.y = tmp.y; b.vx *= 0.97; b.vy *= 0.97; }
    // 개체
    for (const e of G.room.ents) (e.boss ? updateBoss : updateEnemy)(e, dt);
    // 폐렴구균 쌍둥이 피막 광선
    for (const e of G.room.ents) if (e.mate && !e.dead && !e.mate.dead && e.def.tether && segDist(P.x, P.y, e.x, e.y, e.mate.x, e.mate.y) < 3 + P.r) hurtPlayer(1);
    G.room.ents = G.room.ents.filter(e => !e.dead || e.dormant);
    G.peek = findPeek();
    updateFams(dt); updatePlayerBullets(dt); updateEnemyBullets(dt); updateLasers(dt); updateCreeps(dt); updateBombs(dt); updatePickups(dt);
    for (const f of G.fx) if (f.ring && f.hurt) { const r = f.r0 + (f.r1 - f.r0) * (f.t / f.life), dd = dist(f, P); if (Math.abs(dd - r) < 5) hurtPlayer(1); }
    // 방 정리
    if (!G.room.cleared && !G.room.ents.some(e => !e.ally && !e.dead)) onClear();
    if (G.room.cleared && G.room.ents.some(e => !e.ally && !e.dead)) G.room.cleared = false;
    // 다음 구역 구멍 / 트로피
    if (G.hatch && G.room.type === 'boss' && G.room.key === G.floor.boss) { G.hatch.t += dt; if (G.hatch.t > 1 && dist(G.hatch, P) < 10) { AU.sfx('stairs'); startStage(G.stage + 1); return; } }
    if (G.trophy && G.room.type === 'boss') { G.trophy.t += dt; if (G.trophy.t > 1 && dist(G.trophy, P) < 12) { gameOver(true); return; } }
    // 이펙트
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.92; f.vy *= 0.92; } if (f.t > f.life) G.fx.splice(i, 1); }
    if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    if (CR.ui) CR.ui.bossBar(G.room.ents.filter(e => e.boss));
  }
  CR.update = update;
  function gameOver(win) {
    if (G.mode === 'over') return;
    G.mode = 'over'; G.over = { win, time: G.time, stage: G.stage, kills: G.kills, items: G.P.items.length };
    AU.play(null); AU.sfx(win ? 'win' : 'die');
    if (CR.ui) CR.ui.gameOver(G.over);
  }
  CR.gameOver = gameOver;

  /* ───────── 그리기 ───────── */
  const white = new Map();
  function whiteOf(c) { if (white.has(c)) return white.get(c); const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#fff'; x.fillRect(0, 0, o.width, o.height); white.set(c, o); return o; }
  function drawSpr(c, img, x, y, o) {
    o = o || {}; const w = img.width * (o.s || 1), h = img.height * (o.s || 1);
    c.save(); c.translate(Math.round(x), Math.round(y)); if (o.flip) c.scale(-1, 1); if (o.alpha != null) c.globalAlpha = o.alpha;
    c.drawImage(o.white ? whiteOf(img) : img, Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h)); c.restore();
  }
  function shadow(c, x, y, r) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), r, r * 0.45, 0, 0, TAU); c.fill(); }
  function drawCostume(c, k, x, y, dir, t) {
    const side = dir === 'left' ? -1 : 1;
    switch (k) {
      case 'goggle': if (dir !== 'up') { c.fillStyle = '#ff3d6e'; c.fillRect(x - 6, y - 7, 12, 3); c.fillStyle = '#ffd0dc'; c.fillRect(x - 5, y - 7, 2, 1); } break;
      case 'wings': c.fillStyle = 'rgba(255,170,90,0.85)'; for (const s of [-1, 1]) { const f = Math.sin(t * 14) * 2; c.fillRect(x + s * 8 - (s < 0 ? 4 : 0), y - 6 - f, 4, 6); c.fillRect(x + s * 11 - (s < 0 ? 2 : 0), y - 8 - f, 2, 6); } break;
      case 'tail': c.fillStyle = '#9ef0d0'; for (let i = 0; i < 6; i++) c.fillRect(Math.round(x - side * (6 + i * 2)), Math.round(y + 4 + Math.sin(t * 12 + i) * 1.5), 2, 1); break;
      case 'halo': c.strokeStyle = '#ffe066'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y - 15, 5, 1.8, 0, 0, TAU); c.stroke(); break;
      case 'crown': c.fillStyle = '#f5c542'; c.fillRect(x - 4, y - 15, 9, 2); c.fillRect(x - 4, y - 17, 1, 2); c.fillRect(x, y - 18, 1, 3); c.fillRect(x + 4, y - 17, 1, 2); break;
      case 'horns': c.fillStyle = '#b07cff'; c.fillRect(x - 6, y - 15, 2, 3); c.fillRect(x + 5, y - 15, 2, 3); c.fillRect(x - 7, y - 17, 1, 2); c.fillRect(x + 7, y - 17, 1, 2); break;
      case 'antenna': c.fillStyle = '#c486ff'; c.fillRect(x - 3, y - 17, 1, 4); c.fillRect(x + 3, y - 17, 1, 4); c.fillStyle = '#ffe066'; c.fillRect(x - 4, y - 18, 2, 2); c.fillRect(x + 3, y - 18, 2, 2); break;
      case 'aura': c.globalAlpha = 0.25 + Math.sin(t * 5) * 0.1; c.fillStyle = '#7dffb2'; c.beginPath(); c.arc(x, y - 3, 13, 0, TAU); c.fill(); c.globalAlpha = 1; break;
      case 'ring': c.strokeStyle = '#9effe0'; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(x, y + 2, 11, 4, 0, t * 2, t * 2 + 4.5); c.stroke(); c.globalAlpha = 1; break;
    }
  }
  function drawPlayer(c, ox, oy) {
    const P = G.P, t = G.time; if (P.invuln > 0 && Math.floor(t * 20) % 2 && !P.room.vaccine) return;
    const sc = has('giant') ? 1.35 : has('tiny') ? 0.7 : 1, x = ox + P.x, y = oy + P.y;
    shadow(c, x, y + 4 * sc, 6 * sc);
    P.costumes.filter(k => k === 'aura' || k === 'wings' || k === 'tail').forEach(k => drawCostume(c, k, x, y, P.dir, t));
    const moving = Math.hypot(P.vx, P.vy) > 15, fr = moving ? Math.floor(P.walkT * 8) % 2 : 0, tint = P.room.vaccine ? '#c8ffd8' : null;
    drawSpr(c, CR.playerBody(P.dir, fr, tint), x, y + 2 * sc, { s: sc });
    drawSpr(c, CR.playerHead(P.dir, P.shootT > 0, tint), x, y - 5 * sc, { s: sc });
    P.costumes.filter(k => !['aura', 'wings', 'tail'].includes(k)).forEach(k => drawCostume(c, k, x, y, P.dir, t));
    if (P.room.vaccine) { c.strokeStyle = 'rgba(160,255,190,0.7)'; c.beginPath(); c.arc(x, y - 3, 11, 0, TAU); c.stroke(); }
  }
  function drawEnemy(c, e, ox, oy) {
    const d = e.def, f = Math.floor((e.t || 0) * 5) % 2, P = G.P;
    if (e.hidden) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(ox + e.x, oy + e.y + 3, 6, 2.5, 0, 0, TAU); c.fill(); return; }
    const S = d.S || 16, sc = e.scale || 1;
    const img = CR.mob(d.shape, S, e.tint || d.col, { c2: d.c2, open: d.armor && !e.shut, angry: d.angry || e.boss, crown: d.crown && e.boss, look: d.shape === 'eye' ? [Math.round(Math.cos(ang(e, P))), Math.round(Math.sin(ang(e, P)))] : null }, f);
    shadow(c, ox + e.x, oy + e.y + S * 0.3 * sc, S * 0.32 * sc);
    if (e.trail) for (let i = 84; i >= 12; i -= 12) { const p = e.trail[i]; drawSpr(c, CR.mob('coccus', 16, CR.shade(d.col, -0.08 * (i / 12)), {}, (f + i) % 2), ox + p.x, oy + p.y); }
    const alpha = e.dormant ? 0.45 : (e.fade != null ? e.fade : (d.move === 'ghost' ? 0.7 : 1));
    if (e.boss && e.shell) { c.fillStyle = 'rgba(160,200,255,0.35)'; c.beginPath(); c.arc(ox + e.x, oy + e.y, S * 0.55 * sc, 0, TAU); c.fill(); }
    drawSpr(c, img, ox + e.x, oy + e.y - (e.z || 0), { s: sc, flip: e.vx < 0 || (e.boss && P.x < e.x && d.shape !== 'eye'), white: e.flash > 0, alpha });
    if (e.freezeT > 0) { c.fillStyle = 'rgba(180,230,255,0.45)'; c.fillRect(ox + e.x - S / 2 * sc, oy + e.y - S / 2 * sc, S * sc, S * sc); }
    if (e.stunT > 0) { c.fillStyle = '#ffe36b'; for (let k = 0; k < 3; k++) { const a = G.time * 6 + k * 2.1; c.fillRect(ox + e.x + Math.cos(a) * 6, oy + e.y - S * 0.55 + Math.sin(a) * 2, 2, 2); } }
    if (e.poisonT > 0 && Math.random() < 0.2) G.fx.push({ x: e.x + rand(-4, 4), y: e.y - 4, vx: 0, vy: -15, t: 0, life: 0.4, col: '#9ef07a', s: 1 });
    if (e.mark > 0) { e.mark -= 1 / 60; c.fillStyle = '#ffd166'; c.fillRect(ox + e.x - 1, oy + e.y - S * 0.6 * sc - 4, 3, 3); }
    if (e.ally) { c.strokeStyle = '#9fffe0'; c.beginPath(); c.arc(ox + e.x, oy + e.y, 7, 0, TAU); c.stroke(); }
    if (e.mate && !e.mate.dead && e.def.tether) { c.strokeStyle = 'rgba(200,230,255,0.75)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ox + e.x, oy + e.y); c.lineTo(ox + e.mate.x, oy + e.mate.y); c.stroke(); c.lineWidth = 1; }
  }
  function render() {
    const c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0714'; c.fillRect(0, 0, W, H);
    if (!G.room || !G.P) return;
    const st = G.stage, sx = G.shake > 0 ? Math.round(rand(-G.shake, G.shake) / 3) : 0, sy = G.shake > 0 ? Math.round(rand(-G.shake, G.shake) / 3) : 0, ox = RX + sx, oy = RY + sy, t = G.time;
    c.drawImage(CR.roomBg(G.room, st), ox, oy);
    c.save(); c.translate(ox, oy);
    for (const d in G.room.doors) CR.drawDoor(c, G.room, d, st, G.room.cleared, t);
    CR.drawProps(c, G.room, st, t);
    // 장판
    for (const k of G.creeps) {
      const fade = Math.min(1, (k.life - k.t) / 0.6) * (k.delay && k.t < k.delay ? 0.35 : 1);
      const col = { acid: 'rgba(190,230,60,0.45)', cloud: 'rgba(200,180,240,0.38)', web: 'rgba(240,230,200,0.35)', pacid: 'rgba(140,220,255,0.35)', pweb: 'rgba(255,240,200,0.3)', radio: 'rgba(170,255,90,0.12)' }[k.kind] || 'rgba(255,255,255,0.2)';
      c.globalAlpha = fade; c.fillStyle = k.col && k.kind === 'cloud' ? hexA(k.col, 0.38) : col; c.beginPath(); c.arc(k.x, k.y, k.r, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
    // 바닥 자국
    for (const f of G.fx) if (f.splat) { c.globalAlpha = Math.min(1, (f.life - f.t) / 2) * 0.55; c.fillStyle = f.col; c.beginPath(); c.ellipse(f.x, f.y + 3, f.r, f.r * 0.5, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    for (const f of G.fx) if (f.warn) { c.strokeStyle = Math.floor(f.t * 12) % 2 ? '#ff3d5a' : '#ffd0d8'; c.beginPath(); c.arc(f.x, f.y, f.r * (0.5 + f.t / f.life * 0.5), 0, TAU); c.stroke(); }
    // 구멍 · 트로피
    if (G.hatch && G.room.key === G.floor.boss) { c.fillStyle = '#05030a'; c.beginPath(); c.ellipse(G.hatch.x, G.hatch.y, 11, 7, 0, 0, TAU); c.fill(); c.strokeStyle = CR.STAGES[st - 1].acc; c.stroke(); CR.text(c, 'NEXT', G.hatch.x - 7, G.hatch.y - 14, '#ffffff'); }
    if (G.trophy && G.room.type === 'boss') { drawSpr(c, CR.icon('dna', '#ffd75e', '#fff3b0'), G.trophy.x, G.trophy.y - 4 + Math.sin(t * 3) * 2, { s: 1.4 }); G.fx.push({ x: G.trophy.x + rand(-8, 8), y: G.trophy.y + rand(-10, 4), vx: 0, vy: -12, t: 0, life: 0.5, col: '#ffe066', s: 1 }); }
    // 받침대
    for (const it of G.room.items) {
      if (it.taken) continue;
      c.fillStyle = CR.shade(CR.STAGES[st - 1].wall, 0.25); c.fillRect(it.x - 7, it.y + 2, 14, 6); c.fillStyle = CR.shade(CR.STAGES[st - 1].wall, 0.5); c.fillRect(it.x - 7, it.y + 2, 14, 2);
      const by = it.y - 6 + Math.sin(t * 3 + it.bob) * 1.5;
      if (it.pk) drawSpr(c, CR.pickup(it.pk), it.x, by);
      else { const d = CR.ALL[it.id]; if (d.tier === 4) { c.globalAlpha = 0.3 + Math.sin(t * 4) * 0.15; c.fillStyle = '#ffd75e'; c.beginPath(); c.arc(it.x, by, 11, 0, TAU); c.fill(); c.globalAlpha = 1; }
        drawSpr(c, CR.icon(d.glyph, d.col, d.col2), it.x, by); }
      if (it.price) CR.text(c, it.price + 'C', it.x - CR.textW(it.price + 'C') / 2, it.y + 10, G.P.coins >= it.price ? '#ffe066' : '#ff8a8a');
      if (it.hpCost) { CR.text(c, '-1', it.x - 8, it.y + 10, '#ff6b81'); drawSpr(c, CR.pickup('heart'), it.x + 5, it.y + 12, { s: 0.6 }); }
    }
    // 줍는 물건
    for (const p of G.room.pickups) { const by = p.y + Math.sin(t * 4 + p.x) * 1; shadow(c, p.x, p.y + 4, 4); if (p.kind === 'tool') drawSpr(c, CR.icon(CR.ALL[p.id].glyph, CR.ALL[p.id].col), p.x, by - 2); else if (p.kind === 'hormone') { const h = CR.ALL[p.id]; drawSpr(c, CR.icon('pill', h.col, h.col2), p.x, by - 2, { s: 0.8 }); } else drawSpr(c, CR.pickup(p.kind, Math.floor(t * 4) % 2), p.x, by - 2); }
    // 폭탄
    for (const b of G.bombs) { shadow(c, b.x, b.y + 4, 5); const s = (b.big ? 1.6 : 1) * (1 + (b.t < 0.5 ? Math.sin(t * 40) * 0.1 : 0)); drawSpr(c, CR.pickup('bomb', Math.floor(t * 10) % 2), b.x, b.y - 2, { s, white: b.t < 0.4 && Math.floor(t * 20) % 2 }); }
    // 개체를 y순으로
    const list = G.room.ents.map(e => ({ y: e.y, f: () => drawEnemy(c, e, 0, 0) }));
    list.push({ y: G.P.y, f: () => drawPlayer(c, 0, 0) });
    for (const f of G.fams) list.push({ y: f.y, f: () => drawFam(c, f, t) });
    list.sort((a, b) => a.y - b.y).forEach(o => o.f());
    // 플라스미드 고리
    if (G.fams.some(f => f.kind === 'ring')) { c.strokeStyle = 'rgba(255,125,240,0.7)'; c.setLineDash([3, 3]); c.lineDashOffset = -t * 20; c.beginPath(); c.arc(G.P.x, G.P.y - 2, 26, 0, TAU); c.stroke(); c.setLineDash([]); }
    // 탄환
    for (const b of G.pb) { c.fillStyle = CR.shade(b.col, -0.45); c.beginPath(); c.arc(b.x, b.y + 1, b.r + 0.8, 0, TAU); c.fill(); c.fillStyle = b.col; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(Math.round(b.x - b.r * 0.4), Math.round(b.y - b.r * 0.5), 1, 1); if (b.card) { c.fillStyle = '#fffbe0'; c.fillRect(b.x - 3, b.y - 4, 6, 8); } }
    for (const b of G.eb) { c.fillStyle = '#2a0a14'; c.beginPath(); c.arc(b.x, b.y, b.r + 1, 0, TAU); c.fill(); c.fillStyle = b.col; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 1, 1); }
    // 광선
    for (const L of G.lasers) {
      const x2 = L.x + Math.cos(L.a) * L.len, y2 = L.y + Math.sin(L.a) * L.len;
      if (L.t < L.tele) { c.strokeStyle = Math.floor(L.t * 16) % 2 ? L.col : 'rgba(255,255,255,0.6)'; c.lineWidth = 1; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke(); c.globalAlpha = 1; }
      else { c.lineCap = 'round'; c.strokeStyle = L.col; c.lineWidth = L.w + Math.sin(t * 40) ; c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, L.w * 0.35); c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(x2, y2); c.stroke(); c.lineWidth = 1; c.lineCap = 'butt'; }
    }
    // 이펙트
    for (const f of G.fx) {
      const k = f.t / f.life;
      if (f.ring) { c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = f.hurt ? 3 : 1.5; c.beginPath(); c.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, TAU); c.stroke(); c.globalAlpha = 1; c.lineWidth = 1; }
      else if (f.bolt) { c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(f.x, f.y); const n = 5; for (let i = 1; i <= n; i++) { const tt = i / n; c.lineTo(f.x + (f.x2 - f.x) * tt + (i < n ? rand(-4, 4) : 0), f.y + (f.y2 - f.y) * tt + (i < n ? rand(-4, 4) : 0)); } c.stroke(); c.globalAlpha = 1; }
      else if (f.txt) { if (f.ko) { /* 한글 이름은 화면 알림으로 */ } else CR.text(c, f.txt, f.x - CR.textW(f.txt) / 2, f.y - k * 10, f.col); }
      else if (f.pillar) { c.globalAlpha = 1 - k; c.fillStyle = f.col; c.fillRect(f.x - 5, f.y - 200, 10, 200); c.fillStyle = '#fff'; c.fillRect(f.x - 2, f.y - 200, 4, 200); c.globalAlpha = 1; }
      else if (f.tent) { const h = Math.sin(k * Math.PI) * 26; c.fillStyle = f.col; c.fillRect(f.x - 4, f.y - h, 8, h); c.fillStyle = CR.shade(f.col, -0.3); c.fillRect(f.x + 1, f.y - h, 3, h); }
      else if (f.cone) { c.globalAlpha = 1 - k; c.fillStyle = 'rgba(200,220,255,0.35)'; c.beginPath(); c.moveTo(f.x, f.y); c.arc(f.x, f.y, 120, f.a - 0.8, f.a + 0.8); c.fill(); c.globalAlpha = 1; }
      else if (f.vx != null && !f.splat && !f.warn) { c.globalAlpha = f.pop ? 1 - k : 1; c.fillStyle = f.col; c.fillRect(Math.round(f.x), Math.round(f.y), f.s || 1, f.s || 1); c.globalAlpha = 1; }
    }
    if (CR.roomOverlay) CR.roomOverlay(c, t, st);
    c.restore();
    if (G.fade > 0) { c.fillStyle = 'rgba(5,3,10,' + Math.min(1, G.fade * 3) + ')'; c.fillRect(RX, RY, RW, RH); }
    drawHUD(c);
    if (G.bigMap) drawBigMap(c);
  }
  CR.render = render;
  function hexA(hex, a) { const [r, g, b] = CR.rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function drawFam(c, f, t) {
    if (f.kind === 'ring') return;
    const img = { shooter: () => CR.mob('phage', 12, '#ffd36b', {}, Math.floor(t * 5) % 2), guard: () => CR.mob('cell', 16, '#e8d6ff', {}, Math.floor(t * 4) % 2), seeker: () => CR.mob('protein', 12, '#ffb0e0', {}, Math.floor(t * 5) % 2), creepy: () => CR.mob('coccus', 12, '#a0d8ff', {}, Math.floor(t * 5) % 2), microbe: () => CR.mob('rod', 12, '#7cf07c', {}, Math.floor(t * 5) % 2), clone: () => CR.playerHead(G.P.dir, G.P.shootT > 0, '#ffe0ff') }[f.kind];
    if (img) drawSpr(c, img(), f.x, f.y - 4, { alpha: f.kind === 'clone' ? 0.75 : 1 });
  }
  // HUD: 왼쪽 패널(액티브·물건·능력치·수술도구) · 위(체력·타이머) · 오른쪽(미니맵·진단서/호르몬)
  function fmtTime(s) { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = Math.floor(s) % 60, cs = Math.floor(s * 100) % 100; return [h, m, ss].map(v => String(v).padStart(2, '0')).join(':') + '.' + String(cs).padStart(2, '0'); }
  CR.fmtTime = fmtTime;
  function drawHUD(c) {
    const P = G.P, S = CR.STAGES[G.stage - 1];
    c.fillStyle = 'rgba(11,7,20,0.92)'; c.fillRect(0, 0, RX - 2, H); c.fillRect(W - RX + 2, 0, RX - 2, H); c.fillRect(RX - 2, 0, W - 2 * RX + 4, RY - 2);
    c.fillStyle = CR.shade(S.wall, 0.2); c.fillRect(RX - 3, 0, 1, H); c.fillRect(W - RX + 2, 0, 1, H);
    // 액티브
    c.fillStyle = '#1d1430'; c.fillRect(3, 3, 22, 22); c.strokeStyle = '#5a4a80'; c.strokeRect(3.5, 3.5, 21, 21);
    if (P.active) { const d = CR.ALL[P.active.id], full = P.active.charge >= P.active.max; c.globalAlpha = full ? 1 : 0.55; c.drawImage(CR.icon(d.glyph, d.col), 6, 6); c.globalAlpha = 1;
      const segs = Math.max(1, P.active.max); for (let i = 0; i < segs; i++) { const h = Math.floor(20 / segs) - 1; c.fillStyle = i < P.active.charge ? (full ? '#7dffb2' : '#ffd36b') : '#2a2040'; c.fillRect(28, 24 - (i + 1) * (h + 1), 6, h); }
      if (full && Math.floor(G.time * 3) % 2) CR.text(c, 'SPC', 4, 27, '#7dffb2'); }
    else CR.text(c, 'SPC', 6, 11, '#3a3050', 1, false);
    // 물건
    const rows = [['coin', P.coins], ['bomb', P.bombs], ['key', P.keys]];
    rows.forEach(([k, v], i) => { c.drawImage(CR.pickup(k), 3, 40 + i * 12); CR.text(c, String(v).padStart(2, '0'), 17, 43 + i * 12, '#ffffff'); });
    // 능력치
    const s = P.st, statRows = [['DMG', s.dmg.toFixed(1)], ['TRS', s.rate.toFixed(1)], ['RNG', (s.range / 16).toFixed(1)], ['SPD', s.speed.toFixed(2)], ['SHT', s.sspd.toFixed(1)], ['CRT', Math.round(s.crit) + '%']];
    statRows.forEach(([k, v], i) => { CR.text(c, k, 2, 82 + i * 9, '#8f86b0', 1, false); CR.text(c, v, 15, 82 + i * 9, '#ffffff', 1, false); });
    // 수술도구
    CR.text(c, 'TOOL', 3, 150, '#8f86b0', 1, false);
    P.tools.forEach((id, i) => { const d = CR.ALL[id]; c.drawImage(CR.icon(d.glyph, d.col), 3 + i * 17, 158); });
    // 체력
    const hx = RX + 2;
    let i = 0;
    for (let h = 0; h < P.maxHp; h += 2, i++) { const v = P.hp - h; drawHeart(c, hx + (i % 12) * 9, 3 + Math.floor(i / 12) * 8, v >= 2 ? 2 : v === 1 ? 1 : 0, '#e8344e'); }
    for (let h = 0; h < P.shield; h += 2, i++) { const v = P.shield - h; drawHeart(c, hx + (i % 12) * 9, 3 + Math.floor(i / 12) * 8, v >= 2 ? 2 : 1, '#5fb8ff', true); }
    // 타이머
    const tm = 'TIME ' + fmtTime(G.time); CR.text(c, tm, W / 2 - CR.textW(tm) / 2 + 40, 4, '#ffffff');
    CR.text(c, 'STAGE ' + G.stage + ' ' + S.en, W / 2 - CR.textW('STAGE ' + G.stage + ' ' + S.en) / 2 + 40, 12, S.acc);
    if (P.room.flag) CR.text(c, P.room.flag.slice(0, 8), RX + 2, 22, '#ffb8e8', 1, false);
    // 미니맵
    CR.drawMinimap(c, G.floor, G.room.key, W - RX + 4, 3, 3, 3, has('mapReveal'), toolFx('showSecret'));
    // 진단서·호르몬
    CR.text(c, 'Q', W - RX + 5, 150, '#8f86b0', 1, false);
    P.cons.forEach((id, k) => { const d = CR.ALL[id]; c.drawImage(d.kind === 'hormone' ? CR.icon('pill', d.col, d.col2) : CR.icon('card', d.col), W - RX + 5 + k * 17, 158); });
    // 보스 체력
    const bs = G.room.ents.filter(e => e.boss && !e.dead);
    if (bs.length) { let hp = 0, mx = 0; bs.forEach(b => { hp += Math.max(0, b.hp); mx += b.maxHp; }); const w = 180, x = W / 2 - w / 2, y = RY + RH - 9;
      c.fillStyle = '#1a0a10'; c.fillRect(x - 1, y - 1, w + 2, 6); c.fillStyle = '#5a1020'; c.fillRect(x, y, w, 4); c.fillStyle = '#ff3d5a'; c.fillRect(x, y, Math.round(w * clamp(hp / mx, 0, 1)), 4); c.fillStyle = '#ffb0c0'; c.fillRect(x, y, Math.round(w * clamp(hp / mx, 0, 1)), 1); }
  }
  // Tab: 큰 층 지도
  const MAPC = { treasure: '#f5c542', shop: '#46c46a', boss: '#e8344e', secret: '#8a7a6a', lab: '#ff3d6e', sanct: '#fff3b0' };
  const MAPL = { treasure: 'T', shop: '$', boss: 'B', secret: '?', lab: 'L', sanct: 'S' };
  function drawBigMap(c) {
    const fl = G.floor, reveal = has('mapReveal'), showSecret = toolFx('showSecret');
    c.fillStyle = 'rgba(8,4,16,0.82)'; c.fillRect(RX, RY, RW, RH);
    let minX = 9, minY = 9, maxX = 0, maxY = 0; const vis = [];
    for (const r of fl.rooms.values()) { const known = r.visited || r.seen || reveal; if (!known) continue; if (r.type === 'secret' && !r.visited && !showSecret && !r.revealed) continue; vis.push(r); minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x); maxY = Math.max(maxY, r.y); }
    const cw = 24, ch = 15, gap = 4, w = (maxX - minX + 1) * (cw + gap) - gap, h = (maxY - minY + 1) * (ch + gap) - gap, x0 = Math.round(RX + RW / 2 - w / 2), y0 = Math.round(RY + RH / 2 - h / 2 - 6);
    const pos = r => [x0 + (r.x - minX) * (cw + gap), y0 + (r.y - minY) * (ch + gap)];
    // 연결 통로
    c.fillStyle = '#4a4060';
    for (const r of vis) for (const d in r.doors) { const dr = r.doors[d]; if (dr.hidden) continue; const o = fl.rooms.get(dr.to); if (!o || !vis.includes(o)) continue; const [x, y] = pos(r); if (d === 'r') c.fillRect(x + cw, y + ch / 2 - 1, gap, 3); if (d === 'd') c.fillRect(x + cw / 2 - 1, y + ch, 3, gap); }
    for (const r of vis) {
      const [x, y] = pos(r), cur = r.key === G.room.key;
      c.fillStyle = cur ? '#ffffff' : r.visited ? '#9aa1b8' : '#3a3550'; c.fillRect(x, y, cw, ch);
      c.fillStyle = r.cleared && r.visited ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0)';
      if (MAPC[r.type]) { c.fillStyle = MAPC[r.type]; c.fillRect(x + 3, y + 3, cw - 6, ch - 6); CR.text(c, MAPL[r.type], x + cw / 2 - 1, y + ch / 2 - 2, '#1a0f24', 1, false); }
      if (r.type === 'start') CR.text(c, 'S', x + cw / 2 - 1, y + ch / 2 - 2, cur ? '#1a0f24' : '#6a6480', 1, false);
      if (cur) { c.strokeStyle = Math.floor(G.time * 4) % 2 ? '#ffe066' : '#ffffff'; c.strokeRect(x - 1.5, y - 1.5, cw + 3, ch + 3); }
      if (!r.cleared && r.visited && r.type !== 'start') { c.fillStyle = '#ff5d7a'; c.fillRect(x + cw - 4, y + 1, 3, 3); }
    }
    CR.text(c, 'MAP  STAGE ' + G.stage, RX + 8, RY + 6, '#ffe066');
  }
  function drawHeart(c, x, y, v, col, sh) {
    const img = CR.spr('hh|' + v + '|' + col, 8, 7, g => {
      const pts = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
      pts.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== 'X') return; const filled = v === 2 || (v === 1 && xx <= 3); g.set(xx, yy, filled ? (yy === 1 && xx === 1 ? CR.shade(col, 0.5) : col) : '#3a2030'); }));
    });
    c.drawImage(img, x, y);
  }

  /* ───────── 루프 ───────── */
  let last = performance.now(), acc = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
    while (acc >= 1 / 60) { update(1 / 60); acc -= 1 / 60; }
    if (CR.ui && CR.ui.frame) CR.ui.frame();
    render();
    requestAnimationFrame(loop);
  }
  CR.bindCanvas(cv, W, H);
  requestAnimationFrame(loop);
})();

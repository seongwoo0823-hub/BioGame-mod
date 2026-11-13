// 세포 레이드 — 층 생성 · 방 배치 · 방 그리기 · 미니맵
(function () {
  'use strict';
  const CR = window.CR;
  const T = 16, COLS = 19, ROWS = 11, RW = COLS * T, RH = ROWS * T;
  CR.T = T; CR.COLS = COLS; CR.ROWS = ROWS; CR.RW = RW; CR.RH = RH;
  // 타일: 0 바닥 · 1 벽 · 2 바위 · 3 금속 블록(안 부서짐) · 4 가시 · 7 웅덩이(장식)
  CR.DOOR_TILE = { u: [9, 0], d: [9, 10], l: [0, 5], r: [18, 5] };
  CR.DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  CR.OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
  const key = (x, y) => x + ',' + y;
  CR.key = key;

  /* ───────── 층 생성 ───────── */
  CR.genFloor = function (stage, rnd) {
    const rooms = new Map(), N = 6 + stage * 2 + Math.floor(rnd() * 3);
    const add = (x, y, type) => { const r = { x, y, key: key(x, y), type: type || 'normal', doors: {}, visited: false, cleared: false, seen: false, tiles: null, items: [], pickups: [], enemies: null, bgDirty: true }; rooms.set(r.key, r); return r; };
    const start = add(4, 4, 'start');
    const nb = (x, y) => ['u', 'd', 'l', 'r'].map(d => [x + CR.DIRS[d][0], y + CR.DIRS[d][1]]);
    const cnt = (x, y) => nb(x, y).filter(([a, b]) => rooms.has(key(a, b))).length;
    let guard = 0;
    while (rooms.size < N && guard++ < 2000) {
      const list = [...rooms.values()], from = list[Math.floor(rnd() * list.length)];
      const [x, y] = nb(from.x, from.y)[Math.floor(rnd() * 4)];
      if (x < 0 || y < 0 || x > 8 || y > 8 || rooms.has(key(x, y))) continue;
      if (cnt(x, y) > 1 && rnd() < 0.85) continue;          // 가지 모양 유지
      add(x, y);
    }
    const dist = new Map([[start.key, 0]]), q = [start];
    while (q.length) { const r = q.shift(); for (const [x, y] of nb(r.x, r.y)) { const k = key(x, y); if (rooms.has(k) && !dist.has(k)) { dist.set(k, dist.get(r.key) + 1); q.push(rooms.get(k)); } } }
    const dead = () => [...rooms.values()].filter(r => r.type === 'normal' && cnt(r.x, r.y) === 1).sort((a, b) => dist.get(b.key) - dist.get(a.key));
    // 막다른 방이 부족하면 새 방을 덧붙임
    const extra = (type) => {
      const cands = [];
      for (const r of rooms.values()) if (r.type === 'normal' || r.type === 'start') for (const [x, y] of nb(r.x, r.y)) if (x >= 0 && y >= 0 && x <= 8 && y <= 8 && !rooms.has(key(x, y)) && cnt(x, y) === 1) cands.push([x, y, dist.get(r.key) + 1]);
      if (!cands.length) return null;
      cands.sort((a, b) => b[2] - a[2]); const [x, y, d] = cands[type === 'boss' ? 0 : Math.floor(rnd() * cands.length)];
      const nr = add(x, y, type); dist.set(nr.key, d); return nr;
    };
    const pick = (type) => { const d = dead(); if (d.length && !(type === 'boss' && dist.get(d[0].key) < 3)) { const r = type === 'boss' ? d[0] : d[Math.floor(rnd() * d.length)]; r.type = type; return r; } return extra(type); };
    const boss = pick('boss'); pick('treasure'); pick('shop');
    if (stage >= 2 && rnd() < 0.45) pick('sanct');
    // 숨은 방: 방 2개 이상과 붙어 있는 빈칸
    let best = null;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      if (rooms.has(key(x, y))) continue;
      const ns = nb(x, y).filter(([a, b]) => rooms.has(key(a, b)) && rooms.get(key(a, b)).type !== 'boss');
      if (ns.length >= 2 && (!best || ns.length > best[2] || rnd() < 0.3)) best = [x, y, ns.length];
    }
    if (best) add(best[0], best[1], 'secret');
    // 문 연결
    for (const r of rooms.values()) for (const d of ['u', 'd', 'l', 'r']) {
      const o = rooms.get(key(r.x + CR.DIRS[d][0], r.y + CR.DIRS[d][1])); if (!o) continue;
      if ((r.type === 'secret') !== (o.type === 'secret')) { r.doors[d] = { to: o.key, kind: 'secret', hidden: true }; continue; }
      if (r.type === 'secret' && o.type === 'secret') continue;
      const special = ['boss', 'treasure', 'shop', 'sanct'].find(t => r.type === t || o.type === t);
      r.doors[d] = { to: o.key, kind: special || 'normal', locked: special === 'treasure' && stage >= 2, hidden: false };
    }
    const floor = { stage, rooms, start: start.key, boss: boss && boss.key, labKey: null };
    for (const r of rooms.values()) CR.layoutRoom(r, stage, rnd);
    start.seen = true;
    return floor;
  };
  // 보스를 잡은 뒤 열리는 변이 연구실 (보스 방 옆 빈칸)
  CR.addLab = function (floor, rnd) {
    if (floor.labKey) return floor.rooms.get(floor.labKey);
    const b = floor.rooms.get(floor.boss); if (!b) return null;
    for (const d of ['u', 'r', 'l', 'd'].sort(() => rnd() - 0.5)) {
      const x = b.x + CR.DIRS[d][0], y = b.y + CR.DIRS[d][1];
      if (x < 0 || y < 0 || x > 8 || y > 8 || floor.rooms.has(key(x, y))) continue;
      const r = { x, y, key: key(x, y), type: 'lab', doors: {}, visited: false, cleared: false, seen: true, tiles: null, items: [], pickups: [], enemies: null, bgDirty: true };
      floor.rooms.set(r.key, r);
      b.doors[d] = { to: r.key, kind: 'lab', hidden: false }; r.doors[CR.OPP[d]] = { to: b.key, kind: 'lab', hidden: false };
      CR.layoutRoom(r, floor.stage, rnd); floor.labKey = r.key; return r;
    }
    return null;
  };

  /* ───────── 방 안 배치 (가운데 십자 통로는 항상 비워 모든 문이 이어지게) ───────── */
  CR.layoutRoom = function (room, stage, rnd) {
    const t = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) t[y * COLS + x] = 1;
    const set = (x, y, v) => { if (x < 1 || y < 1 || x > COLS - 2 || y > ROWS - 2) return; if (x === 9 || y === 5) return; if ((x <= 2 && y === 5) || (x >= 16 && y === 5) || (y <= 2 && x === 9) || (y >= 8 && x === 9)) return; t[y * COLS + x] = v; };
    const sym = (x, y, v) => { set(x, y, v); set(COLS - 1 - x, y, v); set(x, ROWS - 1 - y, v); set(COLS - 1 - x, ROWS - 1 - y, v); };
    if (room.type === 'normal') {
      const pat = Math.floor(rnd() * 9), rk = () => (stage >= 3 && rnd() < 0.15 ? 3 : 2);
      if (pat === 1) { [[4, 3], [5, 3], [4, 2], [5, 2]].forEach(([x, y]) => sym(x, y, 2)); }
      else if (pat === 2) { for (let i = 0; i < 9; i++) { const x = 2 + Math.floor(rnd() * 7), y = 1 + Math.floor(rnd() * 4); sym(x, y, rk()); } }
      else if (pat === 3) { for (let x = 3; x <= 7; x++) { sym(x, 3, rk()); } }
      else if (pat === 4 && stage >= 2) { for (let i = 0; i < 6; i++) sym(3 + Math.floor(rnd() * 5), 2 + Math.floor(rnd() * 3), 4); [[6, 2], [6, 3]].forEach(([x, y]) => sym(x, y, 2)); }
      else if (pat === 5) { for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) sym(x, y, rk()); }
      else if (pat === 6) { for (let x = 6; x <= 8; x++) { sym(x, 3, 2); } sym(7, 4, 2); sym(7, 2, 2); }
      else if (pat === 7) { for (let i = 0; i < 4; i++) sym(2 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 4), 7); sym(4, 3, 2); sym(6, 2, 2); }
      else if (pat === 8 && stage >= 3) { for (let x = 2; x <= 7; x += 2) for (let y = 2; y <= 3; y++) sym(x, y, 3); }
    } else if (room.type === 'boss' && stage >= 2) { sym(2, 2, 3); }
    else if (room.type === 'secret') { sym(2, 2, 2); sym(3, 2, 2); }
    room.tiles = t; room.bgDirty = true;
  };
  CR.tileAt = (room, tx, ty) => (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) ? 1 : room.tiles[ty * COLS + tx];

  /* ───────── 타일 그림 ───────── */
  function rockSpr(st) {
    const S = CR.STAGES[st - 1];
    return CR.spr('rock' + st, 16, 16, g => {
      if (st === 2) { CR.SHAPES; g.blob(8, 9, 6.5, 5, S.rock); g.blob(8, 9, 3, 2, CR.shade(S.rock, 0.25), true); return; }   // 적혈구 장애물
      const r = CR.rng(st * 77);
      g.blob(8, 9.5, 6.8, 5.6, S.rock); for (let k = 0; k < 3; k++) g.blob(4 + r() * 8, 6 + r() * 5, 2.5 + r() * 1.5, 2 + r(), CR.shade(S.rock, (r() - 0.5) * 0.25));
      g.set(5, 6, CR.shade(S.rock, 0.5)); g.set(6, 6, CR.shade(S.rock, 0.4));
    });
  }
  function metalSpr(st) {
    const c = st >= 5 ? '#4b4f7a' : '#7a7f8c';
    return CR.spr('metal' + st, 16, 16, g => { g.rect(1, 1, 14, 14, c, true); g.rect(3, 3, 10, 10, CR.shade(c, -0.12), true); [[3, 3], [12, 3], [3, 12], [12, 12]].forEach(([x, y]) => g.set(x, y, CR.shade(c, 0.6))); }, true);
  }
  function spikeSpr(st) {
    return CR.spr('spike' + st, 16, 16, g => { for (const [x, y] of [[3, 4], [10, 3], [6, 10], [12, 11]]) { for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) g.set(x + j * 0.6 + 1, y + i, i === 0 ? '#ffffff' : CR.shade('#c8ccd8', -i * 0.12)); } }, true);
  }
  CR.rockSpr = rockSpr;

  // 방 배경 (바닥 + 벽 + 장애물) — 바뀔 때만 다시 그림
  CR.roomBg = function (room, st) {
    if (room.bg && !room.bgDirty) return room.bg;
    const S = CR.STAGES[st - 1], cv = room.bg || document.createElement('canvas'); cv.width = RW; cv.height = RH;
    const c = cv.getContext('2d'), r = CR.rng(CR.hashStr(room.key + st));
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const px = x * T, py = y * T;
      c.fillStyle = (x + y) % 2 ? S.floor : S.floor2; c.fillRect(px, py, T, T);
      for (let k = 0; k < 7; k++) { c.fillStyle = r() < 0.5 ? CR.shade(S.floor, 0.08) : CR.shade(S.floor, -0.1); c.fillRect(px + Math.floor(r() * T), py + Math.floor(r() * T), 1, 1); }
      if (r() < 0.16) {   // 구역마다 다른 바닥 무늬
        c.fillStyle = S.deco; const ox = px + 3 + Math.floor(r() * 9), oy = py + 3 + Math.floor(r() * 9);
        if (st === 1) { c.fillRect(ox, oy, 4, 1); c.fillRect(ox, oy + 3, 4, 1); c.fillRect(ox, oy, 1, 4); c.fillRect(ox + 4, oy, 1, 4); }
        else if (st === 2) { c.fillRect(ox, oy + 1, 5, 2); c.fillRect(ox + 1, oy, 3, 4); }
        else if (st === 5) { c.fillRect(ox, oy, 6, 1); c.fillRect(ox + 3, oy - 2, 1, 5); }
        else if (st === 6) { c.fillRect(ox, oy, 1, 1); c.fillRect(ox + 2, oy + 1, 1, 1); c.fillRect(ox + 1, oy + 3, 2, 1); }
        else { c.fillRect(ox, oy, 3, 3); }
      }
    }
    // 벽 (안쪽 테두리 밝게, 바깥 어둡게)
    const wc = S.wall;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!(x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1)) continue;
      const px = x * T, py = y * T; c.fillStyle = wc; c.fillRect(px, py, T, T);
      for (let k = 0; k < 10; k++) { c.fillStyle = r() < 0.5 ? CR.shade(wc, 0.12) : CR.shade(wc, -0.15); c.fillRect(px + Math.floor(r() * 15), py + Math.floor(r() * 15), 2, 1); }
    }
    c.fillStyle = CR.shade(wc, 0.35); c.fillRect(T - 2, T - 2, RW - 2 * T + 4, 2); c.fillRect(T - 2, T - 2, 2, RH - 2 * T + 4);
    c.fillStyle = CR.shade(wc, -0.4); c.fillRect(T - 2, RH - T, RW - 2 * T + 4, 2); c.fillRect(RW - T, T - 2, 2, RH - 2 * T + 4);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(T, T, RW - 2 * T, 3); c.fillRect(T, T, 3, RH - 2 * T);
    // 장애물
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      const v = room.tiles[y * COLS + x];
      if (v === 2 || v === 3) { const spr = v === 2 ? rockSpr(st) : metalSpr(st); c.fillStyle = 'rgba(10,4,12,0.45)'; c.beginPath(); c.ellipse(x * T + 9.5, y * T + 14, 8, 3.2, 0, 0, 7); c.fill(); if (CR.darkOf) c.drawImage(CR.darkOf(spr), x * T, y * T + 2); c.drawImage(spr, x * T, y * T - 1); }
      else if (v === 4) c.drawImage(spikeSpr(st), x * T, y * T);
      else if (v === 7) { c.fillStyle = st === 3 ? 'rgba(200,230,80,0.35)' : st === 2 ? 'rgba(120,10,30,0.4)' : 'rgba(255,255,255,0.12)'; c.beginPath(); c.ellipse(x * T + 8, y * T + 8, 9, 6, 0, 0, 7); c.fill(); }
    }
    room.bg = cv; room.bgDirty = false; return cv;
  };

  /* ───────── 문 ───────── */
  const DOORCOL = { normal: null, boss: '#c8202e', treasure: '#f5c542', shop: '#46c46a', secret: '#5a4a3a', lab: '#b0123a', sanct: '#fff3b0' };
  CR.drawDoor = function (c, room, d, st, open, t) {
    const door = room.doors[d]; if (!door) return;
    if (door.kind === 'secret' && door.hidden) return;
    const [tx, ty] = CR.DOOR_TILE[d], cx = tx * T + 8, cy = ty * T + 8, S = CR.STAGES[st - 1], hor = d === 'u' || d === 'd';
    const frame = DOORCOL[door.kind] || CR.shade(S.wall, 0.45), w = hor ? 22 : 12, h = hor ? 12 : 22;
    c.save(); c.translate(cx, cy);
    if (door.kind === 'secret') { c.fillStyle = '#140a0a'; c.beginPath(); c.ellipse(0, 0, hor ? 9 : 6, hor ? 6 : 9, 0, 0, 7); c.fill(); c.restore(); return; }
    c.fillStyle = frame; c.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    c.fillStyle = CR.shade(frame, -0.35); c.fillRect(-w / 2, -h / 2, w, h);
    c.fillStyle = open && !door.locked ? '#0c0610' : CR.shade(S.floor, -0.35); c.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
    if (!open || door.locked) {   // 닫힌 막: 세포막 띠
      c.fillStyle = door.kind === 'lab' ? '#ff3d6e' : CR.shade(S.acc, -0.1);
      for (let i = -1; i <= 1; i++) { if (hor) c.fillRect(i * 6 - 1, -h / 2 + 2, 2, h - 4); else c.fillRect(-w / 2 + 2, i * 6 - 1, w - 4, 2); }
    }
    if (door.locked) { c.fillStyle = '#f2c94c'; c.fillRect(-3, -3, 6, 6); c.fillStyle = '#7a5a10'; c.fillRect(-1, -1, 2, 3); }
    if (door.kind === 'boss') { c.fillStyle = '#ffe3e3'; const o = hor ? [[-9, 0], [9, 0]] : [[0, -9], [0, 9]]; o.forEach(([x, y]) => { c.fillRect(x - 2, y - 2, 4, 3); c.fillStyle = '#1a0a0a'; c.fillRect(x - 1, y - 1, 1, 1); c.fillRect(x + 1, y - 1, 1, 1); c.fillStyle = '#ffe3e3'; }); }
    if (door.kind === 'lab' || door.kind === 'sanct') { c.globalAlpha = 0.35 + Math.sin(t * 4) * 0.2; c.fillStyle = door.kind === 'lab' ? '#ff2050' : '#fff6c0'; c.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8); c.globalAlpha = 1; }
    c.restore();
  };

  /* ───────── 미니맵 ───────── */
  const MCOL = { start: '#9aa3b5', normal: '#7a8396', treasure: '#f5c542', shop: '#46c46a', boss: '#e8344e', secret: '#8a7a6a', lab: '#ff3d6e', sanct: '#fff3b0' };
  CR.drawMinimap = function (c, floor, curKey, x0, y0, cw, ch, reveal, showSecret) {
    let minX = 9, minY = 9, maxX = 0, maxY = 0;
    for (const r of floor.rooms.values()) { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x); maxY = Math.max(maxY, r.y); }
    const gx = cw + 1, gy = ch + 1, offX = Math.round((38 - (maxX - minX + 1) * gx) / 2), offY = 0;
    c.fillStyle = 'rgba(10,6,20,0.55)'; c.fillRect(x0 - 1, y0 - 1, 38, (maxY - minY + 1) * gy + 1);
    for (const r of floor.rooms.values()) {
      const known = r.visited || r.seen || reveal;
      if (!known) continue;
      if (r.type === 'secret' && !r.visited && !showSecret && !r.revealed) continue;
      const px = x0 + offX + (r.x - minX) * gx, py = y0 + offY + (r.y - minY) * gy;
      c.fillStyle = r.key === curKey ? '#ffffff' : r.visited ? '#b9c0cf' : '#4a4f63'; c.fillRect(px, py, cw, ch);
      if (r.type !== 'normal' && r.type !== 'start') { c.fillStyle = MCOL[r.type]; c.fillRect(px + 1, py + 1, cw - 2, ch - 2); }
    }
  };
})();

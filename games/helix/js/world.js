// 헬릭스 방: 지형 생성, 바닥 미리 그리기, 충돌, 소품, 출구 문, 마을 지도
'use strict';
const OY = 96;   // 바닥 캔버스 위쪽 여백 (벽 높이)
const AREA_PROPS = {
  lab: {block: ['lab_bench', 'incubator', 'agar_tank', 'centrifuge', 'shelf', 'biobin'], brk: ['jar']},
  sewer: {block: ['pipe', 'valve', 'shroom_patch', 'barrel'], brk: ['barrel', 'crate_rot'], flat: ['bones', 'sewer_grate']},
  ward: {block: ['bed', 'iv_stand', 'curtain', 'barrier', 'cabinet', 'fungus'], brk: ['pod_ward']},
  vault: {block: ['crystal', 'data_core', 'helix_statue', 'conduit', 'vault_pillar'], brk: ['cell_cache']},
};
// 단순 값 노이즈 (바닥 무늬 군집용)
function vnoise(x, y, seed) {
  const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

class Room {
  constructor(area, gw, gh) {
    this.area = area; this.gw = gw; this.gh = gh; this.grid = new Uint8Array(gw * gh);
    this.props = []; this.doors = []; this.decals = []; this.zones = []; this.seed = Math.floor(Math.random() * 1e6);
  }
  at(i, j) { return i < 0 || j < 0 || i >= this.gw || j >= this.gh ? 0 : this.grid[j * this.gw + i]; }
  set(i, j, v) { if (i >= 0 && j >= 0 && i < this.gw && j < this.gh) this.grid[j * this.gw + i] = v; }
  rect(i0, j0, i1, j1, v = 1) { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.set(i, j, v); }
  floorAt(x, z) { return this.at(Math.floor(x / TS), Math.floor(z / TS)) === 1; }
  // 원(반지름 r)이 바닥 위에 온전히 있는지
  free(x, z, r) {
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; if (!this.floorAt(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false; }
    return this.floorAt(x, z);
  }
  bounds() { return [-40, -OY + 10, this.gw * TS + 40, this.gh * TS * K + 60]; }
  // 막힌 소품과 겹치면 밀어냄
  pushOut(e, r) {
    for (const p of this.props) {
      if (!p.block || p.broken) continue;
      const pr = p.rad * 0.5 + r, dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d < pr && d > 0.01) { e.x = p.x + dx / d * pr; e.z = p.z + dz / d * pr; }
    }
  }
  // 이동: 축마다 따로 시도해 벽을 따라 미끄러짐
  move(e, dx, dz, r) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 12));
    let hitWall = false;
    for (let s = 0; s < steps; s++) {
      const sx = dx / steps, sz = dz / steps;
      if (this.free(e.x + sx, e.z, r)) e.x += sx; else hitWall = true;
      if (this.free(e.x, e.z + sz, r)) e.z += sz; else hitWall = true;
    }
    this.pushOut(e, r);
    if (!this.free(e.x, e.z, r)) { const s = this.nearestFree(e.x, e.z, r); e.x = s[0]; e.z = s[1]; }
    return hitWall;
  }
  nearestFree(x, z, r) {
    for (let rad = 0; rad < 400; rad += 8) for (let k = 0; k < 16; k++) { const a = k * TAU / 16, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (this.free(px, pz, r)) return [px, pz]; }
    return [this.entry.x, this.entry.z];
  }
  randomFloor(r = 20, avoid = null, minD = 0) {
    for (let k = 0; k < 200; k++) {
      const i = Math.floor(Math.random() * this.gw), j = Math.floor(Math.random() * this.gh);
      if (this.at(i, j) !== 1) continue;
      const x = (i + 0.5) * TS, z = (j + 0.5) * TS;
      if (!this.free(x, z, r)) continue;
      if (avoid && Math.hypot(avoid.x - x, avoid.z - z) < minD) continue;
      if (this.props.some(p => p.block && !p.broken && Math.hypot(p.x - x, p.z - z) < p.rad * 0.5 + r + 6)) continue;
      return {x, z};
    }
    return {x: this.entry.x, z: this.entry.z - 120};
  }
  addProp(name, x, z) {
    const m = JS.props[name]; if (!m) return null;
    const p = {name, x, z, m, rad: m.rad, block: m.block, brk: m.brk, hp: m.brk ? 1 : 0, broken: false, frame: 0};
    this.props.push(p); return p;
  }
}

// ---------------- 바닥 미리 그리기
function prerender(room) {
  const T = JS.tiles[room.area], sh = IMG['tiles_' + room.area];
  const W = room.gw * TS, H = Math.ceil(room.gh * TS * K) + OY + 40;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = T.void; x.fillRect(0, 0, W, H);
  // 바깥 공간 무늬 (아주 흐리게)
  for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  const tH = 30, tW = 48, idx = n => T.tiles.indexOf(n);
  const ty = j => Math.round(j * TS * K) + OY;
  for (let j = 0; j < room.gh; j++) for (let i = 0; i < room.gw; i++) {
    if (room.at(i, j) !== 1) continue;
    const n = vnoise(i * 0.28, j * 0.28, room.seed % 997);
    let pool = T.floors.base;
    if (room.zones.some(z => i >= z[0] && i <= z[2] && j >= z[1] && j <= z[3])) pool = T.floors.deck || T.floors.alt;
    else if (n > 0.74 && T.floors.alt) pool = T.floors.alt;
    const h = ((i * 7919 + j * 104729 + room.seed) >>> 0) % pool.length;
    const t = idx(pool[h]);
    x.drawImage(sh, t * tW, 0, tW, tH, i * TS, ty(j), tW, tH);
  }
  for (let j = 0; j < room.gh; j++) for (let i = 0; i < room.gw; i++) if (room.at(i, j) === 2) { x.fillStyle = '#020304'; x.fillRect(i * TS, ty(j), tW, tH); if (room.at(i, j - 1) === 1) { const g = x.createLinearGradient(0, ty(j), 0, ty(j) + tH); g.addColorStop(0, 'rgba(60,70,80,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(i * TS, ty(j), tW, tH); } }
  // 반복 무늬가 덜 보이도록 넓은 명암 얼룩
  for (let k = 0; k < (W * H) / 7000; k++) {
    const px = Math.random() * W, py = Math.random() * H, r = rand(60, 180), dark = Math.random() < 0.6;
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,240,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  // 바닥 장식
  for (const d of room.decals) x.drawImage(sh, d.k * tW, tH, tW, tH, Math.round(d.x - 24), Math.round(d.z * K + OY - 15), tW, tH);
  // 가장자리: 북쪽 벽, 남쪽 절벽, 양옆 벽 두께, 벽 아래 그늘
  const wall = j => T.wallY, wi = (i, j) => ((i * 31 + j * 17 + room.seed) >>> 0) % T.walls;
  for (let j = 0; j < room.gh; j++) for (let i = 0; i < room.gw; i++) {
    if (room.at(i, j) !== 1) continue;
    const X = i * TS, Y = ty(j);
    if (room.at(i, j + 1) !== 1) x.drawImage(sh, 0, T.cliffY, tW, T.cliffH, X, Y + tH, tW, T.cliffH);
  }
  for (let j = 0; j < room.gh; j++) for (let i = 0; i < room.gw; i++) {
    if (room.at(i, j) !== 1) continue;
    const X = i * TS, Y = ty(j);
    if (room.at(i, j - 1) === 2) { const g = x.createLinearGradient(0, Y, 0, Y + 14); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X, Y, tW, 14); }
    if (room.at(i, j - 1) === 0) {
      x.drawImage(sh, wi(i, j) * tW, T.wallY, tW, T.wallH, X, Y - T.wallH, tW, T.wallH);
      x.drawImage(sh, 0, T.topY, tW, T.topH, X, Y - T.wallH - T.topH, tW, T.topH);
      const g = x.createLinearGradient(0, Y, 0, Y + 22); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X, Y, tW, 22);
    }
  }
  for (let j = 0; j < room.gh; j++) for (let i = 0; i < room.gw; i++) {
    if (room.at(i, j) !== 1) continue;
    const X = i * TS, Y = ty(j);
    for (const s of [-1, 1]) {
      if (room.at(i + s, j) === 1) continue;
      if (room.at(i + s, j) === 2) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(s < 0 ? X : X + tW - 4, Y, 4, tH); continue; }
      const ex = s < 0 ? X - 8 : X + tW;
      const top = room.at(i, j - 1) !== 1 ? Y - T.wallH - T.topH : Y - T.wallH - T.topH;
      x.drawImage(sh, 0, T.topY, 8, T.topH, ex, top, 8, T.topH);
      x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(ex, top + T.topH, 8, Y + tH - top - T.topH);
      x.drawImage(sh, 0, T.topY, 8, T.topH, ex, top + T.topH, 8, Y + tH - top - T.topH);
      const g = x.createLinearGradient(s < 0 ? X : X + tW, 0, s < 0 ? X + 18 : X + tW - 18, 0); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(s < 0 ? X : X + tW - 18, Y, 18, tH);
    }
  }
  room.canvas = c;
}

// ---------------- 전투방 생성
function genRoom(area, kind, nDoors) {
  const big = kind === 'boss' || kind === 'midboss';
  const gw = big ? 26 : 22, gh = big ? 22 : 19;
  const R = new Room(area, gw, gh);
  const w = big ? 20 : Math.floor(rand(12, 17)), h = big ? 15 : Math.floor(rand(10, 13));
  const i0 = Math.floor((gw - w) / 2), j0 = 3, i1 = i0 + w - 1, j1 = j0 + h - 1;
  R.rect(i0, j0, i1, j1);
  // 옆으로 튀어나온 부분 (방 모양 다양하게)
  const bulges = big ? 0 : Math.floor(rand(1, 4));
  for (let k = 0; k < bulges; k++) {
    const bw = Math.floor(rand(3, 6)), bh = Math.floor(rand(3, 6)), side = Math.random() < 0.5 ? -1 : 1;
    const bi = side < 0 ? i0 - bw + Math.floor(rand(1, 3)) : i1 - Math.floor(rand(1, 3)), bj = Math.floor(rand(j0 + 2, j1 - bh));
    R.rect(Math.max(1, bi), bj, Math.min(gw - 2, bi + bw), bj + bh);
  }
  // 아래쪽 입구 통로
  const ci = Math.floor(gw / 2);
  R.rect(ci - 1, j1, ci + 1, j1 + 2);
  // 구멍(빈 공간) 몇 개
  if (!big && Math.random() < 0.7) {
    for (let k = 0; k < Math.floor(rand(1, 3)); k++) {
      const hi = Math.floor(rand(i0 + 2, i1 - 3)), hj = Math.floor(rand(j0 + 3, j1 - 4));
      if (Math.abs(hi - ci) < 3 && hj > j1 - 5) continue;
      R.rect(hi, hj, hi + 1, hj + 1, 2);
    }
  }
  if (big) { R.rect(i0 - 1, j0 + 4, i0 - 1, j1 - 4); R.rect(i1 + 1, j0 + 4, i1 + 1, j1 - 4); }
  R.entry = {x: (ci + 0.5) * TS, z: (j1 + 1.5) * TS};
  R.topRow = j0; R.mainRect = [i0, j0, i1, j1];
  // 출구 문 (북쪽 벽)
  if (nDoors > 0) {
    const cols = nDoors === 1 ? [ci] : nDoors === 2 ? [i0 + Math.floor(w * 0.3), i1 - Math.floor(w * 0.3)] : [i0 + 2, ci, i1 - 2];
    for (const c of cols) R.doors.push({i: c, x: (c + 0.5) * TS, z: j0 * TS + 4, open: false, reward: null});
  }
  // 소품 배치
  const P = AREA_PROPS[area];
  const nb = big ? Math.floor(rand(2, 4)) : Math.floor(rand(3, 7)), nk = big ? 2 : Math.floor(rand(2, 5));
  const okSpot = (x, z, rad) => {
    if (Math.hypot(x - R.entry.x, z - R.entry.z) < 150) return false;
    if (R.doors.some(d => Math.abs(d.x - x) < 70 && z - d.z < 130)) return false;
    if (Math.hypot(x - (ci + 0.5) * TS, z - (j0 + h / 2) * TS) < (big ? 220 : 90)) return false;
    if (R.props.some(p => Math.hypot(p.x - x, p.z - z) < (p.rad + rad) * 0.5 + 40)) return false;
    return R.free(x, z, rad * 0.5 + 6);
  };
  for (let k = 0, tries = 0; k < nb && tries < 200; tries++) {
    const name = pick(P.block), m = JS.props[name]; const s = R.randomFloor(m.rad * 0.5 + 4);
    if (okSpot(s.x, s.z, m.rad)) { R.addProp(name, s.x, s.z); k++; }
  }
  for (let k = 0, tries = 0; k < nk && tries < 200; tries++) {
    const name = pick(P.brk), m = JS.props[name]; const s = R.randomFloor(m.rad * 0.5 + 4);
    if (okSpot(s.x, s.z, m.rad)) { R.addProp(name, s.x, s.z); k++; }
  }
  if (P.flat) for (let k = 0; k < 3; k++) { const s = R.randomFloor(20); R.addProp(pick(P.flat), s.x, s.z); }
  const nd = JS.tiles[area].decals;
  for (let k = 0; k < Math.floor(rand(8, 16)); k++) { const s = R.randomFloor(10); R.decals.push({x: s.x + rand(-20, 20), z: s.z + rand(-20, 20), k: Math.floor(Math.random() * nd)}); }
  prerender(R);
  return R;
}

// 휴식방·상점방 (작고 고정된 모양)
function genSpecialRoom(area, kind) {
  const R = new Room(area, 18, 16);
  R.rect(4, 3, 13, 11); R.rect(8, 11, 9, 13);
  R.entry = {x: 8.9 * TS, z: 13.2 * TS}; R.topRow = 3; R.mainRect = [4, 3, 13, 11];
  R.doors.push({i: 9, x: 9.5 * TS, z: 3 * TS + 4, open: true, reward: null});
  if (kind === 'rest') R.addProp('fountain', 9 * TS, 7 * TS);
  if (kind === 'shop') R.addProp('shopkeep_stand', 9 * TS, 5.6 * TS);
  for (let k = 0; k < 6; k++) { const s = R.randomFloor(10); R.decals.push({x: s.x, z: s.z, k: Math.floor(Math.random() * JS.tiles[area].decals)}); }
  prerender(R); return R;
}

// ---------------- 마을 '쉼터' (고정 지도)
function genHub() {
  const R = new Room('hub', 32, 26);
  R.rect(3, 4, 28, 21); R.rect(12, 2, 19, 4); R.rect(14, 21, 17, 24);
  R.rect(1, 9, 3, 15); R.rect(28, 9, 30, 15);
  R.zones = [[4, 5, 10, 9], [21, 5, 27, 9]];   // 나무 데크
  R.entry = {x: 16 * TS, z: 20 * TS}; R.topRow = 2; R.mainRect = [3, 4, 28, 21];
  const P = (n, i, j) => R.addProp(n, i * TS, j * TS);
  P('hub_tank', 16, 12.6);
  P('hub_house', 7, 6.4); P('hub_house', 24.5, 6.4);
  P('lab_tent', 26, 16.5);
  P('altar', 7, 15.2);
  P('shopkeep_stand', 24.8, 11.5);
  P('lamp', 12.5, 9); P('lamp', 19.6, 9); P('lamp', 12.5, 17); P('lamp', 19.6, 17);
  P('glowtree', 4.6, 19.5); P('glowtree', 27.4, 20); P('glowtree', 4.3, 11); P('glowtree', 29.5, 13.5);
  P('bench', 11, 20); P('bench', 21, 20);
  P('crates', 21.6, 14.6); P('planter', 10, 13); P('planter', 22.4, 12.8);
  P('dummy', 11.2, 6.2); P('signpost', 18.6, 4.6);
  const portal = P('portal', 16, 2.7); portal.anim = true;
  R.portal = {x: 16 * TS, z: 2.9 * TS};
  R.npcs = [
    {id: 'mentor', x: 13.6 * TS, z: 14.4 * TS, d: 1},
    {id: 'merchant', x: 24.8 * TS, z: 12.6 * TS, d: 0},
    {id: 'drone', x: 25.2 * TS, z: 18.3 * TS, d: 7},
    {id: 'cat', x: 11.6 * TS, z: 20.6 * TS, d: 1},
  ];
  for (let k = 0; k < 26; k++) { const s = R.randomFloor(10); R.decals.push({x: s.x, z: s.z, k: Math.floor(Math.random() * JS.tiles.hub.decals)}); }
  prerender(R); return R;
}

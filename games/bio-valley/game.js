// 바이오 밸리: 게임 상태 + 시뮬레이션 + 화면에 세우기(건물·도로·장식·사람·차·생물·날씨)
import { N, HALF, MARGIN, tileX, tileZ, toTile } from './world.js';
import { TILE } from './art.js';
import { BIOMES } from './biomes.js';
import * as D from './data.js';
import { rng } from './lib/paperkit-2d.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 북 동 남 서 (비트 1 2 4 8)
const idx = (i, j) => j * N + i;
const inMap = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
const PARCEL = 8, PN = N / PARCEL;

export class Game {
  constructor(world, hooks = {}) {
    this.w = world; this.hooks = hooks;
    this.speed = 1; this.paused = false;
    this.agents = []; this.critters = []; this.bits = []; this.puffs = []; this.birds = [];
    this.acc = 0;
  }

  // ------------------------------------------------------------------------------------------------------------
  // 새 게임 / 불러오기
  // ------------------------------------------------------------------------------------------------------------
  start(biomeId, { seed = null, save = null, preview = false } = {}) {
    const biome = BIOMES[biomeId];
    this.biome = biome;
    this.seed = save ? save.seed : (seed ?? Math.floor(Math.random() * 1e6));
    this.preview = preview;
    const w = this.w;
    w.setup(biome);
    this.agents = []; this.critters = []; this.bits = []; this.puffs = []; this.birds = [];
    this.tile = new Uint8Array(N * N); this.bid = new Int32Array(N * N).fill(-1); this.owned = new Uint8Array(N * N);
    this.roadH = new Array(N * N).fill(null); this.decor = Array.from({ length: N * N }, () => []);
    this.buildings = new Map(); this.nextId = 1; this.pol = new Float32Array(N * N);
    this.money = D.START_MONEY; this.loan = 0; this.day = 0; this.month = 1; this.year = 1; this.tax = 10; this.fund = 1;
    this.biomass = 0; this.rp = 0; this.research = null; this.techDone = new Set(); this.unlocked = new Set([...D.START_UNLOCK, ...(D.BIOME_UNLOCK[biomeId] || [])]);
    this.landBought = 0; this.milestones = new Set(); this.goalDone = false; this.removedDecor = new Set();
    this.stats = { income: 0, expense: 0, cats: {} }; this.history = []; this.news = [];
    this.pop = 0; this.happy = 50; this.jobsTotal = 0; this.workers = 0; this.staffRatio = 0; this.roadCount = 0;
    this.rand = rng(this.seed + 99);
    this.defineBiomePrefabs();
    this.generate();
    // 처음 소유한 땅: 입구 주변 14×14
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (i >= 13 && i < 27 && j >= 26) this.owned[idx(i, j)] = 1;
    this.gate = { i: N / 2, j: N - 1 };
    if (save) this.applySave(save);
    else {
      this.placeRoad(this.gate.i, this.gate.j, { free: true, rise: false });
      this.placeRoad(this.gate.i, this.gate.j - 1, { free: true, rise: false });
    }
    this.placeGate();
    w.setOwned(this.owned);
    this.recalc();
    w.cam.tx = w.cam.x = tileX(N / 2); w.cam.tz = w.cam.z = tileZ(N - 7);
    w.cam.tdist = w.cam.dist = preview ? 170 : 125;
    w.cam.yaw = w.cam.tyaw = 0;
    this.spawnCritters();
  }

  defineBiomePrefabs() {
    const bk = this.w.baker, A = this.w.A, B = this.w.B, bio = this.biome;
    const nv = this.w.q === 'low' ? 2 : 3;
    this.nv = nv;
    for (const [k] of bio.decor) for (let v = 0; v < nv; v++) bk.define(`d:${k}:${v}`, () => A.decorPrefab(bio, k, v));
    for (let v = 0; v < 3; v++) bk.define('ridge:' + v, () => A.ridgePrefab(bio, v));
    if (bio.oasis) for (let v = 0; v < nv; v++) bk.define(`d:palm:${v}`, () => A.decorPrefab(bio, 'palm', v));
    for (const [type, d] of Object.entries(D.BUILD)) {
      if (d.model === 'house') for (let lv = 1; lv <= 3; lv++) for (let v = 0; v < 3; v++) bk.define(`b:house:${lv}:${v}`, () => B.M.house(lv, v));
      else if (d.model === 'decoTree') { /* 기존 나무 프리팹 사용 */ }
      else bk.define(`b:${type}`, () => B.M[d.model]());
    }
    bk.define('b:gate', () => B.M.gate());
    this.mainTree = bio.decor.find(([k]) => ['broadleaf', 'pine', 'blossom', 'saguaro'].includes(k))[0];
  }

  // ------------------------------------------------------------------------------------------------------------
  // 맵 생성: 호수 + 자연 장식(숲 무리) + 바깥 숲띠 + 배경 능선
  // ------------------------------------------------------------------------------------------------------------
  generate() {
    const r = rng(this.seed), bio = this.biome, w = this.w;
    // 낮은 진동수 잡음
    const nz = (x, z, s) => { const a = Math.sin(x * 0.11 * s + this.seed * 0.001) * Math.cos(z * 0.13 * s + 1.7) + Math.sin((x + z) * 0.07 * s + 4.1) * 0.6 + Math.sin(x * 0.29 * s - z * 0.21 * s + 2.3) * 0.35; return a / 1.95 * 0.5 + 0.5; };
    // 호수: 시작 땅을 피해 북쪽 절반 어딘가
    const li = 8 + Math.floor(r() * (N - 16)), lj = 6 + Math.floor(r() * 12), rx = (3 + r() * 2) * TILE, rz = (2.4 + r() * 1.6) * TILE;
    const cx = tileX(li), cz = tileZ(lj), pts = [];
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2, f = 0.82 + 0.22 * Math.sin(a * 3 + r() * 6) + (r() - 0.5) * 0.08; pts.push([cx + Math.cos(a) * rx * f, cz + Math.sin(a) * rz * f]); }
    const inside = (x, z, k = 1) => { let c = false; const P = k === 1 ? pts : pts.map(([px, pz]) => [cx + (px - cx) * k, cz + (pz - cz) * k]); for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    this.lakeShape = { cx, cz, rx, rz, pts, inside };
    w.buildGround(this.lakeShape);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (inside(tileX(i), tileZ(j), 1.05)) this.tile[idx(i, j)] = 3;
    // 장식 종류 뽑기(가중치)
    const kinds = bio.decor, total = kinds.reduce((s, [, n]) => s + n, 0);
    const pick = () => { let t = r() * total; for (const [k, n] of kinds) { t -= n; if (t <= 0) return k; } return kinds[0][0]; };
    const tall = new Set(['broadleaf', 'maple', 'pine', 'fir', 'birch', 'blossom', 'snowtree', 'saguaro', 'palm']);
    const low = this.w.q === 'low';
    const ring = low ? 6 : 10;
    let id = 0;
    this.decorList = [];
    for (let j = -ring; j < N + ring; j++) for (let i = -ring; i < N + ring; i++) {
      const x = tileX(i), z = tileZ(j), out = !inMap(i, j);
      if (inside(x, z, 1.12)) continue;
      // 입구 길(맵 바깥 남쪽)
      if (j >= N && Math.abs(i - N / 2) <= 1) continue;
      const nv0 = nz(i, j, 1), sm = Math.min(1, Math.max(0, (nv0 - 0.32) / 0.4));
      let dens = bio.density * (0.12 + 2.1 * sm * sm * (3 - 2 * sm));
      if (out) dens = Math.min(1, dens * 1.5 + 0.2) * (low ? 0.55 : 1);
      else if (j >= 28 && Math.abs(i - N / 2) < 6) dens *= 0.25;     // 입구 앞 빈터
      const nItems = r() < dens ? 1 + (r() < dens * 0.7 ? 1 : 0) + (r() < dens * 0.3 ? 1 : 0) : 0;
      for (let k = 0; k < nItems; k++) {
        let kind = pick();
        if (out && !tall.has(kind) && r() < 0.6) kind = kinds.find(([kk]) => tall.has(kk))?.[0] || kind;
        const v = Math.floor(r() * this.nv);
        const ox = (r() - 0.5) * TILE * 0.7, oz = (r() - 0.5) * TILE * 0.7;
        const item = { id: id++, k: kind, v, x: x + ox, z: z + oz, yaw: tall.has(kind) ? (r() - 0.5) * 0.5 + 0.42 : (r() - 0.5) * 0.3, s: 0.85 + r() * 0.3, i, j, h: null };
        this.decorList.push(item);
      }
    }
    // 오아시스 야자
    if (bio.oasis) for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, x = cx + Math.cos(a) * rx * 1.18, z = cz + Math.sin(a) * rz * 1.18, i = toTile(x), j = toTile(z); this.decorList.push({ id: id++, k: 'palm', v: k % this.nv, x, z, yaw: 0.42, s: 0.9 + r() * 0.25, i, j, h: null }); }
    // 배경 능선(맵 밖 네 방향)
    this.ridges = [];
    const far = HALF + ring * TILE + 16;
    for (let side = 0; side < 4; side++) for (let k = -2; k <= 2; k++) {
      const t = k * 52 + (r() - 0.5) * 16, ang = side * Math.PI / 2;
      const x = side === 0 ? t : side === 2 ? t : (side === 1 ? far : -far), z = side === 0 ? -far : side === 2 ? far : t;
      this.ridges.push({ x, z, yaw: [0, -Math.PI / 2, Math.PI, Math.PI / 2][side], v: (side + k + 5) % 3 });
    }
  }
  /** 장식을 실제로 세우기(인트로: 가까운 것부터 차례로 일어섬) */
  raiseWorld(anim = true) {
    const bk = this.w.baker;
    const c = this.w.cam;
    for (const it of this.decorList) {
      if (this.removedDecor.has(it.id)) continue;
      const delay = anim ? Math.min(2.2, Math.hypot(it.x - c.x, it.z - c.z) * 0.012 + Math.random() * 0.15) : 0;
      it.h = bk.add(`d:${it.k}:${it.v}`, { x: it.x, z: it.z, yaw: it.yaw, s: it.s, rise: anim, delay });
      if (inMap(it.i, it.j)) this.decor[idx(it.i, it.j)].push(it);
    }
    for (const rd of this.ridges) bk.add('ridge:' + rd.v, { x: rd.x, z: rd.z, yaw: rd.yaw, rise: anim, delay: anim ? 1.2 : 0 });
    // 맵 밖으로 이어지는 입구 길
    for (let j = N; j < N + 11; j++) bk.add('road5', { x: tileX(N / 2), z: tileZ(j) });
  }
  placeGate() { this.gateH = this.w.baker.add('b:gate', { x: tileX(N / 2), z: tileZ(N - 1) + TILE * 0.55, rise: false }); }

  // ------------------------------------------------------------------------------------------------------------
  // 도로
  // ------------------------------------------------------------------------------------------------------------
  isRoad(i, j) { if (j >= N && i === N / 2) return true; return inMap(i, j) && this.tile[idx(i, j)] === 1; }
  roadMask(i, j) { let m = 0; DIRS.forEach(([dx, dz], k) => { if (this.isRoad(i + dx, j + dz)) m |= 1 << k; }); return m; }
  refreshRoad(i, j) {
    if (!inMap(i, j) || this.tile[idx(i, j)] !== 1) return;
    const k = idx(i, j), m = this.roadMask(i, j), key = 'road' + m, old = this.roadH[k];
    if (old && old.b.key === key) return;
    if (old) this.w.baker.kill(old);
    this.roadH[k] = this.w.baker.add(key, { x: tileX(i), z: tileZ(j) });
  }
  canRoad(i, j) { if (!inMap(i, j)) return 'map'; const k = idx(i, j); if (!this.owned[k]) return 'own'; const t = this.tile[k]; if (t === 1) return 'dup'; if (t === 3) return 'water'; if (t === 2) return 'bld'; return null; }
  roadPrice(i, j) { return D.ROAD_COST + this.decor[idx(i, j)].length * D.CLEAR_COST; }
  placeRoad(i, j, { free = false, rise = true } = {}) {
    const err = this.canRoad(i, j); if (err) return err;
    const cost = free ? 0 : this.roadPrice(i, j);
    if (!free && this.money < cost) return 'money';
    this.spend(cost, '도로');
    this.clearDecor(i, j);
    this.tile[idx(i, j)] = 1;
    this.refreshRoad(i, j);
    for (const [dx, dz] of DIRS) this.refreshRoad(i + dx, j + dz);
    this.roadCount++;
    this.dirtyNet = true;
    return null;
  }
  removeRoad(i, j) {
    const k = idx(i, j); if (this.tile[k] !== 1) return 'none';
    if (i === this.gate.i && j === this.gate.j) return 'gate';
    this.tile[k] = 0; this.w.baker.kill(this.roadH[k]); this.roadH[k] = null; this.roadCount--;
    for (const [dx, dz] of DIRS) this.refreshRoad(i + dx, j + dz);
    this.dirtyNet = true;
    return null;
  }
  clearDecor(i, j) {
    const k = idx(i, j);
    for (const it of this.decor[k]) { if (it.h) this.w.baker.remove(it.h, true); this.removedDecor.add(it.id); }
    this.decor[k] = [];
  }

  // ------------------------------------------------------------------------------------------------------------
  // 건물
  // ------------------------------------------------------------------------------------------------------------
  /** 놓을 수 있는지: { ok, cost, err, face, cells } */
  check(type, i, j) {
    const d = D.BUILD[type], n = d.size, cells = [];
    let err = null, clear = 0;
    if (!this.unlocked.has(type)) err = 'lock';
    for (let y = j; y < j + n; y++) for (let x = i; x < i + n; x++) {
      let ok = true;
      if (!inMap(x, y)) ok = false;
      else { const k = idx(x, y); if (!this.owned[k]) { ok = false; err = err || 'own'; } else if (this.tile[k] !== 0) { ok = false; err = err || (this.tile[k] === 3 ? 'water' : 'occupied'); } clear += this.decor[k].length; }
      if (!inMap(x, y)) err = err || 'map';
      cells.push([x, y, ok ? 1 : 0]);
    }
    let face = null;
    if (!err) {
      face = this.facing(i, j, n);
      if (!face && d.road) err = 'road';
      if (!face) face = { yaw: 0, ai: -1, aj: -1 };
    }
    const cost = d.cost + clear * D.CLEAR_COST;
    if (!err && this.money < cost) err = 'money';
    for (const c of cells) if (err && err !== 'money' && err !== 'road') c[2] = c[2] && 0; else if (err === 'road' || err === 'money') c[2] = 0;
    return { ok: !err, err, cost, face, cells };
  }
  facing(i, j, n) {
    const sides = [
      { yaw: 0, list: Array.from({ length: n }, (_, k) => [i + k, j + n]) },
      { yaw: Math.PI / 2, list: Array.from({ length: n }, (_, k) => [i + n, j + k]) },
      { yaw: -Math.PI / 2, list: Array.from({ length: n }, (_, k) => [i - 1, j + k]) },
      { yaw: Math.PI, list: Array.from({ length: n }, (_, k) => [i + k, j - 1]) },
    ];
    for (const s of sides) {
      const roads = s.list.filter(([x, y]) => this.isRoad(x, y) && inMap(x, y));
      if (roads.length) { const m = roads[Math.floor(roads.length / 2)]; return { yaw: s.yaw, ai: m[0], aj: m[1] }; }
    }
    return null;
  }
  build(type, i, j, { rise = true, free = false, level = 1, residents = 0, yaw = null, id = null, variant = null } = {}) {
    const c = free ? { ok: true, cost: 0, face: this.facing(i, j, D.BUILD[type].size) || { yaw: 0, ai: -1, aj: -1 } } : this.check(type, i, j);
    if (!c.ok) return c;
    const d = D.BUILD[type], n = d.size;
    if (!free) this.spend(c.cost, '건설');
    for (let y = j; y < j + n; y++) for (let x = i; x < i + n; x++) { this.clearDecor(x, y); this.tile[idx(x, y)] = 2; }
    const b = { id: id ?? this.nextId++, type, i, j, n, level, residents, yaw: yaw ?? c.face.yaw, ai: c.face.ai, aj: c.face.aj, happy: 60, eff: 0, h: null, v: variant ?? Math.floor(this.rand() * 3), hiMonths: 0, puffT: Math.random() * 2 };
    this.nextId = Math.max(this.nextId, b.id + 1);
    for (let y = j; y < j + n; y++) for (let x = i; x < i + n; x++) this.bid[idx(x, y)] = b.id;
    this.buildings.set(b.id, b);
    this.show(b, rise);
    this.dirtyNet = true; this.dirtyPol = true;
    if (rise && this.hooks.sound) this.hooks.sound('build', n);
    return { ok: true, b };
  }
  keyOf(b) {
    const d = D.BUILD[b.type];
    if (d.model === 'house') return `b:house:${b.level}:${b.v % 3}`;
    if (d.model === 'decoTree') return `d:${this.mainTree}:${b.v % this.nv}`;
    return `b:${b.type}`;
  }
  center(b) { return { x: tileX(b.i) + (b.n - 1) * TILE / 2, z: tileZ(b.j) + (b.n - 1) * TILE / 2 }; }
  show(b, rise) {
    const { x, z } = this.center(b);
    b.h = this.w.baker.add(this.keyOf(b), { x, z, yaw: b.yaw, rise, data: b, s: D.BUILD[b.type].deco ? 0.8 : 1 });
  }
  demolish(b) {
    const d = D.BUILD[b.type];
    for (let y = b.j; y < b.j + b.n; y++) for (let x = b.i; x < b.i + b.n; x++) { this.tile[idx(x, y)] = 0; this.bid[idx(x, y)] = -1; }
    this.w.baker.remove(b.h, true);
    this.buildings.delete(b.id);
    if (!d.deco) this.earn(Math.round(d.cost * 0.4), '철거 환급');
    // 사는 사람은 떠남
    if (b.residents > 0) for (let k = 0; k < Math.min(3, b.residents); k++) this.walker(b, null, 'leave');
    this.dirtyNet = true; this.dirtyPol = true;
    if (this.hooks.sound) this.hooks.sound('fold', b.n);
  }
  levelUp(b, lv) {
    if (lv === b.level) return;
    const old = b.h; b.level = lv;
    this.w.baker.remove(old, true, () => {});
    setTimeout(() => { if (this.buildings.has(b.id)) this.show(b, true); }, 380);
    if (this.hooks.sound) this.hooks.sound('build', 1);
  }
  count(type) { let n = 0; for (const b of this.buildings.values()) if (b.type === type) n++; return n; }
  catCount(cat) { let n = 0; for (const b of this.buildings.values()) if (D.BUILD[b.type].cat === cat && D.BUILD[b.type].prod) n++; return n; }
  at(i, j) { if (!inMap(i, j)) return null; const id = this.bid[idx(i, j)]; return id >= 0 ? this.buildings.get(id) : null; }

  // ------------------------------------------------------------------------------------------------------------
  // 땅 구입
  // ------------------------------------------------------------------------------------------------------------
  parcelOf(i, j) { return { pi: Math.floor(i / PARCEL), pj: Math.floor(j / PARCEL) }; }
  parcelOwned(pi, pj) { return this.owned[idx(pi * PARCEL + PARCEL / 2, pj * PARCEL + PARCEL / 2)] && this.owned[idx(pi * PARCEL, pj * PARCEL)]; }
  landPrice() { return Math.round(1800 * Math.pow(1.35, this.landBought) / 50) * 50; }
  canBuy(pi, pj) {
    if (pi < 0 || pj < 0 || pi >= PN || pj >= PN) return 'map';
    let all = true; for (let y = 0; y < PARCEL; y++) for (let x = 0; x < PARCEL; x++) if (!this.owned[idx(pi * PARCEL + x, pj * PARCEL + y)]) all = false;
    if (all) return 'owned';
    let adj = false;
    for (let y = -1; y <= PARCEL; y++) for (let x = -1; x <= PARCEL; x++) { const ii = pi * PARCEL + x, jj = pj * PARCEL + y; if ((x === -1 || y === -1 || x === PARCEL || y === PARCEL) && inMap(ii, jj) && this.owned[idx(ii, jj)]) adj = true; }
    if (!adj) return 'far';
    if (this.money < this.landPrice()) return 'money';
    return null;
  }
  buyParcel(pi, pj) {
    const e = this.canBuy(pi, pj); if (e) return e;
    this.spend(this.landPrice(), '땅 구입');
    for (let y = 0; y < PARCEL; y++) for (let x = 0; x < PARCEL; x++) this.owned[idx(pi * PARCEL + x, pj * PARCEL + y)] = 1;
    this.landBought++;
    this.w.setOwned(this.owned);
    if (this.hooks.sound) this.hooks.sound('coin');
    return null;
  }

  // ------------------------------------------------------------------------------------------------------------
  // 돈
  // ------------------------------------------------------------------------------------------------------------
  spend(v, cat) { if (!v) return; this.money -= v; this.stats.expense += v; this.stats.cats[cat] = (this.stats.cats[cat] || 0) - v; }
  earn(v, cat) { if (!v) return; this.money += v; this.stats.income += v; this.stats.cats[cat] = (this.stats.cats[cat] || 0) + v; }
  value() { let v = this.money - this.loan; for (const b of this.buildings.values()) v += D.BUILD[b.type].cost * 0.6; return Math.round(v); }
  takeLoan(v) { if (this.loan + v > 30000) return 'max'; this.loan += v; this.money += v; return null; }
  repay(v) { v = Math.min(v, this.loan, Math.max(0, this.money)); this.loan -= v; this.money -= v; }
  techFx(k) { let m = 1; for (const t of D.TECH) if (this.techDone.has(t.id) && t.effect && t.effect[k]) m *= t.effect[k]; return m; }

  // ------------------------------------------------------------------------------------------------------------
  // 도로망 연결(입구에서 닿는 도로)
  // ------------------------------------------------------------------------------------------------------------
  calcNet() {
    const seen = new Uint8Array(N * N), q = [[this.gate.i, this.gate.j]];
    if (this.isRoad(this.gate.i, this.gate.j)) seen[idx(this.gate.i, this.gate.j)] = 1;
    while (q.length) { const [i, j] = q.pop(); for (const [dx, dz] of DIRS) { const a = i + dx, b = j + dz; if (inMap(a, b) && !seen[idx(a, b)] && this.tile[idx(a, b)] === 1) { seen[idx(a, b)] = 1; q.push([a, b]); } } }
    this.net = seen;
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type];
      if (!d.road) { b.conn = true; continue; }
      // 접근 도로가 사라졌으면 다시 찾기
      if (b.ai < 0 || !this.isRoad(b.ai, b.aj)) { const f = this.facing(b.i, b.j, b.n); if (f) { b.ai = f.ai; b.aj = f.aj; } else { b.ai = -1; b.aj = -1; } }
      b.conn = b.ai >= 0 && !!seen[idx(b.ai, b.aj)];
    }
    this.dirtyNet = false;
  }
  path(a, b) {   // 도로 칸 a → b (BFS)
    if (!a || !b) return null;
    const prev = new Int32Array(N * N).fill(-1), s = idx(a[0], a[1]), t = idx(b[0], b[1]);
    if (s === t) return [a];
    const q = [s]; prev[s] = s;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % N, j = (k - i) / N;
      if (k === t) break;
      for (const [dx, dz] of DIRS) { const x = i + dx, y = j + dz; if (!inMap(x, y)) continue; const kk = idx(x, y); if (prev[kk] < 0 && this.tile[kk] === 1) { prev[kk] = k; q.push(kk); } }
    }
    if (prev[t] < 0) return null;
    const out = []; for (let k = t; k !== s; k = prev[k]) out.push([k % N, Math.floor(k / N)]);
    out.push(a); return out.reverse();
  }

  // ------------------------------------------------------------------------------------------------------------
  // 오염·행복
  // ------------------------------------------------------------------------------------------------------------
  calcPol() {
    const P = this.pol; P.fill(0);
    const fx = this.techFx('pol');
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type]; if (!d.pol) continue;
      const amt = d.pol * fx * (0.4 + 0.6 * (b.eff || 0)), R = d.polR, c = this.center(b), ci = toTile(c.x), cj = toTile(c.z);
      for (let y = cj - R; y <= cj + R; y++) for (let x = ci - R; x <= ci + R; x++) { if (!inMap(x, y)) continue; const dd = Math.hypot(x - ci, y - cj) / (R + 0.5); if (dd < 1) P[idx(x, y)] += amt * (1 - dd); }
    }
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type]; if (!d.clean) continue;
      const R = d.cleanR, c = this.center(b), ci = toTile(c.x), cj = toTile(c.z), k = d.clean * (0.3 + 0.7 * (b.eff || 0));
      for (let y = cj - R; y <= cj + R; y++) for (let x = ci - R; x <= ci + R; x++) if (inMap(x, y)) P[idx(x, y)] *= 1 - k * (1 - Math.hypot(x - ci, y - cj) / (R + 1));
    }
    for (let k = 0; k < P.length; k++) P[k] = Math.min(1, Math.max(0, P[k]));
    this.w.setPollution(P);
    this.dirtyPol = false;
  }
  dist(b, ci, cj) { // 칸 (ci,cj) 에서 건물 b 의 땅까지 체비셰프 거리
    const dx = ci < b.i ? b.i - ci : ci > b.i + b.n - 1 ? ci - (b.i + b.n - 1) : 0, dz = cj < b.j ? b.j - cj : cj > b.j + b.n - 1 ? cj - (b.j + b.n - 1) : 0;
    return Math.max(dx, dz);
  }
  houseHappy(h) {
    const ci = h.i + (h.n - 1) / 2, cj = h.j + (h.n - 1) / 2;
    let amen = 0, why = [];
    for (const b of this.buildings.values()) { const d = D.BUILD[b.type]; if (!d.hap || b === h) continue; if (this.dist(b, Math.round(ci), Math.round(cj)) <= d.hapR) { const v = d.hap * (d.jobs ? 0.4 + 0.6 * (b.eff || 0) : 1); amen += v; if (v >= 6) why.push(d.name); } }
    amen = Math.min(36, amen);
    let trees = 0; for (let y = h.j - 2; y < h.j + h.n + 2; y++) for (let x = h.i - 2; x < h.i + h.n + 2; x++) if (inMap(x, y)) trees += this.decor[idx(x, y)].length;
    const pol = this.pol[idx(Math.round(ci), Math.round(cj))] || 0;
    let v = 48 + (this.biome.bonus.happy || 0) + amen + Math.min(7, trees * 0.8) - pol * 45;
    v -= this.tax > 10 ? (this.tax - 10) * 2.5 : -(10 - this.tax) * 1.0;
    if (this.unemp > 0.15) v -= 18 * this.unemp;
    if (!h.conn) v -= 25;
    h.happy = Math.max(0, Math.min(100, Math.round(v)));
    // 생각(가장 큰 이유)
    const t = [];
    if (!h.conn) t.push([30, '입구까지 이어진 길이 없어요!']);
    if (pol > 0.35) t.push([pol * 50, '공장 냄새 때문에 창문을 못 열어요.']);
    if (this.unemp > 0.2) t.push([this.unemp * 60, '일자리를 구하고 있어요.']);
    if (this.tax > 13) t.push([(this.tax - 10) * 4, '세금이 너무 비싸요.']);
    if (amen < 6) t.push([12, '근처에 쉴 곳(공원·카페)이 있으면 좋겠어요.']);
    if (amen >= 20) t.push([amen * 0.6, `${why[0] || '공원'}이 가까워서 좋아요!`]);
    if (trees >= 4) t.push([10, '창밖의 나무가 예뻐요.']);
    if (h.happy >= 80) t.push([h.happy * 0.3, '바이오 밸리에 살아서 행복해요!']);
    t.sort((a, b) => b[0] - a[0]);
    h.thought = t.length ? t[0][1] : '오늘도 평범한 하루예요.';
  }

  // ------------------------------------------------------------------------------------------------------------
  // 하루가 지날 때
  // ------------------------------------------------------------------------------------------------------------
  recalc() {
    if (this.dirtyNet || !this.net) this.calcNet();
    let pop = 0, jobs = 0, cap = 0;
    const jf = this.techFx('jobs');
    for (const b of this.buildings.values()) { const d = D.BUILD[b.type]; if (d.res) { pop += b.residents; cap += d.res[b.level] || 0; } if (d.jobs && b.conn) jobs += Math.ceil(d.jobs * jf); }
    this.pop = pop; this.cap = cap; this.jobsTotal = jobs;
    this.workers = Math.floor(pop * 0.8);
    this.staffRatio = jobs ? Math.min(1, this.workers / jobs) : 0;
    this.unemp = this.workers > jobs ? (this.workers - jobs) / Math.max(1, this.workers) : 0;
    if (this.dirtyPol) this.calcPol();
    let hs = 0, hn = 0;
    for (const b of this.buildings.values()) if (D.BUILD[b.type].res) { this.houseHappy(b); hs += b.happy * Math.max(1, b.residents); hn += Math.max(1, b.residents); }
    this.happy = hn ? Math.round(hs / hn) : 50;
  }
  dayTick() {
    this.recalc();
    const bio = this.biome, prodFx = this.techFx('prod'), revFx = this.techFx('rev');
    const hf = 0.7 + 0.3 * this.happy / 100;
    const waters = [...this.buildings.values()].filter((b) => b.type === 'water' && b.conn);
    let income = 0, sales = 0, labRev = 0;
    // 생산
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type];
      if (!d.jobs && !d.rev) { b.eff = d.hap ? 1 : 0; continue; }
      let eff = b.conn ? (d.jobs ? this.staffRatio : 1) * hf : 0;
      eff *= bio.bonus[b.type] || 1;
      if (d.prod) {
        const near = waters.some((w) => this.dist(w, b.i, b.j) <= D.BUILD.water.waterR);
        if (bio.needWater) eff *= near ? (bio.bonus.water || 1) : 0.55; else if (near) eff *= 1.15;
        if (d.needTrees) { let t = 0; for (let y = b.j - 4; y < b.j + b.n + 4; y++) for (let x = b.i - 4; x < b.i + b.n + 4; x++) if (inMap(x, y)) t += this.decor[idx(x, y)].length; eff *= Math.min(1.3, 0.45 + t / 14); b.trees = t; }
        b.out = d.prod * eff * prodFx; this.biomass += b.out;
      }
      b.eff = Math.min(2, eff);
    }
    // 가공
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type];
      if (d.use) { const need = d.use * b.eff, take = Math.min(need, this.biomass); this.biomass -= take; b.used = take; b.made = take * d.val * revFx; sales += b.made; b.short = need > 0 && take < need * 0.7; }
      if (d.rev) { const r = d.rev * b.eff * revFx; b.made = r; labRev += r; }
    }
    // 연구
    let rp = 0, school = 1;
    for (const b of this.buildings.values()) { const d = D.BUILD[b.type]; if (d.rp) rp += d.rp * b.eff; if (d.research && b.eff > 0.3) school = d.research; }
    const fundMul = [0.35, 1, 1.5, 2][this.fund], fundCost = [0, 5, 10, 20][this.fund];
    this.rp += rp * school * fundMul;
    this.spend(fundCost, '연구비');
    this.checkResearch();
    // 저장 한도 넘치면 헐값에
    let store = 60; for (const b of this.buildings.values()) if (D.BUILD[b.type].store && b.conn) store += D.BUILD[b.type].store;
    this.store = store;
    if (this.biomass > store) { const over = this.biomass - store; this.biomass = store; this.earn(Math.round(over * D.RAW_PRICE), '원료 판매'); }
    this.earn(Math.round(sales), '제품 판매'); this.earn(Math.round(labRev), '연구 서비스');
    // 세금·유지비·월급(매일 나눠서)
    this.earn(Math.round(this.pop * this.tax / 100 * 0.8), '세금');
    let upkeep = 0; for (const b of this.buildings.values()) upkeep += D.BUILD[b.type].upkeep || 0;
    this.spend(Math.round(upkeep / D.MONTH_DAYS), '유지비');
    this.spend(Math.round(Math.min(this.workers, this.jobsTotal) * D.SALARY / D.MONTH_DAYS), '월급');
    if (this.loan > 0) this.spend(Math.round(this.loan * 0.01 / D.MONTH_DAYS), '이자');
    // 이사 오고 가기
    this.migrate();
    // 날짜
    this.day++;
    if (this.day >= D.MONTH_DAYS) { this.day = 0; this.monthEnd(); }
    if (this.dirtyPol || this.day % 5 === 0) this.calcPol();
    this.checkGoals();
  }
  migrate() {
    const houses = [...this.buildings.values()].filter((b) => D.BUILD[b.type].res && b.conn);
    const vac = houses.reduce((s, h) => s + Math.max(0, (D.BUILD[h.type].res[h.level] || 0) - h.residents), 0);
    if (vac > 0) {
      const attract = Math.max(0, (this.happy - 38) / 18) + (this.jobsTotal > this.workers ? 1.2 : 0) + (this.pop < 10 ? 1.5 : 0);
      let n = Math.min(vac, Math.floor(this.rand() * (1 + attract * 1.6)));
      while (n-- > 0) {
        const cand = houses.filter((h) => h.residents < (D.BUILD[h.type].res[h.level] || 0)).sort((a, b) => b.happy - a.happy + (this.rand() - 0.5) * 30);
        const h = cand[0]; if (!h) break;
        h.residents++;
        if (this.rand() < 0.7) this.walker(null, h, 'arrive');
      }
    }
    for (const h of houses) if (h.happy < 28 && h.residents > 0 && this.rand() < 0.12) { h.residents--; this.walker(h, null, 'leave'); }
  }
  monthEnd() {
    this.month++;
    if (this.month > 12) { this.month = 1; this.year++; }
    // 집 키우기
    for (const b of this.buildings.values()) {
      if (b.type !== 'house') continue;
      const cap = D.BUILD.house.res[b.level];
      if (b.level < 3 && b.happy >= (b.level === 1 ? 66 : 78) && b.residents >= cap * 0.75) { b.hiMonths++; if (b.hiMonths >= 2) { b.hiMonths = 0; this.levelUp(b, b.level + 1); this.say(`숙소가 ${b.level}층으로 커졌어요!`); } }
      else b.hiMonths = 0;
    }
    this.history.push({ y: this.year, m: this.month, inc: this.stats.income, exp: this.stats.expense, pop: this.pop, money: this.money, cats: this.stats.cats });
    if (this.history.length > 36) this.history.shift();
    if (this.hooks.month) this.hooks.month(this.stats);
    this.stats = { income: 0, expense: 0, cats: {} };
    if (this.hooks.save) this.hooks.save();
  }
  checkResearch() {
    if (!this.research) { const next = D.TECH.find((t) => !this.techDone.has(t.id)); if (next && this.rp > 0) this.research = next.id; }
    const t = D.TECH.find((x) => x.id === this.research);
    if (t && this.rp >= t.cost) {
      this.rp -= t.cost; this.techDone.add(t.id);
      for (const u of t.unlock || []) this.unlocked.add(u);
      this.research = null;
      this.say(`연구 완료: ${t.name}!`, t.sci);
      if (this.hooks.tech) this.hooks.tech(t);
    }
  }
  checkGoals() {
    for (const m of D.MILESTONES) if (!this.milestones.has(m.id) && m.check(this)) { this.milestones.add(m.id); this.earn(m.reward, '목표 보상'); this.say(`목표 달성: ${m.text} (+${m.reward})`); if (this.hooks.sound) this.hooks.sound('coin'); }
    if (!this.goalDone && this.pop >= D.GOAL.pop && this.value() >= D.GOAL.value) { this.goalDone = true; if (this.hooks.goal) this.hooks.goal(); }
  }
  say(text, sub = '') { this.news.push({ text, sub, t: performance.now() }); if (this.news.length > 30) this.news.shift(); if (this.hooks.news) this.hooks.news(text, sub); }
  level() { let L = D.LEVELS[0]; for (const l of D.LEVELS) if (this.pop >= l.pop) L = l; return L; }

  // ------------------------------------------------------------------------------------------------------------
  // 사람·차
  // ------------------------------------------------------------------------------------------------------------
  maxWalkers() { return this.w.q === 'high' ? 70 : this.w.q === 'mid' ? 45 : 24; }
  access(b) { return b && b.ai >= 0 ? [b.ai, b.aj] : null; }
  walker(from, to, kind) {
    if (this.preview) return;
    if (this.agents.filter((a) => !a.truck).length >= this.maxWalkers()) return;
    const a = from ? this.access(from) : [this.gate.i, this.gate.j], b = to ? this.access(to) : [this.gate.i, this.gate.j];
    if (!a || !b) return;
    const p = this.path(a, b); if (!p) return;
    let v = 0;
    const tt = to && D.BUILD[to.type].cat;
    if (tt === 'lab') v = 0; else if (tt === 'farm') v = 1; else if (tt === 'factory') v = 2; else if (tt === 'life') v = this.rand() < 0.5 ? 4 : 5; else v = [0, 1, 2, 3, 4, 5][Math.floor(this.rand() * 6)];
    this.spawnAgent(p, { kind, v, truck: false, from, to });
  }
  truck(from, to, k = 0) {
    if (this.preview) return;
    if (this.agents.filter((a) => a.truck).length >= (this.w.q === 'low' ? 5 : 10)) return;
    const a = this.access(from), b = to ? this.access(to) : [this.gate.i, this.gate.j];
    const p = this.path(a, b); if (!p || p.length < 2) return;
    this.spawnAgent(p, { kind: 'truck', v: k, truck: true, from, to });
  }
  spawnAgent(p, o) {
    // 칸 중심 경유점 + 오른쪽 차선
    const pts = [];
    const lane = o.truck ? 0.75 : 1.55;
    for (let n = 0; n < p.length; n++) {
      const [i, j] = p[n], prev = p[Math.max(0, n - 1)], next = p[Math.min(p.length - 1, n + 1)];
      let dx = next[0] - prev[0], dz = next[1] - prev[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      pts.push([tileX(i) - dz * lane, tileZ(j) + dx * lane]);
    }
    if (o.kind === 'leave' || (!o.to && !o.truck)) { const [x, z] = pts[pts.length - 1]; pts.push([x, z + TILE * 3]); }
    if (o.kind === 'arrive' || (!o.from && !o.truck)) { const [x, z] = pts[0]; pts.unshift([x, z + TILE * 3]); }
    if (o.truck && !o.to) { const [x, z] = pts[pts.length - 1]; pts.push([x, z + TILE * 4]); }
    const key = o.truck ? 'truck' + o.v : 'person' + o.v;
    const [x0, z0] = pts[0];
    const h = this.w.baker.add(key, { x: x0, z: z0, rise: true, s: 1 });
    const name = D.NAMES[Math.floor(this.rand() * D.NAMES.length)];
    this.agents.push({ h, pts, seg: 0, t: 0, speed: o.truck ? 7 : 2.4 + this.rand() * 0.6, truck: o.truck, phase: this.rand() * 6, name, home: o.kind === 'leave' ? o.from : o.to?.type === 'house' || o.to?.type === 'apartment' ? o.to : o.from, to: o.to, kind: o.kind, done: false });
  }
  stepAgents(dt) {
    const camYaw = this.w.cam.tyaw, rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    for (const a of this.agents) {
      if (a.done) continue;
      if (a.h.state === 'rise' && a.h.t < 0.3) continue;
      let move = a.speed * dt;
      while (move > 0 && a.seg < a.pts.length - 1) {
        const [x0, z0] = a.pts[a.seg], [x1, z1] = a.pts[a.seg + 1], L = Math.hypot(x1 - x0, z1 - z0);
        const left = L * (1 - a.t);
        if (move >= left) { move -= left; a.seg++; a.t = 0; } else { a.t += move / L; move = 0; }
      }
      if (a.seg >= a.pts.length - 1) { a.done = true; this.w.baker.remove(a.h, true); continue; }
      const [x0, z0] = a.pts[a.seg], [x1, z1] = a.pts[a.seg + 1];
      const x = x0 + (x1 - x0) * a.t, z = z0 + (z1 - z0) * a.t, dx = x1 - x0, dz = z1 - z0;
      a.phase += dt * a.speed * 2.6;
      if (a.truck) { a.h.y = Math.abs(Math.sin(a.phase * 0.6)) * 0.04; this.w.baker.move(a.h, x, z, Math.atan2(dx, dz)); }
      else { a.h.flip = dx * rx + dz * rz < 0; a.h.rock = Math.sin(a.phase) * 0.07; a.h.y = Math.abs(Math.cos(a.phase)) * 0.12; this.w.baker.move(a.h, x, z, 0); }
    }
    this.agents = this.agents.filter((a) => !a.done || a.h.alive);
  }
  ambientTraffic(dt) {
    if (this.preview) return;
    this.trafT = (this.trafT || 0) - dt;
    if (this.trafT > 0) return;
    this.trafT = 0.5 / Math.max(0.6, Math.min(4, this.pop / 40));
    const bl = [...this.buildings.values()].filter((b) => b.conn && b.ai >= 0);
    if (!bl.length) return;
    const homes = bl.filter((b) => D.BUILD[b.type].res && b.residents > 0), works = bl.filter((b) => D.BUILD[b.type].jobs || D.BUILD[b.type].hap);
    const r = this.rand();
    if (homes.length && works.length && r < 0.75) {
      const h = homes[Math.floor(this.rand() * homes.length)], w = works[Math.floor(this.rand() * works.length)];
      if (this.rand() < 0.5) this.walker(h, w, 'go'); else this.walker(w, h, 'home');
    } else {
      const prods = bl.filter((b) => D.BUILD[b.type].prod && b.eff > 0.2), procs = bl.filter((b) => D.BUILD[b.type].use || D.BUILD[b.type].store);
      if (prods.length && this.rand() < 0.6) { const p = prods[Math.floor(this.rand() * prods.length)]; this.truck(p, procs.length ? procs[Math.floor(this.rand() * procs.length)] : null, 0); }
      else { const sell = bl.filter((b) => (D.BUILD[b.type].use && b.made > 0) || D.BUILD[b.type].rev > 20); if (sell.length) this.truck(sell[Math.floor(this.rand() * sell.length)], null, 1); }
    }
  }

  // ------------------------------------------------------------------------------------------------------------
  // 살아 있는 세계: 동물·새·나비·연기·날씨
  // ------------------------------------------------------------------------------------------------------------
  spawnCritters() {
    const bio = this.biome, n = this.w.q === 'low' ? 5 : 10;
    for (let k = 0; k < n; k++) {
      const kind = bio.critters[k % bio.critters.length];
      for (let tries = 0; tries < 30; tries++) {
        const i = 2 + Math.floor(this.rand() * (N - 4)), j = 2 + Math.floor(this.rand() * (N - 4));
        if (this.tile[idx(i, j)] !== 0) continue;
        const x = tileX(i), z = tileZ(j);
        this.critters.push({ kind, h: null, x, z, hx: x, hz: z, tx: x, tz: z, wait: this.rand() * 3, hop: 0 });
        break;
      }
    }
    if (bio.id !== 'snow' && this.lakeShape) for (let k = 0; k < 3; k++) { const L = this.lakeShape; this.critters.push({ kind: 'duck', swim: true, h: null, x: L.cx + (k - 1) * 4, z: L.cz + k, hx: L.cx, hz: L.cz, tx: L.cx, tz: L.cz, wait: k, hop: 0 }); }
    if (bio.butterflies) for (let k = 0; k < (this.w.q === 'low' ? 3 : 7); k++) this.critters.push({ kind: 'butterfly', fly: true, h: null, x: 0, z: 0, hx: 0, hz: 0, tx: 0, tz: 0, wait: 0, hop: 0, follow: true, ph: this.rand() * 6 });
  }
  stepLife(dt, rt) {
    const bk = this.w.baker, cam = this.w.cam, t = this.w.time;
    // 동물
    for (const c of this.critters) {
      if (!c.h) { c.h = bk.add('critter:' + c.kind, { x: c.x, z: c.z, rise: true, delay: 1.5 + Math.random() }); }
      if (c.fly) {   // 나비: 카메라 근처 꽃 위를 팔랑
        if (c.follow && (Math.hypot(c.x - cam.x, c.z - cam.z) > 50 || !c.init)) { c.init = true; c.x = cam.x + (Math.random() - 0.5) * 50; c.z = cam.z + (Math.random() - 0.5) * 40; c.tx = c.x; c.tz = c.z; }
        c.ph += rt * 9; if (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.5) { c.tx = c.x + (Math.random() - 0.5) * 10; c.tz = c.z + (Math.random() - 0.5) * 10; }
        const d = Math.hypot(c.tx - c.x, c.tz - c.z) || 1; c.x += (c.tx - c.x) / d * rt * 2.2; c.z += (c.tz - c.z) / d * rt * 2.2;
        c.h.rock = -Math.PI / 2 + 0.6 + Math.sin(c.ph) * 0.6; bk.move(c.h, c.x, c.z, Math.atan2(c.tx - c.x, c.tz - c.z), 1.6 + Math.sin(c.ph * 0.3) * 0.5); continue;
      }
      c.wait -= rt;
      if (c.wait <= 0 && c.hop <= 0) {
        for (let tries = 0; tries < 8; tries++) {
          const nx = c.hx + (Math.random() - 0.5) * TILE * (c.swim ? 2.5 : 4), nz = c.hz + (Math.random() - 0.5) * TILE * (c.swim ? 2 : 4), i = toTile(nx), j = toTile(nz);
          const okTile = c.swim ? (this.lakeShape && this.lakeShape.inside(nx, nz, 0.75)) : inMap(i, j) && this.tile[idx(i, j)] === 0;
          if (okTile) { c.tx = nx; c.tz = nz; c.hop = 1; break; }
        }
        c.wait = 1.5 + Math.random() * 4;
      }
      if (c.hop > 0) {
        const d = Math.hypot(c.tx - c.x, c.tz - c.z), sp = c.swim ? 0.8 : c.kind === 'deer' ? 4 : 3;
        if (d < 0.2) c.hop = 0; else { c.x += (c.tx - c.x) / d * Math.min(d, sp * rt); c.z += (c.tz - c.z) / d * Math.min(d, sp * rt); }
        const rxv = Math.cos(cam.tyaw), rzv = -Math.sin(cam.tyaw);
        c.h.flip = (c.tx - c.x) * rxv + (c.tz - c.z) * rzv < 0;
        c.ph = (c.ph || 0) + rt * 12;
        const y = c.swim ? 0 : Math.abs(Math.sin(c.ph)) * 0.35;
        bk.move(c.h, c.x, c.z, 0, y);
      }
      // 길이 생기면 비켜 감
      const i = toTile(c.x), j = toTile(c.z);
      if (!c.swim && inMap(i, j) && this.tile[idx(i, j)] !== 0) { c.hx = c.x + (Math.random() - 0.5) * 20; c.hz = c.z + (Math.random() - 0.5) * 20; c.wait = 0; }
    }
    // 새 떼: 가끔 하늘을 가로지름
    if (this.biome.birds) {
      this.birdT = (this.birdT ?? 4) - rt;
      if (this.birdT <= 0) {
        this.birdT = 12 + Math.random() * 14;
        const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), n = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) this.birds.push({ x: cam.x - dx * 90 + (Math.random() - 0.5) * 8 - dz * k * 3, z: cam.z - dz * 90 + (Math.random() - 0.5) * 8 + dx * k * 3, dx, dz, y: 20 + k * 1.2 + Math.random() * 3, ph: Math.random() * 6, life: 0, h: null });
      }
      for (const b of this.birds) {
        if (!b.h) b.h = bk.add('bit:bird', { x: b.x, z: b.z, y: b.y, s: 1.4 });
        b.life += rt; b.ph += rt * 7; b.x += b.dx * rt * 11; b.z += b.dz * rt * 11;
        b.h.rock = -Math.PI / 2 + 0.25 + Math.sin(b.ph) * 0.35;
        bk.move(b.h, b.x, b.z, Math.atan2(b.dx, b.dz), b.y + Math.sin(b.ph * 0.5) * 0.3);
        if (b.life > 18) { bk.kill(b.h); b.dead = true; }
      }
      this.birds = this.birds.filter((b) => !b.dead);
    }
    // 굴뚝 연기
    for (const b of this.buildings.values()) {
      const d = D.BUILD[b.type]; if (!d.chimney || !(b.eff > 0.15) || !b.h || b.h.state !== 'idle') continue;
      b.puffT -= rt;
      if (b.puffT <= 0 && this.puffs.length < 40) {
        b.puffT = 1.2 + Math.random() * 0.8;
        const c = this.center(b);
        for (const [cx, cy, cz] of d.chimney) {
          const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), x = c.x + cx * cs + cz * sn, z = c.z - cx * sn + cz * cs;
          this.puffs.push({ x, y: cy, z, life: 0, h: bk.add('bit:puff', { x, y: cy, z, rise: true, s: 0.6 + Math.random() * 0.3 }) });
        }
      }
    }
    for (const p of this.puffs) {
      p.life += rt; p.y += rt * 1.4; p.x += rt * 0.9; p.z -= rt * 0.3;
      p.h.faceYaw = cam.tyaw; p.h.yaw = cam.tyaw; bk.move(p.h, p.x, p.z, cam.tyaw, p.y);
      if (p.life > 3.4 && p.h.state === 'idle') { bk.remove(p.h, true); p.dead = true; }
    }
    this.puffs = this.puffs.filter((p) => !p.dead);
    // 날씨 조각
    const max = this.w.q === 'high' ? 70 : this.w.q === 'mid' ? 40 : 18, kind = this.biome.weather;
    const area = Math.min(90, 26 + cam.dist * 0.35);
    while (this.bits.length < max) {
      const k = this.biome.weather2 && Math.random() < 0.4 ? this.biome.weather2 : kind;
      const dust = k === 'dust';
      const b = { k, x: cam.x + (Math.random() - 0.5) * area * 2, z: cam.z + (Math.random() - 0.5) * area * 1.6, y: dust ? 0.4 + Math.random() * 3 : 6 + Math.random() * 18, ph: Math.random() * 6, spin: (Math.random() - 0.5) * 3, life: 0, land: 0 };
      b.h = bk.add('bit:' + k, { x: b.x, z: b.z, y: b.y, s: k === 'snow' ? 0.8 : 1 });
      this.bits.push(b);
    }
    const wind = [1.2, -0.4];
    for (const b of this.bits) {
      b.life += rt; b.ph += rt * (b.k === 'snow' ? 1.5 : 3);
      if (b.land > 0) { b.land -= rt; if (b.land <= 0) { bk.kill(b.h); b.dead = true; } continue; }
      if (b.k === 'dust') { b.x += rt * 7; b.z += Math.sin(b.ph) * rt; b.y += Math.sin(b.ph * 1.3) * rt * 0.5; if (b.life > 4) { bk.kill(b.h); b.dead = true; continue; } }
      else {
        const fall = { snow: 1.3, leaf: 1.9, leaf2: 1.9, petal: 1.4, needle: 2.6 }[b.k] || 2;
        b.y -= fall * rt; b.x += (wind[0] + Math.sin(b.ph) * 1.2) * rt; b.z += (wind[1] + Math.cos(b.ph * 0.7) * 0.6) * rt;
        if (b.y <= 0.06) { b.y = 0.06; b.land = 2.5 + Math.random() * 2; b.h.rock = -Math.PI / 2 + 0.05; bk.move(b.h, b.x, b.z, b.spin * 3); continue; }
      }
      b.h.rock = Math.sin(b.ph) * 1.1 - 0.5;
      bk.move(b.h, b.x, b.z, b.ph * b.spin, b.y);
      if (Math.abs(b.x - cam.x) > area * 1.3 || Math.abs(b.z - cam.z) > area * 1.3) { bk.kill(b.h); b.dead = true; }
    }
    this.bits = this.bits.filter((b) => !b.dead);
  }

  // ------------------------------------------------------------------------------------------------------------
  // 매 프레임
  // ------------------------------------------------------------------------------------------------------------
  update(rt) {
    const dt = this.paused ? 0 : rt * this.speed;
    if (!this.preview && !this.paused) {
      this.acc += dt;
      while (this.acc >= D.DAY_SEC) { this.acc -= D.DAY_SEC; this.dayTick(); }
      this.ambientTraffic(dt);
    }
    this.stepAgents(dt);
    this.stepLife(dt, rt);
  }

  // ------------------------------------------------------------------------------------------------------------
  // 저장
  // ------------------------------------------------------------------------------------------------------------
  toSave() {
    const roads = []; for (let k = 0; k < N * N; k++) if (this.tile[k] === 1) roads.push(k);
    let own = ''; for (let k = 0; k < N * N; k += 4) own += ((this.owned[k] | this.owned[k + 1] << 1 | this.owned[k + 2] << 2 | this.owned[k + 3] << 3)).toString(16);
    return {
      v: 1, biome: this.biome.id, seed: this.seed, money: Math.round(this.money), loan: this.loan, day: this.day, month: this.month, year: this.year, tax: this.tax, fund: this.fund,
      biomass: Math.round(this.biomass), rp: this.rp, research: this.research, tech: [...this.techDone], unlocked: [...this.unlocked], land: this.landBought, ms: [...this.milestones], goal: this.goalDone,
      removed: [...this.removedDecor], roads, own, history: this.history.slice(-24),
      b: [...this.buildings.values()].map((b) => [b.id, b.type, b.i, b.j, b.level, b.residents, Math.round(b.yaw * 100) / 100, b.v]),
    };
  }
  applySave(s) {
    Object.assign(this, { money: s.money, loan: s.loan, day: s.day, month: s.month, year: s.year, tax: s.tax, fund: s.fund, biomass: s.biomass, rp: s.rp, research: s.research, landBought: s.land, goalDone: s.goal, history: s.history || [] });
    this.techDone = new Set(s.tech); this.unlocked = new Set(s.unlocked); this.milestones = new Set(s.ms); this.removedDecor = new Set(s.removed);
    for (let k = 0; k < N * N; k += 4) { const v = parseInt(s.own[k / 4], 16); for (let b = 0; b < 4; b++) this.owned[k + b] = (v >> b) & 1; }
    for (const k of s.roads) { this.tile[k] = 1; this.roadCount++; }
    for (const k of s.roads) this.refreshRoad(k % N, Math.floor(k / N));
    for (const [id, type, i, j, lv, res, yaw, v] of s.b) {
      if (!D.BUILD[type]) continue;
      const d = D.BUILD[type];
      for (let y = j; y < j + d.size; y++) for (let x = i; x < i + d.size; x++) this.tile[idx(x, y)] = 0;
      this.build(type, i, j, { free: true, rise: false, level: lv, residents: res, yaw, id, variant: v });
    }
  }
}

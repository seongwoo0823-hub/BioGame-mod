/* 감염 도시 · 지도 만들기
 *  2m 칸 격자(96×96 = 192m). 칸마다 땅 종류, 칸 경계마다 벽/창문/문/울타리.
 *  구역: 주택가 · 시내(마트·병원·경찰서) · 연구소 · 공장 · 놀이공원 · 공원(미니골프) · 숲(오두막·캠핑장) · 항구 · 기차역
 */
(function () {
  'use strict';
  const CS = 2, N = 160, CN = 96;   // 전체 격자 160칸 (도시 96칸 + 동쪽 바깥에 지하 구역)
  const KITS = ['nature', 'urban', 'build', 'bld', 'car', 'food', 'shop', 'station', 'factory', 'holiday', 'golf', 'coaster', 'boat', 'train', 'town', 'proto', 'blaster', 'pets', 'space', 'dungeon', 'cave', 'mspace'];
  // 땅 종류
  const GR = { grass: 0, road: 1, walk: 2, floor: 3, water: 4, sand: 5, dirt: 6, park: 7, lab: 8, rail: 9, wood: 10, tile: 11, deep: 12, sewer: 13, cave: 14, ulab: 15, rock: 16 };
  // 경계 종류
  const E = { none: 0, wall: 1, window: 2, door: 3, fence: 4, solid: 5, rail: 6 };
  const OBW = window.OBW = { CS, N, CN, GR, E, KITS };

  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function mat(x, y, z, ry, s) { Q.setFromAxisAngle(UP, ry || 0); if (typeof s === 'number' || s == null) SV.setScalar(s || 1); else SV.set(s[0], s[1], s[2]); return new THREE.Matrix4().compose(V.set(x, y, z), Q, SV); }
  OBW.mat = mat;

  OBW.generate = function (seed) {
    const R = rng(seed || 12345), rf = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rf(a, b + 1)), pick = a => a[Math.floor(R() * a.length)];
    const W = {
      seed, N, CS, ground: new Uint8Array(N * N), solidC: new Uint8Array(N * N), bld: new Int16Array(N * N).fill(-1),
      eW: new Uint8Array((N + 1) * (N + 1)), eN: new Uint8Array((N + 1) * (N + 1)), eRef: {},   // eRef: 'W,i,j' → 문/창 객체
      circles: [], cgrid: {}, buildings: [], doors: [], windows: [], containers: [], beds: [], spots: {}, cars: [], items: [], zones: [],
      group: new THREE.Group(), lights: [], interact: []
    };
    const id = (i, j) => j * N + i, inb = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
    const cx = i => (i + 0.5) * CS, cz = j => (j + 0.5) * CS;
    W.cx = cx; W.cz = cz; W.id = id; W.inb = inb;
    const batches = {};   // 덩어리(16칸)별 합치기
    const chunkOf = (x, z) => Math.floor(x / 32) + ',' + Math.floor(z / 32);
    const LEAF = ['#c8d64a', '#b8d050', '#d0d860', '#a8c848'];
    function put(k, m, x, y, z, ry, s, tint, target) {
      if (!OBA.has(k, m)) { console.warn('missing', k, m); return; }
      if (k === 'nature' && !tint && /^(tree|plant|grass|crop|lily)/.test(m)) tint = m.includes('fall') ? null : LEAF[(x * 7 + z * 13 | 0) & 3];
      const b = target || (batches[chunkOf(x, z)] = batches[chunkOf(x, z)] || new OBA.Batch());
      b.add(k, m, mat(x, y, z, ry, s), tint);
    }
    W.put = put;
    function circle(x, z, r, o) {
      const c = Object.assign({ x, z, r }, o || {}); W.circles.push(c);
      const i0 = Math.floor((x - r) / CS), i1 = Math.floor((x + r) / CS), j0 = Math.floor((z - r) / CS), j1 = Math.floor((z + r) / CS);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i + ',' + j; (W.cgrid[k] = W.cgrid[k] || []).push(c); }
      return c;
    }
    W.circle = circle;
    function box(x, z, w, d, ry) {   // 직사각형 → 원 여러 개
      const c = Math.cos(ry || 0), s = Math.sin(ry || 0), r = Math.min(w, d) / 2, L = Math.max(w, d), n = Math.max(1, Math.round(L / (r * 1.4)));
      const ax = w >= d ? [c, -s] : [s, c];
      for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * (L - 2 * r); circle(x + ax[0] * t, z + ax[1] * t, r); }
    }
    W.box = box;
    const setG = (i0, j0, i1, j1, g) => { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inb(i, j)) W.ground[id(i, j)] = g; };
    const edgeW = (i, j, v) => { W.eW[j * (N + 1) + i] = v; }, edgeN = (i, j, v) => { W.eN[j * (N + 1) + i] = v; };
    W.getW = (i, j) => (i < 0 || j < 0 || i > N || j >= N) ? E.solid : W.eW[j * (N + 1) + i];
    W.getN = (i, j) => (i < 0 || j < 0 || i >= N || j > N) ? E.solid : W.eN[j * (N + 1) + i];

    // ================= 큰 틀: 땅 =================
    setG(0, 0, N - 1, N - 1, GR.rock); setG(0, 0, CN - 1, CN - 1, GR.grass);
    const ROADV = [30, 62], ROADH = [30, 62];
    for (const r of ROADV) { setG(r - 1, 12, r - 1, 85, GR.walk); setG(r + 2, 12, r + 2, 85, GR.walk); setG(r, 12, r + 1, 85, GR.road); }
    for (const r of ROADH) { setG(12, r - 1, 85, r - 1, GR.walk); setG(12, r + 2, 85, r + 2, GR.walk); setG(12, r, 85, r + 1, GR.road); }
    for (const r of ROADV) for (const h of ROADH) setG(r, h, r + 1, h + 1, GR.road);
    // 바깥 길: 서쪽 숲(흙길), 동쪽 항구, 남쪽 역, 북쪽 공원
    setG(4, 46, 29, 47, GR.dirt); setG(64, 46, 86, 47, GR.road); setG(46, 64, 47, 87, GR.road); setG(46, 8, 47, 29, GR.road);
    setG(12, 12, 85, 12, GR.walk); setG(12, 85, 85, 85, GR.walk); setG(12, 12, 12, 85, GR.walk); setG(85, 12, 85, 85, GR.walk);
    // 해변과 바다 (동쪽)
    setG(87, 0, 89, CN - 1, GR.sand); setG(90, 0, CN - 1, CN - 1, GR.water); setG(93, 0, CN - 1, CN - 1, GR.deep);
    // 호수 (서쪽 숲)
    for (let j = 0; j < CN; j++) for (let i = 0; i < 12; i++) { const d = Math.hypot((i - 5) / 4.2, (j - 22) / 6.5); if (d < 1) W.ground[id(i, j)] = GR.water; else if (d < 1.25) W.ground[id(i, j)] = GR.sand; }
    // 철도 (남쪽)
    setG(0, 89, 86, 90, GR.rail); setG(40, 87, 54, 88, GR.walk);
    // 바깥 경계는 지나갈 수 없음
    for (let k = 0; k < CN; k++) { edgeW(0, k, E.solid); edgeW(CN, k, E.solid); edgeN(k, 0, E.solid); edgeN(k, CN, E.solid); }

    // ================= 건물 =================
    const PASTEL = ['#ffffff', '#ffe9d6', '#e8f2ff', '#f3ffe6', '#fff6cc', '#ffe0e6', '#e6e0ff', '#dff7f2'];
    function building(name, i0, j0, w, h, opt) {
      opt = opt || {};
      const B = { id: W.buildings.length, name, i0, j0, w, h, kind: opt.kind || 'house', walls: new OBA.Batch(), roof: new OBA.Batch(), inner: new OBA.Batch(), doors: [], lit: false, tint: opt.tint || pick(PASTEL) };
      W.buildings.push(B);
      for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) { W.bld[id(i, j)] = B.id; W.ground[id(i, j)] = opt.floor || GR.floor; }
      return B;
    }
    // 벽 한 칸 (모양: wall / window / door / doorway)
    function wallPiece(B, ax, i, j, kind, opt) {
      opt = opt || {};
      const x = ax === 'W' ? i * CS : cx(i), z = ax === 'W' ? cz(j) : j * CS, ry = ax === 'W' ? 0 : Math.PI / 2;
      const kit = opt.kit || 'build', tint = opt.tint || B.tint;
      const nm = kind === 'window' ? (opt.win || 'wall-window-square') : (kind === 'door' || kind === 'doorway') ? (opt.dw || 'wall-doorway-square') : (opt.wall || 'wall');
      put(kit, nm, x, 0, z, ry, opt.s || 1, tint, B.walls);
      const set = ax === 'W' ? edgeW : edgeN;
      if (kind === 'wall') set(i, j, E.wall);
      else if (kind === 'doorway') set(i, j, E.none);
      else if (kind === 'window') { set(i, j, E.window); const wo = { ax, i, j, hp: 40, broken: false, bar: 0, x, z, ry, bld: B.id, bars: [] }; W.windows.push(wo); W.eRef[ax + ',' + i + ',' + j] = wo; }
      else if (kind === 'door') {
        set(i, j, E.door);
        const d = { ax, i, j, open: false, hp: 100, bar: 0, x, z, ry, bld: B.id, locked: !!opt.locked, bars: [], ang: 0, model: opt.door || 'door-rotate-square-a' };
        W.doors.push(d); B.doors.push(d); W.eRef[ax + ',' + i + ',' + j] = d;
      }
    }
    // 둘레에 벽 두르기: door/window 위치는 sides 지정 ({N:[칸], S:[], W:[], E:[]}, 'win' 비율)
    function shell(B, doorsAt, winP, opt) {
      const { i0, j0, w, h } = B; opt = opt || {};
      const want = (side, k) => (doorsAt[side] || []).includes(k);
      for (let i = i0; i < i0 + w; i++) {
        wallPiece(B, 'N', i, j0, want('N', i) ? 'door' : (R() < winP && i > i0 && i < i0 + w - 1 ? 'window' : 'wall'), opt);
        wallPiece(B, 'N', i, j0 + h, want('S', i) ? 'door' : (R() < winP && i > i0 && i < i0 + w - 1 ? 'window' : 'wall'), opt);
      }
      for (let j = j0; j < j0 + h; j++) {
        wallPiece(B, 'W', i0, j, want('W', j) ? 'door' : (R() < winP && j > j0 && j < j0 + h - 1 ? 'window' : 'wall'), opt);
        wallPiece(B, 'W', i0 + w, j, want('E', j) ? 'door' : (R() < winP && j > j0 && j < j0 + h - 1 ? 'window' : 'wall'), opt);
      }
      // 모서리 기둥
      for (const [a, b] of [[i0, j0], [i0 + w, j0], [i0, j0 + h], [i0 + w, j0 + h]]) put('build', 'column-thin', a * CS, 0, b * CS, 0, [0.5, 1, 0.5], B.tint, B.walls);
      // 바닥과 지붕
      for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) {
        put(opt.floorKit || 'build', opt.floorM || 'floor', cx(i), 0, cz(j), 0, opt.floorS || 1, opt.floorTint || '#f4efe6', B.inner);
        put('build', 'roof-flat-center', cx(i), 2.4, cz(j), 0, 1, opt.roofTint || '#b9b2a8', B.roof);
      }
      for (let i = i0; i < i0 + w; i++) { put('build', 'border-high', cx(i), 2.4, j0 * CS, Math.PI / 2, 1, opt.roofTint || '#9a948c', B.roof); put('build', 'border-high', cx(i), 2.4, (j0 + h) * CS, Math.PI / 2, 1, opt.roofTint || '#9a948c', B.roof); }
      for (let j = j0; j < j0 + h; j++) { put('build', 'border-high', i0 * CS, 2.4, cz(j), 0, 1, opt.roofTint || '#9a948c', B.roof); put('build', 'border-high', (i0 + w) * CS, 2.4, cz(j), 0, 1, opt.roofTint || '#9a948c', B.roof); }
    }
    // 안쪽 벽 (칸 경계 하나, 문 없는 통로 포함)
    function innerWallV(B, i, j0, j1, gapJ) { for (let j = j0; j <= j1; j++) wallPiece(B, 'W', i, j, j === gapJ ? 'doorway' : 'wall', { tint: '#f6f2ea' }); }
    function innerWallH(B, j, i0, i1, gapI) { for (let i = i0; i <= i1; i++) wallPiece(B, 'N', i, j, i === gapI ? 'doorway' : 'wall', { tint: '#f6f2ea' }); }
    // 가구 + 보관함
    function furn(B, k, m, x, z, ry, s, r, cont, tint) {
      put(k, m, x, 0.1, z, ry, s, tint, B ? B.inner : null);
      if (r) circle(x, z, r, { furn: true });
      if (cont) { const c = { x, z, kind: cont, items: null, bld: B ? B.id : -1, name: CONT_NAME[cont] || cont }; W.containers.push(c); return c; }
    }
    const CONT_NAME = { fridge: '냉장고', shelf: '선반', cabinet: '수납장', desk: '책상', crate: '상자', dumpster: '쓰레기통', car: '자동차 트렁크', medcab: '약품장', locker: '사물함', toolbox: '공구함', counter: '조리대', register: '계산대', freezer: '냉동고', bag: '배낭', lab: '실험대', mail: '우편함', stall: '매점' };
    W.CONT_NAME = CONT_NAME;

    // ----- 집 하나 -----
    function house(i0, j0, w, h, front) {
      const B = building('주택', i0, j0, w, h, { kind: 'house' });
      const doors = {}; const mid = front === 'N' || front === 'S' ? i0 + Math.floor(w / 2) : j0 + Math.floor(h / 2);
      doors[front] = [mid];
      const back = { N: 'S', S: 'N', W: 'E', E: 'W' }[front];
      if (R() < 0.5) doors[back] = [front === 'N' || front === 'S' ? i0 + 1 : j0 + 1];
      shell(B, doors, 0.45, { roofTint: pick(['#c8574a', '#5a7ab0', '#6a8a5a', '#8a6a5a', '#b0a090']) });
      // 방 나누기
      let split = null;
      if (w >= 4) { split = i0 + Math.floor(w / 2); innerWallV(B, split, j0, j0 + h - 1, j0 + ri(0, h - 1)); }
      // 침실 (왼쪽/위쪽 방)
      const bx = cx(i0) + 0.1, bz = cz(j0) + 0.2;
      furn(B, 'station', 'bed-double', bx, bz, 0, 1.9, 0.95); W.beds.push({ x: bx, z: bz, bld: B.id });
      furn(B, 'station', 'container-tall', cx(i0) - 0.55, cz(j0 + h - 1) + 0.4, 0, 1.6, 0.5, 'cabinet');
      // 부엌 (오른쪽 방)
      const ki = split ? i0 + w - 1 : i0 + w - 1;
      furn(B, 'shop', 'freezers-standing', cx(ki) + 0.1, cz(j0) - 0.4, 0, [1.5, 1.9, 1.5], 0.6, 'fridge');
      furn(B, 'station', 'table', cx(ki) + 0.2, cz(j0 + h - 1) - 0.2, 0, 1.7, 0.75, 'counter');
      if (w >= 4) { furn(B, 'station', 'table-large', cx(ki - 1) + 0.6, cz(j0 + Math.floor(h / 2)), Math.PI / 2, 1.5, 0.8); furn(B, 'station', 'chair-cushion', cx(ki - 1) - 0.2, cz(j0 + Math.floor(h / 2)), Math.PI / 2, 1.7, 0); }
      if (R() < 0.6) furn(B, 'shop', 'shelf-boxes', cx(i0 + 1) + 0.2, cz(j0 + h - 1) + 0.3, Math.PI, 1.5, 0.55, 'shelf');
      if (R() < 0.5) furn(B, 'station', 'computer-screen', cx(i0 + 1), cz(j0) - 0.5, 0, 1.6, 0.4, 'desk');
      return B;
    }
    // 집 앞마당: 울타리, 나무, 우편함, 차
    function yard(i0, j0, i1, j1, B, front) {
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (W.bld[id(i, j)] < 0) { if (R() < 0.06) put('nature', pick(['plant_bush', 'plant_bushLarge', 'flower_redA', 'flower_yellowA', 'grass_large']), cx(i) + rf(-.5, .5), 0, cz(j) + rf(-.5, .5), rf(0, 6), 2.2); }
      // 뒤뜰 나무
      for (let k = 0; k < 2; k++) { const i = ri(i0, i1), j = ri(j0, j1); if (W.bld[id(i, j)] < 0 && !nearDoor(i, j)) tree(cx(i) + rf(-.4, .4), cz(j) + rf(-.4, .4), pick(['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat'])); }
      // 울타리: 정원 둘레 (앞쪽은 가운데를 비움)
      for (let i = i0; i <= i1; i++) {
        if (!(front === 'N' && Math.abs(i - (B.i0 + Math.floor(B.w / 2))) <= 0)) fenceN(i, j0); if (!(front === 'S' && Math.abs(i - (B.i0 + Math.floor(B.w / 2))) <= 0)) fenceN(i, j1 + 1);
      }
      for (let j = j0; j <= j1; j++) { if (!(front === 'W' && j === B.j0 + Math.floor(B.h / 2))) fenceW(i0, j); if (!(front === 'E' && j === B.j0 + Math.floor(B.h / 2))) fenceW(i1 + 1, j); }
      if (R() < 0.35) { const c = furn(null, 'urban', 'detail-dumpster-closed', cx(i1) - 0.2, cz(j1) - 0.1, 0, 1.6, 0.55, 'dumpster'); }
    }
    function nearDoor(i, j) { return W.doors.some(d => Math.abs(d.i - i) + Math.abs(d.j - j) < 3); }
    function fenceN(i, j) { if (W.getN(i, j) !== E.none) return; put('nature', 'fence_simple', cx(i), 0, j * CS, 0, [2, 2.2, 2], '#fff'); edgeN(i, j, E.fence); }
    function fenceW(i, j) { if (W.getW(i, j) !== E.none) return; put('nature', 'fence_simple', i * CS, 0, cz(j), Math.PI / 2, [2, 2.2, 2], '#fff'); edgeW(i, j, E.fence); }
    function tree(x, z, m, s) { put('nature', m, x, 0, z, R() * 6.28, s || rf(3.2, 4.2)); circle(x, z, 0.35, { tree: true }); }
    W.tree = tree;
    // 블록 하나에 집 여러 채 (도로를 바라보게)
    function houseBlock(i0, j0, i1, j1) {
      const lotW = 9, lotH = (j1 - j0 + 1) >> 1;
      for (let row = 0; row < 2; row++) {
        const front = row === 0 ? 'N' : 'S';
        for (let li = i0; li + lotW - 1 <= i1; li += lotW) {
          const lj0 = row === 0 ? j0 : j0 + lotH, lj1 = row === 0 ? j0 + lotH - 1 : j1;
          const w = ri(4, 6), h = ri(3, 4);
          const hi = li + ri(1, lotW - w - 1), hj = row === 0 ? lj0 + 1 : lj1 - h;
          const B = house(hi, hj, w, h, front);
          yard(li, lj0, li + lotW - 1, lj1, B, front);
          // 진입로와 차
          if (R() < 0.45) { const ci = Math.min(li + lotW - 2, hi + w + 1), cj = row === 0 ? lj0 + 1 : lj1 - 2; if (W.bld[id(ci, cj)] < 0) parkedCar(cx(ci), cz(cj) + CS / 2, Math.PI / 2 * (R() < .5 ? 0 : 2)); }
        }
      }
    }
    // ----- 차 (부서진 차는 장애물, 트렁크는 보관함) -----
    const CARS = ['sedan', 'suv', 'hatchback-sports', 'van', 'truck', 'taxi', 'police', 'sedan-sports', 'suv-luxury', 'delivery', 'ambulance', 'firetruck', 'garbage-truck', 'tractor'];
    function parkedCar(x, z, ry, m) {
      m = m || pick(CARS.slice(0, 10));
      const s = 1.25, bb = OBA.bb('car', m); const L = (bb[5] - bb[2]) * s, Wd = (bb[3] - bb[0]) * s;
      put('car', m, x, 0, z, ry, s, R() < 0.3 ? '#c8c0b8' : null);
      box(x, z, Math.abs(Math.sin(ry)) > 0.5 ? L : Wd, Math.abs(Math.sin(ry)) > 0.5 ? Wd : L, 0);
      const c = { x, z, kind: 'car', items: null, bld: -1, name: '자동차 트렁크', model: m };
      W.containers.push(c); W.cars.push({ x, z, ry, m });
    }

    // ================= 구역 만들기 =================
    // 1) 주택가
    houseBlock(14, 14, 28, 28 - 0);
    houseBlock(33, 14, 60, 28);
    houseBlock(14, 33, 28, 44); houseBlock(14, 49, 28, 60);
    houseBlock(65, 33, 83, 44); houseBlock(65, 49, 83, 60);
    houseBlock(14, 65, 28, 83);
    W.zones.push({ name: '주택가', i: 22, j: 22 }, { name: '주택가', i: 46, j: 20 }, { name: '서쪽 주택가', i: 21, j: 46 }, { name: '동쪽 주택가', i: 74, j: 46 }, { name: '남서쪽 주택가', i: 21, j: 74 });

    // 2) 시내: 마트
    {
      const B = building('그린마트', 33, 33, 13, 9, { kind: 'mart', tint: '#ffffff' });
      shell(B, { S: [38, 39] }, 0.6, { roofTint: '#6a7a6a', win: 'wall-window-wide-square' });
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
        const x = cx(35 + k * 3), z = cz(35 + r * 2);
        furn(B, 'shop', pick(['shelf-bags', 'shelf-boxes', 'display-cans', 'display-bread', 'display-fruit']), x, z, 0, 2, 0.75, 'shelf');
        furn(B, 'shop', pick(['shelf-bags', 'shelf-boxes', 'display-cans']), x + 1.6, z, 0, 2, 0.75, 'shelf');
      }
      for (let k = 0; k < 4; k++) furn(B, 'shop', 'freezers-standing', cx(34 + k * 3), cz(33) - 0.55, 0, 2, 0.6, 'freezer');
      furn(B, 'shop', 'cash-register', cx(36), cz(40) + 0.2, 0, 2, 0.8, 'register'); furn(B, 'shop', 'cash-register', cx(42), cz(40) + 0.2, 0, 2, 0.8, 'register');
      furn(B, 'shop', 'gacha-machine', cx(44), cz(40), 0, 2, 0.4); furn(B, 'shop', 'bottle-return', cx(45) - 0.4, cz(40), 0, 2, 0.4);
      for (let k = 0; k < 3; k++) put('shop', 'shopping-cart', cx(40 + k) * 1, 0, cz(43) + 0.4, rf(0, 6), 2.2);
      W.spots.mart = { i: 39, j: 38 };
    }
    // 병원
    {
      const B = building('바이오 병원', 49, 33, 12, 9, { kind: 'hospital', tint: '#f4fbff', floor: GR.tile });
      shell(B, { S: [54, 55] }, 0.55, { roofTint: '#d0d8e0' });
      innerWallH(B, 37, 49, 60, 52); innerWallV(B, 55, 33, 36, 35);
      for (let k = 0; k < 4; k++) { furn(B, 'station', 'bed-single', cx(50 + k * 1.4), cz(34), 0, 2, 0.7); W.beds.push({ x: cx(50 + k * 1.4), z: cz(34), bld: B.id }); }
      for (let k = 0; k < 3; k++) furn(B, 'station', 'container-tall', cx(57 + k), cz(33) - 0.4, 0, 1.8, 0.5, 'medcab');
      furn(B, 'station', 'table-large', cx(54), cz(39), 0, 1.8, 0.9, 'desk'); furn(B, 'station', 'computer', cx(54), cz(39) - 0.3, 0, 1.8, 0);
      for (let k = 0; k < 4; k++) furn(B, 'station', 'chair-cushion', cx(50 + k), cz(41) - 0.2, Math.PI, 1.8, 0.3);
      furn(B, 'proto', 'wheelchair', cx(59), cz(40), 1, 1.6, 0.4);
      put('car', 'ambulance', cx(57), 0, cz(43) + 0.6, Math.PI / 2, 1.25); box(cx(57), cz(43) + 0.6, 4, 2, 0);
      W.containers.push({ x: cx(57), z: cz(43) + 0.6, kind: 'car', items: null, bld: -1, name: '구급차', model: 'ambulance', med: true });
      W.spots.hospital = { i: 54, j: 38 };
    }
    // 경찰서
    {
      const B = building('경찰서', 33, 49, 10, 8, { kind: 'police', tint: '#dfe6f4', floor: GR.tile });
      shell(B, { N: [37] }, 0.4, { roofTint: '#3a4a6a' });
      innerWallV(B, 38, 49, 56, 54);
      for (let k = 0; k < 4; k++) furn(B, 'station', 'container-tall', cx(39 + k), cz(56) + 0.45, Math.PI, 1.8, 0.5, 'locker');
      furn(B, 'station', 'table-large', cx(35), cz(51), 0, 1.8, 0.9, 'desk'); furn(B, 'station', 'computer-screen', cx(35), cz(51) - 0.2, 0, 1.6, 0);
      furn(B, 'station', 'table-large', cx(35), cz(54), 0, 1.8, 0.9, 'desk');
      furn(B, 'blaster', 'crate-wide', cx(41), cz(51), 0, 1.6, 0.6, 'crate');
      for (const [x, z] of [[cx(36), cz(58) + 0.5], [cx(40), cz(58) + 0.5]]) { put('car', 'police', x, 0, z, Math.PI / 2, 1.25); box(x, z, 4, 2, 0); W.containers.push({ x, z, kind: 'car', items: null, bld: -1, name: '경찰차', model: 'police', police: true }); }
      W.spots.police = { i: 40, j: 52 };
    }
    // 사무실 빌딩(들어갈 수 없는 고층) + 광장
    {
      const towers = [[46, 47], [50, 47], [54, 47], [58, 47], [46, 55], [58, 55]];
      W.towers = [];
      for (const [ti, tj] of towers) {
        const fl = ri(3, 6), tint = pick(['#ffffff', '#e8e4f0', '#f0e8dc']);
        const TB = new OBA.Batch(); W.towers.push({ i0: ti, j0: tj, b: TB });
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const i = ti + a, j = tj + b;
          W.solidC[id(i, j)] = 1; W.ground[id(i, j)] = GR.walk;
          for (let f = 0; f < fl; f++) put('bld', f === 0 ? (a === 0 && b === 1 ? 'building-door' : 'building-window-wide') : pick(['building-window', 'building-windows', 'building-window-wide', 'building-window-balcony']), cx(i), f * 2.4, cz(j), (b === 1 ? 0 : Math.PI) + (a ? 0 : 0), [2, 4, 2], tint, TB);
          put('bld', 'roof-flat-border-center-corner', cx(i), fl * 2.4, cz(j), 0, [2, 2, 2], tint, TB);
        }
        for (const e of [[ti, tj, 'N'], [ti + 1, tj, 'N'], [ti, tj + 2, 'N'], [ti + 1, tj + 2, 'N']]) edgeN(e[0], e[1], E.solid);
        for (const e of [[ti, tj], [ti, tj + 1], [ti + 2, tj], [ti + 2, tj + 1]]) edgeW(e[0], e[1], E.solid);
      }
      setG(48, 51, 57, 59, GR.walk); put('town', 'fountain-round', cx(52), 0, cz(55), 0, 2.4); circle(cx(52), cz(55), 2.4);
      for (let k = 0; k < 6; k++) put('town', 'lantern', cx(49 + k * 1.6), 0, cz(52), 0, 2);
      for (let k = 0; k < 4; k++) { put('coaster', 'bench', cx(49 + k * 2.5), 0, cz(59), Math.PI, 2.2); circle(cx(49 + k * 2.5), cz(59), 0.5); }
      W.zones.push({ name: '시내', i: 46, j: 46 });
    }
    // 주유소 (동쪽)
    {
      setG(65, 46, 72, 47, GR.walk);
      const B = building('주유소 편의점', 74, 45, 5, 3, { kind: 'mart', tint: '#fff4e0' });
      shell(B, { W: [46] }, 0.5, { roofTint: '#c83a2a' });
      furn(B, 'shop', 'shelf-boxes', cx(76), cz(46), 0, 2, 0.7, 'shelf'); furn(B, 'shop', 'display-cans', cx(77) + 0.4, cz(46), 0, 2, 0.7, 'shelf'); furn(B, 'shop', 'freezers-standing', cx(77), cz(45) - 0.5, 0, 2, 0.6, 'freezer'); furn(B, 'shop', 'cash-register', cx(75), cz(47), 0, 2, 0.6, 'register');
      for (let k = 0; k < 2; k++) { put('factory', 'machine', cx(68 + k * 3), 0, cz(48) + 0.8, 0, [1, 1.3, 1]); circle(cx(68 + k * 3), cz(48) + 0.8, 0.8); W.containers.push({ x: cx(68 + k * 3), z: cz(48) + 0.8, kind: 'pump', items: null, bld: -1, name: '주유기' }); }
      W.spots.gas = { i: 69, j: 49 };
    }
    // 3) 연구소 (북동쪽): 우주정거장 키트로 만든 실험동 + 위성 안테나
    {
      const B = building('바이러스 연구소', 68, 16, 12, 9, { kind: 'lab', tint: '#e6ecf4', floor: GR.lab });
      shell(B, { S: [73] }, 0.3, { roofTint: '#5a6a80', floorTint: '#d8e0ea' });
      innerWallH(B, 20, 68, 79, 74); innerWallV(B, 74, 16, 19, 18);
      B.locked = true;
      for (let k = 0; k < 4; k++) furn(B, 'station', 'table-large', cx(69 + k * 1.5), cz(22), 0, 1.6, 0.8, 'lab');
      for (let k = 0; k < 3; k++) furn(B, 'station', 'computer-system', cx(70 + k * 2), cz(16) - 0.2, 0, 1.6, 0.6, 'desk');
      furn(B, 'factory', 'machine-window', cx(77), cz(17) + 0.5, 0, [1.2, 1.3, 1.2], 0.9);
      furn(B, 'station', 'container-tall', cx(79) - 0.2, cz(21), Math.PI / 2, 1.8, 0.5, 'medcab'); furn(B, 'station', 'container-tall', cx(79) - 0.2, cz(23), Math.PI / 2, 1.8, 0.5, 'medcab');
      for (let k = 0; k < 3; k++) { const x = cx(66) + k * 0.1, z = cz(17 + k * 3); put('space', pick(['satelliteDish', 'satelliteDish_detailed', 'machine_generator']), x, 0, z, 0, 2); circle(x, z, 1.0); }
      put('space', 'satelliteDish_large', cx(82), 0, cz(18), 0, 2.5); circle(cx(82), cz(18), 1.6);
      // 검문소 울타리 + 바리케이드
      for (let i = 65; i <= 83; i++) if (i !== 73 && i !== 74) fenceN(i, 27);
      for (const x of [cx(72), cx(75)]) { put('proto', 'wall-low', x, 0, cz(27), Math.PI / 2, 2, '#ffcc40'); }
      put('factory', 'warning-traffic', cx(72), 0, cz(28), 0, 1.6); put('factory', 'warning-traffic', cx(75), 0, cz(28), 0, 1.6);
      W.spots.lab = { i: 73, j: 22 };
      W.zones.push({ name: '연구소', i: 73, j: 20 });
    }
    // 4) 공장 (남쪽)
    {
      const B = building('세포배양 공장', 35, 67, 16, 11, { kind: 'factory', tint: '#c8d0dc', floor: GR.tile });
      shell(B, { N: [42, 43], E: [72] }, 0.25, { roofTint: '#6a7080', wall: 'wall', floorTint: '#b8bcc4' });
      for (let k = 0; k < 4; k++) { furn(B, 'factory', 'machine', cx(37 + k * 3.5), cz(69), 0, [1.4, 1.4, 1.4], 0.9); }
      for (let k = 0; k < 10; k++) put('factory', 'conveyor-long', cx(37 + k * 1.2), 0.1, cz(72), Math.PI / 2, [2, 1.6, 2], null, B.inner);
      for (let k = 0; k < 10; k++) circle(cx(37 + k * 1.2), cz(72), 0.6);
      for (let k = 0; k < 2; k++) furn(B, 'factory', 'robot-arm-a', cx(40 + k * 6), cz(74), 0, [1.4, 0.9, 1.4], 0.7);
      for (let k = 0; k < 6; k++) furn(B, 'factory', pick(['box-large', 'box-wide', 'box-long']), cx(37 + k * 2), cz(76) + 0.4, rf(-.2, .2), 1.6, 0.8, k % 2 ? 'crate' : 'toolbox');
      furn(B, 'factory', 'screen-wide', cx(49), cz(68), Math.PI / 2, 1.4, 0.4);
      // 창고 마당
      for (let k = 0; k < 5; k++) { const x = cx(54 + (k % 2) * 3), z = cz(67 + k * 3); put('boat', pick(['cargo-container-a', 'cargo-container-b', 'cargo-container-c']), x, 0, z, 0, 1.5); box(x, z, 2.1, 4.2, 0); W.containers.push({ x: x + 1.4, z, kind: 'crate', items: null, bld: -1, name: '화물 컨테이너' }); }
      parkedCar(cx(58), cz(80), 0, 'truck'); parkedCar(cx(53), cz(81), 0, 'garbage-truck');
      put('factory', 'crane', cx(59), 0, cz(73), 0, 1.6); circle(cx(59), cz(73), 1.2);
      W.spots.factory = { i: 43, j: 72 };
      W.zones.push({ name: '공장', i: 43, j: 72 });
    }
    // 5) 놀이공원 (남동쪽)
    {
      setG(65, 65, 83, 83, GR.park);
      put('coaster', 'park-entrance', cx(73), 0, cz(65) + 0.2, Math.PI, 2.2);
      for (let i = 65; i <= 83; i++) if (i < 72 || i > 75) fenceN(i, 65);
      for (let k = 0; k < 9; k++) put('coaster', 'path-straight', cx(73) + 1, 0.0, cz(66 + k * 2), 0, [2, 0.3, 4]);
      // 롤러코스터: 직선 레일을 높이 올려 큰 사각 고리
      const TR = 'coaster-steel-straight', SUP = 'support-large';
      for (let k = 0; k < 6; k++) { const z = cz(68) + k * 4; put('coaster', TR, cx(67), 4, z, 0, 1); put('coaster', SUP, cx(67), 0, z + 2, 0, [1, 4, 1]); circle(cx(67), z + 2, 0.4); put('coaster', TR, cx(81), 4, z, 0, 1); put('coaster', SUP, cx(81), 0, z + 2, 0, [1, 4, 1]); circle(cx(81), z + 2, 0.4); }
      put('coaster', 'coaster-train', cx(67), 4.1, cz(72), 0, 2);
      for (const [i, j, m, cont] of [[69, 67, 'stall-food', 'stall'], [77, 67, 'stall-drinks', 'stall'], [69, 76, 'stall-information', null], [78, 76, 'stall-toilets', null]]) { put('coaster', m, cx(i), 0, cz(j), 0, 2.2); circle(cx(i), cz(j), 1.1); if (cont) W.containers.push({ x: cx(i), z: cz(j) + 1.5, kind: cont, items: null, bld: -1, name: m === 'stall-food' ? '음식 매점' : '음료 매점' }); }
      for (let k = 0; k < 10; k++) { const i = ri(66, 82), j = ri(68, 82); if (Math.abs(i - 74) > 1) put('coaster', pick(['tree', 'tree-large', 'flowers', 'trash', 'bench']), cx(i), 0, cz(j), rf(0, 6), 2); }
      W.spots.park = { i: 74, j: 74 };
      W.zones.push({ name: '놀이공원', i: 74, j: 73 });
    }
    // 6) 공원 + 미니골프 (북서쪽 블록 일부는 주택이 차지 → 북쪽 띠에 공원)
    {
      setG(14, 2, 44, 10, GR.park);
      const course = [['start', 0], ['straight', 0], ['straight', 0], ['corner', 0], ['straight', 1], ['windmill', 1], ['straight', 1], ['castle', 1], ['hole-round', 1]];
      let gi = 16, gj = 4, dir = 0;
      for (const [m, d] of course) { put('golf', m === 'windmill' || m === 'castle' ? 'straight' : m, cx(gi), 0, cz(gj), d * Math.PI / 2, 2); if (m === 'windmill' || m === 'castle') { put('golf', m, cx(gi), 0.3, cz(gj), d * Math.PI / 2, 2); circle(cx(gi), cz(gj), 0.9); } if (d === 0) gi++; else gj++; }
      for (let k = 0; k < 3; k++) put('golf', pick(['flag-red', 'flag-blue', 'flag-green']), cx(17 + k * 2), 0.3, cz(5), 0, 2);
      W.containers.push({ x: cx(18), z: cz(7), kind: 'golfbag', items: null, bld: -1, name: '골프 가방' }); put('golf', 'club-red', cx(18), 0.3, cz(7), 0.5, 2.4); put('golf', 'club-blue', cx(18) + 0.3, 0.3, cz(7), 1.2, 2.4);
      for (let k = 0; k < 14; k++) { const i = ri(24, 44), j = ri(2, 10); if (W.ground[id(i, j)] === GR.park) tree(cx(i), cz(j), pick(['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed'])); }
      for (let k = 0; k < 5; k++) { put('coaster', 'bench', cx(28 + k * 3), 0, cz(9), 0, 2.2); circle(cx(28 + k * 3), cz(9), 0.5); }
      W.zones.push({ name: '시민 공원', i: 28, j: 6 });
    }
    // 7) 숲: 호수, 오두막(홀리데이 키트), 캠핑장, 동물
    {
      // 오두막
      const B = building('숲속 오두막', 3, 34, 4, 3, { kind: 'cabin', tint: '#ffffff', floor: GR.wood });
      shell(B, { E: [35] }, 0.4, { wall: 'wall', tint: '#c8a070', roofTint: '#e8f0f4', floorTint: '#c89060' });
      furn(B, 'station', 'bed-single', cx(3), cz(34) + 0.3, 0, 2, 0.6); W.beds.push({ x: cx(3), z: cz(34) + 0.3, bld: B.id });
      furn(B, 'station', 'container', cx(6), cz(36), 0, 1.8, 0.5, 'cabinet'); furn(B, 'holiday', 'lantern', cx(5), cz(34) - 0.5, 0, 1.2, 0.3);
      put('holiday', 'cabin-fence', cx(8), 0, cz(34), Math.PI / 2, 2);
      // 캠핑장
      for (const [i, j] of [[8, 54], [5, 57], [10, 58]]) { put('nature', pick(['tent_detailedOpen', 'tent_smallOpen', 'tent_detailedClosed']), cx(i), 0, cz(j), rf(0, 6), 3); circle(cx(i), cz(j), 1.1); W.containers.push({ x: cx(i) + 1.3, z: cz(j), kind: 'bag', items: null, bld: -1, name: '텐트 배낭' }); }
      put('nature', 'campfire_stones', cx(7), 0, cz(57), 0, 3); put('nature', 'campfire_logs', cx(7), 0, cz(57), 0, 3); W.spots.campfire = { x: cx(7), z: cz(57) }; circle(cx(7), cz(57), 0.6);
      put('nature', 'log_large', cx(9), 0, cz(56), 0.8, 2.5); circle(cx(9), cz(56), 0.6);
      // 나무들
      for (let j = 0; j < CN; j++) for (let i = 0; i < 13; i++) {
        const g = W.ground[id(i, j)]; if (g !== GR.grass || W.bld[id(i, j)] >= 0) continue;
        if (Math.abs(j - 46.5) < 2 || (i >= 2 && i <= 11 && j >= 32 && j <= 39) || (i >= 3 && i <= 12 && j >= 52 && j <= 60)) continue;
        if (R() < 0.42) tree(cx(i) + rf(-.6, .6), cz(j) + rf(-.6, .6), pick(['tree_pineRoundA', 'tree_pineRoundC', 'tree_pineTallA', 'tree_pineDefaultA', 'tree_cone', 'tree_default_dark', 'tree_oak_dark']), rf(3.4, 4.6));
        else if (R() < 0.25) put('nature', pick(['grass_large', 'plant_bush', 'rock_smallA', 'mushroom_red', 'stump_round', 'log', 'flower_purpleA']), cx(i) + rf(-.6, .6), 0, cz(j) + rf(-.6, .6), rf(0, 6), 2.5);
      }
      // 북쪽 띠 숲
      for (let j = 0; j < 12; j++) for (let i = 13; i < 87; i++) { if (W.ground[id(i, j)] !== GR.grass || Math.abs(i - 46.5) < 2) continue; if (R() < 0.3) tree(cx(i) + rf(-.6, .6), cz(j) + rf(-.6, .6), pick(['tree_default', 'tree_oak', 'tree_pineRoundB', 'tree_fat', 'tree_detailed']), rf(3.2, 4.4)); }
      // 호수 꾸미기
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; put('nature', pick(['lily_large', 'lily_small']), cx(5) + Math.cos(a) * 4, 0.02, cz(22) + Math.sin(a) * 7, a, 2.5); }
      put('boat', 'boat-row-small', cx(8), 0, cz(24), 1.2, 1.2); circle(cx(8), cz(24), 1.2);
      W.spots.cabin = { i: 5, j: 35 };
      W.zones.push({ name: '서쪽 숲', i: 6, j: 46 }, { name: '호수', i: 5, j: 22 });
    }
    // 8) 항구 (동쪽)
    {
      // 부두: 나무 길
      for (let i = 88; i <= 94; i++) for (const j of [44, 45, 50, 51]) { W.ground[id(i, j)] = GR.wood; put('nature', 'ground_pathTile', cx(i), 0.05, cz(j), 0, [2, 1, 2], '#c89a6a'); }
      for (let j = 44; j <= 51; j++) { W.ground[id(88, j)] = GR.wood; put('nature', 'ground_pathTile', cx(88), 0.05, cz(j), 0, [2, 1, 2], '#c89a6a'); }
      for (let i = 89; i <= 94; i++) for (const j of [46, 47, 48, 49]) W.ground[id(i, j)] = GR.water;
      put('boat', 'boat-speed-a', cx(92), 0.1, cz(47) + 1, Math.PI / 2, 1.2); W.spots.boat = { x: cx(92), z: cz(47) + 1 };
      put('boat', 'boat-fishing-small', cx(92), 0.1, cz(42), Math.PI / 2, 1.2); put('boat', 'ship-small', cx(94), 0, cz(58), 0, 1.0);
      for (const j of [40, 55]) { put('boat', 'buoy', cx(91), 0, cz(j), 0, 1.4); }
      for (let k = 0; k < 4; k++) { const x = cx(86), z = cz(40 + k * 4); put('boat', pick(['cargo-container-a', 'cargo-container-b', 'cargo-pile-a']), x, 0, z, 0, 1.4); box(x, z, 2, 4, 0); }
      W.containers.push({ x: cx(85), z: cz(42), kind: 'crate', items: null, bld: -1, name: '부두 창고 상자' });
      const B = building('항구 사무소', 79, 50, 4, 3, { kind: 'office', tint: '#e8f4ff' });
      shell(B, { E: [51] }, 0.5, { roofTint: '#3a6aa0' });
      furn(B, 'station', 'table-large', cx(80), cz(51), 0, 1.6, 0.8, 'desk'); furn(B, 'station', 'container-tall', cx(82), cz(50) - 0.3, 0, 1.6, 0.5, 'locker');
      W.zones.push({ name: '항구', i: 88, j: 47 });
    }
    // 9) 기차역 (남쪽)
    {
      for (let i = 0; i < 87; i++) { put('train', 'track', cx(i), 0, cz(89) + 1, Math.PI / 2, [2, 1, 2]); }
      for (let i = 0; i < 87; i++) { edgeN(i, 89, E.rail); edgeN(i, 91, E.rail); }
      edgeN(46, 89, E.none); edgeN(47, 89, E.none); edgeN(46, 91, E.none); edgeN(47, 91, E.none);
      for (let i = 40; i <= 54; i++) put('station', 'floor', cx(i), 0, cz(87) + 1, 0, [2, 0.6, 4], '#e0dcd4');
      const tr = [['train-diesel-a', 0], ['train-carriage-box', 1], ['train-carriage-container-red', 2], ['train-carriage-tank', 3]];
      for (const [m, k] of tr) { const x = cx(58) + k * 3.8; put('train', m, x, 0, cz(89) + 1, Math.PI / 2, 1.5); box(x, cz(89) + 1, 3.8, 1.8, 0); }
      W.containers.push({ x: cx(62), z: cz(88) - 0.2, kind: 'crate', items: null, bld: -1, name: '화물칸' });
      W.spots.train = { x: cx(58), z: cz(88) };
      for (let k = 0; k < 4; k++) { put('coaster', 'bench', cx(42 + k * 3), 0.3, cz(87), 0, 2.2); }
      put('urban', 'detail-light-double', cx(44), 0.3, cz(87) - 0.6, 0, 2.6); put('urban', 'detail-light-double', cx(50), 0.3, cz(87) - 0.6, 0, 2.6);
      // 남쪽 밭
      for (let j = 92; j < CN; j++) for (let i = 4; i < 84; i++) { W.ground[id(i, j)] = GR.dirt; if ((i + j) % 2 === 0 && R() < 0.7) put('nature', pick(['crop_carrot', 'crop_melon', 'crop_pumpkin', 'crop_turnip', 'crops_cornStageB', 'crops_wheatStageB']), cx(i), 0, cz(j), 0, 2.4); }
      W.zones.push({ name: '기차역', i: 47, j: 87 }, { name: '농장', i: 40, j: 94 });
      W.containers.push({ x: cx(20), z: cz(93), kind: 'crate', items: null, bld: -1, name: '농장 창고 상자' });
    }
    // 길 꾸미기: 가로등, 신호등, 쓰레기통, 부서진 차, 바리케이드
    for (const r of ROADV) for (let j = 14; j < 84; j += 6) { put('urban', 'detail-light-single', (r - 1) * CS + 0.4, 0, cz(j), Math.PI, 2.6); W.lights.push({ x: (r - 1) * CS + 0.4, z: cz(j) }); }
    for (const r of ROADH) for (let i = 14; i < 84; i += 7) { put('urban', 'detail-light-single', cx(i), 0, (r - 1) * CS + 0.4, Math.PI / 2, 2.6); W.lights.push({ x: cx(i), z: (r - 1) * CS + 0.4 }); }
    for (let k = 0; k < 14; k++) {
      const vert = R() < 0.5, r = pick(vert ? ROADV : ROADH), t = ri(14, 82); if (ROADV.concat(ROADH).some(q => Math.abs(q - t) < 3)) continue;
      const x = vert ? cx(r) + rf(0, 2) : cx(t), z = vert ? cz(t) : cz(r) + rf(0, 2);
      parkedCar(x, z, (vert ? 0 : Math.PI / 2) + rf(-0.5, 0.5), pick(CARS));
    }
    for (let k = 0; k < 20; k++) { const vert = R() < 0.5, r = pick(vert ? ROADV : ROADH), t = ri(14, 82); const x = vert ? cx(r) + rf(-.5, 2.5) : cx(t), z = vert ? cz(t) : cz(r) + rf(-.5, 2.5); put('car', pick(['debris-tire', 'debris-bumper', 'cone', 'debris-door', 'debris-plate-a']), x, 0, z, rf(0, 6), 1.3); }
    // 도시 끝 군 검문소 (프로토타입 키트)
    for (const [i, j, ry] of [[30, 11, 0], [62, 11, 0], [11, 30, 1], [86, 62, 1]]) {
      for (let k = 0; k < 2; k++) { const x = ry ? cx(i) : cx(i + k), z = ry ? cz(j + k) : cz(j); put('proto', 'wall-low', x, 0, z, ry ? 0 : Math.PI / 2, 2, '#e8e0c0'); }
      put('proto', 'target-a-round', cx(i) + 1, 0, cz(j) + 1, 0, 2); put('proto', 'flag', cx(i) - 1, 0, cz(j), 0, 2.2);
      put('blaster', 'crate-medium', cx(i) + 1.5, 0, cz(j) - 1, 0, 1.6); W.containers.push({ x: cx(i) + 1.5, z: cz(j) - 1, kind: 'mil', items: null, bld: -1, name: '군용 보급 상자' }); circle(cx(i) + 1.5, cz(j) - 1, 0.5);
    }
    // 들판 꾸미기 (주택가 블록 바깥 풀밭)
    for (let j = 0; j < CN; j++) for (let i = 13; i < 87; i++) {
      const g = W.ground[id(i, j)]; if (g !== GR.grass || W.bld[id(i, j)] >= 0 || W.solidC[id(i, j)]) continue;
      if (R() < 0.04) put('nature', pick(['grass', 'grass_large', 'flower_yellowA', 'flower_redA', 'plant_bush']), cx(i) + rf(-.7, .7), 0, cz(j) + rf(-.7, .7), rf(0, 6), 2.4);
    }
    // 동물 (큐브 펫): 숲·농장·공원에서 돌아다님
    W.animals = [];
    const ANI = [['animal-deer', 'f'], ['animal-fox', 'f'], ['animal-bunny', 'f'], ['animal-beaver', 'f'], ['animal-cow', 'farm'], ['animal-pig', 'farm'], ['animal-chick', 'farm'], ['animal-hog', 'farm'], ['animal-dog', 'town'], ['animal-cat', 'town'], ['animal-parrot', 'park'], ['animal-penguin', 'harbor'], ['animal-crab', 'harbor'], ['animal-fish', 'lake']];
    const AREA = { f: () => [rf(1, 11) * CS, rf(26, 80) * CS], farm: () => [rf(6, 80) * CS, rf(92.5, 95) * CS], town: () => [rf(14, 84) * CS, rf(14, 84) * CS], park: () => [rf(16, 44) * CS, rf(3, 10) * CS], harbor: () => [rf(87.2, 89) * CS, rf(30, 70) * CS], lake: () => [rf(3, 7) * CS, rf(18, 26) * CS] };
    for (const [m, a] of ANI) for (let k = 0; k < (a === 'farm' ? 4 : a === 'f' ? 3 : 2); k++) { const [x, z] = AREA[a](); W.animals.push({ m, area: a, x, z, ry: rf(0, 6.28), t: rf(0, 5), hx: x, hz: z }); }
    underground();
    // ================= 땅 그리기 =================
    const gb = {};
    const GT = {
      [GR.grass]: ['urban', 'grass', null], [GR.park]: ['urban', 'grass', '#c8ffb0'], [GR.road]: ['urban', 'road-asphalt-center', null], [GR.walk]: ['urban', 'road-asphalt-pavement', null],
      [GR.sand]: ['nature', 'ground_grass', '#f0dca0'], [GR.dirt]: ['urban', 'road-dirt-center', null], [GR.rail]: ['urban', 'road-dirt-center', '#a89a88'], [GR.wood]: null, [GR.water]: null, [GR.deep]: null,
      [GR.floor]: ['urban', 'grass', null], [GR.tile]: ['urban', 'grass', null], [GR.lab]: ['urban', 'grass', null]
    };
    for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
      const g = W.ground[id(i, j)], t = GT[g]; if (!t) continue;
      const ck = Math.floor(i / 16) + ',' + Math.floor(j / 16); const b = gb[ck] = gb[ck] || new OBA.Batch();
      b.add(t[0], t[1], mat(cx(i), 0, cz(j), 0, [2, 1, 2]), t[2]);
    }
    // 도로 차선
    for (const r of ROADV) for (let j = 13; j < 85; j += 2) put('urban', 'road-asphalt-straight', cx(r) + 1, 0.005, cz(j) + 1, 0, [0.06, 1, 0.8], '#fff6c0');
    for (const r of ROADH) for (let i = 13; i < 85; i += 2) put('urban', 'road-asphalt-straight', cx(i) + 1, 0.005, cz(r) + 1, Math.PI / 2, [0.06, 1, 0.8], '#fff6c0');
    // 물
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CN * CS * 1.6, CN * CS * 1.6), new THREE.MeshLambertMaterial({ color: '#3a8ac8', transparent: true, opacity: 0.88 }));
    water.rotation.x = -Math.PI / 2; water.position.set(CN * CS / 2, -0.25, CN * CS / 2); water.receiveShadow = true; W.group.add(water); W.water = water;
    const under = new THREE.Mesh(new THREE.PlaneGeometry(CN * CS * 1.6, CN * CS * 1.6), new THREE.MeshLambertMaterial({ color: '#2a5a3a' }));
    under.rotation.x = -Math.PI / 2; under.position.set(CN * CS / 2, -0.6, CN * CS / 2); W.group.add(under);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const g = W.ground[id(i, j)]; if (g === GR.water || g === GR.deep || g === GR.rock) W.solidC[id(i, j)] = 1; }
    // 합치기
    for (const k in gb) { const g = gb[k].build({ shadow: false, receive: true }); g.userData.ground = true; W.group.add(g); }
    W.chunks = [];
    for (const k in batches) { if (batches[k].empty) continue; const g = batches[k].build(); W.group.add(g); W.chunks.push(g); }
    for (const T of W.towers) { T.g = T.b.build(); T.b = null; W.group.add(T.g); }
    for (const B of W.buildings) {
      B.gWalls = B.walls.build(); B.gRoof = B.roof.build(); B.gInner = B.inner.build({ shadow: true });
      B.walls = B.roof = B.inner = null;
      W.group.add(B.gWalls, B.gRoof, B.gInner);
    }
    // 문 (경첩에 매달아 회전)
    for (const d of W.doors) {
      const hinge = new THREE.Group(); hinge.position.set(d.x, 0, d.z); hinge.rotation.y = d.ry;
      const m = OBA.mesh('build', d.model); m.position.set(0, 0, -0.45); hinge.add(m);
      const piv = new THREE.Group(); piv.position.set(0, 0, -0.45); m.position.set(0, 0, 0); piv.add(m); hinge.add(piv);
      d.mesh = hinge; d.piv = piv; W.group.add(hinge);
    }
    // ================= 지하: 하수도 · 무너진 동굴 · 지하 연구소 =================
    //  도시 동쪽 바깥(격자 104칸~)에 4m 모듈 격자로 만듦. 맨홀·계단으로 순간이동해서 들어감.
    function underground() {
      const UX = 104, UY = 8, MW = 24, MH = 38;
      const T = { rock: 0, sewer: 1, water: 2, cave: 3, lab: 4 };
      const UM = new Uint8Array(MW * MH);
      const um = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : UM[y * MW + x];
      const carve = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) UM[y * MW + x] = t; };
      // 하수도 본관: 걷는 길 + 가운데 물길
      carve(2, 1, 4, 32, T.sewer); carve(3, 2, 3, 31, T.water);
      carve(3, 10, 3, 10, T.sewer); carve(3, 22, 3, 22, T.sewer); carve(3, 16, 3, 16, T.sewer);
      carve(5, 4, 6, 4, T.sewer); carve(7, 2, 10, 6, T.sewer);      // 북쪽 하수 처리실
      carve(5, 10, 12, 10, T.sewer);                                // 동쪽 가지 → 동굴
      carve(5, 22, 11, 22, T.sewer);                                // 동쪽 가지 → 연구소 서쪽 문
      carve(8, 23, 8, 24, T.sewer); carve(6, 25, 10, 29, T.sewer);   // 남쪽 저수조
      carve(0, 16, 1, 16, T.sewer);
      // 무너진 동굴
      carve(13, 8, 16, 12, T.cave); carve(15, 12, 18, 15, T.cave); carve(17, 15, 18, 18, T.cave); carve(12, 13, 14, 15, T.cave); carve(19, 9, 21, 11, T.cave); carve(17, 10, 18, 10, T.cave);
      // 지하 연구소
      carve(15, 19, 21, 22, T.lab);                                 // 로비 (지상 계단)
      carve(17, 23, 18, 30, T.lab);                                 // 중앙 복도
      carve(12, 24, 15, 28, T.lab); carve(16, 26, 16, 26, T.lab);   // 서쪽: 원심분리 실험실
      carve(12, 22, 12, 23, T.lab);                                 // 하수도에서 들어오는 뒷문
      carve(19, 24, 22, 28, T.lab);                                 // 동쪽: 자료실
      carve(14, 31, 21, 35, T.lab);                                 // 남쪽: 냉장 보관실·창고
      const GT2 = [GR.rock, GR.sewer, GR.water, GR.cave, GR.ulab], KIT = [null, 'dungeon', 'dungeon', 'cave', 'mspace'];
      const mc = (mx, my) => [(UX + mx * 2 + 1) * CS, (UY + my * 2 + 1) * CS];
      const ug = W.ug = new THREE.Group(); const fb = new OBA.Batch(), wb = new OBA.Batch();
      W.UND = { UX, UY, MW, MH, x0: UX * CS, z0: UY * CS, x1: (UX + MW * 2) * CS, z1: (UY + MH * 2) * CS };
      for (let my = 0; my < MH; my++) for (let mx = 0; mx < MW; mx++) {
        const t = um(mx, my); if (!t) continue;
        const i0 = UX + mx * 2, j0 = UY + my * 2;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { W.ground[id(i0 + a, j0 + b)] = GT2[t]; W.solidC[id(i0 + a, j0 + b)] = t === T.water ? 1 : 0; }
        const [x, z] = mc(mx, my), kit = KIT[t];
        if (t !== T.water) fb.add(kit, R() < 0.25 ? 'template-floor-detail' : 'template-floor', mat(x, 0, z, Math.floor(R() * 4) * Math.PI / 2, 1), t === T.sewer ? '#d8dcd0' : null);
        // 벽: 옆이 바위면 그 경계에 벽 (안쪽을 향하게)
        for (const [dx, dy, ax] of [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E']]) {
          const n = um(mx + dx, my + dy);
          const ex = x + dx * 2, ez = z + dy * 2, ry = Math.atan2(dx, dy);   // 안쪽(-dx,-dy)을 -z로
          if (!n) {
            wb.add(kit, R() < 0.2 ? 'template-wall-detail-a' : 'template-wall', mat(ex, 0, ez, ry, 1), t === T.water ? '#c8d0c8' : null);
            if (ax === 'N') { edgeN(i0, j0, E.solid); edgeN(i0 + 1, j0, E.solid); } else if (ax === 'S') { edgeN(i0, j0 + 2, E.solid); edgeN(i0 + 1, j0 + 2, E.solid); }
            else if (ax === 'W') { edgeW(i0, j0, E.solid); edgeW(i0, j0 + 1, E.solid); } else { edgeW(i0 + 2, j0, E.solid); edgeW(i0 + 2, j0 + 1, E.solid); }
          } else if (n !== t && n !== T.water && t !== T.water && (dx > 0 || dy > 0)) {
            // 구역이 바뀌는 곳에 문틀
            const gk = KIT[Math.max(n, t)]; fb.add(gk, 'gate', mat(ex, 0, ez, dx ? Math.PI / 2 : 0, 1));
          }
        }
        // 모서리 기둥 (바깥 모서리)
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (!um(mx + dx, my) && !um(mx, my + dy)) fb.add(kit, 'template-wall-corner', mat(x + dx * 2, 0, z + dy * 2, Math.atan2(-dx, -dy) + Math.PI / 4 * 0, 1));
      }
      // 물길: 초록빛 하수
      for (let my = 0; my < MH; my++) for (let mx = 0; mx < MW; mx++) if (um(mx, my) === T.water) {
        const [x, z] = mc(mx, my); const w = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), W._sewerMat || (W._sewerMat = new THREE.MeshLambertMaterial({ color: '#2c4428', emissive: '#060c06', transparent: true, opacity: 0.94 })));
        w.rotation.x = -Math.PI / 2; w.position.set(x, -0.35, z); ug.add(w);
      }
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(W.UND.x1 - W.UND.x0 + 60, W.UND.z1 - W.UND.z0 + 60), new THREE.MeshBasicMaterial({ color: '#05070a' }));
      dark.rotation.x = -Math.PI / 2; dark.position.set((W.UND.x0 + W.UND.x1) / 2, -0.7, (W.UND.z0 + W.UND.z1) / 2); ug.add(dark);
      // ---------- 소품 · 보관함 ----------
      const P2 = (k, m, mx, my, ox, oz, ry, s, r, cont, name, extra) => {
        const [x, z] = mc(mx, my); const X = x + ox, Z = z + oz; fb.add(k, m, mat(X, 0, Z, ry || 0, s || 1)); if (r) circle(X, Z, r);
        if (cont) { const c = Object.assign({ x: X, z: Z, kind: cont, items: null, bld: -1, name: name || CONT_NAME[cont], area: 'under' }, extra || {}); W.containers.push(c); return c; }
      };
      // 하수도
      for (const [mx, my] of [[2, 6], [4, 13], [2, 19], [4, 27], [8, 3], [9, 5], [7, 27], [10, 25]]) P2('food', 'barrel', mx, my, 0, 0, R() * 6, 1.6, 0.6);
      P2('blaster', 'crate-wide', 9, 3, 0.5, -1, 0.2, 1.6, 0.7, 'crate', '하수도 정비 상자');
      P2('blaster', 'crate-medium', 6, 28, 1, 1, 0, 1.6, 0.5, 'crate', '떠내려온 상자');
      P2('factory', 'box-large', 4, 30, 0, 0, 0, 1.6, 0.8, 'toolbox', '정비공 공구함');
      P2('urban', 'detail-dumpster-open', 10, 29, 0, 0, 0, 1.6, 0.6, 'dumpster');
      for (const [mx, my] of [[2, 3], [4, 9], [2, 24], [4, 18]]) P2('food', 'bag', mx, my, 0, 0, R() * 6, 0.8, 0, 'bag', '버려진 배낭');
      // 동굴: 수정과 버섯
      for (let k = 0; k < 16; k++) { const cand = []; for (let my = 0; my < MH; my++) for (let mx = 0; mx < MW; mx++) if (um(mx, my) === T.cave) cand.push([mx, my]); const [mx, my] = pick(cand); const [ck, cm] = pick([['space', 'rock_crystals'], ['space', 'rock_crystalsLargeA'], ['space', 'rocks_smallA'], ['nature', 'rock_largeA'], ['nature', 'mushroom_red'], ['space', 'rock_largeB']]); P2(ck, cm, mx, my, rf(-1.4, 1.4), rf(-1.4, 1.4), R() * 6, rf(1.4, 2.4), 0.5); }
      P2('food', 'bag', 20, 10, 0, 0, 0, 0.8, 0, 'bag', '실종된 연구원의 배낭', { gear: true });
      P2('space', 'bones', 20, 10, 1, 1, 0.5, 2, 0);
      // 지하 연구소
      P2('station', 'table-large', 16, 20, 0, 0, 0, 1.8, 0.9, 'desk', '안내 데스크');
      P2('station', 'computer-screen', 16, 20, 0, -0.4, 0, 1.6, 0);
      for (let k = 0; k < 3; k++) P2('station', 'chair-cushion', 18 + k, 21, 0, 0, Math.PI, 1.8, 0.3);
      P2('factory', 'machine-window', 13, 25, 0, 0, 0, [1.3, 1.4, 1.3], 1.0); { const [x, z] = mc(13, 25); W.spots.centrifuge = { x, z: z + 1.6 }; }
      P2('station', 'table-large', 14, 27, 0, 0, 0, 1.6, 0.8, 'lab', '실험대'); P2('station', 'table-large', 12, 27, 0.5, 0, 0, 1.6, 0.8, 'lab', '실험대');
      P2('factory', 'pipe-glass-large', 15, 24, 0, 0, 0, 1.4, 0.6); P2('factory', 'pipe-glass-large', 12, 24, 0.5, 0, 0, 1.4, 0.6);
      P2('station', 'computer-system', 15, 28, 0, 0.6, Math.PI, 1.6, 0.6);
      P2('station', 'table-large', 20, 25, 0, 0, Math.PI / 2, 1.8, 0.9, 'desk', '수석 연구원의 책상', { notes: true });
      P2('station', 'computer-wide', 20, 25, 0.4, 0, Math.PI / 2, 1.6, 0);
      for (let k = 0; k < 3; k++) P2('station', 'container-tall', 22, 24 + k * 2, 1.2, 0, -Math.PI / 2, 1.8, 0.5, 'medcab', '자료·약품 보관장');
      for (let k = 0; k < 4; k++) P2('shop', 'freezers-standing', 14 + k * 2, 31, 0, -1.4, 0, 2, 0.6, 'freezer', '냉장 보관고', k === 1 ? { medium: true } : null);
      for (let k = 0; k < 3; k++) P2('blaster', 'crate-wide', 15 + k * 2, 34, 0, 0.8, 0, 1.6, 0.7, k === 1 ? 'mil' : 'crate', k === 1 ? '보안 무기 상자' : '보급품 상자');
      P2('space', 'machine_generator', 21, 33, 0, 0, 0, 2, 1.0); P2('space', 'machine_wireless', 14, 21, 0, 0, 0, 2, 0.8);
      P2('space', 'stairs', 20, 19, 0.5, 0, Math.PI, 1.0, 0);
      // ---------- 맨홀·계단 (순간이동) ----------
      const MAN = (ci, cj) => { const x = cx(ci), z = cz(cj); put('proto', 'shape-cylinder', x, 0.01, z, 0, [1.4, 0.05, 1.4], '#4a4e56'); return [x, z]; };
      W.portals = [];
      const add = (name, cpos, mx, my, upLabel) => { const [ux, uz] = mc(mx, my); P2('cave', 'ladder', mx, my, 0, -1.7, 0, 1.2, 0); W.portals.push({ name, x: cpos[0], z: cpos[1], ux, uz, up: upLabel }); };
      add('시내 맨홀', MAN(40, 31), 2, 1, '사다리로 올라가기 (시내)');
      add('공장 앞 맨홀', MAN(47, 66), 2, 32, '사다리로 올라가기 (공장 앞)');
      add('항구 길 맨홀', MAN(80, 47), 0, 16, '사다리로 올라가기 (항구 길)');
      { const [ux, uz] = mc(20, 20); W.portals.push({ name: '연구소 지하 계단', x: cx(78), z: cz(23), ux, uz, up: '계단으로 올라가기 (연구소)', stairs: true }); put('build', 'stairs-closed-short', cx(78), 0.1, cz(23) + 0.4, Math.PI, 1, '#c0c8d8'); }
      W.spots.ulab = { x: mc(17, 22)[0], z: mc(17, 22)[1] };
      W.zones.push({ name: '하수도', i: UX + 6, j: UY + 32, under: true }, { name: '무너진 동굴', i: UX + 32, j: UY + 24, under: true }, { name: '지하 연구소', i: UX + 36, j: UY + 52, under: true });
      // 만들기
      const gf = fb.build({ receive: true }); ug.add(gf);
      const gw = wb.build({ receive: true, variant: 'ucut' }); ug.add(gw); W.ugWalls = gw;
      W.isUnder = x => x >= CN * CS;
    }

    // 시작 위치: 서쪽 주택가의 집 하나
    const homes = W.buildings.filter(b => b.kind === 'house');
    const home = homes.reduce((a, b) => Math.hypot(b.i0 - 20, b.j0 - 40) < Math.hypot(a.i0 - 20, a.j0 - 40) ? b : a, homes[0]);
    W.home = home; W.start = { x: cx(home.i0 + 1), z: cz(home.j0 + 1) };
    return W;
  };
})();

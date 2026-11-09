/* 감염 도시 · 핵심: 화면, 입력, 충돌, 시야, 플레이어 */
(function () {
  'use strict';
  const OB = window.OB = { t: 0, dt: 0, paused: true, keys: {}, mouse: { x: 0, y: 0, down: false, gx: 0, gz: 0 }, noises: [], fx: [] };
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  OB.clamp = clamp; OB.lerp = lerp;
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  OB.angDiff = angDiff;

  // ---------------- 화면 ----------------
  OB.initRender = function (canvas) {
    const R = OB.renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
    R.outputEncoding = THREE.sRGBEncoding; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.localClippingEnabled = true;
    R.setPixelRatio(Math.min(devicePixelRatio, OB.lowGfx ? 1 : 1.6));
    const S = OB.scene = new THREE.Scene();
    S.background = new THREE.Color('#9fc4d8'); S.fog = new THREE.Fog('#9fc4d8', 45, 95);
    OB.cam = new THREE.PerspectiveCamera(32, 1, 0.5, 220);
    OB.hemi = new THREE.HemisphereLight('#ffffff', '#5a6a4a', 0.75); S.add(OB.hemi);
    const sun = OB.sun = new THREE.DirectionalLight('#fff2dc', 0.85); sun.castShadow = true;
    sun.shadow.mapSize.set(OB.lowGfx ? 1024 : 2048, OB.lowGfx ? 1024 : 2048); const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0008;
    S.add(sun, sun.target);
    OB.flash = new THREE.SpotLight('#fff6d8', 0, 22, 0.55, 0.5, 1.2); OB.flash.castShadow = false; S.add(OB.flash, OB.flash.target);
    OB.glow = new THREE.PointLight('#ffd8a0', 0, 7, 1.5); S.add(OB.glow);
    addEventListener('resize', OB.resize); OB.resize();
  };
  OB.resize = function () {
    const w = innerWidth, h = innerHeight; OB.renderer.setSize(w, h, false); OB.cam.aspect = w / h;
    OB.cam.fov = w < h ? 46 : 32; OB.cam.updateProjectionMatrix();
  };
  OB.zoom = 26;
  const CAMDIR = new THREE.Vector3(0.62, 1, 0.62).normalize();
  OB.camYaw = Math.atan2(CAMDIR.x, CAMDIR.z);   // 화면 위쪽 = 이 방향의 반대
  // 화면 기준 이동 방향 → 세계 방향
  OB.screenToWorld = function (sx, sy) {   // sx 오른쪽+, sy 아래+
    const a = OB.camYaw; const fx = -Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
    return [rx * sx - fx * sy, rz * sx - fz * sy];
  };
  OB.updateCamera = function (dt) {
    const P = OB.P; if (!P) return;
    const tgt = OB._camT = OB._camT || new THREE.Vector3(P.x, 0, P.z);
    tgt.x = lerp(tgt.x, P.x, Math.min(1, dt * 6)); tgt.z = lerp(tgt.z, P.z, Math.min(1, dt * 6));
    let shake = OB.shake || 0; OB.shake = Math.max(0, shake - dt * 3);
    const sx = (Math.random() - .5) * shake * 0.4, sz = (Math.random() - .5) * shake * 0.4;
    OB.cam.position.set(tgt.x + CAMDIR.x * OB.zoom + sx, CAMDIR.y * OB.zoom, tgt.z + CAMDIR.z * OB.zoom + sz);
    OB.cam.lookAt(tgt.x + sx, 0.8, tgt.z + sz);
    OB.sun.position.set(tgt.x + 25, 45, tgt.z + 12); OB.sun.target.position.set(tgt.x, 0, tgt.z);
  };
  // 마우스 → 땅 위 점
  const _ray = new THREE.Raycaster(), _pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9), _hit = new THREE.Vector3(), _ndc = new THREE.Vector2();
  OB.pickGround = function (cx, cy) {
    _ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); _ray.setFromCamera(_ndc, OB.cam);
    if (_ray.ray.intersectPlane(_pl, _hit)) return [_hit.x, _hit.z]; return null;
  };

  // ---------------- 입력 ----------------
  OB.initInput = function () {
    const K = OB.keys;
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code; if (!K[k]) { K[k] = true; OB.onKey && OB.onKey(k, e); }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => { K[e.code] = false; });
    addEventListener('blur', () => { for (const k in K) K[k] = false; OB.mouse.down = false; });
    const cv = OB.renderer.domElement;
    cv.addEventListener('mousemove', e => { OB.mouse.x = e.clientX; OB.mouse.y = e.clientY; OB.mouse.used = true; });
    cv.addEventListener('mousedown', e => { OB.mouse.x = e.clientX; OB.mouse.y = e.clientY; if (e.button === 0) { OB.mouse.down = true; OB.onAttack && OB.onAttack(); } if (e.button === 2) OB.onShove && OB.onShove(); });
    addEventListener('mouseup', e => { if (e.button === 0) OB.mouse.down = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { OB.zoom = clamp(OB.zoom + Math.sign(e.deltaY) * 2, 14, 44); e.preventDefault(); }, { passive: false });
  };

  // ---------------- 충돌 ----------------
  const E = () => OBW.E;
  // 경계가 막혔나? who: 'p' 플레이어, 'z' 좀비, 'see' 시야, 'sound'
  OB.edgeBlocks = function (ax, i, j, who) {
    const W = OB.W, v = ax === 'W' ? W.getW(i, j) : W.getN(i, j), e = OBW.E;
    if (v === e.none || v === e.rail) return false;
    if (v === e.wall || v === e.solid) return true;
    if (v === e.fence) return who !== 'see' && who !== 'sound';
    const o = W.eRef[ax + ',' + i + ',' + j];
    if (v === e.window) { if (who === 'see') return !!(o && o.bar >= 2); if (who === 'sound') return false; return !(o && o.broken && o.bar === 0); }
    if (v === e.door) { if (!o) return true; if (o.broken) return false; if (who === 'sound') return false; if (o.bar > 0) return true; return !o.open; }
    return true;
  };
  function pushSeg(e, x0, z0, x1, z1, r) {
    const dx = x1 - x0, dz = z1 - z0, L = dx * dx + dz * dz;
    let t = ((e.x - x0) * dx + (e.z - z0) * dz) / L; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x0 + dx * t, pz = z0 + dz * t, ox = e.x - px, oz = e.z - pz, d2 = ox * ox + oz * oz;
    if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-4; const k = (r - d) / d; e.x += ox * k; e.z += oz * k; return true; }
    return false;
  }
  OB.collide = function (e, r, who) {
    const W = OB.W, CS = OBW.CS, N = OBW.N;
    const ci = Math.floor(e.x / CS), cj = Math.floor(e.z / CS); let hit = false;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      if (OB.edgeBlocks('W', i, j, who)) hit = pushSeg(e, i * CS, j * CS, i * CS, (j + 1) * CS, r + 0.06) || hit;
      if (OB.edgeBlocks('N', i, j, who)) hit = pushSeg(e, i * CS, j * CS, (i + 1) * CS, j * CS, r + 0.06) || hit;
      if (W.solidC[j * N + i]) {   // 막힌 칸(물, 고층 빌딩)
        const x0 = i * CS, z0 = j * CS, nx = clamp(e.x, x0, x0 + CS), nz = clamp(e.z, z0, z0 + CS), ox = e.x - nx, oz = e.z - nz, d2 = ox * ox + oz * oz;
        if (d2 < r * r) { if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; e.x += ox * k; e.z += oz * k; } else { e.x += (e.x - (x0 + CS / 2)) * 0.2; e.z += (e.z - (z0 + CS / 2)) * 0.2; } hit = true; }
      }
      const cs = W.cgrid[i + ',' + j]; if (cs) for (const c of cs) {
        if (c._f === OB._cf) continue; c._f = OB._cf;
        const ox = e.x - c.x, oz = e.z - c.z, rr = c.r + r, d2 = ox * ox + oz * oz;
        if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4, k = (rr - d) / d; e.x += ox * k; e.z += oz * k; hit = true; }
      }
    }
    // 지도 끝
    e.x = clamp(e.x, 0.5, N * CS - 0.5); e.z = clamp(e.z, 0.5, N * CS - 0.5);
    return hit;
  };
  OB._cf = 0;
  OB.move = function (e, dx, dz, r, who) {
    const L = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(L / 0.25));
    for (let k = 0; k < n; k++) { e.x += dx / n; e.z += dz / n; OB._cf++; OB.collide(e, r, who); }
  };
  // 시야 (격자 따라 가기): 막힘 없으면 true
  OB.los = function (x0, z0, x1, z1, who) {
    const CS = OBW.CS; who = who || 'see';
    let i = Math.floor(x0 / CS), j = Math.floor(z0 / CS); const ti = Math.floor(x1 / CS), tj = Math.floor(z1 / CS);
    const dx = x1 - x0, dz = z1 - z0, si = Math.sign(dx), sj = Math.sign(dz);
    let tMaxX = dx !== 0 ? ((si > 0 ? (i + 1) * CS : i * CS) - x0) / dx : Infinity, tMaxZ = dz !== 0 ? ((sj > 0 ? (j + 1) * CS : j * CS) - z0) / dz : Infinity;
    const tdX = dx !== 0 ? CS / Math.abs(dx) : Infinity, tdZ = dz !== 0 ? CS / Math.abs(dz) : Infinity;
    for (let s = 0; s < 80; s++) {
      if (i === ti && j === tj) return true;
      if (tMaxX < tMaxZ) { const ei = si > 0 ? i + 1 : i; if (OB.edgeBlocks('W', ei, j, who)) return false; i += si; tMaxX += tdX; }
      else { const ej = sj > 0 ? j + 1 : j; if (OB.edgeBlocks('N', i, ej, who)) return false; j += sj; tMaxZ += tdZ; }
      if (who === 'see' && OB.W.solidC[j * OBW.N + i] && OB.W.ground[j * OBW.N + i] !== OBW.GR.water && OB.W.ground[j * OBW.N + i] !== OBW.GR.deep) return false;
    }
    return true;
  };
  OB.cellOf = (x, z) => [Math.floor(x / OBW.CS), Math.floor(z / OBW.CS)];
  OB.bldAt = (x, z) => { const [i, j] = OB.cellOf(x, z); return OB.W.inb(i, j) ? OB.W.bld[j * OBW.N + i] : -1; };

  // ---------------- 길찾기: 플레이어 기준 흐름장 ----------------
  OB.flow = null;
  OB.buildFlow = function (tx, tz, maxD) {
    const N = OBW.N, W = OB.W; const dist = OB.flow || (OB.flow = new Int16Array(N * N)); dist.fill(-1);
    const [si, sj] = OB.cellOf(tx, tz); const q = new Int32Array(N * N); let h = 0, t = 0;
    dist[sj * N + si] = 0; q[t++] = sj * N + si;
    while (h < t) {
      const c = q[h++], i = c % N, j = (c / N) | 0, d = dist[c]; if (d >= maxD) continue;
      // 이웃: 경계가 막히지 않았고 칸이 막히지 않은 곳 (문은 닫혀 있어도 좀비가 두드리러 가도록 통과로 계산)
      const nb = [[i - 1, j, 'W', i, j], [i + 1, j, 'W', i + 1, j], [i, j - 1, 'N', i, j], [i, j + 1, 'N', i, j + 1]];
      for (const [ni, nj, ax, ei, ej] of nb) {
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nc = nj * N + ni; if (dist[nc] >= 0 || W.solidC[nc]) continue;
        const v = ax === 'W' ? W.getW(ei, ej) : W.getN(ei, ej), e = OBW.E;
        if (v === e.wall || v === e.solid || v === e.fence) continue;
        if (v === e.window) { const o = W.eRef[ax + ',' + ei + ',' + ej]; if (o && o.bar >= 3) continue; }
        dist[nc] = d + (v === e.door || v === e.window ? 3 : 1); q[t++] = nc;
      }
    }
  };
  // 흐름장에서 다음 칸 방향
  OB.flowDir = function (x, z) {
    const N = OBW.N, CS = OBW.CS, W = OB.W, F = OB.flow; if (!F) return null;
    const [i, j] = OB.cellOf(x, z), c = j * N + i, d = F[c]; if (d < 0) return null;
    let best = null, bd = d;
    const nb = [[i - 1, j, 'W', i, j], [i + 1, j, 'W', i + 1, j], [i, j - 1, 'N', i, j], [i, j + 1, 'N', i, j + 1]];
    for (const [ni, nj, ax, ei, ej] of nb) {
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nd = F[nj * N + ni]; if (nd < 0 || nd >= bd) continue;
      const v = ax === 'W' ? W.getW(ei, ej) : W.getN(ei, ej); if (v === OBW.E.wall || v === OBW.E.solid || v === OBW.E.fence) continue;
      bd = nd; best = [ni, nj, ax, ei, ej];
    }
    if (!best) return null;
    return { x: (best[0] + 0.5) * CS, z: (best[1] + 0.5) * CS, edge: best };
  };

  // ---------------- 소리 ----------------
  OB.noise = function (x, z, r, src) { OB.noises.push({ x, z, r, t: 0, src }); if (OB.noises.length > 30) OB.noises.shift(); };

  // ---------------- 캐릭터 애니메이션 (뼈대 덧입히기) ----------------
  //  기본 동작 3개(대기·달리기·점프) + 뼈 회전으로 걷기·휘두르기·밀치기·좀비 팔 뻗기·쓰러짐을 만듦
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function addRot(b, x, y, z) { if (!b) return; _e.set(x, y, z); _q.setFromEuler(_e); b.quaternion.multiply(_q); }
  OB.addRot = addRot;
  OB.setAnim = function (C, name, fade) {
    if (C.cur === name) return; const a = C.act[name]; if (!a) return;
    a.reset().play(); if (C.cur && C.act[C.cur]) C.act[C.cur].crossFadeTo(a, fade || 0.2, false); C.cur = name;
  };
  // ---------------- 플레이어 ----------------
  OB.makePlayer = function (skin, x, z) {
    const C = OBA.char(skin); OB.scene.add(C.root);
    const P = OB.P = {
      x, z, ry: 0, r: 0.32, C, skin, hp: 100, hunger: 10, thirst: 10, fatigue: 5, stamina: 100, virus: 0, infected: false, immunity: 70,
      bleed: 0, wounds: [], sick: 0, temp: 36.5, speedMul: 1, swing: 0, swingT: 0, shoveT: 0, hitT: 0, sneak: false, run: false, dead: false,
      inv: [], weapon: null, bag: null, flash: false, nutr: { carb: 0, prot: 0, fat: 0, vit: 0 }, kills: 0, asleep: false, inside: -1, moved: 0, antiviral: 0, vaccinated: false
    };
    C.act.idle.play(); C.cur = 'idle';
    return P;
  };
  OB.attachWeapon = function (P) {
    const C = P.C; if (C.wmesh) { C.wmesh.parent && C.wmesh.parent.remove(C.wmesh); C.wmesh = null; }
    const w = P.weapon && OB.ITEMS[P.weapon.id]; if (!w || !w.hold) return;
    const [k, m, s, rx, ry, rz, ox, oy, oz] = w.hold;
    const g = OBA.mesh(k, m); g.scale.setScalar(s / 0.4648); g.rotation.set(rx || 0, ry || 0, rz || 0); g.position.set((ox || 0) / 0.4648, (oy || 0) / 0.4648, (oz || 0) / 0.4648);
    C.bones.RightHand.add(g); C.wmesh = g;
  };
  OB.isInside = (x, z) => OB.bldAt(x, z);
})();

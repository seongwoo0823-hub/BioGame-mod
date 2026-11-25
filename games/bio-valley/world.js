// 바이오 밸리: 화면(렌더러·조명·종이 렌즈·카메라·인쇄된 땅·도로·겹침 표시·생물·날씨)
import * as THREE from 'three';
import { paperTextures, paperMaterial, paperLights, enableSoftShadows, PaperPost, PAPER_LIGHT, fitShadow, makeCard, setPrintScale } from './lib/paperkit-3d.js';
import * as P2 from './lib/paperkit-2d.js';
import { Baker } from './bake.js';
import { createArt, TILE } from './art.js';
import { createBuildArt, personPrefab, truckPrefab, critterPrefab, bitPrefab, PEOPLE } from './art-build.js';

export const N = 40;                    // 맵 한 변 칸 수
export const HALF = N * TILE / 2;       // 맵 반폭(단위)
export const MARGIN = 72;               // 맵 바깥 인쇄 여백
export const tileX = (i) => (i - N / 2 + 0.5) * TILE;
export const tileZ = (j) => (j - N / 2 + 0.5) * TILE;
export const toTile = (x) => Math.floor(x / TILE + N / 2);

export function detectQuality() {
  const uq = new URLSearchParams(location.search).get('q'); if (uq) return uq;
  try { const q = localStorage.getItem('bioValleyGfx'); if (q) return q; } catch {}
  const touch = matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory || 4, small = Math.min(screen.width, screen.height) < 700;
  if (touch && (small || mem <= 4)) return 'low';
  if (touch) return 'mid';
  return 'high';
}

export class World {
  constructor(canvas, { quality = 'high' } = {}) {
    this.q = quality;
    this.canvas = canvas;
    const lowQ = quality === 'low';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: lowQ, alpha: true, powerPreference: 'high-performance' });
    const dpr = Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'mid' ? 1.5 : 1.25);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = lowQ ? THREE.PCFShadowMap : THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 8, 1400);
    this.cam = { x: 0, z: 0, tx: 0, tz: 0, dist: 150, tdist: 150, yaw: 0, tyaw: 0, pitch: 0.86, minD: 60, maxD: 330 };
    this.time = 0;
    this.blurOn = true;
    this.listeners = [];
    setPrintScale(1);
  }

  /** 지형을 고르면 새로 만든다(땅·조명·장식 프리팹) */
  setup(biome) {
    const q = this.q, lowQ = q === 'low';
    this.biome = biome;
    // 이전 장면 정리
    if (this.baker) { this.scene.remove(this.baker.root); this.baker.dispose(); }
    if (this.paper) { this.paper.map.dispose(); this.paper.normalMap.dispose(); }
    for (const o of [...this.scene.children]) this.scene.remove(o);
    this.paper = paperTextures(this.renderer, { color: biome.stock, unitsPerTile: 6 });
    this.baker = new Baker(this.renderer, this.paper, { maxAtlas: lowQ ? 2048 : 4096 });
    this.scene.add(this.baker.root);
    this.A = createArt(this.paper, { quality: q, contact: biome.contact, decorPpu: lowQ ? 26 : 34, buildPpu: lowQ ? 22 : 30 });
    this.B = createBuildArt(this.A, biome);
    // 조명
    const L = biome.light;
    this.lights = paperLights(this.scene, { target: new THREE.Vector3(0, 0, 0), keyDir: L.keyDir, key: L.key, keyIntensity: L.keyIntensity, fill: L.fill, fillIntensity: L.fillIntensity,
      fillDir: [0.45, 0.5, 1.0], sky: L.sky, ground: L.ground, skyIntensity: L.skyIntensity, shadowExtent: 90, distance: 200, mapSize: q === 'high' ? 4096 : q === 'mid' ? 2048 : 1536 });
    PAPER_LIGHT.leak.value.set(L.leak); PAPER_LIGHT.wrap.value = L.wrap || 0.3;
    this.keyOff = this.lights.key.position.clone().sub(this.lights.key.target.position);
    if (!lowQ && !this.softDone) { enableSoftShadows(this.lights.key, { softness: 0.24, maxPenumbra: 1.6, blockerSamples: q === 'high' ? 16 : 8, filterSamples: q === 'high' ? 24 : 12 }); this.softDone = true; }
    this.scene.background = new THREE.Color(biome.ground.base);
    // 렌즈
    if (!lowQ) {
      const P = biome.post;
      if (!this.post) this.post = new PaperPost(this.renderer, this.scene, this.camera, {});
      Object.assign(this.post.o, { focusBand: 0.36, ramp: 0.34, maxBlur: 14, taps: q === 'high' ? 40 : 18, ao: q === 'high' ? 1.1 : 0, aoRadius: 2.2, aoBias: 0.1,
        hazeStart: 140, hazeEnd: 420, hazeAmount: 0.35, highlightBoost: 0.1, contrast: 1.15, vignette: 0.04, greenDesat: P.greenDesat ?? 0.25, edgeLine: 0.25, ...P });
      this.post.dof.defines.TAPS = this.post.o.taps; this.post.dof.needsUpdate = true;
      this.post.apply();
    } else {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 0.95;
    }
    this.buildOverlay();
    this.defineCommon();
    this.resize();
  }

  // ------------------------------------------------------------------------------------------------------------
  // 인쇄된 땅: 한 장의 커다란 종이. 물(호수)은 인쇄로, 지역 경계는 찢긴 종이 테두리
  // ------------------------------------------------------------------------------------------------------------
  buildGround(lake = null) {
    const B = this.biome, G = B.ground, q = this.q, ext = HALF + MARGIN, size = ext * 2;
    const px = q === 'high' ? 4096 : q === 'mid' ? 3072 : 2048, ppu = px / size;
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d');
    const X = (x) => (x + ext) * ppu, Z = (z) => (z + ext) * ppu, rnd = P2.rng(B.seed * 7 + 3);
    // 물감 번짐: 작은 캔버스에 그린 뒤 부드럽게 키움(낮은 주파수라 빠르고 같은 결과)
    const S = 512, sk = S / size, sc = document.createElement('canvas'); sc.width = sc.height = S;
    const sg = sc.getContext('2d');
    sg.fillStyle = G.base; sg.fillRect(0, 0, S, S);
    for (const [n0, r0, r1, a] of [[90, 60, 150, 0.3], [260, 18, 50, 0.22], [700, 4, 11, 0.12]]) for (let i = 0; i < n0; i++) {
      const x = rnd() * S, y = rnd() * S, r = (r0 + rnd() * (r1 - r0)) * sk, col = G.washes[Math.floor(rnd() * G.washes.length)];
      const gr = sg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, P2.rgba(col, a * 0.6)); gr.addColorStop(0.78, P2.rgba(col, a)); gr.addColorStop(0.9, P2.rgba(P2.shade(col, -0.12), a * 1.1)); gr.addColorStop(1, P2.rgba(col, 0));
      sg.fillStyle = gr; sg.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(sc, 0, 0, px, px);
    const tm = [performance.now()];
    // 무리 지은 작은 무늬(풀 포기·자갈·눈 반짝)
    const mask = P2.tileNoise(256, 9, rnd), at = (x, y) => mask[(Math.floor(y / px * 256) & 255) * 256 + (Math.floor(x / px * 256) & 255)];
    g.lineCap = 'round';
    for (let k = 0; k < 16000; k++) {
      const x = rnd() * px, y = rnd() * px;
      if (rnd() > (at(x, y) > 0.66 ? 0.6 : 0.012)) continue;
      const s = (0.22 + rnd() * 0.25) * ppu;
      if (B.id === 'snow') { g.fillStyle = P2.rgba(rnd() < 0.5 ? '#ffffff' : G.marks, 0.55); g.beginPath(); g.ellipse(x, y, s * 0.9, s * 0.35, 0, 0, Math.PI * 2); g.fill(); }
      else if (B.id === 'desert') { g.strokeStyle = P2.rgba(G.marks, 0.5); g.lineWidth = 0.06 * ppu; g.beginPath(); g.arc(x, y, s * 1.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
      else { g.strokeStyle = P2.rgba(rnd() < 0.7 ? G.marks : G.light, 0.55); g.lineWidth = 0.07 * ppu; for (let b = -1; b <= 1; b++) { g.beginPath(); g.moveTo(x + b * s * 0.3, y); g.lineTo(x + b * s * 0.6, y - s * (b ? 0.8 : 1.1)); g.stroke(); } }
    }
    tm.push(performance.now());
    // 고운 모래·흙 알갱이
    g.fillStyle = P2.rgba(G.grit, 0.25);
    for (let k = 0; k < 9000; k++) { const x = rnd() * px, y = rnd() * px; g.fillRect(x, y, 1.2, 1.2); }
    tm.push(performance.now());
    // 호수(오아시스·얼음 연못)
    this.lake = lake;
    if (lake) {
      const torn = (pts, fill, fringe) => {
        const out = [];
        for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.25)); for (let k = 0; k < n; k++) { const t = k / n, j = (rnd() - 0.5) * 0.18; out.push([x0 + (x1 - x0) * t + j, z0 + (z1 - z0) * t + j]); } }
        g.beginPath(); out.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.closePath(); g.fillStyle = fill; g.fill();
        if (fringe) { g.strokeStyle = fringe; g.lineWidth = 0.22 * ppu; g.stroke(); }
      };
      const W = B.water, cx = lake.cx, cz = lake.cz;
      const about = (k) => lake.pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
      torn(about(1.1), W.rim, 'rgba(255,250,236,0.7)');
      torn(lake.pts, W.colors[0], 'rgba(255,250,240,0.6)');
      torn(about(0.6), P2.rgba(W.colors[1], 0.55), null);
      g.strokeStyle = W.marks === 'cracks' ? 'rgba(255,255,255,0.8)' : 'rgba(250,244,228,0.75)'; g.lineWidth = 0.12 * ppu;
      for (let k = 0; k < 260; k++) {
        const x = cx + (rnd() - 0.5) * lake.rx * 1.8, z = cz + (rnd() - 0.5) * lake.rz * 1.8;
        if (!lake.inside(x, z, 0.85)) continue;
        g.beginPath();
        if (W.marks === 'cracks') { let px2 = x, pz = z; g.moveTo(X(px2), Z(pz)); for (let s = 0; s < 3; s++) { px2 += (rnd() - 0.5) * 3; pz += (rnd() - 0.5) * 3; g.lineTo(X(px2), Z(pz)); } }
        else { const l = 0.8 + rnd() * 1.6; g.moveTo(X(x - l / 2), Z(z)); g.lineTo(X(x + l / 2), Z(z + 0.15)); }
        g.stroke();
      }
    }
    tm.push(performance.now());
    // 종이결(아주 옅게): 노멀맵이 결을 주고, 여기서는 얼룩만
    tm.push(performance.now()); this.groundTimes = tm.map((t, i) => i ? Math.round(t - tm[i - 1]) : 0);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const nrm = this.paper.normalMap.clone(); nrm.repeat.set(size / 6, size / 6); nrm.needsUpdate = true;
    const mat = paperMaterial({ map: tex, normalMap: nrm, normalScale: 0.9 });
    if (this.ground) { this.scene.remove(this.ground); this.ground.material.map.dispose(); this.ground.material.dispose(); this.ground.geometry.dispose(); }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
    this.ground = mesh; this.scene.add(mesh);
    this.groundCanvas = c;
  }

  // ------------------------------------------------------------------------------------------------------------
  // 겹침 표시(소유하지 않은 땅 어둡게, 격자, 건설 미리보기 칸, 오염도)
  // ------------------------------------------------------------------------------------------------------------
  buildOverlay() {
    const data = new Uint8Array(N * N * 4);
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const prev = new Uint8Array(N * N * 4), ptex = new THREE.DataTexture(prev, N, N, THREE.RGBAFormat); ptex.magFilter = THREE.NearestFilter; ptex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tOwn: { value: tex }, tPrev: { value: ptex }, uGrid: { value: 0 }, uN: { value: N }, uPol: { value: 0 }, uTint: { value: new THREE.Color('#3a2a1a') }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */`
        uniform sampler2D tOwn; uniform sampler2D tPrev; uniform float uGrid; uniform float uN; uniform float uPol; uniform vec3 uTint; uniform float uTime;
        varying vec2 vUv;
        void main(){
          vec2 uv = vUv; vec4 o = texture2D(tOwn, uv); vec4 p = texture2D(tPrev, uv);
          float own = o.r; float a = (1.0 - own) * 0.30; vec3 col = uTint;
          vec2 g = fract(uv * uN); float line = 1.0 - smoothstep(0.0, 0.035, min(min(g.x, 1.0 - g.x), min(g.y, 1.0 - g.y)));
          if (uGrid > 0.5) { col = mix(col, vec3(1.0, 0.97, 0.9), line * own); a = max(a, line * 0.28 * own); }
          if (uPol > 0.5) { float pol = o.g; col = mix(col, mix(vec3(0.45,0.7,0.35), vec3(0.75,0.35,0.15), pol), 0.9); a = max(a, 0.1 + pol * 0.45); }
          if (p.a > 0.0) { vec3 pc = p.g > 0.5 ? vec3(0.55, 0.85, 0.5) : vec3(0.95, 0.4, 0.3); if (p.b > 0.5) pc = vec3(1.0, 0.85, 0.4); float edge = 1.0 - smoothstep(0.0, 0.08, min(min(g.x,1.0-g.x), min(g.y,1.0-g.y))); col = mix(col, pc, 1.0); a = max(a, 0.32 + edge * 0.45 + 0.08 * sin(uTime * 6.0)); }
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(N * TILE, N * TILE), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = 1;
    this.scene.add(m);
    this.overlay = { mesh: m, data, tex, prev, ptex, mat };
  }
  setOwned(owned) { const d = this.overlay.data; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = ((N - 1 - j) * N + i) * 4; d[k] = owned[j * N + i] ? 255 : 0; d[k + 3] = 255; } this.overlay.tex.needsUpdate = true; }
  setPollution(pol) { const d = this.overlay.data; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = ((N - 1 - j) * N + i) * 4; d[k + 1] = Math.min(255, pol[j * N + i] * 255); } this.overlay.tex.needsUpdate = true; }
  /** cells: [[i, j, ok(1/0), special]] */
  setPreview(cells) {
    const p = this.overlay.prev; p.fill(0);
    for (const [i, j, ok, sp] of cells) { if (i < 0 || j < 0 || i >= N || j >= N) continue; const k = ((N - 1 - j) * N + i) * 4; p[k + 1] = ok ? 255 : 0; p[k + 2] = sp ? 255 : 0; p[k + 3] = 255; }
    this.overlay.ptex.needsUpdate = true;
  }
  setGrid(on) { this.overlay.mat.uniforms.uGrid.value = on ? 1 : 0; }
  setPolView(on) { this.overlay.mat.uniforms.uPol.value = on ? 1 : 0; }

  // ------------------------------------------------------------------------------------------------------------
  // 공용 프리팹(도로 16종, 사람, 차, 생물, 날씨 조각)
  // ------------------------------------------------------------------------------------------------------------
  defineCommon() {
    const bk = this.baker, A = this.A, B = this.B, bio = this.biome;
    for (let m = 0; m < 16; m++) bk.define('road' + m, () => ({ segs: [{ obj: this.roadCard(m) }], shadow: false, alphaTest: 0.5, noSides: true }));
    PEOPLE.forEach((_, k) => bk.define('person' + k, () => personPrefab(A, k)));
    bk.define('truck0', () => truckPrefab(A, B, 0)); bk.define('truck1', () => truckPrefab(A, B, 1));
    for (const c of bio.critters) bk.define('critter:' + c, () => critterPrefab(A, c));
    if (bio.butterflies) bk.define('critter:butterfly', () => bitPrefab(A, 'butterfly'));
    for (const k of ['leaf', 'leaf2', 'snow', 'petal', 'needle', 'dust', 'puff', 'bird']) bk.define('bit:' + k, () => bitPrefab(A, k));
    bk.define('critter:duck', () => critterPrefab(A, 'duck'));
  }
  // 도로 칸: 찢긴 가장자리, 옅은 섬유 테두리, 자갈 알갱이. mask 비트: 1 북(-z) 2 동(+x) 4 남(+z) 8 서(-x)
  roadCard(mask) {
    const R = this.biome.road, w = TILE * 0.62, hw = w / 2, T = TILE / 2, r = P2.rng(91 + mask);
    const ppu = this.q === 'low' ? 24 : 40, PX = Math.round(TILE * ppu);
    const c = document.createElement('canvas'); c.width = c.height = PX;
    const g = c.getContext('2d');
    g.setTransform(ppu, 0, 0, -ppu, PX / 2, PX / 2);   // 카드 좌표: x 동, y 북(-z)
    const jit = (t, k) => (Math.abs(t) > T - 0.5 ? 0 : (Math.sin(t * 3.1 + k * 1.7 + mask) * 0.09 + (r() - 0.5) * 0.12));
    const band = (dir) => {
      const pts = [];
      for (let t = 0; t <= T + 0.9; t += 0.3) pts.push([t, hw + jit(t, dir)]);
      for (let t = T + 0.9; t >= 0; t -= 0.3) pts.push([t, -hw - jit(t, dir + 5)]);
      const a = [0, -Math.PI / 2, Math.PI, Math.PI / 2][dir];
      return pts.map(([u, v]) => [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)]);
    };
    const dirs = []; if (mask & 1) dirs.push(3); if (mask & 2) dirs.push(0); if (mask & 4) dirs.push(1); if (mask & 8) dirs.push(2);
    const polys = [];
    const cpts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rad = hw * (1.04 + (r() - 0.5) * 0.08); cpts.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
    polys.push(cpts);
    for (const d of dirs) polys.push(band(d));
    const trace = (pp) => { g.beginPath(); pp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
    g.lineJoin = 'round';
    g.strokeStyle = P2.rgba(R.edge, 0.85); g.lineWidth = 0.42; for (const pp of polys) { trace(pp); g.stroke(); }
    g.strokeStyle = R.fringe; g.lineWidth = 0.24; for (const pp of polys) { trace(pp); g.stroke(); }
    g.fillStyle = R.fill; for (const pp of polys) { trace(pp); g.fill(); }
    g.save();
    g.beginPath(); for (const pp of polys) { pp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
    g.clip('nonzero');
    // 바퀴·발자국 자리의 약한 얼룩 + 자갈
    g.fillStyle = P2.rgba(P2.shade(R.fill, -0.06), 0.5); for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse((r() - 0.5) * TILE, (r() - 0.5) * TILE, 0.8 + r(), 0.5 + r() * 0.6, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = P2.rgba(R.grit, 0.55); for (let i = 0; i < 80; i++) { g.beginPath(); g.arc((r() - 0.5) * TILE, (r() - 0.5) * TILE, 0.04 + r() * 0.05, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = P2.rgba('#ffffff', 0.28); for (let i = 0; i < 22; i++) { g.beginPath(); g.ellipse((r() - 0.5) * TILE, (r() - 0.5) * TILE, 0.18, 0.08, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.restore();
    // 종이결: 길 위에만
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.22; g.fillStyle = g.createPattern(this.paper.sheet, 'repeat'); g.fillRect(0, 0, PX, PX);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = paperMaterial({ map: tex, normalMap: this.paper.normalMap, normalScale: 0.5 }); mat.alphaTest = 0.5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE, TILE), mat);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.035;
    const grp = new THREE.Group(); grp.add(mesh);
    return grp;
  }

  // ------------------------------------------------------------------------------------------------------------
  // 카메라
  // ------------------------------------------------------------------------------------------------------------
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 세로 화면은 짧은 쪽 기준으로 같은 넓이를 보이게
    const base = 28;
    this.camera.fov = w < h ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) * Math.min(1.7, h / w * 0.85))) : base;
    this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(w, h);
    this.W = w; this.H = h;
  }
  placeCamera() {
    const c = this.cam, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const ox = Math.sin(c.yaw) * cp * c.dist, oz = Math.cos(c.yaw) * cp * c.dist;
    this.camera.position.set(c.x + ox, sp * c.dist, c.z + oz);
    this.camera.lookAt(c.x, 0, c.z);
  }
  stepCamera(dt) {
    const c = this.cam, k = 1 - Math.exp(-dt * 10);
    const lim = HALF + 20;
    c.tx = Math.max(-lim, Math.min(lim, c.tx)); c.tz = Math.max(-lim, Math.min(lim, c.tz));
    c.tdist = Math.max(c.minD, Math.min(c.maxD, c.tdist));
    c.x += (c.tx - c.x) * k; c.z += (c.tz - c.z) * k; c.dist += (c.tdist - c.dist) * k;
    let dy = c.tyaw - c.yaw; c.yaw += dy * (1 - Math.exp(-dt * 7));
    if (Math.abs(dy) < 0.002) c.yaw = c.tyaw;
    // 줌에 따라 내려다보는 각도: 멀수록 더 위에서
    c.pitch = 0.78 + (c.dist - c.minD) / (c.maxD - c.minD) * 0.22;
    this.placeCamera();
    // 그림자 상자를 보이는 곳에 맞춤
    const L = this.lights, ext = Math.min(170, 30 + c.dist * 0.55), sc = L.key.shadow.camera;
    if (Math.abs(sc.right - ext) > 2) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
    const fwd = new THREE.Vector3(c.x - this.camera.position.x, 0, c.z - this.camera.position.z).normalize();
    fitShadow(L, new THREE.Vector3(c.x + fwd.x * ext * 0.25, 0, c.z + fwd.z * ext * 0.25));
  }
  rotate(dir) { this.cam.tyaw += dir * Math.PI / 2; const y = Math.round(this.cam.tyaw / (Math.PI / 2)) * Math.PI / 2; this.baker.setCamYaw(y); }
  /** 화면 좌표(px) → 땅 위 점 */
  pick(sx, sy) {
    const v = new THREE.Vector3((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = v.sub(o).normalize();
    if (Math.abs(d.y) < 1e-4) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t, z: o.z + d.z * t };
  }
  pan(dx, dy) { // 화면 이동량 → 땅 이동
    const a = this.pick(this.W / 2, this.H / 2), b = this.pick(this.W / 2 - dx, this.H / 2 - dy);
    if (!a || !b) return;
    this.cam.tx += b.x - a.x; this.cam.tz += b.z - a.z;
    this.cam.x += b.x - a.x; this.cam.z += b.z - a.z;
  }
  zoom(f) { this.cam.tdist *= f; }

  // ------------------------------------------------------------------------------------------------------------
  // 아이콘: 프리팹을 작은 사진으로(건설 메뉴)
  // ------------------------------------------------------------------------------------------------------------
  iconOf(key, size = 160) {
    const b = this.baker.bake(key), sc = new THREE.Scene();
    const L = this.biome.light;
    const h = new THREE.HemisphereLight(L.sky, L.ground, 1.4), d = new THREE.DirectionalLight(L.key, 2.8), f = new THREE.DirectionalLight(L.fill, 0.9);
    d.position.set(-6, 9, 6); f.position.set(5, 4, 9); sc.add(h, d, f);
    const grp = new THREE.Group();
    for (const s of b.segs) grp.add(new THREE.Mesh(s.im.geometry, s.im.material));
    sc.add(grp);
    const box = new THREE.Box3().setFromObject(grp), cen = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const R = Math.max(sz.x, sz.y * 1.2, sz.z) * 0.62 + 0.5;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    const dir = new THREE.Vector3(0.55, 0.62, 1).normalize();
    cam.position.copy(cen).addScaledVector(dir, R / Math.tan(THREE.MathUtils.degToRad(15)));
    cam.lookAt(cen);
    const r = this.renderer, prevTM = r.toneMapping, prevExp = r.toneMappingExposure, pr = r.getPixelRatio();
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    const oldClear = r.getClearAlpha(), oldColor = r.getClearColor(new THREE.Color());
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(null);
    const vw = Math.round(size / pr);
    r.setViewport(0, 0, vw, vw); r.setScissor(0, 0, vw, vw); r.setScissorTest(true);
    const bg = sc.background; sc.background = null;
    const ps = r.shadowMap.enabled; r.shadowMap.enabled = false;
    r.render(sc, cam);
    r.shadowMap.enabled = ps;
    const out = document.createElement('canvas'); out.width = out.height = size;
    const H = r.domElement.height;
    out.getContext('2d').drawImage(r.domElement, 0, H - size, size, size, 0, 0, size, size);
    r.setScissorTest(false); r.setViewport(0, 0, this.W, this.H);
    r.setClearColor(oldColor, oldClear); r.toneMapping = prevTM; r.toneMappingExposure = prevExp;
    for (const m of grp.children) grp.remove(m);
    return out.toDataURL('image/png');
  }

  // ------------------------------------------------------------------------------------------------------------
  // 그리기
  // ------------------------------------------------------------------------------------------------------------
  render(dt) {
    this.time += dt;
    this.stepCamera(dt);
    this.baker.update(dt);
    this.overlay.mat.uniforms.uTime.value = this.time;
    if (this.post) {
      const c = this.cam, zk = (c.dist - c.minD) / (c.maxD - c.minD);
      this.post.focus.set(c.x, 0, c.z);
      this.post.o.maxBlur = this.blurOn ? 16 - zk * 9 : 0;
      this.post.o.focusBand = 0.34 + zk * 0.22;
      this.post.render(this.time);
    } else this.renderer.render(this.scene, this.camera);
  }
}

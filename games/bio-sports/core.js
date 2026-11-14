/* 바이오 스포츠 천국 — 공용 엔진
 *  3D(원근/직교 카메라 전환 · 그림자 · 복셀) · 선수 모델(과잠·등번호·ATP 게이지) · 통통 뛰는 애니메이션
 *  입력(키보드·터치) · 효과음(Web Audio) · 화면 UI · 미니맵 · 장면 정리(dispose) · 10개 대학 · 20명 로스터
 */
'use strict';
const SP = window.SP = {SPORTS: {}};
(function () {
  const $ = id => document.getElementById(id);
  SP.$ = $;
  SP.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  SP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SP.rand = (a, b) => a + Math.random() * (b - a);
  SP.ri = n => Math.floor(Math.random() * n);
  SP.lerp = (a, b, t) => a + (b - a) * t;
  SP.fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------------- 대학 10팀 ---------------- */
  // 학교 이름은 팀 구분용이며, 선수는 모두 가상의 인물이에요.
  SP.TEAMS = [
    {id: 'snu', name: '서울대', en: 'SNU Bio-Titans', c1: '#1f4fa8', c2: '#e8eef8', trait: '항상성 마스터', desc: '전 스탯 밸런스 최상 · 체력 감소율 완화', mod: {atp: 4, pow: 4, spd: 4, bal: 4, def: 4}, drain: 0.8},
    {id: 'kaist', name: 'KAIST', en: 'KAIST Cyber-Genes', c1: '#0b6fbf', c2: '#7ad3ff', trait: '시냅스 가속', desc: '반응 속도·패스 정확도 특화', mod: {spd: 7, bal: 9}, pass: 1.25},
    {id: 'postech', name: '포항공대', en: 'POSTECH Synapses', c1: '#b0263b', c2: '#ffd2d8', trait: '근원섬유 폭발', desc: '폭발력·슛 파워 특화', mod: {pow: 12}, shot: 1.2},
    {id: 'yonsei', name: '연세대', en: 'Yonsei Eagles Bio', c1: '#173f8a', c2: '#9ab8ff', trait: '아드레날린 속공', desc: '빠른 스피드·속공 특화', mod: {spd: 12}},
    {id: 'korea', name: '고려대', en: 'Korea Tigers Cell', c1: '#8a1530', c2: '#ffb3c1', trait: '면역 장벽', desc: '피지컬 몸싸움·수비력 특화', mod: {def: 12, pow: 3}},
    {id: 'skku', name: '성균관대', en: 'SKKU Ginkgo Labs', c1: '#2f7a3a', c2: '#c7f0b8', trait: '미토콘드리아 호흡', desc: '지구력·후반 집중력 특화', mod: {atp: 12}, late: 1.12},
    {id: 'hanyang', name: '한양대', en: 'Hanyang Bio-Engines', c1: '#14498f', c2: '#d6e4ff', trait: '정밀 역학', desc: '투구·서브·중거리 슛 정밀도 특화', mod: {bal: 12}},
    {id: 'unist', name: 'UNIST', en: 'UNIST Genome Breakers', c1: '#3a2f8a', c2: '#b8a9ff', trait: '돌연변이 변칙', desc: '크리티컬 확률·변칙 플레이 특화', mod: {pow: 5, spd: 4}, crit: 0.12},
    {id: 'gist', name: 'GIST', en: 'GIST Photon Receptors', c1: '#c75a12', c2: '#ffd9b3', trait: '광수용 시야', desc: '시야·리바운드·낙구 지점 포착 특화', mod: {bal: 6, def: 6}, vision: 1.3},
    {id: 'khu', name: '경희대', en: 'KHU Vital Medics', c1: '#7a1f3d', c2: '#ffd6e4', trait: '바이탈 회복', desc: '부상 방지·휴식 시 ATP 회복 특화', mod: {atp: 7, def: 3}, recover: 1.8}
  ];
  SP.STAT = [['atp', 'ATP 대사량', '지구력·체력'], ['pow', '근원섬유 수축력', '파워·장타·슛 비거리'], ['spd', '시냅스 전도 속도', '스피드·순발력'], ['bal', '소뇌 평형감각', '제구·드리블·리시브'], ['def', '면역 방어력', '태클·블로킹·수비']];
  const SUR = '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부황보'.split('');
  const GIV = ['민준', '서연', '도윤', '하은', '시우', '지우', '주원', '서윤', '하준', '지민', '예준', '수아', '지호', '채원', '준서', '다은', '건우', '윤서', '현우', '지아', '우진', '소율', '선우', '예린', '연우', '하린', '유준', '서아', '정우', '나은', '승현', '가은', '준혁', '시은', '은찬', '유나', '태윤', '민서', '재원', '아린'];
  function seeded(s) { let a = s >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  SP.seeded = seeded;
  // 역할 원형: 20명이 여러 종목 포지션을 고루 맡을 수 있게
  const ARCH = [
    ['수문장형', {def: 18, bal: 10, spd: -6}], ['수문장형', {def: 14, bal: 8}], ['수비형', {def: 14, pow: 6}], ['수비형', {def: 12, atp: 6}], ['수비형', {def: 10, spd: 4}],
    ['수비형', {def: 12, pow: 4}], ['중원형', {bal: 12, atp: 8}], ['중원형', {bal: 10, spd: 6}], ['중원형', {atp: 12, bal: 6}], ['중원형', {bal: 14}],
    ['측면형', {spd: 16, atp: 4}], ['측면형', {spd: 14, bal: 4}], ['공격형', {pow: 16, spd: 4}], ['공격형', {pow: 12, bal: 8}], ['공격형', {pow: 14, spd: 6}],
    ['장신형', {pow: 10, def: 10}], ['장신형', {def: 8, pow: 8, atp: 4}], ['만능형', {bal: 6, spd: 6, pow: 6}], ['만능형', {atp: 6, def: 6, bal: 6}], ['신인', {spd: 6}]
  ];
  const cache = {};
  SP.roster = function (ti) {
    if (cache[ti]) return cache[ti];
    const T = SP.TEAMS[ti], r = seeded(1000 + ti * 7919), used = new Set();
    const list = ARCH.map((a, i) => {
      let name; do { name = SUR[Math.floor(r() * SUR.length)] + GIV[Math.floor(r() * GIV.length)]; } while (used.has(name)); used.add(name);
      const st = {};
      for (const [k] of SP.STAT) st[k] = Math.round(SP.clamp(58 + r() * 18 + (a[1][k] || 0) + (T.mod[k] || 0) - (i === 19 ? 6 : 0), 35, 99));
      return {i, no: [1, 21, 4, 5, 2, 3, 6, 8, 14, 10, 7, 11, 9, 19, 17, 15, 23, 12, 13, 24][i], name, role: a[0], st, ovr: 0};
    });
    list.forEach(p => { p.ovr = Math.round((p.st.atp + p.st.pow + p.st.spd + p.st.bal + p.st.def) / 5); });
    cache[ti] = list; return list;
  };
  // 포지션에 맞는 점수 (자동 라인업용)
  SP.fit = (p, w) => Object.keys(w).reduce((a, k) => a + p.st[k] * w[k], 0);
  SP.autoLineup = function (ti, slots) { // slots: [{w:{...}}] → 선수 index 배열 (중복 없이, 앞 슬롯부터 가장 잘 맞는 선수)
    const ro = SP.roster(ti), used = new Set(), out = [];
    slots.forEach(s => { let best = -1, bv = -1e9; ro.forEach(p => { if (used.has(p.i)) return; const v = SP.fit(p, s.w); if (v > bv) { bv = v; best = p.i; } }); used.add(best); out.push(best); });
    return out;
  };

  /* ---------------- 3D 기본 ---------------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd0e6);
  const pcam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 600);
  const ocam = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 600);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6a8a, 0.65); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.75); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 160}); sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);
  const amb = new THREE.AmbientLight(0xffffff, 0.12); scene.add(amb);
  SP.renderer = renderer; SP.scene = scene; SP.sun = sun;
  SP.persistent = new Set([hemi, sun, sun.target, amb]);
  const cam = {mode: 'persp', x: 0, y: 0, z: 0, dist: 40, h: 26, yaw: 0, g: {x: 0, y: 0, z: 0, dist: 40, h: 26, yaw: 0}, ortho: 22, shake: 0};
  SP.cam = cam;
  SP.camTo = (o, snap) => { Object.assign(cam.g, o); if (snap) Object.assign(cam, o); };
  SP.toggleCam = () => { cam.mode = cam.mode === 'persp' ? 'ortho' : 'persp'; SP.toast(cam.mode === 'persp' ? '원근 카메라' : '직교(쿼터뷰) 카메라', '', 900); };
  SP.zoomK = asp => { const ph = document.documentElement.classList.contains('dev-phone'); return SP.cam.dist < 12 ? 1 : asp < 0.8 ? 1.2 : ph ? 0.8 : 1; }; // 휴대폰 가로는 조금 가깝게
  SP.getCam = () => cam.mode === 'persp' ? pcam : ocam;
  function updCam(dt) {
    const k = 1 - Math.pow(0.004, dt);
    for (const key of ['x', 'y', 'z', 'dist', 'h']) cam[key] += (cam.g[key] - cam[key]) * k;
    let dy = cam.g.yaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cam.yaw += dy * k;
    let sx = 0, sy = 0; if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2); sx = (Math.random() - .5) * cam.shake; sy = (Math.random() - .5) * cam.shake; }
    const C = SP.getCam(), asp = innerWidth / innerHeight;
    if (cam.mode === 'persp') { pcam.aspect = asp; pcam.fov = asp < 0.8 ? 62 : 48; pcam.updateProjectionMatrix(); const zk = SP.zoomK(asp); C.position.set(cam.x + Math.sin(cam.yaw) * cam.dist * zk + sx, cam.y + cam.h * zk + sy, cam.z + Math.cos(cam.yaw) * cam.dist * zk); }
    else { const h = cam.dist * 0.5 * (asp < 0.8 ? 1.3 : 1), w = h * asp; ocam.left = -w; ocam.right = w; ocam.top = h; ocam.bottom = -h; ocam.updateProjectionMatrix();
      const a = cam.yaw + Math.PI / 4 * 0; C.position.set(cam.x + Math.sin(a + 0.6) * 80 + sx, cam.y + 70 + sy, cam.z + Math.cos(a + 0.6) * 80); }
    C.lookAt(cam.x + sx, cam.y, cam.z);
    sun.position.set(cam.x + 30, 60, cam.z + 20); sun.target.position.set(cam.x, 0, cam.z);
  }

  // 복셀 모델 합치기: [x, y, z, w, h, d, color] (x·z 중심, y 바닥)
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  SP.voxGeo = function (parts) {
    const pos = [], nor = [], col = [], c = new THREE.Color(), bp = boxG.attributes.position, bn = boxG.attributes.normal, idx = boxG.index.array;
    for (const [x, y, z, w, h, d, color] of parts) { c.set(color);
      for (let i = 0; i < idx.length; i++) { const k = idx[i]; pos.push(bp.getX(k) * w + x, bp.getY(k) * h + y + h / 2, bp.getZ(k) * d + z);
        const ny = bn.getY(k), sh = ny > 0.5 ? 1 : ny < -0.5 ? 0.6 : (Math.abs(bn.getX(k)) > 0.5 ? 0.86 : 0.76); nor.push(bn.getX(k), ny, bn.getZ(k)); col.push(c.r * sh, c.g * sh, c.b * sh); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); return g;
  };
  const vMat = new THREE.MeshLambertMaterial({vertexColors: true}); vMat.userData.keep = true;
  SP.vox = (parts, noShadow) => { const m = new THREE.Mesh(SP.voxGeo(parts), vMat); m.castShadow = !noShadow; m.receiveShadow = true; return m; };
  SP.box = (w, h, d, color, opt) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial(Object.assign({color}, opt || {}))); m.castShadow = true; m.receiveShadow = true; return m; };
  SP.plane = (w, d, color, tex) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial(tex ? {map: tex} : {color})); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };
  SP.canvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t; };
  SP.label = function (text, size, color, bg) {
    const t = SP.canvasTex(512, 96, (g) => { g.font = '900 46px -apple-system,"Noto Sans KR",sans-serif'; const tw = Math.min(500, g.measureText(text).width + 36);
      if (bg !== 'none') { g.fillStyle = bg || 'rgba(15,24,44,.82)'; g.beginPath(); (g.roundRect ? g.roundRect((512 - tw) / 2, 8, tw, 80, 26) : g.rect((512 - tw) / 2, 8, tw, 80)); g.fill(); }
      g.fillStyle = color || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: t, transparent: true, depthWrite: false})); s.scale.set(size * 512 / 96, size, 1); s.renderOrder = 5; return s;
  };

  /* ---------------- 선수 모델 ---------------- */
  // style: 'jacket'(과잠) | 'gown'(실험 가운) · 머리 위 ATP 게이지 · 등번호
  const numTex = {};
  function numberTex(n, col, bg) { const k = n + col + bg; if (numTex[k]) return numTex[k]; const t = SP.canvasTex(64, 64, (g) => { g.fillStyle = bg; g.fillRect(0, 0, 64, 64); g.fillStyle = col; g.font = '900 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 35); }); t.userData = {keep: true}; numTex[k] = t; return t; }
  SP.makePlayer = function (team, no, opt) {
    opt = opt || {}; const T = SP.TEAMS[team] || team, c1 = opt.c1 || T.c1, c2 = opt.c2 || T.c2, g = new THREE.Group();
    const skin = ['#ffd8b4', '#f2c29a', '#e8b08a', '#ffe0c4'][no % 4], hair = ['#2a2018', '#3a2a1a', '#1a1a22', '#5a3a22'][no % 4];
    const gown = opt.gown;
    const P = [[0, 0.42, 0, 0.66, 0.66, 0.42, gown ? '#f4f6fb' : c1], [0, 0.9, 0, 0.7, 0.14, 0.46, gown ? '#f4f6fb' : c2], [0, 0.42, 0.215, 0.12, 0.66, 0.02, gown ? '#cfd6e6' : c2],
      [0, 1.04, 0, 0.56, 0.52, 0.5, skin], [0, 1.5, -0.02, 0.6, 0.16, 0.54, hair], [0, 1.3, -0.26, 0.6, 0.34, 0.06, hair],
      [-0.12, 1.16, 0.255, 0.08, 0.1, 0.02, '#1a1a22'], [0.12, 1.16, 0.255, 0.08, 0.1, 0.02, '#1a1a22'], [0, 1.0, 0.255, 0.12, 0.04, 0.02, '#c0607a']];
    if (opt.gk) P.push([0, 0.42, 0, 0.7, 0.62, 0.46, opt.gk]);
    if (opt.cap) P.push([0, 1.52, 0, 0.62, 0.14, 0.58, c1], [0, 1.52, 0.32, 0.5, 0.06, 0.24, c1]);
    const body = SP.vox(P); g.add(body);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({map: numberTex(no, gown ? c1 : c2, gown ? '#f4f6fb' : c1)}));
    back.position.set(0, 0.72, -0.215); back.rotation.y = Math.PI; g.add(back);
    const legM = new THREE.MeshLambertMaterial({color: opt.shorts || '#2a3348'}), armM = new THREE.MeshLambertMaterial({color: gown ? '#f4f6fb' : c1});
    const limb = (x, y, w, h, m) => { const p = new THREE.Group(); p.position.set(x, y, 0); const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m); me.position.y = -h / 2; me.castShadow = true; p.add(me); g.add(p); return p; };
    g.userData.legs = [limb(-0.15, 0.44, 0.2, 0.42, legM), limb(0.15, 0.44, 0.2, 0.42, legM)];
    g.userData.arms = [limb(-0.42, 1.0, 0.16, 0.56, armM), limb(0.42, 1.0, 0.16, 0.56, armM)];
    // ATP 게이지
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({color: 0x101828, transparent: true, opacity: 0.75, depthWrite: false})); barBg.scale.set(0.9, 0.12, 1); barBg.position.y = 2.0; g.add(barBg);
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({color: 0x5ef2c8, depthWrite: false})); bar.scale.set(0.86, 0.08, 1); bar.position.y = 2.0; bar.renderOrder = 6; g.add(bar);
    g.userData.bar = bar; g.userData.barBg = barBg;
    // 선택 표시 고리
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 28), new THREE.MeshBasicMaterial({color: 0xffe066, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false}));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.visible = false; g.add(ring); g.userData.ring = ring;
    g.userData.walk = Math.random() * 6;
    return g;
  };
  SP.setATP = (g, f) => { const b = g.userData.bar; if (!b) return; f = SP.clamp(f, 0, 1); b.scale.x = 0.86 * f + 0.001; b.position.x = -(0.86 - 0.86 * f) / 2; b.material.color.setHex(f > 0.55 ? 0x5ef2c8 : f > 0.3 ? 0xffd25e : 0xff5d6c); };
  // 통통 뛰는 걸음 (찌그러졌다 펴지기) · speed 0이면 서 있기
  SP.animPlayer = function (g, speed, dt, face) {
    const u = g.userData; const mv = speed > 0.3;
    if (mv) u.walk += dt * (6 + speed * 1.8);
    const hop = mv ? Math.abs(Math.sin(u.walk)) : 0; u.idle = (u.idle || Math.random() * 6) + dt * 3.2;
    g.children[0].position.y = mv ? hop * 0.22 : Math.max(0, Math.sin(u.idle)) * 0.03;
    const sq = mv ? 1 - (1 - hop) * 0.1 : 1; g.children[0].scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
    u.legs[0].rotation.x = mv ? Math.sin(u.walk) * 0.8 : 0.12; u.legs[1].rotation.x = mv ? -Math.sin(u.walk) * 0.8 : -0.12;
    if (!u.armPose) { u.arms[0].rotation.x = mv ? -Math.sin(u.walk) * 0.7 : 0; u.arms[1].rotation.x = mv ? Math.sin(u.walk) * 0.7 : 0; u.arms[0].rotation.z = 0; u.arms[1].rotation.z = 0; }
    if (face != null) { let d = face - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 12); }
  };
  SP.pose = (g, kind, t) => { const u = g.userData; u.armPose = kind; clearTimeout(u.pt); if (kind === 'up') { u.arms[0].rotation.x = u.arms[1].rotation.x = -3.0; } else if (kind === 'kick') { u.legs[1].rotation.x = -1.2; } else if (kind === 'swing') { u.arms[0].rotation.x = u.arms[1].rotation.x = -1.4; u.arms[0].rotation.z = 0.8; u.arms[1].rotation.z = 0.8; } else if (kind === 'bump') { u.arms[0].rotation.x = u.arms[1].rotation.x = -0.9; }
    u.pt = setTimeout(() => { u.armPose = null; }, t || 300); };

  /* ---------------- 효과음 ---------------- */
  const A = SP.audio = {
    c: null, out: null, nb: null, muted: false, crowdG: null,
    init() { if (this.c) { if (this.c.state !== 'running') this.c.resume(); return; } const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      try { const c = this.c = new C(); this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : 0.55; const k = c.createDynamicsCompressor(); this.out.connect(k); k.connect(c.destination);
        const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.nb = b;
        // 관중 소리: 계속 흐르는 낮은 웅성거림
        const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.6;
        const g = c.createGain(); g.gain.value = 0.0; s.connect(f); f.connect(g); g.connect(this.out); s.start(); this.crowdG = g; } catch (e) { this.c = null; } },
    ok() { return this.c && this.c.state === 'running' && !this.muted; },
    setMuted(m) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : 0.55; try { localStorage.setItem('bioSportsMute', m ? '1' : '0'); } catch (e) {} },
    t(f, d, type, g, at, f2) { if (!this.ok()) return; const c = this.c, t = c.currentTime + (at || 0), o = c.createOscillator(), a = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.006); a.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(a); a.connect(this.out); o.start(t); o.stop(t + d + 0.05); },
    n(d, f, q, g, at, type) { if (!this.ok()) return; const c = this.c, t = c.currentTime + (at || 0), s = c.createBufferSource(); s.buffer = this.nb; const fl = c.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = f; fl.Q.value = q || 1;
      const a = c.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(fl); fl.connect(a); a.connect(this.out); s.start(t, Math.random(), d + 0.05); },
    crowd(level) { if (this.crowdG && this.c) this.crowdG.gain.setTargetAtTime(this.muted ? 0 : 0.05 + level * 0.25, this.c.currentTime, 0.3); },
    cheer() { this.n(1.6, 900, 0.5, 0.35); this.n(1.2, 1800, 0.8, 0.15, 0.1); for (let i = 0; i < 6; i++) this.t(500 + Math.random() * 600, 0.3, 'triangle', 0.03, Math.random() * 0.6); },
    whistle(n) { for (let i = 0; i < (n || 1); i++) { const at = i * 0.32; this.t(2900, 0.26, 'square', 0.06, at); this.t(3150, 0.26, 'square', 0.04, at); this.n(0.26, 3000, 8, 0.08, at); } },
    kick(p) { this.n(0.06, 500 + (p || 1) * 300, 1.2, 0.35); this.t(140, 0.08, 'sine', 0.2, 0, 70); },
    bounce() { this.t(220, 0.07, 'sine', 0.16, 0, 120); this.n(0.03, 1200, 2, 0.08); },
    swish() { this.n(0.25, 3500, 1, 0.18); },
    rim() { this.t(700, 0.3, 'triangle', 0.12, 0, 500); this.t(1400, 0.2, 'sine', 0.05); },
    buzzer() { this.t(220, 1.0, 'sawtooth', 0.12); this.t(225, 1.0, 'square', 0.06); },
    card() { this.t(1320, 0.12, 'square', 0.08); this.t(990, 0.2, 'square', 0.08, 0.13); },
    bat() { this.n(0.05, 2500, 3, 0.4); this.t(900, 0.06, 'triangle', 0.15); this.t(300, 0.12, 'sine', 0.12, 0, 150); },
    mitt() { this.n(0.06, 700, 1, 0.35); this.t(160, 0.06, 'sine', 0.15); },
    spike() { this.n(0.07, 1100, 1, 0.45); this.t(180, 0.1, 'sine', 0.22, 0, 80); },
    clack(v) { this.t(2400 + Math.random() * 400, 0.04, 'sine', SP.clamp(v || 0.15, 0.02, 0.25)); this.n(0.02, 3500, 4, SP.clamp((v || 0.15) * 0.8, 0.02, 0.2)); },
    pocket() { this.t(180, 0.18, 'triangle', 0.15, 0, 110); this.n(0.12, 600, 1, 0.12, 0.03); },
    click() { this.t(880, 0.04, 'triangle', 0.07); },
    fanfare() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => { this.t(f, 0.22, 'square', 0.06, i * 0.12); this.t(f / 2, 0.22, 'triangle', 0.08, i * 0.12); }); },
    flag() { this.n(0.25, 1800, 0.7, 0.2); this.t(600, 0.15, 'square', 0.05); }
  };
  try { A.muted = localStorage.getItem('bioSportsMute') === '1'; } catch (e) {}
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => A.init(), {capture: true}));

  /* ---------------- 입력 ---------------- */
  // 키: WASD·방향키 이동 · J 패스/토스 · K·Space 슛/타격/스파이크(누르고 있으면 힘) · L 태클/블록 · Q 선수 전환 · Tab 경기 현황 · C 시점
  const keys = {};
  const inp = {mx: 0, my: 0, a: 0, b: 0, c: 0, q: 0, hb: false, hbT: 0, ha: false, num: 0, aimX: 0, aimY: 0};
  SP.input = inp;
  const KMAP = {KeyJ: 'a', KeyK: 'b', Space: 'b', KeyL: 'c', KeyQ: 'q'};
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input')) return;
    if (e.code === 'Tab') { e.preventDefault(); if (SP.onTab) SP.onTab(); return; }
    if (e.code === 'KeyC' && SP.inMatch) { SP.toggleCam(); return; }
    if (e.code === 'Escape' && SP.onEsc) { SP.onEsc(); return; }
    if (e.code.startsWith('Digit')) inp.num = +e.code.slice(5);
    if (!keys[e.code]) { const k = KMAP[e.code]; if (k) inp[k]++; }
    keys[e.code] = true;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const touch = {x: 0, y: 0, b: false, a: false};
  SP.readInput = function () { // 프레임마다 한 번: 이동축·누름 상태 갱신
    let x = 0, y = 0; if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1; if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
    x += touch.x; y += touch.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    inp.mx = x; inp.my = y; inp.hb = !!(keys.KeyK || keys.Space || touch.b); inp.ha = !!(keys.KeyJ || touch.a);
    return inp;
  };
  SP.consume = () => { const o = {mx: inp.mx, my: inp.my, a: inp.a, b: inp.b, c: inp.c, q: inp.q, hb: inp.hb, ha: inp.ha, num: inp.num, ext: inp.ext || null}; inp.a = inp.b = inp.c = inp.q = 0; inp.num = 0; inp.ext = null; return o; };
  SP.emptyInput = () => ({mx: 0, my: 0, a: 0, b: 0, c: 0, q: 0, hb: false, ha: false, num: 0});
  // 터치: 왼쪽 아무 곳이나 눌러 생기는 조이스틱 · 오른쪽 원형 버튼 · 구종 등 고르기 버튼
  (function () {
    const Z = $('joyzone'), J = $('joy'), K = J.querySelector('i'); let id = null, cx = 0, cy = 0;
    const mv = e => { if (e.pointerId !== id) return; const R = J.offsetWidth / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } touch.x = dx; touch.y = dy; K.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; };
    Z.addEventListener('pointerdown', e => { e.preventDefault(); A.init(); id = e.pointerId; Z.setPointerCapture(id); cx = e.clientX; cy = e.clientY; J.style.left = cx + 'px'; J.style.top = cy + 'px'; J.classList.remove('idle'); mv(e); });
    Z.addEventListener('pointermove', mv);
    const end = e => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; K.style.transform = ''; J.classList.add('idle'); J.style.left = ''; J.style.top = ''; }; Z.addEventListener('pointerup', end); Z.addEventListener('pointercancel', end);
    document.querySelectorAll('#acts button').forEach(b => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', e => { e.preventDefault(); A.init(); b.classList.add('on'); inp[k]++; if (k === 'b') touch.b = true; if (k === 'a') touch.a = true; if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} });
      const up = () => { b.classList.remove('on'); if (k === 'b') touch.b = false; if (k === 'a') touch.a = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    $('picks').addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); inp.num = +b.dataset.n; A.click(); });
  })();
  // 상황별 버튼 이름: {b, a, c, q} (null = 숨김) · picks: [{n, label, on}]
  const KEYN = {b: 'K', a: 'J', c: 'L', q: 'Q'}; let actKey = '';
  SP.setActs = (L, picks) => {
    L = L || {}; const key = JSON.stringify([L, picks || null]); if (key === actKey) return; actKey = key;
    document.querySelectorAll('#acts button').forEach(b => { const v = L[b.dataset.k]; b.hidden = !v; if (v) b.innerHTML = `${v}<small>${SP.isTouch ? '' : KEYN[b.dataset.k]}</small>`; });
    $('picks').innerHTML = (picks || []).map(p => `<button type="button" data-n="${p.n}" class="${p.on ? 'on' : ''}"><small>${p.n}</small>${SP.esc(p.label)}</button>`).join('');
    const ks = $('keys'); ks.innerHTML = (L.move === false ? '' : '<span><kbd>WASD</kbd>이동</span>') + ['b', 'a', 'c', 'q'].filter(k => L[k]).map(k => `<span class="k-${k}"><kbd>${KEYN[k]}</kbd>${L[k].replace(/<br>/g, ' ')}</span>`).join('') + (picks || []).map(p => `<span class="${p.on ? 'on' : ''}"><kbd>${p.n}</kbd>${SP.esc(p.label)}</span>`).join('');
  };
  SP.setTouchLabels = L => SP.setActs({b: L.b, a: L.a, c: L.c, q: L.q});
  SP.isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
  SP.setTouchLabels = (labels) => { const bs = document.querySelectorAll('#tbtn button'); ['c', 'a', 't', 'b'].forEach((k, i) => { if (labels[k]) bs[i].innerHTML = labels[k]; }); };
  // 마우스 (포켓볼 조준 등)
  SP.mouse = {x: 0, y: 0, down: false, dx: 0, dy: 0, clicked: 0};
  canvas.addEventListener('pointerdown', e => { SP.mouse.down = true; SP.mouse.sx = e.clientX; SP.mouse.sy = e.clientY; SP.mouse.x = e.clientX; SP.mouse.y = e.clientY; canvas.setPointerCapture(e.pointerId); if (SP.onPointer) SP.onPointer('down', e); });
  canvas.addEventListener('pointermove', e => { SP.mouse.dx += e.clientX - SP.mouse.x; SP.mouse.dy += e.clientY - SP.mouse.y; SP.mouse.x = e.clientX; SP.mouse.y = e.clientY; if (SP.onPointer) SP.onPointer('move', e); });
  canvas.addEventListener('pointerup', e => { SP.mouse.down = false; if (SP.onPointer) SP.onPointer('up', e); });
  canvas.addEventListener('wheel', e => { if (SP.onWheel) { e.preventDefault(); SP.onWheel(e.deltaY); } }, {passive: false});
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  SP.groundAt = (sx, sy, y) => { ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, SP.getCam()); const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y || 0)), p) ? p : null; };

  /* ---------------- 화면 UI ---------------- */
  SP.toast = (t, s, ms, big) => { const e = $('toast'); e.classList.toggle('big', !!big); e.querySelector('b').textContent = t; e.querySelector('span').textContent = s || ''; e.classList.add('show'); clearTimeout(SP.toast.t); SP.toast.t = setTimeout(() => e.classList.remove('show'), ms || 1700); };
  SP.info = h => { $('info').innerHTML = h || ''; };
  SP.modal = (html, opt) => { const m = $('modal'); m.innerHTML = html; $('scrim').hidden = false; $('scrim').onclick = e => { if (e.target === $('scrim') && !(opt && opt.lock)) SP.closeModal(); }; SP.modalOpen = true; return m; };
  SP.closeModal = () => { $('scrim').hidden = true; $('modal').innerHTML = ''; SP.modalOpen = false; if (SP.onModalClose) { const f = SP.onModalClose; SP.onModalClose = null; f(); } };
  const gv = new THREE.Vector3();
  SP.gauge = (v, mark, world) => { const g = $('gauge'); if (v == null) { g.hidden = true; return; } g.hidden = false; g.querySelector('i').style.width = (SP.clamp(v, 0, 1) * 100) + '%';
    let b = g.querySelector('b'); if (mark != null) { if (!b) { b = document.createElement('b'); g.appendChild(b); } b.style.left = (mark * 100) + '%'; } else if (b) b.remove();
    if (world) { gv.set(world.x, world.y, world.z).project(SP.getCam()); g.classList.add('at'); g.style.left = ((gv.x + 1) / 2 * innerWidth) + 'px'; g.style.top = ((1 - gv.y) / 2 * innerHeight - 8) + 'px'; }
    else { g.classList.remove('at'); g.style.left = ''; g.style.top = ''; } };
  SP.help = h => { const e = $('help'); e.hidden = !h; e.innerHTML = h || ''; };
  SP.scoreHtml = s => `<div class="sb"><span class="t"><i style="background:${s.a.c1}"></i>${SP.esc(s.a.name)}</span><span class="sc">${s.a.pts}<small style="opacity:.6">-</small>${s.b.pts}</span><span class="t">${SP.esc(s.b.name)}<i style="background:${s.b.c1}"></i></span>${s.clock ? `<span class="ck">${SP.esc(s.clock)}</span>` : ''}</div>`;
  let scoreKey = '';
  SP.score = (s, extra) => { // {a:{name,c1,pts}, b:{...}, clock, sub} + 덧붙일 판(야구 볼카운트 등)
    const k = JSON.stringify(s) + (extra || ''); if (k === scoreKey) return; scoreKey = k;
    $('score').innerHTML = SP.scoreHtml(s) + `<div class="sbs">${SP.esc(s.sub || '')}</div><div class="sbx">${extra || ''}</div>`;
  };
  // 미니맵: fn(ctx, w, h)
  const mini = $('mini'), mctx = mini.getContext('2d');
  SP.minimap = fn => { if (!fn) { mini.hidden = true; return; } mini.hidden = false; mctx.clearRect(0, 0, mini.width, mini.height); fn(mctx, mini.width, mini.height); };

  /* ---------------- 파티클 ---------------- */
  const parts = []; const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16); pGeo.userData = {keep: true};
  SP.burst = (x, y, z, cols, n, pw) => { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({color: cols[i % cols.length], transparent: true})); m.position.set(x, y, z); const a = Math.random() * Math.PI * 2, s = (1 + Math.random() * 4) * (pw || 1); parts.push({m, vx: Math.cos(a) * s, vy: (3 + Math.random() * 6) * (pw || 1), vz: Math.sin(a) * s, life: 0.8 + Math.random() * 0.7}); scene.add(m); } };

  /* ---------------- 장면 정리 (메모리) ---------------- */
  SP.clearScene = function () {
    const rm = scene.children.filter(o => !SP.persistent.has(o));
    for (const o of rm) { scene.remove(o); o.traverse(n => {
      if (n.geometry && n.geometry !== boxG && n.geometry !== pGeo && !(n.geometry.userData && n.geometry.userData.keep)) n.geometry.dispose();
      const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
      for (const m of ms) { if (m === vMat || (m.userData && m.userData.keep)) continue; if (m.map && !(m.map.userData && m.map.userData.keep)) m.map.dispose(); m.dispose(); } }); }
    parts.length = 0;
  };

  /* ---------------- 루프 ---------------- */
  SP.tick = null; // (dt) 경기 쪽에서 설정
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    SP.readInput();
    if (SP.tick) { try { SP.tick(dt); } catch (e) { console.error(e); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.vy -= 16 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; if (p.m.position.y < 0.1) { p.m.position.y = 0.1; p.vy *= -0.4; } p.m.material.opacity = Math.min(1, p.life * 2); if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    updCam(dt);
    renderer.render(scene, SP.getCam());
  }
  requestAnimationFrame(loop);
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));

  /* ---------------- 공용 경기장 바닥 ---------------- */
  SP.stadium = function (w, d, opt) { // 관중석 둘레
    opt = opt || {}; const g = new THREE.Group();
    const ground = SP.plane(w + 40, d + 40, opt.out || 0x6aaa6a); ground.position.y = -0.02; g.add(ground);
    const cols = ['#ff7eb6', '#7cc4ff', '#ffd25e', '#8fe388', '#c7a0ff', '#ffffff'];
    for (let side = 0; side < 4; side++) {
      const len = side % 2 ? d + 10 : w + 10, P = [];
      for (let row = 0; row < 3; row++) { P.push([0, row * 0.8, row * 1.2, len, 0.8, 1.2, ['#5a6a8a', '#6a7a9a', '#4a5a7a'][row]]);
        for (let k = -len / 2 + 0.8; k < len / 2; k += 1.6) if (Math.random() < 0.7) P.push([k, row * 0.8 + 0.8, row * 1.2, 0.5, 0.6, 0.4, cols[(k * 7 + row) & 7 % 6] || cols[SP.ri(6)]]); }
      const s = SP.vox(P, true); const off = (side % 2 ? w : d) / 2 + 5;
      if (side === 0) s.position.set(0, 0, -off), s.rotation.y = Math.PI; if (side === 1) s.position.set(off, 0, 0), s.rotation.y = -Math.PI / 2;
      if (side === 2) s.position.set(0, 0, off); if (side === 3) s.position.set(-off, 0, 0), s.rotation.y = Math.PI / 2;
      g.add(s);
    }
    return g;
  };
})();

/* ---------------- 팀 종목 공용 도우미 ---------------- */
(function () {
  // 선수 엔티티 만들기: 화면 모델 + 상태
  SP.makeEnts = function (cfg, side, slots, opt) {
    const ti = cfg.teams[side], ro = SP.roster(ti), T = SP.TEAMS[ti];
    return cfg.lineups[side].map((pi, k) => {
      const p = ro[pi], e = {side, slot: k, pos: slots[k].label, pi, no: p.no, name: p.name, st: p.st, atp: 1, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, face: side ? -Math.PI / 2 : Math.PI / 2, cards: 0, out: false, spdNow: 0};
      e.mesh = SP.makePlayer(ti, p.no, Object.assign({}, SP.kit(cfg, side), opt && opt(k, e) || {}));
      SP.scene.add(e.mesh); return e;
    });
  };
  SP.teamMods = cfg => cfg.teams.map(ti => SP.TEAMS[ti]);
  // 교체 정보 (현황 메뉴용)
  SP.lineupStateOf = function (cfg, ents, side, used) {
    const ro = SP.roster(cfg.teams[side]);
    const on = ents.filter(e => e.side === side).map(e => ({slot: e.slot, pos: e.pos, no: e.no, name: e.name, atp: e.atp, note: e.out ? '퇴장' : e.cards ? '경고 ' + e.cards : ''}));
    const onIdx = new Set(ents.filter(e => e.side === side).map(e => e.pi));
    const bench = ro.filter(p => !onIdx.has(p.i) && !(used && used.has(p.i))).map(p => ({idx: p.i, no: p.no, name: p.name, role: p.role, ovr: p.ovr, atp: 1}));
    return {on, bench};
  };
  SP.doSwap = function (cfg, e, pi, opt) { // 엔티티에 새 선수를 넣기 (모델 다시 만들기)
    const ro = SP.roster(cfg.teams[e.side]), p = ro[pi];
    e.pi = pi; e.no = p.no; e.name = p.name; e.st = p.st; e.atp = 1; e.cards = 0;
    const old = e.mesh, m = SP.makePlayer(cfg.teams[e.side], p.no, Object.assign({}, SP.kit(cfg, e.side), opt || {})); m.position.copy(old.position); m.rotation.y = old.rotation.y; SP.scene.remove(old); SP.scene.add(m); e.mesh = m;
  };
  SP.snapEnts = ents => ents.map(e => [Math.round(e.x * 100) / 100, Math.round(e.z * 100) / 100, Math.round(e.face * 100) / 100, Math.round(e.atp * 100) / 100, Math.round(e.spdNow * 10) / 10, e.out ? 1 : 0, Math.round((e.y || 0) * 100) / 100, e.pi]);
  SP.applyEnts = function (cfg, ents, arr, opt) { arr.forEach((a, i) => { const e = ents[i]; if (!e) return; if (a[7] != null && a[7] !== e.pi) SP.doSwap(cfg, e, a[7], opt && opt(e)); e.x = a[0]; e.z = a[1]; e.face = a[2]; e.atp = a[3]; e.spdNow = a[4]; e.out = !!a[5]; e.y = a[6] || 0; }); };
  SP.viewEnts = function (ents, dt, ctrl) { let tagged = null;
    for (const e of ents) { const m = e.mesh; m.visible = !e.out; if (e.out) continue;
      m.position.x += (e.x - m.position.x) * Math.min(1, dt * 18); m.position.z += (e.z - m.position.z) * Math.min(1, dt * 18); m.position.y = e.y || 0;
      SP.animPlayer(m, e.spdNow, dt, e.face); SP.setATP(m, e.atp); const on = ctrl ? ctrl(e) : false; m.userData.ring.visible = on; if (on) tagged = e; }
    SP.tagEnt(tagged); 
  };
  // 조작 중인 선수 이름표 (머리 위)
  let tagS = null, tagName = '';
  SP.tagEnt = e => { if (!tagS || !tagS.parent) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const t = new THREE.CanvasTexture(c); t.userData = {keep: true}; tagS = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true})); tagS.material.userData = {keep: true}; tagS.renderOrder = 20; tagS.scale.set(3.4, 0.85, 1); SP.scene.add(tagS); tagS.userData.cv = c; tagName = ''; }
    if (!e || e.out) { tagS.visible = false; return; } tagS.visible = true; const nm = `▼ ${e.no} ${e.name}`;
    if (nm !== tagName) { tagName = nm; const c = tagS.userData.cv, g = c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.font = '900 30px "Noto Sans KR",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(nm, 128, 34); g.fillStyle = '#ffe066'; g.fillText(nm, 128, 34); tagS.material.map.needsUpdate = true; }
    tagS.position.set(e.mesh.position.x, (e.mesh.position.y || 0) + 2.55, e.mesh.position.z); };
  // 목표 지점으로 걸어가기/뛰어가기 (멈춤 없이 자연스럽게): 도착하면 true
  SP.walkTo = (e, tx, tz, dt, sp, lookX, lookZ) => { const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d > 0.12) { const m = Math.min(sp, d * 4); e.vx = dx / d * m; e.vz = dz / d * m; e.x += e.vx * dt; e.z += e.vz * dt; e.spdNow = m; e.face = Math.atan2(dx, dz); return false; }
    e.vx = e.vz = 0; e.spdNow = 0; if (lookX != null) e.face = Math.atan2(lookX - e.x, lookZ - e.z); return true; };
  // 달리기 속도 (시냅스 전도 속도 + ATP)
  SP.runSpeed = (e, base) => (base || 5.2) * (0.78 + e.st.spd / 300) * (0.62 + 0.38 * Math.max(0.15, e.atp));
  SP.drainATP = (e, moving, dt, team, extra) => { const k = (team.drain || 1) * (1.15 - e.st.atp / 200); if (moving) e.atp = Math.max(0.05, e.atp - dt * 0.0105 * k * (extra || 1)); else e.atp = Math.min(1, e.atp + dt * 0.006 * (team.recover || 1)); };
})();
// 경기 이벤트(소리·자막) 큐: 호스트는 바로 실행, 게스트는 스냅샷으로 받은 것 중 처음 보는 것만 실행
SP.makeEvents = function (fire) {
  const q = []; let seq = 0; const seen = new Set();
  return {emit(type, data) { const o = Object.assign({type, id: ++seq}, data || {}); q.push(o); if (q.length > 40) q.shift(); fire(o); return o; },
    recent() { return q.slice(-14); },
    ingest(arr) { for (const o of arr || []) if (!seen.has(o.id)) { seen.add(o.id); fire(o); } }};
};
// 유니폼 색이 비슷하면 원정팀은 흰색 원정 유니폼
SP.kit = function (cfg, side) {
  const A = SP.TEAMS[cfg.teams[0]], B = SP.TEAMS[cfg.teams[side]];
  if (side === 0) return {c1: A.c1, c2: A.c2};
  const ca = new THREE.Color(A.c1), cb = new THREE.Color(B.c1);
  const d = Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b);
  return d < 0.45 ? {c1: '#f4f4f8', c2: B.c1} : {c1: B.c1, c2: B.c2};
};

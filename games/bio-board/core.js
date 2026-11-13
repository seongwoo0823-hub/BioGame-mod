/* 생명과학 보드게임 천국 — 공용 엔진
 *  3D(직교 카메라 아이소메트릭 · 그림자 · 복셀 모델), 카메라 회전/확대, 보간 애니메이션, 통통 점프, 파티클,
 *  말 캐릭터 4종, Web Audio 효과음, 화면 UI 도우미(모달·토스트·툴팁 백과)
 */
'use strict';
const BB = window.BB = {};
(function () {
  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  BB.$ = $;
  BB.esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  BB.rand = (a, b) => a + Math.random() * (b - a);
  BB.ri = n => Math.floor(Math.random() * n);
  BB.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  BB.clone = o => JSON.parse(JSON.stringify(o));
  BB.timeScale = 1;   // 시험용: 0.05면 20배 빠르게
  BB.wait = ms => new Promise(r => setTimeout(r, ms * BB.timeScale));

  /* ---------------- 3D 기본 ---------------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8e8);
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6a8a, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 0.72);
  sun.position.set(14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
  sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const amb = new THREE.AmbientLight(0xffffff, 0.12); scene.add(amb);
  BB.renderer = renderer; BB.scene = scene; BB.cam = cam; BB.sun = sun; BB.hemi = hemi;

  // 카메라: 목표점 주위를 도는 직교 카메라 (드래그 회전 · 휠/핀치 확대)
  const view = {tx: 0, ty: 0, tz: 0, az: Math.PI / 4, el: 0.62, zoom: 14, // 현재
    g: {tx: 0, ty: 0, tz: 0, az: Math.PI / 4, el: 0.62, zoom: 14}, minZ: 5, maxZ: 40};
  BB.view = view;
  BB.focus = (x, z, zoom, opt) => { view.g.tx = x; view.g.tz = z; view.g.ty = (opt && opt.y) || 0; if (zoom) view.g.zoom = zoom; if (opt && opt.az != null) view.g.az = opt.az; if (opt && opt.el != null) view.g.el = opt.el; };
  BB.setView = (o) => { Object.assign(view.g, o); Object.assign(view, o); };
  function updCam(dt) {
    const k = 1 - Math.pow(0.0025, dt);
    for (const key of ['tx', 'ty', 'tz', 'zoom', 'el']) view[key] += (view.g[key] - view[key]) * k;
    let da = view.g.az - view.az; da = ((da + Math.PI) % TAU + TAU) % TAU - Math.PI; view.az += da * k;
    const asp = innerWidth / innerHeight, h = view.zoom, w = h * asp;
    const fit = asp < 0.8 ? 1.35 : 1; // 세로 화면이면 조금 더 넓게
    cam.left = -w * fit; cam.right = w * fit; cam.top = h * fit; cam.bottom = -h * fit; cam.updateProjectionMatrix();
    const d = 60, ce = Math.cos(view.el);
    cam.position.set(view.tx + Math.sin(view.az) * ce * d, view.ty + Math.sin(view.el) * d, view.tz + Math.cos(view.az) * ce * d);
    cam.lookAt(view.tx, view.ty, view.tz);
    sun.position.set(view.tx + 14, 26, view.tz + 10); sun.target.position.set(view.tx, 0, view.tz);
  }

  // 입력: 드래그 회전, 휠/핀치 확대, 클릭/탭 = 3D 물체 고르기
  const pointers = new Map(); let dragMoved = 0, pinch0 = 0, zoom0 = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  BB.pickables = [];      // userData.onPick / userData.info 가 있는 메쉬
  BB.onPick = null;
  function pickAt(x, y) {
    ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const objs = BB.pickables.filter(o => o.visible !== false && o.parent);
    const hits = ray.intersectObjects(objs, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o) return o; }
    return null;
  }
  BB.pickAt = pickAt;
  canvas.addEventListener('pointerdown', e => {
    canvas.focus(); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY});
    dragMoved = 0; canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.g.zoom; }
    BB.audio.unlock();
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) { hover(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) view.g.zoom = Math.max(view.minZ, Math.min(view.maxZ, zoom0 * pinch0 / d)); return; }
    if (dragMoved > 6) { view.g.az -= dx * 0.008; view.g.el = Math.max(0.35, Math.min(1.45, view.g.el + dy * 0.006)); hideTip(); }
  });
  const up = e => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (p && dragMoved <= 8 && pointers.size === 0) {
      const o = pickAt(e.clientX, e.clientY);
      if (o && o.userData.onPick) o.userData.onPick(o);
      else if (BB.onPick) BB.onPick(o);
      if (e.pointerType === 'touch' && o && o.userData.info) showTip(o.userData.info, e.clientX, e.clientY, 2600);
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => pointers.delete(e.pointerId));
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.g.zoom = Math.max(view.minZ, Math.min(view.maxZ, view.g.zoom * (e.deltaY > 0 ? 1.1 : 0.91))); }, {passive: false});
  let hoverObj = null;
  function hover(x, y) {
    const o = pickAt(x, y);
    canvas.style.cursor = o && o.userData.onPick ? 'pointer' : 'default';
    if (o !== hoverObj) { if (hoverObj && hoverObj.userData.hover) hoverObj.userData.hover(false); hoverObj = o; if (o && o.userData.hover) o.userData.hover(true); }
    if (o && o.userData.info) showTip(o.userData.info, x, y); else hideTip();
  }

  /* ---------------- 툴팁 백과 · 토스트 · 모달 ---------------- */
  const tip = $('tip'); let tipT = 0;
  function showTip(info, x, y, ms) {
    if (!info) return;
    const [t, body, tag] = typeof info === 'string' ? [info, '', ''] : info;
    tip.innerHTML = (tag ? `<i>${BB.esc(tag)}</i>` : '') + `<b>${BB.esc(t)}</b>${BB.esc(body)}`;
    const w = tip.offsetWidth || 260, h = tip.offsetHeight || 80;
    tip.style.left = Math.min(innerWidth - w - 8, x + 16) + 'px'; tip.style.top = Math.min(innerHeight - h - 8, Math.max(8, y + 14)) + 'px';
    tip.classList.add('show'); clearTimeout(tipT); if (ms) tipT = setTimeout(hideTip, ms);
  }
  function hideTip() { tip.classList.remove('show'); }
  BB.showTip = showTip; BB.hideTip = hideTip;
  document.addEventListener('pointerover', e => { const el = e.target.closest && e.target.closest('[data-info]'); if (el) { const r = el.getBoundingClientRect(); try { showTip(JSON.parse(el.dataset.info), r.left, r.bottom); } catch (x) {} } });
  document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('[data-info]'); if (el) hideTip(); });
  let toastT = 0;
  BB.toast = (title, sub, ms) => { const t = $('toast'); t.querySelector('b').textContent = title; t.querySelector('span').textContent = sub || ''; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 1900); };
  BB.modal = (html, opt) => { hideTip(); const s = $('scrim'), m = $('modal'); m.innerHTML = html; s.hidden = false; s.onclick = e => { if (e.target === s && !(opt && opt.lock)) BB.closeModal(); }; return m; };
  BB.closeModal = () => { $('scrim').hidden = true; $('modal').innerHTML = ''; };
  BB.msg = t => { $('msg').innerHTML = t || ''; };
  BB.acts = (list) => { // [{t, cls, fn, dis, info}]
    const el = $('acts'); el.innerHTML = '';
    for (const a of list || []) {
      if (!a) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = a.badge ? 'badge' + (a.on ? ' on' : '') : 'btn ' + (a.cls || ''); b.innerHTML = a.t;
      if (a.dis) b.disabled = true; if (a.info) b.dataset.info = JSON.stringify(a.info);
      b.onclick = () => { BB.audio.click(); a.fn && a.fn(); }; el.appendChild(b);
    }
  };

  /* ---------------- 복셀 모델 ---------------- */
  // parts: [x, y, z, w, h, d, color] (중심 x,z · 바닥 y) → 하나로 합친 메쉬 (꼭짓점 색)
  const boxCache = new THREE.BoxGeometry(1, 1, 1);
  BB.voxGeo = function (parts) {
    const pos = [], nor = [], col = [], c = new THREE.Color();
    const bp = boxCache.attributes.position, bn = boxCache.attributes.normal, idx = boxCache.index.array;
    for (const p of parts) {
      const [x, y, z, w, h, d, color] = p; c.set(color);
      for (let i = 0; i < idx.length; i++) {
        const k = idx[i];
        pos.push(bp.getX(k) * w + x, bp.getY(k) * h + y + h / 2, bp.getZ(k) * d + z);
        const ny = bn.getY(k); const sh = ny > 0.5 ? 1.0 : ny < -0.5 ? 0.62 : (Math.abs(bn.getX(k)) > 0.5 ? 0.86 : 0.78);
        nor.push(bn.getX(k), ny, bn.getZ(k)); col.push(c.r * sh, c.g * sh, c.b * sh);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  const voxMat = new THREE.MeshLambertMaterial({vertexColors: true});
  const voxMatT = new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: 0.72});
  BB.voxMat = voxMat;
  BB.vox = function (parts, opt) {
    const m = new THREE.Mesh(BB.voxGeo(parts), opt && opt.transparent ? voxMatT : voxMat);
    m.castShadow = !(opt && opt.noShadow); m.receiveShadow = true;
    return m;
  };
  BB.box = function (w, h, d, color, opt) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial(Object.assign({color}, opt || {})));
    m.castShadow = true; m.receiveShadow = true; return m;
  };
  // 글자 텍스처 (타일·칸 이름)
  const texCache = new Map();
  BB.textTex = function (key, draw, w, h) {
    if (texCache.has(key)) return texCache.get(key);
    const cv = document.createElement('canvas'); cv.width = w || 128; cv.height = h || 128;
    const g = cv.getContext('2d'); draw(g, cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    texCache.set(key, t); return t;
  };
  BB.font = (px, w) => `${w || 900} ${px}px -apple-system, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
  BB.label = function (text, opt) { // 공중에 뜨는 글씨 (스프라이트)
    opt = opt || {};
    const key = 'lbl|' + text + '|' + (opt.color || '') + '|' + (opt.bg || '');
    const tex = BB.textTex(key, (g, W, H) => {
      g.font = BB.font(opt.px || 44); const tw = Math.min(W - 10, g.measureText(text).width + 34);
      if (opt.bg !== 'none') { g.fillStyle = opt.bg || 'rgba(15,26,46,.78)'; const x = (W - tw) / 2; rr(g, x, 8, tw, H - 16, 26); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.stroke(); }
      g.fillStyle = opt.color || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 2);
    }, 512, 96);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthTest: opt.depth !== false ? true : false}));
    const sz = opt.size || 1.6; s.scale.set(sz * 512 / 96, sz, 1); s.renderOrder = 10;
    return s;
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  BB.rr = rr;

  /* ---------------- 보간 애니메이션 ---------------- */
  const tweens = [];
  const ease = {lin: t => t, out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }};
  BB.ease = ease;
  BB.tween = function (dur, fn, e) { return new Promise(res => tweens.push({t: 0, dur: Math.max(0.001, dur * BB.timeScale), fn, e: ease[e || 'inout'], res})); };
  BB.moveTo = function (obj, x, y, z, dur, e) { const a = obj.position.clone(); return BB.tween(dur, k => obj.position.set(a.x + (x - a.x) * k, a.y + (y - a.y) * k, a.z + (z - a.z) * k), e); };
  // 통통 튀는 아크 점프 (찌그러졌다 펴지기)
  BB.hop = async function (obj, x, y, z, opt) {
    opt = opt || {}; const a = obj.position.clone(), H = opt.h != null ? opt.h : 1.1, d = opt.dur || 0.32;
    const s0 = obj.userData.baseScale || 1;
    if (opt.face !== false) { const ang = Math.atan2(x - a.x, z - a.z); if (Math.hypot(x - a.x, z - a.z) > 0.01) obj.rotation.y = ang; }
    await BB.tween(0.07, k => obj.scale.set(s0 * (1 + 0.18 * k), s0 * (1 - 0.28 * k), s0 * (1 + 0.18 * k)), 'out');
    BB.audio.hop();
    await BB.tween(d, k => {
      obj.position.set(a.x + (x - a.x) * k, a.y + (y - a.y) * k + Math.sin(k * Math.PI) * H, a.z + (z - a.z) * k);
      const st = Math.sin(k * Math.PI); obj.scale.set(s0 * (1 - 0.12 * st), s0 * (1 + 0.22 * st), s0 * (1 - 0.12 * st));
    }, 'lin');
    await BB.tween(0.09, k => { const q = Math.sin(k * Math.PI); obj.scale.set(s0 * (1 + 0.22 * q), s0 * (1 - 0.3 * q), s0 * (1 + 0.22 * q)); }, 'lin');
    obj.scale.setScalar(s0);
  };

  /* ---------------- 파티클 (복셀 조각) ---------------- */
  const parts = []; const pGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  BB.burst = function (x, y, z, colors, n, power) {
    n = n || 40; power = power || 1;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({color: colors[i % colors.length], transparent: true}));
      m.position.set(x, y, z); const a = Math.random() * TAU, s = (2 + Math.random() * 4) * power;
      parts.push({m, vx: Math.cos(a) * s, vy: (4 + Math.random() * 6) * power, vz: Math.sin(a) * s, life: 0.9 + Math.random() * 0.6, rs: (Math.random() - .5) * 12});
      scene.add(m);
    }
  };
  BB.ring = function (x, y, z, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.55, 32), new THREE.MeshBasicMaterial({color, transparent: true, side: THREE.DoubleSide}));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.05, z); scene.add(m);
    BB.tween(0.7, k => { m.scale.setScalar(1 + k * 5); m.material.opacity = 1 - k; }, 'out').then(() => { scene.remove(m); m.geometry.dispose(); });
  };

  /* ---------------- 말 캐릭터 4종 ---------------- */
  BB.CHARS = [
    {id: 'amoeba', name: '아메바 박사', en: 'Dr. Amoeba', color: '#3fe0b0', info: ['아메바 박사', '원생생물 아메바는 세포질을 흘려 보내 만든 헛발(위족)로 움직이고, 먹이를 감싸 삼켜요(식세포 작용).', '캐릭터']},
    {id: 'mito', name: '미토콘드리아 기사', en: 'Mito-Knight', color: '#ff6b5e', info: ['미토콘드리아 기사', '미토콘드리아는 세포 호흡으로 ATP를 만드는 발전소. 안쪽 막이 주름(크리스타)져 있어 표면적이 넓어요.', '캐릭터']},
    {id: 'phage', name: '박테리오파지 로봇', en: 'Phage-Bot', color: '#9aa8ff', info: ['박테리오파지 로봇', '세균만 감염시키는 바이러스. 정이십면체 머리 속 DNA를 꼬리로 세균에 주입해요.', '캐릭터']},
    {id: 'leuko', name: '백혈구 수호자', en: 'Leuko-Guard', color: '#f2f5ff', info: ['백혈구 수호자', '백혈구는 면역을 담당해요. B 림프구가 만든 Y자 항체는 특정 항원에만 결합해요.', '캐릭터']}
  ];
  BB.makeChar = function (idx, scale) {
    const P = [];
    const add = (x, y, z, w, h, d, c) => P.push([x, y, z, w, h, d, c]);
    const eyes = (y, z, gap, s) => { add(-gap, y, z, s, s, 0.06, '#ffffff'); add(gap, y, z, s, s, 0.06, '#ffffff'); add(-gap, y + s * 0.15, z + 0.02, s * 0.5, s * 0.5, 0.06, '#10131f'); add(gap, y + s * 0.15, z + 0.02, s * 0.5, s * 0.5, 0.06, '#10131f'); };
    let transparent = false;
    if (idx === 0) { // 아메바 박사
      add(0, 0, 0, 1.0, 0.7, 0.9, '#2fd6a6'); add(0, 0.7, 0, 0.8, 0.35, 0.75, '#55ebc0'); add(0, 0.05, 0, 0.42, 0.42, 0.42, '#1a8f6f');
      add(-0.62, 0.05, 0.15, 0.36, 0.26, 0.3, '#3fe0b0'); add(0.6, 0.02, -0.2, 0.32, 0.24, 0.4, '#3fe0b0'); add(0.1, 0.0, 0.58, 0.3, 0.22, 0.32, '#3fe0b0');
      eyes(0.62, 0.46, 0.2, 0.2); add(0, 1.05, -0.05, 0.5, 0.08, 0.5, '#fafafa'); add(0, 1.13, -0.05, 0.3, 0.18, 0.3, '#fafafa'); // 연구 모자
      add(0.25, 0.45, 0.46, 0.18, 0.18, 0.04, '#9af7dc'); add(-0.25, 0.45, 0.46, 0.18, 0.18, 0.04, '#9af7dc'); // 안경
      transparent = true;
    } else if (idx === 1) { // 미토콘드리아 기사
      add(0, 0, 0, 0.9, 0.95, 0.7, '#d9473c'); add(0, 0.95, 0, 0.78, 0.55, 0.66, '#ff8a6e');
      for (let i = 0; i < 4; i++) add(-0.3 + i * 0.2, 0.15, 0.37, 0.08, 0.7, 0.06, '#ffd6c8'); // 크리스타 갑옷 줄
      add(0, 0.42, 0.4, 0.3, 0.3, 0.06, '#ffe066'); add(0, 0.47, 0.44, 0.16, 0.16, 0.04, '#fff7c0'); // 에너지 코어
      eyes(1.18, 0.34, 0.17, 0.16); add(0, 1.5, 0, 0.82, 0.12, 0.7, '#b8b8c8'); add(0, 1.62, -0.1, 0.12, 0.3, 0.5, '#ff4d4d'); // 투구 장식
      add(-0.58, 0.35, 0, 0.22, 0.5, 0.25, '#b8b8c8'); add(0.58, 0.35, 0, 0.22, 0.5, 0.25, '#b8b8c8'); add(0.72, 0.4, 0.2, 0.08, 1.0, 0.08, '#e8e8f4');
    } else if (idx === 2) { // 박테리오파지 로봇
      add(0, 1.05, 0, 0.8, 0.8, 0.8, '#b9c3ff'); add(0, 1.15, 0, 0.92, 0.6, 0.6, '#9aa8ff'); add(0, 1.15, 0, 0.6, 0.6, 0.92, '#9aa8ff'); add(0, 1.85, 0, 0.4, 0.15, 0.4, '#d6dcff');
      add(0, 0.38, 0, 0.26, 0.68, 0.26, '#7c88d8'); for (let i = 0; i < 4; i++) add(0, 0.42 + i * 0.16, 0, 0.36, 0.05, 0.36, '#5a64b0');
      add(0, 0.3, 0, 0.62, 0.1, 0.62, '#5a64b0');
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6, c = Math.cos(a), s = Math.sin(a); add(c * 0.45, 0.18, s * 0.45, 0.09, 0.09, 0.09, '#6a74c4'); add(c * 0.62, 0, s * 0.62, 0.08, 0.26, 0.08, '#6a74c4'); }
      add(-0.18, 1.2, 0.47, 0.16, 0.12, 0.04, '#5ef2c8'); add(0.18, 1.2, 0.47, 0.16, 0.12, 0.04, '#5ef2c8');
    } else { // 백혈구 수호자
      add(0, 0, 0, 0.92, 0.9, 0.82, '#f4f6ff'); add(0, 0.9, 0, 0.82, 0.6, 0.76, '#ffffff');
      add(-0.36, 0.95, -0.2, 0.18, 0.18, 0.4, '#e2e6f6'); add(0.32, 0.2, -0.36, 0.3, 0.3, 0.2, '#e2e6f6'); add(0, 0.12, 0.3, 0.48, 0.42, 0.24, '#c9b4ff'); // 핵
      eyes(1.15, 0.39, 0.18, 0.16); add(0, 0.95, 0.4, 0.2, 0.05, 0.03, '#ff8fb8');
      // Y자 항체 방패
      add(0.6, 0.15, 0.25, 0.12, 0.62, 0.12, '#ffcf5a'); add(0.48, 0.72, 0.25, 0.12, 0.42, 0.12, '#ffcf5a'); add(0.74, 0.72, 0.25, 0.12, 0.42, 0.12, '#ffcf5a');
      add(0.42, 1.1, 0.25, 0.12, 0.14, 0.12, '#ff7eb6'); add(0.8, 1.1, 0.25, 0.12, 0.14, 0.12, '#ff7eb6');
    }
    const g = new THREE.Group();
    const m = BB.vox(P, {transparent}); g.add(m);
    if (idx === 0) { const core = BB.vox([[0, 0.05, 0, 0.42, 0.42, 0.42, '#1a8f6f']]); g.add(core); }
    g.scale.setScalar(scale || 1); g.userData.baseScale = scale || 1;
    return g;
  };
  // 캐릭터 미리보기 그림 (모드 선택 창)
  BB.charThumb = function (idx) {
    const r = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true}); r.setSize(108, 108);
    const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x8090b0, 1.0)); const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(3, 5, 4); s.add(dl);
    const c = new THREE.OrthographicCamera(-1.3, 1.3, 1.3, -1.3, -10, 10); c.position.set(1.4, 1.5, 2); c.lookAt(0, 0.8, 0);
    const m = BB.makeChar(idx, 1); m.rotation.y = 0.35; s.add(m); r.render(s, c);
    const url = r.domElement.toDataURL(); r.dispose(); return url;
  };

  /* ---------------- 효과음 (Web Audio 신디사이저) ---------------- */
  const A = BB.audio = {
    c: null, out: null, muted: false, nb: null,
    unlock() { if (this.c) { if (this.c.state !== 'running') this.c.resume(); return; } const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      try { this.c = new C(); this.out = this.c.createGain(); this.out.gain.value = this.muted ? 0 : 0.6; const comp = this.c.createDynamicsCompressor(); this.out.connect(comp); comp.connect(this.c.destination);
        const len = this.c.sampleRate; const b = this.c.createBuffer(1, len, this.c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.nb = b; } catch (e) { this.c = null; } },
    ok() { return this.c && this.c.state === 'running' && !this.muted; },
    setMuted(m) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : 0.6; try { localStorage.setItem('bioBoardMute', m ? '1' : '0'); } catch (e) {} },
    tone(f, d, type, g, t0, f2) { if (!this.ok()) return; const c = this.c, t = c.currentTime + (t0 || 0), o = c.createOscillator(), a = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(a); a.connect(this.out); o.start(t); o.stop(t + d + 0.05); },
    noise(d, freq, q, g, t0, type) { if (!this.ok()) return; const c = this.c, t = c.currentTime + (t0 || 0), s = c.createBufferSource(); s.buffer = this.nb; const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      const a = c.createGain(); a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g || 0.2, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); f.connect(a); a.connect(this.out); s.start(t, Math.random() * 0.5, d + 0.05); },
    click() { this.tone(880, 0.05, 'triangle', 0.08); },
    tile() { this.noise(0.05, 2600, 2, 0.25); this.tone(520, 0.07, 'square', 0.04); },     // 타일 놓는 소리
    hop() { this.tone(420, 0.12, 'sine', 0.12, 0, 820); },
    land() { this.noise(0.06, 900, 1.2, 0.18); },
    dice() { for (let i = 0; i < 7; i++) { this.noise(0.04, 1800 + Math.random() * 1500, 3, 0.22, i * 0.07 + Math.random() * 0.03); this.tone(300 + Math.random() * 200, 0.03, 'square', 0.03, i * 0.07); } },
    yut() { for (let i = 0; i < 4; i++) { const t = 0.55 + i * 0.05 + Math.random() * 0.04; this.tone(620 + Math.random() * 120, 0.09, 'triangle', 0.16, t); this.noise(0.05, 1500, 4, 0.2, t); } this.tone(300, 0.4, 'sine', 0.06, 0, 900); },
    decode() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.12, i * 0.07)); },
    wrong() { this.tone(220, 0.3, 'sawtooth', 0.08, 0, 140); },
    coin() { this.tone(988, 0.08, 'square', 0.07); this.tone(1319, 0.2, 'square', 0.07, 0.07); },
    pay() { this.tone(660, 0.1, 'triangle', 0.1); this.tone(440, 0.18, 'triangle', 0.1, 0.08); },
    build() { this.noise(0.08, 500, 1, 0.25); this.tone(392, 0.1, 'square', 0.06, 0.05); this.tone(587, 0.16, 'square', 0.06, 0.12); },
    capture() { this.noise(0.35, 300, 0.7, 0.35); this.tone(160, 0.4, 'sawtooth', 0.12, 0, 60); this.tone(880, 0.15, 'square', 0.05, 0.12); },
    bonus() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, i * 0.06)); },
    fanfare() { const n = [523, 659, 784, 1047, 784, 1047, 1319]; n.forEach((f, i) => { this.tone(f, 0.25, 'square', 0.07, i * 0.12); this.tone(f / 2, 0.25, 'triangle', 0.08, i * 0.12); }); },
    turn() { const g = BB.match && BB.match.game; const J = {rummi: [587, 784], cell: [659, 880, 1047], code: [494, 740], yut: [587, 659, 880]}[g] || [740, 988]; J.forEach((f, i) => this.tone(f, 0.1, g === 'code' ? 'square' : 'sine', g === 'code' ? 0.05 : 0.1, i * 0.07)); },
    select() { const g = BB.match && BB.match.game; if (g === 'rummi') { this.noise(0.03, 3200, 3, 0.18); this.tone(1100, 0.04, 'triangle', 0.05); } else this.tone(1200, 0.05, 'triangle', 0.07); },   // 타일 고르기
    flip() { this.noise(0.08, 1400, 1.5, 0.2); this.tone(520, 0.08, 'triangle', 0.08, 0.04, 880); },     // 타일 뒤집기
    invalid() { this.tone(180, 0.18, 'square', 0.06); this.tone(150, 0.2, 'square', 0.05, 0.1); },
    wood() { this.tone(330 + Math.random() * 80, 0.07, 'triangle', 0.16); this.noise(0.04, 1200, 5, 0.15); }   // 나무 윷가락
  };
  try { A.muted = localStorage.getItem('bioBoardMute') === '1'; } catch (e) {}

  /* ---------------- 장면 관리 · 루프 ---------------- */
  BB.root = null; // 현재 장면의 물체 묶음
  BB.newRoot = function () { hideTip(); hoverObj = null; if (BB.root) { scene.remove(BB.root); BB.root.traverse(o => { if (o.geometry && o.geometry !== pGeo && o.geometry !== boxCache) o.geometry.dispose(); }); } BB.root = new THREE.Group(); scene.add(BB.root); BB.pickables = []; BB.onPick = null; BB.ticks = []; return BB.root; };
  BB.ticks = [];
  let last = performance.now(), elapsed = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1; elapsed += dt;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.e(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); } }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.vy -= 18 * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.rotation.x += p.rs * dt; p.m.rotation.y += p.rs * dt;
      if (p.m.position.y < 0.1) { p.m.position.y = 0.1; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; } p.m.material.opacity = Math.min(1, p.life * 2); if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); } }
    for (const f of BB.ticks) f(dt, elapsed);
    updCam(dt);
    renderer.render(scene, cam);
  }
  BB.start = () => requestAnimationFrame(loop);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); });
  BB.elapsed = () => elapsed;

  // 바닥 (디오라마 받침)
  BB.ground = function (size, c1, c2) {
    const g = new THREE.Group();
    const base = BB.box(size, 1.2, size, c1 || 0x8fd19e); base.position.y = -0.6; g.add(base);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({color: c2 || 0x9fe0ae})); top.rotation.x = -Math.PI / 2; top.position.y = 0.002; top.receiveShadow = true; g.add(top);
    const skirt = BB.box(size + 0.6, 0.5, size + 0.6, 0x6a8fb0); skirt.position.y = -1.45; g.add(skirt);
    return g;
  };
})();

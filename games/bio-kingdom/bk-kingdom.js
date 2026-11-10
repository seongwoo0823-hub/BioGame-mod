/* 바이오 킹덤 · 왕국 화면 (아이소메트릭 블록 쌓기) */
(function () {
  'use strict';
  const BK = window.BK, D = window.BKD;
  const K = BK.K = { cam: { x: 0, y: 0, z: 0.8 }, N: 14, hover: null, folk: [], fx: [] };
  const TW = 58, TH = 27.5, LH = 55;   // 반 칸 폭·높이, 한 층 높이 (타일을 절반 크기로 줄였으므로)
  // 칸 (i, j) 의 화면 위치 (그 칸 블록 그림의 왼쪽 위 기준)
  const iso = (i, j) => [(i - j) * TW, (i + j) * TH];
  K.iso = iso;
  let cv, g, W = 0, H = 0, DPR = 1;
  K.init = function (canvas) {
    cv = canvas; g = cv.getContext('2d');
    addEventListener('resize', K.resize); K.resize();
    bindInput();
    const [cx, cy] = iso(K.N / 2, K.N / 2); K.cam.x = cx; K.cam.y = cy - 40; K.cam.z = BK.clamp(Math.min(W / 1000, H / 760), Math.max(zMin(), 0.5), 0.85);
  };
  K.resize = function () { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px'; K.cam.z = BK.clamp(K.cam.z, zMin(), 1.8); };
  const zMin = () => Math.max(0.35, Math.min(W / 1500, H / 900));
  // ---------- 지도 상태 ----------
  K.cellBld = function (i, j) {   // 그 칸을 차지한 건물
    for (const b of BK.S.map) { const s = D.BUILD[b.k].size; if (i >= b.i && i < b.i + s && j >= b.j && j < b.j + s) return b; } return null;
  };
  K.canPlace = function (k, i, j, ignore) {
    const s = D.BUILD[k].size; if (i < 0 || j < 0 || i + s > K.N || j + s > K.N) return false;
    for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) { const o = K.cellBld(i + a, j + b); if (o && o !== ignore) return false; } return true;
  };
  // ---------- 생산 ----------
  K.slots = b => 2 + b.lv;
  K.ready = b => (b.q || []).filter(x => x.end <= Date.now());
  K.taxOf = b => { const T = D.BUILD[b.k].tax; if (!T) return 0; const sec = Math.min(8 * 3600, (Date.now() - (b.taxT || Date.now())) / 1000); return Math.floor(sec / T.t * T.coin * (1 + (b.lv - 1) * 0.35) * (1 + K.charm() / 100)); };
  K.charm = () => BK.S.map.reduce((a, b) => a + (D.BUILD[b.k].deco || 0) * (1 + (b.lv - 1) * 0.5), 0);
  // ---------- 그리기 ----------
  const RIMG = {}; const rimg = k => { if (!RIMG[k]) { RIMG[k] = new Image(); RIMG[k].src = BK.resIcon(k, 64); } return RIMG[k]; };
  function drawStack(sx, sy, name, level, alpha) { BK.draw(g, 'tiles', name, sx - 64, sy - 118 - level * LH, 1, alpha); }
  K.render = function (t) {
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 하늘 + 바다 배경
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8fd6ff'); sky.addColorStop(1, '#5ab8f0'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const z = K.cam.z; g.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - K.cam.x * z), DPR * (H / 2 - K.cam.y * z));
    const N = K.N, S = BK.S;
    // 그릴 것 모으기: [깊이, 함수]
    const L = [];
    // 바닥 (가장자리 밖 1칸은 물)
    for (let j = -2; j < N + 2; j++) for (let i = -2; i < N + 2; i++) {
      const inside = i >= 0 && j >= 0 && i < N && j < N, [sx, sy] = iso(i, j);
      let tile = inside ? 'grass_center_N' : 'water_center_N';
      if (inside) { const b = K.cellBld(i, j); if (b && D.BUILD[b.k].ground) tile = D.BUILD[b.k].ground; }
      L.push([i + j, 0, () => drawStack(sx, sy + (inside ? 0 : 14 + Math.sin(t * 1.5 + i * 0.7 + j) * 2), tile, 0, inside ? 1 : 0.95)]);
    }
    // 바깥 섬 장식
    for (const [i, j, n] of K.decoOut) { const [sx, sy] = iso(i, j); L.push([i + j + 0.5, 1, () => drawStack(sx, sy, n, 1)]); }
    // 건물
    for (const b of S.map) {
      const B = D.BUILD[b.k], moving = K.moving === b;
      for (const [a, c, lv, name] of B.stack) { const [sx, sy] = iso(b.i + a, b.j + c); L.push([b.i + a + b.j + c + 0.5, lv, () => drawStack(sx, sy, name, lv, moving ? 0.5 : 1)]); }
      // 레벨이 높을수록 지붕 위 깃발(장식)
      if (b.lv >= 3 && !B.deco) { const [sx, sy] = iso(b.i, b.j); L.push([b.i + b.j + 0.6, 9, () => { g.fillStyle = '#ff5a6a'; g.fillRect(sx - 1, sy - 150, 2, 30); g.beginPath(); g.moveTo(sx + 1, sy - 150); g.lineTo(sx + 18, sy - 144); g.lineTo(sx + 1, sy - 138); g.fill(); }]); }
    }
    // 주민
    for (const f of K.folk) L.push([f.i + f.j + 0.55, 1, () => drawFolk(f, t)]);
    L.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [, , fn] of L) fn();
    // 놓을 자리 표시
    if (K.placing && K.hover) {
      const k = K.placing, [hi, hj] = K.hover, ok = K.canPlace(k, hi, hj, K.moving), s = D.BUILD[k].size;
      for (let a = 0; a < s; a++) for (let c = 0; c < s; c++) diamond(hi + a, hj + c, ok ? 'rgba(90,255,120,.45)' : 'rgba(255,80,80,.45)');
      if (!K.moving) for (const [a, c, lv, name] of D.BUILD[k].stack) { const [sx, sy] = iso(hi + a, hj + c); drawStack(sx, sy, name, lv, 0.65); }
    }
    // 말풍선: 다 만든 물건 · 세금
    for (const b of S.map) {
      const B = D.BUILD[b.k], s = B.size, [sx, sy] = iso(b.i + s / 2 - 0.5, b.j + s / 2 - 0.5), top = sy - 118 - (B.stack.length ? Math.max(...B.stack.map(x => x[2])) : 0) * LH + 40;
      let icon = null, n = 0;
      if (B.make) { const r = K.ready(b); if (r.length) { const out = B.make[r[0].r].out; icon = Object.keys(out)[0]; n = r.length; } else if ((b.q || []).length) { const q = b.q[0], k2 = Math.min(1, 1 - (q.end - Date.now()) / (q.dur * 1000)); bar(sx, top - 6, k2); } }
      if (B.tax && K.taxOf(b) >= 10) { icon = 'coin'; }
      if (icon) {
        const yy = top - 34 + Math.sin(t * 3 + b.id) * 4;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, yy, 20, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#7a5a3a'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.moveTo(sx - 6, yy + 18); g.lineTo(sx, yy + 28); g.lineTo(sx + 6, yy + 18); g.fill();
        const im = rimg(icon); if (im.complete) g.drawImage(im, sx - 15, yy - 15, 30, 30);
        if (n > 1) { g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(sx + 16, yy - 14, 10, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 12px sans-serif'; g.textAlign = 'center'; g.fillText(n, sx + 16, yy - 10); }
      }
      if (K.sel === b) { g.strokeStyle = '#ffe14a'; g.lineWidth = 4; for (let a = 0; a < s; a++) for (let c = 0; c < s; c++) diamondLine(b.i + a, b.j + c); }
    }
    // 떠오르는 숫자
    for (let k = K.fx.length - 1; k >= 0; k--) { const f = K.fx[k]; f.t += 1 / 60; const a = 1 - f.t / 1.2; if (a <= 0) { K.fx.splice(k, 1); continue; } g.globalAlpha = a; const im = rimg(f.k); if (im.complete) g.drawImage(im, f.x - 30, f.y - 40 * f.t - 14, 26, 26); g.fillStyle = '#fff'; g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.font = '900 20px sans-serif'; g.textAlign = 'left'; g.strokeText('+' + f.n, f.x, f.y - 40 * f.t + 6); g.fillText('+' + f.n, f.x, f.y - 40 * f.t + 6); g.globalAlpha = 1; }
  };
  function bar(x, y, k) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x - 26, y, 52, 7); g.fillStyle = '#7ae070'; g.fillRect(x - 25, y + 1, 50 * k, 5); }
  function diamond(i, j, col) { const [sx, sy] = iso(i, j); const y = sy - 55; g.fillStyle = col; g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + TW, y + TH); g.lineTo(sx, y + TH * 2); g.lineTo(sx - TW, y + TH); g.closePath(); g.fill(); }
  function diamondLine(i, j) { const [sx, sy] = iso(i, j); const y = sy - 55; g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + TW, y + TH); g.lineTo(sx, y + TH * 2); g.lineTo(sx - TW, y + TH); g.closePath(); g.stroke(); }
  // ---------- 주민 ----------
  //  달리기 그림: Male_{방향}_Run0~9. 방향 0~7 (화면 기준으로 확인한 대응표)
  function drawFolk(f, t) {
    const [sx, sy] = iso(f.i, f.j); const run = f.moving;
    const name = run ? `Male_${f.dir}_Run${Math.floor(t * 12 + f.ph) % 10}` : `Male_${f.dir}_Idle0`;
    const e = BK.atlas.folk[name]; if (!e) return;
    const fw = e[6], fh = e[7];
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(sx, sy - 28, 9, 4, 0, 0, 7); g.fill();
    BK.draw(g, 'folk', name, sx - fw / 2, sy - 28 - fh * 0.86, 1);
    if (f.carry) { const im = rimg(f.carry); if (im.complete) g.drawImage(im, sx - 9, sy - 28 - fh * 0.86 - 4, 18, 18); }
  }
  K.updateFolk = function (dt) {
    const want = Math.min(12, 2 + BK.S.map.filter(b => b.k === 'house').length * 2);
    while (K.folk.length < want) K.folk.push({ i: K.N / 2 + Math.random() * 2, j: K.N / 2 + 2 + Math.random(), tx: 0, ty: 0, wait: Math.random() * 2, dir: 0, ph: Math.random() * 10, moving: false });
    for (const f of K.folk) {
      if (f.wait > 0) { f.wait -= dt; f.moving = false; if (f.wait <= 0) { // 빈 칸 하나 골라 걸어감 (가끔 건물에서 물건을 들고)
          let tries = 0, ti, tj; do { ti = Math.floor(Math.random() * K.N); tj = Math.floor(Math.random() * K.N); tries++; } while (K.cellBld(ti, tj) && tries < 20);
          f.tx = ti + 0.5; f.ty = tj + 0.5; f.carry = Math.random() < 0.35 ? ['glucose', 'atp', 'protein', 'coin'][Math.floor(Math.random() * 4)] : null; }
        continue; }
      const dx = f.tx - f.i, dy = f.ty - f.j, L = Math.hypot(dx, dy);
      if (L < 0.05) { f.wait = 1 + Math.random() * 3; continue; }
      const sp = 1.3 * dt; f.i += dx / L * Math.min(sp, L); f.j += dy / L * Math.min(sp, L); f.moving = true;
      // 화면에서 움직이는 방향 → 그림 방향 (8방향)
      const a = Math.atan2(dx + dy, dx - dy);   // 화면 방향 (오른쪽 0, 시계 방향)
      f.dir = FDIR[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
    }
  };
  const FDIR = [0, 1, 3, 4, 5, 6, 7, 0];   // 화면 8방향 → 그림 번호 (그림을 보고 맞춘 대응표)
  // ---------- 입력 ----------
  K.screenToCell = function (px, py) {
    const z = K.cam.z, wx = (px - W / 2) / z + K.cam.x, wy = (py - H / 2) / z + K.cam.y;
    const X = wx / TW, Y = (wy + 55) / TH; return [Math.floor((Y + X) / 2), Math.floor((Y - X) / 2)];
  };
  K.cellToScreen = function (i, j) { const [sx, sy] = iso(i, j), z = K.cam.z; return [(sx - K.cam.x) * z + W / 2, (sy - 40 - K.cam.y) * z + H / 2]; };
  function bindInput() {
    const P = new Map(); let drag = null, pinch = null, moved = false;
    cv.addEventListener('pointerdown', e => { BK.unlock(); cv.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); moved = false; if (P.size === 1) drag = { x: e.clientX, y: e.clientY, cx: K.cam.x, cy: K.cam.y }; else if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: K.cam.z }; drag = null; } });
    cv.addEventListener('pointermove', e => {
      if (P.has(e.pointerId)) P.set(e.pointerId, [e.clientX, e.clientY]);
      if (K.placing) K.hover = K.screenToCell(e.clientX, e.clientY);
      if (pinch && P.size === 2) { const [a, b] = [...P.values()]; K.cam.z = BK.clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, zMin(), 1.8); moved = true; return; }
      if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 8) moved = true; if (moved && !(K.placing && e.pointerType !== 'mouse' && false)) { K.cam.x = drag.cx - dx / K.cam.z; K.cam.y = drag.cy - dy / K.cam.z; clampCam(); } }
    });
    const up = e => { P.delete(e.pointerId); if (P.size < 2) pinch = null; if (!P.size) { if (!moved && drag) K.onTap && K.onTap(e.clientX, e.clientY); drag = null; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); K.cam.z = BK.clamp(K.cam.z * (e.deltaY > 0 ? 0.9 : 1.1), zMin(), 1.8); }, { passive: false });
  }
  function clampCam() { const [x0] = iso(0, K.N), [x1] = iso(K.N, 0), [, y1] = iso(K.N, K.N); K.cam.x = BK.clamp(K.cam.x, x0, x1); K.cam.y = BK.clamp(K.cam.y, -100, y1); }
  K.popFx = function (b, k, n) { const s = D.BUILD[b.k].size, [sx, sy] = iso(b.i + s / 2 - 0.5, b.j + s / 2 - 0.5); K.fx.push({ x: sx, y: sy - 140, k, n, t: 0 }); };
  // 섬 바깥 장식 (물 위 작은 나무섬은 없고, 지도 가장자리 숲)
  K.decoOut = [];
})();

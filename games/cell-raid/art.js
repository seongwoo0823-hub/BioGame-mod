// 세포 레이드 — 고해상 환경 그림 (독창 디자인): 세포 조직 바닥 · 피부층 벽 · 각질 장애물 · 모공 문 · 조명
(function () {
  'use strict';
  const CR = window.CR, T = CR.T, COLS = CR.COLS, ROWS = CR.ROWS, RW = CR.RW, RH = CR.RH;
  const sh = CR.shade, mix = CR.mix, rgb = CR.rgb;

  // 구역별 환경 팔레트 (1구역을 먼저 고퀄리티로)
  const PAL = {
    1: { cell: '#e2a985', cell2: '#d89a76', membrane: '#9c5a45', nuc: '#a8604c', wound: '#b5473f', wound2: '#7a2128', scab: '#6b2a22', pus: '#e8d27a',
         wallTop: '#f3d2b4', wallMid: '#d79b7c', wallDeep: '#a85d4c', wallDark: '#5a2621', hair: '#3a2418', vessel: '#c2333d' },
  };
  const P = st => PAL[st] || null;

  /* ───────── 값 잡음 (부드러운 무작위 지형) ───────── */
  function noise2(seed, gw, gh) {
    const r = CR.rng(seed), g = []; for (let i = 0; i < (gw + 1) * (gh + 1); i++) g.push(r());
    return (x, y) => { const gx = x * gw, gy = y * gh, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (i, j) => g[Math.min(gh, j) * (gw + 1) + Math.min(gw, i)];
      return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy; };
  }
  function put(d, w, x, y, hex, a) {
    if (x < 0 || y < 0 || x >= w) return; const i = (y * w + x) * 4; if (i < 0 || i >= d.length) return; const [r, g, b] = rgb(hex);
    if (a == null || a >= 1) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    else { d[i] = d[i] + (r - d[i]) * a; d[i + 1] = d[i + 1] + (g - d[i + 1]) * a; d[i + 2] = d[i + 2] + (b - d[i + 2]) * a; }
  }
  function darken(d, w, x, y, k) { const i = (y * w + x) * 4; if (i < 0 || i >= d.length) return; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k * 1.02 + 0.0; }

  /* ───────── 바닥: 각질세포 모자이크 + 상처 ───────── */
  function drawFloor(img, room, st) {
    const p = P(st), d = img.data, w = RW, seed = CR.hashStr(room.key + 's' + st), r = CR.rng(seed);
    const CS = 13, gw = Math.ceil(RW / CS) + 1, gh = Math.ceil(RH / CS) + 1, seeds = [];
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) seeds.push({ x: (i + 0.15 + r() * 0.7) * CS, y: (j + 0.15 + r() * 0.7) * CS, tint: (r() - 0.5) * 0.14, pink: r() < 0.18 ? 0.35 + r() * 0.3 : 0, nuc: r() < 0.55, nx: (r() - 0.5) * 3, ny: (r() - 0.5) * 3 });
    const wound = noise2(seed + 1, 5, 3), grain = noise2(seed + 2, 40, 24);
    // 상처 중심(방마다 1~2곳)
    const wc = []; for (let k = 0; k < 1 + (r() < 0.5 ? 1 : 0); k++) wc.push({ x: 60 + r() * (RW - 120), y: 40 + r() * (RH - 80), rx: 40 + r() * 50, ry: 22 + r() * 26 });
    for (let y = T; y < RH - T; y++) for (let x = T; x < RW - T; x++) {
      const gi = Math.floor(x / CS), gj = Math.floor(y / CS); let d1 = 1e9, d2 = 1e9, best = null;
      for (let j = gj - 1; j <= gj + 1; j++) for (let i = gi - 1; i <= gi + 1; i++) { if (i < 0 || j < 0 || i >= gw || j >= gh) continue; const s = seeds[j * gw + i], dd = Math.hypot(x - s.x, y - s.y); if (dd < d1) { d2 = d1; d1 = dd; best = s; } else if (dd < d2) d2 = dd; }
      const edge = d2 - d1;
      // 상처 세기
      let wv = wound(x / RW, y / RH) * 0.55; for (const c of wc) { const q = ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2; wv += Math.max(0, 1 - q) * 0.75; }
      let col = mix(p.cell, p.cell2, 0.5 + best.tint * 4); if (best.pink) col = mix(col, '#e8a39b', best.pink);
      const gx = (x - best.x) / CS, gy = (y - best.y) / CS;
      col = sh(col, -(gx + gy) * 0.09 + best.tint);                 // 세포 볼록함
      if (wv > 0.62) col = mix(col, p.wound, Math.min(1, (wv - 0.62) * 2.6));   // 드러난 진피
      if (wv > 0.95) col = mix(col, p.wound2, Math.min(0.8, (wv - 0.95) * 3));
      // 세포막
      if (edge < 1.1) col = wv > 0.8 ? p.wound2 : p.membrane;
      else if (edge < 2.1) col = sh(col, -0.13);
      else if (edge < 3 && (x - best.x) + (y - best.y) < 0) col = sh(col, 0.07);   // 막 안쪽 하이라이트
      // 세포핵
      if (best.nuc && wv < 0.7) { const nd = Math.hypot(x - best.x - best.nx, y - best.y - best.ny); if (nd < 1.7) col = p.nuc; else if (nd < 2.4) col = sh(col, -0.06); }
      // 미세한 결
      const gr = grain(x / RW, y / RH); col = sh(col, (gr - 0.5) * 0.06);
      put(d, w, x, y, col);
    }
    // 갈라진 상처 틈 (어두운 균열)
    for (const c of wc) for (let k = 0; k < 3; k++) {
      let x = c.x + (r() - 0.5) * c.rx, y = c.y + (r() - 0.5) * c.ry, a = r() * 6.28;
      for (let s = 0; s < 26 + r() * 20; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a); const ix = Math.round(x), iy = Math.round(y); if (ix < T + 1 || iy < T + 1 || ix > RW - T - 2 || iy > RH - T - 2) break; put(d, w, ix, iy, p.wound2); put(d, w, ix + 1, iy, sh(p.wound2, 0.2), 0.5); put(d, w, ix, iy - 1, sh(p.wound, -0.2), 0.4); }
    }
    // 딱지 조각 · 혈흔 · 고름 · 세균 군집
    const blot = (cx, cy, rr, colA, colB, hl) => { for (let y = -rr - 1; y <= rr + 1; y++) for (let x = -rr - 1; x <= rr + 1; x++) { const q = (x * x + y * y * 1.4) / (rr * rr) + (r() - 0.5) * 0.25; if (q > 1) continue; put(d, w, Math.round(cx + x), Math.round(cy + y), q > 0.6 ? colA : (hl && x + y < -rr * 0.6 ? sh(colB, 0.3) : colB)); } };
    for (let k = 0; k < 5; k++) { const x = T + 8 + r() * (RW - 2 * T - 16), y = T + 8 + r() * (RH - 2 * T - 16); blot(x, y, 2 + r() * 3, sh(p.scab, -0.25), p.scab, true); }
    for (let k = 0; k < 7; k++) { const x = T + 6 + r() * (RW - 2 * T - 12), y = T + 6 + r() * (RH - 2 * T - 12); blot(x, y, 1 + r() * 1.6, sh(p.vessel, -0.3), p.vessel, true); }
    for (let k = 0; k < 2; k++) { const x = T + 10 + r() * (RW - 2 * T - 20), y = T + 10 + r() * (RH - 2 * T - 20); blot(x, y, 3 + r() * 2, sh(p.pus, -0.25), p.pus, true); for (let m = 0; m < 6; m++) put(d, w, Math.round(x + (r() - 0.5) * 12), Math.round(y + (r() - 0.5) * 8), sh(p.pus, 0.2)); }
    // 벽 쪽 그늘 (앰비언트 오클루전)
    for (let y = T; y < RH - T; y++) for (let x = T; x < RW - T; x++) {
      const dt = y - T, dl = x - T, dr = RW - T - 1 - x, db = RH - T - 1 - y;
      let k = 1; if (dt < 10) k *= 0.62 + dt * 0.038; if (dl < 6) k *= 0.78 + dl * 0.037; if (dr < 4) k *= 0.88 + dr * 0.03; if (db < 3) k *= 0.92 + db * 0.027;
      if (k < 1) darken(d, w, x, y, k);
    }
  }

  /* ───────── 벽: 피부층 단면 ───────── */
  function drawWalls(img, room, st) {
    const p = P(st), d = img.data, w = RW, r = CR.rng(CR.hashStr(room.key + 'w' + st)), bump = noise2(CR.hashStr(room.key) + 9, 30, 4);
    const layer = (t) => t < 0.18 ? p.wallTop : t < 0.3 ? mix(p.wallTop, p.wallMid, 0.5) : t < 0.6 ? p.wallMid : t < 0.85 ? p.wallDeep : p.wallDark;
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const inTop = y < T, inBot = y >= RH - T, inL = x < T, inR = x >= RW - T; if (!(inTop || inBot || inL || inR)) continue;
      // 바깥(0) → 안쪽 가장자리(1)까지의 깊이
      let t; if (inTop && !inL && !inR) t = y / T; else if (inBot && !inL && !inR) t = (RH - 1 - y) / T; else if (inL && !inTop && !inBot) t = x / T; else if (inR && !inTop && !inBot) t = (RW - 1 - x) / T;
      else { const cx = inL ? T : RW - T, cy = inTop ? T : RH - T; t = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / T); }
      const along = inTop || inBot ? x / RW : y / RH, b = bump(along, t * 0.9);
      // 위쪽 벽은 단면이 보이도록 층을 뒤집어(바깥이 각질층), 아래쪽 벽은 윗면이 보이게 밝게
      let tt = 1 - t + (b - 0.5) * 0.22; if (inBot && !inL && !inR) tt = 0.25 + (1 - t) * 0.5 + (b - 0.5) * 0.15;
      let col = layer(Math.max(0, Math.min(1, tt)));
      col = sh(col, (b - 0.5) * 0.18 + (inL || inR ? -0.05 : 0));
      if (t > 0.88) col = sh(p.wallTop, 0.15);          // 안쪽 입술 하이라이트
      else if (t > 0.8) col = sh(col, 0.12);
      if (t < 0.08) col = sh(p.wallDark, -0.25);
      put(d, w, x, y, col);
    }
    // 각질 비늘 (위쪽 벽 바깥)
    for (let x = 2; x < RW - 2; x += 3 + Math.floor(r() * 3)) { const y = 2 + Math.floor(r() * 3); for (let k = 0; k < 4; k++) put(d, w, x + k, y + (k > 1 ? 1 : 0), sh(p.wallTop, 0.25 - k * 0.05)); put(d, w, x, y + 2, sh(p.wallDeep, -0.1)); }
    for (let x = 3; x < RW - 3; x += 4 + Math.floor(r() * 3)) { const y = RH - T + 4 + Math.floor(r() * 8); put(d, w, x, y, sh(p.wallTop, 0.2)); put(d, w, x + 1, y, sh(p.wallTop, 0.12)); put(d, w, x + 2, y, sh(p.wallTop, 0.05)); put(d, w, x, y + 1, sh(p.wallDeep, 0.05)); }
    for (let y = T; y < RH - T; y += 4 + Math.floor(r() * 3)) { for (const x0 of [2 + Math.floor(r() * 6), RW - 4 - Math.floor(r() * 6)]) { put(d, w, x0, y, sh(p.wallTop, 0.15)); put(d, w, x0, y + 1, sh(p.wallTop, 0.05)); put(d, w, x0 + 1, y + 1, sh(p.wallDeep, 0.0)); } }
    // 모세혈관 (벽면)
    for (let k = 0; k < 4; k++) {
      let x = T + r() * (RW - 2 * T), y = 2 + r() * 8, a = Math.PI / 2 + (r() - 0.5) * 1.2;
      for (let s = 0; s < 18; s++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 0.9; y += Math.sin(a) * 0.5; if (y > T - 3) break; put(d, w, Math.round(x), Math.round(y), p.vessel, 0.75); if (r() < 0.12) { put(d, w, Math.round(x) + 1, Math.round(y) - 1, p.vessel, 0.6); } }
    }
    // 땀구멍 (벽)
    for (let k = 0; k < 7; k++) { const side = k % 3, x = side === 0 ? T + r() * (RW - 2 * T) : side === 1 ? 4 + r() * 6 : RW - 10 + r() * 6, y = side === 0 ? 4 + r() * 6 : T + r() * (RH - 2 * T);
      put(d, w, Math.round(x), Math.round(y), p.wallDark); put(d, w, Math.round(x) + 1, Math.round(y), p.wallDark); put(d, w, Math.round(x), Math.round(y) + 1, sh(p.wallDark, 0.2)); put(d, w, Math.round(x) - 1, Math.round(y) - 1, sh(p.wallTop, 0.2)); }
    // 벽이 바닥에 드리우는 그림자 (위·왼쪽)
    for (let x = T; x < RW - T; x++) for (let k = 0; k < 5; k++) darken(d, w, x, T + k, 0.55 + k * 0.09);
    for (let y = T; y < RH - T; y++) for (let k = 0; k < 3; k++) darken(d, w, T + k, y, 0.7 + k * 0.1);
  }

  /* ───────── 털 (모낭에서 방 안으로 자란 털) ───────── */
  function drawHairs(c, room, st) {
    const p = P(st), r = CR.rng(CR.hashStr(room.key + 'h'));
    c.save();
    for (let k = 0; k < 5; k++) {
      const side = Math.floor(r() * 3); let x, y, a;
      if (side === 0) { x = T + 10 + r() * (RW - 2 * T - 20); y = T - 3; a = Math.PI / 2 + (r() - 0.5) * 0.9; }
      else if (side === 1) { x = T - 3; y = T + 10 + r() * (RH - 2 * T - 20); a = (r() - 0.5) * 0.9; }
      else { x = RW - T + 2; y = T + 10 + r() * (RH - 2 * T - 20); a = Math.PI + (r() - 0.5) * 0.9; }
      if (Math.abs(x - RW / 2) < 20 || Math.abs(y - RH / 2) < 16) continue;   // 문 앞은 비움
      c.fillStyle = sh(p.wallDark, -0.2); c.fillRect(Math.round(x) - 1, Math.round(y), 3, 2); c.fillStyle = p.wound2; c.fillRect(Math.round(x), Math.round(y), 1, 1);   // 모낭
      const len = 9 + r() * 9, sgn = r() < 0.5 ? -1 : 1, curl = 0.05 + r() * 0.09;
      for (let s = 0; s < len; s++) { a += sgn * curl * (1 + s / len); x += Math.cos(a) * 0.85; y += Math.sin(a) * 0.85; const k = s / len; c.globalAlpha = k > 0.75 ? 1 - (k - 0.75) * 2.4 : 1; c.fillStyle = k < 0.25 ? sh(p.hair, -0.25) : k > 0.7 ? sh(p.hair, 0.35) : p.hair; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
      c.globalAlpha = 1;
    }
    c.restore();
  }

  /* ───────── 장애물 그림 ───────── */
  function crustSpr(st, v) {
    const p = P(st);
    return CR.spr('crust' + st + '_' + v, 16, 16, g => {
      const r = CR.rng(st * 991 + v * 37);
      // 바닥 그림자 쪽 덩어리 → 위에 겹친 각질 판들
      const look = [[p.wallMid, mix(p.wallTop, p.wallMid, 0.4), sh(p.scab, -0.1)], [sh(p.scab, 0.15), sh(p.scab, 0.32), sh(p.scab, -0.2)], [mix(p.pus, p.wallMid, 0.45), mix(p.pus, p.wallTop, 0.3), sh(p.scab, -0.05)], [mix(p.wallTop, p.wallMid, 0.2), p.wallTop, sh(p.wallDeep, -0.1)]][v];
      if (v === 3) { for (let k = 0; k < 6; k++) { const cx = 3.5 + r() * 9, cy = 5 + r() * 7; g.blob(cx, cy + 1, 2.4 + r(), 1.8 + r() * 0.6, sh(look[2], 0.05)); g.blob(cx - 0.3, cy, 2.1 + r() * 0.8, 1.5, k % 2 ? look[0] : look[1]); } }
      else {
        g.blob(8, 10, 6.8, 4.8, look[2]);
        const plates = 3 + Math.floor(r() * 2);
        for (let k = 0; k < plates; k++) { const cx = 4.5 + r() * 7, cy = 6.5 + r() * 4, rx = 3 + r() * 2.2, ry = 2.2 + r() * 1.4; g.blob(cx, cy - k * 0.6, rx, ry, k % 2 ? look[0] : look[1]); }
        if (v === 1) for (let k = 0; k < 5; k++) g.set(4 + r() * 8, 6 + r() * 5, sh(p.scab, -0.35));
        if (v === 2) { g.blob(9 + r() * 2, 7, 1.6, 1.2, p.pus); g.set(9, 6, '#fff6c8'); }
      }
      // 균열·핏자국
      for (let k = 0; k < 2; k++) { let x = 4 + r() * 8, y = 6 + r() * 5; for (let s = 0; s < 4; s++) { x += r() - 0.4; y += r() - 0.5; g.set(x, y, sh(p.scab, -0.15)); } }
      if (v === 0) { g.set(5 + Math.floor(r() * 5), 9 + Math.floor(r() * 2), p.vessel); g.set(6 + Math.floor(r() * 5), 10, sh(p.vessel, -0.2)); }
      g.set(5, 5, sh(p.wallTop, 0.4)); g.set(6, 5, sh(p.wallTop, 0.3));
    });
  }
  function stapleSpr(st) {
    const p = P(st);
    return CR.spr('staple' + st, 16, 16, g => {
      g.rect(1, 2, 14, 13, p.scab, true); g.rect(2, 3, 12, 10, sh(p.scab, 0.12), true);
      for (let k = 0; k < 3; k++) { const x = 3 + k * 4; g.rect(x, 5, 3, 1, '#d8dde6'); g.set(x, 6, '#9aa4b2'); g.set(x + 2, 6, '#9aa4b2'); g.set(x, 4, '#ffffff'); }
      for (let k = 0; k < 2; k++) { const x = 4 + k * 6; g.rect(x, 10, 3, 1, '#d8dde6'); g.set(x, 11, '#9aa4b2'); g.set(x + 2, 11, '#9aa4b2'); }
      g.line(2, 8, 13, 8, sh(p.scab, -0.3));
    });
  }
  function spikeSpr(st) {   // 1구역 가시: 뻣뻣하게 솟은 각질 가시
    const p = P(st);
    return CR.spr('kspike' + st, 16, 16, g => { for (const [x, y] of [[3, 5], [10, 4], [6, 11], [12, 11]]) { for (let i = 0; i < 5; i++) for (let j = -Math.floor(i / 2); j <= Math.floor(i / 2); j++) g.set(x + j + 1, y + i - 2, i === 0 ? '#ffffff' : sh(p.wallTop, -i * 0.08)); g.set(x, y + 3, sh(p.wallDark, 0.2)); } });
  }

  /* ───────── 방 배경 (기존 CR.roomBg를 1구역에서 대체) ───────── */
  const baseBg = CR.roomBg;
  CR.roomBg = function (room, st) {
    if (!P(st)) return baseBg(room, st);
    if (room.bg && !room.bgDirty) return room.bg;
    const cv = room.bg || document.createElement('canvas'); cv.width = RW; cv.height = RH;
    const c = cv.getContext('2d');
    if (!room.floorImg) { const img = c.createImageData(RW, RH); drawFloor(img, room, st); drawWalls(img, room, st); room.floorImg = img; }
    c.putImageData(room.floorImg, 0, 0);
    drawHairs(c, room, st);
    const r = CR.rng(CR.hashStr(room.key + 'o'));
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      const v = room.tiles[y * COLS + x], px = x * T, py = y * T;
      if (v === 2) { c.fillStyle = 'rgba(40,10,10,0.28)'; c.beginPath(); c.ellipse(px + 9, py + 13, 7, 3, 0, 0, 7); c.fill(); c.drawImage(crustSpr(st, (x * 7 + y * 13) % 4), px, py); }
      else if (v === 3) { c.fillStyle = 'rgba(40,10,10,0.3)'; c.fillRect(px + 2, py + 14, 14, 2); c.drawImage(stapleSpr(st), px, py); }
      else if (v === 4) c.drawImage(spikeSpr(st), px, py);
      else if (v === 7) { const P1 = P(st); c.fillStyle = 'rgba(232,210,122,0.55)'; c.beginPath(); c.ellipse(px + 8, py + 9, 8, 5, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,245,200,0.6)'; c.fillRect(px + 4, py + 7, 3, 1); c.fillStyle = P1.pus; c.fillRect(px + 10, py + 10, 2, 1); }
      else if (v === 0 && r() < 0.012) { /* 잔해 */ c.fillStyle = 'rgba(90,30,25,0.5)'; c.fillRect(px + 5 + Math.floor(r() * 6), py + 6 + Math.floor(r() * 6), 2, 1); }
    }
    room.bg = cv; room.bgDirty = false; return cv;
  };
  CR.rockSprFor = (st, tx, ty) => P(st) ? crustSpr(st, (tx * 7 + ty * 13) % 4) : CR.rockSpr(st);

  /* ───────── 문: 모공 모양 살 고리 ───────── */
  const baseDoor = CR.drawDoor;
  const RIM = { normal: null, boss: '#a8121f', treasure: '#e8b730', shop: '#3fae5e', lab: '#c0103e', sanct: '#fff0b0' };
  CR.drawDoor = function (c, room, d, st, open, t) {
    const p = P(st); if (!p) return baseDoor(c, room, d, st, open, t);
    const door = room.doors[d]; if (!door || (door.kind === 'secret' && door.hidden)) return;
    const [tx, ty] = CR.DOOR_TILE[d], hor = d === 'u' || d === 'd', cx = tx * T + 8, cy = ty * T + 8 + (d === 'u' ? 2 : d === 'd' ? -2 : 0);
    const isOpen = open && !door.locked, rim = RIM[door.kind] || p.wallMid;
    c.save(); c.translate(cx + (d === 'l' ? 2 : d === 'r' ? -2 : 0), cy);
    if (!hor) c.rotate(Math.PI / 2);
    const RX = 12, RY = 8;
    if (door.kind === 'secret') { c.fillStyle = '#1a0606'; c.beginPath(); c.ellipse(0, 0, 8, 5, 0, 0, 7); c.fill(); c.fillStyle = sh(p.wallDeep, -0.2); for (let k = 0; k < 6; k++) c.fillRect(-9 + k * 3, -6 + (k % 2) * 11, 2, 1); c.restore(); return; }
    // 살 고리 (바깥 → 안)
    const ring = (rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill(); };
    ring(RX + 3, RY + 3, sh(rim, -0.45)); ring(RX + 2, RY + 2, sh(rim, -0.15)); ring(RX, RY, rim); ring(RX - 1, RY - 1, sh(rim, 0.18));
    c.fillStyle = sh(rim, 0.4); c.fillRect(-RX + 3, -RY + 1, 5, 1);
    // 구멍 / 닫힌 괄약 막
    if (isOpen) { ring(RX - 3, RY - 3, '#120406'); ring(RX - 5, RY - 4.5, '#050102'); c.fillStyle = 'rgba(255,120,120,0.12)'; c.fillRect(-RX + 4, -1, 2 * RX - 8, 1); }
    else {
      ring(RX - 3, RY - 3, sh(p.wound, -0.1));
      c.strokeStyle = sh(p.wound2, -0.1); c.lineWidth = 1;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (RX - 3), Math.sin(a) * (RY - 3)); c.stroke(); }
      ring(2, 1.4, p.wound2);
    }
    if (door.locked) { c.fillStyle = '#f2c94c'; c.fillRect(-3, -3, 6, 5); c.fillStyle = '#8a6410'; c.fillRect(-1, -1, 2, 2); c.strokeStyle = '#f2c94c'; c.beginPath(); c.arc(0, -3, 2, Math.PI, 0); c.stroke(); }
    if (door.kind === 'boss') { c.fillStyle = '#f4e6e6'; for (let k = -2; k <= 2; k++) { c.fillRect(k * 4 - 1, -RY - 3, 2, 3); c.fillRect(k * 4 - 1, RY, 2, 3); } }
    if (door.kind === 'treasure') { c.fillStyle = '#fff2b0'; c.fillRect(-1, -RY - 4, 2, 2); }
    if (door.kind === 'lab' || door.kind === 'sanct') { c.globalAlpha = 0.25 + Math.sin(t * 4) * 0.15; ring(RX + 6, RY + 5, door.kind === 'lab' ? '#ff2050' : '#fff6c0'); c.globalAlpha = 1; }
    c.restore();
  };

  /* ───────── 방 위 조명: 비네팅 · 떠다니는 미세 입자 ───────── */
  const motes = [];
  CR.roomOverlay = function (c, t, st) {
    if (!P(st)) return;
    if (!motes.length) for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * RW, y: Math.random() * RH, s: 0.3 + Math.random() * 0.7, p: Math.random() * 6 });
    for (const m of motes) { const x = (m.x + t * 4 * m.s) % RW, y = (m.y + Math.sin(t * 0.8 + m.p) * 6 + RH) % RH; if (x < T || y < T || x > RW - T || y > RH - T) continue; c.fillStyle = 'rgba(255,236,220,' + (0.25 + 0.25 * Math.sin(t * 2 + m.p)) + ')'; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
    if (!CR._vig) { const v = document.createElement('canvas'); v.width = RW; v.height = RH; const vc = v.getContext('2d'); const g = vc.createRadialGradient(RW / 2, RH / 2, RH * 0.35, RW / 2, RH / 2, RW * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,6,10,0.45)'); vc.fillStyle = g; vc.fillRect(0, 0, RW, RH); CR._vig = v; }
    c.drawImage(CR._vig, 0, 0);
  };
})();

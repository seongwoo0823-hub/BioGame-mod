/* 바이오 킹덤 · 직접 그린 그림: 병원체(적), 자원 아이콘, 생명의 알, 효과 */
(function () {
  'use strict';
  const BK = window.BK, TAU = Math.PI * 2;
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  BK.shade = shade;
  // 귀여운 눈 (화난 눈썹)
  function eyes(g, x, y, r, t, mean, look) {
    const blink = (Math.sin(t * 0.7 + x) > 0.97) ? 0.15 : 1;
    for (const s of [-1, 1]) {
      const ex = x + s * r * 0.95;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, y, r * 0.62, r * 0.72 * blink, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a1424'; g.beginPath(); g.ellipse(ex - r * 0.18 + (look || 0), y + r * 0.08, r * 0.34, r * 0.42 * blink, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - r * 0.3, y - r * 0.12, r * 0.12, 0, TAU); g.fill();
      if (mean) { g.strokeStyle = '#1a1424'; g.lineWidth = r * 0.22; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - s * r * 0.55, y - r * 0.85); g.lineTo(ex + s * r * 0.35, y - r * 0.55); g.stroke(); }
    }
  }
  function mouth(g, x, y, r, open) {
    g.fillStyle = '#5a1430'; g.beginPath(); g.ellipse(x, y, r * 0.5, r * (0.18 + open * 0.3), 0, 0, Math.PI); g.fill();
    g.fillStyle = '#fff'; g.fillRect(x - r * 0.3, y - 1, r * 0.18, r * 0.16); g.fillRect(x + r * 0.12, y - 1, r * 0.18, r * 0.16);
  }
  function blobPath(g, x, y, r, n, amp, t, ph) { g.beginPath(); for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU, rr = r * (1 + amp * Math.sin(a * n + t * 2.2 + (ph || 0))); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); }
  function body(g, x, y, r, col, path) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.1); gr.addColorStop(0, shade(col, 0.45)); gr.addColorStop(0.6, col); gr.addColorStop(1, shade(col, -0.35));
    path(); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(2, r * 0.09); g.strokeStyle = shade(col, -0.55); g.stroke();
  }
  // 적 그리기: (x, y) = 발 위치, s = 크기, t = 시간, st = {hurt, atk, dead}
  BK.drawEnemy = function (g, e, x, y, s, t, st) {
    st = st || {}; const r = 34 * s, col = e.col, bob = Math.sin(t * 4) * r * 0.06, cy = y - r - bob - (e.fly ? r * 0.9 + Math.sin(t * 9) * r * 0.1 : 0);
    g.save();
    if (st.alpha != null) g.globalAlpha = st.alpha;
    // 그림자
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y, r * 0.9, r * 0.22, 0, 0, TAU); g.fill();
    const lunge = st.atk ? Math.sin(st.atk * Math.PI) * r * 0.35 : 0; const cx = x - lunge;
    if (st.hurt) g.filter = 'brightness(1.8)';
    switch (e.look) {
      case 'virus': {   // 공 모양 + 돌기(스파이크 단백질)
        g.strokeStyle = shade(col, -0.4); g.lineWidth = r * 0.12;
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + t * 0.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35); g.stroke(); g.fillStyle = '#ff7a8a'; g.beginPath(); g.arc(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4, r * 0.14, 0, TAU); g.fill(); }
        body(g, cx, cy, r, col, () => blobPath(g, cx, cy, r, 6, 0.04, t));
        if (e.boss) { g.fillStyle = '#ffd23a'; g.beginPath(); const cyw = cy - r * 1.05; g.moveTo(cx - r * 0.5, cyw); for (let k = 0; k <= 4; k++) { g.lineTo(cx - r * 0.5 + k * r * 0.25, cyw - (k % 2 ? r * 0.18 : r * 0.42)); } g.lineTo(cx + r * 0.5, cyw); g.closePath(); g.fill(); g.strokeStyle = '#a07010'; g.lineWidth = 2; g.stroke(); }
        eyes(g, cx, cy - r * 0.1, r * 0.3, t, true, -2); mouth(g, cx, cy + r * 0.35, r * 0.7, st.atk ? 1 : 0.2); break;
      }
      case 'rod': {     // 막대 모양 세균 + 편모
        g.strokeStyle = shade(col, -0.3); g.lineWidth = r * 0.07;
        for (let k = 0; k < 5; k++) { g.beginPath(); const sx = cx + r * 1.1, sy = cy - r * 0.4 + k * r * 0.2; g.moveTo(sx, sy); for (let q = 1; q <= 10; q++) g.lineTo(sx + q * r * 0.1, sy + Math.sin(q * 0.9 + t * 9 + k) * r * 0.12); g.stroke(); }
        body(g, cx, cy, r, col, () => { g.beginPath(); g.ellipse(cx, cy, r * 1.2, r * 0.7, 0, 0, TAU); });
        if (e.boss) { g.fillStyle = 'rgba(80,80,100,.55)'; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx + k * r * 0.42, cy - r * 0.45, r * 0.22, r * 0.14, 0, 0, TAU); g.fill(); } }
        eyes(g, cx - r * 0.3, cy - r * 0.05, r * 0.26, t, true, -2); mouth(g, cx - r * 0.3, cy + r * 0.32, r * 0.55, st.atk ? 1 : 0.2); break;
      }
      case 'cocci': {   // 포도송이 공 모양
        const P = [[0.5, 0.3], [-0.45, 0.35], [0.05, -0.45], [0.55, -0.4], [-0.5, -0.35]];
        for (const [a, b] of P) body(g, cx + a * r, cy + b * r, r * 0.48, shade(col, -0.08), () => { g.beginPath(); g.arc(cx + a * r, cy + b * r, r * 0.48, 0, TAU); });
        body(g, cx, cy, r * 0.62, col, () => { g.beginPath(); g.arc(cx, cy, r * 0.62, 0, TAU); });
        eyes(g, cx, cy - r * 0.08, r * 0.22, t, true, -2); mouth(g, cx, cy + r * 0.25, r * 0.5, st.atk ? 1 : 0.2); break;
      }
      case 'fuzz': {    // 곰팡이 포자: 털 뭉치 + 균사
        g.strokeStyle = shade(col, 0.3); g.lineWidth = r * 0.06;
        for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; const l = r * (1.15 + 0.12 * Math.sin(t * 3 + k)); g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); }
        body(g, cx, cy, r * 0.9, col, () => blobPath(g, cx, cy, r * 0.9, 9, 0.06, t));
        for (let k = 0; k < 6; k++) { const a = k * 1.1 + t; g.fillStyle = shade(col, 0.5); g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.45, r * 0.08, 0, TAU); g.fill(); }
        if (e.boss) { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(cx, cy - r * 1.2, r * 0.25, 0, TAU); g.fill(); }
        eyes(g, cx, cy - r * 0.05, r * 0.26, t, true, -2); mouth(g, cx, cy + r * 0.32, r * 0.5, st.atk ? 1 : 0.2); break;
      }
      case 'blob': {    // 아메바: 위족을 뻗는 말랑한 몸
        g.globalAlpha *= 0.92;
        body(g, cx, cy + r * 0.1, r * 1.05, col, () => blobPath(g, cx, cy + r * 0.1, r * 1.05, 3, 0.18, t * 1.4));
        g.fillStyle = shade(col, -0.25); g.beginPath(); g.arc(cx + r * 0.3, cy + r * 0.25, r * 0.22, 0, TAU); g.fill();   // 핵
        g.globalAlpha /= 0.92; eyes(g, cx - r * 0.15, cy - r * 0.15, r * 0.27, t, false, -2); mouth(g, cx - r * 0.15, cy + r * 0.25, r * 0.5, st.atk ? 1 : 0.3); break;
      }
      case 'worm': {    // 회충: 마디 있는 긴 몸
        for (let k = 5; k >= 0; k--) { const px = cx + k * r * 0.36, py = cy + r * 0.4 + Math.sin(t * 6 - k * 0.8) * r * 0.18; body(g, px, py, r * (0.42 - k * 0.025), k ? shade(col, -0.05 * k) : col, () => { g.beginPath(); g.arc(px, py, r * (0.42 - k * 0.025), 0, TAU); }); }
        eyes(g, cx - r * 0.05, cy + r * 0.3, r * 0.17, t, true, -2); break;
      }
      case 'diatom': {  // 적조 플랑크톤: 원반 + 무늬
        body(g, cx, cy, r, col, () => { g.beginPath(); g.ellipse(cx, cy, r, r * 0.8, Math.sin(t) * 0.2, 0, TAU); });
        g.strokeStyle = shade(col, 0.4); g.lineWidth = 2; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + t * 0.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.68); g.stroke(); }
        eyes(g, cx, cy - r * 0.05, r * 0.25, t, true, -2); mouth(g, cx, cy + r * 0.3, r * 0.45, st.atk ? 1 : 0.2); break;
      }
      case 'slime': {   // 미세플라스틱 슬라임: 반투명 + 플라스틱 조각
        const sq = 1 + Math.sin(t * 5) * 0.06;
        g.globalAlpha *= 0.9;
        body(g, cx, y - r * 0.85 * sq, r * 1.1, col, () => { g.beginPath(); g.moveTo(cx - r * 1.15, y - 2); g.quadraticCurveTo(cx - r * 1.2, y - r * 1.9 * sq, cx, y - r * 1.9 * sq); g.quadraticCurveTo(cx + r * 1.2, y - r * 1.9 * sq, cx + r * 1.15, y - 2); g.closePath(); });
        const pc = ['#ff5a7a', '#4ab0ff', '#ffd23a', '#7ae070'];
        for (let k = 0; k < 7; k++) { g.fillStyle = pc[k % 4]; g.save(); g.translate(cx + Math.cos(k * 2.3) * r * 0.6, y - r * 0.8 + Math.sin(k * 1.7) * r * 0.5); g.rotate(k + t * 0.5); g.fillRect(-r * 0.09, -r * 0.05, r * 0.18, r * 0.1); g.restore(); }
        g.globalAlpha /= 0.9; eyes(g, cx, y - r * 1.15 * sq, r * 0.28, t, true, -2); mouth(g, cx, y - r * 0.7 * sq, r * 0.55, st.atk ? 1 : 0.2); break;
      }
      case 'mosquito': { // 모기: 날개 + 침
        g.fillStyle = 'rgba(220,235,255,.6)'; for (const s2 of [-1, 1]) { g.beginPath(); g.ellipse(cx + s2 * r * 0.2, cy - r * 0.55, r * 0.75, r * 0.25, s2 * (0.5 + Math.sin(t * 40) * 0.4), 0, TAU); g.fill(); }
        g.strokeStyle = '#3a3a4a'; g.lineWidth = r * 0.06; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx + (k - 1) * r * 0.3, cy + r * 0.2); g.lineTo(cx + (k - 1) * r * 0.5, cy + r * 0.9); g.stroke(); }
        body(g, cx, cy, r * 0.62, col, () => { g.beginPath(); g.ellipse(cx + r * 0.25, cy, r * 0.7, r * 0.45, 0.2, 0, TAU); });
        g.strokeStyle = '#2a2a3a'; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(cx - r * 0.55, cy + r * 0.05); g.lineTo(cx - r * 1.25, cy + r * 0.25); g.stroke();
        eyes(g, cx - r * 0.25, cy - r * 0.1, r * 0.2, t, true, -2); break;
      }
    }
    g.restore();
  };
  // ---------- 자원 아이콘 (그려서 그림 파일로) ----------
  const ICN = {};
  BK.resIcon = function (k, size) {
    size = size || 64; const id = k + size; if (ICN[id]) return ICN[id];
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = size * 0.4, x = size / 2, y = size / 2;
    const ring = (col) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r); gr.addColorStop(0, shade(col, 0.55)); gr.addColorStop(1, shade(col, -0.2)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.lineWidth = size * 0.06; g.strokeStyle = shade(col, -0.5); g.stroke(); };
    g.lineJoin = 'round';
    if (k === 'coin') { ring('#ffc83a'); g.fillStyle = shade('#ffc83a', -0.45); g.font = `900 ${size * 0.42}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', x, y + 1); }
    else if (k === 'gem') { g.fillStyle = '#7ae8ff'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.9, y - r * 0.2); g.lineTo(x, y + r); g.lineTo(x - r * 0.9, y - r * 0.2); g.closePath(); g.fill(); g.lineWidth = size * 0.06; g.strokeStyle = '#1a6a9a'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x - r * 0.45, y - r * 0.2); g.lineTo(x, y + r * 0.2); g.closePath(); g.fill(); }
    else if (k === 'glucose') {   // 포도당: 육각 고리
      g.fillStyle = '#fff4c8'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); g.lineWidth = size * 0.07; g.strokeStyle = '#d89a20'; g.stroke();
      g.fillStyle = '#d89a20'; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
    }
    else if (k === 'atp') { ring('#ffe14a'); g.fillStyle = '#ff8a1a'; g.beginPath(); g.moveTo(x + r * 0.15, y - r * 0.75); g.lineTo(x - r * 0.4, y + r * 0.1); g.lineTo(x - r * 0.02, y + r * 0.1); g.lineTo(x - r * 0.18, y + r * 0.75); g.lineTo(x + r * 0.42, y - r * 0.12); g.lineTo(x + r * 0.04, y - r * 0.12); g.closePath(); g.fill(); g.strokeStyle = '#8a3a00'; g.lineWidth = size * 0.04; g.stroke(); }
    else if (k === 'protein') {   // 단백질: 구슬 사슬(아미노산)
      const P = [[-0.6, 0.35], [-0.25, -0.1], [0.15, 0.25], [0.5, -0.25]], C2 = ['#ff7a9a', '#7ad0ff', '#9ae070', '#ffb84a'];
      g.strokeStyle = '#7a4a5a'; g.lineWidth = size * 0.06; g.beginPath(); P.forEach(([a, b], i) => i ? g.lineTo(x + a * r, y + b * r) : g.moveTo(x + a * r, y + b * r)); g.stroke();
      P.forEach(([a, b], i) => { g.fillStyle = C2[i]; g.beginPath(); g.arc(x + a * r, y + b * r, r * 0.3, 0, TAU); g.fill(); g.lineWidth = size * 0.04; g.strokeStyle = '#4a2a3a'; g.stroke(); });
    }
    else if (k === 'dna') {   // DNA 이중 나선
      g.lineWidth = size * 0.06;
      for (let i = 0; i <= 8; i++) { const yy = y - r + i * r / 4, a = i * 0.8; const x1 = x + Math.sin(a) * r * 0.55, x2 = x - Math.sin(a) * r * 0.55; g.strokeStyle = i % 2 ? '#ff7a8a' : '#7ac8ff'; g.beginPath(); g.moveTo(x1, yy); g.lineTo(x2, yy); g.stroke(); }
      for (const s2 of [1, -1]) { g.strokeStyle = s2 > 0 ? '#3a6ad8' : '#d84a6a'; g.lineWidth = size * 0.08; g.beginPath(); for (let i = 0; i <= 16; i++) { const yy = y - r + i * r / 8, a = i * 0.4; const px = x + s2 * Math.sin(a) * r * 0.55; i ? g.lineTo(px, yy) : g.moveTo(px, yy); } g.stroke(); }
    }
    else if (k === 'energy') { ring('#7ae070'); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y + r * 0.6); g.bezierCurveTo(x - r * 0.9, y - r * 0.1, x - r * 0.3, y - r * 0.8, x, y - r * 0.3); g.bezierCurveTo(x + r * 0.3, y - r * 0.8, x + r * 0.9, y - r * 0.1, x, y + r * 0.6); g.fill(); }
    return ICN[id] = c.toDataURL();
  };
  BK.ri = (k, s) => `<img class="ri" src="${BK.resIcon(k, 64)}" style="width:${s || 22}px;height:${s || 22}px" alt="">`;
  // ---------- 생명의 알 (뽑기) ----------
  BK.drawEgg = function (g, x, y, r, col, crack, t, glow) {
    if (glow) { const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.4, 0, TAU); g.fill(); }
    const wob = crack > 0 ? Math.sin(t * 30) * 0.08 * Math.min(1, crack) : 0;
    g.save(); g.translate(x, y + r); g.rotate(wob); g.translate(-x, -(y + r));
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.5, r * 0.1, x, y, r * 1.3); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, shade(col, 0.6)); gr.addColorStop(1, shade(col, -0.2));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 0.78, r, 0, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = shade(col, -0.45); g.stroke();
    g.fillStyle = shade(col, 0.2); for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + Math.cos(k * 2.1) * r * 0.45, y + Math.sin(k * 1.6) * r * 0.55, r * 0.1, 0, TAU); g.fill(); }
    // DNA 무늬 띠
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 20; i++) { const px = x - r * 0.75 + i * r * 0.075, py = y + Math.sin(i * 0.9 + t * 2) * r * 0.08; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
    if (crack > 0.3) { g.strokeStyle = '#3a2a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.1); g.lineTo(x - r * 0.3, y - r * 0.3); g.lineTo(x - r * 0.05, y); g.lineTo(x + r * 0.2, y - r * 0.35); g.lineTo(x + r * 0.45, y - r * 0.05); g.lineTo(x + r * 0.65, y - r * 0.2); g.stroke(); }
    g.restore();
  };
  // ---------- 효과 ----------
  BK.burst = function (g, x, y, r, col, k) {   // k: 0→1 퍼지는 별빛
    g.save(); g.globalAlpha = 1 - k; g.strokeStyle = col; g.lineWidth = 4 * (1 - k) + 1;
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * r * k * 0.4, y + Math.sin(a) * r * k * 0.4); g.lineTo(x + Math.cos(a) * r * (0.3 + k), y + Math.sin(a) * r * (0.3 + k)); g.stroke(); }
    g.restore();
  };
})();

// 세포 레이드 — 엔진: 도트 그림 생성기 · 도트 글꼴 · 소리 합성 · 입력
(function () {
  'use strict';
  const CR = window.CR = window.CR || {};

  /* ───────── 색 도우미 ───────── */
  const rgbCache = {};
  function rgb(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const h = hex.replace('#', '');
    const v = h.length === 3 ? h.split('').map(c => parseInt(c + c, 16)) : [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
    return (rgbCache[hex] = v);
  }
  function toHex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  // amt > 0 밝게, < 0 어둡게 (어둡게 할 때는 약간 보라빛으로 → 도트 그림 특유의 그림자)
  function shade(hex, amt) {
    const [r, g, b] = rgb(hex);
    if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    const k = 1 + amt; return toHex(r * k + 18 * -amt, g * k + 6 * -amt, b * k + 40 * -amt);
  }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
  CR.shade = shade; CR.mix = mix; CR.rgb = rgb;

  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  CR.rng = rng; CR.hashStr = hashStr;

  /* ───────── 도트 격자: 채우기 → 명암 → 외곽선 ───────── */
  class Grid {
    constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
    set(x, y, col) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h && col) this.c[y * this.w + x] = col; }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; }
    // 타원 덩어리: 아래·오른쪽은 그림자, 위·왼쪽은 하이라이트
    blob(cx, cy, rx, ry, col, flat) {
      if (!col) return;
      const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1), y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d > 1) continue;
        let c = col;
        if (!flat) {
          const s = dx * 0.55 + dy * 0.85;
          if (s > 0.42 && d > 0.3) c = shade(col, -0.3);
          else if (s < -0.5 && d < 0.55 && d > 0.08) c = shade(col, 0.28);
          if (dx < -0.15 && dy < -0.25 && d < 0.2 && rx > 2.5) c = shade(col, 0.55);
        }
        this.set(x, y, c);
      }
    }
    rect(x, y, w, h, col, shadeIt) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        let c = col;
        if (shadeIt) { if (j === h - 1 || i === w - 1) c = shade(col, -0.3); else if (j === 0 || i === 0) c = shade(col, 0.25); }
        this.set(x + i, y + j, c);
      }
    }
    line(x0, y0, x1, y1, col, th) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (let n = 0; n < 200; n++) {
        if (th && th > 1) this.rect(x0 - (th >> 1), y0 - (th >> 1), th, th, col); else this.set(x0, y0, col);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
      }
    }
    disc(cx, cy, r, col) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, col); }
    // 바깥 테두리: 채워진 칸 옆의 빈칸을 진한 색으로 (이웃 색을 아주 어둡게)
    outline(fixed) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        const n = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1);
        if (n) add.push([x, y, fixed || mix(shade(n, -0.75), '#140a1c', 0.55)]);
      }
      add.forEach(([x, y, c]) => this.set(x, y, c));
      return this;
    }
    toCanvas() {
      const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
      const cx = cv.getContext('2d'), im = cx.createImageData(this.w, this.h);
      for (let i = 0; i < this.c.length; i++) { const c = this.c[i]; if (!c) continue; const [r, g, b] = rgb(c); im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
      cx.putImageData(im, 0, 0); return cv;
    }
  }
  CR.Grid = Grid;
  const cache = new Map();
  function spr(key, w, h, fn, noOutline) {
    if (cache.has(key)) return cache.get(key);
    const g = new Grid(w, h); fn(g); if (!noOutline) g.outline();
    const cv = g.toCanvas(); cache.set(key, cv); return cv;
  }
  CR.spr = spr;
  const urlCache = new Map();
  CR.url = function (cv) { if (!urlCache.has(cv)) urlCache.set(cv, cv.toDataURL()); return urlCache.get(cv); };

  /* ───────── 눈 ───────── */
  function eyes(g, cx, cy, sp, S, look, angry) {
    const big = S >= 28, lx = look ? look[0] : 0, ly = look ? look[1] : 0;
    for (const sx of [-sp, sp]) {
      const x = Math.round(cx + sx), y = Math.round(cy);
      if (big) { g.rect(x - 1, y - 1, 3, 3, '#ffffff'); g.rect(x + (lx > 0 ? 0 : lx < 0 ? -1 : 0), y + (ly > 0 ? 0 : -1) + 1, 2, 2, '#1b1020'); }
      else { g.rect(x - 1, y - 1, 2, 2, '#ffffff'); g.set(x + (lx < 0 ? -1 : 0), y + (ly < 0 ? -1 : 0), '#1b1020'); }
      if (angry) { const ex = sx < 0 ? 1 : -1; g.set(x - 1, y - 2 - (big ? 1 : 0), '#1b1020'); g.set(x, y - 2 - (big ? 1 : 0) + (ex > 0 ? 1 : 0), '#1b1020'); }
    }
  }
  CR.eyes = eyes;

  /* ───────── 병원체 모양 20종 (크기 S = 16·24·32) ───────── */
  const SH = {};
  SH.coccus = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, f = o.f ? 0.06 : 0; g.blob(cx, cy, R * (1 + f), R * (0.95 - f), c); eyes(g, cx, cy - R * 0.1, R * 0.38, S, null, o.angry); };
  SH.cluster = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, r = R * 0.56, b = o.f ? 0.6 : 0;
    g.blob(cx - R * 0.45, cy - R * 0.3 - b, r, r, shade(c, -0.08)); g.blob(cx + R * 0.45, cy - R * 0.3 + b, r, r, shade(c, -0.04)); g.blob(cx, cy + R * 0.38, r * 1.08, r, c); eyes(g, cx, cy + R * 0.35, r * 0.45, S); };
  SH.chain = (g, S, c, o) => { const R = S * 0.36, cy = S / 2 + 1, r = R * 0.45;
    for (let i = 0; i < 3; i++) g.blob(S / 2 + (i - 1) * r * 1.8, cy + ((i + (o.f ? 1 : 0)) % 2 ? -1 : 1), r, r, i === 2 ? c : shade(c, -0.08 * (2 - i)));
    eyes(g, S / 2 + r * 1.8, cy - 1, r * 0.45, S, [1, 0]); };
  SH.rod = (g, S, c, o) => { const R = S * 0.36, cx = S / 2 + 1, cy = S / 2;
    for (let i = 0; i < 3; i++) { const w = o.f ? 1 : -1; g.line(cx - R * 1.05, cy + i - 1, cx - R * 1.5, cy + (i - 1) * 3 + w * (i % 2 ? 2 : -2), shade(c, -0.25)); }
    g.blob(cx, cy, R * 1.05, R * 0.62, c); eyes(g, cx + R * 0.35, cy - 1, R * 0.3, S, [1, 0], o.angry); };
  SH.spiral = (g, S, c, o) => { const R = S * 0.36, ph = o.f ? 0.9 : 0;
    for (let t = 0; t <= 1; t += 0.03) { const x = S / 2 - R * 1.1 + R * 2.2 * t, y = S / 2 + Math.sin(t * Math.PI * 3 + ph) * R * 0.45; g.blob(x, y, S * 0.1, S * 0.1, t > 0.85 ? shade(c, 0.1) : c, true); }
    const hy = S / 2 + Math.sin(Math.PI * 3 + ph) * R * 0.45; eyes(g, S / 2 + R * 0.95, hy - 1, 1.4, S, [1, 0]); };
  SH.virus = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2, c2 = o.c2 || shade(c, 0.35), rot = o.f ? Math.PI / 8 : 0;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + rot; g.line(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12, shade(c, -0.2)); g.blob(cx + Math.cos(a) * R * 1.18, cy + Math.sin(a) * R * 1.18, S * 0.07 + 0.6, S * 0.07 + 0.6, c2, true); }
    g.blob(cx, cy, R * 0.78, R * 0.78, c); eyes(g, cx, cy, R * 0.32, S, null, o.angry); };
  SH.phage = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, hy = S / 2 - R * 0.42, c2 = shade(c, -0.35), lw = o.f ? 1 : 0;
    g.line(cx, hy, cx, S / 2 + R * 0.55, c2, 2);
    for (const s of [-1, 1]) { g.line(cx, S / 2 + R * 0.5, cx + s * R * (0.75 + lw * 0.15), S / 2 + R * 1.05, c2); g.line(cx, S / 2 + R * 0.5, cx + s * R * (0.4 - lw * 0.1), S / 2 + R * 1.1, c2); }
    g.rect(Math.round(cx - R * 0.35), Math.round(S / 2 + R * 0.05), Math.round(R * 0.7), 2, shade(c, -0.15));
    g.blob(cx, hy, R * 0.62, R * 0.55, c); eyes(g, cx, hy, R * 0.26, S); };
  SH.worm = (g, S, c, o) => { const R = S * 0.36, cy = S / 2;
    for (let i = 3; i >= 0; i--) { const r = R * (0.32 + i * 0.07), x = S / 2 - R * 0.95 + i * R * 0.62, y = cy + Math.sin(i * 1.4 + (o.f ? 1.2 : 0)) * R * 0.22; g.blob(x, y, r, r, i === 3 ? c : shade(c, -0.05 * (3 - i))); if (i === 3) eyes(g, x + 0.5, y - 0.5, r * 0.42, S, [1, 0], o.angry); } };
  SH.amoeba = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, r = rng(hashStr(c + S)), sh = o.f ? 0.25 : 0;
    for (let k = 0; k < 4; k++) { const a = r() * 6.28 + sh, d = R * (0.55 + r() * 0.25), pr = R * (0.32 + r() * 0.18); g.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, pr, pr * 0.9, shade(c, -0.05)); }
    g.blob(cx, cy, R * 0.82, R * 0.72, c); g.blob(cx + R * 0.25, cy + R * 0.18, R * 0.25, R * 0.22, shade(c, -0.35), true); eyes(g, cx - R * 0.1, cy - R * 0.2, R * 0.3, S); };
  SH.spore = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1;
    g.blob(cx, cy, R * 0.92, R * 0.85, c);
    for (let y = Math.floor(cy - R * 0.6); y < cy + R * 0.7; y += 3) for (let x = Math.floor(cx - R); x < cx + R; x++) if (g.get(x, y)) g.set(x, y, shade(c, -0.28));
    if (o.open) { g.rect(Math.round(cx - R * 0.6), Math.round(cy - 2), Math.round(R * 1.2), 4, '#2a1630'); eyes(g, cx, cy, R * 0.3, S, null, true); } };
  SH.fungus = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, c2 = o.c2 || '#efe6d2';
    g.rect(Math.round(cx - R * 0.35), Math.round(S / 2), Math.round(R * 0.7), Math.round(R * 0.95), c2, true);
    g.blob(cx, S / 2 - R * 0.05 - (o.f ? 1 : 0), R * 1.05, R * 0.62, c);
    const r = rng(hashStr(c)); for (let k = 0; k < 5; k++) g.disc(Math.round(cx + (r() - 0.5) * R * 1.4), Math.round(S / 2 - R * 0.25 + (r() - 0.5) * R * 0.4), S > 20 ? 1 : 0, shade(c, 0.5));
    eyes(g, cx, S / 2 + R * 0.45, R * 0.22, S); };
  SH.fly = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 2, wh = o.f ? R * 0.35 : R * 0.6, wc = '#dff1ff';
    g.blob(cx - R * 0.55, cy - R * 0.55, R * 0.45, wh, wc, true); g.blob(cx + R * 0.55, cy - R * 0.55, R * 0.45, wh, wc, true);
    g.blob(cx, cy, R * 0.58, R * 0.52, c); eyes(g, cx, cy - 0.5, R * 0.26, S, null, true); };
  SH.cell = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, c2 = o.c2 || shade(c, -0.45), b = o.f ? 0.04 : 0;
    g.blob(cx, cy, R * (1 + b), R * (0.92 - b), c); g.blob(cx + R * 0.28, cy + R * 0.12, R * 0.38, R * 0.3, c2);
    const r = rng(hashStr(c + 'g')); for (let k = 0; k < 4; k++) g.set(Math.round(cx + (r() - 0.5) * R * 1.3), Math.round(cy + (r() - 0.5) * R), shade(c, -0.25));
    eyes(g, cx - R * 0.2, cy - R * 0.3, R * 0.3, S, null, o.angry); };
  SH.protein = (g, S, c, o) => { const R = S * 0.36, r = rng(hashStr(c + 'p') + (o.f ? 7 : 0)); let x = S / 2, y = S / 2;
    for (let k = 0; k < 14; k++) { const nx = Math.max(3, Math.min(S - 4, x + (r() - 0.5) * R)), ny = Math.max(3, Math.min(S - 4, y + (r() - 0.5) * R)); g.line(x, y, nx, ny, k % 3 ? c : shade(c, -0.2), 2); x = nx; y = ny; }
    eyes(g, S / 2, S / 2 - 1, R * 0.3, S, null, true); };
  SH.eye = (g, S, c, o) => { const R = S * 0.38, cx = S / 2, cy = S / 2, lx = o.look ? o.look[0] : 0, ly = o.look ? o.look[1] : 0;
    g.blob(cx, cy, R, R * 0.95, '#f4eef0'); for (let k = 0; k < 5; k++) { const a = k * 1.25; g.line(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9, cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, '#d9455a'); }
    g.blob(cx + lx * R * 0.3, cy + ly * R * 0.3, R * 0.48, R * 0.48, c); g.blob(cx + lx * R * 0.38, cy + ly * R * 0.38, R * 0.22, R * 0.22, '#140a1c', true); g.set(Math.round(cx + lx * R * 0.3 - R * 0.2), Math.round(cy + ly * R * 0.3 - R * 0.25), '#ffffff'); };
  SH.rbc = (g, S, c, o) => { const R = S * 0.38, cx = S / 2, cy = S / 2 + 1; g.blob(cx, cy, R, R * 0.78, c); g.blob(cx, cy, R * 0.45, R * 0.32, shade(c, 0.22), true); };
  SH.tumor = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, r = rng(hashStr(c + 't')), c2 = o.c2 || '#ff5e7a';
    for (let k = 0; k < 6; k++) { const a = r() * 6.28, d = R * r() * 0.55, pr = R * (0.38 + r() * 0.25); g.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d + (o.f ? 0.5 : 0), pr, pr * 0.92, shade(c, (r() - 0.5) * 0.2)); }
    for (let k = 0; k < 3; k++) { const a = r() * 6.28; g.line(cx, cy, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, c2); }
    eyes(g, cx, cy - R * 0.15, R * 0.32, S, null, true); if (S >= 24) eyes(g, cx, cy + R * 0.35, R * 0.15, 16); };
  SH.golem = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, c2 = o.c2 || '#ffe680', y = o.f ? 1 : 0;
    g.rect(Math.round(cx - R), Math.round(S / 2 - R * 0.3 + y), Math.round(R * 2), Math.round(R * 1.2), c, true);
    g.rect(Math.round(cx - R * 0.6), Math.round(S / 2 - R * 1.05 + y), Math.round(R * 1.2), Math.round(R * 0.8), shade(c, 0.1), true);
    g.rect(Math.round(cx - R * 1.25), Math.round(S / 2 - R * 0.1 + y), Math.round(R * 0.35), Math.round(R * 0.9), shade(c, -0.12), true);
    g.rect(Math.round(cx + R * 0.9), Math.round(S / 2 - R * 0.1 + y), Math.round(R * 0.35), Math.round(R * 0.9), shade(c, -0.12), true);
    g.rect(Math.round(cx - R * 0.4), Math.round(S / 2 - R * 0.75 + y), 2, 2, c2); g.rect(Math.round(cx + R * 0.2), Math.round(S / 2 - R * 0.75 + y), 2, 2, c2); };
  SH.clot = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2 + 1, r = rng(hashStr(c + 'c'));
    for (let k = 0; k < 4; k++) { const a = r() * 6.28; g.line(cx, cy, cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1, '#e8d6a0'); }
    for (let k = 0; k < 5; k++) { const a = k * 1.26 + (o.f ? 0.3 : 0), d = R * 0.42; g.blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * 0.45, R * 0.42, shade(c, (k % 2) * -0.1)); }
    g.blob(cx, cy, R * 0.5, R * 0.48, c); eyes(g, cx, cy - 0.5, R * 0.28, S, null, true); };
  SH.centriole = (g, S, c, o) => { const R = S * 0.36, cx = S / 2, cy = S / 2;
    g.rect(Math.round(cx - R), Math.round(cy - R * 0.32), Math.round(R * 2), Math.round(R * 0.64), c, true);
    g.rect(Math.round(cx - R * 0.32), Math.round(cy - R), Math.round(R * 0.64), Math.round(R * 2), shade(c, -0.08), true);
    for (let k = -2; k <= 2; k++) { g.set(Math.round(cx + k * R * 0.38), Math.round(cy), shade(c, -0.35)); g.set(Math.round(cx), Math.round(cy + k * R * 0.38), shade(c, -0.35)); }
    eyes(g, cx, cy, 1.5, S, null, true); };
  SH.pair = (g, S, c, o) => { const R = S * 0.36, cy = S / 2 + 1; g.blob(S / 2 - R * 0.48, cy, R * 0.55, R * 0.62, c); g.blob(S / 2 + R * 0.48, cy, R * 0.55, R * 0.62, shade(c, -0.06)); eyes(g, S / 2, cy - 1, R * 0.48, S, null, o.angry); };
  CR.SHAPES = Object.keys(SH);

  // 병원체·보스 그림 (2프레임)
  CR.mob = function (shape, S, col, opt, frame) {
    opt = opt || {}; const key = 'm|' + shape + '|' + S + '|' + col + '|' + (opt.c2 || '') + '|' + (opt.open ? 1 : 0) + '|' + (opt.angry ? 1 : 0) + '|' + (opt.crown ? 1 : 0) + '|' + (opt.look || '') + '|' + frame;
    return spr(key, S, S, g => {
      (SH[shape] || SH.coccus)(g, S, col, Object.assign({ f: frame }, opt));
      if (opt.crown) { const cx = S / 2, y = 2; g.rect(cx - 5, y + 2, 11, 3, '#f5c542', true); [-5, -1, 3].forEach((dx, i) => g.rect(cx + dx, y + (i === 1 ? -1 : 0), 3, 3, '#f5c542')); g.set(cx - 1, y + 3, '#e2406a'); g.set(cx + 3, y + 3, '#4ac0ff'); }
    });
  };

  /* ───────── 아이템 아이콘 (16x16) ───────── */
  const GL = {};
  GL.pill = (g, c, c2) => { for (let i = 0; i < 9; i++) { const x = 3 + i, y = 11 - i; g.disc(x, y, 2, i < 4 ? c : (c2 || '#ffffff')); } };
  GL.capsule = (g, c, c2) => { g.blob(5.5, 8, 3.5, 3.5, c); g.blob(10.5, 8, 3.5, 3.5, c2 || '#fff'); g.rect(5, 5, 6, 7, c); g.rect(8, 5, 3, 7, c2 || '#fff'); };
  GL.syringe = (g, c) => { g.line(3, 13, 6, 10, '#c9d6e3', 1); g.line(5, 11, 11, 5, '#e9f2fb', 3); g.line(6, 10, 10, 6, c, 2); g.line(11, 5, 13, 3, '#8a9bb0', 1); g.rect(10, 2, 2, 2, '#8a9bb0'); g.rect(13, 5, 2, 2, '#8a9bb0'); };
  GL.dna = (g, c, c2) => { for (let y = 1; y < 15; y++) { const a = y * 0.6, x1 = 8 + Math.sin(a) * 4, x2 = 8 - Math.sin(a) * 4; g.set(x1, y, c); g.set(x2, y, c2 || shade(c, 0.4)); if (y % 3 === 0) g.line(x1, y, x2, y, '#e8e8f0'); } };
  GL.mito = (g, c) => { g.blob(8, 8, 6.5, 4.2, c); for (let x = 4; x <= 12; x += 2) g.line(x, 6 + (x % 4 ? 0 : 1), x, 10 - (x % 4 ? 0 : 1), shade(c, 0.45)); };
  GL.crystal = (g, c) => { for (let y = 0; y < 13; y++) { const w = y < 5 ? y + 1 : 13 - y; for (let x = -w; x <= w; x++) g.set(8 + x * 0.6, 1.5 + y, x < 0 ? shade(c, 0.3) : (x === 0 ? shade(c, 0.6) : c)); } };
  GL.ring = (g, c) => { for (let a = 0; a < 6.28; a += 0.1) { g.set(8 + Math.cos(a) * 5.5, 8 + Math.sin(a) * 5.5, c); g.set(8 + Math.cos(a) * 4.5, 8 + Math.sin(a) * 4.5, shade(c, 0.3)); } g.blob(8, 3, 2, 2, '#ffffff'); };
  GL.heart = (g, c) => { g.blob(5.5, 6.5, 3.5, 3.5, c); g.blob(10.5, 6.5, 3.5, 3.5, c); for (let y = 7; y < 14; y++) { const w = 13 - y; for (let x = -w; x <= w; x++) g.set(8 + x * 0.85, y, c); } g.set(5, 5, '#ffffff'); };
  GL.eye = (g, c) => { g.blob(8, 8, 6.5, 4.5, '#f4f0f2'); g.blob(8, 8, 3, 3, c); g.blob(8, 8, 1.4, 1.4, '#140a1c', true); g.set(7, 7, '#fff'); };
  GL.shield = (g, c) => { for (let y = 2; y < 14; y++) { const w = y < 9 ? 5.5 : 5.5 - (y - 8) * 1.1; for (let x = -w; x <= w; x++) g.set(8 + x, y, x < 0 ? shade(c, 0.2) : c); } g.line(8, 4, 8, 11, shade(c, 0.6)); g.line(5, 7, 11, 7, shade(c, 0.6)); };
  GL.bolt = (g, c) => { const p = [[10, 1], [4, 9], [8, 9], [6, 15], [12, 6], [8, 6], [10, 1]]; for (let i = 0; i < p.length - 1; i++) g.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], c, 2); g.blob(8, 8, 1.5, 3, c, true); };
  GL.drop = (g, c) => { g.blob(8, 10, 4.5, 4.2, c); for (let y = 2; y < 9; y++) { const w = (y - 2) * 0.6; for (let x = -w; x <= w; x++) g.set(8 + x, y, c); } g.set(6, 9, '#fff'); };
  GL.flask = (g, c) => { g.rect(6, 1, 4, 5, '#d8e6f2'); for (let y = 6; y < 14; y++) { const w = 1.5 + (y - 6) * 0.7; for (let x = -w; x <= w; x++) g.set(8 + x, y, y > 8 ? c : '#d8e6f2'); } g.set(7, 10, '#fff'); };
  GL.gear = (g, c) => { for (let k = 0; k < 8; k++) { const a = k * 0.785; g.rect(Math.round(8 + Math.cos(a) * 5.5) - 1, Math.round(8 + Math.sin(a) * 5.5) - 1, 3, 3, c); } g.blob(8, 8, 5, 5, c); g.blob(8, 8, 2, 2, '#2a2433', true); };
  GL.leaf = (g, c) => { for (let t = 0; t < 1; t += 0.05) { const w = Math.sin(t * Math.PI) * 4.5; for (let s = -w; s <= w; s++) g.set(3 + t * 10 + s * 0.6, 13 - t * 10 + s * 0.6, s < 0 ? shade(c, 0.25) : c); } g.line(3, 13, 12, 4, shade(c, -0.3)); };
  GL.star = (g, c) => { for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 1.2566; g.line(8, 8.5, 8 + Math.cos(a) * 6.5, 8.5 + Math.sin(a) * 6.5, c, 2); } g.blob(8, 8.5, 3, 3, shade(c, 0.3)); };
  GL.blade = (g, c) => { g.line(2, 14, 7, 9, '#7d5a3c', 2); g.line(7, 9, 14, 2, '#e3eaf2', 2); g.line(8, 9, 14, 3, '#9fb0c2', 1); };
  GL.forceps = (g, c) => { g.line(3, 14, 12, 2, '#d5dde6', 1); g.line(6, 14, 13, 4, '#b8c4d0', 1); g.blob(4, 13, 2, 2, c); g.blob(7, 13, 2, 2, c); };
  GL.scissors = (g, c) => { g.line(4, 3, 12, 11, '#e0e8f0', 2); g.line(12, 3, 4, 11, '#c9d3dd', 2); g.blob(4, 13, 2.2, 2.2, c); g.blob(12, 13, 2.2, 2.2, c); };
  GL.needle = (g, c) => { for (let a = 0; a < 3.4; a += 0.1) g.set(8 + Math.cos(a) * 5, 8 - Math.sin(a) * 5, '#dfe7ef'); g.line(3, 8, 3, 14, c); g.line(13, 8, 12, 5, '#8fa0b2'); };
  GL.saw = (g, c) => { g.rect(2, 6, 12, 4, '#cfd8e1', true); for (let x = 2; x < 14; x += 2) g.set(x, 10, '#8f9fae'); g.rect(1, 4, 3, 7, c, true); };
  GL.clamp = (g, c) => { g.line(4, 2, 8, 10, '#d0d9e3', 2); g.line(12, 2, 8, 10, '#d0d9e3', 2); g.disc(5, 13, 2, c); g.disc(11, 13, 2, c); g.line(6, 12, 10, 12, '#8aa'); };
  GL.scope = (g, c) => { for (let a = 0; a < 3.2; a += 0.1) g.set(8 + Math.cos(a) * 5, 6 - Math.sin(a) * 4, '#4a4a58'); g.line(3, 6, 6, 12, '#4a4a58'); g.line(13, 6, 10, 12, '#4a4a58'); g.blob(8, 13, 2.5, 2, c); };
  GL.card = (g, c) => { g.rect(3, 1, 10, 14, '#f4f1e8', true); g.rect(3, 1, 10, 3, c); for (let y = 6; y < 13; y += 2) g.line(5, y, 11, y, '#a9b3c0'); g.line(9, 9, 11, 9, '#e2406a'); g.line(10, 8, 10, 10, '#e2406a'); };
  GL.bomb = (g, c) => { g.blob(8, 9.5, 5, 5, c || '#8a5cf0'); g.line(10, 4, 12, 2, '#c7a46b'); g.set(13, 1, '#ffd34d'); g.set(6, 7, '#fff'); };
  GL.key = (g, c) => { g.disc(5, 5, 3, c || '#f2c94c'); g.disc(5, 5, 1, '#2a2030'); g.line(7, 7, 13, 13, c || '#f2c94c', 2); g.line(11, 13, 13, 11, c || '#f2c94c'); g.line(9, 11, 11, 9, c || '#f2c94c'); };
  GL.coin = (g, c) => { g.blob(8, 8, 5.5, 5.5, c || '#f5c542'); g.line(6, 11, 8, 5, '#a8741a'); g.line(8, 5, 10, 11, '#a8741a'); g.line(7, 9, 9, 9, '#a8741a'); };
  GL.cell = (g, c) => { g.blob(8, 8, 6.5, 6, c); g.blob(9, 9, 2.5, 2.2, shade(c, -0.45)); };
  GL.virus = (g, c) => { for (let k = 0; k < 8; k++) { const a = k * 0.785; g.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, shade(c, -0.2)); } g.blob(8, 8, 4.5, 4.5, c); };
  GL.wing = (g, c) => { for (let k = 0; k < 4; k++) g.blob(5 + k * 2, 6 + k * 1.6, 4 - k * 0.5, 2.2, k % 2 ? shade(c, 0.3) : c); };
  GL.halo = (g, c) => { for (let a = 0; a < 6.28; a += 0.08) { g.set(8 + Math.cos(a) * 6, 6 + Math.sin(a) * 2.5, c); g.set(8 + Math.cos(a) * 5, 6 + Math.sin(a) * 2, shade(c, 0.4)); } g.blob(8, 12, 2.5, 2.5, shade(c, 0.5)); };
  GL.orb = (g, c) => { g.blob(8, 8, 5.5, 5.5, c); g.blob(8, 8, 3, 3, shade(c, 0.4), true); g.set(6, 5, '#fff'); };
  GL.beam = (g, c) => { g.rect(1, 6, 14, 4, c); g.rect(1, 7, 14, 2, shade(c, 0.6)); g.blob(2, 8, 2.5, 3, '#fff'); };
  GL.lung = (g, c) => { g.blob(5, 9, 3.5, 5, c); g.blob(11, 9, 3.5, 5, c); g.line(8, 1, 8, 6, '#e8d6d6', 2); g.line(8, 6, 5, 7, '#e8d6d6'); g.line(8, 6, 11, 7, '#e8d6d6'); };
  GL.neuron = (g, c) => { g.blob(6, 7, 3.5, 3.5, c); for (let k = 0; k < 4; k++) { const a = 2 + k * 0.9; g.line(6, 7, 6 + Math.cos(a) * 6, 7 + Math.sin(a) * 6, shade(c, -0.15)); } g.line(8, 9, 14, 14, shade(c, -0.15)); g.set(14, 14, '#fff'); };
  GL.bone = (g, c) => { g.line(4, 12, 12, 4, '#eee6d4', 2); g.disc(3, 12, 1, '#eee6d4'); g.disc(4, 13, 1, '#eee6d4'); g.disc(12, 3, 1, '#eee6d4'); g.disc(13, 4, 1, '#eee6d4'); };
  GL.lamp = (g, c) => { g.blob(8, 5, 6, 3.5, '#cfd8e1'); g.line(8, 8, 8, 14, '#8a96a3'); g.blob(8, 6, 3, 1.5, c, true); };
  GL.mask = (g, c) => { g.blob(8, 9, 5.5, 4.5, c); g.line(2, 8, 4, 7, '#e8e8e8'); g.line(14, 8, 12, 7, '#e8e8e8'); g.line(6, 9, 10, 9, shade(c, -0.3)); };
  GL.bag = (g, c) => { g.rect(4, 3, 8, 10, c, true); g.rect(5, 4, 3, 3, shade(c, 0.4)); g.line(8, 13, 8, 15, '#d8d8e0'); g.rect(7, 1, 2, 2, '#d8d8e0'); };
  GL.dish = (g, c) => { g.blob(8, 9, 6.5, 3.5, '#dbe9f2'); g.blob(8, 9, 5, 2.4, c, true); g.set(6, 9, shade(c, 0.5)); g.set(10, 8, shade(c, 0.5)); };
  GL.micro = (g, c) => { g.line(6, 2, 9, 9, c, 2); g.rect(4, 13, 9, 2, '#6b7280', true); g.line(10, 6, 11, 13, '#6b7280', 2); g.rect(5, 1, 3, 2, '#9ca3af'); };
  GL.chip = (g, c) => { g.rect(4, 4, 8, 8, c, true); for (let k = 0; k < 3; k++) { g.set(3, 5 + k * 2, '#cfcfcf'); g.set(12, 5 + k * 2, '#cfcfcf'); g.set(5 + k * 2, 3, '#cfcfcf'); g.set(5 + k * 2, 12, '#cfcfcf'); } };
  GL.thermo = (g, c) => { g.rect(7, 1, 3, 11, '#e8eef4'); g.rect(8, 5, 1, 7, c); g.blob(8.5, 13, 2.5, 2.5, c); };
  GL.drill = (g, c) => { g.rect(2, 6, 6, 5, c, true); g.line(8, 8, 14, 8, '#cfd8e1', 2); g.set(14, 7, '#8a96a3'); };
  GL.loop = (g, c) => { g.line(2, 14, 10, 6, '#c0c8d0', 1); for (let a = 0; a < 6.28; a += 0.2) g.set(11.5 + Math.cos(a) * 2.5, 4.5 + Math.sin(a) * 2.5, c); };
  GL.gloves = (g, c) => { g.blob(8, 10, 4.5, 4.5, c); for (let k = 0; k < 4; k++) g.rect(4 + k * 2.2, 3 + (k === 0 ? 3 : 0), 2, 6, c); };
  CR.GLYPHS = Object.keys(GL);
  CR.icon = function (glyph, col, col2) {
    return spr('i|' + glyph + '|' + col + '|' + (col2 || ''), 16, 16, g => (GL[glyph] || GL.orb)(g, col, col2));
  };

  /* ───────── 플레이어: 면역 백혈구 (몸통 4방향 걷기 + 머리 4방향 쏘기 반동) ───────── */
  CR.playerHead = function (dir, shoot, tint) {
    const col = tint || '#f3f4ff';
    return spr('ph|' + dir + '|' + (shoot ? 1 : 0) + '|' + col, 16, 14, g => {
      const sq = shoot ? 0.86 : 1;
      g.blob(8, 7.5 + (shoot ? 0.6 : 0), 6.6 * (shoot ? 1.06 : 1), 5.8 * sq, col);
      // 분엽핵(보라 점)이 비쳐 보임
      const nuc = shade('#9b7fd6', 0.1);
      if (dir === 'up') { [[5, 6], [8, 5], [11, 6], [6, 9], [10, 9]].forEach(([x, y]) => g.disc(x, y, 1, nuc)); }
      else {
        const lk = { down: [0, 1], left: [-1, 0], right: [1, 0] }[dir], ex = 8 + lk[0] * 2, ey = 8 + (shoot ? 1 : 0);
        g.disc(ex + (lk[0] ? -lk[0] * 3 : -2.5), ey - 3, 1, nuc);
        if (dir === 'down') { eyes(g, ex, ey, 2.5, 16, [0, 1]); if (!shoot) g.set(8, ey + 2, '#e58fa0'); }
        else { eyes(g, ex + lk[0] * 1.5, ey, 1.6, 16, lk); }
      }
    });
  };
  CR.playerBody = function (dir, frame, tint) {
    const col = tint || '#e6e8f8';
    return spr('pb|' + dir + '|' + frame + '|' + col, 12, 8, g => {
      g.blob(6, 3.5, 4, 3, col);
      const f = frame % 2;
      if (dir === 'left' || dir === 'right') { g.rect(3 + f * 2, 6, 2, 2, shade(col, -0.2)); g.rect(7 - f * 2, 6, 2, 2, shade(col, -0.25)); }
      else { g.rect(3, 6 - f, 2, 2, shade(col, -0.2)); g.rect(7, 5 + f, 2, 2, shade(col, -0.2)); }
    });
  };

  /* ───────── 줍는 물건 ───────── */
  CR.pickup = function (kind, f) {
    return spr('pk|' + kind + '|' + (f || 0), 12, 12, g => {
      const b = f ? 1 : 0;
      if (kind === 'coin') { g.blob(6, 6 - b * 0.5, 4.5 - b, 4.5, '#f5c542'); g.line(5, 8, 6, 4, '#a8741a'); g.line(6, 4, 7, 8, '#a8741a'); }
      else if (kind === 'bomb') { g.blob(6, 7, 4, 4, '#8a5cf0'); g.line(7, 3, 9, 1, '#c7a46b'); g.set(10, 0, b ? '#ffd34d' : '#ff8c42'); g.set(4, 5, '#fff'); }
      else if (kind === 'key') { g.disc(4, 4, 2, '#f2c94c'); g.set(4, 4, '#3a2a10'); g.line(5, 5, 10, 10, '#f2c94c'); g.line(8, 10, 10, 8, '#f2c94c'); }
      else if (kind === 'heart' || kind === 'half') { g.blob(4, 5, 2.8, 2.8, '#e8344e'); if (kind !== 'half') g.blob(8, 5, 2.8, 2.8, '#e8344e'); for (let y = 6; y < 11; y++) { const w = 10 - y; for (let x = -w; x <= (kind === 'half' ? 0 : w); x++) g.set(6 + x * 0.9, y, '#e8344e'); } g.set(3, 4, '#ffc0c8'); }
      else if (kind === 'shield') { g.blob(4, 5, 2.8, 2.8, '#5fb8ff'); g.blob(8, 5, 2.8, 2.8, '#5fb8ff'); for (let y = 6; y < 11; y++) { const w = 10 - y; for (let x = -w; x <= w; x++) g.set(6 + x * 0.9, y, '#5fb8ff'); } g.set(3, 4, '#e0f3ff'); }
      else if (kind === 'chart') { g.rect(2, 1, 8, 10, '#f4f1e8', true); g.rect(2, 1, 8, 2, '#4a8cff'); g.line(4, 5, 8, 5, '#9aa'); g.line(4, 7, 8, 7, '#9aa'); }
      else if (kind === 'hormone') { for (let i = 0; i < 6; i++) g.disc(3 + i, 8 - i, 1.5, i < 3 ? '#ff7aa8' : '#ffffff'); }
      else if (kind === 'chest') { g.rect(1, 3, 10, 7, '#8a5a2b', true); g.rect(1, 3, 10, 3, '#a8743a', true); g.rect(5, 5, 2, 2, '#f5c542'); }
    });
  };

  /* ───────── 도트 글꼴 3x5 (숫자·영문·기호) ───────── */
  const FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101',
    N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
    ':': '000010000010000', '.': '000000000000010', '+': '000010111010000', '-': '000000111000000', '%': '101001010100101', '/': '001001010100100', 'x': '000101010101000', '!': '010010010000010', '?': '111001010000010', ' ': '000000000000000', '(': '010100100100010', ')': '010001001001010', ',': '000000000010100',
  };
  CR.textW = (s, sc) => s.length * 4 * (sc || 1) - (sc || 1);
  CR.text = function (ctx, str, x, y, col, sc, shadowCol) {
    sc = sc || 1; str = String(str).toUpperCase();
    const draw = (ox, oy, c) => {
      ctx.fillStyle = c;
      for (let i = 0; i < str.length; i++) { const f = FONT[str[i]] || FONT['?']; for (let p = 0; p < 15; p++) if (f[p] === '1') ctx.fillRect(Math.round(x + ox + (i * 4 + (p % 3)) * sc), Math.round(y + oy + Math.floor(p / 3) * sc), sc, sc); }
    };
    if (shadowCol !== false) draw(sc, sc, shadowCol || '#140a1c');
    draw(0, 0, col || '#ffffff');
  };

  /* ───────── 소리: 효과음 합성 + 구역별 배경 음악 ───────── */
  const AU = CR.audio = { ctx: null, on: true, music: true, master: null, sfxG: null, musG: null, noise: null, track: null };
  try { const v = localStorage.getItem('cellRaidAudio'); if (v) { const o = JSON.parse(v); AU.on = o.on !== false; AU.music = o.music !== false; } } catch (e) {}
  AU.save = () => { try { localStorage.setItem('cellRaidAudio', JSON.stringify({ on: AU.on, music: AU.music })); } catch (e) {} };
  AU.init = function () {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { AU.ctx = new AC(); } catch (e) { return; }
    const c = AU.ctx, comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    AU.master = c.createGain(); AU.master.gain.value = AU.on ? 0.8 : 0; AU.master.connect(comp);
    AU.sfxG = c.createGain(); AU.sfxG.gain.value = 0.55; AU.sfxG.connect(AU.master);
    AU.musG = c.createGain(); AU.musG.gain.value = AU.music ? 0.16 : 0; AU.musG.connect(AU.master);
    AU.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = AU.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(AU.tick, 90);
  };
  AU.apply = () => { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.master.gain.setTargetAtTime(AU.on ? 0.8 : 0, t, 0.05); AU.musG.gain.setTargetAtTime(AU.music ? 0.16 : 0, t, 0.2); AU.save(); };
  function tone(t, type, f0, f1, dur, vol, bus, q) {
    const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || AU.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, ftype, f0, f1, bus) {
    const c = AU.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.noise; s.loop = true;
    f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(f0 || 2000, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || AU.sfxG); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const last = {};
  const SFX = {
    shoot: t => { tone(t, 'sine', 520 + Math.random() * 80, 900, 0.07, 0.12); noise(t, 0.04, 0.04, 'highpass', 3000); },
    hit: t => { noise(t, 0.06, 0.14, 'bandpass', 1800, 600); tone(t, 'square', 300, 160, 0.05, 0.04); },
    tink: t => { tone(t, 'triangle', 1400, 1000, 0.05, 0.06); },
    edie: t => { tone(t, 'sawtooth', 340, 60, 0.22, 0.1); noise(t, 0.18, 0.16, 'lowpass', 2500, 300); },
    hurt: t => { tone(t, 'square', 260, 90, 0.25, 0.14); noise(t, 0.12, 0.12, 'lowpass', 1500, 400); },
    coin: t => { tone(t, 'square', 1320, 1320, 0.06, 0.06); tone(t + 0.06, 'square', 1980, 1980, 0.12, 0.06); },
    heart: t => { [523, 659, 784].forEach((f, i) => tone(t + i * 0.05, 'triangle', f, f, 0.12, 0.12)); },
    shield: t => { [659, 988, 1319].forEach((f, i) => tone(t + i * 0.05, 'sine', f, f, 0.16, 0.12)); },
    key: t => { tone(t, 'triangle', 880, 1760, 0.12, 0.1); },
    bombpick: t => { tone(t, 'square', 200, 400, 0.1, 0.08); },
    item: t => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.07, 'square', f, f, 0.18, 0.07)); [1047, 1319, 1568].forEach(f => tone(t + 0.36, 'triangle', f, f, 0.5, 0.06)); },
    bad: t => { [400, 300, 220].forEach((f, i) => tone(t + i * 0.1, 'square', f, f * 0.9, 0.14, 0.08)); },
    door: t => { tone(t, 'triangle', 180, 120, 0.18, 0.12); noise(t, 0.12, 0.06, 'lowpass', 800); },
    clear: t => { [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.08, 'square', f, f, 0.16, 0.06)); },
    fuse: t => { noise(t, 0.2, 0.05, 'highpass', 4000); },
    boom: t => { noise(t, 0.6, 0.4, 'lowpass', 1200, 80); tone(t, 'sine', 120, 35, 0.5, 0.35); },
    laser: t => { tone(t, 'sawtooth', 900, 300, 0.35, 0.06); tone(t, 'square', 1800, 600, 0.3, 0.03); },
    charge: t => { tone(t, 'sine', 300, 900, 0.3, 0.05); },
    boss: t => { tone(t, 'sawtooth', 110, 55, 0.9, 0.14); noise(t, 0.8, 0.12, 'lowpass', 600, 120); tone(t + 0.1, 'square', 82, 41, 0.8, 0.08); },
    eshot: t => { tone(t, 'triangle', 420, 260, 0.08, 0.05); },
    zap: t => { for (let i = 0; i < 4; i++) tone(t + i * 0.03, 'square', 1200 - i * 200, 400, 0.05, 0.05); noise(t, 0.15, 0.08, 'highpass', 2500); },
    freeze: t => { [1568, 2093, 2637].forEach((f, i) => tone(t + i * 0.04, 'sine', f, f * 0.8, 0.3, 0.06)); noise(t, 0.3, 0.05, 'highpass', 5000); },
    heal: t => { [523, 784, 1047, 1568].forEach((f, i) => tone(t + i * 0.06, 'sine', f, f, 0.25, 0.08)); },
    power: t => { tone(t, 'sawtooth', 150, 600, 0.35, 0.08); tone(t + 0.1, 'square', 300, 1200, 0.3, 0.05); },
    menu: t => { tone(t, 'square', 660, 660, 0.04, 0.05); },
    stairs: t => { [784, 659, 523, 392, 330].forEach((f, i) => tone(t + i * 0.08, 'triangle', f, f, 0.16, 0.1)); },
    win: t => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.12, 'square', f, f, 0.22, 0.07)); },
    die: t => { [440, 392, 349, 294, 220].forEach((f, i) => tone(t + i * 0.16, 'triangle', f, f * 0.98, 0.3, 0.12)); },
  };
  const GAP = { shoot: 0.045, hit: 0.03, eshot: 0.04, tink: 0.03, edie: 0.03 };
  AU.sfx = function (name) {
    if (!AU.ctx || !AU.on || AU.ctx.state !== 'running') return;
    const t = AU.ctx.currentTime; if (GAP[name] && last[name] && t - last[name] < GAP[name]) return; last[name] = t;
    try { (SFX[name] || SFX.menu)(t + 0.005); } catch (e) {}
  };

  // 배경 음악: 구역마다 음계·빠르기·분위기가 다른 칩튠 루프 (보스방은 더 빠르고 긴박하게)
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], major: [0, 2, 4, 5, 7, 9, 11], lyd: [0, 2, 4, 6, 7, 9, 11] };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let seq = null;
  AU.play = function (track) {   // track: {root, scale, bpm, prog:[deg..], seed, intense}
    if (!track) { seq = null; return; }
    const key = JSON.stringify(track); if (seq && seq.key === key) return;
    const r = rng(track.seed || 1), sc = SCALES[track.scale] || SCALES.minor;
    const mel = []; for (let b = 0; b < 4; b++) { const bar = []; let d = 4 + Math.floor(r() * 3); for (let s = 0; s < 8; s++) { if (r() < (track.intense ? 0.75 : 0.55)) { d += Math.floor(r() * 5) - 2; d = Math.max(0, Math.min(11, d)); bar.push(d); } else bar.push(null); } mel.push(bar); }
    seq = { key, t: track, sc, mel, step: 0, next: AU.ctx ? AU.ctx.currentTime + 0.1 : 0 };
  };
  AU.tick = function () {
    if (!AU.ctx || !seq || !AU.music || !AU.on || AU.ctx.state !== 'running') { if (seq && AU.ctx) seq.next = AU.ctx.currentTime + 0.1; return; }
    const c = AU.ctx, T = seq.t, sd = 60 / T.bpm / 2, ahead = c.currentTime + 0.3, B = AU.musG;
    if (seq.next < c.currentTime) seq.next = c.currentTime + 0.05;
    const dg = d => T.root + 12 * Math.floor(d / 7) + seq.sc[((d % 7) + 7) % 7];
    while (seq.next < ahead) {
      const t = seq.next, s = seq.step % 8, bar = Math.floor(seq.step / 8) % 4, ch = T.prog[bar % T.prog.length];
      // 베이스
      if (s % 2 === 0) tone(t, 'triangle', mtof(dg(ch + (s === 4 ? 4 : 0)) - 24), null, sd * 1.8, 0.5, B);
      // 아르페지오
      const arp = [0, 2, 4, 7][s % 4]; tone(t, 'square', mtof(dg(ch + arp)), null, sd * 0.9, T.intense ? 0.08 : 0.06, B);
      // 선율 (8마디마다 반복)
      const m = seq.mel[bar][s]; if (m !== null && (Math.floor(seq.step / 32) % 2 === 1 || T.intense)) tone(t, 'triangle', mtof(dg(m + ch) + 12), null, sd * 1.6, 0.18, B);
      // 북
      if (s === 0 || s === 4 || (T.intense && s === 6)) { tone(t, 'sine', 140, 40, 0.18, 0.6, B); }
      if (s === 2 || s === 6) noise(t, 0.09, 0.12, 'bandpass', 1800, 900, B);
      noise(t, 0.03, T.intense ? 0.08 : 0.05, 'highpass', 7000, null, B);
      seq.step++; seq.next += sd;
    }
  };

  /* ───────── 입력: 키보드 · 마우스 · 터치 양손 스틱 ───────── */
  const IN = CR.input = { keys: {}, pressed: {}, mouse: { x: 0, y: 0, down: false, inside: false }, stickL: null, stickR: null, touch: false, lastMouseMove: 0 };
  const PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Tab'];
  addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (PREVENT.includes(e.key)) e.preventDefault();
    if (!IN.keys[k]) IN.pressed[k] = true; IN.keys[k] = true; AU.init();
  });
  addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; IN.keys[k] = false; });
  addEventListener('blur', () => { IN.keys = {}; IN.mouse.down = false; });
  IN.take = k => { if (IN.pressed[k]) { IN.pressed[k] = false; return true; } return false; };
  IN.clearPressed = () => { IN.pressed = {}; };
  CR.bindCanvas = function (cv, W, H) {
    const pos = e => { const r = cv.getBoundingClientRect(); IN.mouse.x = (e.clientX - r.left) / r.width * W; IN.mouse.y = (e.clientY - r.top) / r.height * H; };
    cv.addEventListener('mousemove', e => { pos(e); IN.lastMouseMove = performance.now(); });
    cv.addEventListener('mousedown', e => { if (e.button === 0) { pos(e); IN.mouse.down = true; AU.init(); } });
    addEventListener('mouseup', () => { IN.mouse.down = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  };
  // 터치: 화면 왼쪽 절반 = 이동 스틱, 오른쪽 절반 = 조준·발사 스틱 (손가락을 댄 곳에 생김)
  CR.bindTouch = function (layer, knobs) {
    const sticks = {};
    const start = e => {
      IN.touch = true; AU.init();
      for (const t of e.changedTouches) {
        if (t.target.closest && t.target.closest('[data-act],.no-stick')) continue;
        const side = t.clientX < innerWidth / 2 ? 'L' : 'R';
        if (Object.values(sticks).some(s => s.side === side)) continue;
        sticks[t.identifier] = { side, ox: t.clientX, oy: t.clientY, x: 0, y: 0 };
        const k = knobs[side]; k.base.style.display = 'block'; k.base.style.left = t.clientX + 'px'; k.base.style.top = t.clientY + 'px'; k.knob.style.transform = 'translate(-50%,-50%)';
      }
      upd(); if (Object.keys(sticks).length) e.preventDefault();
    };
    const move = e => {
      for (const t of e.changedTouches) {
        const s = sticks[t.identifier]; if (!s) continue;
        const R = Math.min(60, innerWidth * 0.08 + 20); let dx = t.clientX - s.ox, dy = t.clientY - s.oy; const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        s.x = dx / R; s.y = dy / R; knobs[s.side].knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      upd(); e.preventDefault();
    };
    const end = e => { for (const t of e.changedTouches) { const s = sticks[t.identifier]; if (!s) continue; knobs[s.side].base.style.display = 'none'; delete sticks[t.identifier]; } upd(); };
    function upd() { IN.stickL = null; IN.stickR = null; for (const s of Object.values(sticks)) { const v = { x: s.x, y: s.y }; if (s.side === 'L') IN.stickL = v; else IN.stickR = v; } }
    layer.addEventListener('touchstart', start, { passive: false }); layer.addEventListener('touchmove', move, { passive: false });
    layer.addEventListener('touchend', end); layer.addEventListener('touchcancel', end);
  };
})();

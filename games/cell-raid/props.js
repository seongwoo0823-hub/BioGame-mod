// 생물의 번제 — 부서지는 장애물: 노폐물 덩어리 · 염증 불씨 · 고름 주머니 · 효소 결정(폭탄 전용)
(function () {
  'use strict';
  const CR = window.CR, T = CR.T, COLS = CR.COLS, ROWS = CR.ROWS, sh = CR.shade;
  // 타일 번호: 5 노폐물 덩어리 · 6 염증 불씨 · 8 고름 주머니 · 9 효소 결정
  const DEF = {
    5: { name: '노폐물 덩어리', hp: 3, desc: '눈물로 3번 맞히면 부서져요. 가끔 코인·폭탄·하트가 나와요' },
    6: { name: '염증 불씨', hp: 3, desc: '닿으면 데요! 눈물로 3번 맞히면 꺼지고, 가끔 코인·하트가 나와요' },
    8: { name: '고름 주머니', hp: 2, desc: '맞히면 터져요 — 주변을 폭발시키니 떨어져서 쏘세요' },
    9: { name: '효소 결정', hp: 1, bombOnly: true, desc: '폭탄으로만 깨져요. 깨면 아이템이나 물건 여러 개가 나와요' },
  };
  CR.PROPS = DEF;
  CR.isBreak = v => v === 5 || v === 6 || v === 8 || v === 9;

  /* ───────── 배치: 일반 방에 확률적으로 (가운데 십자 통로·문 앞은 비움) ───────── */
  CR.placeProps = function (room, stage, rnd) {
    if (room.type !== 'normal') return;
    const t = room.tiles, free = [];
    for (let y = 2; y <= ROWS - 3; y++) for (let x = 2; x <= COLS - 3; x++) { if (x === 9 || y === 5) continue; if (t[y * COLS + x] === 0) free.push([x, y]); }
    const take = () => free.length ? free.splice(Math.floor(rnd() * free.length), 1)[0] : null;
    const put = (v, n) => { for (let i = 0; i < n; i++) { const c = take(); if (c) t[c[1] * COLS + c[0]] = v; } };
    if (rnd() < (stage === 3 ? 0.6 : 0.38)) put(5, 1 + Math.floor(rnd() * 3));
    if (rnd() < 0.28) put(6, 1 + Math.floor(rnd() * 2));
    if (stage >= 2 && rnd() < 0.3) put(8, 1 + Math.floor(rnd() * 2));
    if (rnd() < 0.16) {   // 효소 결정: 바위 하나를 바꾸거나 빈칸에
      const rocks = []; for (let i = 0; i < t.length; i++) if (t[i] === 2) rocks.push(i);
      if (rocks.length && rnd() < 0.6) t[rocks[Math.floor(rnd() * rocks.length)]] = 9; else put(9, 1);
    }
    room.thp = {};
  };

  /* ───────── 그림 ───────── */
  function poopSpr(stage, hp) {
    const base = stage === 3 ? '#6e5a24' : '#7a4a26';
    return CR.spr('poop' + stage + hp, 16, 16, g => {
      const s = [0.55, 0.78, 1][hp - 1] || 1;
      g.blob(8, 12, 6.5 * s, 3.2 * s, sh(base, -0.12));
      if (hp >= 2) g.blob(8, 9.5, 5 * s, 2.8 * s, base);
      if (hp >= 3) { g.blob(8.3, 7, 3.6, 2.4, sh(base, 0.08)); g.blob(8.8, 4.8, 1.8, 1.6, sh(base, 0.15)); }
      g.set(6, hp >= 3 ? 6 : 9, sh(base, 0.5)); g.set(5, 11, sh(base, 0.35));
      if (hp <= 2) { g.set(5, 12, '#5a3a1c'); g.set(11, 11, '#5a3a1c'); }
    });
  }
  function logsSpr(stage, lit) {
    return CR.spr('logs' + stage + (lit ? 1 : 0), 16, 16, g => {
      if (!lit) { g.blob(8, 12, 6, 2.8, '#3a3232'); g.blob(7, 11, 3, 1.6, '#4e4444'); g.set(9, 11, '#ff7a3a'); return; }
      g.line(2, 14, 13, 10, '#6b3a1e', 3); g.line(3, 10, 14, 14, '#7c4626', 3);
      g.line(3, 13, 12, 10, '#8c5a32', 1); g.line(4, 10, 13, 13, '#9a6a3a', 1);
      g.set(2, 14, '#c49a6c'); g.set(14, 14, '#c49a6c');
    });
  }
  function sacSpr(stage, hp) {
    return CR.spr('sac' + stage + hp, 16, 16, g => {
      g.blob(8, 9, 6.2, 5.6, '#cfb44e'); g.blob(8, 8, 4.2, 3.6, '#e2cc6a');
      for (const [a, b, c, d] of [[3, 9, 6, 6], [13, 8, 10, 5], [5, 13, 8, 10], [11, 13, 9, 10]]) g.line(a, b, c, d, '#a8742e');
      g.set(6, 6, '#fff3b0'); g.set(7, 5, '#fff3b0');
      if (hp < 2) { g.line(7, 4, 10, 9, '#6a3a12'); g.line(10, 9, 8, 12, '#6a3a12'); g.set(9, 10, '#f0e070'); }
      g.rect(7, 2, 3, 2, '#a8742e', true);
    });
  }
  function crystalSpr(stage) {
    return CR.spr('xtal' + stage, 16, 16, g => {
      const prism = (x, y, w, h, c) => { for (let j = 0; j < h; j++) { const ww = j < 2 ? j + 1 : w; for (let i = -ww; i <= ww; i++) g.set(x + i * 0.7, y + j, i < 0 ? sh(c, 0.35) : i === 0 ? sh(c, 0.6) : c); } };
      g.blob(8, 13, 6.5, 2.4, '#2a1a4a');
      prism(5, 4, 2, 9, '#7a5cff'); prism(11, 5, 2, 8, '#b07cff'); prism(8, 1, 3, 12, '#3ad8ff');
      g.set(8, 2, '#ffffff'); g.set(7, 4, '#ffffff'); g.set(5, 5, '#e8dcff');
    });
  }

  /* ───────── 그리기 (불꽃·반짝임은 매 프레임) ───────── */
  CR.drawProps = function (c, room, st, t) {
    const tl = room.tiles, thp = room.thp || (room.thp = {});
    if (room.ash) for (const a of room.ash) { c.fillStyle = 'rgba(30,24,24,0.55)'; c.beginPath(); c.ellipse(a.x, a.y + 4, 7, 3, 0, 0, 7); c.fill(); c.drawImage(logsSpr(st, false), a.x - 8, a.y - 8); }
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      const i = y * COLS + x, v = tl[i]; if (!CR.isBreak(v)) continue;
      const px = x * T, py = y * T, hp = thp[i] != null ? thp[i] : DEF[v].hp;
      c.fillStyle = 'rgba(15,5,8,0.45)'; c.beginPath(); c.ellipse(px + 8.5, py + 14, 7, 2.8, 0, 0, 7); c.fill();
      if (v === 5) c.drawImage(poopSpr(st, hp), px, py);
      else if (v === 8) { const s = 1 + Math.sin(t * 5 + x) * 0.04; c.save(); c.translate(px + 8, py + 9); c.scale(s, 1 / s); c.drawImage(sacSpr(st, hp), -8, -9); c.restore(); }
      else if (v === 9) {
        const g = 0.35 + Math.sin(t * 3 + x * 2) * 0.15; c.fillStyle = `rgba(90,220,255,${g * 0.5})`; c.beginPath(); c.arc(px + 8, py + 8, 10, 0, 7); c.fill();
        c.drawImage(crystalSpr(st), px, py);
        if (Math.floor(t * 3 + x + y) % 4 === 0) { c.fillStyle = '#ffffff'; const sx = px + 4 + ((x * 5 + Math.floor(t * 3)) % 8), sy = py + 2 + ((y * 3 + Math.floor(t * 3)) % 8); c.fillRect(sx, sy - 1, 1, 3); c.fillRect(sx - 1, sy, 3, 1); }
      }
      else if (v === 6) {
        c.drawImage(logsSpr(st, true), px, py);
        const k = hp / 3, fl = (dx, w, h, col, ph) => { const hh = h * k * (0.85 + Math.sin(t * 14 + ph + x) * 0.15); c.fillStyle = col; c.beginPath(); c.moveTo(px + 8 + dx - w, py + 12); c.quadraticCurveTo(px + 8 + dx - w * 0.6, py + 12 - hh * 0.6, px + 8 + dx + Math.sin(t * 9 + ph) * 1.5, py + 12 - hh); c.quadraticCurveTo(px + 8 + dx + w * 0.6, py + 12 - hh * 0.6, px + 8 + dx + w, py + 12); c.fill(); };
        c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,140,40,0.18)'; c.beginPath(); c.arc(px + 8, py + 8, 15, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
        fl(0, 5, 14, '#e8481c', 0); fl(-1, 3.6, 10, '#ff8a2a', 1.3); fl(0.5, 2.2, 6.5, '#ffd34d', 2.1); fl(0, 1, 3, '#fff6c8', 3);
      }
    }
  };

  /* ───────── 맞음 · 부서짐 · 보상 ───────── */
  function drop(kind, x, y) { const p = CR.dropPickup(kind, x, y); p.vx = (Math.random() - 0.5) * 60; p.vy = (Math.random() - 0.5) * 60; }
  CR.hitProp = function (room, tx, ty, dmg, byBomb) {
    const i = ty * COLS + tx, v = room.tiles[i]; if (!CR.isBreak(v)) return false;
    const d = DEF[v], AU = CR.audio, x = tx * T + 8, y = ty * T + 8;
    if (d.bombOnly && !byBomb) { AU.sfx('tink'); return true; }
    room.thp = room.thp || {}; const hp = (room.thp[i] != null ? room.thp[i] : d.hp) - (byBomb ? 99 : 1);
    if (hp > 0) { room.thp[i] = hp; AU.sfx('hit'); CR.burstFx(x, y, v === 5 ? '#7a4a26' : v === 6 ? '#ff8a2a' : '#e2cc6a', 4); return true; }
    room.tiles[i] = 0; delete room.thp[i]; room.bgDirty = true;
    const r = Math.random();
    if (v === 5) { CR.burstFx(x, y, '#7a4a26', 14); AU.sfx('edie'); if (r < 0.22) drop('coin', x, y); else if (r < 0.28) drop('half', x, y); else if (r < 0.32) drop('bomb', x, y); }
    else if (v === 6) { CR.burstFx(x, y, '#9a9090', 12); AU.sfx('freeze'); (room.ash = room.ash || []).push({ x, y }); if (r < 0.18) drop('coin', x, y); else if (r < 0.26) drop('half', x, y); else if (r < 0.29) drop('bomb', x, y); }
    else if (v === 8) { CR.burstFx(x, y, '#e2cc6a', 18); CR.creep(x, y, 18, 4, 'acid'); CR.explosion(x, y, 30, 40, {}); if (r < 0.1) drop('coin', x, y); }
    else if (v === 9) { CR.burstFx(x, y, '#5ae8ff', 26); AU.sfx('item');
      if (r < 0.3) CR.dropPedestal(CR.rollItem('secret'), x, y);
      else { const n = 2 + Math.floor(Math.random() * 2); for (let k = 0; k < n; k++) drop(['coin', 'coin', 'bomb', 'key', 'heart'][Math.floor(Math.random() * 5)], x, y); }
      CR.toast('효소 결정을 깼어요!', '안에 들어 있던 것이 쏟아져 나왔어요', '#5ae8ff'); }
    return true;
  };
  // 염증 불씨에 닿으면 데임 (열충격 단백질·비행이면 무시)
  CR.fireTouch = function (room, P) {
    const tx0 = Math.floor((P.x - 12) / T), tx1 = Math.floor((P.x + 12) / T), ty0 = Math.floor((P.y - 12) / T), ty1 = Math.floor((P.y + 12) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (CR.tileAt(room, tx, ty) === 6 && Math.hypot(P.x - (tx * T + 8), P.y - (ty * T + 8)) < 8 + P.r) return true;
    return false;
  };
  // 가까이 가면 이름표 (효소 결정·고름 주머니처럼 조심할 것)
  CR.propPeek = function (room, P) {
    let best = null, bd = 34;
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) { const v = room.tiles[y * COLS + x]; if (v !== 9 && v !== 8 && v !== 6) continue; const d = Math.hypot(P.x - (x * T + 8), P.y - (y * T + 8)); if (d < bd) { bd = d; best = { x: x * T + 8, y: y * T - 4, custom: { name: DEF[v].name, desc: DEF[v].desc, tag: v === 9 ? '폭탄 전용 구조물' : '부서지는 장애물' } }; } }
    return best;
  };
})();

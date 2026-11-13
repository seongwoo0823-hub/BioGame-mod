// 생물의 번제 — 선택 캐릭터 12종 (우리 몸의 세포, 독창 디자인): 데이터 · 머리/몸통 도트 그림
(function () {
  'use strict';
  const CR = window.CR, sh = CR.shade;
  // hp: 하트 칸 · shield: 반 칸 · cmul: 공격력 배율 · 그 밖의 숫자는 기본 능력치에 더함
  CR.CHARS = [
    { id: 'neut', name: '호중구 뉴트', role: '균형형', desc: '가장 먼저 감염 부위에 달려가는 백혈구. 모든 능력이 고르다.', ability: '특별한 약점이 없는 기본 캐릭터 · 폭탄 1 · 열쇠 1',
      look: { f: 'lobes', col: '#f3f4ff', body: '#e6e8f8', nuc: '#9b7fd6' }, hp: 3, bombs: 1, keys: 1 },
    { id: 'macro', name: '대식세포 맥스', role: '탱커', desc: '병원체를 통째로 삼키는 거대한 세포. 느리지만 튼튼하다.', ability: '체력 4칸 · 공격력 +0.7 · 이동·연사 감소 · 몸집이 큼 · [대식세포 수호자] 보유',
      look: { f: 'pseudopod', col: '#e7d3f2', body: '#d2bce4', nuc: '#a06aa8', scale: 1.2 }, hp: 4, dmg: 0.7, speed: -0.15, rate: -0.4, items: ['P50'] },
    { id: 'killer', name: '킬러 T세포 킬라', role: '공격형', desc: '감염된 세포를 정확히 골라 없애는 암살자.', ability: '공격력 ×1.35 · 치명타 +10% · 체력 2칸 · [에피네프린 주사] 보유',
      look: { f: 'spikes', col: '#a4e8ad', body: '#7cc98a', nuc: '#4a8a56', eye: 'angry' }, hp: 2, cmul: 1.35, crit: 10, active: 'A03' },
    { id: 'nk', name: 'NK세포 엔케이', role: '속도형', desc: '항원 없이도 이상한 세포를 알아보는 자연살해세포.', ability: '이동 +0.3 · 연사 +0.8 · 공격력 -0.5 · [편모 추진] 보유',
      look: { f: 'granules', col: '#cdb0ff', body: '#a888e8', nuc: '#5a3a9a', eye: 'sharp' }, hp: 3, speed: 0.3, rate: 0.8, dmg: -0.5, items: ['P35'] },
    { id: 'bcell', name: 'B세포 비비', role: '유도형', desc: '항원에 꼭 맞는 항체를 만들어 쏘는 세포.', ability: '항체 탄환이 표적을 추적 [화학주성 센서] · 연사 +0.3 · 공격력 -0.3',
      look: { f: 'antibody', col: '#a4d6ff', body: '#7fb8f0', nuc: '#3a6aa8' }, hp: 3, rate: 0.3, dmg: -0.3, items: ['P27'] },
    { id: 'dendri', name: '수지상세포 덴디', role: '소환형', desc: '정보를 모아 다른 면역세포를 불러 모으는 지휘관.', ability: '[박테리오파지 동료]·[수지상 정찰기]와 함께 시작 · 공격력 -0.5',
      look: { f: 'dendrite', col: '#ffc890', body: '#f0a868', nuc: '#b0602a' }, hp: 3, dmg: -0.5, items: ['P49', 'P51'] },
    { id: 'rbc', name: '적혈구 레드', role: '보호막형', desc: '핵이 없는 대신 산소를 가득 실은 원반 세포.', ability: '체력 2칸 + 실드 2칸 · 이동 +0.2 · 방을 비울 때마다 실드 반 칸 (최대 3칸)',
      look: { f: 'disc', col: '#e8344e', body: '#c8283e' }, hp: 2, shield: 4, speed: 0.2, flags: ['clearShield'] },
    { id: 'plate', name: '혈소판 플레티', role: '회피형', desc: '상처를 막는 작은 세포 조각. 작아서 잘 맞지 않는다.', ability: '몸집이 작음 · 맞으면 반격탄 [혈소판 응집] · 폭탄 +3 · 체력 2칸',
      look: { f: 'fragment', col: '#f2d77a', body: '#e0c060', nuc: '#b08a2a' }, hp: 2, bombs: 3, items: ['P68', 'P47'] },
    { id: 'stem', name: '줄기세포 스템', role: '만능형', desc: '무엇이든 될 수 있는 가능성의 세포.', ability: '공격력·연사·사거리·이동·탄속·치명타가 모두 조금씩 높음 · 체력 2칸',
      look: { f: 'stem', col: '#c8fff0', body: '#a8f0dc', nuc: '#4ac0a0' }, hp: 2, dmg: 0.5, rate: 0.4, range: 30, speed: 0.12, sspd: 0.15, crit: 6 },
    { id: 'virus', name: '바이러스 비리', role: '변이형', desc: '편을 바꾼 착한 바이러스. 매 방마다 성질이 바뀐다.', ability: '체력 1칸 + 실드 2칸 · 장애물을 통과하는 탄환 · 방마다 무작위 탄도 효과',
      look: { f: 'virus', col: '#94e080', body: '#6cc05a', nuc: '#3a8a2a' }, hp: 1, shield: 4, items: ['P33', 'P61'] },
    { id: 'phage', name: '박테리오파지 파지', role: '비행형', desc: '세균만 골라 감염시키는 작은 바이러스 비행선.', ability: '날아다님 (바위·가시·장판 무시) · 공격력 -0.4 · [배양 접시] 보유',
      look: { f: 'phage', col: '#c8d0e0', body: '#8a96a8', nuc: '#5a6478' }, hp: 3, dmg: -0.4, items: ['P43'], active: 'A11' },
    { id: 'cancer', name: '암세포 캔서', role: '고위험형', desc: '통제를 벗어난 세포가 면역 편에 섰다. 강하지만 아주 약하다.', ability: '체력 1칸 · 공격력 ×1.6 · 연사 +0.5 · 맞을수록 강해짐 [아드레날린 수용체]',
      look: { f: 'tumor', col: '#b8405a', body: '#8a2a3e', nuc: '#5a1426', eye: 'angry' }, hp: 1, cmul: 1.6, rate: 0.5, items: ['P22'] },
  ];
  CR.charById = id => CR.CHARS.find(c => c.id === id) || CR.CHARS[0];

  /* ───────── 머리 (4방향 · 쏠 때 찌그러짐) ───────── */
  CR.charHead = function (ch, dir, shoot, tint) {
    const L = ch.look, col = tint || L.col;
    return CR.spr('ch|' + ch.id + '|' + dir + '|' + (shoot ? 1 : 0) + '|' + (tint || ''), 18, 16, g => {
      const sq = shoot ? 0.86 : 1, cx = 9, cy = 8.5 + (shoot ? 0.6 : 0), nuc = L.nuc || sh(col, -0.4);
      // 뒤쪽 장식
      if (L.f === 'dendrite') { [[-1, -0.5], [1, -0.4], [-1, 0.5], [1, 0.6]].forEach(([s, a]) => { const x1 = cx + s * 6, y1 = cy + a * 4; g.line(x1, y1, x1 + s * 2.5, y1 - 2, sh(col, -0.15)); g.line(x1 + s * 2, y1 - 1.5, x1 + s * 3, y1 + 0.5, sh(col, -0.15)); }); }
      if (L.f === 'spikes') for (let k = -2; k <= 2; k++) { const x = cx + k * 2.4; g.line(x, cy - 5, x + k * 0.3, cy - 7.5, sh(col, -0.2)); g.set(x + k * 0.3, cy - 8, '#e8344e'); }
      if (L.f === 'antibody') for (const s of [-1, 1]) { const x = cx + s * 3.5; g.line(x, cy - 5, x, cy - 7.5, '#3a6aa8'); g.line(x, cy - 7.5, x - 1.5, cy - 9.5, '#3a6aa8'); g.line(x, cy - 7.5, x + 1.5, cy - 9.5, '#3a6aa8'); g.set(x - 1.5, cy - 10, '#ffe066'); g.set(x + 1.5, cy - 10, '#ffe066'); }
      if (L.f === 'virus') for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.line(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5, cx + Math.cos(a) * 7.6, cy + Math.sin(a) * 7, sh(col, -0.25)); g.blob(cx + Math.cos(a) * 8, cy + Math.sin(a) * 7.4, 1.1, 1.1, '#ffe066', true); }
      if (L.f === 'pseudopod') { g.blob(cx - 6, cy + 1, 2.6, 2.2, sh(col, -0.06)); g.blob(cx + 6.2, cy - 1, 2.4, 2.4, sh(col, -0.06)); g.blob(cx + 2, cy - 6, 2.4, 2, sh(col, -0.04)); }
      // 몸통(머리) 본체
      if (L.f === 'disc') { g.blob(cx, cy, 7.4, 5.6 * sq, col); g.blob(cx, cy + 0.3, 3.6, 2.4 * sq, sh(col, 0.22), true); }
      else if (L.f === 'phage') { for (let y = -5; y <= 5; y++) { const w = 6.2 - Math.abs(y) * 0.45; for (let x = -w; x <= w; x++) g.set(cx + x, cy + y * sq, x < -w + 1.5 ? sh(col, 0.2) : x > w - 1.5 ? sh(col, -0.25) : col); } g.line(cx - 6, cy, cx + 6, cy, sh(col, -0.12)); }
      else if (L.f === 'fragment') { g.blob(cx - 1, cy + 0.5, 5.6, 4.6 * sq, col); g.blob(cx + 3, cy - 1.5, 3.2, 3 * sq, sh(col, 0.06)); g.blob(cx - 4, cy - 2, 2.2, 2, sh(col, -0.05)); }
      else if (L.f === 'tumor') { g.blob(cx, cy + 0.5, 6.4, 5.6 * sq, col); g.blob(cx - 4.5, cy - 3, 2.6, 2.4, sh(col, -0.1)); g.blob(cx + 4.8, cy - 2.4, 2.4, 2.4, sh(col, 0.05)); g.blob(cx + 3, cy + 4, 2, 1.8, sh(col, -0.15)); }
      else g.blob(cx, cy, (L.f === 'pseudopod' ? 6.9 : 6.6) * (shoot ? 1.06 : 1), 5.8 * sq, col);
      // 앞쪽 장식
      if (L.f === 'granules') [[-3, -2], [2, -3], [4, 1], [-4, 2], [0, 3], [-1, -4]].forEach(([x, y]) => g.set(cx + x, cy + y, nuc));
      if (L.f === 'fragment') [[-2, -1], [2, 0], [0, 2]].forEach(([x, y]) => g.set(cx + x, cy + y, nuc));
      if (L.f === 'tumor') { g.line(cx - 5, cy - 1, cx - 2, cy + 2, '#ff6b8a'); g.line(cx + 5, cy, cx + 2, cy - 2, '#ff6b8a'); }
      if (L.f === 'stem') { const sx = cx + 4, sy = cy - 4; g.set(sx, sy, '#ffffff'); g.set(sx - 1, sy, '#bfffff'); g.set(sx + 1, sy, '#bfffff'); g.set(sx, sy - 1, '#bfffff'); g.set(sx, sy + 1, '#bfffff'); g.set(cx - 4, cy - 3, '#ffffff'); }
      if (L.f === 'spikes') g.line(cx - 5, cy - 2, cx + 5, cy - 2, '#e8344e');
      if (dir === 'up') {
        if (L.f === 'lobes') [[5, 6], [9, 5], [13, 6], [7, 10], [11, 10]].forEach(([x, y]) => g.disc(x, y, 1, nuc));
        else if (L.f !== 'disc' && L.f !== 'phage') { g.blob(cx + 1, cy + 0.5, 2.4, 2, nuc, true); }
        return;
      }
      const lk = { down: [0, 1], left: [-1, 0], right: [1, 0] }[dir], ex = cx + lk[0] * 2, ey = cy + 0.5 + (shoot ? 0.6 : 0);
      if (L.f === 'lobes') g.disc(ex + (lk[0] ? -lk[0] * 3 : -2.5), ey - 3.5, 1, nuc);
      const angry = L.eye === 'angry' || L.eye === 'sharp';
      if (dir === 'down') { CR.eyes(g, ex, ey, 2.6, 16, [0, 1], angry); if (!shoot && L.eye !== 'sharp') g.set(cx, ey + 2.5, sh(col, -0.35)); }
      else CR.eyes(g, ex + lk[0] * 1.5, ey, 1.6, 16, lk, angry);
      if (L.f === 'phage' && dir === 'down') g.line(cx - 2, ey + 3, cx + 2, ey + 3, sh(col, -0.4));
    });
  };
  /* ───────── 몸통 (4방향 걷기) ───────── */
  CR.charBody = function (ch, dir, frame, tint) {
    const L = ch.look, col = tint || L.body;
    return CR.spr('cb|' + ch.id + '|' + dir + '|' + frame + '|' + (tint || ''), 14, 9, g => {
      const f = frame % 2;
      if (L.f === 'phage') { g.line(7, 0, 7, 4, col, 2); for (const s of [-1, 1]) { g.line(7, 4, 7 + s * (4 - f), 8, sh(col, -0.15)); g.line(7, 4, 7 + s * (2 + f), 8, sh(col, -0.15)); } return; }
      g.blob(7, 3.6, L.f === 'pseudopod' ? 4.8 : L.f === 'fragment' ? 3.4 : 4, 3, col);
      if (L.f === 'disc') { g.set(6, 3, sh(col, 0.25)); g.set(8, 3, sh(col, 0.25)); }
      if (dir === 'left' || dir === 'right') { g.rect(4 + f * 2, 6, 2, 2, sh(col, -0.2)); g.rect(8 - f * 2, 6, 2, 2, sh(col, -0.25)); }
      else { g.rect(4, 6 - f, 2, 2, sh(col, -0.2)); g.rect(8, 5 + f, 2, 2, sh(col, -0.2)); }
    });
  };
  // 캐릭터 선택 화면·썸네일용 전신 그림
  CR.charPortrait = function (ch, scale) {
    const s = scale || 4, cv = document.createElement('canvas'); cv.width = 18 * s; cv.height = 24 * s;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const sc = ch.look.scale || 1, b = CR.charBody(ch, 'down', 0), h = CR.charHead(ch, 'down', false);
    const bw = 14 * s * sc, bh = 9 * s * sc, hw = 18 * s * sc, hh = 16 * s * sc;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(9 * s, 22.5 * s, 6 * s * sc, 1.6 * s, 0, 0, 7); c.fill();
    c.drawImage(b, 9 * s - bw / 2, 23 * s - bh, bw, bh);
    c.drawImage(h, 9 * s - hw / 2, 23 * s - bh * 0.62 - hh, hw, hh);
    return cv;
  };
})();

/* 감염 도시 · 게임 진행 (생존 수치, 전투, 상호작용, 이야기, 화면, 저장) */
(function () {
  'use strict';
  const OB = window.OB, ITEMS = OB.ITEMS, TAU = Math.PI * 2, clamp = OB.clamp;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const SAVE = 'outbreakSave', STAT = 'outbreakStats';
  const MIN_PER_SEC = 1.6;   // 현실 1초 = 게임 1.6분 (하루 ≈ 15분)
  const BASE_CAP = 9;
  let R = Math.random;

  // ================= 시간 =================
  OB.minute = 9 * 60;   // 1일차 09:00
  OB.day = () => Math.floor(OB.minute / 1440) + 1;
  OB.hour = () => (OB.minute % 1440) / 60;
  OB.isNight = () => { const h = OB.hour(); return h >= 20.5 || h < 5.5; };
  OB.under = () => !!(OB.P && OB.W && OB.W.isUnder && OB.W.isUnder(OB.P.x));
  OB.isDark = () => OB.isNight() || OB.under();
  const fmtTime = () => { const h = Math.floor(OB.hour()), m = Math.floor(OB.minute % 60); return `${OB.day()}일차 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
  const C1 = new THREE.Color(), C2 = new THREE.Color();
  function updateLight() {
    const h = OB.hour();
    // 해: 6시 뜨고 20시 짐
    const sunK = clamp(Math.sin((h - 5.5) / 15 * Math.PI), 0, 1), dusk = clamp(1 - Math.abs(h - 19.5) / 1.6, 0, 1) + clamp(1 - Math.abs(h - 6) / 1.2, 0, 1);
    OB.sun.intensity = 0.12 + sunK * 0.85; OB.hemi.intensity = 0.16 + sunK * 0.62;
    C1.set('#fff2dc').lerp(C2.set('#ff9a5a'), clamp(dusk, 0, 1) * 0.7); if (sunK < 0.05) C1.set('#8aa0ff');
    OB.sun.color.copy(C1);
    const sky = C2.set('#0c1424').lerp(C1.set('#9fc4d8'), sunK); if (dusk > 0) sky.lerp(new THREE.Color('#e8a07a'), dusk * 0.35);
    OB.scene.background.copy(sky); OB.scene.fog.color.copy(sky);
    const P = OB.P;
    const lantern = P && P.flash && hasItem('lantern');
    OB.flash.intensity = lantern ? 1.6 : 0; OB.glow.intensity = lantern ? 0.9 : (sunK < 0.1 ? 0.25 : 0);
    if (P) {
      OB.flash.position.set(P.x, 1.6, P.z); OB.flash.target.position.set(P.x + Math.sin(P.ry) * 6, 0, P.z + Math.cos(P.ry) * 6);
      OB.glow.position.set(P.x, 2.2, P.z);
    }
    $('#night').style.opacity = (1 - sunK) * 0.35;
    if (OB.under()) {   // 지하: 어둡고 축축한 빛, 랜턴이 없으면 주변만 희미하게
      const c = OB.cellOf(P.x, P.z), g = OB.W.ground[c[1] * OBW.N + c[0]], lab = g === OBW.GR.ulab;
      OB.sun.intensity = 0; OB.hemi.intensity = lab ? 0.5 : 0.34; OB.hemi.color.set(lab ? '#b8d0ff' : g === OBW.GR.cave ? '#ffd0a0' : '#c8e0b0');
      OB.scene.background.set('#05070a'); OB.scene.fog.color.set('#05070a');
      OB.glow.intensity = lantern ? 1.5 : 0.9; OB.glow.distance = lantern ? 12 : 8; $('#night').style.opacity = 0.38;
      OB.scene.fog.near = OB.zoom - 4; OB.scene.fog.far = OB.zoom + 26;
    } else { OB.glow.distance = 7; OB.hemi.color.set('#ffffff'); OB.scene.fog.near = 45; OB.scene.fog.far = 95; }
  }

  // ================= 효과음 (합성) =================
  let AC = null, MG = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); MG = AC.createGain(); MG.gain.value = OB.vol == null ? 0.6 : OB.vol; MG.connect(AC.destination); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f0, f1, dur, type, vol, delay) {
    const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(MG); o.start(t); o.stop(t + dur + 0.02);
  }
  function noiseB(dur, freq, vol, q, delay) {
    const a = ac(); if (!a) return; const t = a.currentTime + (delay || 0);
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1; const g = a.createGain(); g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(MG); s.start(t);
  }
  OB.sfx = function (k, dist) {
    const v = dist == null ? 1 : clamp(1 - dist / 30, 0, 1); if (v <= 0.02) return;
    switch (k) {
      case 'step': noiseB(0.06, 300 + Math.random() * 200, 0.06 * v, 2); break;
      case 'swing': noiseB(0.16, 1800, 0.12 * v, 0.8); break;
      case 'hit': noiseB(0.1, 220, 0.4 * v, 1.2); tone(140, 60, 0.12, 'square', 0.12 * v); break;
      case 'kill': tone(160, 50, 0.4, 'sawtooth', 0.1 * v); break;
      case 'groan': tone(90 + Math.random() * 40, 60, 0.7, 'sawtooth', 0.06 * v); tone(130, 80, 0.6, 'triangle', 0.04 * v, 0.05); break;
      case 'bang': noiseB(0.14, 120, 0.5 * v, 1.5); tone(80, 50, 0.15, 'square', 0.15 * v); break;
      case 'door': tone(300, 180, 0.18, 'triangle', 0.1); noiseB(0.1, 600, 0.06, 1); break;
      case 'eat': for (let i = 0; i < 3; i++) noiseB(0.05, 900, 0.08, 3, i * 0.12); break;
      case 'drink': for (let i = 0; i < 3; i++) tone(500, 300, 0.08, 'sine', 0.08, i * 0.14); break;
      case 'pick': tone(700, 1100, 0.07, 'triangle', 0.1); break;
      case 'gun': noiseB(0.08, 2000, 0.3, 0.6); tone(600, 200, 0.1, 'square', 0.12); break;
      case 'hurt': tone(400, 180, 0.25, 'sawtooth', 0.18); break;
      case 'glass': for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 2000, 1500, 0.12, 'triangle', 0.06, i * 0.03); break;
      case 'hammer': for (let i = 0; i < 3; i++) noiseB(0.06, 500, 0.3, 2, i * 0.22); break;
      case 'ui': tone(880, 880, 0.05, 'sine', 0.05); break;
      case 'radio': for (let i = 0; i < 8; i++) noiseB(0.08, 2500, 0.05, 0.5, i * 0.08); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.12, i * 0.15)); break;
    }
  };

  // ================= 메시지 =================
  OB.msg = function (t, cls) {
    const box = $('#log'); const p = document.createElement('div'); p.className = 'lg ' + (cls || ''); p.textContent = t; box.appendChild(p);
    while (box.children.length > 6) box.firstChild.remove(); setTimeout(() => p.classList.add('old'), 6000);
  };
  OB.toast = function (t, sub) { const el = $('#toast'); el.innerHTML = `<b>${t}</b>${sub ? `<small>${sub}</small>` : ''}`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
  const LEARN = {};
  function learn(key, title, text) { if (LEARN[key]) return; LEARN[key] = 1; OB.state.learned[key] = { title, text }; OB.msg('📖 생명과학 노트: ' + title, 'sci'); }

  // ================= 가방 =================
  function P() { return OB.P; }
  function hasItem(id) { return OB.P && OB.P.inv.some(it => it.id === id); }
  function countItem(id) { return OB.P.inv.reduce((a, it) => a + (it.id === id ? (ITEMS[id].stack ? it.n : 1) : 0), 0); }
  function takeItem(id, n) {
    n = n || 1; const inv = OB.P.inv;
    for (let i = inv.length - 1; i >= 0 && n > 0; i--) { const it = inv[i]; if (it.id !== id) continue; if (ITEMS[id].stack) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (it.n <= 0) inv.splice(i, 1); } else { inv.splice(i, 1); n--; } }
  }
  function giveItem(it) {
    const d = ITEMS[it.id], inv = OB.P.inv;
    if (d.stack) { const s = inv.find(x => x.id === it.id); if (s) { s.n += it.n; return; } }
    inv.push(it);
  }
  OB.giveItem = giveItem; OB.hasItem = hasItem;
  const capOf = () => BASE_CAP + (OB.P.bag ? ITEMS[OB.P.bag.id].cap : 0);
  const loadOf = () => OB.P.inv.reduce((a, it) => a + OB.weightOf(it), 0) + (OB.P.weapon ? (ITEMS[OB.P.weapon.id].w || 0) * 0.5 : 0);
  const spoiled = it => { const d = ITEMS[it.id]; return d.spoil && it.age > d.spoil; };
  const itemName = it => (spoiled(it) ? '상한 ' : '') + ITEMS[it.id].name;

  // ================= 플레이어 행동 =================
  OB.onKey = function (k, e) {
    if (OB.state.screen !== 'play') { if (k === 'Escape' && OB.state.screen === 'panel') closePanels(); return; }
    if (k === 'KeyE') interact();
    else if (k === 'KeyB') barricadeAction();
    else if (k === 'Tab' || k === 'KeyI') openInv();
    else if (k === 'KeyJ') openJournal();
    else if (k === 'KeyM') openMap();
    else if (k === 'KeyR') reload();
    else if (k === 'KeyL' || k === 'KeyF') toggleLantern();
    else if (k === 'Space') OB.onShove();
    else if (k === 'KeyC' || k === 'ControlLeft') { OB.P.sneak = !OB.P.sneak; OB.msg(OB.P.sneak ? '살금살금 걷기 (발소리가 작아짐)' : '보통 걷기'); }
    else if (k === 'Escape') pauseMenu();
    else if (/^Digit[1-6]$/.test(k)) quickUse(+k.slice(5) - 1);
  };
  function toggleLantern() { if (!hasItem('lantern')) { OB.msg('랜턴이 없어요'); return; } OB.P.flash = !OB.P.flash; OB.sfx('ui'); }
  OB.onAttack = function () {
    const p = OB.P; if (!p || p.dead || OB.state.screen !== 'play' || p.asleep || p.act) return;
    const w = p.weapon ? ITEMS[p.weapon.id] : ITEMS.fists;
    if (w.kind === 'gun') { shoot(); return; }
    if (p.swingT > 0 || p.stamina < 4) return;
    p.swingT = 0.0001; p.swingDone = false; p.swingW = w; p.stamina -= 5 + w.w * 2;
    OB.sfx('swing'); aimAuto();
  };
  OB.onShove = function () {
    const p = OB.P; if (!p || p.dead || OB.state.screen !== 'play' || p.shoveT > 0 || p.stamina < 6 || p.act || p.asleep) return;
    p.shoveT = 0.55; p.stamina -= 8; aimAuto();
    for (const zz of OB.zombiesNear(p.x, p.z, 1.5)) {
      if (Math.abs(OB.angDiff(p.ry, Math.atan2(zz.x - p.x, zz.z - p.z))) > 1.1) continue;
      const a = Math.atan2(zz.x - p.x, zz.z - p.z); OB.move(zz, Math.sin(a) * 1.1, Math.cos(a) * 1.1, 0.3, 'z'); zz.atkT = 0; zz.hitT = 0.3;
      if (Math.random() < 0.45) zz.downT = 2.2;
    }
    OB.noise(p.x, p.z, 4); OB.sfx('swing');
  };
  // 모바일·자동 조준: 앞쪽 가까운 감염자 쪽으로 몸을 돌림
  function aimAuto() {
    const p = OB.P; if (OB.mouse.used && !OB.touch) return;
    let best = null, bd = 3.5;
    for (const zz of OB.zombiesNear(p.x, p.z, 3.5)) { const a = Math.abs(OB.angDiff(p.ry, Math.atan2(zz.x - p.x, zz.z - p.z))); const s = Math.hypot(zz.x - p.x, zz.z - p.z) + a * 1.2; if (s < bd) { bd = s; best = zz; } }
    if (best) p.ry = Math.atan2(best.x - p.x, best.z - p.z);
  }
  function doMeleeHit(p, w) {
    let hit = 0;
    const list = OB.zombiesNear(p.x, p.z, w.rng + 0.4).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    for (const zz of list) {
      const d = Math.hypot(zz.x - p.x, zz.z - p.z), a = Math.abs(OB.angDiff(p.ry, Math.atan2(zz.x - p.x, zz.z - p.z)));
      if (d > w.rng + 0.3 || a > (w.arc / 2) * Math.PI / 180) continue;
      if (!OB.los(p.x, p.z, zz.x, zz.z, 'z')) continue;
      let dmg = w.dmg * (0.85 + Math.random() * 0.3) * (p.stamina < 15 ? 0.6 : 1);
      if (zz.downT > 0) dmg *= 2.2;   // 쓰러진 감염자
      const crit = Math.random() < 0.08; if (crit) dmg *= 1.8;
      OB.hurtZombie(zz, dmg, w.kd, p.x, p.z); hit++;
      if (hit >= (w.two ? 3 : 2)) break;
    }
    if (hit) {
      OB.sfx('hit'); OB.shake = 0.25; OB.noise(p.x, p.z, w.noise || 5);
      if (p.weapon && p.weapon.dur != null) { p.weapon.dur -= 1; if (p.weapon.dur <= 0) { OB.msg(`${ITEMS[p.weapon.id].name}이(가) 부서졌어요!`, 'bad'); p.weapon = null; OB.attachWeapon(p); } }
    }
  }
  function shoot() {
    const p = OB.P, w = ITEMS[p.weapon.id];
    if (p.gunT > 0) return;
    if (!p.weapon.ammo) { OB.msg('다트가 없어요 (R: 장전)'); OB.sfx('ui'); return; }
    p.weapon.ammo--; p.gunT = w.rate; aimAuto();
    OB.sfx('gun'); OB.noise(p.x, p.z, w.noise); OB.shake = 0.2;
    // 직선으로 가장 먼저 맞는 감염자
    let best = null, bt = w.rng; const dx = Math.sin(p.ry), dz = Math.cos(p.ry);
    for (const zz of OB.zombiesNear(p.x, p.z, w.rng)) {
      const rx = zz.x - p.x, rz = zz.z - p.z, t = rx * dx + rz * dz; if (t < 0 || t > bt) continue;
      const perp = Math.abs(rx * dz - rz * dx); if (perp > 0.45) continue;
      if (!OB.los(p.x, p.z, zz.x, zz.z, 'z')) continue; bt = t; best = zz;
    }
    OB.tracer(p.x + dx * 0.5, p.z + dz * 0.5, p.x + dx * bt, p.z + dz * bt);
    if (best) OB.hurtZombie(best, w.dmg * (0.9 + Math.random() * 0.2), 0.5, p.x, p.z);
  }
  function reload() {
    const p = OB.P; if (!p.weapon || ITEMS[p.weapon.id].kind !== 'gun') return;
    const w = ITEMS[p.weapon.id], need = w.mag - p.weapon.ammo, have = countItem('darts');
    if (!have) { OB.msg('진정제 다트가 없어요'); return; } if (need <= 0 || p.act) return;
    startAct('reload', 0.7, { ev: [{ at: 0.6, fn: () => { const n = Math.min(need, countItem('darts')); takeItem('darts', n); p.weapon.ammo += n; OB.msg(`장전 (${p.weapon.ammo}/${w.mag})`); OB.sfx('pick'); } }] });
  }
  // ---------- 다치기 ----------
  OB.hurtPlayer = function (zz) {
    const p = OB.P; if (p.dead) return;
    const T = zz.T; let dmg = T.dmg[0] + Math.random() * (T.dmg[1] - T.dmg[0]);
    const def = (p.off ? ITEMS[p.off.id].def : 0) + (p.face ? ITEMS[p.face.id].def * 0.3 : 0);
    // 막기: 방패·뒤에서 맞음
    const behind = Math.abs(OB.angDiff(p.ry, Math.atan2(zz.x - p.x, zz.z - p.z))) > 2.2;
    if (!behind && Math.random() < def) { OB.msg('방패로 막았어요!', 'good'); OB.sfx('hit'); return; }
    p.hp -= dmg; p.hitT = 0.3; OB.shake = 0.5; OB.sfx('hurt'); flashHurt();
    // 상처 종류
    const r = Math.random(); const type = r < 0.55 ? 'scratch' : r < 0.85 ? 'cut' : 'bite';
    const W = { scratch: ['할큄', 0.07, 0.3], cut: ['찢어진 상처', 0.25, 0.7], bite: ['물림', 1, 1] }[type];
    let chance = W[1]; if (p.vaccinated) chance = type === 'bite' ? 0.12 : type === 'cut' ? 0.02 : 0;
    p.wounds.push({ type, name: W[0], age: 0, chance, bandaged: false, dis: false, rolled: false });
    p.bleed += W[2];
    OB.msg(`${W[0]}! (체력 -${dmg | 0})`, 'bad');
    if (type === 'bite') learn('bite', '물리면 감염되는 이유', '감염자의 침 속 바이러스가 상처를 통해 혈액으로 들어가요. 바이러스는 세포에 들어가 그 세포의 효소와 재료로 자신을 복제해요.');
    else learn('wound', '상처와 세균', '피부는 병원체를 막는 1차 방어벽이에요. 상처가 나면 소독(세균의 단백질 파괴)하고 붕대로 덮어 2차 감염을 막아요.');
    if (p.hp <= 0) die('감염자에게 쓰러졌어요');
  };
  function flashHurt() { const el = $('#hurt'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }

  // ---------- 아이템 쓰기 ----------
  function useItem(it, from) {
    const p = OB.P, d = ITEMS[it.id];
    const rm = () => { const L = from || p.inv; const i = L.indexOf(it); if (d.stack && it.n > 1) it.n--; else if (i >= 0) L.splice(i, 1); };
    if (d.kind === 'food' || d.kind === 'drink') {
      if (d.raw && !it.cookedOK) { if (!confirm('익히지 않은 음식이에요. 세균 때문에 배탈이 날 수 있어요. 그래도 먹을까요?')) return; }
      const bad = spoiled(it), dirty = d.dirty;
      p.hunger = clamp(p.hunger - (d.hunger || 0) * (bad ? 0.6 : 1), 0, 100); p.thirst = clamp(p.thirst - (d.thirst || 0), 0, 100);
      if (d.fatigue) p.fatigue = clamp(p.fatigue + d.fatigue, 0, 100);
      for (const n in d.nutr || {}) p.nutr[n] = Math.min(6, (p.nutr[n] || 0) + d.nutr[n]);
      if ((bad && Math.random() < 0.6) || (dirty && Math.random() < 0.4) || (d.raw && Math.random() < 0.45)) { p.sick = Math.max(p.sick, 12 * 60); OB.msg('속이 메스꺼워요... 배탈이 났어요', 'bad'); learn('food', '식중독', '상한 음식이나 끓이지 않은 물 속 세균·독소는 소화기관에 염증을 일으켜요. 음식을 익히고 물을 끓이면 대부분의 병원체가 죽어요.'); }
      OB.sfx(d.kind === 'food' ? 'eat' : 'drink'); OB.msg(`${itemName(it)}을(를) ${d.kind === 'food' ? '먹었어요' : '마셨어요'}`);
      playUse(d.kind === 'food' ? 'eat' : 'drink');
      if (d.note) OB.state.learned['f_' + it.id] = { title: d.name, text: d.note };
      rm(); OB.state.ate = true; quests(); return;
    }
    if (d.kind === 'weapon' || d.kind === 'gun') { equip(it, from); return; }
    if (d.kind === 'wear') { const slot = d.slot; if (from) { from.splice(from.indexOf(it), 1); } else p.inv.splice(p.inv.indexOf(it), 1); if (p[slot]) p.inv.push(p[slot]); p[slot] = it; OB.msg(`${d.name} 착용`); return; }
    if (d.kind === 'bag') { if (from) from.splice(from.indexOf(it), 1); else p.inv.splice(p.inv.indexOf(it), 1); if (p.bag) p.inv.push(p.bag); p.bag = it; OB.msg(`${d.name}을(를) 멨어요 (들 수 있는 무게 ${capOf()}kg)`); return; }
    if (d.use === 'bandage') { const w = p.wounds.find(x => !x.bandaged); if (!w && p.bleed <= 0) { OB.msg('감을 상처가 없어요'); return; } if (w) w.bandaged = true; p.bleed = Math.max(0, p.bleed - 0.8); rm(); OB.msg('붕대를 감았어요. 피가 멈춰요'); playUse('bandage'); return; }
    if (d.use === 'disinfect') { const ws = p.wounds.filter(x => !x.dis && !x.rolled); if (!ws.length) { OB.msg('소독할 새 상처가 없어요'); return; } ws.forEach(w => { w.dis = true; w.chance *= w.type === 'bite' ? 1 : 0.4; }); it.uses = (it.uses || 1) - 1; if (it.uses <= 0) rm(); OB.msg('상처를 소독했어요 (세균 감염 위험 ↓)'); playUse('bandage'); learn('dis', '소독과 바이러스', '소독약은 상처 표면의 세균을 죽이지만, 이미 혈액에 들어간 바이러스는 없앨 수 없어요. 그래서 물리면 소독만으로는 부족해요.'); return; }
    if (d.use === 'painkill') { p.painT = 240; p.temp = Math.max(36.5, p.temp - 1); rm(); OB.msg('해열진통제를 먹었어요 (열과 통증이 줄어요)'); playUse('drink'); learn('pain', '해열제', '열은 우리 몸이 병원체와 싸우며 체온을 올린 결과예요. 해열제는 증상을 줄일 뿐 원인을 없애지 않아요.'); return; }
    if (d.use === 'antiviral') { p.antiviral = 8 * 60; rm(); OB.msg('항바이러스제를 먹었어요 (8시간 동안 바이러스 증식이 느려져요)', 'good'); playUse('drink'); learn('av', '항바이러스제', '항바이러스제는 바이러스의 복제 효소 등을 방해해 증식을 늦춰요. 세균을 죽이는 항생제는 바이러스에 효과가 없어요.'); return; }
    if (d.use === 'vitamin') { p.nutr.vit = Math.min(6, p.nutr.vit + 3); rm(); OB.msg('비타민을 먹었어요'); playUse('drink'); return; }
    if (d.use === 'vaccine') {
      rm(); p.vaccinated = true;
      if (p.infected && p.virus < 80) { p.infected = false; p.virus = 0; OB.toast('백신 접종!', '기억세포와 항체가 바이러스를 물리쳤어요. 이제 감염 위험이 크게 줄어요.'); }
      else OB.toast('백신 접종!', '이제 물려도 감염될 확률이 크게 줄어요.');
      learn('vac', '백신의 원리', '백신은 약하게 하거나 일부만 남긴 병원체(항원)를 넣어 B림프구가 항체를, 기억세포가 기억을 만들게 해요. 진짜 병원체가 들어오면 빠르고 강하게 2차 면역 반응이 일어나요.');
      OB.state.q.vaxed = true; quests(); return;
    }
    if (d.use === 'radio') { radioBroadcast(); return; }
    if (it.id === 'notes') { readNotes(); return; }
    OB.msg(d.note || '지금은 쓸 수 없어요');
  }
  // 아이템 쓰는 동작: 가방 창이 열려 있으면 닫은 뒤에 보여 줌
  function playUse(type) { const p = OB.P; if (OB.paused) p.queueAct = type; else if (!p.act) startAct(type, type === 'bandage' ? 1.2 : 1.0); }
  function equip(it, from) {
    const p = OB.P; const L = from || p.inv; const i = L.indexOf(it); if (i >= 0) L.splice(i, 1);
    if (p.weapon) p.inv.push(p.weapon); p.weapon = it; OB.attachWeapon(p); OB.msg(`${ITEMS[it.id].name}을(를) 들었어요`); OB.sfx('pick'); quests();
  }
  function quickUse(k) { const q = quickList()[k]; if (q) { useItem(q); refreshHUD(true); } }
  function quickList() { const p = OB.P; return p.inv.filter(it => ['food', 'drink', 'med'].includes(ITEMS[it.id].kind) || ITEMS[it.id].kind === 'weapon' || ITEMS[it.id].kind === 'gun').slice(0, 6); }

  // ================= 행동 동작 =================
  //  행동하는 동안은 이동을 멈추고, 시간(k: 0→1)에 따라 자세·위치를 바꿈. ev: [{at, fn}] 정해진 순간에 실제 효과
  //  뼈 축: 오른팔 Z+ = 앞 / 오른 팔꿈치 Z+ = 굽힘, 왼팔 X+ = 앞 / 왼 팔꿈치 X+ = 굽힘, 허벅지 X- = 들기, 무릎 X+ = 굽힘, 척추·머리 X+ = 숙이기
  const ss = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const bell = (k, a, b) => k < a ? ss(k / a) : k > b ? ss((1 - k) / (1 - b)) : 1;
  function startAct(type, dur, opt) {
    const p = OB.P; if (!p || p.act || p.dead) return false;
    p.act = Object.assign({ type, t: 0, dur, ev: [], x0: p.x, z0: p.z }, opt || {});
    p.swingT = 0; p.shoveT = 0; return true;
  }
  OB.startAct = startAct;
  const addR = OB.addRot;
  const R_ARM = (b, a, e) => { addR(b.RightArm, 0, 0, a); if (e) addR(b.RightForeArm, 0, 0, e); };
  const L_ARM = (b, a, e) => { addR(b.LeftArm, a, 0, 0); if (e) addR(b.LeftForeArm, e, 0, 0); };
  function crouch(C, a) { const b = C.bones; addR(b.LeftUpLeg, -1.25 * a, 0, 0); addR(b.RightUpLeg, -1.25 * a, 0, 0); addR(b.LeftLeg, 1.9 * a, 0, 0); addR(b.RightLeg, 1.9 * a, 0, 0); addR(b.Spine, 0.35 * a, 0, 0); C.obj.position.y = -0.36 * a; }
  function climbPose(C, t) { const b = C.bones, s = Math.sin(t * 9); R_ARM(b, 2.5 + s * 0.35, 0.3); L_ARM(b, 2.5 - s * 0.35, 0.3); addR(b.LeftUpLeg, -0.6 - s * 0.4, 0, 0); addR(b.RightUpLeg, -0.6 + s * 0.4, 0, 0); addR(b.LeftLeg, 0.9, 0, 0); addR(b.RightLeg, 0.9, 0, 0); }
  const ACTS = {
    vault: { clip: 'jump', ts: 0.55, pos: (p, A, k) => { const e = ss(k); p.x = A.x0 + (A.x1 - A.x0) * e; p.z = A.z0 + (A.z1 - A.z0) * e; },
      pose: (C, b, k) => { const l = Math.sin(k * Math.PI); C.obj.position.y = 0.55 * l; addR(b.Spine, 0.55 * l, 0, 0); R_ARM(b, 1.3 * l, 0.2); L_ARM(b, 1.3 * l, 0.2); addR(b.LeftUpLeg, -1.0 * l, 0, 0); addR(b.RightUpLeg, -0.7 * l, 0, 0); addR(b.LeftLeg, 1.3 * l, 0, 0); addR(b.RightLeg, 1.0 * l, 0, 0); } },
    door: { pose: (C, b, k) => { const a = bell(k, 0.35, 0.6); R_ARM(b, 1.25 * a, -0.2 * a); addR(b.Spine, 0.12 * a, 0, 0); } },
    loot: { pose: (C, b, k, A) => { const a = ss(k / 0.7); if (A.low) { crouch(C, a); R_ARM(b, 0.9 * a, 0.5 * a); L_ARM(b, 0.9 * a, 0.5 * a); } else { R_ARM(b, 1.35 * a, 0.5 * a + Math.sin(A.t * 12) * 0.15 * a); L_ARM(b, 1.2 * a, 0.5 * a); addR(b.Spine, 0.15 * a, 0, 0); } } },
    stand: { pose: (C, b, k, A) => { const a = 1 - ss(k); if (A.low) crouch(C, a); R_ARM(b, 0.9 * a, 0.5 * a); L_ARM(b, 0.9 * a, 0.5 * a); } },
    pick: { pose: (C, b, k) => { const a = bell(k, 0.45, 0.6); crouch(C, a); R_ARM(b, 1.1 * a, 0.3 * a); } },
    eat: { pose: (C, b, k, A) => { const a = bell(k, 0.25, 0.8); R_ARM(b, 1.4 * a, 1.9 * a); addR(b.Head, (0.12 + Math.sin(A.t * 16) * 0.06) * a, 0, 0); } },
    drink: { pose: (C, b, k) => { const a = bell(k, 0.25, 0.8); R_ARM(b, 1.55 * a, 1.9 * a); addR(b.Head, -0.38 * a, 0, 0); addR(b.Spine, -0.12 * a, 0, 0); } },
    bandage: { pose: (C, b, k, A) => { const a = bell(k, 0.2, 0.85); R_ARM(b, 0.95 * a, (0.9 + Math.sin(A.t * 10) * 0.3) * a); L_ARM(b, 0.95 * a, 0.9 * a); addR(b.Spine, 0.28 * a, 0, 0); addR(b.Head, 0.3 * a, 0, 0); } },
    hammer: { pose: (C, b, k) => { const ph = (k * 3) % 1, arm = ph < 0.55 ? 0.8 + 1.8 * ss(ph / 0.55) : 2.6 - 1.9 * ss((ph - 0.55) / 0.25); const a = bell(k, 0.08, 0.92); R_ARM(b, arm * a, 0.4 * a); L_ARM(b, 1.25 * a, 0.3 * a); addR(b.Spine, 0.15 * a, 0, 0); } },
    cook: { pose: (C, b, k, A) => { const a = bell(k, 0.15, 0.85); crouch(C, 0.65 * a); R_ARM(b, 1.0 * a, 0.6 * a); L_ARM(b, 0.8 * a, 0.5 * a); addR(b.Spine, 0, Math.sin(A.t * 7) * 0.25 * a, 0); } },
    work: { pose: (C, b, k, A) => { const a = bell(k, 0.15, 0.85); R_ARM(b, 1.15 * a, (0.8 + Math.sin(A.t * 13) * 0.25) * a); L_ARM(b, 1.15 * a, (0.8 + Math.cos(A.t * 11) * 0.25) * a); addR(b.Spine, 0.18 * a, 0, 0); addR(b.Head, 0.2 * a, 0, 0); } },
    reload: { pose: (C, b, k) => { const a = bell(k, 0.25, 0.75); R_ARM(b, 0.8, 0.5 * a); L_ARM(b, 1.1 * a, 1.2 * a); addR(b.Head, 0.3 * a, 0, 0); } },
    lie: { pos: (p, A, k) => { const e = ss(Math.min(1, k * 1.6)); p.x = A.x0 + (A.x1 - A.x0) * e; p.z = A.z0 + (A.z1 - A.z0) * e; p.ry = A.ry1; },
      pose: (C, b, k) => { const e = ss((k - 0.35) / 0.65); C.obj.rotation.x = -Math.PI / 2 * e; C.obj.position.y = 0.78 * e; } },
    getup: { pos: (p, A, k) => { if (k > 0.5) { const e = ss((k - 0.5) * 2); p.x = A.x0 + (A.x1 - A.x0) * e; p.z = A.z0 + (A.z1 - A.z0) * e; } },
      pose: (C, b, k) => { const e = 1 - ss(k * 1.6); C.obj.rotation.x = -Math.PI / 2 * e; C.obj.position.y = 0.78 * e; } },
    down: { pose: (C, b, k) => { const c = ss(k / 0.35), s = ss((k - 0.35) / 0.65); crouch(C, c * (1 - s)); C.obj.position.y -= 2.1 * s; if (s > 0) climbPose(C, k * 6); } },
    climbup: { pose: (C, b, k) => { C.obj.position.y = 2.2 * ss(k); climbPose(C, k * 6); } },
    climbdown: { pose: (C, b, k) => { C.obj.position.y = 2.2 * (1 - ss(k)); climbPose(C, k * 6); } },
    rise: { pose: (C, b, k) => { C.obj.position.y = -2.0 * (1 - ss(k)); if (k < 0.75) climbPose(C, k * 6); } },
    stairsdown: { clip: 'run', ts: 0.5, pos: (p, A, k) => { p.x = A.x0 + Math.sin(p.ry) * 1.6 * k; p.z = A.z0 + Math.cos(p.ry) * 1.6 * k; }, pose: (C, b, k) => { C.obj.position.y = -1.6 * ss(k); } },
    stairsup: { clip: 'run', ts: 0.5, pos: (p, A, k) => { p.x = A.x0 + Math.sin(p.ry) * 1.4 * k; p.z = A.z0 + Math.cos(p.ry) * 1.4 * k; }, pose: (C, b, k) => { C.obj.position.y = -1.4 * (1 - ss(k)); } }
  };
  function updateAct(p, dt) {
    const A = p.act, C = p.C, D = ACTS[A.type]; A.t += dt; const k = Math.min(1, A.t / A.dur);
    if (D.pos) D.pos(p, A, k);
    for (const e of A.ev) if (!e.done && k >= e.at) { e.done = true; e.fn(); }
    const clip = D.clip || 'idle'; OB.setAnim(C, clip, 0.12); C.act[clip].timeScale = D.ts || 1;
    C.root.position.set(p.x, 0, p.z); C.root.rotation.y = p.ry;
    C.obj.position.set(0, 0, 0); C.obj.rotation.set(0, 0, 0);
    C.update(dt);
    D.pose(C, C.bones, k, A);
    if (A.t >= A.dur) { const done = A.onEnd; p.act = null; if (!A.hold) { C.obj.position.set(0, 0, 0); C.obj.rotation.set(0, 0, 0); } if (done) done(); }
  }
  const face = (x, z) => { const p = OB.P; p.ry = Math.atan2(x - p.x, z - p.z); };

  // ================= 상호작용 =================
  function nearestInteract() {
    const p = OB.P, W = OB.W; let best = null, bd = 2.1;
    const fx = p.x + Math.sin(p.ry) * 0.6, fz = p.z + Math.cos(p.ry) * 0.6;
    const cand = (o, x, z, kind, label) => { const d = Math.hypot(x - fx, z - fz); if (d < bd) { bd = d; best = { o, kind, label, x, z }; } };
    for (const d of W.doors) if (Math.abs(d.x - p.x) < 3 && Math.abs(d.z - p.z) < 3) cand(d, d.x, d.z, 'door', d.broken ? null : d.open ? '문 닫기' : (d.locked ? '잠긴 문' : '문 열기'));
    for (const w of W.windows) if (Math.abs(w.x - p.x) < 3 && Math.abs(w.z - p.z) < 3) cand(w, w.x, w.z, 'window', w.broken && !w.bar ? '창문 넘어가기' : w.bar ? '판자 친 창문' : '창문');
    for (const c of W.containers) if (Math.abs(c.x - p.x) < 3 && Math.abs(c.z - p.z) < 3) cand(c, c.x, c.z, 'cont', c.kind === 'pump' ? '주유기' : `${c.name} 뒤지기`);
    for (const b of W.beds) if (Math.abs(b.x - p.x) < 3 && Math.abs(b.z - p.z) < 3) cand(b, b.x, b.z, 'bed', '잠자기');
    for (const g of OB.ground) if (Math.abs(g.x - p.x) < 2.5 && Math.abs(g.z - p.z) < 2.5) cand(g, g.x, g.z, 'ground', `${itemName(g.it)} 줍기`);
    for (const pt of W.portals || []) { const u = OB.under(); const x = u ? pt.ux : pt.x, z = u ? pt.uz : pt.z; cand(pt, x, z, 'portal', u ? pt.up : (pt.stairs ? '계단으로 지하 연구소에 내려가기' : `맨홀로 하수도에 내려가기`)); }
    const S = W.spots;
    if (S.centrifuge) cand('cent', S.centrifuge.x, S.centrifuge.z, 'cent', '원심분리기로 백신 만들기');
    if (S.boat) cand('boat', S.boat.x - 2, S.boat.z, 'boat', '쾌속정 타기');
    if (S.campfire) cand('fire', S.campfire.x, S.campfire.z, 'fire', '모닥불로 요리·물 끓이기');
    return best;
  }
  const LOW = { crate: 1, dumpster: 1, bag: 1, car: 1, toolbox: 1, mil: 1, golfbag: 1, mail: 1 };
  function interact() {
    const p = OB.P, t = nearestInteract(); if (!t || !t.label || p.act) return;
    if (t.kind === 'door') {
      const d = t.o; if (d.bar > 0) { OB.msg('판자로 막혀 있어요 (B: 판자 떼기)'); return; }
      if (d.locked) { if (hasItem('keycard')) { d.locked = false; OB.msg('출입 카드로 문을 열었어요', 'good'); OB.sfx('ui'); } else { OB.msg('잠겨 있어요. 출입 카드가 필요해요'); OB.sfx('bang'); face(d.x, d.z); startAct('door', 0.45); return; } }
      face(d.x, d.z); startAct('door', 0.45, { ev: [{ at: 0.4, fn: () => { d.open = !d.open; OB.sfx('door'); OB.noise(d.x, d.z, 3); } }] });
    } else if (t.kind === 'window') {
      const w = t.o; if (w.bar > 0) { OB.msg('판자를 쳐서 막았어요'); return; }
      if (!w.broken) { if (confirm('창문을 깰까요? (소리가 크게 나요)')) { face(w.x, w.z); startAct('door', 0.45, { ev: [{ at: 0.4, fn: () => OB.breakWindow(w) }] }); } return; }
      climb(w);
    } else if (t.kind === 'cont') {
      const c = t.o; face(c.x, c.z);
      if (c.kind === 'pump') { if (hasItem('gascan')) startAct('work', 1.4, { onEnd: () => { takeItem('gascan'); giveItem(OB.item('fuel')); OB.msg('연료통에 연료를 가득 채웠어요', 'good'); OB.sfx('drink'); quests(); } }); else OB.msg('연료를 담을 빈 연료통이 필요해요'); return; }
      const low = !!LOW[c.kind]; p.lowPose = low;
      startAct('loot', 0.55, { low, hold: true, onEnd: () => { OB.sfx('pick'); openInv(c); } });
    } else if (t.kind === 'ground') { const g = t.o; face(g.x, g.z); startAct('pick', 0.6, { ev: [{ at: 0.45, fn: () => { if (OB.ground.includes(g)) pickGround(g); } }] }); }
    else if (t.kind === 'bed') sleep(t.o);
    else if (t.kind === 'cent') { face(t.x, t.z); startAct('work', 1.5, { onEnd: centrifuge }); }
    else if (t.kind === 'portal') usePortal(t.o);
    else if (t.kind === 'boat') { face(t.x, t.z); startAct('vault', 0.9, { x1: t.x + 1.5, z1: t.z, onEnd: boat }); }
    else if (t.kind === 'fire') { face(t.x, t.z); startAct('cook', 1.6, { onEnd: () => cook(true) }); }
  }
  function usePortal(pt) {
    const p = OB.P, down = !OB.under();
    if (!pt._go) {
      const go = () => { pt._go = true; usePortal(pt); pt._go = false; };
      if (pt.stairs) startAct(down ? 'stairsdown' : 'stairsup', 0.8, { onEnd: go });
      else { face(down ? pt.x : pt.ux, down ? pt.z : pt.uz - 1.7); startAct(down ? 'down' : 'climbup', 0.9, { onEnd: go }); }
      OB.sfx('door'); return;
    }
    p.x = down ? pt.ux : pt.x; p.z = (down ? pt.uz : pt.z) + 1.2; OB._camT = null; OB.noise(p.x, p.z, 4);
    if (pt.stairs) { p.ry = 0; startAct(down ? 'stairsup' : 'stairsup', 0.7); } else if (down) { p.ry = Math.PI; startAct('climbdown', 0.9); } else startAct('rise', 0.9);
    if (down) { OB.toast(pt.stairs ? '지하 연구소' : '하수도', pt.stairs ? '비상 전원만 들어와 있어요. 랜턴(F)을 켜세요.' : '축축하고 어두워요. 감염자가 숨어 있을지 몰라요.'); learn('sewer', '하수 처리와 감염병', '하수에는 사람과 동물의 배설물 속 세균·바이러스가 많아요. 하수 처리장은 미생물로 오염 물질을 분해하고 소독해 감염병이 퍼지는 것을 막아요.'); }
    else OB.msg(`${pt.name}(으)로 올라왔어요`);
    quests();
  }
  function climb(w) {
    const p = OB.P; const nx = w.ax === 'W' ? (p.x < w.x ? 1 : -1) : 0, nz = w.ax === 'N' ? (p.z < w.z ? 1 : -1) : 0;
    // 창문 앞에 붙은 뒤 넘어감 (출발: 창문 앞 0.65m, 도착: 반대편 0.75m)
    p.x = w.x - nx * 0.65 + (w.ax === 'N' ? (p.x - w.x) * 0.3 : 0); p.z = w.z - nz * 0.65 + (w.ax === 'W' ? (p.z - w.z) * 0.3 : 0);
    face(w.x + nx, w.z + nz);
    startAct('vault', 1.0, { x1: w.x + nx * 0.75 + (p.x - w.x) * (w.ax === 'N' ? 1 : 0), z1: w.z + nz * 0.75 + (p.z - w.z) * (w.ax === 'W' ? 1 : 0), ev: [{ at: 0.45, fn: () => OB.sfx('step') }], onEnd: () => {
      OB.noise(p.x, p.z, 5); OB.msg('창문을 넘어갔어요');
      if (!w.cleared && Math.random() < 0.25) { p.hp -= 5; p.bleed += 0.3; p.wounds.push({ type: 'glass', name: '유리 상처', age: 0, chance: 0, bandaged: false, rolled: true }); OB.msg('깨진 유리에 베였어요', 'bad'); }
    } });
  }
  OB.breakWindow = function (w) { w.broken = true; w.hp = 0; OB.noise(w.x, w.z, 14, 'glass'); OB.sfx('glass', OB.P ? Math.hypot(w.x - OB.P.x, w.z - OB.P.z) : 0); };
  OB.breakDoor = function (d) { d.broken = true; d.open = true; d.bar = 0; if (d.mesh) d.mesh.visible = false; OB.noise(d.x, d.z, 14); OB.msg('어딘가에서 문이 부서지는 소리가 나요!', 'bad'); };
  OB.removeBarricade = function (o) { o.bar = Math.max(0, o.bar - 1); o.barHp = o.bar > 0 ? 50 : null; drawBars(o); OB.sfx('bang'); };
  function barricadeAction() {
    const t = nearestInteract(); if (!t || (t.kind !== 'door' && t.kind !== 'window')) { OB.msg('바리케이드는 문이나 창문 앞에서 칠 수 있어요'); return; }
    const o = t.o, p = OB.P;
    const hammer = hasItem('hammer') || hasItem('tenderizer') || (p.weapon && ITEMS[p.weapon.id].tool === 'hammer');
    if (o.bar >= 3) { OB.msg('더는 판자를 칠 수 없어요'); return; }
    if (t.kind === 'door' && o.open) { OB.msg('문을 먼저 닫아요'); return; }
    if (!hammer || countItem('planks') < 1 || countItem('nails') < 2) { OB.msg('바리케이드: 망치 + 판자 1 + 못 2가 필요해요'); return; }
    if (p.act) return; face(o.x, o.z);
    takeItem('planks', 1); takeItem('nails', 2);
    const hit = () => { OB.sfx('hammer'); OB.noise(o.x, o.z, 10); };
    startAct('hammer', 1.5, { ev: [{ at: 0.24, fn: hit }, { at: 0.57, fn: hit }, { at: 0.9, fn: hit }], onEnd: () => { o.bar++; o.barHp = 50; drawBars(o); OB.msg(`판자를 박았어요 (${o.bar}/3)`, 'good'); } });
  }
  function drawBars(o) {
    if (o.barG) { OB.scene.remove(o.barG); o.barG = null; }
    if (!o.bar) return;
    const g = new THREE.Group(); g.position.set(o.x, 0, o.z); g.rotation.y = o.ry;
    const isDoor = OB.W.doors.includes(o), pre = isDoor ? 'barricade-doorway-' : 'barricade-window-';
    for (let k = 0; k < o.bar; k++) { const m = OBA.mesh('build', pre + 'abc'[k]); m.position.x = (k % 2 ? -1 : 1) * 0.11; g.add(m); }
    OB.scene.add(g); o.barG = g;
  }
  // ---------- 보관함 · 땅 ----------
  OB.ground = [];
  function dropItem(it, x, z) {
    const d = ITEMS[it.id]; const g = { it, x: x + (Math.random() - .5) * .6, z: z + (Math.random() - .5) * .6, mesh: null };
    if (d.model) { try { const m = OBA.mesh(d.model[0], d.model[1]); m.scale.setScalar(d.model[2] || 1); m.position.set(g.x, 0.02, g.z); m.rotation.y = Math.random() * TAU; OB.scene.add(m); g.mesh = m; } catch (e) { } }
    OB.ground.push(g);
  }
  function pickGround(g) {
    const p = OB.P; if (loadOf() + OB.weightOf(g.it) > capOf() * 1.5) { OB.msg('너무 무거워요'); return; }
    giveItem(g.it); if (g.mesh) OB.scene.remove(g.mesh); OB.ground.splice(OB.ground.indexOf(g), 1); OB.sfx('pick'); OB.msg(`${itemName(g.it)}을(를) 주웠어요`); quests();
  }
  // ---------- 잠 ----------
  function sleep(bed) {
    const p = OB.P; if (p.fatigue < 25) { OB.msg('아직 졸리지 않아요'); return; }
    if (OB.zombiesNear(p.x, p.z, 14).some(z => z.state === 'chase')) { OB.msg('감염자가 가까이 있어서 잘 수 없어요'); return; }
    p.bed = { x: p.x, z: p.z };
    startAct('lie', 1.0, { x1: bed.x, z1: bed.z + 0.8, ry1: 0, hold: true, onEnd: () => { p.asleep = true; p.sleepStart = OB.minute; $('#sleep').classList.add('on'); } });
    OB.msg('잠이 들었어요... (깨려면 아무 키나)');
    learn('sleep', '잠과 면역', '잠을 자는 동안 면역세포가 만들어지고 기억이 정리돼요. 잠이 부족하면 면역력이 떨어져요.');
  }
  function wake(why) { const p = OB.P; if (!p.asleep) return; p.asleep = false; $('#sleep').classList.remove('on'); if (why) OB.msg(why, 'bad'); const b = p.bed || { x: p.x + 1.2, z: p.z }; startAct('getup', 0.9, { x1: b.x, z1: b.z }); }
  // ---------- 요리 ----------
  function cook(fire) {
    const p = OB.P;
    if (!hasItem('pot') && !hasItem('pan') && !(p.weapon && (p.weapon.id === 'pan'))) { OB.msg('냄비나 프라이팬이 필요해요'); return; }
    if (!fire && !hasItem('matches')) { OB.msg('불을 붙일 성냥이 필요해요'); return; }
    let n = 0; for (const it of [...p.inv]) { const d = ITEMS[it.id]; if ((d.raw || d.dirty) && d.cooked) { const i = p.inv.indexOf(it); p.inv[i] = OB.item(d.cooked, it.n); n++; } }
    if (!n) { OB.msg('익히거나 끓일 것이 없어요 (생고기·생선·달걀·더러운 물·호박)'); return; }
    if (!fire) { const m = p.inv.find(x => x.id === 'matches'); m.uses--; if (m.uses <= 0) p.inv.splice(p.inv.indexOf(m), 1); }
    OB.minute += 20; OB.sfx('eat'); OB.msg(`요리했어요 (${n}가지)`, 'good');
    if (!fire) playUse('cook');
    learn('cook', '가열 살균', '대부분의 세균은 70~100℃에서 단백질이 변성되어 죽어요. 그래서 음식을 익히고 물을 끓여 마셔요.');
  }
  // ================= 이야기 (목표) =================
  const QL = [
    { id: 'prep', t: '준비하기', d: '무기를 들고, 무언가를 먹거나 마셔요. (Tab: 가방)', done: s => s.q.armed && s.ate },
    { id: 'radio', t: '라디오 듣기', d: '집 안 어딘가의 휴대용 라디오를 찾아 사용해요.', done: s => s.q.radio },
    { id: 'card', t: '연구소로 가는 길 찾기', d: '경찰서 사물함의 출입 카드로 연구소 문을 열거나, 맨홀로 하수도를 지나 지하 연구소 뒷문으로 가요.', done: s => s.q.card || s.q.underLab, mark: 'police' },
    { id: 'lab', t: '지하 연구소 조사', d: '연구소 계단(또는 하수도)으로 지하 연구소에 내려가 수석 연구원의 연구 노트를 읽어요.', done: s => s.q.notes, mark: 'ulab' },
    { id: 'vaccine', t: '백신 만들기', d: '감염자 혈액 샘플 3개(주사기: 병원) + 세포 배양액(지하 연구소 냉장 보관고·공장) → 지하 연구소 원심분리기.', done: s => s.q.vaccine, mark: 'centrifuge' },
    { id: 'escape', t: '탈출하기', d: '보트 열쇠(항구 사무소)와 연료(주유소 주유기 + 빈 연료통)를 챙겨 항구의 쾌속정으로!', done: s => s.q.escaped, mark: 'boat' }
  ];
  function curQuest() { const s = OB.state; return QL.find(q => !q.done(s)); }
  function quests() {
    const s = OB.state, p = OB.P; if (!p) return;
    if (p.weapon) s.q.armed = true;
    if (hasItem('keycard')) s.q.card = true;
    if (OB.under() && OB.W.ground[OB.cellOf(p.x, p.z)[1] * OBW.N + OB.cellOf(p.x, p.z)[0]] === OBW.GR.ulab) s.q.underLab = true;
    if (hasItem('notes') && !s.q.notesRead) { }
    const q = curQuest(); const k = q ? q.id : 'done';
    if (s.lastQ !== k) { if (s.lastQ) OB.toast(q ? '새 목표: ' + q.t : '모든 목표 완료!', q ? q.d : '계속 살아남아 보세요'); s.lastQ = k; }
    const el = $('#quest'); el.innerHTML = q ? `<b>${q.t}</b><span>${q.d}</span>` : '<b>자유 생존</b><span>최대한 오래 살아남아요</span>';
    if (q && q.id === 'vaccine') el.innerHTML += `<span class="qp">샘플 ${countItem('sample')}/3 · 배양액 ${hasItem('medium') ? 1 : 0}/1</span>`;
    if (q && q.id === 'escape') el.innerHTML += `<span class="qp">열쇠 ${hasItem('boatkey') ? '✔' : '✘'} · 연료 ${hasItem('fuel') ? '✔' : '✘'}</span>`;
  }
  function radioBroadcast() {
    OB.sfx('radio'); OB.state.q.radio = true;
    dialog('📡 긴급 방송', `<p>"...여기는 바이오 연구소의 한 박사입니다. 이 도시에 퍼진 바이러스는 <b>물리거나 할퀸 상처</b>로 옮습니다."</p>
      <p>"연구소에 백신 연구 자료가 남아 있습니다. <b>경찰서</b>에 연구소 출입 카드를 맡겨 두었어요. 감염자의 혈액 샘플과 배양액이 있으면 <b>원심분리기</b>로 백신을 만들 수 있습니다."</p>
      <p>"백신을 만들면 <b>항구</b>의 쾌속정으로 도시를 빠져나가세요. 밤에는 감염자들이 더 활발해집니다. 행운을 빕니다..."</p>`);
    quests();
  }
  function readNotes() {
    OB.state.q.notes = true;
    dialog('📋 연구 노트', `<p><b>바이러스 'XV-9'의 특징</b></p><ul>
      <li>바이러스는 스스로 물질대사를 못 해요. <b>숙주 세포</b>에 들어가 세포의 리보솜과 효소로 자신을 복제해요.</li>
      <li>XV-9는 신경세포를 공격해 공격성을 높이고, 침 속 바이러스로 물린 상처를 통해 옮겨요.</li>
      <li>잠복기 → 발열 → 의식 저하 순서로 진행돼요. <b>항바이러스제</b>는 복제를 늦출 뿐 완치하지 못해요.</li></ul>
      <p><b>백신 만들기</b>: 감염자 혈액 3개에서 바이러스를 분리(원심분리)하고, 배양액에서 약하게 키운 뒤 비활성화하면 <b>불활성화 백신</b>이 돼요.</p>`);
    learn('virus', '바이러스는 살아 있을까?', '바이러스는 유전 물질과 단백질 껍질로만 되어 있어 혼자서는 증식하지 못하고, 숙주 세포 안에서만 증식해요. 그래서 생물과 무생물의 중간 특성을 가진다고 해요.');
    quests();
  }
  function centrifuge() {
    const s = OB.state; if (s.q.vaccine) { OB.msg('이미 백신을 만들었어요'); return; }
    if (!s.q.notes) { OB.msg('먼저 연구 노트를 읽어 방법을 알아봐요'); return; }
    if (countItem('sample') < 3 || !hasItem('medium')) { OB.msg(`재료가 부족해요 (샘플 ${countItem('sample')}/3, 배양액 ${hasItem('medium') ? 1 : 0}/1)`); return; }
    takeItem('sample', 3); takeItem('medium', 1); for (let k = 0; k < 3; k++) giveItem(OB.item('vaccine'));
    OB.minute += 60; s.q.vaccine = true; OB.sfx('win'); OB.toast('백신 3개 완성!', '가방에서 사용하면 접종해요');
    quests();
  }
  function boat() {
    const s = OB.state; if (!hasItem('boatkey')) { OB.msg('보트 열쇠가 필요해요 (항구 사무소)'); return; }
    if (!hasItem('fuel')) { OB.msg('연료가 없어요 (빈 연료통 → 주유소 주유기)'); return; }
    s.q.escaped = true; victory();
  }
  // ================= 매 프레임: 플레이어 =================
  const _mv = [0, 0];
  function updatePlayer(dt) {
    const p = OB.P, K = OB.keys, C = p.C;
    if (p.dead) { C.obj.rotation.x = Math.max(-Math.PI / 2, C.obj.rotation.x - dt * 3); C.update(dt * 0.3); return; }
    if (p.act) { updateAct(p, dt); p.inside = OB.bldAt(p.x, p.z); return; }
    if (p.asleep) { OB.setAnim(C, 'idle'); C.act.idle.timeScale = 0.4; C.update(dt); C.obj.rotation.x = -Math.PI / 2; C.obj.position.y = 0.78; return; }
    C.obj.position.set(0, 0, 0); C.obj.rotation.set(0, 0, 0);
    let sx = 0, sy = 0;
    if (K.KeyW || K.ArrowUp) sy -= 1; if (K.KeyS || K.ArrowDown) sy += 1; if (K.KeyA || K.ArrowLeft) sx -= 1; if (K.KeyD || K.ArrowRight) sx += 1;
    if (OB.joy && (OB.joy.x || OB.joy.y)) { sx = OB.joy.x; sy = OB.joy.y; }
    const L = Math.hypot(sx, sy); if (L > 1) { sx /= L; sy /= L; }
    const [wx, wz] = OB.screenToWorld(sx, sy);
    const wantRun = (K.ShiftLeft || K.ShiftRight || OB.runToggle) && p.stamina > 2 && !p.sneak;
    const over = loadOf() > capOf() ? clamp(1 - (loadOf() - capOf()) / capOf(), 0.45, 1) : 1;
    let spd = (wantRun ? 4.4 : p.sneak ? 1.25 : 2.3) * over * (p.hp < 25 ? 0.8 : 1) * (p.fatigue > 85 ? 0.85 : 1) * (p.swingT > 0 ? 0.55 : 1);
    const moving = L > 0.1;
    // 바라보는 방향: 마우스 (PC) / 이동 방향
    if (OB.mouse.used && !OB.touch) { const g = OB.pickGround(OB.mouse.x, OB.mouse.y); if (g) p.ry = Math.atan2(g[0] - p.x, g[1] - p.z); }
    else if (moving && p.swingT <= 0) p.ry += OB.angDiff(p.ry, Math.atan2(wx, wz)) * Math.min(1, dt * 12);
    if (moving) {
      OB.move(p, wx * spd * dt, wz * spd * dt, p.r, 'p');
      p.stepT = (p.stepT || 0) - dt * (wantRun ? 1.7 : 1);
      if (p.stepT <= 0) { p.stepT = 0.42; OB.sfx('step'); OB.noise(p.x, p.z, wantRun ? 9 : p.sneak ? 1.2 : 3.5); }
      if (wantRun) p.stamina -= dt * 9; p.moved += spd * dt;
    }
    p.stamina = clamp(p.stamina + dt * (moving ? (wantRun ? 0 : 5) : 11) * (p.hunger > 80 ? 0.5 : 1), 0, 100);
    // 휘두르기
    const w = p.swingW;
    if (p.swingT > 0) { p.swingT += dt; if (!p.swingDone && p.swingT > w.spd * 0.45) { p.swingDone = true; doMeleeHit(p, w); } if (p.swingT > w.spd) p.swingT = 0; }
    if (p.shoveT > 0) p.shoveT -= dt; if (p.gunT > 0) p.gunT -= dt; if (p.hitT > 0) p.hitT -= dt;
    if (OB.mouse.down && p.weapon && ITEMS[p.weapon.id].id === 'blasterC') OB.onAttack();
    // 애니메이션
    C.root.position.set(p.x, 0, p.z); C.root.rotation.y = p.ry;
    // 이동 방향과 바라보는 방향이 다르면(뒷걸음) 느리게 재생
    OB.setAnim(C, moving ? 'run' : 'idle', 0.18);
    C.act.run.timeScale = wantRun ? 1.1 : p.sneak ? 0.45 : 0.68;
    C.update(dt);
    const b = C.bones;
    if (p.sneak) { OB.addRot(b.Spine, 0.35, 0, 0); OB.addRot(b.Head, -0.2, 0, 0); }
    if (p.weapon && ITEMS[p.weapon.id].kind === 'gun') { OB.addRot(b.RightArm, 0, 0, 1.4); if (ITEMS[p.weapon.id].two) OB.addRot(b.LeftArm, 1.3, 0, 0); }
    else if (p.weapon && p.swingT <= 0) OB.addRot(b.RightArm, 0, 0, 0.35);
    if (p.swingT > 0) {
      // 팔 각도: 0→머리 위로 들기(2.7)→앞으로 내려치기(0.5)→원위치
      const k = p.swingT / w.spd;
      const arm = k < 0.4 ? 2.7 * (k / 0.4) : k < 0.62 ? 2.7 - 2.2 * ((k - 0.4) / 0.22) : 0.5 * (1 - (k - 0.62) / 0.38);
      const tw = k < 0.4 ? -0.45 * (k / 0.4) : k < 0.62 ? -0.45 + 0.95 * ((k - 0.4) / 0.22) : 0.5 * (1 - (k - 0.62) / 0.38);
      OB.addRot(b.RightArm, 0, 0, arm);
      OB.addRot(b.Spine, k > 0.4 && k < 0.7 ? 0.25 : 0.05, tw, 0);
      if (w.two) OB.addRot(b.LeftArm, arm * 0.85, 0, 0);
    }
    if (p.shoveT > 0) { const k = 1 - p.shoveT / 0.55, s = Math.sin(Math.min(1, k * 2) * Math.PI); OB.addRot(b.LeftArm, 1.5 * s, 0, 0); OB.addRot(b.RightArm, 0, 0, 1.5 * s); OB.addRot(b.Spine, 0.3 * s, 0, 0); }
    if (p.hitT > 0) OB.addRot(b.Spine, -0.35 * p.hitT / 0.3, 0, 0);
    p.inside = OB.bldAt(p.x, p.z);
  }
  // ---------- 생존 수치 (게임 1분마다) ----------
  function tickStats(gm) {
    const p = OB.P; if (p.dead) return;
    const sleeping = p.asleep;
    p.hunger = clamp(p.hunger + gm * 0.042 * (p.sick > 0 ? 1.3 : 1), 0, 100);
    p.thirst = clamp(p.thirst + gm * 0.062 * (p.sick > 0 ? 1.6 : 1) * (p.temp > 37.6 ? 1.3 : 1), 0, 100);
    p.fatigue = clamp(p.fatigue + gm * (sleeping ? -0.22 : 0.068 * (p.infected && p.virus > 20 ? 1.4 : 1)), 0, 100);
    // 출혈
    if (p.bleed > 0) { p.hp -= gm * 0.06 * p.bleed; p.bleed = Math.max(0, p.bleed - gm * 0.002); }
    // 상처 판정 (30분 뒤 감염 여부 결정)
    for (const w of p.wounds) {
      w.age += gm;
      if (!w.rolled && w.age > 30) { w.rolled = true; if (Math.random() < w.chance) { if (!p.infected) { p.infected = true; p.virus = Math.max(p.virus, 1); } } }
    }
    p.wounds = p.wounds.filter(w => w.age < 60 * 24 * 2);
    // 면역력: 영양 균형 + 잠 + 굶주림
    const kinds = ['carb', 'prot', 'fat', 'vit'].filter(k => p.nutr[k] >= 1).length;
    let target = 45 + kinds * 9 + (p.fatigue < 60 ? 8 : -6) - (p.hunger > 75 ? 15 : 0) - (p.thirst > 75 ? 10 : 0) + (p.vaccinated ? 15 : 0);
    p.immunity += (clamp(target, 15, 100) - p.immunity) * Math.min(1, gm * 0.004);
    for (const k in p.nutr) p.nutr[k] = Math.max(0, p.nutr[k] - gm * 0.0028);   // 하루면 약 4 감소
    // 바이러스
    if (p.infected) {
      const rate = 0.03 * (1.25 - p.immunity / 130) * (p.antiviral > 0 ? 0.25 : 1);
      p.virus = clamp(p.virus + gm * rate * (1 + p.virus / 60), 0, 100);
      if (p.virus > 20) p.temp = Math.min(40.2, 37.4 + (p.virus - 20) / 30 - (p.painT > 0 ? 1 : 0));
      if (p.virus > 55) p.hp -= gm * 0.02;
      if (p.virus >= 100) { die('바이러스가 온몸에 퍼져 의식을 잃었어요...'); return; }
      if (p.virus > 20 && !LEARN.fever) learn('fever', '열이 나는 이유', '면역세포가 바이러스를 발견하면 신호물질(사이토카인)을 내보내고, 뇌의 체온 조절 중추가 체온을 높여요. 높은 체온은 병원체 증식을 억제해요.');
    } else p.temp += (36.6 - p.temp) * Math.min(1, gm * 0.02);
    if (p.antiviral > 0) p.antiviral -= gm; if (p.painT > 0) p.painT -= gm; if (p.sick > 0) { p.sick -= gm; p.hp -= gm * 0.01; }
    // 굶주림·탈수
    if (p.hunger > 90) p.hp -= gm * 0.03; if (p.thirst > 90) p.hp -= gm * 0.05;
    // 회복
    if (p.hunger < 70 && p.thirst < 70 && p.bleed <= 0 && !(p.infected && p.virus > 55)) p.hp = Math.min(100, p.hp + gm * (sleeping ? 0.08 : 0.025) * (p.immunity / 70));
    // 음식 상하기
    const age = it => { if (it.age != null) it.age += gm / 1440; };
    p.inv.forEach(age); for (const c of OB.W.containers) if (c.items) c.items.forEach(it => { if (it.age != null) it.age += gm / 1440 * ((c.kind === 'fridge' || c.kind === 'freezer') && OB.day() <= 3 ? 0.25 : 1); });
    if (p.hp <= 0) die(p.thirst > 90 ? '탈수로 쓰러졌어요' : p.hunger > 90 ? '굶주림으로 쓰러졌어요' : '상처가 너무 깊었어요');
  }
  // ================= 끝 =================
  function die(why) {
    const p = OB.P; if (p.dead) return; p.dead = true; wake(); OB.sfx('kill');
    setTimeout(() => endScreen(false, why), 1600);
  }
  function victory() { OB.sfx('win'); endScreen(true, '쾌속정을 타고 감염 도시를 빠져나왔어요!'); }
  function score() { const p = OB.P, days = (OB.minute - 9 * 60) / 1440; const qd = QL.filter(q => q.done(OB.state)).length; return { days, kills: p.kills, qd, pts: Math.round(days * 1000 + p.kills * 15 + qd * 600 + (OB.state.q.escaped ? 5000 : 0)) }; }
  function endScreen(win, why) {
    OB.state.screen = 'end'; const s = score();
    try { localStorage.removeItem(SAVE); } catch (e) { }
    const st = loadStats(); st.plays = (st.plays || 0) + 1; st.bestDays = Math.max(st.bestDays || 0, +s.days.toFixed(2)); st.best = Math.max(st.best || 0, s.pts); if (win) st.escapes = (st.escapes || 0) + 1; saveStats(st);
    $('#endT').textContent = win ? '탈출 성공!' : '감염 도시에서 쓰러졌어요';
    $('#endS').textContent = why;
    $('#endD').innerHTML = `<div><b>${s.days.toFixed(1)}</b>일 생존</div><div><b>${s.kills}</b> 감염자 진정</div><div><b>${s.qd}</b>/6 목표</div><div><b>${s.pts.toLocaleString()}</b>점</div>`;
    $('#endL').innerHTML = Object.values(OB.state.learned).slice(-6).map(l => `<li><b>${l.title}</b> ${l.text}</li>`).join('') || '<li>가방의 음식·약을 눌러 생명과학 이야기를 읽어 보세요</li>';
    show('#end'); $('#hud').classList.remove('on'); $('#touch').classList.remove('on');
    try { window.BioGoal && BioGoal.result('outbreak', +s.days.toFixed(1), { text: `${s.days.toFixed(1)}일 생존 · ${s.pts.toLocaleString()}점`, ok: win || undefined }); } catch (e) { }
  }
  const loadStats = () => { try { return JSON.parse(localStorage.getItem(STAT) || '{}') || {}; } catch (e) { return {}; } };
  const saveStats = s => { try { localStorage.setItem(STAT, JSON.stringify(s)); } catch (e) { } };

  // ================= 저장 =================
  function save() {
    if (!OB.P || OB.P.dead || OB.state.screen === 'end' || OB.state.screen === 'title') return;
    const p = OB.P, W = OB.W;
    const d = {
      v: 1, seed: W.seed, minute: OB.minute, skin: p.skin, state: { q: OB.state.q, ate: OB.state.ate, learned: OB.state.learned, lastQ: OB.state.lastQ },
      p: { x: p.x, z: p.z, ry: p.ry, hp: p.hp, hunger: p.hunger, thirst: p.thirst, fatigue: p.fatigue, stamina: p.stamina, virus: p.virus, infected: p.infected, immunity: p.immunity, bleed: p.bleed, wounds: p.wounds, sick: p.sick, temp: p.temp, inv: p.inv, weapon: p.weapon, bag: p.bag, off: p.off, face: p.face, nutr: p.nutr, kills: p.kills, antiviral: p.antiviral, vaccinated: p.vaccinated, sneak: p.sneak },
      cont: W.containers.map(c => c.items), doors: W.doors.map(d => [d.open ? 1 : 0, d.hp, d.bar, d.broken ? 1 : 0, d.locked ? 1 : 0]), wins: W.windows.map(w => [w.broken ? 1 : 0, w.bar]),
      z: OB.Z.filter(z => z.state !== 'dead').map(z => [Math.round(z.x * 10) / 10, Math.round(z.z * 10) / 10, z.type[0], Math.round(z.hp)]),
      ground: OB.ground.map(g => [g.it, g.x, g.z]), hordeDay: OB.state.hordeDay
    };
    try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) { }
  }
  OB.save = save;
  function loadSave() { try { const d = JSON.parse(localStorage.getItem(SAVE) || 'null'); return d && d.v === 1 ? d : null; } catch (e) { return null; } }

  // ================= 화면 (HUD) =================
  let hudT = 0;
  function bar(id, v, warn) { const el = $(id); el.style.setProperty('--v', clamp(v, 0, 100) + '%'); el.classList.toggle('warn', !!warn); }
  function refreshHUD(force) {
    const p = OB.P; if (!p) return; hudT -= 1; if (hudT > 0 && !force) return; hudT = 6;
    $('#clock').textContent = fmtTime() + (OB.isNight() ? ' 🌙' : ' ☀️');
    const un = OB.under(); const zone = OB.W.zones.filter(z => !!z.under === un).reduce((a, z) => { const d = Math.hypot(z.i * 2 - p.x, z.j * 2 - p.z); return d < a[1] ? [z.name, d] : a; }, ['', 1e9]);
    $('#place').textContent = p.inside >= 0 ? OB.W.buildings[p.inside].name : zone[0];
    bar('#bHp', p.hp, p.hp < 30); bar('#bFood', 100 - p.hunger, p.hunger > 70); bar('#bWater', 100 - p.thirst, p.thirst > 70); bar('#bSleep', 100 - p.fatigue, p.fatigue > 75); bar('#bSta', p.stamina, p.stamina < 20);
    bar('#bImm', p.immunity, p.immunity < 40);
    const md = [];
    if (p.bleed > 0.05) md.push(['bad', '🩸 출혈']);
    if (p.wounds.some(w => !w.rolled)) md.push(['warn', '💊 상처 (소독하세요)']);
    if (p.infected && p.virus > 20) md.push(['bad', `😷 발열 ${p.temp.toFixed(1)}℃`]); else if (p.infected && p.virus > 5) md.push(['warn', '😐 몸이 이상해요']);
    if (p.infected && p.virus > 55) md.push(['bad', '☣️ 중증 감염']);
    if (p.sick > 0) md.push(['warn', '😷 배탈']);
    if (p.hunger > 70) md.push(['warn', '🍽️ 배고픔']); if (p.thirst > 70) md.push(['warn', '💧 목마름']); if (p.fatigue > 75) md.push(['warn', '💤 졸림']);
    if (loadOf() > capOf()) md.push(['warn', '🎒 너무 무거움']);
    if (p.vaccinated) md.push(['good', '💉 백신 접종']); if (p.antiviral > 0) md.push(['good', '💊 항바이러스제']);
    if (p.sneak) md.push(['', '🥷 살금살금']);
    $('#moodles').innerHTML = md.map(([c, t]) => `<span class="${c}">${t}</span>`).join('');
    // 무기
    const w = p.weapon ? ITEMS[p.weapon.id] : ITEMS.fists;
    $('#wpn').innerHTML = `${p.weapon && OB.icon(p.weapon.id) ? `<img src="${OB.icon(p.weapon.id)}">` : '<i>✋</i>'}<b>${w.name}</b><small>${w.kind === 'gun' ? `다트 ${p.weapon.ammo}/${w.mag} (+${countItem('darts')})` : p.weapon && p.weapon.dur != null ? `내구도 ${p.weapon.dur}/${w.dur}` : ''}</small>`;
    $('#hot').innerHTML = quickList().map((it, i) => `<button data-q="${i}" title="${itemName(it)}">${OB.icon(it.id) ? `<img src="${OB.icon(it.id)}">` : ''}<i>${i + 1}</i></button>`).join('');
    const t = nearestInteract();
    $('#prompt').innerHTML = t && t.label ? `<b>E</b> ${t.label}${(t.kind === 'door' || t.kind === 'window') && !(t.o.broken && t.kind === 'door') ? ' · <b>B</b> 판자 박기' : ''}` : '';
    $('#prompt').style.display = t && t.label ? '' : 'none';
    $('#bUse').classList.toggle('hot', !!(t && t.label));
    drawMini();
  }
  // ---------- 미니맵 ----------
  const GCOL = ['#5a8a4a', '#3a3e46', '#8a8a86', '#c8b89a', '#3a7ab0', '#e0cc90', '#8a6a4a', '#6aa858', '#c0ccd8', '#6a5a4a', '#a07850', '#d8dce0', '#2a5a90', '#6a7060', '#9a6a44', '#a8b4cc', '#101318'];
  let miniBase = null;
  function buildMiniBase() {
    const W = OB.W, N = OBW.N, c = document.createElement('canvas'); c.width = c.height = N * 2; const g = c.getContext('2d');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { g.fillStyle = W.bld[j * N + i] >= 0 ? '#b8a890' : W.solidC[j * N + i] && W.ground[j * N + i] < 4 ? '#e0dcd0' : GCOL[W.ground[j * N + i]] || '#5a8a4a'; g.fillRect(i * 2, j * 2, 2, 2); }
    miniBase = c;
  }
  function drawMini() {
    const cv = $('#mini'), g = cv.getContext('2d'), p = OB.P, W = 140, s = 3; if (!miniBase) buildMiniBase();
    g.save(); g.clearRect(0, 0, W, W); g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, TAU); g.clip();
    g.fillStyle = '#223'; g.fillRect(0, 0, W, W);
    g.translate(W / 2, W / 2); g.rotate(-Math.PI / 4); g.scale(s / 2 * 0.5 * 2, s / 2 * 0.5 * 2); g.translate(-p.x, -p.z);
    g.imageSmoothingEnabled = false; g.drawImage(miniBase, 0, 0, OBW.N * 2, OBW.N * 2);
    g.fillStyle = '#ff3a3a'; for (const z of OB.Z) if (z.state !== 'dead' && z.vis > 0.5) { g.fillRect(z.x - 0.6, z.z - 0.6, 1.2, 1.2); }
    const q = curQuest(); const mk = q && q.mark && markPos(q.mark); if (mk) { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(mk[0], mk[1], 3, 0, TAU); g.fill(); }
    g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(W / 2, W / 2, 3.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, TAU); g.stroke();
  }
  function markPos(k) {
    const S = OB.W.spots[k]; if (!S) return null; const pos = S.x != null ? [S.x, S.z] : [S.i * 2 + 1, S.j * 2 + 1];
    const tu = OB.W.isUnder(pos[0]), pu = OB.under();
    if (tu && !pu) { const st = (OB.W.portals || []).find(p => p.stairs); return st ? [st.x, st.z] : pos; }   // 지하 목표 → 연구소 계단
    if (!tu && pu) { const P = OB.P; const near = (OB.W.portals || []).reduce((a, p) => Math.hypot(p.ux - P.x, p.uz - P.z) < Math.hypot(a.ux - P.x, a.uz - P.z) ? p : a); return [near.ux, near.uz]; }
    return pos;
  }

  // ================= 창(패널) =================
  function show(sel) { $$('.scr').forEach(e => e.classList.remove('on')); if (sel) $(sel).classList.add('on'); }
  function closePanels() {
    $$('.panel').forEach(e => e.classList.remove('on')); OB.state.screen = 'play'; OB.paused = false; OB.state.cont = null;
    const p = OB.P; if (!p || p.dead) return;
    if (p.lowPose != null) { const low = p.lowPose; p.lowPose = null; p.act = null; startAct('stand', 0.35, { low }); }
    if (p.queueAct) { const q = p.queueAct; p.queueAct = null; if (p.act) { const prev = p.act.onEnd; p.act.onEnd = () => { prev && prev(); startAct(q, 1.0); }; } else startAct(q, 1.0); }
  }
  OB.closePanels = closePanels;
  function panel(sel) { $$('.panel').forEach(e => e.classList.remove('on')); $(sel).classList.add('on'); OB.state.screen = 'panel'; OB.paused = true; }
  function dialog(title, html) { $('#dlgT').textContent = title; $('#dlgB').innerHTML = html; panel('#dlg'); }
  OB.dialog = dialog;
  // ---------- 가방 ----------
  let selIt = null;
  function openInv(cont) {
    const c = cont || null; OB.state.cont = c;
    if (c) { OB.fillContainer(c, R); if (!c.seen) { c.seen = true; OB.minute += 2; } }
    selIt = null; renderInv(); panel('#inv');
  }
  function invRow(it, where) {
    const d = ITEMS[it.id]; const ic = OB.icon(it.id);
    const extra = d.stack ? ` ×${it.n}` : it.dur != null ? ` (${it.dur})` : d.mag ? ` [${it.ammo}/${d.mag}]` : '';
    return `<button class="it ${spoiled(it) ? 'spoil' : ''} ${selIt === it ? 'sel' : ''}" data-w="${where}">${ic ? `<img src="${ic}">` : '<img>'}<span>${itemName(it)}${extra}</span><small>${OB.weightOf(it).toFixed(1)}kg</small></button>`;
  }
  function renderInv() {
    const p = OB.P, c = OB.state.cont;
    const eq = [['weapon', '손'], ['off', '보조'], ['bag', '가방'], ['face', '얼굴']].map(([k, n]) => `<div class="eq">${n}: ${p[k] ? `<button class="it eqb" data-eq="${k}">${OB.icon(p[k].id) ? `<img src="${OB.icon(p[k].id)}">` : ''}<span>${ITEMS[p[k].id].name}</span></button>` : '<em>없음</em>'}</div>`).join('');
    $('#invMine').innerHTML = `<h3>내 가방 <small>${loadOf().toFixed(1)} / ${capOf()}kg</small></h3><div class="eqs">${eq}</div>` + (p.inv.map(it => invRow(it, 'm')).join('') || '<p class="emp">비어 있어요</p>');
    if (c) $('#invOther').innerHTML = `<h3>${c.name} <button class="mini" id="takeAll">모두 가져오기</button></h3>` + (c.items.map(it => invRow(it, 'c')).join('') || '<p class="emp">비어 있어요</p>');
    else {
      const near = OB.ground.filter(g => Math.hypot(g.x - p.x, g.z - p.z) < 2.5);
      $('#invOther').innerHTML = `<h3>바닥</h3>` + (near.map(g => invRow(g.it, 'g')).join('') || '<p class="emp">주변 바닥에 떨어진 물건이 없어요.<br>보관함(냉장고·선반·수납장·자동차…) 앞에서 E를 눌러 뒤져 보세요.</p>');
    }
    // 선택한 아이템 정보
    const info = $('#invInfo');
    if (selIt) {
      const it = selIt.it, d = ITEMS[it.id], where = selIt.w;
      const nut = d.nutr ? Object.entries(d.nutr).map(([k, v]) => `${{ carb: '탄수화물', prot: '단백질', fat: '지방', vit: '비타민·무기질' }[k]} ${'●'.repeat(v)}`).join(' · ') : '';
      const stats = d.kind === 'weapon' ? `공격력 ${d.dmg} · 거리 ${d.rng}m · 넘어뜨림 ${(d.kd * 100) | 0}%` : d.kind === 'gun' ? `공격력 ${d.dmg} · 사거리 ${d.rng}m · 장탄 ${d.mag} · 소음 큼` : (d.hunger ? `배고픔 -${d.hunger} ` : '') + (d.thirst ? `목마름 -${d.thirst}` : '');
      const acts = [];
      if (where === 'm') {
        if (d.kind === 'food') acts.push(['use', '먹기']); if (d.kind === 'drink') acts.push(['use', '마시기']); if (d.kind === 'med' || d.use) acts.push(['use', '사용']);
        if (d.kind === 'weapon' || d.kind === 'gun') acts.push(['use', '손에 들기']); if (d.kind === 'wear' || d.kind === 'bag') acts.push(['use', '착용']);
        if (it.id === 'notes') acts.push(['use', '읽기']);
        acts.push(c ? ['put', '넣기'] : ['drop', '내려놓기']);
      } else if (where === 'eq') acts.push(['unequip', '벗기']);
      else acts.push(['take', '가져오기']);
      info.innerHTML = `<div class="ii">${OB.icon(it.id) ? `<img src="${OB.icon(it.id)}">` : ''}<div><b>${itemName(it)}</b><small>${stats}</small>${nut ? `<small>${nut}</small>` : ''}${d.spoil ? `<small>${spoiled(it) ? '상했어요!' : `신선도 ${Math.max(0, d.spoil - (it.age || 0)).toFixed(1)}일 남음`}</small>` : ''}</div></div>${d.note ? `<p class="note">📖 ${d.note}</p>` : ''}<div class="acts">${acts.map(([a, t]) => `<button class="btn sm" data-act="${a}">${t}</button>`).join('')}</div>`;
    } else info.innerHTML = '<p class="emp">물건을 누르면 정보와 할 수 있는 일이 나와요.<br>음식·약의 📖 생명과학 설명도 읽어 보세요!</p>';
    // 만들기
    const can = [];
    can.push(`<button class="btn sm" data-craft="cook">🔥 요리·물 끓이기 <small>(조리대/모닥불 근처 · 냄비·성냥)</small></button>`);
    $('#craft').innerHTML = can.join('');
  }
  function invClick(e) {
    const p = OB.P, c = OB.state.cont;
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'takeAll' && c) { for (const it of [...c.items]) { if (loadOf() + OB.weightOf(it) > capOf() * 1.5) { OB.msg('너무 무거워요'); break; } giveItem(it); c.items.splice(c.items.indexOf(it), 1); } OB.sfx('pick'); quests(); renderInv(); return; }
    if (b.dataset.craft === 'cook') { const nearFire = OB.W.spots.campfire && Math.hypot(OB.W.spots.campfire.x - p.x, OB.W.spots.campfire.z - p.z) < 3; const nearKitchen = OB.W.containers.some(k => k.kind === 'counter' && Math.hypot(k.x - p.x, k.z - p.z) < 2.5); if (!nearFire && !nearKitchen) { OB.msg('부엌 조리대나 모닥불 근처에서 할 수 있어요'); return; } cook(nearFire); renderInv(); return; }
    if (b.dataset.eq) { selIt = { it: p[b.dataset.eq], w: 'eq', slot: b.dataset.eq }; renderInv(); return; }
    if (b.dataset.w) {
      const where = b.dataset.w, list = where === 'm' ? p.inv : where === 'c' ? c.items : OB.ground.filter(g => Math.hypot(g.x - p.x, g.z - p.z) < 2.5).map(g => g.it);
      const idx = [...b.parentNode.querySelectorAll('button.it[data-w="' + where + '"]')].indexOf(b);
      selIt = { it: list[idx], w: where }; OB.sfx('ui'); renderInv(); return;
    }
    if (b.dataset.act && selIt) {
      const it = selIt.it, a = b.dataset.act;
      if (a === 'use') { useItem(it); if (OB.state.screen === 'panel' && $('#inv').classList.contains('on')) { selIt = p.inv.includes(it) ? selIt : null; renderInv(); } }
      else if (a === 'drop') { p.inv.splice(p.inv.indexOf(it), 1); dropItem(it, p.x, p.z); selIt = null; renderInv(); }
      else if (a === 'put') { p.inv.splice(p.inv.indexOf(it), 1); c.items.push(it); selIt = null; renderInv(); }
      else if (a === 'take') {
        if (loadOf() + OB.weightOf(it) > capOf() * 1.5) { OB.msg('너무 무거워요'); return; }
        if (selIt.w === 'c') c.items.splice(c.items.indexOf(it), 1); else { const g = OB.ground.find(g => g.it === it); if (g) { if (g.mesh) OB.scene.remove(g.mesh); OB.ground.splice(OB.ground.indexOf(g), 1); } }
        giveItem(it); OB.sfx('pick'); selIt = null; quests(); renderInv();
      }
      else if (a === 'unequip') { const k = selIt.slot; p.inv.push(p[k]); p[k] = null; if (k === 'weapon') OB.attachWeapon(p); selIt = null; renderInv(); }
      refreshHUD(true);
    }
  }
  function openJournal() {
    const s = OB.state; const L = Object.values(s.learned);
    $('#jrQ').innerHTML = QL.map(q => `<li class="${q.done(s) ? 'ok' : q === curQuest() ? 'cur' : ''}"><b>${q.done(s) ? '✔' : q === curQuest() ? '▶' : '·'} ${q.t}</b><span>${q.d}</span></li>`).join('');
    $('#jrL').innerHTML = L.length ? L.map(l => `<li><b>${l.title}</b>${l.text}</li>`).join('') : '<li>아직 기록이 없어요. 음식·약을 쓰거나 다치면 기록이 늘어나요.</li>';
    const p = OB.P;
    $('#jrB').innerHTML = `<div>체온 <b>${p.temp.toFixed(1)}℃</b></div><div>면역력 <b>${p.immunity | 0}</b></div><div>영양 ${['carb', 'prot', 'fat', 'vit'].map(k => `<span class="${p.nutr[k] >= 1 ? 'ok' : ''}">${{ carb: '탄', prot: '단', fat: '지', vit: '비' }[k]}</span>`).join('')}</div><div>상처 <b>${p.wounds.length}</b></div><div>진정시킨 감염자 <b>${p.kills}</b></div>`;
    panel('#journal');
  }
  function openMap() {
    if (!miniBase) buildMiniBase();
    const cv = $('#mapC'), g = cv.getContext('2d'), un = OB.under(), U = OB.W.UND, S = Math.min(innerWidth * 0.86, innerHeight * 0.74) | 0;
    const ox = un ? U.x0 : 0, oz = un ? U.z0 : 0, vw = un ? U.x1 - U.x0 : OBW.CN * 2, vh = un ? U.z1 - U.z0 : OBW.CN * 2;
    cv.width = un ? Math.round(S * vw / vh) : S; cv.height = S; const k = S / vh;
    g.imageSmoothingEnabled = false; g.drawImage(miniBase, ox, oz, vw, vh, 0, 0, vw * k, vh * k); g.translate(-ox * k, -oz * k);
    g.font = `bold ${Math.max(10, S / 50)}px sans-serif`; g.textAlign = 'center';
    for (const z of OB.W.zones.filter(z => !!z.under === un)) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(z.name, z.i * 2 * k + 1, z.j * 2 * k + 1); g.fillStyle = '#fff'; g.fillText(z.name, z.i * 2 * k, z.j * 2 * k); }
    const q = curQuest(), mk = q && q.mark && markPos(q.mark); if (mk) { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(mk[0] * k, mk[1] * k, 7, 0, TAU); g.fill(); g.strokeStyle = '#000'; g.stroke(); }
    for (const pt of OB.W.portals || []) { const x = un ? pt.ux : pt.x, z = un ? pt.uz : pt.z; g.fillStyle = '#7ad0ff'; g.fillRect(x * k - 4, z * k - 4, 8, 8); }
    const p = OB.P; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(p.x * k, p.z * k, 6, 0, TAU); g.fill(); g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
    panel('#map');
  }
  function pauseMenu() { panel('#pause'); save(); }

  // ================= 건물 잘라 보기 =================
  function cutaway() {
    const p = OB.P, W = OB.W; const [pi, pj] = OB.cellOf(p.x, p.z);
    const want = new Set(); if (p.inside >= 0) want.add(p.inside);
    // 카메라 쪽(남동쪽)에 있는 건물이 플레이어를 가리면 자름
    const cells = new Set();
    for (let k = 1; k <= 4; k++) for (const [di, dj] of [[k, k], [k, k - 1], [k - 1, k], [k + 1, k - 1], [k - 1, k + 1]]) { const i = pi + di, j = pj + dj; cells.add(i + ',' + j); if (W.inb(i, j)) { const b = W.bld[j * OBW.N + i]; if (b >= 0) want.add(b); } }
    for (const T of W.towers || []) {
      let hide = false; for (let a = -1; a <= 2 && !hide; a++) for (let c = -1; c <= 2; c++) if (cells.has((T.i0 + a) + ',' + (T.j0 + c))) { hide = true; break; }
      if (T.hide === hide) continue; T.hide = hide;
      T.g.children.forEach(m => m.material = OBA.material(m.userData.key, hide ? 'ghost' : ''));
    }
    for (const B of W.buildings) {
      const cut = want.has(B.id);
      if (B.cut === cut) continue; B.cut = cut;
      B.gRoof.visible = !cut;
      B.gWalls.children.forEach(m => m.material = OBA.material(m.userData.key, cut ? 'cut' : ''));
    }
  }
  // ================= 문 움직이기 =================
  function updateDoors(dt) {
    for (const d of OB.W.doors) { if (!d.piv) continue; const t = d.open ? -1.6 : 0; d.ang += (t - d.ang) * Math.min(1, dt * 8); d.piv.rotation.y = d.ang; }
  }
  // ================= 동물 =================
  function initAnimals() {
    for (const a of OB.W.animals || []) { if (a.g) continue; const g = OBA.mesh('pets', a.m); g.scale.setScalar(a.m === 'animal-fish' ? 0.35 : 0.5); OB.scene.add(g); a.g = g; a.tx = a.x; a.tz = a.z; }
  }
  function updateAnimals(dt) {
    const p = OB.P;
    for (const a of OB.W.animals || []) {
      if (!a.g) continue; const d = Math.hypot(a.x - p.x, a.z - p.z); a.g.visible = d < 50; if (!a.g.visible) continue;
      a.t -= dt; const scared = d < 5 && a.area !== 'lake';
      if (a.t <= 0 || scared) { a.t = 2 + Math.random() * 5; const r = a.area === 'lake' ? 3 : 6; a.tx = scared ? a.x + (a.x - p.x) * 1.5 : a.hx + (Math.random() - .5) * r * 2; a.tz = scared ? a.z + (a.z - p.z) * 1.5 : a.hz + (Math.random() - .5) * r * 2; }
      const dx = a.tx - a.x, dz = a.tz - a.z, L = Math.hypot(dx, dz), spd = scared ? 3 : 0.9;
      if (L > 0.2) { a.ry += OB.angDiff(a.ry, Math.atan2(dx, dz)) * Math.min(1, dt * 4); if (a.area === 'lake') { a.x += Math.sin(a.ry) * spd * dt; a.z += Math.cos(a.ry) * spd * dt; } else OB.move(a, Math.sin(a.ry) * spd * dt, Math.cos(a.ry) * spd * dt, 0.3, 'z'); a.hop = (a.hop || 0) + dt * (scared ? 14 : 9); } else a.hop = 0;
      a.g.position.set(a.x, (a.area === 'lake' ? -0.15 : 0) + Math.abs(Math.sin(a.hop || 0)) * 0.12, a.z); a.g.rotation.y = a.ry;
    }
  }
  // ================= 효과: 피·탄 =================
  const FX = [];
  OB.blood = function (x, z) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.2, 8), new THREE.MeshBasicMaterial({ color: '#7a1a2a', transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x + (Math.random() - .5) * .5, 0.03, z + (Math.random() - .5) * .5); OB.scene.add(m); FX.push({ m, t: 0, life: 25 });
  };
  OB.tracer = function (x0, z0, x1, z1) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, 1.2, z0), new THREE.Vector3(x1, 1.0, z1)]);
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#7affd0', transparent: true })); OB.scene.add(m); FX.push({ m, t: 0, life: 0.12 });
  };
  function updateFX(dt) { for (let i = FX.length - 1; i >= 0; i--) { const f = FX[i]; f.t += dt; if (f.m.material.opacity != null && f.life < 1) f.m.material.opacity = 1 - f.t / f.life; else if (f.t > f.life - 3) f.m.material.opacity = Math.max(0, (f.life - f.t) / 3) * 0.8; if (f.t > f.life) { OB.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); FX.splice(i, 1); } } }
  OB.onKill = function (zz) {
    OB.sfx('kill', zz.d);
    if (hasItem('syringe') && Math.random() < 0.45) { takeItem('syringe'); giveItem(OB.item('sample')); OB.msg('주사기로 감염자 혈액 샘플을 채취했어요', 'good'); quests(); }
    if (Math.random() < 0.18) dropItem(OB.item(['bandage', 'candy', 'water', 'darts', 'nails', 'soda', 'painkill'][Math.floor(Math.random() * 7)], 1), zz.x, zz.z);
  };

  // ================= 시작 =================
  OB.state = { screen: 'title', q: {}, learned: {}, ate: false };
  async function boot() {
    OB.lowGfx = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && Math.min(screen.width, screen.height) < 900;
    OB.initRender($('#cv')); OB.initInput();
    $('#loadTxt').textContent = '도시 모형을 불러오는 중...';
    await OBA.init();
    let done = 0; const ks = OBW.KITS;
    await Promise.all(ks.map(k => OBA.loadKit(k).then(() => { done++; $('#loadBar').style.width = (done / (ks.length + 1) * 100) + '%'; })));
    await OBA.loadChar(); await OBA.preloadTex(ks); $('#loadBar').style.width = '100%';
    const sv = loadSave();
    buildWorld(sv ? sv.seed : (Date.now() % 100000) + 1);
    $('#btnCont').hidden = !sv; $('#loading').classList.remove('on');
    titleScene(); show('#title');
    const st = loadStats(); $('#titleRec').textContent = st.plays ? `최고 ${st.bestDays || 0}일 생존 · 탈출 ${st.escapes || 0}회` : '';
    requestAnimationFrame(loop);
  }
  function buildWorld(seed) {
    if (OB.W) { OB.scene.remove(OB.W.group); if (OB.W.ug) OB.scene.remove(OB.W.ug); }
    R = (s => () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; })(seed * 7 + 3);
    OB.W = OBW.generate(seed); OB.scene.add(OB.W.group); if (OB.W.ug) { OB.scene.add(OB.W.ug); OB.W.ug.visible = false; } miniBase = null;
    // 이야기 아이템 넣기
    const W = OB.W, put = (pred, id) => { const c = W.containers.find(pred); if (c) { OB.fillContainer(c, R); c.items.unshift(OB.item(id)); } };
    const homeC = W.containers.filter(c => c.bld === W.home.id);
    if (homeC.length) { OB.fillContainer(homeC[0], R); homeC[0].items.unshift(OB.item('radio')); }
    const B = k => W.buildings.find(b => b.kind === k);
    put(c => c.kind === 'locker' && c.bld === B('police').id, 'keycard');
    put(c => c.notes, 'notes');
    put(c => c.medium, 'medium'); put(c => c.gear, 'lantern'); put(c => c.gear, 'antiviral');
    put(c => c.kind === 'toolbox' && c.bld === B('factory').id, 'medium');
    put(c => c.kind === 'toolbox' && c.bld === B('factory').id, 'gascan');
    put(c => c.kind === 'medcab' && c.bld === B('hospital').id, 'syringe'); put(c => c.kind === 'medcab' && c.bld === B('hospital').id, 'syringe'); put(c => c.kind === 'medcab' && c.bld === B('hospital').id, 'syringe');
    put(c => c.kind === 'medcab' && c.bld === B('hospital').id, 'antiviral');
    const harbor = W.buildings.find(b => b.name === '항구 사무소'); put(c => c.bld === harbor.id, 'boatkey');
    put(c => c.kind === 'counter' && c.bld === W.home.id, 'rollingpin');
    for (const d of W.doors) if (W.buildings[d.bld].kind === 'lab' && W.buildings[d.bld].locked) d.locked = true;
  }
  // 제목 화면: 도시 위를 천천히 도는 카메라 + 고른 캐릭터
  let titleChar = null, skinIx = 0;
  function titleScene() {
    const W = OB.W; OB.titleT = 0;
    if (titleChar) OB.scene.remove(titleChar.root);
    titleChar = OBA.char(OBA.SKINS.human[skinIx]); titleChar.root.position.set(W.start.x, 0, W.start.z); OB.scene.add(titleChar.root); titleChar.act.idle.play();
    $('#skinName').textContent = SKIN_NAMES[skinIx];
  }
  const SKIN_NAMES = ['생존자 민준', '생존자 서연', '회사원 도윤', '회사원 하은', '스케이터 지호', '스케이터 유나', '정비공 태오', '엔지니어 소이'];
  function startGame(sv) {
    const W = OB.W;
    if (titleChar) { OB.scene.remove(titleChar.root); titleChar = null; }
    OB.Z.length = 0;
    const skin = sv ? sv.skin : OBA.SKINS.human[skinIx];
    const p = OB.makePlayer(skin, W.start.x, W.start.z);
    if (sv) {
      OB.minute = sv.minute; Object.assign(p, sv.p); OB.state = Object.assign({ screen: 'play', q: {}, learned: {}, ate: false }, sv.state); OB.state.hordeDay = sv.hordeDay;
      sv.cont.forEach((it, i) => { if (W.containers[i]) W.containers[i].items = it; });
      sv.doors.forEach((a, i) => { const d = W.doors[i]; if (!d) return; d.open = !!a[0]; d.hp = a[1]; d.bar = a[2]; d.broken = !!a[3]; d.locked = !!a[4]; if (d.broken && d.mesh) d.mesh.visible = false; if (d.bar) { d.barHp = 50; drawBars(d); } });
      sv.wins.forEach((a, i) => { const w = W.windows[i]; if (!w) return; w.broken = !!a[0]; w.bar = a[1]; if (w.bar) { w.barHp = 50; drawBars(w); } });
      for (const [x, z, t, hp] of sv.z) { const zz = OB.spawnZombie(x, z, { w: 'walker', r: 'runner', b: 'brute' }[t]); zz.hp = hp; }
      for (const [it, x, z] of (sv.ground || [])) dropItem(it, x, z);
      for (const k in OB.state.learned) LEARN[k] = 1;
      OB.attachWeapon(p);
    } else {
      OB.minute = 9 * 60; OB.state = { screen: 'play', q: {}, learned: {}, ate: false, hordeDay: 1 };
      OB.populate(R); p.inv.push(OB.item('water'), OB.item('candy'), OB.item('bandage'));
    }
    initAnimals();
    OB.state.screen = 'play'; OB.paused = false;
    show(null); $('#hud').classList.add('on'); if (OB.touch) $('#touch').classList.add('on');
    quests(); refreshHUD(true);
    if (!sv) setTimeout(() => OB.toast('1일차 · 감염 도시', '창밖에 감염자가 돌아다녀요. 집 안에서 무기와 음식부터 찾아요.'), 400);
  }
  // ================= 루프 =================
  let last = performance.now(), saveT = 0, statAcc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    const s = OB.state;
    if (s.screen === 'title') {
      OB.titleT += dt; const W = OB.W, a = OB.titleT * 0.05;
      const cx = W.start.x, cz = W.start.z;
      OB.cam.position.set(cx + Math.sin(a) * 9 + 6, 6.5, cz + Math.cos(a) * 9 + 6); OB.cam.lookAt(cx, 1.1, cz);
      if (titleChar) { titleChar.update(dt); titleChar.root.rotation.y = Math.atan2(OB.cam.position.x - cx, OB.cam.position.z - cz); }
      OB.sun.position.set(cx + 25, 45, cz + 12); OB.sun.target.position.set(cx, 0, cz);
      for (const B of OB.W.buildings) { B.gRoof.visible = B.id !== OB.W.home.id; }
      updateLight(); OB.renderer.render(OB.scene, OB.cam); return;
    }
    const p = OB.P;
    if (!OB.paused && p) {
      const timeScale = p.asleep ? 40 : 1;
      OB.t += dt;
      const gm = dt * MIN_PER_SEC * timeScale; OB.minute += gm; statAcc += gm;
      if (statAcc > 0.5) { tickStats(statAcc); statAcc = 0; }
      for (const n of OB.noises) n.t += dt; while (OB.noises.length && OB.noises[0].t > 2) OB.noises.shift();
      updatePlayer(dt);
      OB.updateZombies(dt * (p.asleep ? 1 : 1), OB.t);
      if (p.asleep) {
        if (p.fatigue <= 2 || OB.minute - p.sleepStart > 9 * 60) wake();
        if (OB.zombiesNear(p.x, p.z, 10).some(z => z.state === 'chase')) wake('무슨 소리에 잠이 깼어요!');
        if (p.hp < 15) wake('몸이 아파 잠이 깼어요');
      }
      // 밤마다 무리
      if (OB.day() > (s.hordeDay || 1) && OB.hour() > 21) { s.hordeDay = OB.day(); OB.horde(10 + OB.day() * 6); OB.msg('멀리서 감염자 무리의 소리가 들려요...', 'bad'); }
      const un = OB.under(); if (OB.W.group.visible === un) { OB.W.group.visible = !un; if (OB.W.ug) OB.W.ug.visible = un; OB.sun.castShadow = !un; }
      updateDoors(dt); if (!un) cutaway(); updateFX(dt); updateAnimals(dt);
      saveT += dt; if (saveT > 30) { saveT = 0; save(); }
    }
    if (p) { OB.updateCamera(dt); updateLight(); refreshHUD(); }
    if (OB.W.water) OB.W.water.position.y = -0.25 + Math.sin(OB.t * 0.8) * 0.03;
    OB.renderer.render(OB.scene, OB.cam);
  }
  // ================= 버튼 =================
  function bindUI() {
    $('#btnNew').onclick = () => { ac(); if (loadSave() && !confirm('저장된 게임이 지워져요. 새로 시작할까요?')) return; try { localStorage.removeItem(SAVE); } catch (e) { } const seed = (Date.now() % 100000) + 1; buildWorld(seed); startGame(null); };
    $('#btnCont').onclick = () => { ac(); const sv = loadSave(); if (sv) { if (sv.seed !== OB.W.seed) buildWorld(sv.seed); startGame(sv); } };
    $('#btnHelp').onclick = () => show('#help'); $$('[data-back]').forEach(b => b.onclick = () => show('#title'));
    $('#skinL').onclick = () => { skinIx = (skinIx + 7) % 8; titleScene(); }; $('#skinR').onclick = () => { skinIx = (skinIx + 1) % 8; titleScene(); };
    $('#inv').addEventListener('click', invClick);
    $$('.panel .x, [data-close]').forEach(b => b.onclick = () => { closePanels(); refreshHUD(true); });
    $('#hot').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) quickUse(+b.dataset.q); });
    $('#bResume').onclick = closePanels;
    $('#bSave').onclick = () => { save(); OB.msg('저장했어요'); closePanels(); };
    $('#bQuit').onclick = () => { save(); location.href = '../index.html'; };
    $('#endRetry').onclick = () => location.reload();
    $('#endHub').onclick = () => location.href = '../index.html';
    $$('[data-hub]').forEach(b => b.onclick = () => { save(); location.href = '../index.html'; });
    $('#hudInv').onclick = () => openInv(); $('#hudJr').onclick = openJournal; $('#hudMap').onclick = openMap; $('#hudPause').onclick = pauseMenu;
    addEventListener('keydown', () => { if (OB.P && OB.P.asleep) wake(); });
    addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (OB.state.screen === 'play') pauseMenu(); } });
    // 터치
    const tch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window; OB.touch = tch;
    if (tch) {
      document.body.classList.add('touch');
      const joy = $('#joy'), knob = $('#knob'); let jid = null, jx = 0, jy = 0; OB.joy = { x: 0, y: 0 };
      joy.addEventListener('pointerdown', e => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jx = r.left + r.width / 2; jy = r.top + r.height / 2; joy.setPointerCapture(jid); move(e); });
      const move = e => { if (e.pointerId !== jid) return; let dx = e.clientX - jx, dy = e.clientY - jy; const L = Math.hypot(dx, dy), M = 48; if (L > M) { dx *= M / L; dy *= M / L; } knob.style.transform = `translate(${dx}px,${dy}px)`; OB.joy.x = dx / M; OB.joy.y = dy / M; OB.runToggle = L > M * 1.25 ? OB.runToggle : OB.runToggle; };
      joy.addEventListener('pointermove', move);
      const end = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; OB.joy.x = OB.joy.y = 0; };
      joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
      const tb = (id, f) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); ac(); f(); });
      tb('#bAtk', () => OB.onAttack()); tb('#bShove', () => OB.onShove()); tb('#bUse', () => interact()); tb('#bBar', () => barricadeAction());
      tb('#bRun', () => { OB.runToggle = !OB.runToggle; $('#bRun').classList.toggle('on', OB.runToggle); });
      tb('#bSneak', () => { OB.P.sneak = !OB.P.sneak; $('#bSneak').classList.toggle('on', OB.P.sneak); });
      tb('#bLamp', toggleLantern); tb('#bReload', reload);
      $('#bAtk').addEventListener('pointerup', () => { OB.mouse.down = false; });
      let pinch = null; $('#cv').addEventListener('touchmove', e => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) OB.zoom = clamp(OB.zoom - (d - pinch) * 0.05, 14, 44); pinch = d; } }, { passive: true });
      $('#cv').addEventListener('touchend', () => { pinch = null; });
    }
  }
  OB.debug = { startGame, buildWorld, interact, openInv, useItem, giveItem, quests, save, loadSave, nearestInteract, centrifuge, die, victory };
  addEventListener('load', () => { bindUI(); boot().catch(e => { $('#loadTxt').textContent = '불러오기 실패: ' + e.message; console.error(e); }); });
})();

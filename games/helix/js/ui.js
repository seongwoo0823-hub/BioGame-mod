// 헬릭스 화면 메뉴: 대화, 변이 선택, 상점, 강화대, 기념품, 기록·도감, 일시정지, 결과, 시작 화면
'use strict';
const $ = s => document.querySelector(s);
const panel = () => $('#panel');
let PANEL = null;   // {opts: [버튼들], idx, onBack, onConfirm}
function openPanel(html, cls = '', onBack = null) {
  const p = panel(); p.className = 'panel show ' + cls; p.innerHTML = html; G.paused = true;
  const opts = [...p.querySelectorAll('.opt:not([disabled])')];
  PANEL = {opts, idx: 0, onBack};
  opts.forEach((o, i) => { o.addEventListener('mouseenter', () => { if (PANEL && PANEL.idx !== i) { PANEL.idx = i; focusOpt(); AUDIO.play('hover', 0.4); } }); });
  focusOpt();
  return p;
}
function closePanel() { const p = panel(); p.className = 'panel'; p.innerHTML = ''; PANEL = null; G.paused = false; pressed.clear(); }
function focusOpt() { if (!PANEL) return; PANEL.opts.forEach((o, i) => o.classList.toggle('focus', i === PANEL.idx)); const o = PANEL.opts[PANEL.idx]; if (o && o.scrollIntoView) o.scrollIntoView({block: 'nearest'}); }
function uiTick() {
  if (DIALOG) { if (pressed.has('interact') || pressed.has('attack')) { pressed.clear(); dialogNext(); } return; }
  if (!PANEL) return;
  const n = PANEL.opts.length; const cols = PANEL.cols || 1;
  const mv = d => { if (!n) return; PANEL.idx = (PANEL.idx + d + n) % n; focusOpt(); AUDIO.play('hover', 0.4); };
  if (pressed.has('up') || pressed.has('nav_up')) mv(-cols);
  if (pressed.has('down') || pressed.has('nav_down')) mv(cols);
  if (pressed.has('left') || pressed.has('nav_left')) mv(-1);
  if (pressed.has('right') || pressed.has('nav_right')) mv(1);
  if ((pressed.has('interact') || (pressed.has('attack') && INPUT.lastDevice === 'pad')) && n) { const o = PANEL.opts[PANEL.idx]; pressed.clear(); o && o.click(); return; }
  if ((pressed.has('pause') || (pressed.has('cast') && INPUT.lastDevice === 'pad')) && PANEL.onBack) { pressed.clear(); AUDIO.play('click'); PANEL.onBack(); }
  pressed.delete('pause');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const img = name => `<img class="ic" src="${iconURL(name)}" alt="">`;
function bindOpts(p, map) { p.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; map(b.dataset.i, b); })); }

// ================================================================ 대화
let DIALOG = null;
function talkTo(id) {
  const st = {runs: SAVE.runs, best: SAVE.best, wins: SAVE.wins, metMerchant: SAVE.metMerchant};
  const sets = TALK[id].filter(s => s.when(st));
  let lines;
  if (id === 'mentor' && sets.length > 1) {   // 아직 안 들은 특별 대사가 있으면 먼저
    const key = 'mentor_' + TALK.mentor.indexOf(sets[0]);
    if (!SAVE.talk[key]) { lines = sets[0].lines; SAVE.talk[key] = 1; } else { const g = sets[sets.length - 1]; lines = [pick(g.lines)]; }
  } else if (id === 'merchant' && !SAVE.metMerchant) { lines = sets[0].lines; SAVE.metMerchant = true; }
  else lines = sets[sets.length - 1] === sets[0] ? sets[0].lines.length > 2 && id !== 'drone' ? [pick(sets[0].lines)] : sets[0].lines : [pick(sets[sets.length - 1].lines)];
  writeSave();
  const after = id === 'merchant' ? openCharms : id === 'drone' ? openRecords : id === 'cat' ? () => { AUDIO.play('meow'); floatText(G.player.x, G.player.z, 90, '♥', '#ff8ab0', true); } : null;
  if (id === 'cat') AUDIO.play('meow');
  startDialog(id, lines, after);
}
function startDialog(id, lines, after) {
  G.paused = true;
  const M = JS.npcs[id]; const box = $('#dialog'); box.className = 'show';
  const c = document.createElement('canvas'); c.width = c.height = M.cell; c.getContext('2d').drawImage(IMG['npc_' + id], 0, 0, M.cell, M.cell, 0, 0, M.cell, M.cell);
  box.innerHTML = `<div class="dport"></div><div class="dbody"><b>${esc(M.name)}</b><p></p><small>${INPUT.lastDevice === 'touch' ? '눌러서 계속' : 'E / 클릭으로 계속'}</small></div>`;
  box.querySelector('.dport').appendChild(c);
  DIALOG = {lines, i: 0, ch: 0, after, el: box.querySelector('p'), timer: null};
  box.onclick = () => dialogNext();
  typeLine();
}
function typeLine() {
  const D = DIALOG; D.ch = 0; const s = D.lines[D.i]; clearInterval(D.timer);
  D.timer = setInterval(() => { D.ch++; D.el.textContent = s.slice(0, D.ch); if (D.ch % 2 === 0 && s[D.ch - 1] !== ' ') AUDIO.play('blip', 0.5); if (D.ch >= s.length) clearInterval(D.timer); }, 22);
}
function dialogNext() {
  const D = DIALOG; if (!D) return; const s = D.lines[D.i];
  if (D.ch < s.length) { D.ch = s.length; D.el.textContent = s; clearInterval(D.timer); return; }
  D.i++;
  if (D.i >= D.lines.length) { clearInterval(D.timer); $('#dialog').className = ''; DIALOG = null; G.paused = false; pressed.clear(); if (D.after) D.after(); return; }
  typeLine();
}

// ================================================================ 변이 선택
function rollRarity(minRar = 0) {
  let r = Math.random() * 100; const luck = metaL('luck') * 8;
  let rar = r < 3 + luck * 0.3 ? 3 : r < 12 + luck * 0.7 ? 2 : r < 38 + luck ? 1 : 0;
  if (G.run && G.run.firstBoost) { rar = Math.max(rar, 1); }
  return Math.max(rar, minRar);
}
function traitOffers(lin, minRar) {
  const run = G.run, ownP = new Set(run.passives.map(p => p.id));
  let pool = TRAITS.filter(t => (!t.wpn || t.wpn === WPN()) && t.lin === lin && !ownP.has(t.id) && !(run.slots[t.slot] && run.slots[t.slot].id === t.id));
  if (pool.length < 3) pool = pool.concat(shuffle(TRAITS.filter(t => (!t.wpn || t.wpn === WPN()) && t.lin !== lin && !ownP.has(t.id))).slice(0, 3 - pool.length));
  return shuffle(pool).slice(0, 3).map(t => ({id: t.id, rar: rollRarity(minRar)}));
}
function traitCard(o, i, extra = '') {
  const T = TRAIT[o.id], L = LINEAGE[T.lin], R = RARITY[o.rar], cur = T.slot !== 'passive' ? G.run.slots[T.slot] : null;
  return `<button class="opt card" data-i="${i}" style="--c:${L.col}"><div class="ch">${img(`${T.lin}_${T.slot}`)}<div><div class="cn">${esc(T.name)}<span class="rar" style="color:${R.col}">${R.name}</span></div>
    <div class="cs">${L.short} 계통 · ${slotName(T.slot, T.wpn)}</div></div></div><div class="cd">${esc(T.d(T.v[o.rar]))}</div>${cur ? `<div class="cr">교체: ${esc(TRAIT[cur.id].name)}</div>` : ''}${extra}</button>`;
}
function openTraitChoice(lin, minRar, done) {
  const offers = traitOffers(lin, minRar); const L = LINEAGE[lin];
  AUDIO.play('trait', 0.7);
  const p = openPanel(`<h2 style="color:${L.col}">${L.name}</h2><p class="sub">${L.desc} 하나를 골라 받아들이세요.</p><div class="cards">${offers.map((o, i) => traitCard(o, i)).join('')}</div>`, 'wide');
  bindOpts(p, i => {
    if (i === 'log') { if (window.ILOG) ILOG.openViewer(); return; } applyTrait(offers[+i]); closePanel(); AUDIO.play('confirm'); done && done(); });
}
function applyTrait(o) {
  const run = G.run, T = TRAIT[o.id];
  if (T.slot === 'passive') run.passives.push({id: o.id, rar: o.rar}); else run.slots[T.slot] = {id: o.id, rar: o.rar};
  run.firstBoost = false;
  recalcPlayer(G.player, false); if (o.id === 's_hp') G.player.hp += T.v[o.rar];
  G.player.hp = Math.min(G.player.hp, G.player.maxhp);
  G.fx.push({k: 'ring', x: G.player.x, z: G.player.z, r0: 10, r1: 80, t: 0, life: 0.4, col: LINEAGE[T.lin].col});
  burst(G.player.x, G.player.z, 40, [LINEAGE[T.lin].col, '#ffffff'], 24, 200, 0.7, 2, 100);
}
function openUpgrade(done) {
  const own = ownedTraits().filter(t => t.rar < 3);
  if (!own.length) { done && done(); return; }
  const p = openPanel(`<h2 style="color:#3cffae">변이 강화</h2><p class="sub">이미 받은 변이 하나의 등급을 올립니다.</p><div class="cards">${own.map((o, i) => traitCard({id: o.id, rar: o.rar + 1}, i, `<div class="cr" style="color:#3cffae">${RARITY[o.rar].name} → ${RARITY[o.rar + 1].name}</div>`)).join('')}</div>`, 'wide');
  bindOpts(p, i => { own[+i].rar++; recalcPlayer(G.player, true); AUDIO.play('trait'); closePanel(); done && done(); });
}

// ================================================================ 상점 (출정 중, ATP)
function makeShopStock() {
  const items = [{t: 'trait', lin: pick(LIN_KEYS), cost: 110}, {t: 'heal', cost: 45}, {t: 'maxhp', cost: 80}, {t: 'trait', lin: pick(LIN_KEYS), cost: 120}, {t: 'upgrade', cost: 140}, {t: 'ammo', cost: 60}];
  return shuffle(items).slice(0, 4).map(o => Object.assign(o, {sold: false}));
}
function openShop() {
  const run = G.run, st = G.room.shop;
  const name = o => o.t === 'trait' ? `${LINEAGE[o.lin].name} 변이` : o.t === 'heal' ? '응급 혈청 (체력 50%)' : o.t === 'maxhp' ? '배양 심장 (최대 체력 +20)' : o.t === 'upgrade' ? '변이 강화' : '추가 시약 병 (+1)';
  const ic = o => o.t === 'trait' ? 'orb_' + o.lin : o.t === 'heal' ? 'heal' : o.t === 'maxhp' ? 'maxhp' : o.t === 'upgrade' ? 'upgrade' : 'orb_immune';
  const p = openPanel(`<h2>상점</h2><p class="sub">보유 ATP: <b style="color:#ffe070">${run.atp}</b></p><div class="list">${st.map((o, i) => `<button class="opt row" data-i="${i}" ${o.sold || run.atp < o.cost || (o.t === 'upgrade' && !ownedTraits().some(t => t.rar < 3)) ? 'disabled' : ''}>${img(ic(o))}<span>${name(o)}</span><b>${o.sold ? '판매됨' : o.cost + ' ATP'}</b></button>`).join('')}<button class="opt row" data-i="x">${img('key')}<span>나가기</span><b></b></button></div>`, '', closePanel);
  bindOpts(p, i => {
    if (i === 'x') { closePanel(); return; }
    const o = st[+i]; if (o.sold || run.atp < o.cost) { AUDIO.play('deny'); return; }
    run.atp -= o.cost; o.sold = true; AUDIO.play('coin');
    const P = G.player;
    if (o.t === 'heal') { heal(P, Math.round(P.maxhp * 0.5)); closePanel(); openShop(); }
    else if (o.t === 'maxhp') { run.bonusHp += 20; recalcPlayer(P); P.hp += 20; closePanel(); openShop(); }
    else if (o.t === 'ammo') { G.player.ammoMax++; G.player.ammo++; run.ammoBonus = (run.ammoBonus || 0) + 1; closePanel(); openShop(); }
    else if (o.t === 'trait') { closePanel(); openTraitChoice(o.lin, 0, () => openShop()); }
    else if (o.t === 'upgrade') { closePanel(); openUpgrade(() => openShop()); }
  });
}

// ================================================================ 강화대 · 기념품 (마을, DNA)
function openAltar() {
  const rows = META.map((m, i) => { const l = metaL(m.id), max = l >= m.max, c = max ? 0 : m.cost[l];
    return `<button class="opt row" data-i="${i}" ${max || SAVE.dna < c ? 'disabled' : ''}>${img(m.icon)}<span><b>${m.name}</b> <small>${'■'.repeat(l)}${'□'.repeat(m.max - l)}</small><br><small>${esc(m.d(Math.min(m.max, l + (max ? 0 : 1))))}</small></span><b>${max ? '완료' : c + ' DNA'}</b></button>`; }).join('');
  const p = openPanel(`<h2 style="color:#3cffae">유전체 강화대</h2><p class="sub">모은 DNA 샘플로 몸을 영구히 강화합니다. 보유: <b style="color:#c0ffe8">${SAVE.dna} DNA</b></p><div class="list">${rows}<button class="opt row" data-i="x">${img('key')}<span>닫기</span><b></b></button></div>`, '', closePanel);
  bindOpts(p, i => {
    if (i === 'x') { closePanel(); return; }
    const m = META[+i], l = metaL(m.id); if (l >= m.max || SAVE.dna < m.cost[l]) { AUDIO.play('deny'); return; }
    SAVE.dna -= m.cost[l]; SAVE.meta[m.id] = l + 1; writeSave(); AUDIO.play('trait');
    recalcPlayer(G.player); G.player.hp = G.player.maxhp; G.fx.push({k: 'pillar', x: G.player.x, z: G.player.z, t: 0});
    const idx = PANEL ? PANEL.idx : 0; closePanel(); openAltar(); if (PANEL) { PANEL.idx = Math.min(idx, PANEL.opts.length - 1); focusOpt(); }
  });
}
function openCharms() {
  const rows = CHARMS.map((c, i) => { const own = SAVE.charms.includes(c.id), on = SAVE.charm === c.id;
    return `<button class="opt row ${on ? 'on' : ''}" data-i="${i}" ${!own && SAVE.dna < c.cost ? 'disabled' : ''}>${img(c.id)}<span><b>${c.name}</b><br><small>${esc(c.d)}</small></span><b>${on ? '착용 중' : own ? '착용' : c.cost + ' DNA'}</b></button>`; }).join('');
  const p = openPanel(`<h2 style="color:#ffc040">바이알의 기념품</h2><p class="sub">출정할 때 하나만 지닐 수 있습니다. 보유: <b style="color:#c0ffe8">${SAVE.dna} DNA</b></p><div class="list">${rows}<button class="opt row" data-i="x">${img('key')}<span>닫기</span><b></b></button></div>`, '', closePanel);
  bindOpts(p, i => {
    if (i === 'x') { closePanel(); return; }
    const c = CHARMS[+i];
    if (!SAVE.charms.includes(c.id)) { if (SAVE.dna < c.cost) { AUDIO.play('deny'); return; } SAVE.dna -= c.cost; SAVE.charms.push(c.id); AUDIO.play('coin'); }
    SAVE.charm = SAVE.charm === c.id ? null : c.id; writeSave(); AUDIO.play('confirm'); recalcPlayer(G.player); G.player.hp = G.player.maxhp;
    closePanel(); openCharms();
  });
}
function openRecords() {
  const ids = Object.keys(JS.mobs);
  const tierName = {normal: '일반', mid: '중간 보스', boss: '챕터 보스'};
  const cells = ids.map(id => { const m = JS.mobs[id], k = SAVE.kills[id] || 0; return `<button class="opt codex ${k ? '' : 'unk'}" data-i="${id}"><canvas width="${m.cell}" height="${m.cell}" data-mob="${id}"></canvas><small>${k ? esc(m.name) : '???'}</small></button>`; }).join('');
  const p = openPanel(`<h2 style="color:#5ab0ff">기록 드론 아키</h2><p class="sub">출정 ${SAVE.runs}회 · 정화 ${SAVE.wins}회 · 최고 기록 ${SAVE.best ? SAVE.best + '장 보스 처치' : '없음'} · 모은 DNA ${SAVE.totalDna}</p><h3>생물 도감</h3><div class="codexgrid">${cells}</div><div id="cdesc" class="cdesc">생물을 고르면 설명이 나옵니다. 처치한 적만 기록됩니다.</div><div class="list"><button class="opt row" data-i="x">${img('key')}<span>닫기</span><b></b></button></div>`, 'wide', closePanel);
  PANEL.cols = 7;
  p.querySelectorAll('canvas[data-mob]').forEach(c => { const id = c.dataset.mob, m = JS.mobs[id], x = c.getContext('2d'), a = m.anims[0], draw = im => im && x.drawImage(im, (a.x || 0), (a.y || 0) + m.cell, m.cell, m.cell, 0, 0, m.cell, m.cell);
    const key = atlasKey(id, a.file); if (IMG[key]) draw(IMG[key]); else loadImg(key, 'helix/assets/mobs/' + a.file).then(draw); });
  bindOpts(p, id => { if (id === 'x') { closePanel(); return; } const m = JS.mobs[id], k = SAVE.kills[id] || 0; $('#cdesc').innerHTML = k ? `<b>${esc(m.name)}</b> · ${tierName[m.tier]} · ${esc(m.role)} · 처치 ${k}회<br>${esc(m.desc)}` : '아직 만나지 못했거나 처치하지 못한 생물입니다.'; AUDIO.play('click'); });
}

// ================================================================ 일시정지 · 설정 · 결과
function openPause() {
  AUDIO.play('click');
  const p = openPanel(`<h2>일시정지</h2><div class="list">
    <button class="opt row" data-i="go">${img('key')}<span>계속하기</span><b></b></button>
    <button class="opt row" data-i="set">${img('luck')}<span>설정</span><b></b></button>
    <button class="opt row" data-i="help">${img('blade')}<span>조작법</span><b></b></button>
    <button class="opt row" data-i="log">${img('upgrade')}<span>입력 기록 보기</span><b></b></button>
    ${G.state === 'run' ? `<button class="opt row" data-i="quit">${img('boss')}<span>출정 포기 (쉼터로)</span><b></b></button>` : ''}
    <button class="opt row" data-i="hub">${img('dna')}<span>게임 목록으로</span><b></b></button></div>`, '', closePanel);
  bindOpts(p, i => {
    if (i === 'go') closePanel(); if (i === 'set') openSettings(openPause); if (i === 'help') openHelp(openPause);
    if (i === 'quit') { closePanel(); G.player.hp = 0; setAct(G.player, 'death'); }
    if (i === 'hub') location.href = '../index.html';
  });
}
function openSettings(back) {
  const s = SAVE.settings;
  const p = openPanel(`<h2>설정</h2><div class="list">
    <label class="row">배경음 <input type="range" id="sMus" min="0" max="1" step="0.05" value="${s.music}"></label>
    <label class="row">효과음 <input type="range" id="sSfx" min="0" max="1" step="0.05" value="${s.sfx}"></label>
    <button class="opt row" data-i="shake">${img('speed')}<span>화면 흔들림</span><b>${s.shake ? '켬' : '끔'}</b></button>
    <button class="opt row" data-i="reset">${img('boss')}<span>저장 기록 지우기</span><b></b></button>
    <button class="opt row" data-i="back">${img('key')}<span>뒤로</span><b></b></button></div>`, '', back);
  $('#sMus').oninput = e => { s.music = +e.target.value; AUDIO.setVol('music', s.music); writeSave(); };
  $('#sSfx').oninput = e => { s.sfx = +e.target.value; AUDIO.setVol('sfx', s.sfx); AUDIO.play('click'); writeSave(); };
  bindOpts(p, i => {
    if (i === 'back') back(); if (i === 'shake') { s.shake = s.shake ? 0 : 1; SETTINGS.shake = s.shake; writeSave(); openSettings(back); }
    if (i === 'reset') { const b = p.querySelector('[data-i=reset] span'); if (b.dataset.sure) { localStorage.removeItem(SAVE_KEY); location.reload(); } else { b.dataset.sure = 1; b.textContent = '한 번 더 누르면 모든 기록이 지워집니다'; } }
  });
}
function openHelp(back) {
  const p = openPanel(`<h2>조작법</h2><div class="help">
    <p><b>이동</b> WASD · 방향키 · 왼쪽 스틱 · 화면 왼쪽 조이스틱</p>
    <p><b>베기 (3연타)</b> 마우스 왼쪽 · J · 게임패드 X</p>
    <p><b>회전베기</b> 마우스 오른쪽 · K · 게임패드 Y</p>
    <p><b>시약 투척</b> Q · I · 게임패드 B (병은 시간이 지나면 다시 참)</p>
    <p><b>돌진 (무적)</b> Space · Shift · 게임패드 A — 공격 도중에도 끊고 나갈 수 있음, 돌진 직후 베기는 강화</p>
    <p><b>도약 강타</b> R · L · 게임패드 RB (6초 재사용)</p>
    <p><b>유전자 의식</b> F · U · 게임패드 LB (게이지가 가득 차면)</p>
    <p><b>대화 · 사용</b> E · Enter · 게임패드 Start &nbsp; <b>일시정지</b> Esc</p>
    <p>마우스가 있으면 커서 방향으로 공격합니다. 터치·게임패드는 가까운 적을 자동으로 노립니다.</p>
    <p>적이 바닥에 <span style="color:#ff5a6a">빨간 표시</span>를 그리면 곧 그곳을 공격합니다. 표시 밖으로 피하세요.</p>
    </div><div class="list"><button class="opt row" data-i="back">${img('key')}<span>뒤로</span><b></b></button></div>`, '', back);
  bindOpts(p, () => back());
}
function confirmStart() {
  const ch = SAVE.charm ? CHARMS.find(c => c.id === SAVE.charm).name : '없음';
  const cur = SAVE.weapon || 'scythe';
  const cards = Object.entries(WEAPON).map(([id, W]) => `<button class="opt card wcard${id === cur ? ' on' : ''}" data-i="w:${id}" style="--c:${W.col}"><div class="ch"><img class="wimg" src="${weaponThumb(id)}" alt=""><div><div class="cn">${W.name}</div>
    <div class="cs">${W.attack} · ${W.special}</div></div></div><div class="cd">${W.desc}</div>${id === cur ? '<div class="cr" style="color:var(--c)">선택됨</div>' : ''}</button>`).join('');
  const p = openPanel(`<h2 style="color:#3cffae">출정</h2><p class="sub">무기를 고르고 연구소 지하로 내려갑니다. 기념품: <b>${ch}</b> · 최대 체력 <b>${G.player.maxhp}</b></p>
    <div class="cards">${cards}</div><div class="list" style="margin-top:.8em">
    <button class="opt row" data-i="go">${img('key')}<span>${WEAPON[cur].name} 들고 내려가기</span><b></b></button><button class="opt row" data-i="no">${img('rest')}<span>조금 더 준비하기</span><b></b></button></div>`, 'wide', closePanel);
  bindOpts(p, i => {
    if (i.startsWith('w:')) { const w = i.slice(2); if (w !== SAVE.weapon) { SAVE.weapon = w; writeSave(); weaponSetup(); AUDIO.play('confirm'); } closePanel(); confirmStart(); return; }
    closePanel(); if (i === 'go') { AUDIO.play('portal'); startRun(); }
  });
}
function showResults(win) {
  const run = G.run; const sec = Math.round((performance.now() - run.t0) / 1000);
  const where = `${run.ch}장 ${CH[run.ch - 1].name} · 방 ${run.room}`;
  const p = openPanel(`<h2 style="color:${win ? '#3cffae' : '#ff8a96'}">${win ? '유전체 금고 정화 완료!' : '쓰러졌습니다'}</h2>
    <p class="sub">${win ? '나선의 지배자가 잠들었습니다. 쉼터의 모두가 당신을 기다립니다.' : '재생 장치가 당신을 쉼터로 되돌립니다. 모은 DNA 샘플은 그대로 남습니다.'}</p>
    <div class="stats"><div><small>도달한 곳</small><b>${where}</b></div><div><small>정리한 방</small><b>${run.cleared}</b></div><div><small>처치</small><b>${run.kills}</b></div><div><small>얻은 DNA</small><b>${run.dna}</b></div><div><small>시간</small><b>${Math.floor(sec / 60)}분 ${sec % 60}초</b></div><div><small>받은 변이</small><b>${ownedTraits().length}</b></div></div>
    <div class="list"><button class="opt row" data-i="go">${img('rest')}<span>쉼터로 돌아가기</span><b></b></button></div>`, '');
  bindOpts(p, () => { closePanel(); fadeOut(() => enterHub(true)); });
}
function showLoading(on) { $('#loading').style.display = on ? 'flex' : 'none'; }

// ================================================================ 시작
function titleScreen() {
  G.state = 'title'; AUDIO.music('title', 0);
  const has = SAVE.runs > 0 || SAVE.dna > 0;
  const p = openPanel(`<div class="title"><div class="logo">HELIX<span>헬릭스 · 나선의 계승자</span></div><p class="foot" style="margin:-.6em 0 0;color:#8796a0">이중나선의 낫을 든 생명과학자, 오염된 연구소 지하로.</p>
    <div class="list"><button class="opt row" data-i="start">${img('orb_symbio')}<span>${has ? '이어하기' : '새로 시작하기'}</span><b></b></button>
    <button class="opt row" data-i="help">${img('blade')}<span>조작법</span><b></b></button>
    <button class="opt row" data-i="set">${img('luck')}<span>설정</span><b></b></button>
    <button class="opt row" data-i="back">${img('key')}<span>게임 목록으로</span><b></b></button></div>
    <p class="foot">쿼터뷰 액션 로그라이트 · 저장은 이 기기에 자동으로 됩니다</p></div>`, 'titlep');
  bindOpts(p, i => {
    AUDIO.init(); AUDIO.setVol('music', SAVE.settings.music); AUDIO.setVol('sfx', SAVE.settings.sfx); AUDIO.play('confirm');
    if (i === 'start') { closePanel(); if (!SAVE.seenIntro) prologue(); else fadeOut(() => enterHub()); }
    if (i === 'help') openHelp(titleScreen); if (i === 'set') openSettings(titleScreen); if (i === 'back') location.href = '../index.html';
  });
}
function prologue() {
  const slides = ['연구소 지하 깊은 곳, 모든 생명의 설계도를 보관하던 유전체 금고가 폭주했다.', '흘러나온 변이 유전자는 배양실에서 하수 저장고로, 격리 병동으로 번져 모든 생명체를 바꾸어 놓았다.', '살아남은 연구자 이안. 그의 손에는 변이를 흡수하는 이중나선의 낫이 들려 있다.', '쓰러져도 재생 장치가 그를 쉼터로 되돌린다. 금고의 심장, 나선의 지배자에 닿을 때까지.'];
  let k = 0;
  const show = () => {
    const p = openPanel(`<div class="story"><p>${slides[k]}</p><div class="list"><button class="opt row" data-i="n">${img('key')}<span>${k < slides.length - 1 ? '다음' : '쉼터에서 눈을 뜬다'}</span><b>${k + 1} / ${slides.length}</b></button></div></div>`, 'titlep');
    bindOpts(p, () => { AUDIO.play('click'); k++; if (k < slides.length) show(); else { closePanel(); SAVE.seenIntro = true; writeSave(); fadeOut(() => enterHub()); } });
  };
  show();
}
async function boot() {
  resize(); setupTouch(); loadSave();
  requestAnimationFrame(frame);
  showLoading(true);
  const bar = $('#lbar');
  try { await loadCore(p => bar.style.width = Math.round(p * 100) + '%'); }
  catch (e) { $('#loading').innerHTML = '<p>게임 파일을 불러오지 못했습니다. 새로고침해 주세요.</p>'; console.error(e); return; }
  showLoading(false);
  document.querySelectorAll('[data-icon]').forEach(i => i.src = iconURL(i.dataset.icon));
  titleScreen();
}
boot();

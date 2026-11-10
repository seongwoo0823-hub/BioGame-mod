/* 바이오 킹덤 · 화면 (자원 막대, 건설, 생산, 영웅, 뽑기, 모험, 임무, 저장) */
(function () {
  'use strict';
  const BK = window.BK, D = window.BKD, K = BK.K, B = BK.B;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const now = () => Date.now();
  let S;

  // ---------- 새 게임 ----------
  function fresh() {
    const s = { v: 1, res: { coin: 1500, gem: 3000, glucose: 10, atp: 4, protein: 12, dna: 2, energy: 30 }, enT: now(), castleLv: 1, nid: 1, map: [],
      heroes: {}, team: [], clear: 0, stars: {}, opt: { auto: false, x2: false, music: true }, stat: { pulls: 0, wins: 0, lvups: 0, made: {} }, mis: 0, seen: {} };
    const put = (k, i, j, lv) => s.map.push({ id: s.nid++, k, i, j, lv: lv || 1, q: [], taxT: now() });
    put('castle', 6, 6); put('farm', 4, 9); put('farm', 5, 10); put('house', 9, 5); put('house', 9, 7); put('mito', 3, 6);
    put('well', 8, 9); [[2, 2], [3, 1], [11, 2], [12, 4], [1, 11], [2, 12], [12, 11], [11, 12], [0, 5], [13, 8]].forEach(([i, j], n) => put(['tree', 'pine', 'trees'][n % 3], i, j));
    [[7, 3], [8, 3], [5, 3]].forEach(([i, j]) => put('fence', i, j));
    ['dog', 'cat', 'fish', 'bunny', 'chick'].forEach(id => s.heroes[id] = { lv: 1, star: 1, sk: 1, shard: 0 });
    s.team = ['dog', 'cat', 'fish', 'bunny', 'chick'];
    return s;
  }

  // ---------- 자원 ----------
  const enMax = () => 30 + S.castleLv * 5;
  function tickEnergy() { const m = enMax(); if (S.res.energy >= m) { S.enT = now(); return; } const n = Math.floor((now() - S.enT) / 180000); if (n > 0) { S.res.energy = Math.min(m, S.res.energy + n); S.enT += n * 180000; } }
  const canPay = c => Object.keys(c || {}).every(k => !c[k] || S.res[k] >= c[k]);
  const pay = c => { for (const k in c) S.res[k] -= c[k] || 0; };
  const gain = c => { for (const k in c) if (S.res[k] != null) S.res[k] += c[k] || 0; };
  const costHTML = (c, chk) => Object.keys(c).filter(k => c[k]).map(k => `<span class="cst ${chk && S.res[k] < c[k] ? 'no' : ''}">${BK.ri(k, 18)}${BK.fmt(c[k])}</span>`).join('') || '<span class="cst">무료</span>';
  const resName = k => D.RES[k].name;

  // ---------- 알림 ----------
  let toastT = 0;
  function toast(msg, kind) { const t = $('#toast'); t.innerHTML = msg; t.className = 'on ' + (kind || ''); clearTimeout(toastT); toastT = setTimeout(() => t.className = '', 2200); }
  BK.toast = toast;

  // ---------- 위쪽 자원 막대 ----------
  function topbar() {
    tickEnergy();
    const r = S.res;
    $('#tbCoin').textContent = BK.fmt(r.coin); $('#tbGem').textContent = BK.fmt(r.gem);
    $('#tbEn').textContent = `${r.energy}/${enMax()}`;
    const left = r.energy >= enMax() ? '' : BK.fmtT(180 - ((now() - S.enT) / 1000) % 180).replace(/^0분 /, '');
    $('#tbEnT').textContent = left;
    $('#tbRes').innerHTML = ['glucose', 'atp', 'protein', 'dna'].map(k => `<span title="${resName(k)}">${BK.ri(k, 18)}<b>${BK.fmt(r[k])}</b></span>`).join('');
    $('#tbLv').textContent = S.castleLv;
    $('#tbCharm').textContent = Math.round(K.charm());
  }

  // ---------- 패널 ----------
  function openPanel(html, cls) {
    const p = $('#pan'); p.innerHTML = `<div class="pv ${cls || ''}"><button class="x" aria-label="닫기">✕</button>${html}</div>`; p.classList.add('on');
    p.querySelector('.x').onclick = closePanel; BK.snd('open', 0.5); return p.firstElementChild;
  }
  function closePanel() { const p = $('#pan'); if (!p.classList.contains('on')) return; p.classList.remove('on'); p.innerHTML = ''; K.sel = null; panelTick = null; heroAnim = null; BK.snd('close', 0.4); }
  let panelTick = null;

  // ---------- 건물 그림 (작은 캔버스) ----------
  const THUMB = {};
  function thumb(k) {
    if (THUMB[k]) return THUMB[k];
    const Bd = D.BUILD[k], s = Bd.size, c = document.createElement('canvas'); c.width = 260; c.height = 300; const g = c.getContext('2d');
    const off = s === 2 ? [130, 250] : [130, 230];
    const cells = []; for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) cells.push([a, b]);
    cells.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
    const iso = (a, b) => [off[0] + (a - b) * 58 - (s - 1) * 0, off[1] + (a + b) * 27.5 - (s - 1) * 55];
    for (const [a, b] of cells) { const [x, y] = iso(a, b); BK.draw(g, 'tiles', Bd.ground || 'grass_center_N', x - 64, y - 118); }
    const st = Bd.stack.slice().sort((p, q) => p[0] + p[1] - q[0] - q[1] || p[2] - q[2]);
    for (const [a, b, lv, n] of st) { const [x, y] = iso(a, b); BK.draw(g, 'tiles', n, x - 64, y - 118 - lv * 55); }
    return THUMB[k] = c.toDataURL();
  }

  // ---------- 건설 상점 ----------
  const countOf = k => S.map.filter(b => b.k === k).length;
  function buildShop() {
    const cards = D.BUILD_ORDER.map(k => {
      const Bd = D.BUILD[k], n = countOf(k), lim = D.limitOf(k, S.castleLv), full = n >= lim;
      return `<div class="bcard ${full ? 'full' : ''}" data-k="${k}"><img src="${thumb(k)}" alt=""><b>${Bd.name}</b><small>${n}/${lim}${lim === 0 ? ' · 성 레벨 필요' : ''}</small><div class="cost">${costHTML(Bd.cost, true)}</div></div>`;
    }).join('');
    const el = openPanel(`<h2>${BK.ic('wrench', 0.5)} 건설</h2><p class="sub">건물을 골라 왕국에 놓아 보세요. 성 레벨이 오르면 더 많이 지을 수 있어요.</p><div class="bgrid">${cards}</div>`, 'wide');
    el.querySelectorAll('.bcard').forEach(c => c.onclick = () => {
      const k = c.dataset.k, Bd = D.BUILD[k];
      if (countOf(k) >= D.limitOf(k, S.castleLv)) return toast(D.limitOf(k, S.castleLv) ? '더 지을 수 없어요. 성 레벨을 올려 보세요!' : '성 레벨을 올리면 지을 수 있어요!', 'bad');
      if (!canPay(Bd.cost)) return toast('자원이 모자라요', 'bad');
      closePanel(); startPlace(k);
    });
  }
  function startPlace(k, moving) {
    K.placing = k; K.moving = moving || null; K.sel = null;
    K.hover = moving ? [moving.i, moving.j] : findFree(k);
    $('#place').classList.add('on'); $('#placeTxt').textContent = `${D.BUILD[k].name}: 놓을 곳을 누르세요`;
    $('#ui').classList.add('placing');
  }
  function findFree(k) { const c = K.N / 2; for (let r = 0; r < K.N; r++) for (let i = c - r; i <= c + r; i++) for (let j = c - r; j <= c + r; j++) if (K.canPlace(k, i, j)) return [i, j]; return [0, 0]; }
  function endPlace(ok) {
    const k = K.placing, [i, j] = K.hover || [0, 0];
    if (ok) {
      if (!K.canPlace(k, i, j, K.moving)) return toast('여기에는 놓을 수 없어요', 'bad');
      if (K.moving) { K.moving.i = i; K.moving.j = j; BK.snd('build', 0.5); }
      else { const Bd = D.BUILD[k]; if (!canPay(Bd.cost)) return toast('자원이 모자라요', 'bad'); pay(Bd.cost); const b = { id: S.nid++, k, i, j, lv: 1, q: [], taxT: now() }; S.map.push(b); BK.snd('build', 0.7); K.popFx(b, 'coin', -(Bd.cost.coin || 0)); toast(`${Bd.name} 완성!`); }
      save();
    }
    K.placing = null; K.moving = null; K.hover = null; $('#place').classList.remove('on'); $('#ui').classList.remove('placing');
  }

  // ---------- 건물 누르기 ----------
  K.onTap = function (x, y) {
    if (K.placing) { K.hover = K.screenToCell(x, y); BK.snd('tap', 0.4); return; }
    // 위층 그림이 뒤 칸을 가리므로 몇 칸 아래쪽도 검사
    let b = null; for (const dy of [0, 30, 60]) { const [i, j] = K.screenToCell(x, y + dy * K.cam.z); b = K.cellBld(i, j); if (b) break; }
    if (!b) { closePanel(); return; }
    BK.snd('tap', 0.5);
    if (collect(b)) return;
    bldPanel(b);
  };
  function collect(b) {
    const Bd = D.BUILD[b.k]; let got = false;
    if (Bd.make) { const r = K.ready(b); if (r.length) { for (const it of r) { const out = Bd.make[it.r].out; gain(out); for (const k in out) { K.popFx(b, k, out[k]); S.stat.made[k] = (S.stat.made[k] || 0) + out[k]; } } b.q = b.q.filter(x => !r.includes(x)); got = true; BK.snd('coin', 0.6); fact(b.k); } }
    if (Bd.tax) { const n = K.taxOf(b); if (n >= 10) { gain({ coin: n }); b.taxT = now(); K.popFx(b, 'coin', n); BK.snd('coin', 0.6); got = true; } }
    if (got) { save(); checkMis(); if ($('#pan').classList.contains('on') && K.sel === b) bldPanel(b); }
    return got;
  }
  function fact(k) { if (S.seen[k]) return; S.seen[k] = 1; const Bd = D.BUILD[k]; if (Bd.fact) setTimeout(() => toast(`🔬 <b>생명과학 상식</b><br>${Bd.desc}<br><small>${Bd.fact}</small>`, 'fact'), 400); }

  function bldPanel(b) {
    K.sel = b; const Bd = D.BUILD[b.k];
    const isCastle = b.k === 'castle';
    let body = `<div class="bhead"><img src="${thumb(b.k)}" alt=""><div><h2>${Bd.name} <span class="lv">Lv.${isCastle ? S.castleLv : b.lv}</span></h2><p>${Bd.desc}</p>${Bd.fact ? `<p class="fact">🔬 ${Bd.fact}</p>` : ''}</div></div>`;
    if (Bd.make) {
      body += `<h3>생산 <small>(동시에 ${K.slots(b)}개까지 줄 세우기)</small></h3><div class="recipes">${Bd.make.map((m, i) => `<button class="rcp" data-r="${i}"><div class="io">${m.in ? `${costHTML(m.in, true)}<span class="arr">➜</span>` : ''}${Object.keys(m.out).map(k => `<span class="cst big">${BK.ri(k, 26)}×${m.out[k]}</span>`).join('')}</div><small>⏱ ${BK.fmtT(m.t / speedMul(b))}</small></button>`).join('')}</div><div class="queue" id="queue"></div>`;
    }
    if (Bd.tax) body += `<h3>세금</h3><div class="taxbox"><span id="taxN">${BK.ri('coin', 22)} ${K.taxOf(b)}</span><small>매력 ${Math.round(K.charm())} → 세금 +${Math.round(K.charm())}%</small><button class="btn green" id="taxGet">걷기</button></div>`;
    if (Bd.market) body += `<h3>자원 팔기</h3><div class="market">${Object.keys(D.SELL).map(k => `<div class="mk"><span>${BK.ri(k, 24)} ${resName(k)} <b>${BK.fmt(S.res[k])}</b></span><small>1개 = ${BK.ri('coin', 14)}${D.SELL[k]}</small><button class="btn" data-sell="${k}" data-n="1">1개</button><button class="btn" data-sell="${k}" data-n="10">10개</button></div>`).join('')}</div>`;
    if (isCastle) {
      const c = D.castleUpCost(S.castleLv);
      body += `<h3>성 강화</h3><p class="sub">성 레벨 ${S.castleLv + 1}: 건물 제한 증가, 행동력 최대치 +5${S.castleLv + 1 === 2 ? ', 유전자 도서관 해금' : ''}</p><div class="row">${costHTML(c, true)}<button class="btn gold" id="castleUp" ${S.castleLv >= 10 ? 'disabled' : ''}>강화</button></div>`;
    } else if (!Bd.deco || b.k === 'tower' || b.k === 'well') {
      const c = D.upCost(b.k, b.lv), max = Math.min(10, S.castleLv + 1);
      body += `<h3>건물 강화</h3><p class="sub">${Bd.make ? '레벨이 오르면 생산이 빨라지고 줄 세울 칸이 늘어요.' : Bd.tax ? '레벨이 오르면 세금이 늘어요.' : '레벨이 오르면 매력이 늘어요.'} (최대 Lv.${max}, 성 레벨 +1까지)</p><div class="row">${costHTML(c, true)}<button class="btn gold" id="bUp" ${b.lv >= max ? 'disabled' : ''}>${b.lv >= max ? '최대' : '강화'}</button></div>`;
    }
    body += `<div class="row end">${!isCastle ? '<button class="btn" id="bMove">옮기기</button>' : '<button class="btn" id="bMove">옮기기</button>'}${Bd.deco && !isCastle ? '<button class="btn red" id="bSell">치우기</button>' : ''}</div>`;
    const el = openPanel(body, 'bld');
    el.querySelectorAll('.rcp').forEach(x => x.onclick = () => startMake(b, +x.dataset.r));
    const q = el.querySelector('#taxGet'); if (q) q.onclick = () => { if (!collect(b)) toast('아직 세금이 조금밖에 없어요'); };
    el.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => { const k = x.dataset.sell, n = Math.min(+x.dataset.n, S.res[k]); if (n <= 0) return toast('팔 자원이 없어요', 'bad'); S.res[k] -= n; S.res.coin += n * D.SELL[k]; BK.snd('coin', 0.5); save(); bldPanel(b); });
    const cu = el.querySelector('#castleUp'); if (cu) cu.onclick = () => { const c = D.castleUpCost(S.castleLv); if (!canPay(c)) return toast('자원이 모자라요', 'bad'); pay(c); S.castleLv++; BK.snd('up', 0.7); BK.snd('v_winner', 0.5); toast(`🏰 생명의 성 레벨 ${S.castleLv}!`); save(); checkMis(); bldPanel(b); };
    const bu = el.querySelector('#bUp'); if (bu) bu.onclick = () => { const c = D.upCost(b.k, b.lv); if (!canPay(c)) return toast('자원이 모자라요', 'bad'); pay(c); b.lv++; BK.snd('up', 0.6); toast(`${Bd.name} Lv.${b.lv}!`); save(); bldPanel(b); };
    el.querySelector('#bMove').onclick = () => { closePanel(); startPlace(b.k, b); };
    const sl = el.querySelector('#bSell'); if (sl) sl.onclick = () => { S.map.splice(S.map.indexOf(b), 1); gain({ coin: Math.floor((Bd.cost.coin || 0) / 2) }); BK.snd('pluck', 0.5); save(); closePanel(); };
    if (Bd.make) { const draw = () => drawQueue(b); draw(); panelTick = draw; }
    else if (Bd.tax) panelTick = () => { const t = $('#taxN'); if (t) t.innerHTML = `${BK.ri('coin', 22)} ${K.taxOf(b)}`; };
  }
  const speedMul = b => 1 + (b.lv - 1) * 0.15;
  function drawQueue(b) {
    const q = $('#queue'); if (!q) return; const Bd = D.BUILD[b.k], n = K.slots(b);
    let h = '';
    for (let i = 0; i < n; i++) {
      const it = b.q[i];
      if (!it) { h += `<div class="slot empty">+</div>`; continue; }
      const out = Bd.make[it.r].out, k = Object.keys(out)[0], left = (it.end - now()) / 1000, start = it.end - it.dur * 1000, p = BK.clamp((now() - start) / (it.dur * 1000), 0, 1);
      h += `<div class="slot ${left <= 0 ? 'done' : ''}">${BK.ri(k, 28)}<b>×${out[k]}</b><i style="--p:${left <= 0 ? 1 : p}"></i><small>${left <= 0 ? '완성!' : now() < start ? '대기' : BK.fmtT(left)}</small></div>`;
    }
    q.innerHTML = h;
    q.querySelectorAll('.slot.done').forEach(s => s.onclick = () => collect(b));
  }
  function startMake(b, r) {
    const Bd = D.BUILD[b.k], m = Bd.make[r];
    if (b.q.length >= K.slots(b)) return toast('줄이 가득 찼어요. 건물을 강화하면 칸이 늘어요', 'bad');
    if (!canPay(m.in || {})) return toast(`재료가 모자라요: ${Object.keys(m.in).filter(k => S.res[k] < m.in[k]).map(resName).join(', ')}`, 'bad');
    pay(m.in || {}); const dur = m.t / speedMul(b), lastEnd = b.q.length ? b.q[b.q.length - 1].end : now();
    b.q.push({ r, end: Math.max(now(), lastEnd) + dur * 1000, dur }); BK.snd('ok', 0.5); save(); drawQueue(b); topbar();
  }

  // ---------- 영웅 ----------
  let heroAnim = null;
  const SHARD = { C: 10, R: 15, E: 25, L: 40 };
  const powerOf = id => { const h = S.heroes[id]; return D.power(D.statsOf(id, h.lv, h.star, h.sk)); };
  const teamPower = () => S.team.reduce((a, id) => a + powerOf(id), 0);
  const stars = n => '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span>';
  function heroList(teamMode) {
    const ids = D.HEROES.map(h => h.id).sort((a, b) => (S.heroes[b] ? 1 : 0) - (S.heroes[a] ? 1 : 0) || 'LERC'.indexOf(D.HERO[a].rar) - 'LERC'.indexOf(D.HERO[b].rar));
    const tm = `<div class="team"><div class="tslots">${[0, 1, 2, 3, 4].map(i => { const id = S.team[i]; return id ? `<div class="tslot r-${D.HERO[id].rar}" data-id="${id}"><img src="${BK.face(id)}" alt=""><small>${D.ROLE[D.HERO[id].role].name}</small></div>` : `<div class="tslot empty">+</div>`; }).join('')}</div><div class="tp">팀 전투력 <b>${BK.fmt(teamPower())}</b></div></div>`;
    const grid = ids.map(id => { const H = D.HERO[id], h = S.heroes[id], inT = S.team.includes(id);
      return `<div class="hcard r-${H.rar} ${h ? '' : 'lock'} ${inT ? 'in' : ''}" data-id="${id}"><img src="${BK.face(id)}" alt="" loading="lazy"><div class="hn">${H.name}</div>${h ? `<div class="hl">Lv.${h.lv}</div><div class="hs">${stars(h.star)}</div>${inT ? '<div class="tag">출전</div>' : ''}` : `<div class="hl">미보유</div>`}<i class="role">${D.ROLE[H.role].name}</i></div>`; }).join('');
    const el = openPanel(`<h2>${BK.ic('figurine', 0.5)} 영웅 <small>${Object.keys(S.heroes).length}/${D.HEROES.length}</small></h2>${tm}<p class="sub">${teamMode ? '영웅을 눌러 팀에 넣거나 빼세요 (5명). 돌격은 앞, 마법·지원은 뒤에 서요.' : '영웅을 눌러 자세히 보고 성장시켜요. 위의 팀 칸을 누르면 팀 편성 모드가 돼요.'}</p><div class="hgrid">${grid}</div><div class="row end"><button class="btn ${teamMode ? 'gold' : ''}" id="teamMode">${teamMode ? '편성 끝' : '팀 편성'}</button></div>`, 'wide heroes');
    el.querySelector('#teamMode').onclick = () => heroList(!teamMode);
    el.querySelectorAll('.tslot').forEach(t => t.onclick = () => heroList(true));
    el.querySelectorAll('.hcard').forEach(c => c.onclick = () => {
      const id = c.dataset.id; if (!S.heroes[id]) { heroDetail(id); return; }
      if (teamMode) { const i = S.team.indexOf(id); if (i >= 0) { if (S.team.length <= 1) return toast('최소 1명은 있어야 해요', 'bad'); S.team.splice(i, 1); } else { if (S.team.length >= 5) return toast('팀은 5명까지예요', 'bad'); S.team.push(id); } BK.snd('tap'); save(); heroList(true); }
      else heroDetail(id);
    });
  }
  function heroDetail(id) {
    const H = D.HERO[id], h = S.heroes[id], R = D.RARITY[H.rar], Ro = D.ROLE[H.role];
    const st = h ? D.statsOf(id, h.lv, h.star, h.sk) : D.statsOf(id, 1, 1, 1);
    const sk = H.sk, skTxt = skillText(H, h ? h.sk : 1);
    let grow = '';
    if (h) {
      const lc = D.lvCost(h.lv), ml = D.maxLv(h.star), sc = D.skCost(h.sk), need = D.starCost(h.star), skMax = 4 + h.star;
      grow = `<div class="grow">
        <div class="gr"><div><b>레벨 ${h.lv}/${ml}</b><small>단백질로 몸을 키워요</small></div>${costHTML(lc, true)}<button class="btn green" id="hLv" ${h.lv >= ml ? 'disabled' : ''}>${h.lv >= ml ? '최대' : '레벨 업'}</button></div>
        <div class="gr"><div><b>승급 ${stars(h.star)}</b><small>영혼석 ${h.shard}/${h.star >= 5 ? '-' : need} · 최대 레벨 +10</small></div><div class="shbar"><i style="width:${h.star >= 5 ? 100 : Math.min(100, h.shard / need * 100)}%"></i></div><button class="btn gold" id="hStar" ${h.star >= 5 || h.shard < need ? 'disabled' : ''}>승급</button></div>
        <div class="gr"><div><b>스킬 Lv.${h.sk}/${skMax}</b><small>DNA로 스킬을 강화해요 (+10%)</small></div>${costHTML(sc, true)}<button class="btn blue" id="hSk" ${h.sk >= skMax ? 'disabled' : ''}>강화</button></div>
      </div>`;
    } else grow = `<p class="sub">아직 만나지 못한 영웅이에요. 생명의 알에서 만날 수 있어요!</p>`;
    const el = openPanel(`<div class="hd r-${H.rar}"><div class="hdl"><canvas id="hcv" width="320" height="300"></canvas><div class="rar" style="background:${R.col}">${R.name}</div></div>
      <div class="hdr"><h2>${H.name}</h2><div class="meta"><span class="role">${Ro.name}</span>${h ? `<span>${stars(h.star)}</span>` : ''}<span>전투력 <b>${BK.fmt(D.power(st))}</b></span></div>
      <div class="stats"><span>❤️ 체력 <b>${st.hp}</b></span><span>⚔️ 공격 <b>${st.atk}</b></span><span>🛡️ 방어 <b>${st.def}</b></span><span>🎯 사거리 <b>${st.range > 150 ? '원거리' : '근거리'}</b></span></div>
      <div class="skill"><b>✨ ${H.skill}</b> <small>재사용 ${sk.cd}초</small><p>${skTxt}</p></div>
      <div class="fact">🔬 <b>생명과학 상식</b><br>${H.fact}</div></div></div>${grow}<div class="row end"><button class="btn" id="hBack">← 영웅 목록</button></div>`, 'wide hdet');
    el.querySelector('#hBack').onclick = () => heroList(false);
    if (h) {
      el.querySelector('#hLv').onclick = () => { const c = D.lvCost(h.lv); if (!canPay(c)) return toast('단백질이나 코인이 모자라요. 리보솜 공방에서 단백질을 만들어요!', 'bad'); pay(c); h.lv++; S.stat.lvups++; BK.snd('up', 0.6); save(); checkMis(); heroDetail(id); };
      el.querySelector('#hStar').onclick = () => { const need = D.starCost(h.star); if (h.shard < need) return; h.shard -= need; h.star++; BK.snd('v_winner', 0.5); BK.snd('up', 0.7); toast(`${H.name} ${h.star}성 승급!`); save(); heroDetail(id); };
      el.querySelector('#hSk').onclick = () => { const c = D.skCost(h.sk); if (!canPay(c)) return toast('DNA나 코인이 모자라요. 유전자 도서관에서 DNA를 연구해요!', 'bad'); pay(c); h.sk++; BK.snd('skill', 0.5); save(); heroDetail(id); };
    }
    // 움직이는 영웅
    const cv = el.querySelector('#hcv'), g = cv.getContext('2d'); let t = 0, mode = 'idle', mt = 0; const seq = ['idle', 'walk', 'atk', 'skill', 'win'];
    cv.onclick = () => { mode = seq[(seq.indexOf(mode) + 1) % seq.length]; mt = 0; BK.snd('tap'); };
    heroAnim = dt => { t += dt * 9; mt += dt; if (mode !== 'idle' && mode !== 'walk' && mt > 1.6) mode = 'idle'; g.clearRect(0, 0, 320, 300); g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(160, 262, 80, 18, 0, 0, 7); g.fill(); BK.drawHero(g, id, mode, t, 160, 262, 1.7, false, h ? 1 : 0.35); };
  }
  function skillText(H, lv) {
    const s = H.sk, p = Math.round(s.p * (1 + (lv - 1) * 0.1) * 100);
    return ({ dmg: `가까운 적 하나에게 공격력의 ${p}% 피해${s.crit ? ' (절반 확률로 치명타)' : ''}.`, aoe: `${s.line ? '모든 적' : '앞쪽 적 무리'}에게 공격력의 ${p}% 피해${s.knock ? ', 뒤로 밀어냄' : ''}.`,
      heal: `${s.all ? '모든 아군' : '체력이 가장 적은 아군'}의 체력을 최대 체력의 ${p}%만큼 회복${s.buff ? `, 공격력 +${Math.round(s.buff * 100)}%` : ''}.`, buff: `모든 아군 공격력 +${p}% (${s.dur}초).`,
      shield: `${s.self ? '자신' : s.all ? '모든 아군' : '체력이 가장 적은 아군'}에게 최대 체력 ${p}%의 보호막${s.heal ? `, 체력 ${Math.round(s.heal * 100)}% 회복` : ''}.`, taunt: `${s.dur}초 동안 적의 공격을 모두 끌어당기고 최대 체력 ${p}%의 보호막.`,
      slow: `모든 적에게 공격력의 ${p}% 피해, ${s.dur}초 동안 느려짐.`, multi: `무작위 적에게 ${s.hits}번 던져 각각 공격력의 ${p}% 피해.`, snipe: `가장 뒤에 있는 적에게 공격력의 ${p}% 치명타.`,
      cleanse: `모든 아군의 해로운 효과를 없애고 체력 ${p}% 회복.`, drain: `적 하나에게 공격력의 ${p}% 피해, 준 피해만큼 회복.`, transform: `${s.dur}초 동안 나비로 변해 공격력 ×${(p / 100).toFixed(1)}, 공격 속도 상승.` })[s.k] || '';
  }

  // ---------- 뽑기 (생명의 알) ----------
  function gachaPanel() {
    const el = openPanel(`<h2>${BK.ic('star', 0.5)} 생명의 알</h2><p class="sub">알 속에서 새로운 동물 영웅이 태어나요! 이미 있는 영웅이 나오면 승급에 쓰는 영혼석이 돼요.</p>
      <div class="gacha"><canvas id="gcv" width="360" height="300"></canvas><div class="rates">${Object.entries(D.GACHA.rate).map(([k, v]) => `<span style="color:${D.RARITY[k].col}">${D.RARITY[k].name} ${Math.round(v * 100)}%</span>`).join('')}</div>
      <div class="row center"><button class="btn blue big" id="g1">1번 부화<br><small>${BK.ri('gem', 16)} ${D.GACHA.one}</small></button><button class="btn gold big" id="g10">10번 부화<br><small>${BK.ri('gem', 16)} ${D.GACHA.ten} · 희귀 이상 1개 보장</small></button></div></div>`, 'gachaP');
    const cv = el.querySelector('#gcv'), g = cv.getContext('2d'); let t = 0;
    heroAnim = dt => { t += dt; g.clearRect(0, 0, 360, 300); const gr = g.createRadialGradient(180, 160, 10, 180, 160, 150); gr.addColorStop(0, 'rgba(255,240,180,.6)'); gr.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 360, 300); BK.drawEgg(g, 180, 170 + Math.sin(t * 2) * 6, 80, '#8fe0b8', 0, t, 0.3); };
    el.querySelector('#g1').onclick = () => pull(1); el.querySelector('#g10').onclick = () => pull(10);
  }
  function rollRar(minR) { let r = Math.random(), acc = 0; for (const k of ['L', 'E', 'R', 'C']) { acc += D.GACHA.rate[k]; if (r < acc) return minR && k === 'C' ? 'R' : k; } return 'C'; }
  function pull(n) {
    const cost = n === 10 ? D.GACHA.ten : D.GACHA.one;
    if (S.res.gem < cost) return toast('크리스탈이 모자라요. 모험과 임무에서 얻을 수 있어요!', 'bad');
    S.res.gem -= cost; const out = [];
    for (let i = 0; i < n; i++) {
      const rar = rollRar(n === 10 && i === 9 && !out.some(o => o.rar !== 'C')), pool = D.HEROES.filter(h => h.rar === rar), H = pool[Math.floor(Math.random() * pool.length)];
      const isNew = !S.heroes[H.id]; if (isNew) S.heroes[H.id] = { lv: 1, star: 1, sk: 1, shard: 0 }; else S.heroes[H.id].shard += SHARD[rar];
      out.push({ id: H.id, rar, isNew });
    }
    S.stat.pulls += n; save(); checkMis(); hatch(out);
  }
  function hatch(out) {
    closePanel();
    const best = out.reduce((a, o) => 'LERC'.indexOf(o.rar) < 'LERC'.indexOf(a) ? o.rar : a, 'C'), col = D.RARITY[best].col;
    const ov = $('#hatch'); ov.innerHTML = `<canvas id="htc"></canvas><div class="hres"></div><button class="btn gold" id="hOk" style="display:none">확인</button><div class="tapmsg">알을 눌러 깨워요!</div>`; ov.classList.add('on');
    const cv = ov.querySelector('#htc'), g = cv.getContext('2d'); const DP = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * DP; cv.height = innerHeight * DP;
    let t = 0, crack = 0, taps = 0, phase = 0, last = performance.now(), boom = 0; BK.snd('open');
    const tap = () => { if (phase) return; taps++; crack = Math.min(1, taps / 3); BK.snd('hit' + (1 + taps % 3), 0.6, 1.2); if (taps >= 3) { phase = 1; boom = 0; BK.snd('boom', 0.6); BK.snd(best === 'L' ? 'v_flawless' : best === 'E' ? 'v_winner' : 'up', 0.7); setTimeout(show, 700); } };
    cv.onpointerdown = tap; ov.querySelector('.tapmsg').onpointerdown = tap;
    function frame(n) {
      if (!ov.classList.contains('on')) return; requestAnimationFrame(frame); const dt = Math.min(0.05, (n - last) / 1000); last = n; t += dt;
      const w = innerWidth, h = innerHeight; g.setTransform(DP, 0, 0, DP, 0, 0);
      const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.7); gr.addColorStop(0, BK.shade(col, phase ? 0.3 : -0.2)); gr.addColorStop(1, '#1a1030'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.save(); g.translate(w / 2, h / 2); g.rotate(t * 0.2); g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(w, h), -60); g.lineTo(Math.max(w, h), 60); g.fill(); } g.restore();
      const r = Math.min(w, h) * 0.16, shake = phase ? 0 : Math.sin(t * 30) * crack * 8;
      if (!phase) BK.drawEgg(g, w / 2 + shake, h / 2 + Math.sin(t * 2) * 6, r, '#8fe0b8', crack, t, 0.4 + crack);
      else { boom += dt; BK.burst(g, w / 2, h / 2, r * 3, col, Math.min(1, boom * 1.5)); }
    }
    requestAnimationFrame(frame);
    function show() {
      ov.querySelector('.tapmsg').style.display = 'none';
      const box = ov.querySelector('.hres'); box.className = 'hres ' + (out.length > 1 ? 'many' : 'one');
      box.innerHTML = out.map((o, i) => { const H = D.HERO[o.id]; return `<div class="hr r-${o.rar}" style="animation-delay:${i * 0.12}s"><img src="${BK.face(o.id)}" alt=""><b>${H.name}</b><small style="color:${D.RARITY[o.rar].col}">${D.RARITY[o.rar].name}</small>${o.isNew ? '<i class="new">NEW</i>' : `<i class="sh">영혼석 +${SHARD[o.rar]}</i>`}</div>`; }).join('');
      out.forEach((o, i) => setTimeout(() => BK.snd(o.rar === 'L' ? 'v_winner' : o.rar === 'E' ? 'up' : 'pluck', 0.5), i * 120));
      const ok = ov.querySelector('#hOk'); ok.style.display = ''; ok.onclick = () => { ov.classList.remove('on'); ov.innerHTML = ''; gachaPanel(); };
    }
  }

  // ---------- 모험 ----------
  let advCh = 0;
  function advPanel(ci) {
    if (ci == null) ci = Math.min(D.CHAPTERS.length - 1, Math.floor(S.clear / D.STAGES_PER)); advCh = ci;
    const C = D.CHAPTERS[ci], unlockedCh = Math.floor(S.clear / D.STAGES_PER);
    const nodes = []; for (let si = 0; si < D.STAGES_PER; si++) { const idx = ci * D.STAGES_PER + si, open = idx <= S.clear, st = S.stars[idx] || 0; const x = 8 + si * 9.3, y = 60 + Math.sin(si * 1.1) * 24; nodes.push(`<button class="node ${open ? '' : 'lock'} ${si === 9 ? 'boss' : ''} ${idx === S.clear ? 'cur' : ''}" style="left:${x}%;top:${y}%" data-si="${si}">${si === 9 ? '👑' : si + 1}<span class="ns">${open && st ? '★'.repeat(st) : ''}</span></button>`); }
    const tabs = D.CHAPTERS.map((c, i) => `<button class="ctab ${i === ci ? 'on' : ''} ${i > unlockedCh ? 'lock' : ''}" data-ci="${i}">${i + 1}장 ${c.name}</button>`).join('');
    const el = openPanel(`<h2>${BK.ic('flag', 0.5)} 모험 <small>행동력 ${BK.ri('energy', 16)} ${S.res.energy}</small></h2><div class="ctabs">${tabs}</div><div class="amap" style="background-image:url(${BK.A}bg/${C.bg}.webp)"><svg class="apath" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${[...Array(10)].map((_, si) => `${8 + si * 9.3 + 3},${60 + Math.sin(si * 1.1) * 24 + 4}`).join(' ')}" /></svg>${nodes.join('')}<div class="story">${C.story}</div></div>`, 'wide adv');
    el.querySelectorAll('.ctab').forEach(b => b.onclick = () => { const i = +b.dataset.ci; if (i > unlockedCh) return toast('앞 장을 먼저 깨야 해요', 'bad'); advPanel(i); });
    el.querySelectorAll('.node').forEach(b => b.onclick = () => { const si = +b.dataset.si; if (ci * D.STAGES_PER + si > S.clear) return toast('앞 스테이지를 먼저 깨야 해요', 'bad'); stagePanel(ci, si); });
  }
  function stagePanel(ci, si) {
    const stg = D.stage(ci, si), idx = ci * D.STAGES_PER + si, first = idx >= S.clear;
    const foes = [...new Set(stg.waves.flat())], rec = Math.round(1500 * (1 + 0.08 * (stg.lvl - 1)) * (stg.boss ? 1.15 : 1)), tp = teamPower();
    const el = openPanel(`<h2>스테이지 ${stg.name} ${stg.boss ? '<span class="bosstag">보스</span>' : ''}</h2>
      <h3>나타나는 병원체</h3><div class="foes">${foes.map(id => `<div class="foe ${D.ENEMIES[id].boss ? 'boss' : ''}" data-id="${id}"><canvas width="96" height="96" data-e="${id}"></canvas><small>${D.ENEMIES[id].name}</small></div>`).join('')}</div>
      <p class="fact" id="foeFact">🔬 병원체를 누르면 설명을 볼 수 있어요.</p>
      <h3>우리 팀 <small>전투력 <b class="${tp < rec ? 'warn' : 'ok'}">${BK.fmt(tp)}</b> / 권장 ${BK.fmt(rec)}</small></h3>
      <div class="tslots small">${S.team.map(id => `<div class="tslot r-${D.HERO[id].rar}"><img src="${BK.face(id)}" alt=""><small>Lv.${S.heroes[id].lv}</small></div>`).join('')}</div>
      <h3>보상 ${first ? '<small>(처음 깰 때)</small>' : ''}</h3><div class="row">${costHTML({ coin: stg.reward.coin, gem: first ? stg.reward.gem : 5, glucose: stg.reward.glucose, protein: stg.reward.protein })}<span class="cst">💎 영혼석 ×${stg.reward.shard}</span></div>
      <div class="row end"><button class="btn" id="sTeam">팀 편성</button><button class="btn" id="sBack">← 지도</button><button class="btn gold big" id="sGo">전투 시작 ${BK.ri('energy', 18)}${stg.cost}</button></div>`, 'stage');
    el.querySelectorAll('canvas[data-e]').forEach(c => { const g = c.getContext('2d'), E = D.ENEMIES[c.dataset.e]; BK.drawEnemy(g, E, 48, 86, E.boss ? 0.62 : 0.85, 1, {}); });
    el.querySelectorAll('.foe').forEach(f => f.onclick = () => { const E = D.ENEMIES[f.dataset.id]; $('#foeFact').innerHTML = `🔬 <b>${E.name}</b>: ${E.fact}`; BK.snd('tap'); });
    el.querySelector('#sTeam').onclick = () => heroList(true);
    el.querySelector('#sBack').onclick = () => advPanel(ci);
    el.querySelector('#sGo').onclick = () => { tickEnergy(); if (S.res.energy < stg.cost) return toast('행동력이 모자라요 (3분마다 1씩 차요)', 'bad'); if (!S.team.length) return toast('팀에 영웅을 넣어 주세요', 'bad'); S.res.energy -= stg.cost; save(); startBattle(stg); };
  }
  let lastStage = null;
  function startBattle(stg) {
    lastStage = stg; closePanel(); BK.mode = 'battle';
    $('#ui').style.display = 'none'; $('#kcv').style.display = 'none'; $('#bcv').style.display = 'block';
    B.onPause = pauseMenu;
    B.start(stg, S.team.slice(), res => result(res));
  }
  function backToKingdom() { B.stop(); BK.mode = 'town'; $('#bcv').style.display = 'none'; $('#kcv').style.display = 'block'; $('#ui').style.display = ''; $('#res').classList.remove('on'); BK.music(S.opt.music ? 'town' : null); topbar(); }
  function pauseMenu() {
    const r = $('#res'); r.innerHTML = `<div class="rc"><h2>일시 정지</h2><div class="row center"><button class="btn green big" id="pGo">계속하기</button><button class="btn red" id="pQuit">포기하기</button></div></div>`; r.classList.add('on');
    r.querySelector('#pGo').onclick = () => { r.classList.remove('on'); B.resume(); };
    r.querySelector('#pQuit').onclick = () => { r.classList.remove('on'); B.quit(); backToKingdom(); };
  }
  function result(res) {
    const stg = res.stage, idx = stg.ci * D.STAGES_PER + stg.si, first = idx >= S.clear; let rw = {}, shardTo = null;
    if (res.win) {
      rw = { coin: stg.reward.coin, gem: first ? stg.reward.gem : 5, glucose: stg.reward.glucose, protein: stg.reward.protein }; gain(rw);
      shardTo = S.team[Math.floor(Math.random() * S.team.length)]; S.heroes[shardTo].shard += stg.reward.shard;
      if (first) S.clear = idx + 1; S.stars[idx] = Math.max(S.stars[idx] || 0, res.stars); S.stat.wins++;
      try { window.BioGoal && BioGoal.progress('bio-kingdom', S.clear); } catch (e) { }
    } else { S.res.energy += Math.floor(stg.cost / 2); }
    save(); checkMis();
    const r = $('#res'), hasNext = res.win && idx + 1 < D.CHAPTERS.length * D.STAGES_PER;
    r.innerHTML = `<div class="rc ${res.win ? 'win' : 'lose'}"><h1>${res.win ? '승리!' : '패배…'}</h1>${res.win ? `<div class="bigstars">${[0, 1, 2].map(i => `<i class="${i < res.stars ? 'on' : ''}" style="animation-delay:${0.3 + i * 0.25}s">★</i>`).join('')}</div><div class="row center">${costHTML(rw)}</div><p class="sub"><img src="${BK.face(shardTo)}" class="mini" alt=""> ${D.HERO[shardTo].name} 영혼석 +${stg.reward.shard}</p>` : `<p class="sub">영웅을 키우고 팀을 바꿔 다시 도전해요!<br>행동력 ${Math.floor(stg.cost / 2)} 돌려받음 · 팁: 리보솜 공방의 단백질로 레벨을 올려요.</p>`}
      <div class="row center"><button class="btn" id="rHome">왕국으로</button><button class="btn blue" id="rAgain">다시 하기</button>${hasNext ? '<button class="btn gold" id="rNext">다음 스테이지</button>' : ''}</div></div>`;
    r.classList.add('on');
    r.querySelector('#rHome').onclick = backToKingdom;
    r.querySelector('#rAgain').onclick = () => { r.classList.remove('on'); B.stop(); BK.mode = 'town'; $('#bcv').style.display = 'none'; $('#kcv').style.display = 'block'; $('#ui').style.display = ''; stagePanel(stg.ci, stg.si); };
    const nx = r.querySelector('#rNext'); if (nx) nx.onclick = () => { r.classList.remove('on'); B.stop(); BK.mode = 'town'; $('#bcv').style.display = 'none'; $('#kcv').style.display = 'block'; $('#ui').style.display = ''; const n = idx + 1; stagePanel(Math.floor(n / D.STAGES_PER), n % D.STAGES_PER); };
  }

  // ---------- 임무 (따라 하며 배우기) ----------
  const MIS = [
    { t: '광합성 밭에서 포도당 모으기', d: '밭을 눌러 생산을 시작하고, 다 되면 다시 눌러 모아요.', ok: () => (S.stat.made.glucose || 0) >= 3, rw: { coin: 300 } },
    { t: '첫 모험: 스테이지 1-1 깨기', d: '아래 모험 버튼을 눌러요.', ok: () => S.clear >= 1, rw: { gem: 300 } },
    { t: '생명의 알 부화하기', d: '뽑기에서 새 영웅을 만나요.', ok: () => S.stat.pulls >= 1, rw: { coin: 300 } },
    { t: '미토콘드리아로 ATP 만들기', d: '포도당을 분해해 에너지 ATP를 만들어요 (세포 호흡).', ok: () => (S.stat.made.atp || 0) >= 3, rw: { coin: 400 } },
    { t: '영웅 레벨 올리기', d: '영웅 화면에서 단백질로 레벨을 올려요.', ok: () => S.stat.lvups >= 1, rw: { gem: 150 } },
    { t: '스테이지 1-5 깨기', d: '', ok: () => S.clear >= 5, rw: { gem: 300, protein: 10 } },
    { t: '리보솜 공방 짓기', d: '건설에서 리보솜 공방을 지어요.', ok: () => S.map.some(b => b.k === 'ribo'), rw: { gem: 200 } },
    { t: '생명의 성 레벨 2', d: '성을 눌러 강화해요. 유전자 도서관이 열려요.', ok: () => S.castleLv >= 2, rw: { gem: 300 } },
    { t: '리보솜에서 단백질 만들기', d: 'DNA 정보를 읽어 단백질을 만들어요 (번역).', ok: () => (S.stat.made.protein || 0) >= 2, rw: { coin: 800 } },
    { t: '1장 보스 독감 바이러스 군주 물리치기', d: '', ok: () => S.clear >= 10, rw: { gem: 600 } },
    { t: '생명의 성 레벨 3', d: '건물을 더 많이 지을 수 있어요.', ok: () => S.castleLv >= 3, rw: { gem: 400 } },
    { t: '유전자 도서관에서 DNA 연구하기', d: 'DNA로 영웅 스킬을 강화할 수 있어요.', ok: () => (S.stat.made.dna || 0) >= 1, rw: { coin: 1500 } },
    { t: '영웅 10명 모으기', d: '', ok: () => Object.keys(S.heroes).length >= 10, rw: { gem: 800 } },
    { t: '2장 보스 슈퍼박테리아 물리치기', d: '', ok: () => S.clear >= 20, rw: { gem: 900 } },
    { t: '3장 보스 곰팡이 여왕 물리치기', d: '', ok: () => S.clear >= 30, rw: { gem: 1200 } },
    { t: '4장 보스 플라스티라 물리치기', d: '바다를 지켰어요!', ok: () => S.clear >= 40, rw: { gem: 2000 } }
  ];
  function checkMis() {
    const el = $('#mis'); const m = MIS[S.mis];
    if (!m) { el.style.display = 'none'; return; }
    const done = m.ok(); el.style.display = '';
    el.className = done ? 'done' : '';
    el.innerHTML = `<small>임무 ${S.mis + 1}/${MIS.length}</small><b>${m.t}</b>${m.d && !done ? `<p>${m.d}</p>` : ''}<div class="mr">${costHTML(m.rw)}${done ? '<button class="btn green" id="misGet">받기</button>' : ''}</div>`;
    const b = el.querySelector('#misGet'); if (b) b.onclick = e => { e.stopPropagation(); gain(m.rw); S.mis++; BK.snd('coin', 0.7); BK.snd('up', 0.5); toast('임무 완료! 보상을 받았어요'); save(); checkMis(); topbar(); };
  }

  // ---------- 저장 ----------
  function save() { BK.saveState(); }

  // ---------- 시작 ----------
  let last = 0, tbT = 0;
  function loop(n) {
    requestAnimationFrame(loop); const dt = Math.min(0.05, (n - last) / 1000); last = n;
    if (BK.mode === 'battle') return;
    K.updateFolk(dt); K.render(n / 1000);
    if (heroAnim) heroAnim(dt);
    tbT -= dt; if (tbT <= 0) { tbT = 0.5; topbar(); if (panelTick) panelTick(); }
  }
  BK.start = function () {
    S = BK.S = BK.loadState() || fresh();
    S.opt = S.opt || { auto: false, x2: false, music: true }; S.stat = S.stat || { pulls: 0, wins: 0, lvups: 0, made: {} }; S.seen = S.seen || {};
    K.init($('#kcv')); B.init($('#bcv'), $('#bt'));
    BK.mode = 'town';
    $('#mBuild').onclick = buildShop; $('#mHero').onclick = () => heroList(false); $('#mGacha').onclick = gachaPanel; $('#mAdv').onclick = () => advPanel();
    $('#placeOk').onclick = () => endPlace(true); $('#placeNo').onclick = () => endPlace(false);
    $('#mSet').onclick = settings;
    $$('[data-hub]').forEach(b => b.onclick = () => { save(); location.href = '../index.html'; });
    addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    setInterval(save, 10000);
    topbar(); checkMis(); setInterval(checkMis, 2000);
    BK.preloadSnd(['click', 'tap', 'open', 'close', 'ok', 'err', 'coin', 'build', 'pluck', 'up', 'glass', 'hit1', 'hit2', 'hit3', 'heal', 'laser', 'boom', 'skill', 'v_ready', 'v_fight', 'v_win', 'v_lose', 'v_combo', 'v_final', 'v_flawless', 'v_round1', 'v_winner']);
    requestAnimationFrame(loop);
    if (!BK.loadState()) save();
  };
  BK.startMusic = () => { if (S.opt.music) BK.music('town'); };
  function settings() {
    const el = openPanel(`<h2>${BK.ic('gear', 0.5)} 설정</h2><div class="set"><label><input type="checkbox" id="oMus" ${S.opt.music ? 'checked' : ''}> 배경 음악</label><label><input type="checkbox" id="oSnd" ${BK.muted ? '' : 'checked'}> 효과음</label></div>
      <h3>도움말</h3><p class="sub">· 건물을 눌러 생산을 시작하고, 말풍선이 뜨면 눌러 모아요.<br>· 포도당 → (미토콘드리아) ATP → (리보솜) 단백질 → 영웅 레벨 업<br>· ATP → (유전자 도서관) DNA → 스킬 강화<br>· 집은 세금(코인)을, 나무·우물 같은 장식은 매력을 올려 세금을 늘려요.<br>· 손가락 두 개로 확대/축소, 끌어서 이동해요.</p>
      <div class="row end"><button class="btn red" id="oReset">처음부터 다시</button></div>`);
    el.querySelector('#oMus').onchange = e => { S.opt.music = e.target.checked; BK.music(S.opt.music ? 'town' : null); save(); };
    el.querySelector('#oSnd').onchange = e => { BK.muted = !e.target.checked; };
    el.querySelector('#oReset').onclick = () => { if (confirm('정말 처음부터 다시 할까요? 모든 진행이 사라져요.')) { localStorage.removeItem('bioKingdomSave'); location.reload(); } };
  }
  BK.dbg = { fresh, gain: c => { gain(c); topbar(); }, startBattle: (ci, si) => startBattle(D.stage(ci, si)), pull, MIS };
})();

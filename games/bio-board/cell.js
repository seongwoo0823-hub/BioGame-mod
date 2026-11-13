/* 게임 2: 모두의 세포 — 주사위 경영 보드게임 (24칸 · ATP · 효소→채널→메가 오가넬 타워 · 인수 · 돌연변이 카드 · G0기 · 세포외 배출 · 알로스테릭 활성화) */
'use strict';
BB.GAMES = BB.GAMES || {};
(function () {
  const GROUPS = [
    {name: '유전/합성 구역', color: '#7cc4ff'},
    {name: '에너지 대사 구역', color: '#ffb65c'},
    {name: '물질수송/방어 구역', color: '#8fe388'},
    {name: '신경/면역 구역', color: '#d59bff'}
  ];
  // 칸: 0 시작(핵) · 1~5 아래줄(왼쪽으로) · 6 G0 · 7~11 왼쪽줄(위로) · 12 알로스테릭 · 13~17 위줄(오른쪽으로) · 18 세포외 배출 · 19~23 오른쪽줄(아래로)
  const SQ = [];
  SQ[0] = {k: 'start', name: '핵 (출발)', info: '핵에는 DNA가 있어요. 지나가거나 도착하면 전사·번역 지원금 +200 ATP!'};
  SQ[6] = {k: 'jail', name: 'G0기 (휴지기)', info: '세포 주기를 멈춘 상태. 3턴 동안 못 움직여요(더블이 나오거나 ATP 150을 내면 다시 진입).'};
  SQ[12] = {k: 'allo', name: '알로스테릭 효소 활성화 센터', info: '효소의 다른 자리(알로스테릭 부위)에 물질이 붙으면 활성이 바뀌어요. 내 소기관 하나의 통행료를 2배로(최대 4배)!'};
  SQ[18] = {k: 'exo', name: '세포외 배출 포탈', info: '소낭이 세포막과 합쳐져 물질을 내보내는 세포외 배출. 원하는 칸으로 바로 표적 수송!'};
  for (const i of [3, 9, 15, 21]) SQ[i] = {k: 'card', name: '돌연변이·항상성 카드', info: '유익한 돌연변이일까, 병원체 감염일까? 카드를 뽑아요.'};
  const PROPS = [
    [1, 0, '인', 60, 'rRNA를 만들고 리보솜 조립이 시작되는 핵 속 구조예요.'],
    [2, 0, '거친면 소포체', 70, '표면에 리보솜이 붙어 있어 단백질을 합성해 골지체로 보내요.'],
    [4, 0, '매끈면 소포체', 80, '리보솜이 없고 지질 합성과 해독 작용을 해요.'],
    [5, 0, '리보솜', 90, 'mRNA의 코돈을 읽어 아미노산을 펩타이드 결합으로 이어요.'],
    [7, 0, '골지체', 100, '단백질을 가공·포장해 소낭에 담아 보내는 세포의 물류센터.'],
    [8, 1, '미토콘드리아', 120, '세포 호흡으로 포도당의 에너지를 ATP로 바꿔요.'],
    [10, 1, '엽록체', 130, '빛에너지로 포도당을 만드는 광합성 장소(식물 세포).'],
    [11, 1, '세포질 (해당과정)', 140, '포도당 1분자가 피루브산 2분자로 분해되며 ATP 2분자를 얻어요.'],
    [13, 1, '퍼옥시좀', 150, '과산화 수소를 분해하고 지방산을 산화해요.'],
    [14, 2, '리소좀', 170, '가수 분해 효소로 세포 안의 낡은 소기관과 침입자를 분해해요.'],
    [16, 2, '중심체', 180, '동물 세포 분열 때 방추사를 만들어 염색체를 끌어당겨요.'],
    [17, 2, '액포', 190, '물과 노폐물을 저장해요. 식물 세포에서 특히 커요.'],
    [19, 2, '세포막 (Na⁺-K⁺ 펌프)', 200, 'ATP를 써서 Na⁺ 3개를 내보내고 K⁺ 2개를 들여오는 능동 수송.'],
    [20, 3, '시냅스 소포', 230, '신경 전달 물질을 담았다가 세포외 배출로 시냅스 틈에 내보내요.'],
    [22, 3, 'T세포 수용체', 260, 'T 림프구가 항원 조각을 알아보는 수용체. 세포성 면역의 시작!'],
    [23, 3, 'B세포 항체 공방', 300, '형질 세포로 분화한 B 림프구는 항체를 대량으로 만들어요(체액성 면역).']
  ];
  for (const [i, g, name, price, info] of PROPS) SQ[i] = {k: 'prop', g, name, price, info};
  const GROUP_SQ = [0, 1, 2, 3].map(g => SQ.map((s, i) => s.k === 'prop' && s.g === g ? i : -1).filter(i => i >= 0));
  const START_ATP = 2000, SALARY = 200, MAX_ROUND = 20, JAIL_FEE = 150;
  const upCost = (sq, lv) => Math.round(SQ[sq].price * (lv === 1 ? 0.7 : 1.2));
  const tollOf = (st, sq) => { const o = st.own[sq]; if (!o) return 0; return Math.round(SQ[sq].price * [0.3, 0.9, 2.0][o.lv - 1] * o.mult); };
  const LV_NAME = ['', '기초 효소', '막단백질 채널', '메가 오가넬 타워'];
  const CARDS = [
    {t: '광합성 대박', d: '+300 ATP', good: 1, f: (st, s, ev) => give(st, s, 300, ev)},
    {t: '해당과정 보너스', d: '+150 ATP', good: 1, f: (st, s, ev) => give(st, s, 150, ev)},
    {t: '유익한 돌연변이', d: '내 소기관 하나 무료 증축', good: 1, f: (st, s, ev) => { const c = ownedBy(st, s).filter(q => st.own[q].lv < 3).sort((a, b) => SQ[b].price - SQ[a].price)[0]; if (c != null) { st.own[c].lv++; ev.push({t: 'build', sq: c, lv: st.own[c].lv, seat: s, free: 1}); } else give(st, s, 100, ev); }},
    {t: '수평 유전자 이동', d: '상대의 소기관 하나를 투자액에 강제 인수', good: 1, f: (st, s, ev) => { const c = st.own.map((o, q) => o && o.seat !== s && o.lv < 3 ? q : -1).filter(q => q >= 0 && st.players[s].atp >= st.own[q].inv).sort((a, b) => st.own[b].inv - st.own[a].inv)[0]; if (c != null) { const o = st.own[c]; pay(st, s, o.seat, o.inv, ev); if (!st.players[s].out) { ev.push({t: 'steal', sq: c, from: o.seat, seat: s}); o.seat = s; } } else give(st, s, 100, ev); }},
    {t: '내성 획득', d: '다음 통행료 1번 면제 (백신 효과)', good: 1, f: (st, s, ev) => { st.players[s].shield = 1; }},
    {t: '바이러스 감염', d: '-150 ATP', good: 0, f: (st, s, ev) => pay(st, s, -1, 150, ev)},
    {t: '활성 산소 손상', d: '가진 ATP의 10% 지불', good: 0, f: (st, s, ev) => pay(st, s, -1, Math.round(st.players[s].atp * 0.1), ev)},
    {t: '세포 주기 정지 신호', d: 'G0기로 직행', good: 0, f: (st, s, ev) => { goJail(st, s, ev); }},
    {t: '핵으로 귀환', d: '출발점으로 이동 +200 ATP', good: 1, f: (st, s, ev) => { const p = st.players[s]; ev.push({t: 'warp', seat: s, from: p.pos, to: 0}); p.pos = 0; give(st, s, SALARY, ev); }},
    {t: '세포외 배출 티켓', d: '세포외 배출 포탈로 이동', good: 1, f: (st, s, ev) => { const p = st.players[s]; ev.push({t: 'warp', seat: s, from: p.pos, to: 18}); if (p.pos > 18) give(st, s, SALARY, ev); p.pos = 18; st.pending = {k: 'exo'}; }}
  ];
  function give(st, s, n, ev) { st.players[s].atp += n; ev.push({t: 'money', seat: s, d: n}); }
  const ownedBy = (st, s) => st.own.map((o, i) => o && o.seat === s ? i : -1).filter(i => i >= 0);
  const assets = (st, s) => st.players[s].atp + ownedBy(st, s).reduce((a, q) => a + st.own[q].inv, 0);
  // 지불 (모자라면 건물을 팔고, 그래도 모자라면 파산)
  function pay(st, s, to, n, ev) {
    const p = st.players[s];
    if (p.atp < n) {
      const list = ownedBy(st, s).sort((a, b) => st.own[a].inv - st.own[b].inv);
      for (const q of list) { if (p.atp >= n) break; const v = Math.round(st.own[q].inv * 0.5); p.atp += v; ev.push({t: 'sell', sq: q, seat: s, v}); st.own[q] = null; }
    }
    const paid = Math.min(n, p.atp); p.atp -= paid;
    if (to >= 0) st.players[to].atp += paid;
    ev.push({t: 'pay', seat: s, to, n: paid});
    if (paid < n) { p.out = true; p.atp = 0; ownedBy(st, s).forEach(q => st.own[q] = null); ev.push({t: 'bankrupt', seat: s}); checkEnd(st, ev); }
  }
  function goJail(st, s, ev) { const p = st.players[s]; ev.push({t: 'warp', seat: s, from: p.pos, to: 6}); p.pos = 6; p.jail = 3; st.dbl = 0; st.again = false; }
  function checkEnd(st, ev) {
    const alive = st.players.map((p, i) => p.out ? -1 : i).filter(i => i >= 0);
    if (alive.length === 1) { st.winner = alive[0]; st.winText = '다른 세포가 모두 ATP 고갈(파산)로 멈췄어요!'; }
    for (let g = 0; g < 4; g++) {
      const sqs = GROUP_SQ[g]; const o0 = st.own[sqs[0]];
      if (o0 && sqs.every(q => st.own[q] && st.own[q].seat === o0.seat)) { st.winner = o0.seat; st.winText = GROUPS[g].name + '을(를) 모두 차지해 구역 독점 승리!'; }
    }
  }
  function nextTurn(st, ev) {
    st.pending = null; st.dbl = 0; st.again = false;
    const n = st.players.length;
    for (let k = 1; k <= n; k++) {
      const c = (st.cur + k) % n;
      if (!st.players[c].out) { if (c <= st.cur) st.round++; st.cur = c; break; }
    }
    if (st.round > MAX_ROUND && st.winner < 0) {
      let best = -1, bv = -1; st.players.forEach((p, i) => { if (!p.out && assets(st, i) > bv) { bv = assets(st, i); best = i; } });
      st.winner = best; st.winText = MAX_ROUND + '바퀴가 끝나 총자산(ATP + 투자액)이 가장 많은 세포가 승리!';
    }
    st.phase = 'roll';
    ev.push({t: 'turn', seat: st.cur});
  }
  function finishAction(st, ev) { // 결정이 끝난 뒤: 더블이면 한 번 더, 아니면 다음 사람
    if (st.winner >= 0) return;
    if (st.pending) return;
    if (st.again && !st.players[st.cur].out && st.players[st.cur].jail === 0) { st.phase = 'roll'; st.again = false; ev.push({t: 'again', seat: st.cur}); }
    else nextTurn(st, ev);
  }
  function landOn(st, s, ev) {
    const p = st.players[s], sq = p.pos, S = SQ[sq];
    if (S.k === 'start') return;
    if (S.k === 'jail') { ev.push({t: 'note', text: 'G0기 견학 중 (그냥 지나가요)'}); return; }
    if (S.k === 'allo') { if (ownedBy(st, s).length) st.pending = {k: 'allo'}; else ev.push({t: 'note', text: '활성화할 내 소기관이 없어요'}); return; }
    if (S.k === 'exo') { st.pending = {k: 'exo'}; return; }
    if (S.k === 'card') { const c = BB.ri(CARDS.length); ev.push({t: 'card', seat: s, c}); CARDS[c].f(st, s, ev); if (!st.players[s].out && st.pending && st.pending.k === 'exo') return; checkEnd(st, ev); return; }
    // 소기관
    const o = st.own[sq];
    if (!o) { if (p.atp >= S.price) st.pending = {k: 'buy', sq}; else ev.push({t: 'note', text: 'ATP가 모자라 활성화할 수 없어요'}); return; }
    if (o.seat === s) { if (o.lv < 3 && p.atp >= upCost(sq, o.lv)) st.pending = {k: 'up', sq}; return; }
    const toll = tollOf(st, sq);
    if (p.shield) { p.shield = 0; ev.push({t: 'note', text: '내성 획득! 통행료 면제'}); }
    else pay(st, s, o.seat, toll, ev);
    if (p.out || st.winner >= 0) return;
    if (o.lv < 3 && p.atp >= o.inv * 1.5) st.pending = {k: 'take', sq, price: Math.round(o.inv * 1.5)};
  }
  function moveBy(st, s, n, ev) {
    const p = st.players[s], from = p.pos; let pass = false;
    p.pos = (p.pos + n) % 24; if (from + n >= 24) pass = true;
    ev.push({t: 'move', seat: s, from, n});
    if (pass) { give(st, s, SALARY, ev); ev.push({t: 'note', text: '핵 통과! 전사·번역 지원금 +200 ATP'}); }
    landOn(st, s, ev);
  }

  const G = BB.GAMES.cell = {
    id: 'cell', name: '모두의 세포', short: '모두의 세포', sub: '주사위를 굴려 세포 소기관을 돌며 ATP로 활성화하고 효소 공장을 짓는 세포 경영 게임', color: 0x7cf5d4, min: 2, max: 4, hidden: false, aiDelay: 750,
    rules: `<ul><li>모두 <b>${START_ATP} ATP</b>로 시작. 주사위 2개를 굴려 나온 합만큼 움직여요. <b>더블</b>이면 한 번 더 (세 번 연속 더블은 G0기로).</li>
      <li>주인 없는 소기관에 멈추면 ATP를 내고 <b>활성화(기초 효소)</b>. 내 소기관에 다시 오면 <b>막단백질 채널 → 메가 오가넬 타워</b>로 증축해요.</li>
      <li>남의 소기관에 멈추면 <b>통행료(효소 활성도)</b>를 내고, 타워가 아니면 투자액의 1.5배로 <b>인수</b>할 수 있어요. 타워는 인수 불가!</li>
      <li><b>핵</b> 통과 +200 · <b>G0기</b> 3턴 정지(더블 또는 150 ATP로 탈출) · <b>세포외 배출</b> 원하는 칸으로 이동 · <b>알로스테릭 센터</b> 내 소기관 통행료 2배(최대 4배) · <b>돌연변이·항상성 카드</b>.</li>
      <li>승리: 다른 세포가 모두 파산하거나, <b>한 구역의 소기관을 모두 차지(구역 독점)</b>하거나, ${MAX_ROUND}바퀴 뒤 총자산 1등.</li></ul>`,
    init(seats) {
      return {players: seats.map(s => ({name: s.name, char: s.char, atp: START_ATP, pos: 0, jail: 0, out: false, shield: 0})), own: Array(24).fill(null),
        cur: 0, phase: 'roll', pending: null, dice: [1, 1], dbl: 0, again: false, round: 1, winner: -1, winText: ''};
    },
    current(st) { return st.winner >= 0 ? -1 : st.cur; },
    playerInfo(st) { return st.players.map((p, i) => ({sub: p.out ? '파산' : `${p.atp.toLocaleString()} ATP${p.jail ? ' · G0기' : ''}`, out: p.out})); },
    act(st, a, s) {
      if (st.winner >= 0 || s !== st.cur) return null;
      const p = st.players[s], ev = [];
      if (a.t === 'roll') {
        if (st.phase !== 'roll' || st.pending) return null;
        const d = [1 + BB.ri(6), 1 + BB.ri(6)], dbl = d[0] === d[1]; st.dice = d;
        ev.push({t: 'dice', seat: s, d});
        if (p.jail > 0) {
          if (dbl) { p.jail = 0; ev.push({t: 'note', text: '더블! 세포 주기 재진입'}); moveBy(st, s, d[0] + d[1], ev); st.again = false; }
          else { p.jail--; ev.push({t: 'note', text: p.jail ? `G0기 유지 (남은 ${p.jail}턴)` : 'G0기 끝! 다음 차례부터 움직여요'}); }
          if (!st.pending) finishAction(st, ev); else st.phase = 'decide';
          checkEnd(st, ev); return ev;
        }
        if (dbl) { st.dbl++; if (st.dbl >= 3) { ev.push({t: 'note', text: '더블 3번! 세포 주기 정지'}); goJail(st, s, ev); finishAction(st, ev); return ev; } st.again = true; } else st.again = false;
        moveBy(st, s, d[0] + d[1], ev);
        checkEnd(st, ev);
        if (st.pending) st.phase = 'decide'; else finishAction(st, ev);
        return ev;
      }
      if (a.t === 'payout') { // G0기 ATP로 탈출
        if (st.phase !== 'roll' || p.jail <= 0 || p.atp < JAIL_FEE) return null;
        pay(st, s, -1, JAIL_FEE, ev); p.jail = 0; ev.push({t: 'note', text: 'ATP 150으로 세포 주기 재진입!'}); return ev;
      }
      const pd = st.pending; if (!pd || st.phase !== 'decide') return null;
      if (a.t === 'yes' || a.t === 'no') {
        if (pd.k === 'buy' && a.t === 'yes') { if (p.atp < SQ[pd.sq].price) return null; p.atp -= SQ[pd.sq].price; st.own[pd.sq] = {seat: s, lv: 1, inv: SQ[pd.sq].price, mult: 1}; ev.push({t: 'build', sq: pd.sq, lv: 1, seat: s}); ev.push({t: 'money', seat: s, d: -SQ[pd.sq].price}); }
        else if (pd.k === 'up' && a.t === 'yes') { const o = st.own[pd.sq], c = upCost(pd.sq, o.lv); if (p.atp < c) return null; p.atp -= c; o.lv++; o.inv += c; ev.push({t: 'build', sq: pd.sq, lv: o.lv, seat: s}); ev.push({t: 'money', seat: s, d: -c}); }
        else if (pd.k === 'take' && a.t === 'yes') { const o = st.own[pd.sq]; if (!o || p.atp < pd.price) return null; pay(st, s, o.seat, pd.price, ev); ev.push({t: 'steal', sq: pd.sq, from: o.seat, seat: s}); o.seat = s; o.inv = pd.price; st.pending = null;
          if (o.lv < 3 && p.atp >= upCost(pd.sq, o.lv)) { st.pending = {k: 'up', sq: pd.sq}; checkEnd(st, ev); if (st.winner >= 0) return ev; return ev; } }
        else if ((pd.k === 'exo' || pd.k === 'allo') && a.t === 'no') { /* 건너뛰기 */ }
        else if (a.t === 'yes') return null;
        st.pending = null; checkEnd(st, ev); finishAction(st, ev); return ev;
      }
      if (a.t === 'pick') {
        const q = a.sq | 0; if (q < 0 || q > 23) return null;
        if (pd.k === 'exo') { if (q === 18) return null; st.pending = null; const n = (q - p.pos + 24) % 24; moveBy(st, s, n, ev); checkEnd(st, ev); if (st.pending) return ev; finishAction(st, ev); return ev; }
        if (pd.k === 'allo') { const o = st.own[q]; if (!o || o.seat !== s) return null; o.mult = Math.min(4, o.mult * 2); ev.push({t: 'allo', sq: q, mult: o.mult, seat: s}); st.pending = null; finishAction(st, ev); return ev; }
        return null;
      }
      return null;
    },
    result(st) {
      if (st.winner < 0) return null;
      const rank = st.players.map((p, i) => ({seat: i, v: p.out ? -1 : assets(st, i)})).sort((a, b) => (a.seat === st.winner ? -1 : b.seat === st.winner ? 1 : b.v - a.v)).map(x => ({seat: x.seat, note: x.v < 0 ? '파산' : '총자산 ' + x.v.toLocaleString() + ' ATP'}));
      return {winner: st.winner, text: st.winText, rank};
    },
    ai(st, s, lv) {
      const p = st.players[s], pd = st.pending;
      if (st.phase === 'roll') { if (p.jail > 0 && p.atp >= JAIL_FEE && ((lv === 2 && p.atp > 700) || (lv === 1 && p.atp > 1100))) return {t: 'payout'}; return {t: 'roll'}; }
      if (!pd) return {t: 'no'};
      const r = Math.random();
      if (pd.k === 'buy') { const price = SQ[pd.sq].price, g = SQ[pd.sq].g, mine = GROUP_SQ[g].filter(q => st.own[q] && st.own[q].seat === s).length;
        const keep = lv === 0 ? 100 : lv === 1 ? 160 : 90 - mine * 40; const ok = p.atp - price > keep && (lv > 0 || r < 0.75); return {t: ok ? 'yes' : 'no'}; }
      if (pd.k === 'up') { const c = upCost(pd.sq, st.own[pd.sq].lv); const keep = lv === 0 ? 350 : lv === 1 ? 300 : 220; return {t: p.atp - c > keep && (lv > 0 || r < 0.5) ? 'yes' : 'no'}; }
      if (pd.k === 'take') { if (lv === 0) return {t: 'no'}; const g = SQ[pd.sq].g, mine = GROUP_SQ[g].filter(q => st.own[q] && st.own[q].seat === s).length, theirs = GROUP_SQ[g].filter(q => st.own[q] && st.own[q].seat === st.own[pd.sq].seat).length;
        const keep = lv === 1 ? 550 : (mine >= GROUP_SQ[g].length - 2 || theirs >= GROUP_SQ[g].length - 1 ? 150 : 320); return {t: p.atp - pd.price > keep ? 'yes' : 'no'}; }
      if (pd.k === 'allo') { const list = ownedBy(st, s).sort((a, b) => tollOf(st, b) - tollOf(st, a)); return list.length ? {t: 'pick', sq: lv === 0 ? list[BB.ri(list.length)] : list[0]} : {t: 'no'}; }
      if (pd.k === 'exo') {
        const cands = SQ.map((x, i) => i).filter(i => i !== 18);
        if (lv === 0) return {t: 'pick', sq: cands[BB.ri(cands.length)]};
        let best = 0, bv = -1e9;
        for (const q of cands) { let v = 0; const S = SQ[q], o = st.own[q];
          if (S.k === 'prop') { if (!o) v = p.atp >= S.price ? S.price + (lv === 2 ? GROUP_SQ[S.g].filter(x => st.own[x] && st.own[x].seat === s).length * 80 : 0) : -50; else if (o.seat === s) v = o.lv < 3 ? 60 + S.price * 0.5 : 10; else v = -tollOf(st, q); }
          else if (S.k === 'start') v = 120; else if (S.k === 'card') v = 40; else if (S.k === 'jail') v = -200; else if (S.k === 'allo') v = ownedBy(st, s).length ? 90 : 0;
          if (q < p.pos) v += 60; // 핵을 지나면 +200
          if (v > bv) { bv = v; best = q; } }
        return {t: 'pick', sq: best};
      }
      return {t: 'no'};
    },
    fallback(st, s) { if (st.phase === 'roll') return {t: 'roll'}; const pd = st.pending; if (pd && pd.k === 'exo') return {t: 'pick', sq: 0}; if (pd && pd.k === 'allo') { const l = ownedBy(st, s); return l.length ? {t: 'pick', sq: l[0]} : {t: 'no'}; } return {t: 'no'}; },
    createView
  };

  // ---------- 3D ----------
  const T = 2.3, H = T * 3; // 칸 크기, 판 반폭
  function sqPos(i) {
    if (i <= 6) return [H - i * T, H];
    if (i <= 12) return [-H, H - (i - 6) * T];
    if (i <= 18) return [-H + (i - 12) * T, -H];
    return [H, -H + (i - 18) * T];
  }
  function inward(i) { const [x, z] = sqPos(i); return [-Math.sign(x) * (Math.abs(x) >= H - 0.01 ? 1 : 0), -Math.sign(z) * (Math.abs(z) >= H - 0.01 ? 1 : 0)]; }
  function createView(ctx) {
    const root = BB.root; BB.scene.background.set(0x9fe0cf);
    BB.setView({tx: 0, ty: 0, tz: 0.4, az: Math.PI / 4, el: 0.72, zoom: 10.5}); BB.view.minZ = 5; BB.view.maxZ = 20;
    root.add(BB.ground(22, 0x3f9f84, 0x5cc4a4));
    const board = BB.vox([[0, 0, 0, 2 * H + T + 0.6, 0.3, 2 * H + T + 0.6, '#2f6f7f'], [0, 0.3, 0, 2 * H - T + 0.2, 0.08, 2 * H - T + 0.2, '#c8ecff']]); root.add(board);
    // 가운데: 세포 디오라마
    const mem = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.35, 8, 48), new THREE.MeshLambertMaterial({color: 0xffc6d9})); mem.rotation.x = Math.PI / 2; mem.position.y = 0.55; mem.castShadow = true; root.add(mem);
    const nuc = BB.vox([[0, 0, 0, 2.6, 1.4, 2.6, '#b18cff'], [0, 1.4, 0, 1.8, 0.4, 1.8, '#c9adff'], [0.4, 0.6, 0.4, 0.8, 1.1, 0.8, '#7a52d8']]); nuc.position.set(0, 0.38, 0); root.add(nuc);
    nuc.userData.pick = true; nuc.userData.info = ['세포 (진핵세포)', '핵과 막으로 둘러싸인 여러 소기관을 가진 세포. 소기관마다 맡은 일이 달라 서로 협력해요.', '세포']; BB.pickables.push(nuc);
    const mito = BB.vox([[0, 0, 0, 1.6, 0.6, 0.8, '#ff8a5c'], [-0.4, 0.6, 0, 0.12, 0.1, 0.6, '#ffd0b8'], [0, 0.6, 0, 0.12, 0.1, 0.6, '#ffd0b8'], [0.4, 0.6, 0, 0.12, 0.1, 0.6, '#ffd0b8']]); mito.position.set(-2.4, 0.38, 1.6); root.add(mito);
    const golgi = BB.vox([[0, 0, 0, 1.6, 0.18, 0.7, '#6ab6ff'], [0, 0.22, 0, 1.4, 0.18, 0.6, '#86c8ff'], [0, 0.44, 0, 1.2, 0.18, 0.5, '#a6d8ff']]); golgi.position.set(2.2, 0.38, -1.8); root.add(golgi);
    const dl = BB.label('모두의 세포', {size: 0.8}); dl.position.set(0, 3.2, 0); root.add(dl);
    // 칸
    const sqMesh = [], bld = [], flags = [];
    SQ.forEach((S, i) => {
      const [x, z] = sqPos(i), corner = i % 6 === 0;
      const col = S.k === 'prop' ? GROUPS[S.g].color : S.k === 'card' ? '#fff2a8' : corner ? '#ffffff' : '#eee';
      const w = T - 0.12;
      const tex = BB.textTex('cellsq' + i, (g, W, Hh) => {
        g.fillStyle = col; g.fillRect(0, 0, W, Hh);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, 0, W, 34);
        g.fillStyle = '#183048'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const nm = S.name, words = nm.length > 7 ? [nm.slice(0, Math.ceil(nm.length / 2)), nm.slice(Math.ceil(nm.length / 2))] : [nm];
        g.font = BB.font(words.length > 1 ? 30 : 34); words.forEach((wd, k) => g.fillText(wd, W / 2, Hh / 2 - (words.length - 1) * 18 + k * 36 + 6));
        if (S.k === 'prop') { g.font = BB.font(24, 800); g.fillText(S.price + ' ATP', W / 2, Hh - 22); }
        else { g.font = BB.font(40); g.fillText({start: '🧬', jail: '⏸', allo: '⚡', exo: '🌀', card: '❓'}[S.k], W / 2, 18 + (S.k === 'card' ? 0 : 0)); }
      }, 256, 256);
      const top = new THREE.MeshLambertMaterial({map: tex}), side = new THREE.MeshLambertMaterial({color: new THREE.Color(col).multiplyScalar(0.8)});
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), [side, side, top, side, side, side]);
      m.position.set(x, 0.45, z); m.castShadow = true; m.receiveShadow = true;
      // 글자가 바깥에서 읽히도록 회전
      if (i > 0 && i < 6) m.rotation.y = 0; else if (i > 6 && i < 12) m.rotation.y = -Math.PI / 2; else if (i > 12 && i < 18) m.rotation.y = Math.PI; else if (i > 18) m.rotation.y = Math.PI / 2;
      root.add(m); sqMesh[i] = m;
      m.userData.pick = true; m.userData.sq = i;
      m.userData.info = [S.name, S.info + (S.k === 'prop' ? ` (가격 ${S.price} · ${GROUPS[S.g].name})` : ''), S.k === 'prop' ? '세포 소기관' : '특수 칸'];
      BB.pickables.push(m);
      if (corner) { // 모서리 장식
        let deco;
        if (S.k === 'start') deco = BB.vox([[0, 0, 0, 1.0, 0.7, 1.0, '#b18cff'], [0, 0.7, 0, 0.6, 0.3, 0.6, '#d8c4ff']]);
        else if (S.k === 'jail') deco = BB.vox([[0, 0, 0, 1.2, 0.12, 1.2, '#9aa4b8'], [-0.5, 0.1, -0.5, 0.12, 1.0, 0.12, '#7a8498'], [0.5, 0.1, -0.5, 0.12, 1.0, 0.12, '#7a8498'], [-0.5, 0.1, 0.5, 0.12, 1.0, 0.12, '#7a8498'], [0.5, 0.1, 0.5, 0.12, 1.0, 0.12, '#7a8498'], [0, 1.1, 0, 1.2, 0.12, 1.2, '#9aa4b8']]);
        else if (S.k === 'allo') deco = BB.vox([[0, 0, 0, 1.0, 0.5, 1.0, '#ffd166'], [0.3, 0.5, 0.3, 0.4, 0.4, 0.4, '#ff7a5c'], [-0.3, 0.5, -0.2, 0.3, 0.3, 0.3, '#5ef2c8']]);
        else deco = (() => { const r = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.15, 8, 24), new THREE.MeshLambertMaterial({color: 0x5ef2c8, emissive: 0x115544})); t.position.y = 0.8; r.add(t); r.userData.spin = t; return r; })();
        deco.position.set(x, 0.6, z); root.add(deco);
        if (deco.userData.spin) BB.ticks.push(dt => { deco.userData.spin.rotation.y += dt * 2; });
      }
    });
    // 주사위 2개
    const pip = (n) => BB.textTex('pip' + n, (g, W, Hh) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, Hh); g.fillStyle = n === 1 ? '#ff3b5c' : '#1d2a44';
      const P = {1: [[.5, .5]], 2: [[.25, .25], [.75, .75]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.25, .25], [.75, .25], [.25, .75], [.75, .75]], 5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]], 6: [[.25, .22], [.75, .22], [.25, .5], [.75, .5], [.25, .78], [.75, .78]]}[n];
      for (const [px, py] of P) { g.fillRect(px * W - 12, py * Hh - 12, 24, 24); } }, 96, 96);
    // BoxGeometry 면 순서: +x,-x,+y,-y,+z,-z → 숫자 1..6 배치 (마주 보는 면 합 7)
    const FACE = [3, 4, 1, 6, 2, 5];
    const dice = [0, 1].map(i => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), FACE.map(n => new THREE.MeshLambertMaterial({map: pip(n)}))); m.castShadow = true; m.position.set(-0.7 + i * 1.4, 0.8, 2.2); root.add(m);
      m.userData.pick = true; m.userData.info = ['주사위', '두 주사위의 합만큼 이동해요. 같은 숫자(더블)면 한 번 더!', '주사위']; BB.pickables.push(m); return m; });
    const faceRot = {1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0]};
    // 말
    let state = null; const toks = [];
    function tokPos(st, s, pos) { const [x, z] = sqPos(pos); const n = st.players.length, k = s; const off = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]][k]; return [x + off[0], 0.6, z + off[1]]; }
    function buildingMesh(lv, color) {
      if (lv === 1) return BB.vox([[0, 0, 0, 0.5, 0.3, 0.5, color], [0, 0.3, 0, 0.22, 0.35, 0.22, '#e8f6ff'], [0, 0.65, 0, 0.3, 0.08, 0.3, '#ffffff']]); // 효소 플라스크
      if (lv === 2) return BB.vox([[0, 0, 0, 0.7, 0.18, 0.7, color], [-0.2, 0.18, 0, 0.18, 0.9, 0.18, '#ffffff'], [0.2, 0.18, 0, 0.18, 0.9, 0.18, '#ffffff'], [0, 1.08, 0, 0.7, 0.16, 0.36, color], [0, 0.4, 0, 0.12, 0.4, 0.12, '#5ef2c8']]); // 막단백질 채널
      return BB.vox([[0, 0, 0, 0.9, 0.3, 0.9, color], [0, 0.3, 0, 0.7, 0.9, 0.7, '#ffffff'], [0, 1.2, 0, 0.9, 0.2, 0.9, color], [0, 1.4, 0, 0.5, 0.6, 0.5, '#ffe066'], [0, 2.0, 0, 0.2, 0.4, 0.2, '#ff7eb6'], [0.38, 0.5, 0, 0.1, 0.6, 0.6, '#5ef2c8'], [-0.38, 0.5, 0, 0.1, 0.6, 0.6, '#5ef2c8']]); // 메가 오가넬 타워
    }
    function refreshBuildings(st) {
      SQ.forEach((S, i) => {
        if (S.k !== 'prop') return;
        const o = st.own[i], key = o ? o.seat + ':' + o.lv + ':' + o.mult : '';
        if (bld[i] && bld[i].userData.key === key) return;
        if (bld[i]) { root.remove(bld[i]); bld[i] = null; } if (flags[i]) { root.remove(flags[i]); flags[i] = null; }
        if (!o) return;
        const col = BB.CHARS[st.players[o.seat].char].color;
        const [x, z] = sqPos(i), [ix, iz] = inward(i);
        const b = buildingMesh(o.lv, col); b.position.set(x + ix * 0.55, 0.6, z + iz * 0.55); b.userData.key = key; root.add(b); bld[i] = b;
        const fl = BB.box(T - 0.2, 0.06, 0.18, new THREE.Color(col).getHex()); fl.position.set(x - iz * 0 + (ix ? ix * -0.95 : 0), 0.62, z + (iz ? iz * -0.95 : 0)); if (ix) fl.rotation.y = Math.PI / 2; root.add(fl); flags[i] = fl;
        if (o.mult > 1) { const l = BB.label('x' + o.mult, {size: 0.45, color: '#ffe066'}); l.position.set(0, 2.6, 0); b.add(l); }
        sqMesh[i].userData.info = [S.name, `${st.players[o.seat].name}의 ${LV_NAME[o.lv]} · 통행료 ${tollOf(st, i)} ATP${o.mult > 1 ? ' (알로스테릭 x' + o.mult + ')' : ''}. ${S.info}`, GROUPS[S.g].name];
      });
    }
    async function rollDice(d) {
      BB.audio.dice();
      await Promise.all(dice.map((m, i) => { const x0 = -0.7 + i * 1.4, r = faceRot[d[i]]; const sx = BB.rand(4, 6) * Math.PI, sz = BB.rand(4, 6) * Math.PI;
        return BB.tween(0.95, k => { m.position.set(x0 + Math.sin(k * 5) * 0.2, 0.8 + Math.abs(Math.sin(k * Math.PI * 2.2)) * 2.6 * (1 - k), 2.2 - Math.sin(k * Math.PI) * 0.6); m.rotation.set(r[0] + sx * (1 - k) * 2, (1 - k) * 6, r[2] + sz * (1 - k) * 2); }, 'out'); }));
      BB.audio.land();
    }
    async function moveTok(st, s, from, n) {
      const m = toks[s];
      for (let k = 1; k <= n; k++) { const pos = (from + k) % 24; const [x, y, z] = tokPos(st, s, pos); await BB.hop(m, x, y, z, {h: 0.8, dur: 0.2}); if (pos === 0) { BB.audio.coin(); } }
    }
    function hud(st) {
      if (st.winner >= 0) { BB.msg(''); BB.acts([]); return; }
      const s = st.cur, p = st.players[s], me = ctx.canAct(s), pd = st.pending;
      const nm = `<b>${BB.esc(p.name)}</b>`;
      if (st.phase === 'roll') {
        BB.msg(`${nm} 차례 · ${st.round}/${MAX_ROUND}바퀴 · ${p.jail ? `G0기 (남은 ${p.jail}턴) · 더블이 나오면 탈출` : me ? '주사위를 굴리세요' : '굴리는 중…'}`);
        BB.acts(me ? [{t: '🎲 주사위 굴리기', cls: 'pri', fn: () => ctx.dispatch({t: 'roll'}, s)}, p.jail && p.atp >= JAIL_FEE ? {t: `ATP ${JAIL_FEE} 내고 탈출`, cls: 'warn', fn: () => ctx.dispatch({t: 'payout'}, s)} : null] : []);
        return;
      }
      if (!pd) { BB.acts([]); return; }
      if (pd.k === 'buy') { const S = SQ[pd.sq]; BB.msg(`${nm} · <b>${S.name}</b>을(를) ${S.price} ATP로 활성화(기초 효소)할까요?`); BB.acts(me ? [{t: '활성화하기', cls: 'pri', fn: () => ctx.dispatch({t: 'yes'}, s)}, {t: '건너뛰기', fn: () => ctx.dispatch({t: 'no'}, s)}] : []); }
      else if (pd.k === 'up') { const o = st.own[pd.sq], c = upCost(pd.sq, o.lv); BB.msg(`${nm} · <b>${SQ[pd.sq].name}</b>을(를) ${LV_NAME[o.lv + 1]}(으)로 증축할까요? (${c} ATP)`); BB.acts(me ? [{t: '증축하기', cls: 'pri', fn: () => ctx.dispatch({t: 'yes'}, s)}, {t: '그대로 두기', fn: () => ctx.dispatch({t: 'no'}, s)}] : []); }
      else if (pd.k === 'take') { BB.msg(`${nm} · <b>${SQ[pd.sq].name}</b>을(를) ${pd.price} ATP로 인수할까요?`); BB.acts(me ? [{t: '인수하기', cls: 'warn', fn: () => ctx.dispatch({t: 'yes'}, s)}, {t: '안 하기', fn: () => ctx.dispatch({t: 'no'}, s)}] : []); }
      else if (pd.k === 'exo') { BB.msg(`${nm} · 세포외 배출! ${me ? '판에서 이동할 칸을 누르세요' : '이동할 칸을 고르는 중…'}`); BB.acts(me ? [{t: '이동 안 함', fn: () => ctx.dispatch({t: 'no'}, s)}] : []); }
      else if (pd.k === 'allo') { BB.msg(`${nm} · 알로스테릭 활성화! ${me ? '통행료를 2배로 할 내 소기관을 누르세요' : '소기관을 고르는 중…'}`); BB.acts(me ? [{t: '건너뛰기', fn: () => ctx.dispatch({t: 'no'}, s)}] : []); }
    }
    BB.onPick = o => {
      if (!state || !o || o.userData.sq == null) return; const s = state.cur, pd = state.pending;
      if (!ctx.canAct(s) || !pd || ctx.busy()) return;
      if (pd.k === 'exo' || pd.k === 'allo') ctx.dispatch({t: 'pick', sq: o.userData.sq}, s);
    };
    const glow = [];
    function highlight(st) {
      for (const g of glow) root.remove(g); glow.length = 0;
      const pd = st.pending; if (!pd || !ctx.canAct(st.cur)) return;
      const list = pd.k === 'exo' ? SQ.map((x, i) => i).filter(i => i !== 18) : pd.k === 'allo' ? st.own.map((o, i) => o && o.seat === st.cur ? i : -1).filter(i => i >= 0) : [];
      for (const i of list) { const [x, z] = sqPos(i); const r = new THREE.Mesh(new THREE.BoxGeometry(T - 0.05, 0.05, T - 0.05), new THREE.MeshBasicMaterial({color: 0x5ef2c8, transparent: true, opacity: 0.45})); r.position.set(x, 0.63, z); root.add(r); glow.push(r); }
    }
    BB.ticks.push((dt, t) => { for (const g of glow) g.material.opacity = 0.3 + Math.sin(t * 6) * 0.2; });
    return {
      async sync(st, evs) {
        const first = !state; state = st;
        if (first) st.players.forEach((p, s) => { const m = BB.makeChar(p.char, 0.55); const [x, y, z] = tokPos(st, s, p.pos); m.position.set(x, y, z); root.add(m); toks[s] = m; m.userData.pick = true; m.userData.info = BB.CHARS[p.char].info; BB.pickables.push(m); });
        for (const e of evs) {
          if (e.t === 'dice') { await rollDice(e.d); BB.toast(e.d[0] + ' + ' + e.d[1] + ' = ' + (e.d[0] + e.d[1]), e.d[0] === e.d[1] ? '더블! 한 번 더' : '', 1000); }
          else if (e.t === 'move') { if (e.n > 12 || e.n === 0) { const [x, y, z] = tokPos(st, e.seat, (e.from + e.n) % 24); BB.audio.bonus(); await BB.hop(toks[e.seat], x, y, z, {h: 4, dur: 0.7}); } else await moveTok(st, e.seat, e.from, e.n); }
          else if (e.t === 'warp' || e.t === 'exo') { const to = e.to; const [x, y, z] = tokPos(st, e.seat, to); BB.audio.bonus(); await BB.hop(toks[e.seat], x, y, z, {h: 4, dur: 0.7}); }
          else if (e.t === 'card') { const c = CARDS[e.c]; (c.good ? BB.audio.bonus : BB.audio.wrong).call(BB.audio); BB.toast((c.good ? '🧬 ' : '🦠 ') + c.t, c.d, 1800); await BB.wait(1100); }
          else if (e.t === 'build') { BB.audio.build(); const [x, z] = sqPos(e.sq); BB.burst(x, 1, z, ['#ffffff', BB.CHARS[st.players[e.seat].char].color, '#5ef2c8'], 24, 0.6); refreshBuildings(st); if (e.lv === 3) BB.toast('메가 오가넬 타워 완성!', SQ[e.sq].name + ' · 이제 인수할 수 없어요', 1500); }
          else if (e.t === 'steal') { BB.audio.capture(); const [x, z] = sqPos(e.sq); BB.burst(x, 1, z, ['#ff7eb6', '#ffd166'], 30, 0.8); BB.toast('인수!', SQ[e.sq].name, 1100); refreshBuildings(st); }
          else if (e.t === 'pay') { if (e.n > 0) { BB.audio.pay(); if (e.to >= 0) BB.toast('통행료 ' + e.n + ' ATP', st.players[e.seat].name + ' → ' + st.players[e.to].name, 1100); } await BB.wait(250); }
          else if (e.t === 'money' && e.d > 0) BB.audio.coin();
          else if (e.t === 'allo') { BB.audio.bonus(); BB.toast('알로스테릭 활성화 x' + e.mult, SQ[e.sq].name + ' 통행료 증폭', 1300); refreshBuildings(st); }
          else if (e.t === 'sell') { refreshBuildings(st); BB.toast('건물 매각', SQ[e.sq].name + ' (+' + e.v + ')', 1000); }
          else if (e.t === 'bankrupt') { BB.audio.wrong(); BB.toast('파산!', st.players[e.seat].name + '의 ATP가 바닥났어요', 1600); const m = toks[e.seat]; BB.tween(0.6, k => m.scale.setScalar(0.55 * (1 - k) + 0.001)); await BB.wait(600); }
          else if (e.t === 'note') { BB.toast(e.text, '', 1100); await BB.wait(300); }
          else if (e.t === 'again') BB.audio.turn();
          else if (e.t === 'turn') BB.audio.turn();
        }
        refreshBuildings(st);
        st.players.forEach((p, s) => { const m = toks[s]; if (!m) return; m.visible = !p.out; const [x, y, z] = tokPos(st, s, p.pos); if (m.position.distanceTo(new THREE.Vector3(x, y, z)) > 0.05) m.position.set(x, y, z); });
        hud(st); highlight(st);
      },
      destroy() { BB.onPick = null; }
    };
  }
  G.lobbyModel = function () {
    const g = new THREE.Group();
    g.add(BB.vox([[0, 0, 0, 3.2, 0.2, 3.2, '#f4fff9'], [-1.2, 0.2, -1.2, 0.7, 0.12, 0.7, '#7cc4ff'], [1.2, 0.2, -1.2, 0.7, 0.12, 0.7, '#ffb65c'], [-1.2, 0.2, 1.2, 0.7, 0.12, 0.7, '#8fe388'], [1.2, 0.2, 1.2, 0.7, 0.12, 0.7, '#d59bff'],
      [0, 0.2, 0, 1.2, 0.8, 1.2, '#b18cff'], [1.2, 0.32, 1.2, 0.4, 1.2, 0.4, '#ffffff'], [1.2, 1.5, 1.2, 0.3, 0.4, 0.3, '#ffe066']]));
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({color: 0xffffff})); d.position.set(-0.6, 1.6, 0.8); d.rotation.set(0.5, 0.6, 0.2); d.castShadow = true; g.add(d);
    return g;
  };
  BB.cellRules = {SQ, GROUP_SQ, tollOf};
})();

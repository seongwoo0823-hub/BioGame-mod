// 생물의 번제 — 데이터: 구역 6 · 패시브 70 · 액티브 30 · 수술도구 20 · 진단서 10 · 호르몬 8 · 병원체 40 · 보스 21
(function () {
  'use strict';
  const CR = window.CR;

  /* ───────── 구역 ───────── */
  CR.STAGES = [
    { n: 1, name: '표피 상처층', en: 'EPIDERMIS', floor: '#d29a76', floor2: '#c68d69', wall: '#7c3f30', rock: '#b06e52', acc: '#f4c9a3', deco: '#e8b089', music: { root: 57, scale: 'dorian', bpm: 112, prog: [0, 3, 4, 0], seed: 11 } },
    { n: 2, name: '모세혈관 미로', en: 'CAPILLARY', floor: '#8c2d39', floor2: '#7f2733', wall: '#46101d', rock: '#d0464f', acc: '#ff8d9c', deco: '#a83a48', music: { root: 55, scale: 'minor', bpm: 120, prog: [0, 5, 3, 4], seed: 23 } },
    { n: 3, name: '위장관 산성 동굴', en: 'GASTRIC', floor: '#8a963a', floor2: '#7e8a33', wall: '#41481c', rock: '#a9a24a', acc: '#dce86a', deco: '#9fae44', music: { root: 52, scale: 'phryg', bpm: 116, prog: [0, 1, 0, 4], seed: 37 } },
    { n: 4, name: '폐포 · 림프절', en: 'ALVEOLI', floor: '#7a90a6', floor2: '#71879d', wall: '#36465a', rock: '#a9b9c9', acc: '#dbe9f7', deco: '#8ea4ba', music: { root: 59, scale: 'dorian', bpm: 124, prog: [0, 2, 3, 4], seed: 41 } },
    { n: 5, name: '중추신경 시냅스', en: 'SYNAPSE', floor: '#3b316f', floor2: '#342b66', wall: '#1a143c', rock: '#6a59c2', acc: '#9fd2ff', deco: '#4b3f8a', music: { root: 54, scale: 'harm', bpm: 128, prog: [0, 5, 6, 4], seed: 53 } },
    { n: 6, name: '핵막 내부 · 유전자의 심연', en: 'NUCLEUS', floor: '#3a2b15', floor2: '#32250f', wall: '#170f06', rock: '#b38a2a', acc: '#ffd76a', deco: '#4d3a1c', music: { root: 50, scale: 'harm', bpm: 136, prog: [0, 6, 5, 4], seed: 67 } },
  ];

  /* ───────── 패시브 70종 ─────────
     stats: dmg 공격력(+), dmgMul, rate 연사(발/초 +), rateMul, range 사거리(px), sspd 탄속, speed 이동, crit 치명타(%), size 탄 크기 배율, maxhp(하트 칸), shield(반 칸), heal(반 칸), bombs, keys, coins
     flags: 탄도·특수 효과 이름 (game.js에서 처리)                                                     */
  const P = (id, name, tier, glyph, col, desc, stats, flags, costume) => ({ id, kind: 'passive', name, tier, glyph, col, desc, stats: stats || {}, flags: flags || [], costume: costume || null });
  CR.PASSIVES = [
    // ★ 전설 10종
    P('P01', '미토콘드리아 과급기', 4, 'mito', '#ff8a3d', '세포 호흡을 한계까지 끌어올려 연사 ×1.6, 한 번에 두 발씩 연속 발사', { rateMul: 1.6 }, ['double'], 'wings'),
    P('P02', '면역 기억 항체', 4, 'halo', '#ffd75e', '한 번 처치한 병원체 종류는 기억해 2배 피해 + 탄환이 표적을 추적', {}, ['memory', 'homing'], 'halo'),
    P('P03', '프로테아좀 분쇄탄', 4, 'gear', '#e85d75', '단백질 분해 효소복합체처럼 적을 관통하며, 관통할 때마다 피해 +25%', { dmg: 1 }, ['pierce', 'ramp'], 'goggle'),
    P('P04', '시냅스 연쇄 방전', 4, 'bolt', '#7fd4ff', '명중하면 활동전위가 주변 적 3마리에게 연쇄로 퍼짐 (공격력 ×1.3)', { dmgMul: 1.3 }, ['chain'], 'antenna'),
    P('P05', '바이러스 역공학', 4, 'virus', '#b07cff', '처치한 병원체의 25%를 재프로그래밍해 이 방에서 아군으로 싸우게 함', { dmg: 0.5 }, ['convert'], 'horns'),
    P('P06', '줄기세포 재생로', 4, 'cell', '#7dffb2', '최대 체력 +2, 방을 비울 때마다 반 칸 재생, 모든 능력 +10%', { maxhp: 2, heal: 4, dmgMul: 1.1, rateMul: 1.1, speed: 0.1, range: 20 }, ['regen'], 'aura'),
    P('P07', '삼투압 폭렬탄', 4, 'drop', '#5ad1ff', '탄환이 멈추거나 명중하면 삼투압으로 터져 8방향 파편 발사', { dmg: 1 }, ['burstEnd'], null),
    P('P08', '리보자임 메아리', 4, 'dna', '#ff6fb1', 'RNA 효소가 명령을 복제해 모든 사격이 0.25초 뒤 같은 궤적으로 한 번 더 발사', {}, ['echo'], 'ring'),
    P('P09', '유전체 안정화 코어', 4, 'crystal', '#ffe066', '어떤 효과로도 능력치가 떨어지지 않음 + 모든 능력 +20% + 실드 2칸', { dmgMul: 1.2, rateMul: 1.2, speed: 0.15, range: 30, shield: 4 }, ['statLock'], 'crown'),
    P('P10', '세포골격 궤도포', 4, 'ring', '#9effe0', '탄환이 미세관 궤도를 따라 몸 주위를 돌다가 가장 가까운 적에게 날아감 (공격력 +2)', { dmg: 2 }, ['orbitShot'], 'ring'),
    // 공격 계열
    P('P11', 'ATP 합성효소', 1, 'gear', '#ffb347', '에너지 화폐를 더 만들어 공격력 +1', { dmg: 1 }),
    P('P12', '골지체 농축기', 2, 'orb', '#ffcf6a', '탄환을 포장·농축해 크기 ×1.6, 공격력 +1.5 (연사 ×0.8)', { size: 1.6, dmg: 1.5, rateMul: 0.8 }),
    P('P13', '퍼포린 천공기', 2, 'needle', '#ff7a7a', '세포막에 구멍을 뚫는 단백질 — 탄환이 적을 관통', {}, ['pierce']),
    P('P14', '그랜자임 독침', 2, 'syringe', '#7bdc5a', '세포 자멸 효소를 주입해 3초 동안 독 피해', {}, ['poison']),
    P('P15', '시토크롬 C 증폭', 2, 'star', '#ff5d5d', '자멸 신호를 증폭해 치명타 확률 +20%', { crit: 20 }),
    P('P16', '분해 파편', 2, 'crystal', '#c8b6ff', '처치한 적이 4방향 파편으로 흩어져 주변을 공격', {}, ['fragKill']),
    P('P17', '제한효소 절단', 2, 'scissors', '#ff9e5e', '특정 서열을 자르는 효소 — 명중한 적에게 출혈, 공격력 +0.5', { dmg: 0.5 }, ['bleed']),
    P('P18', '역전사 가속기', 2, 'dna', '#ffa4d8', '멀리 날아갈수록 피해 증가 (최대 2배)', {}, ['distDmg']),
    P('P19', '히스톤 확장', 1, 'orb', '#f1a7ff', '염색질을 풀어 공격력 +0.8, 탄환 크기 ×1.25', { dmg: 0.8, size: 1.25 }),
    P('P20', '보체 표지', 2, 'eye', '#ffd166', '맞힌 적에 보체 단백질을 붙여 받는 피해 +30%', {}, ['mark']),
    P('P21', '라이소자임 결정', 1, 'crystal', '#9fe8ff', '가까운 적(3칸 이내)에게 1.5배 피해', {}, ['nearDmg']),
    P('P22', '아드레날린 수용체', 1, 'heart', '#ff4d6d', '이 방에서 맞을 때마다 공격력 +2 (방을 나가면 초기화)', {}, ['rageHit']),
    // 연사·탄도 계열
    P('P23', '리보솜 과발현', 1, 'cell', '#86e3ff', '단백질 공장을 늘려 연사 +0.7', { rate: 0.7 }),
    P('P24', '삼량체 발사기', 3, 'capsule', '#9b8cff', '세 단위체가 모여 3갈래로 발사 (연사 ×0.75)', { rateMul: 0.75 }, ['triple']),
    P('P25', '이분법 분열탄', 2, 'cell', '#a8ff8c', '명중하거나 벽에 닿으면 탄환이 둘로 분열', {}, ['splitHit']),
    P('P26', '이중나선 탄도', 2, 'dna', '#6fd6ff', '두 가닥 탄환이 나선처럼 꼬이며 날아감', {}, ['helix']),
    P('P27', '화학주성 센서', 3, 'neuron', '#c486ff', '병원체가 내는 화학 물질을 따라가는 유도탄', {}, ['homing'], 'antenna'),
    P('P28', '인지질 반동막', 1, 'ring', '#ffd88a', '탄환이 벽에 두 번까지 튕김', {}, ['bounce']),
    P('P29', '점액 코팅', 1, 'drop', '#b6f0a0', '끈적한 점액으로 맞은 적을 느리게 함', {}, ['slow']),
    P('P30', '소포 산탄', 3, 'orb', '#ff9fb8', '소포 여러 개를 한꺼번에 — 5발 산탄 (연사 ×0.55, 공격력 ×0.8)', { rateMul: 0.55, dmgMul: 0.8 }, ['shotgun']),
    P('P31', '도약 전도 말이집', 1, 'neuron', '#ffe9a8', '랑비에 결절을 건너뛰듯 탄속 +0.5, 사거리 +60', { sspd: 0.5, range: 60 }),
    P('P32', '시냅스 소포 연사', 2, 'neuron', '#a6e3ff', '작은 소포를 쉴 새 없이 — 연사 ×2.2, 공격력 ×0.45', { rateMul: 2.2, dmgMul: 0.45, size: 0.7 }),
    P('P33', '막투과 펩타이드', 1, 'ring', '#d9c8ff', '탄환이 바위와 장애물을 통과', {}, ['spectral']),
    P('P34', '칼슘 파동', 2, 'bolt', '#fff2a8', '날아가던 탄환이 중간에 4방향으로 갈라짐', {}, ['burstMid']),
    P('P35', '편모 추진', 1, 'wing', '#9ef0d0', '이동 속도 +0.25, 움직이며 쏘면 탄환이 더 빠르고 강함', { speed: 0.25 }, ['moveShot'], 'tail'),
    P('P36', '사인파 운동', 1, 'beam', '#c0f0ff', '탄환이 물결치며 날아가고 장애물을 통과', {}, ['wave']),
    // 생존 계열
    P('P37', '미토콘드리아 증식', 1, 'mito', '#ffa36b', '최대 체력 +1, 실드 1칸', { maxhp: 1, heal: 2, shield: 2 }),
    P('P38', '콜레스테롤 박막', 2, 'shield', '#ffe08a', '세포막을 단단하게 — 최대 체력 +2 (이동 -0.1)', { maxhp: 2, heal: 4, speed: -0.1 }),
    P('P39', '펩티도글리칸 장갑', 2, 'shield', '#d3b07a', '방마다 처음 맞는 공격 1번을 막아 줌', {}, ['roomGuard']),
    P('P40', '자가포식 순환', 2, 'cell', '#ff8fa0', '적 10마리를 처치할 때마다 체력 반 칸 회복', {}, ['vampire']),
    P('P41', '액포 저장고', 1, 'flask', '#9fdcff', '최대 체력 +1, 방을 비우면 보상이 더 자주 나옴', { maxhp: 1, heal: 2 }, ['dropUp']),
    P('P42', '나트륨-칼륨 펌프', 1, 'bolt', '#ffc76b', '이온 기울기로 이동 +0.3, 연사 +0.4', { speed: 0.3, rate: 0.4 }),
    P('P43', '기낭 부력체', 3, 'lung', '#bfe6ff', '몸에 공기주머니가 생겨 날아다님 — 바위·가시·장판 위를 지나감', {}, ['flight'], 'wings'),
    P('P44', '다능성 분화', 2, 'star', '#9dffb0', '모든 능력이 조금씩 오름', { dmg: 0.5, rate: 0.3, range: 20, speed: 0.1, sspd: 0.1, crit: 5 }),
    P('P45', '당단백질 안테나', 1, 'neuron', '#ffd1f0', '층 전체 지도와 특수 방 위치가 보임', {}, ['mapReveal'], 'antenna'),
    P('P46', '열충격 단백질', 1, 'shield', '#ff9a5a', '산성·독 장판과 가시에 피해를 입지 않음', {}, ['creepImmune']),
    P('P47', '혈소판 응집', 1, 'drop', '#ff6b6b', '맞으면 주변에 둔화 장판이 생기고 8방향 반격탄 발사', {}, ['hurtBurst']),
    P('P48', '에리스로포이에틴', 2, 'heart', '#ff3d5a', '체력이 1칸 이하일 때 공격력·연사 ×1.5', {}, ['lowHp']),
    // 동료·폭탄 계열
    P('P49', '박테리오파지 동료', 2, 'virus', '#ffd36b', '함께 다니며 조준한 방향으로 탄환을 쏘는 아군 파지', {}, ['famShooter']),
    P('P50', '대식세포 수호자', 2, 'cell', '#e8d6ff', '몸 주위를 돌며 적 탄환을 막고 닿은 적을 공격', {}, ['famGuard']),
    P('P51', '수지상 정찰기', 2, 'neuron', '#ffb0e0', '적을 쫓아가 달라붙어 느리게 하고 피해를 줌', {}, ['famSeeker']),
    P('P52', '호중구 장판사', 1, 'drop', '#a0d8ff', '뒤를 따라다니며 적에게 피해를 주는 항체 장판을 깜', {}, ['famCreep']),
    P('P53', '헬퍼 T세포', 1, 'cell', '#8fffcf', '방을 3번 비울 때마다 무작위 물건을 하나 만들어 줌', {}, ['famHelper']),
    P('P54', '비만세포 폭탄', 2, 'bomb', '#ff9ad5', '폭탄 +5, 폭발할 때 8방향 독성 탄환 발사', { bombs: 5 }, ['bombBurst']),
    P('P55', '산개 폭탄', 2, 'bomb', '#c49aff', '폭탄 +3, 폭발이 작은 폭발 3개로 퍼짐', { bombs: 3 }, ['bombScatter']),
    P('P56', '피브린 그물', 1, 'bomb', '#ffe0b0', '폭탄 +2, 폭발한 자리에 적을 묶는 그물 장판', { bombs: 2 }, ['bombWeb']),
    P('P57', '플라스미드 고리', 3, 'ring', '#ff7df0', '몸 주위를 도는 고리형 DNA가 닿는 적을 계속 공격', {}, ['laserRing'], 'ring'),
    P('P58', '인터페론 경보', 1, 'bolt', '#ffe36b', '방에 들어가면 병원체가 3초 동안 느려짐', {}, ['roomSlow']),
    P('P59', '방추사 중력탄', 2, 'orb', '#b0a0ff', '탄환이 주변 적을 끌어당김', {}, ['gravity']),
    P('P60', '공생 마이크로바이옴', 2, 'leaf', '#7cf07c', '몸 주위를 도는 공생균 2마리가 닿은 적을 중독시킴', {}, ['famMicrobe']),
    // 변이·특수 계열
    P('P61', '유전자 재조합', 2, 'dna', '#ffb8e8', '방에 들어갈 때마다 무작위 탄도 효과 1개가 붙음', {}, ['randomFlag']),
    P('P62', '젖산 발효', 1, 'flask', '#e6ff8a', '움직이면 뒤에 적을 녹이는 산성 장판이 남음', {}, ['trailCreep']),
    P('P63', '시냅스 가소성', 2, 'neuron', '#8fd0ff', '빗나가지 않고 연속으로 맞히면 피해가 최대 2배까지 쌓임', {}, ['deadEye']),
    P('P64', '림프관 우회로', 1, 'coin', '#f5c542', '상점 가격 50% 할인', {}, ['discount']),
    P('P65', '알부민 수송체', 1, 'bag', '#ffe9b0', '진단서·호르몬을 2개까지 들고 다님', {}, ['slots2']),
    P('P66', '수술도구 홀더', 1, 'forceps', '#cfe0f0', '수술도구를 2개까지 장착', {}, ['tools2']),
    P('P67', '다배체 거대화', 2, 'cell', '#ffcf9a', '몸이 커지고 바위를 밀고 부숨 (공격력 +1, 이동 -0.1)', { dmg: 1, speed: -0.1 }, ['giant'], 'big'),
    P('P68', '나노 축소', 1, 'cell', '#bfffea', '몸이 작아져 잘 맞지 않음 (이동 +0.2)', { speed: 0.2 }, ['tiny'], 'small'),
    P('P69', '역분화 인자', 3, 'star', '#fff07a', '쓰러지면 한 번, 체력 3칸으로 되살아남', {}, ['revive'], 'halo'),
    P('P70', '항상성 마스터 코어', 3, 'crystal', '#ffffff', '체력이 가득 차 있으면 공격력 +2, 탄환 크기 2배', {}, ['fullHp'], 'crown'),
  ];

  /* ───────── 액티브 30종 (Space) — charge: 방을 비울 때마다 1칸 ───────── */
  const A = (id, name, charge, glyph, col, desc) => ({ id, kind: 'active', name, charge, glyph, col, desc });
  CR.ACTIVES = [
    A('A01', '크리스퍼 유전자 가위', 3, 'scissors', '#7fd4ff', '방 안 모든 적에게 40 피해 + 출혈'),
    A('A02', '자가포식 유도기', 6, 'cell', '#ffa36b', '실드 1칸 즉시 생성'),
    A('A03', '에피네프린 주사', 3, 'syringe', '#ff6b6b', '이 방에서 공격력 +2.5, 연사 +1.5'),
    A('A04', '제세동기', 4, 'bolt', '#ffe36b', '모든 적에게 전기 충격 30 피해 + 3초 기절'),
    A('A05', '원심분리기', 2, 'gear', '#c0c8d8', '모든 적을 반대쪽 벽으로 밀어내고 15 피해'),
    A('A06', 'PCR 증폭기', 4, 'dna', '#8fffcf', '방 바닥의 물건(코인·폭탄·열쇠·하트)을 2배로 복제'),
    A('A07', '돌연변이 유발기', 6, 'virus', '#d68cff', '방 안 받침대 위 아이템을 다른 것으로 바꿈'),
    A('A08', '투석 필터', 3, 'flask', '#7fe0ff', '바닥의 독 장판 제거 + 체력 1칸 회복'),
    A('A09', '초음파 파쇄기', 2, 'beam', '#a0f0ff', '방 안 바위를 모두 부수고 숨은 벽을 드러냄'),
    A('A10', 'mRNA 백신', 4, 'syringe', '#9dffb0', '5초 동안 무적, 몸으로 부딪힌 적에게 피해'),
    A('A11', '배양 접시', 3, 'dish', '#ffd36b', '아군 자폭 파지 4마리를 소환'),
    A('A12', '전자현미경', 2, 'micro', '#d0d8e8', '층 지도를 밝히고 이 방 적의 약점을 드러내 받는 피해 2배'),
    A('A13', '헌혈 팩', 0, 'bag', '#e8344e', '체력 반 칸을 써서 ATP 코인 2~4개 생성 (충전 없음)'),
    A('A14', '리소좀 투척기', 2, 'bomb', '#8a5cf0', '조준한 방향으로 거대 리소좀 폭탄을 던짐'),
    A('A15', '골수 이식 키트', 6, 'bone', '#fff0d0', '최대 체력 1칸을 쓰고 공격력 +1, 이동 +0.15 영구'),
    A('A16', '호르몬 합성기', 4, 'pill', '#ff7aa8', '무작위 호르몬 1개를 만들어 냄'),
    A('A17', '의학 차트 프린터', 5, 'card', '#4a8cff', '무작위 진단서 1장을 뽑아냄'),
    A('A18', '액체질소 냉각기', 3, 'crystal', '#bfefff', '모든 적을 4초 동안 얼림'),
    A('A19', '방사성 표지기', 4, 'orb', '#b6ff5e', '방 전체에 방사성 구름 — 6초 동안 지속 피해'),
    A('A20', '바이오리액터', 6, 'flask', '#ff8fa0', '체력 2칸 즉시 회복'),
    A('A21', '광유전학 빔', 2, 'beam', '#5ad1ff', '조준한 방향으로 굵은 빛 광선을 쏨'),
    A('A22', '헤파린 주사', 3, 'syringe', '#ff9e5e', '모든 적에게 출혈 + 둔화'),
    A('A23', '인공 박동기', 4, 'heart', '#ff5d8f', '8초 동안 연사 2배 + 쏠 때마다 8방향 추가탄'),
    A('A24', '아포토시스 스위치', 6, 'star', '#ff4d6d', '일반 병원체는 즉시 자멸, 보스는 최대 체력 20% 피해'),
    A('A25', '자외선 무영등', 4, 'lamp', '#e0ccff', '살균 자외선 빛기둥 6개가 적 위로 떨어짐'),
    A('A26', '마취 가스', 3, 'mask', '#a8f0d0', '8초 동안 적과 적 탄환이 60% 느려짐'),
    A('A27', '제한효소 마스터 키', 2, 'key', '#f2c94c', '이 방의 잠긴 문과 숨은 벽을 모두 엶'),
    A('A28', '세포 융합기', 6, 'cell', '#ffe0ff', '이 방에서 나와 똑같이 쏘는 분신을 만듦'),
    A('A29', '항독소 혈청', 3, 'drop', '#9fffd0', '적 탄환 전부 제거 + 이 방에서 장판 면역 + 반 칸 회복'),
    A('A30', '내시경 카메라', 1, 'scope', '#c0d0e0', '앞쪽 적 탄환을 지우고 앞의 적에게 12 피해'),
  ];

  /* ───────── 수술도구 20종 (장신구) ───────── */
  const T = (id, name, glyph, col, desc, fx) => ({ id, kind: 'tool', name, glyph, col, desc, fx });
  CR.TOOLS = [
    T('T01', '수술용 메스', 'blade', '#e3eaf2', '치명타(2배 피해) 확률 +15%', { crit: 15 }),
    T('T02', '지혈 겸자', 'forceps', '#ff8a8a', '맞은 뒤 무적 시간 +0.5초, 30% 확률로 코인이 떨어짐', { invuln: 0.5, hurtCoin: 0.3 }),
    T('T03', '봉합침', 'needle', '#a0d0ff', '방을 비우면 20% 확률로 체력 반 칸 회복', { clearHeal: 0.2 }),
    T('T04', '정밀 핀셋', 'forceps', '#d0e0f0', '떨어진 물건이 자석처럼 끌려옴', { magnet: 1 }),
    T('T05', '견인기', 'clamp', '#c0c8d0', '적 탄환 속도 -15%, 사거리 +40', { ebSlow: 0.15, range: 40 }),
    T('T06', '메이요 가위', 'scissors', '#ff9e5e', '내 탄환이 20% 확률로 적 탄환을 베어 없앰', { cutBullet: 0.2 }),
    T('T07', '청진기', 'scope', '#6ab0ff', '지도에 숨은 방 위치가 표시됨', { showSecret: 1 }),
    T('T08', '뼈톱', 'saw', '#cfa070', '탄환으로 바위를 부술 수 있음', { rockBreak: 1 }),
    T('T09', '동맥 클램프', 'clamp', '#ff6b6b', '보스에게 주는 피해 +15%', { bossDmg: 0.15 }),
    T('T10', '피하 주사 바늘', 'syringe', '#7bdc5a', '명중 시 15% 확률로 중독 또는 출혈', { procDot: 0.15 }),
    T('T11', '멸균 거즈', 'card', '#f4f4f4', '새 구역에 들어갈 때 실드 반 칸', { stageShield: 1 }),
    T('T12', '피부 스테이플러', 'gear', '#b8c4d0', '연사 +0.4', { rate: 0.4 }),
    T('T13', '검안경', 'eye', '#5ad1ff', '탄환 크기와 탄속 +20%', { size: 0.2, sspd: 0.2 }),
    T('T14', '흡입 카테터', 'loop', '#ffd36b', '적을 처치하면 코인이 떨어질 확률 +20%', { killCoin: 0.2 }),
    T('T15', '두개골 드릴', 'drill', '#c49a6c', '껍질로 막는 병원체의 방어를 뚫고 피해', { armorPierce: 1 }),
    T('T16', '수은 체온계', 'thermo', '#ff5d5d', '공격력 +0.5', { dmg: 0.5 }),
    T('T17', '라텍스 장갑', 'gloves', '#f0e6a0', '밀쳐내기 2배, 몸으로 부딪혀 받는 피해 50% 확률로 무시', { knock: 1, contactGuard: 0.5 }),
    T('T18', '보비 전기소작기', 'bolt', '#ffe36b', '맞으면 주변 적에게 전기 반격 20 피해', { hurtShock: 20 }),
    T('T19', '조직 생검 펀치', 'drill', '#e8a0b0', '보스를 처치하면 물건 2개가 더 떨어짐', { bossDrop: 2 }),
    T('T20', '백금 루프', 'loop', '#e0e8f0', '액티브 충전 때 25% 확률로 1칸 더 충전', { extraCharge: 0.25 }),
  ];

  /* ───────── 진단서 10종 (Q) ───────── */
  const C = (id, name, col, desc) => ({ id, kind: 'chart', name, glyph: 'card', col, desc });
  CR.CHARTS = [
    C('C01', '응급 이송 소견서', '#ff6b6b', '이 층의 시작 방으로 즉시 이동'),
    C('C02', '집중 치료 지시서', '#ff9e5e', '이 방에서 공격력 +3, 이동 +0.5'),
    C('C03', '면역글로불린 처방전', '#b07cff', '이 층의 보스 방으로 즉시 이동'),
    C('C04', '보험 급여 확인서', '#f5c542', '이 층의 상점으로 즉시 이동'),
    C('C05', '외과 협진 의뢰서', '#7fd4ff', '이 층의 보물 방으로 즉시 이동'),
    C('C06', '완치 판정서', '#7dffb2', '체력 완전 회복 + 모든 적에게 100 피해 + 층 지도 공개'),
    C('C07', '조직검사 소견서', '#d0464f', '이 방에서 공격력 2배 + 변이 연구실로 가는 통로를 엶'),
    C('C08', '괴사 진단서', '#6b4a7a', '방 안 모든 적에게 60 피해'),
    C('C09', '복제 검사서', '#8fffcf', '방 바닥의 물건을 2배로 복제'),
    C('C10', '격리 해제서', '#ffe066', '조준한 방향으로 던져 맞은 적에게 초대형 피해'),
  ];

  /* ───────── 호르몬 8종 (Q) — 처음부터 이름과 효과가 보임 ───────── */
  const H = (id, name, good, col, col2, desc) => ({ id, kind: 'hormone', name, good, glyph: 'pill', col, col2, desc });
  CR.HORMONES = [
    H('H01', '티록신', true, '#ffb347', '#ffffff', '대사율 증가 — 이동 +0.25, 연사 +0.3 영구'),
    H('H02', '인슐린', true, '#5ad1ff', '#ffffff', '항상성 회복 — 체력 2칸 회복'),
    H('H03', '성장 호르몬', true, '#ff6b6b', '#ffe0e0', '단백질 합성 촉진 — 공격력 +0.6 영구'),
    H('H04', '바소프레신', true, '#7fd4ff', '#2a6aa8', '수분 재흡수 — 사거리 +50, 탄속 +0.2 영구'),
    H('H05', '멜라토닌', true, '#b07cff', '#e8dcff', '생체 리듬 안정 — 실드 1칸'),
    H('H06', '코티솔 과다', false, '#8a8a8a', '#d0d0d0', '만성 스트레스 — 연사 -0.2'),
    H('H07', '글루카곤 급등', false, '#ffd36b', '#8a5a2b', '현기증 — 체력 반 칸 피해 (반 칸은 남음)'),
    H('H08', '부갑상선 호르몬 과잉', false, '#c8c0a0', '#6a6040', '칼슘 유출 — 이동 -0.15'),
  ];

  /* ───────── 병원체 40종 ─────────
     move: chase 추적 · wander 배회 · hop 점프 · fly 비행 · charge 돌진 · zigzag 지그재그 · static 고정 · burrow 잠복 · teleport 순간이동 · ghost 벽 통과 · swim 대각선 유영
     atk:  aim 조준 · cross 십자 · ring 원형 · spread 3갈래 · laser 예고 광선 · cloud 포자 구름 · summon 소환 · heal 회복 오라 · cough 기침 충격파 · homing 유도                       */
  const E = (id, name, st, shape, col, hp, spd, move, o) => Object.assign({ id, kind: 'enemy', name, st, shape, col, hp, spd, move, S: 16 }, o);
  CR.ENEMIES = [
    E('E01', '황색포도상구균', 1, 'cluster', '#f0c040', 9, 0.55, 'chase', { desc: '포도송이처럼 뭉친 구균. 상처로 들어와 곪게 만든다.' }),
    E('E02', '표피포도상구균', 1, 'coccus', '#f3e3b8', 6, 0.7, 'chase', { group: 2, desc: '피부에 사는 상재균이지만 상처에선 둘씩 몰려다닌다.' }),
    E('E03', '화농성연쇄상구균', 1, 'chain', '#e46a5c', 11, 0.5, 'charge', { desc: '사슬처럼 이어진 구균. 정렬되면 일직선으로 돌진한다.' }),
    E('E04', '리노바이러스 파리', 1, 'fly', '#9fd36b', 4, 0.8, 'fly', { desc: '감기 바이러스를 실어 나르는 작은 비행체.' }),
    E('E05', '여드름균', 1, 'coccus', '#f6a6b2', 13, 0.35, 'wander', { death: 'burst4', desc: '모공 속에서 자라는 균. 터지면 고름이 4방향으로 튄다.' }),
    E('E06', '파상풍균 포자', 1, 'spore', '#a08c6b', 12, 0, 'static', { armor: 1, atk: { t: 'spread', cd: 2.6 }, desc: '단단한 포자 껍질로 숨었다가 열리는 순간 3갈래로 쏜다.' }),
    E('E07', '백선균 곰팡이', 1, 'fungus', '#c7b8ea', 12, 0, 'static', { atk: { t: 'cloud', cd: 4.5 }, desc: '피부 각질을 먹는 곰팡이. 포자 구름을 뿜는다.' }),
    E('E08', '말라리아 원충', 2, 'amoeba', '#d8506a', 14, 0.9, 'hop', { desc: '모기가 옮기는 원충. 적혈구 사이를 뛰어다닌다.' }),
    E('E09', '수면병 트리파노소마', 2, 'spiral', '#8fb7e8', 12, 1.3, 'swim', { desc: '편모로 혈류를 가르며 대각선으로 빠르게 헤엄친다.' }),
    E('E10', '바베시아', 2, 'cell', '#ff8f8f', 16, 0.45, 'wander', { death: 'split', desc: '적혈구를 깨고 나와 둘로 나뉘는 기생충.' }),
    E('E11', '필라리아 사상충', 2, 'worm', '#e9d6c3', 18, 0.6, 'charge', { desc: '실처럼 긴 기생충. 림프관을 따라 맹렬히 돌진한다.' }),
    E('E12', '패혈증 비브리오균', 2, 'rod', '#6fd3c7', 14, 0.6, 'charge', { fast: 1, desc: '플레이어를 발견하면 엄청난 속도로 들이받는다.' }),
    E('E13', '혈전 폴립', 2, 'clot', '#8e1f2f', 20, 0.25, 'wander', { atk: { t: 'cross', cd: 2.2 }, desc: '굳은 피 덩어리. 십자 방향으로 핏방울을 쏜다.' }),
    E('E14', '감염된 대식세포', 2, 'cell', '#c9a6d8', 38, 0.3, 'chase', { S: 24, atk: { t: 'ring', n: 8, cd: 3 }, desc: '병원체에 장악당한 대식세포. 느리지만 8방향 탄막.' }),
    E('E15', '헬리코박터 파일로리', 3, 'spiral', '#b7d84a', 18, 0.6, 'wander', { creep: 1, desc: '위산 속에서도 살아남는 나선균. 산성 점액을 남긴다.' }),
    E('E16', '병원성 대장균 O157', 3, 'rod', '#c48a5a', 18, 0.4, 'wander', { atk: { t: 'aim', n: 3, burst: 1, cd: 2.6 }, desc: '베로 독소를 세 번 연달아 쏜다.' }),
    E('E17', '살모넬라균', 3, 'rod', '#f08a4b', 14, 1.2, 'zigzag', { desc: '지그재그로 빠르게 다가오는 식중독균.' }),
    E('E18', '노로바이러스', 3, 'virus', '#6ab0ff', 16, 0.9, 'hop', { death: 'burst6', desc: '통통 튀며 다가오다 터지면 6방향으로 퍼진다.' }),
    E('E19', '콜레라균', 3, 'rod', '#5fc4e0', 16, 0.4, 'wander', { atk: { t: 'aim', push: 1, cd: 2.2 }, desc: '물줄기 탄환으로 플레이어를 밀쳐낸다.' }),
    E('E20', '이질 아메바', 3, 'amoeba', '#b5d28c', 24, 0.4, 'chase', { death: 'split', desc: '쓰러지면 작은 아메바 둘로 세포 분열한다.' }),
    E('E21', '촌충 마디', 3, 'worm', '#efe2b4', 14, 0.9, 'chase', { death: 'explode', boomNear: 1, desc: '가까이 오면 스스로 터지는 기생충 마디.' }),
    E('E22', '결핵균', 4, 'rod', '#d9c38a', 30, 0.3, 'wander', { resist: 0.5, atk: { t: 'homing', cd: 2.8 }, desc: '미콜산 세포벽으로 피해를 절반만 받고 유도탄을 쏜다.' }),
    E('E23', '폐렴구균 쌍둥이', 4, 'pair', '#a8d0e6', 18, 0.5, 'wander', { group: 2, tether: 1, desc: '두 마리 사이에 피막 광선이 이어져 있다. 사이를 지나가지 말 것.' }),
    E('E24', '인플루엔자 바이러스', 4, 'virus', '#7ec8a8', 22, 0.3, 'wander', { atk: { t: 'summon', id: 'E04', cd: 5 }, desc: '숙주를 감염시켜 작은 바이러스 파리를 계속 만든다.' }),
    E('E25', '백일해균', 4, 'coccus', '#d6d6a0', 20, 0.4, 'wander', { atk: { t: 'cough', cd: 3 }, desc: '강한 기침 충격파로 탄환을 튕겨내고 플레이어를 민다.' }),
    E('E26', '아데노바이러스', 4, 'virus', '#f2a65a', 20, 0, 'static', { atk: { t: 'ring', n: 6, spin: 1, cd: 1.8 }, desc: '정이십면체 캡시드가 회전하며 6방향으로 쏜다.' }),
    E('E27', '레지오넬라균', 4, 'rod', '#66a3d2', 20, 0, 'burrow', { atk: { t: 'aim', n: 3, cd: 2 }, desc: '물웅덩이에 숨었다가 솟아올라 기습 사격.' }),
    E('E28', '천식 비만세포', 4, 'cell', '#e7a3c4', 18, 0.55, 'chase', { boomNear: 1, death: 'burst8', desc: '다가오면 히스타민을 터뜨려 광역 폭발.' }),
    E('E29', '수막염균', 5, 'pair', '#f5e663', 20, 0.35, 'wander', { atk: { t: 'aim', n: 3, fast: 1, burst: 1, cd: 1.6 }, desc: '전기를 띤 탄환을 빠르게 연사한다.' }),
    E('E30', '광견병 바이러스', 5, 'rod', '#9b8fb0', 16, 0.7, 'charge', { fast: 1, desc: '총알 모양 바이러스. 광란의 속도로 돌진한다.' }),
    E('E31', '폴리오바이러스', 5, 'virus', '#8fd3f4', 20, 0.35, 'wander', { atk: { t: 'aim', slowShot: 1, cd: 2 }, desc: '맞으면 잠시 몸이 느려지는 탄환을 쏜다.' }),
    E('E32', '보툴리눔 독소체', 5, 'protein', '#b3e06b', 22, 0, 'static', { atk: { t: 'laser', cd: 3.6 }, desc: '예고선을 그은 뒤 직선 신경독 광선을 쏜다.' }),
    E('E33', '프리온 변형 단백질', 5, 'protein', '#d98ec2', 26, 0.4, 'teleport', { resist: 0.5, desc: '잘못 접힌 단백질. 피해를 절반만 받고 불쑥 나타난다.' }),
    E('E34', '파울러자유아메바', 5, 'amoeba', '#e6c3f0', 22, 0.6, 'ghost', { desc: '벽과 바위를 통과해 쫓아오는 뇌먹는 아메바.' }),
    E('E35', '레트로바이러스 정예병', 6, 'virus', '#ffcf5a', 32, 0.4, 'wander', { atk: { t: 'spread', fast: 1, cd: 1.8 }, angry: 1, desc: '숙주 유전자를 베낀 정예병. 빠른 3갈래 사격.' }),
    E('E36', '발암 유전자 온코진', 6, 'tumor', '#c0392b', 28, 0, 'static', { atk: { t: 'heal', cd: 2 }, desc: '주변 병원체의 체력을 계속 회복시키는 핵심. 먼저 부숴야 한다.' }),
    E('E37', '돌연변이 중심립', 6, 'centriole', '#a3a3ff', 30, 0, 'static', { atk: { t: 'laser', spin: 1, cd: 4.2 }, desc: '방추사 광선 두 줄을 회전시키며 조여 온다.' }),
    E('E38', '텔로미어 포식자', 6, 'tumor', '#3d2b56', 30, 0.35, 'wander', { pull: 1, atk: { t: 'homing', cd: 2.4 }, c2: '#b07cff', desc: '검은 유도탄을 쏘고 주변을 블랙홀처럼 빨아들인다.' }),
    E('E39', '자멸 회피 종양', 6, 'tumor', '#8e44ad', 26, 0.45, 'chase', { revive: 1, desc: '체력이 0이 되어도 3초 뒤 되살아난다. 쓰러진 사이 완전히 부숴라.' }),
    E('E40', '크로마틴 골렘', 6, 'golem', '#d4a017', 60, 0.7, 'hop', { S: 24, slam: 12, desc: '응축된 염색질 거인. 뛰어올라 찍으며 12방향 탄막.' }),
  ];
  // 분열·소환용 작은 개체
  CR.MINIS = {
    E10s: E('E10s', '바베시아 조각', 2, 'cell', '#ff9f9f', 6, 0.6, 'chase', { S: 12 }),
    E20s: E('E20s', '꼬마 아메바', 3, 'amoeba', '#c5e29c', 8, 0.6, 'chase', { S: 12 }),
    ally: E('ally', '아군 파지', 0, 'phage', '#9fffe0', 1, 1.6, 'ally', { S: 12 }),
  };

  /* ───────── 보스 21종 ─────────
     pats: 페이즈별 패턴 목록 (체력 50% 이하에서 2페이즈). 패턴 이름은 game.js의 보스 행동 사전에 정의       */
  const B = (id, name, st, shape, col, hp, move, pats, o) => Object.assign({ id, kind: 'boss', name, st, shape, col, hp, move, pats, S: 32 }, o);
  CR.BOSSES = [
    B('B01', '스타필로 킹', 1, 'cluster', '#f0c040', 170, 'walk', [['jump', 'aim:5', 'jump'], ['jump', 'scatter', 'ring:12']], { crown: 1, desc: '황색포도상구균 군체의 왕. 뛰어올라 짓누르고 고름 산탄을 흩뿌린다.' }),
    B('B02', '스트렙 체인 서펜트', 1, 'chain', '#e46a5c', 180, 'snake', [['aim:3', 'ring:8'], ['ring:10', 'aim:5', 'charge']], { segs: 6, desc: '연쇄상구균 사슬이 거대한 뱀처럼 방을 휘감는다. 마디마다 탄환을 쏜다.' }),
    B('B03', '백선 포자모', 1, 'fungus', '#c7b8ea', 165, 'static', [['cloud', 'summon:E04:2', 'ring:10'], ['cloud', 'spiral', 'summon:E07:1']], { desc: '거대한 곰팡이 어미. 포자 구름을 뿜고 자식 포자를 퍼뜨린다.' }),
    B('B04', '고름 농양 거인', 1, 'coccus', '#f6a6b2', 175, 'walk', [['aim:3', 'summon:E05:2'], ['burst', 'ring:14', 'charge']], { desc: '부풀어 오른 농양. 체력이 깎이면 고름을 사방으로 터뜨린다.' }),
    B('B05', '플라스모디움 여제', 2, 'amoeba', '#d8506a', 300, 'float', [['teleport', 'ring:8', 'summon:E08:2'], ['teleport', 'laser8', 'ring:16']], { crown: 1, desc: '말라리아 원충의 여제. 순간이동하며 8방향 혈액 광선을 쏜다.' }),
    B('B06', '혈전 골렘', 2, 'clot', '#8e1f2f', 320, 'walk', [['charge', 'net'], ['charge', 'net', 'ring:12', 'charge']], { desc: '굳은 피가 뭉친 거인. 대각선으로 들이받고 혈소판 그물을 친다.' }),
    B('B07', '트리파노 편모룡', 2, 'spiral', '#8fb7e8', 290, 'bounce', [['wave', 'aim:5'], ['wave', 'homing:4', 'spiral']], { desc: '거대한 편모충. 방을 튕겨 다니며 채찍 충격파를 날린다.' }),
    B('B08', '비브리오 쌍둥이', 2, 'rod', '#6fd3c7', 170, 'walk', [['charge', 'aim:3'], ['charge', 'charge', 'ring:8']], { twins: 1, desc: '두 마리가 번갈아 돌진한다. 하나가 쓰러지면 남은 쪽이 분노한다.' }),
    B('B09', '위산 헬리코 폭군', 3, 'spiral', '#b7d84a', 420, 'float', [['pool', 'spiral', 'jump'], ['pool', 'spiral', 'ring:16', 'jump']], { desc: '방 바닥을 위산으로 뒤덮고 소용돌이 탄막을 뿜는다.' }),
    B('B10', '장독소 군체', 3, 'rod', '#c48a5a', 440, 'static', [['cross', 'summon:E16:2', 'aim:5'], ['xcross', 'summon:E17:2', 'spiral']], { desc: '방 한가운데 뿌리내린 장내 세균 군체. 독소를 사방으로 뿜는다.' }),
    B('B11', '캡시드 요새', 3, 'virus', '#6ab0ff', 430, 'static', [['shell', 'ring:16', 'shell', 'orbit'], ['shell', 'ring:20', 'spiral', 'orbit']], { desc: '정이십면체 껍질로 무적 방어. 껍질이 열리는 순간이 기회다.' }),
    B('B12', '아메바 분열체', 3, 'amoeba', '#b5d28c', 380, 'walk', [['jump', 'aim:3'], ['jump', 'ring:8']], { split: 2, desc: '쓰러뜨릴 때마다 둘로 갈라진다. 마지막 조각까지 없애야 끝난다.' }),
    B('B13', '결핵 왁스로드', 4, 'rod', '#d9c38a', 560, 'walk', [['homing:5', 'cross', 'shell'], ['homing:6', 'xcross', 'cross', 'shell']], { resist: 0.25, desc: '왁스 세포벽의 군주. 유도 기침 탄막과 십자 광선을 쏜다.' }),
    B('B14', '변이 수지상세포', 4, 'cell', '#e7a3c4', 540, 'float', [['summon:E22:1', 'laser3', 'aim:5'], ['summon:E25:2', 'laser3', 'spiral']], { desc: '림프절을 오염시킨 수지상세포. 면역세포를 세뇌해 부르고 3줄 광선.' }),
    B('B15', '독감 변이체', 4, 'virus', '#7ec8a8', 550, 'float', [['ring:12', 'aim:5', 'rain'], ['spiral', 'rain', 'homing:5', 'ring:16']], { morph: 1, desc: '5초마다 표면 단백질이 바뀌며 색과 공격이 달라진다.' }),
    B('B16', '폐포 풍선괴물', 4, 'rbc', '#a9c9e6', 520, 'float', [['inflate', 'ring:16'], ['inflate', 'wave', 'ring:20']], { desc: '부풀었다 꺼졌다 하며 바람으로 밀고 공기 탄막을 터뜨린다.' }),
    B('B17', '시냅스 신경거미', 5, 'protein', '#9fd2ff', 720, 'walk', [['web', 'aim:5', 'zap'], ['web', 'zap', 'spiral', 'laser3']], { desc: '신경망을 거미줄처럼 치고 전기 충격파를 내뿜는다.' }),
    B('B18', '프리온 거울체', 5, 'protein', '#d98ec2', 700, 'float', [['teleport', 'xcross', 'teleport', 'cross'], ['teleport', 'laser8', 'homing:6']], { resist: 0.2, desc: '잔상을 남기며 순간이동해 교차 광선을 쏜다.' }),
    B('B19', '보툴리눔 촉수왕', 5, 'tumor', '#b3e06b', 740, 'static', [['tentacle', 'ring:16', 'tentacle'], ['tentacle', 'spiral', 'tentacle', 'ring:24']], { c2: '#e8ff8a', desc: '바닥에서 신경독 촉수를 솟구치게 하고 원형 독 탄막을 뿜는다.' }),
    B('B20', '뇌막 감시안', 5, 'eye', '#d9455a', 720, 'static', [['sweep', 'aim:5', 'ring:12'], ['sweep', 'sweep', 'homing:6']], { desc: '방 한가운데서 360도 회전 광선을 쏘며 안구 탄환을 날린다.' }),
    B('B21', '암세포 군주 말리그넌트', 6, 'tumor', '#7a1530', 1500, 'static',
      [['summon:E35:2', 'ring:16', 'spiral', 'summon:E36:1'], ['laser8', 'homing:8', 'ring:20', 'charge'], ['wave', 'rain', 'spiral', 'laser8', 'wave']],
      { crown: 1, c2: '#ff3d6e', phases3: 1, desc: '핵막 깊숙이 자리 잡은 암세포 군주. 증식 → 전이 폭주 → 유전자 붕괴의 3단계로 싸운다.' }),
  ];

  // 빠른 찾기
  CR.ALL = {};
  [CR.PASSIVES, CR.ACTIVES, CR.TOOLS, CR.CHARTS, CR.HORMONES, CR.ENEMIES, CR.BOSSES].forEach(L => L.forEach(x => (CR.ALL[x.id] = x)));
  Object.values(CR.MINIS).forEach(x => (CR.ALL[x.id] = x));
})();

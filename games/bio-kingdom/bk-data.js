/* 바이오 킹덤 · 데이터 (영웅 · 적 · 건물 · 스테이지) */
(function () {
  'use strict';
  const D = window.BKD = {};
  // 등급: C 일반 · R 희귀 · E 에픽 · L 전설
  D.RARITY = { C: { name: '일반', col: '#9aa8b8', mul: 1.0, shard: 20 }, R: { name: '희귀', col: '#4aa8ff', mul: 1.18, shard: 30 }, E: { name: '에픽', col: '#c86aff', mul: 1.38, shard: 50 }, L: { name: '전설', col: '#ffb020', mul: 1.62, shard: 80 } };
  // 역할: 돌격(앞) · 공격(가운데) · 마법(뒤, 원거리) · 지원(뒤, 회복)
  D.ROLE = { tank: { name: '돌격', pos: 0, icon: 'shield', hp: 1.7, atk: 0.65, def: 1.6, range: 70 }, dps: { name: '공격', pos: 1, icon: 'swords', hp: 1.0, atk: 1.25, def: 0.9, range: 125 }, mage: { name: '마법', pos: 2, icon: 'star', hp: 0.8, atk: 1.15, def: 0.7, range: 330 }, sup: { name: '지원', pos: 2, icon: 'plus', hp: 0.9, atk: 0.7, def: 0.8, range: 300 } };
  // 스킬 종류(k): dmg 단일 큰 피해 · aoe 범위 · heal 아군 회복 · buff 공격력 · shield 보호막 · taunt 도발+보호 · slow 둔화 · multi 여러 번 · snipe 가장 뒤 적 · cleanse 해로운 효과 제거+회복 · drain 흡혈 · transform 변신
  const H = (id, name, rar, role, skill, sk, fact, extra) => Object.assign({ id, name, rar, role, skill, sk, fact }, extra || {});
  D.HEROES = [
    H('elephant', '코끼리 대장', 'L', 'tank', '물대포 코', { k: 'aoe', p: 2.2, cd: 12, knock: 1 }, '코끼리의 코는 윗입술과 코가 합쳐진 기관으로 근육이 약 4만 개나 있어요. 물을 빨아들여 뿜을 수 있어요.'),
    H('lion', '사자 왕', 'L', 'dps', '무리 사냥', { k: 'buff', p: 0.35, dur: 8, cd: 14, roar: 1.4 }, '사자는 고양잇과에서 드물게 무리(프라이드)를 지어 협동 사냥을 해요. 함께하면 더 큰 먹잇감을 잡을 수 있어요.'),
    H('caterpillar', '애벌레 마법사', 'E', 'mage', '완전 변태', { k: 'transform', p: 1.8, dur: 10, cd: 16 }, '나비는 알-애벌레-번데기-어른벌레로 모습이 완전히 바뀌는 완전 변태를 해요. 번데기 안에서 몸이 새로 만들어져요.'),
    H('panda', '판다 치유사', 'E', 'sup', '대나무 휴식', { k: 'heal', p: 0.3, all: 1, cd: 13 }, '판다는 곰의 무리인데도 대나무를 주로 먹어요. 소화율이 낮아 하루에 12~38kg이나 먹어야 해요.'),
    H('penguin', '펭귄 기사', 'E', 'mage', '남극 눈보라', { k: 'slow', p: 1.4, dur: 4, cd: 12 }, '펭귄은 촘촘한 깃털과 두꺼운 지방층으로 체온을 지켜요. 무리 지어 몸을 붙이고 서로 따뜻하게 해요(허들링).'),
    H('tiger', '호랑이 암살자', 'E', 'dps', '줄무늬 기습', { k: 'snipe', p: 3.2, cd: 11 }, '호랑이의 줄무늬는 숲속 그림자에 섞여 몸을 숨기는 보호색이에요. 줄무늬는 사람 지문처럼 모두 달라요.'),
    H('polar', '북극곰 수호자', 'E', 'tank', '두꺼운 지방층', { k: 'shield', p: 0.45, self: 1, cd: 13, heal: 0.2 }, '북극곰은 털 아래 피부가 검은색이라 햇볕 열을 잘 흡수하고, 10cm 넘는 지방층이 추위를 막아요.'),
    H('crab', '게 방패병', 'R', 'tank', '단단한 외골격', { k: 'taunt', p: 0.5, dur: 6, cd: 12 }, '게·새우 같은 절지동물은 키틴질로 된 단단한 외골격이 몸을 지켜요. 자라려면 허물을 벗어야 해요(탈피).'),
    H('bee', '꿀벌 전령', 'R', 'sup', '꽃가루받이', { k: 'heal', p: 0.18, all: 1, buff: 0.15, cd: 12 }, '꿀벌은 꿀을 모으며 꽃가루를 옮겨 식물의 수분을 도와요. 우리가 먹는 작물의 약 3분의 1이 꽃가루 매개 동물 덕분이에요.'),
    H('hog', '멧돼지 돌격병', 'R', 'tank', '진흙 목욕', { k: 'shield', p: 0.35, self: 1, cd: 11 }, '멧돼지는 땀샘이 적어 진흙 목욕으로 체온을 낮추고 진드기 같은 기생충을 떼어 내요.'),
    H('fox', '여우 척후병', 'R', 'dps', '위장술', { k: 'dmg', p: 2.6, crit: 1, cd: 10 }, '사막여우의 큰 귀는 땅속 먹이 소리를 듣고, 몸의 열을 내보내 체온을 낮추는 역할도 해요.'),
    H('giraffe', '기린 저격수', 'R', 'mage', '높은 시야', { k: 'snipe', p: 2.4, cd: 10 }, '기린은 목뼈 개수가 사람과 같은 7개예요. 뼈 하나하나가 길어서 높은 곳의 잎을 먹고 멀리 볼 수 있어요.'),
    H('parrot', '앵무새 음유시인', 'R', 'mage', '울림 소리', { k: 'aoe', p: 1.5, cd: 10 }, '앵무새는 울대(새의 발성 기관)와 혀를 섬세하게 움직여 다른 소리를 흉내 낼 수 있어요.'),
    H('koala', '코알라 약사', 'R', 'sup', '해독 효소', { k: 'cleanse', p: 0.35, cd: 11 }, '코알라는 독성이 있는 유칼립투스 잎을 먹어요. 간의 해독 효소와 긴 맹장 속 미생물이 독을 분해해요.'),
    H('deer', '사슴 창기병', 'R', 'dps', '뿔 돌진', { k: 'aoe', p: 1.9, line: 1, cd: 11 }, '사슴뿔은 해마다 빠졌다 다시 자라요. 자라는 동안에는 혈관이 지나는 부드러운 피부(녹용)로 덮여 있어요.'),
    H('beaver', '비버 건축가', 'R', 'tank', '댐 건설', { k: 'shield', p: 0.25, all: 1, cd: 14 }, '비버는 나무로 댐을 지어 연못을 만들어요. 이 연못은 다른 생물의 서식지가 되어 생태계를 바꿔요(생태계 엔지니어).'),
    H('monkey', '원숭이 투척수', 'C', 'dps', '도구 던지기', { k: 'multi', p: 0.8, hits: 3, cd: 9 }, '침팬지 같은 영장류는 나뭇가지로 흰개미를 낚거나 돌로 열매를 깨는 등 도구를 사용해요.'),
    H('cat', '고양이 사냥꾼', 'C', 'dps', '야간 시력', { k: 'dmg', p: 2.1, crit: 1, cd: 9 }, '고양이 눈 뒤쪽의 반사판(휘판)이 빛을 한 번 더 반사해 어두운 곳에서도 잘 봐요.'),
    H('dog', '강아지 경비병', 'C', 'tank', '후각 추적', { k: 'taunt', p: 0.3, dur: 5, cd: 11 }, '개의 코에는 후각 세포가 사람보다 약 40배 많아 아주 적은 냄새도 맡을 수 있어요.'),
    H('bunny', '토끼 간호사', 'C', 'sup', '빠른 회복', { k: 'heal', p: 0.45, cd: 10 }, '토끼는 번식력이 매우 강해요. 생태계에서 많은 포식자의 먹이가 되어 먹이 그물을 지탱해요.'),
    H('chick', '병아리 수비대', 'C', 'sup', '알 보호막', { k: 'shield', p: 0.4, cd: 10 }, '달걀 껍데기에는 수천 개의 작은 구멍(기공)이 있어 그 안의 병아리가 숨을 쉴 수 있어요.'),
    H('cow', '젖소 방벽', 'C', 'tank', '되새김질', { k: 'shield', p: 0.3, self: 1, heal: 0.25, cd: 12 }, '소는 위가 4개예요. 먹은 풀을 다시 입으로 올려 씹는 되새김질로 질긴 섬유소를 소화해요.'),
    H('pig', '돼지 먹보', 'C', 'dps', '잡식성', { k: 'drain', p: 1.8, cd: 10 }, '돼지는 식물과 동물을 모두 먹는 잡식성이에요. 후각이 뛰어나 땅속 송로버섯도 찾아내요.'),
    H('fish', '물고기 견습 마법사', 'C', 'mage', '아가미 물방울', { k: 'dmg', p: 1.9, cd: 9 }, '물고기는 아가미로 물에 녹아 있는 산소를 흡수해요. 물이 아가미를 지나며 기체 교환이 일어나요.')
  ];
  D.HERO = {}; D.HEROES.forEach((h, i) => { h.i = i; D.HERO[h.id] = h; });
  // 기본 능력치 (레벨 1, 등급·역할 배율 적용 전)
  D.base = { hp: 420, atk: 46, def: 18, aspd: 1.15 };
  D.statsOf = function (id, lv, star, skLv) {
    const h = D.HERO[id], R = D.RARITY[h.rar], Ro = D.ROLE[h.role], g = 1 + (lv - 1) * 0.1, s = 1 + (star - 1) * 0.12;
    return { hp: Math.round(D.base.hp * Ro.hp * R.mul * g * s), atk: Math.round(D.base.atk * Ro.atk * R.mul * g * s), def: Math.round(D.base.def * Ro.def * R.mul * g * s), aspd: D.base.aspd, range: Ro.range, skMul: 1 + (skLv - 1) * 0.1 };
  };
  D.power = (st) => Math.round(st.hp * 0.25 + st.atk * 4 + st.def * 3);
  D.maxLv = star => 10 + star * 10;
  D.lvCost = lv => ({ protein: 1 + Math.floor(lv * 0.6), coin: 40 + lv * 30 });
  D.skCost = sl => ({ dna: 1 + sl * 2, coin: 150 + sl * 120 });
  D.starCost = star => [0, 20, 40, 80, 150, 999][star];

  // ---------- 적 (그림은 bk-art.js에서 직접 그림) ----------
  //  look: 그리는 모양, col: 색
  const E = (id, name, look, col, hp, atk, def, spd, range, fact, extra) => Object.assign({ id, name, look, col, hp, atk, def, spd, range, fact }, extra || {});
  D.ENEMIES = {
    cold: E('cold', '감기 바이러스', 'virus', '#7ad06a', 260, 30, 6, 1.1, 70, '감기는 주로 리노바이러스가 코와 목의 세포에 감염해 생겨요. 바이러스는 스스로 증식하지 못해 숙주 세포를 이용해요.'),
    ecoli: E('ecoli', '나쁜 대장균', 'rod', '#ff9a5a', 320, 34, 8, 1.2, 70, '대장균은 대부분 장 속에서 해롭지 않게 살지만, 일부 병원성 대장균은 식중독을 일으켜요.'),
    staph: E('staph', '포도상구균', 'cocci', '#ffd84a', 300, 38, 10, 1.25, 70, '포도상구균은 공 모양 세균이 포도송이처럼 뭉쳐 있어요. 상처로 들어가면 고름이 생기는 염증을 일으켜요.'),
    spore: E('spore', '곰팡이 포자', 'fuzz', '#b68ad8', 240, 30, 5, 1.3, 280, '곰팡이는 포자를 바람에 날려 퍼뜨려요. 따뜻하고 습한 곳에서 잘 자라요.', { ranged: 1 }),
    amoeba: E('amoeba', '아메바', 'blob', '#6ac8e8', 420, 36, 12, 1.0, 70, '아메바는 몸 모양을 바꾸며 위족(헛발)으로 움직이고 먹이를 감싸서 먹는 원생생물이에요.'),
    worm: E('worm', '회충', 'worm', '#e8b0a0', 380, 44, 8, 1.15, 70, '회충은 사람 장 속에 사는 기생충이에요. 채소를 깨끗이 씻고 손을 잘 씻으면 예방할 수 있어요.'),
    plankton: E('plankton', '적조 플랑크톤', 'diatom', '#e85a5a', 280, 40, 6, 1.2, 260, '적조는 바닷물의 영양염이 많아져 식물성 플랑크톤이 폭발적으로 늘어나는 현상이에요. 물고기가 산소 부족으로 죽기도 해요.', { ranged: 1 }),
    plastic: E('plastic', '미세플라스틱 슬라임', 'slime', '#a8b8c8', 520, 40, 18, 0.95, 70, '미세플라스틱은 5mm보다 작은 플라스틱 조각이에요. 먹이 사슬을 따라 생물 몸에 쌓일 수 있어요.'),
    mosquito: E('mosquito', '말라리아 모기', 'mosquito', '#6a6a7a', 230, 46, 5, 1.4, 70, '말라리아는 모기가 옮기는 말라리아 원충이 적혈구에 감염해 생겨요. 모기는 병을 옮기는 매개체예요.', { fly: 1 }),
    // 보스
    flu: E('flu', '독감 바이러스 군주', 'virus', '#5ab04a', 4200, 70, 20, 1.3, 90, '인플루엔자 바이러스는 표면 단백질(H, N)이 자주 바뀌어 해마다 새 백신이 필요해요.', { boss: 1, size: 2.2 }),
    superbug: E('superbug', '슈퍼박테리아', 'rod', '#d84a4a', 5600, 80, 32, 1.35, 90, '항생제를 잘못 쓰면 살아남은 세균이 내성을 가진 슈퍼박테리아가 될 수 있어요. 처방대로 끝까지 먹어야 해요.', { boss: 1, size: 2.2 }),
    mold: E('mold', '곰팡이 여왕', 'fuzz', '#8a5ab8', 5200, 76, 22, 1.3, 300, '푸른곰팡이에서 처음 발견된 페니실린은 세균의 세포벽 합성을 막는 최초의 항생제예요.', { boss: 1, size: 2.3, ranged: 1 }),
    sludge: E('sludge', '오염 괴수 플라스티라', 'slime', '#7a8a9a', 7200, 92, 36, 1.4, 100, '바다 쓰레기의 대부분은 플라스틱이에요. 줄이고(Reduce), 다시 쓰고(Reuse), 재활용(Recycle)해요.', { boss: 1, size: 2.5 })
  };
  // ---------- 챕터 · 스테이지 ----------
  //  bg: 배경 그림, ground: 땅 블록, waves: [적 id들]
  D.CHAPTERS = [
    { name: '푸른 숲 초원', bg: 'backgroundColorGrass', far: 'hills', ground: 'Grass', deco: ['tree', 'treeSmall_green1', 'bush1', 'treeLong'], pool: ['cold', 'ecoli', 'staph'], boss: 'flu', story: '숲의 동물들이 기침을 해요! 감기 바이러스 무리가 숲으로 몰려왔어요.' },
    { name: '모래바람 사막', bg: 'backgroundColorDesert', far: 'hillsLarge', ground: 'Sand', deco: ['cactus1', 'cactus2', 'treePalm', 'pyramid'], pool: ['worm', 'mosquito', 'staph', 'ecoli'], boss: 'superbug', story: '오아시스 물이 오염됐어요. 기생충과 모기가 들끓고 슈퍼박테리아가 나타났어요.' },
    { name: '단풍 숲', bg: 'backgroundColorFall', far: 'mountains', ground: 'Dirt', deco: ['treeOrange', 'treePineOrange', 'bushOrange1', 'treeSmall_orange1'], pool: ['spore', 'amoeba', 'cold', 'worm'], boss: 'mold', story: '축축한 가을 숲에 곰팡이 포자가 퍼졌어요. 곰팡이 여왕을 막아야 해요!' },
    { name: '바닷가 성채', bg: 'backgroundCastles', far: 'mountainB', ground: 'Stone', deco: ['castleSmall', 'tower', 'castleWall', 'treePine'], pool: ['plankton', 'plastic', 'amoeba', 'mosquito'], boss: 'sludge', story: '바다에서 플라스틱 오염이 밀려와 성채를 덮쳐요. 왕국의 마지막 방어선이에요!' }
  ];
  D.STAGES_PER = 10;
  D.stage = function (ci, si) {   // si: 0~9
    const C = D.CHAPTERS[ci], lvl = 1 + ci * 10 + si * 1.0, boss = si === 9;
    const n = 2 + Math.min(3, Math.floor(si / 3)), waves = [];
    for (let w = 0; w < 3; w++) { const L = []; for (let k = 0; k < n + (w === 2 ? 1 : 0); k++) L.push(C.pool[(si + w + k) % C.pool.length]); waves.push(L); }
    if (boss) waves[2] = [C.pool[0], C.boss, C.pool[1]];
    return { ci, si, lvl, boss, waves, name: `${ci + 1}-${si + 1}`, cost: 6 + ci * 2, reward: { coin: 120 + lvl * 25, gem: boss ? 150 : 30, exp: 20 + lvl * 6, glucose: 5 + si, protein: 2 + Math.floor(si / 2) + ci, shard: boss ? 10 : 3 } };
  };
  D.enemyStat = function (id, lvl) { const e = D.ENEMIES[id], g = 1 + (lvl - 1) * 0.15; return { hp: Math.round(e.hp * g * (e.boss ? 0.5 : 0.85)), atk: Math.round(e.atk * g), def: Math.round(e.def * g) }; };

  // ---------- 왕국 건물 ----------
  //  stack: 블록 쌓기 [[x,y,층,타일], ...] (1칸 건물은 [0,0])
  //  make: 생산 목록 [{out:{자원:개수}, in:{자원:개수}, t: 초}]
  D.RES = { coin: { name: '코인', icon: 'coin' }, gem: { name: '크리스탈', icon: 'gem' }, glucose: { name: '포도당', icon: 'glucose' }, atp: { name: 'ATP', icon: 'atp' }, protein: { name: '단백질', icon: 'protein' }, dna: { name: 'DNA', icon: 'dna' }, energy: { name: '행동력', icon: 'energy' } };
  D.BUILD = {
    castle: { name: '생명의 성', size: 2, cost: {}, max: 1, unique: 1, desc: '왕국의 중심. 성 레벨이 오르면 더 많은 건물을 지을 수 있어요.',
      stack: [[0, 0, 1, 'castle_corner_S'], [1, 0, 1, 'castle_gate_S'], [0, 1, 1, 'castle_window_S'], [1, 1, 1, 'castle_corner_E'], [0, 0, 2, 'castle_towerGreen_S'], [1, 1, 2, 'castle_towerGreen_S']] },
    farm: { name: '광합성 밭', size: 1, cost: { coin: 100 }, desc: '식물은 빛에너지로 물과 이산화탄소에서 포도당을 만들어요(광합성).', fact: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂ (빛에너지, 엽록체)',
      stack: [[0, 0, 1, 'furrow_cropWheat_S']], ground: 'dirt_low_N', make: [{ out: { glucose: 3 }, t: 20 }, { out: { glucose: 10 }, t: 90 }, { out: { glucose: 30 }, t: 300 }] },
    mito: { name: '미토콘드리아 발전소', size: 1, cost: { coin: 300 }, desc: '미토콘드리아는 포도당을 분해해 생명 활동에 쓰는 에너지 ATP를 만들어요(세포 호흡).', fact: 'C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O + ATP',
      stack: [[0, 0, 1, 'building_windows_S'], [0, 0, 2, 'roof_roundPurple_S']], make: [{ in: { glucose: 2 }, out: { atp: 3 }, t: 30 }, { in: { glucose: 6 }, out: { atp: 10 }, t: 120 }] },
    ribo: { name: '리보솜 공방', size: 1, cost: { coin: 500, atp: 5 }, desc: '리보솜은 mRNA의 유전 정보를 읽어 아미노산을 이어 단백질을 만들어요.', fact: 'DNA → (전사) → mRNA → (번역, 리보솜) → 단백질',
      stack: [[0, 0, 1, 'building_door_S'], [0, 0, 2, 'roof_gableGreen_S']], make: [{ in: { glucose: 2, atp: 2 }, out: { protein: 2 }, t: 45 }, { in: { glucose: 5, atp: 6 }, out: { protein: 7 }, t: 180 }] },
    lib: { name: '유전자 도서관', size: 1, cost: { coin: 900, protein: 5 }, desc: 'DNA에는 생물의 특징을 결정하는 유전 정보가 담겨 있어요. 스킬을 강화하는 DNA를 연구해요.', fact: 'DNA = 이중 나선, 염기 A-T, G-C가 짝을 이뤄요',
      stack: [[0, 0, 1, 'building_doorWindowsBeige_S'], [0, 0, 2, 'roof_churchBeige_S']], make: [{ in: { atp: 4 }, out: { dna: 1 }, t: 90 }, { in: { atp: 10, protein: 2 }, out: { dna: 3 }, t: 240 }] },
    house: { name: '세포 마을 집', size: 1, cost: { coin: 150 }, desc: '주민이 사는 집. 시간이 지나면 세금(코인)이 쌓여요.', stack: [[0, 0, 1, 'building_doorWindows_S'], [0, 0, 2, 'roof_gableBrown_S']], tax: { coin: 18, t: 60 } },
    market: { name: '생명 시장', size: 1, cost: { coin: 400 }, desc: '자원을 코인으로 바꿔요.', stack: [[0, 0, 1, 'structure_arch_S'], [0, 0, 2, 'roof_slantBeige_S']], market: 1 },
    well: { name: '생명의 우물', size: 1, cost: { coin: 250 }, desc: '맑은 물이 솟는 우물. 왕국 매력이 올라가요(세금 +5%).', stack: [[0, 0, 1, 'well_S']], deco: 5 },
    tree: { name: '참나무', size: 1, cost: { coin: 40 }, desc: '나무는 광합성으로 산소를 내보내요. 매력 +1.', stack: [[0, 0, 1, 'tree_single_S']], deco: 1 },
    pine: { name: '소나무', size: 1, cost: { coin: 60 }, desc: '사계절 푸른 늘푸른나무. 매력 +1.', stack: [[0, 0, 1, 'tree_pineLarge_S']], deco: 1 },
    trees: { name: '작은 숲', size: 1, cost: { coin: 90 }, desc: '여러 나무가 모인 숲은 많은 생물의 서식지예요. 매력 +2.', stack: [[0, 0, 1, 'tree_multiple_S']], deco: 2 },
    fence: { name: '나무 울타리', size: 1, cost: { coin: 20 }, desc: '울타리. 매력 +0.5.', stack: [[0, 0, 1, 'fence_wood_S']], deco: 0.5 },
    pond: { name: '연못', size: 1, cost: { coin: 120 }, desc: '연못은 개구리·물고기·수생 식물이 사는 작은 생태계예요. 매력 +2.', ground: 'grass_water_N', stack: [], deco: 2 },
    tower: { name: '보초탑', size: 1, cost: { coin: 350 }, desc: '왕국을 지키는 탑. 매력 +3.', stack: [[0, 0, 1, 'castle_tower_S'], [0, 0, 2, 'castle_towerPurple_S']], deco: 3 }
  };
  D.BUILD_ORDER = ['farm', 'mito', 'ribo', 'lib', 'house', 'market', 'well', 'tree', 'pine', 'trees', 'pond', 'fence', 'tower'];
  D.limitOf = (k, castleLv) => ({ farm: 2 + castleLv, mito: 1 + Math.floor(castleLv / 2), ribo: 1 + Math.floor(castleLv / 3), lib: castleLv >= 2 ? 1 + Math.floor(castleLv / 4) : 0, house: 2 + castleLv * 2, market: 1, well: 2, tower: castleLv })[k] ?? 99;
  D.upCost = (k, lv) => ({ coin: Math.round((D.BUILD[k].cost.coin || 200) * (1 + lv * 0.9)), protein: lv >= 2 ? lv * 2 : 0 });
  D.castleUpCost = lv => ({ coin: 800 * lv * lv, protein: 6 * lv, dna: lv >= 3 ? lv * 2 : 0 });
  D.SELL = { glucose: 4, atp: 9, protein: 22, dna: 60 };
  // 뽑기
  D.GACHA = { one: 300, ten: 2700, rate: { C: 0.6, R: 0.3, E: 0.08, L: 0.02 } };
})();

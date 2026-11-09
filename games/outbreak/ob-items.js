/* 감염 도시 · 아이템, 영양, 보관함 전리품, 아이콘 */
(function () {
  'use strict';
  const OB = window.OB;
  // 영양소: carb 탄수화물, prot 단백질, fat 지방, vit 비타민·무기질 (0~3)
  //   hunger: 배고픔을 얼마나 줄이나, thirst: 목마름, spoil: 상하기까지 일 수, raw: 익혀 먹어야 안전
  const F = (name, model, w, hunger, thirst, nutr, spoil, note, extra) => Object.assign({ name, kind: 'food', model, w, hunger, thirst: thirst || 0, nutr, spoil, note }, extra || {});
  const ITEMS = OB.ITEMS = {
    // ---- 음식 (food kit) ----
    apple: F('사과', ['food', 'apple', .5], .2, 10, 3, { carb: 2, vit: 2 }, 7, '사과의 식이섬유와 비타민 C는 장내 세균과 면역세포가 일하는 데 도움을 줘요.'),
    banana: F('바나나', ['food', 'banana', .5], .2, 12, 1, { carb: 3, vit: 1 }, 4, '바나나의 칼륨은 신경과 근육이 신호를 전달할 때 필요해요.'),
    orange: F('오렌지', ['food', 'orange', .6], .2, 9, 5, { carb: 1, vit: 3 }, 8, '비타민 C는 백혈구가 병원체와 싸울 때 쓰는 항산화 물질이에요.'),
    carrot: F('당근', ['food', 'carrot', .4], .15, 7, 1, { carb: 1, vit: 3 }, 10, '당근의 베타카로틴은 비타민 A로 바뀌어 피부·점막 방어벽을 튼튼하게 해요.'),
    broccoli: F('브로콜리', ['food', 'broccoli', .4], .3, 8, 1, { vit: 3, prot: 1 }, 5, '채소의 비타민과 무기질은 면역 반응에 필요한 효소를 도와요.'),
    bread: F('식빵', ['food', 'loaf', .4], .4, 22, -2, { carb: 3 }, 5, '탄수화물은 포도당으로 분해되어 세포 호흡의 원료가 돼요.'),
    baguette: F('바게트', ['food', 'loaf-baguette', .4], .4, 24, -3, { carb: 3 }, 4, '빵의 녹말은 아밀레이스에 의해 엿당으로, 다시 포도당으로 소화돼요.'),
    cheese: F('치즈', ['food', 'cheese', .35], .3, 18, -1, { prot: 2, fat: 2 }, 20, '치즈는 젖산균이 우유를 발효시켜 만든 음식이에요.'),
    egg: F('달걀', ['food', 'egg', .8], .1, 9, 0, { prot: 3, fat: 1 }, 14, '날달걀에는 살모넬라균이 있을 수 있어 익혀 먹어야 안전해요.', { raw: true, cooked: 'eggCooked' }),
    eggCooked: F('달걀 프라이', ['food', 'egg-cooked', .5], .1, 12, 0, { prot: 3, fat: 1 }, 2, '열을 가하면 단백질이 변성되고 세균이 죽어요.'),
    meatRaw: F('생고기', ['food', 'meat-raw', .4], .4, 15, 0, { prot: 3, fat: 2 }, 2, '날고기의 세균은 75℃ 이상으로 익히면 대부분 죽어요.', { raw: true, cooked: 'meatCooked' }),
    meatCooked: F('구운 고기', ['food', 'meat-cooked', .4], .4, 32, -2, { prot: 3, fat: 2 }, 3, '단백질은 아미노산으로 분해되어 항체와 근육을 만드는 재료가 돼요.'),
    fish: F('생선', ['food', 'fish', .35], .5, 14, 0, { prot: 3, fat: 2 }, 2, '날생선에는 기생충이 있을 수 있으니 익혀 먹어요.', { raw: true, cooked: 'fishCooked' }),
    fishCooked: F('구운 생선', ['food', 'fish-bones', .35], .4, 28, -1, { prot: 3, fat: 2, vit: 1 }, 3, '생선의 오메가-3 지방산은 세포막을 이루는 재료예요.'),
    can: F('통조림 콩', ['food', 'can', .5], .5, 28, 2, { prot: 2, carb: 2 }, null, '통조림은 가열 살균 후 밀봉해 세균이 자라지 못해 오래 보관할 수 있어요.'),
    soup: F('통조림 수프', ['food', 'can-small', .6], .4, 22, 10, { carb: 1, prot: 1, vit: 1 }, null, '수프는 수분과 염분을 함께 보충해 줘요.'),
    candy: F('초코바', ['food', 'candy-bar', .7], .1, 12, -1, { carb: 3, fat: 1 }, null, '당분은 빠르게 흡수되어 혈당을 올리지만 금방 다시 배고파져요.'),
    chocolate: F('초콜릿', ['food', 'chocolate', .7], .1, 10, -1, { carb: 2, fat: 2 }, null, '초콜릿의 카페인 비슷한 물질(테오브로민)은 잠깐 기운을 북돋아요.', { fatigue: -3 }),
    cookie: F('쿠키', ['food', 'cookie', .8], .1, 8, -1, { carb: 2, fat: 1 }, 60, '가공식품은 오래 가지만 비타민이 적어요.'),
    chips: F('감자칩', ['food', 'bag-flat', .3], .2, 12, -4, { carb: 2, fat: 2 }, null, '짠 음식을 먹으면 혈액 농도가 높아져 목이 말라요.'),
    pizza: F('피자', ['food', 'pizza', .3], .6, 30, -2, { carb: 3, fat: 2, prot: 1 }, 2, '상온에 오래 둔 음식은 세균이 빠르게 늘어나요.'),
    burger: F('햄버거', ['food', 'burger', .45], .4, 30, -2, { carb: 2, prot: 2, fat: 2 }, 2, '고기·빵·채소가 함께 들어 있어 여러 영양소를 섭취할 수 있어요.'),
    sandwich: F('샌드위치', ['food', 'sandwich', .5], .3, 24, -1, { carb: 2, prot: 2, vit: 1 }, 2, '샌드위치처럼 여러 재료를 함께 먹으면 영양 균형이 좋아요.'),
    honey: F('꿀', ['food', 'honey', .45], .4, 10, 0, { carb: 3 }, null, '꿀은 당 농도가 높아 세균이 수분을 빼앗겨 잘 상하지 않아요.'),
    peanut: F('땅콩버터', ['food', 'peanut-butter', .5], .4, 26, -3, { prot: 2, fat: 3 }, null, '지방은 같은 양에서 탄수화물보다 두 배 넘는 에너지를 내요.'),
    cereal: F('시리얼', ['food', 'bowl-cereal', .4], .3, 16, 0, { carb: 3, vit: 1 }, 90, '곡물에는 탄수화물과 함께 비타민 B군이 들어 있어요.'),
    watermelon: F('수박', ['food', 'watermelon', .4], 1.5, 14, 25, { carb: 1, vit: 2 }, 5, '수박은 90% 이상이 물이라 수분 보충에 좋아요.'),
    pumpkin: F('호박', ['food', 'pumpkin', .4], 1.2, 12, 2, { carb: 2, vit: 3 }, 30, '호박도 베타카로틴이 풍부한 채소예요.', { raw: true, cooked: 'soup' }),
    corn: F('옥수수', ['food', 'corn', .45], .3, 10, 1, { carb: 3, vit: 1 }, 6, '옥수수는 녹말이 많은 곡물이에요.'),
    // ---- 마실 것 ----
    water: { name: '생수', kind: 'drink', model: ['food', 'soda-bottle', .5], w: .5, thirst: 40, hunger: 0, nutr: {}, note: '몸무게의 약 60%가 물이에요. 물은 체온을 조절하고 노폐물을 내보내요.' },
    dirtyWater: { name: '더러운 물', kind: 'drink', model: ['food', 'glass', .7], w: .5, thirst: 35, hunger: 0, nutr: {}, dirty: true, note: '끓이지 않은 물에는 세균·원생생물이 있을 수 있어 배탈이 날 수 있어요. 끓이면 안전해져요.', cooked: 'water' },
    soda: { name: '탄산음료', kind: 'drink', model: ['food', 'soda-can', .6], w: .35, thirst: 22, hunger: 3, nutr: { carb: 2 }, note: '탄산음료의 설탕은 갈증을 완전히 풀어 주지 못해요.' },
    milk: { name: '우유', kind: 'drink', model: ['food', 'carton', .45], w: 1, thirst: 25, hunger: 8, nutr: { prot: 2, fat: 1, vit: 1 }, spoil: 4, note: '우유는 저온 살균으로 병원균을 줄였지만 냉장 보관해야 해요.' },
    coffee: { name: '캔커피', kind: 'drink', model: ['food', 'cup-coffee', .7], w: .3, thirst: 15, hunger: 0, nutr: {}, fatigue: -20, note: '카페인은 졸음을 일으키는 아데노신의 작용을 막아 잠이 깨게 해요.' },
    juice: { name: '오렌지 주스', kind: 'drink', model: ['food', 'carton-small', .5], w: .4, thirst: 28, hunger: 4, nutr: { carb: 1, vit: 3 }, spoil: 10, note: '과일 주스에도 비타민 C가 들어 있어요.' },
    // ---- 의약품 ----
    bandage: { name: '붕대', kind: 'med', model: ['proto', 'shape-cylinder', .25], w: .1, use: 'bandage', note: '붕대로 상처를 덮으면 출혈이 멈추고 세균이 들어오는 것을 막아요.' },
    disinfect: { name: '소독약', kind: 'med', model: ['food', 'bottle-oil', .4], w: .3, use: 'disinfect', uses: 4, note: '알코올·과산화수소 소독약은 세균의 단백질과 세포막을 망가뜨려요. 바이러스 감염을 완전히 막지는 못해요.' },
    painkill: { name: '해열진통제', kind: 'med', model: ['food', 'shaker-salt', .7], w: .05, use: 'painkill', note: '해열제는 열을 내리고 통증을 줄이지만 병원체를 없애지는 않아요.' },
    antiviral: { name: '항바이러스제', kind: 'med', model: ['food', 'shaker-pepper', .7], w: .05, use: 'antiviral', note: '항바이러스제는 바이러스가 세포 안에서 복제되는 과정을 방해해 증식을 늦춰요.' },
    vitamin: { name: '종합 비타민', kind: 'med', model: ['food', 'egg-cup', .6], w: .05, use: 'vitamin', note: '비타민이 부족하면 면역 기능이 떨어질 수 있어요.' },
    mask: { name: '마스크', kind: 'wear', model: ['proto', 'shape-cube-half', .3], w: .05, slot: 'face', def: .15, note: '마스크는 비말(침방울)을 막아 호흡기 감염 위험을 줄여요.' },
    syringe: { name: '주사기', kind: 'tool', model: ['food', 'chopstick', .6], w: .05, note: '감염자의 혈액 샘플을 모으는 데 필요해요.' },
    // ---- 무기 ----   dmg 피해, rng 거리, arc 각도(도), spd 휘두르는 시간, kd 넘어뜨릴 확률, dur 내구도
    fists: { name: '맨손', kind: 'weapon', w: 0, dmg: 6, rng: 1.0, arc: 70, spd: .42, kd: .1, dur: Infinity, noise: 3 },
    golfclub: { name: '골프채', kind: 'weapon', model: ['golf', 'club-red', 1.6], w: 1.2, dmg: 26, rng: 1.75, arc: 110, spd: .62, kd: .35, dur: 40, noise: 6, hold: ['golf', 'club-red', 1.25, 1.584, -1.157, -1.379, 0, 0, 0], two: true, note: '긴 무기는 거리를 두고 싸울 수 있어요.' },
    rollingpin: { name: '밀대', kind: 'weapon', model: ['food', 'rollingPin', 1], w: .8, dmg: 18, rng: 1.35, arc: 90, spd: .5, kd: .3, dur: 35, noise: 5, hold: ['food', 'rollingPin', 1, -0.163, -0.077, 1.977, 0, 0, 0] },
    pan: { name: '프라이팬', kind: 'weapon', model: ['food', 'frying-pan', .9], w: 1.2, dmg: 22, rng: 1.3, arc: 90, spd: .55, kd: .45, dur: 60, noise: 9, hold: ['food', 'frying-pan', .9, -1.766, -0.405, 1.488, 0.195, -0.446, 0.088], note: '프라이팬은 요리에도 쓸 수 있어요.' },
    knife: { name: '식칼', kind: 'weapon', model: ['food', 'cooking-knife', 1], w: .3, dmg: 20, rng: 1.05, arc: 60, spd: .32, kd: .05, dur: 25, noise: 2, hold: ['food', 'cooking-knife', 1, -0.163, -0.077, 1.977, 0.079, -0.18, 0.036] },
    cleaver: { name: '중식도', kind: 'weapon', model: ['food', 'cooking-knife-chopping', 1], w: .6, dmg: 28, rng: 1.1, arc: 70, spd: .42, kd: .1, dur: 30, noise: 3, hold: ['food', 'cooking-knife-chopping', 1, -0.163, -0.077, 1.977, 0.059, -0.135, 0.027] },
    pipe: { name: '쇠파이프', kind: 'weapon', model: ['proto', 'pipe', .9], w: 2, dmg: 30, rng: 1.6, arc: 100, spd: .7, kd: .5, dur: 80, noise: 8, hold: ['proto', 'pipe', .9, 2.979, 0.077, 2.735, 0.043, -0.097, 0.019], two: true },
    sword: { name: '연습용 목검', kind: 'weapon', model: ['proto', 'weapon-sword', 1.2], w: 1, dmg: 24, rng: 1.6, arc: 100, spd: .5, kd: .25, dur: 50, noise: 5, hold: ['proto', 'weapon-sword', 1.2, -0.163, -0.077, 1.977, 0.057, -0.13, 0.026] },
    tenderizer: { name: '고기망치', kind: 'weapon', model: ['food', 'meat-tenderizer', 1], w: .9, dmg: 20, rng: 1.2, arc: 80, spd: .48, kd: .4, dur: 70, noise: 6, hold: ['food', 'meat-tenderizer', 1, -0.163, -0.077, 1.977, 0.059, -0.135, 0.027], tool: 'hammer', note: '바리케이드를 칠 때 망치로도 쓸 수 있어요.' },
    shield: { name: '방패', kind: 'wear', model: ['proto', 'weapon-shield', 1], w: 2, slot: 'off', def: .35, note: '물림·할큄을 막아 줄 확률이 올라가요.' },
    // 다트 블래스터: 진정제 다트를 쏴서 감염자를 쓰러뜨림 (시끄러움)
    blasterA: { name: '다트 권총', kind: 'gun', model: ['blaster', 'blaster-b', 1.4], w: .8, dmg: 34, rng: 13, rate: .38, mag: 8, ammo: 'darts', noise: 22, hold: ['blaster', 'blaster-b', 1.4, 1.807, -0.031, 1.431, 0, 0, 0], note: '진정제 다트로 감염자를 재워요. 소리가 커서 주변 감염자가 몰려와요.' },
    blasterB: { name: '다트 소총', kind: 'gun', model: ['blaster', 'blaster-e', 1.1], w: 2.4, dmg: 55, rng: 18, rate: .7, mag: 5, ammo: 'darts', noise: 30, hold: ['blaster', 'blaster-e', 1.1, -1.334, 0.031, 1.711, 0, 0, 0], two: true },
    blasterC: { name: '연사 블래스터', kind: 'gun', model: ['blaster', 'blaster-p', 1.1], w: 2, dmg: 22, rng: 12, rate: .14, mag: 20, ammo: 'darts', noise: 26, hold: ['blaster', 'blaster-p', 1.1, 1.807, -0.031, 1.431, 0, 0, 0], two: true },
    darts: { name: '진정제 다트', kind: 'ammo', model: ['blaster', 'clip-small', 2], w: .02, stack: true },
    // ---- 도구·재료 ----
    planks: { name: '판자', kind: 'mat', model: ['town', 'planks-half', .7], w: 1, stack: true, note: '문·창문에 박아 바리케이드를 만들어요 (망치 + 못 필요).' },
    nails: { name: '못', kind: 'mat', model: ['car', 'debris-bolt', 1.2], w: .01, stack: true },
    hammer: { name: '망치', kind: 'tool', model: ['food', 'meat-tenderizer', 1], w: .8, tool: 'hammer' },
    lantern: { name: '랜턴', kind: 'tool', model: ['holiday', 'lantern', .5], w: .6, light: true, note: '밤에는 들고 다니면 주변이 밝아져요. 감염자에게도 잘 보여요.' },
    bag: { name: '배낭', kind: 'bag', model: ['food', 'bag', .6], w: .6, cap: 12, note: '들 수 있는 무게가 늘어나요.' },
    bigbag: { name: '등산 배낭', kind: 'bag', model: ['food', 'bag', .8], w: 1, cap: 20 },
    pot: { name: '냄비', kind: 'tool', model: ['food', 'pot', .5], w: 1, tool: 'pot', note: '모닥불·가스레인지에서 물을 끓이거나 요리할 때 써요.' },
    gascan: { name: '빈 연료통', kind: 'tool', model: ['car', 'box', .6], w: 1, note: '주유기에서 연료를 채울 수 있어요.' },
    fuel: { name: '연료통(가득)', kind: 'quest', model: ['car', 'box', .6], w: 5, note: '보트를 움직이는 데 필요해요.' },
    radio: { name: '휴대용 라디오', kind: 'tool', model: ['station', 'computer', .5], w: .5, use: 'radio', note: '긴급 방송을 들을 수 있어요.' },
    matches: { name: '성냥', kind: 'tool', model: ['food', 'chopstic-decorative', .6], w: .05, tool: 'fire', uses: 10 },
    // ---- 이야기 아이템 ----
    keycard: { name: '연구소 출입 카드', kind: 'quest', model: ['proto', 'indicator-square-a', .4], w: .01, note: '바이러스 연구소의 잠긴 문을 열 수 있어요.' },
    notes: { name: '연구 노트', kind: 'quest', model: ['food', 'cutting-board', .3], w: .2, note: '바이러스와 백신에 대한 연구 기록.' },
    sample: { name: '감염자 혈액 샘플', kind: 'quest', model: ['food', 'popsicle-stick', .8], w: .05, stack: true, note: '항체를 만드는 데 필요한 바이러스 표본이에요.' },
    medium: { name: '세포 배양액', kind: 'quest', model: ['food', 'bottle-oil', .4], w: .5, note: '바이러스를 키워 약하게 만드는 데 쓰는 영양액이에요.' },
    vaccine: { name: '백신', kind: 'med', model: ['food', 'popsicle', .6], w: .05, use: 'vaccine', note: '약하게 만든 바이러스(항원)를 넣어 우리 몸이 미리 항체와 기억세포를 만들게 해요.' },
    boatkey: { name: '보트 열쇠', kind: 'quest', model: ['car', 'debris-nut', 1.5], w: .01, note: '항구에 묶인 쾌속정 열쇠.' }
  };
  for (const k in ITEMS) ITEMS[k].id = k;
  OB.item = (id, n) => { const d = ITEMS[id]; const it = { id, n: n || 1 }; if (d.dur && d.dur !== Infinity) it.dur = d.dur; if (d.mag) it.ammo = 0; if (d.uses) it.uses = d.uses; if (d.spoil) it.age = 0; return it; };
  OB.weightOf = it => (ITEMS[it.id].w || 0) * (ITEMS[it.id].stack ? it.n : 1);

  // ---------------- 보관함 전리품 ----------------
  const LOOT = {
    fridge: [['milk', 3], ['cheese', 3], ['egg', 3], ['meatRaw', 2], ['juice', 2], ['water', 3], ['soda', 2], ['apple', 2], ['carrot', 2], ['broccoli', 1], ['pizza', 1], ['sandwich', 1], ['fish', 1]],
    freezer: [['meatRaw', 3], ['fish', 2], ['pizza', 2], ['water', 3], ['soda', 3], ['juice', 2], ['milk', 1]],
    counter: [['bread', 2], ['can', 3], ['soup', 2], ['cereal', 2], ['honey', 1], ['peanut', 1], ['knife', 1], ['rollingpin', 1], ['pan', 1], ['pot', 1], ['matches', 2], ['cleaver', .5], ['tenderizer', .6], ['water', 2]],
    shelf: [['can', 4], ['soup', 3], ['chips', 3], ['candy', 3], ['chocolate', 2], ['cookie', 2], ['cereal', 2], ['water', 3], ['soda', 3], ['coffee', 2], ['bread', 2], ['peanut', 1], ['honey', 1], ['bandage', 1], ['batteries', 0]],
    cabinet: [['bandage', 2], ['painkill', 2], ['disinfect', 1], ['vitamin', 1], ['mask', 1], ['planks', 1], ['nails', 1], ['lantern', 1], ['bag', 1], ['matches', 1], ['radio', .4]],
    desk: [['candy', 1], ['coffee', 1], ['painkill', 1], ['radio', .5], ['lantern', .5], ['matches', 1]],
    register: [['candy', 2], ['chocolate', 2], ['soda', 1], ['coffee', 1]],
    medcab: [['bandage', 4], ['disinfect', 3], ['painkill', 3], ['antiviral', 1.5], ['vitamin', 2], ['mask', 3], ['syringe', 2]],
    locker: [['darts', 3], ['blasterA', 1], ['bandage', 1], ['mask', 1], ['shield', .5], ['lantern', 1], ['pipe', .4], ['bag', .6]],
    crate: [['planks', 3], ['nails', 3], ['pipe', 1], ['hammer', 1], ['gascan', .8], ['water', 1], ['can', 1], ['tenderizer', .5], ['darts', .5], ['bag', .3]],
    toolbox: [['hammer', 2], ['nails', 3], ['planks', 2], ['pipe', 1], ['gascan', 1], ['lantern', .5], ['matches', 1]],
    dumpster: [['planks', 2], ['dirtyWater', 1], ['pipe', .5], ['nails', 1], ['chips', 1], ['soda', .5]],
    car: [['water', 1], ['candy', 1], ['gascan', .6], ['bandage', .6], ['bag', .4], ['lantern', .4], ['golfclub', .2], ['coffee', .5]],
    bag: [['water', 2], ['can', 2], ['matches', 1], ['lantern', .8], ['bandage', 1], ['bigbag', .5], ['knife', .5], ['fish', .5], ['chocolate', 1]],
    stall: [['soda', 3], ['water', 2], ['candy', 2], ['burger', 1], ['pizza', 1], ['chips', 2], ['coffee', 1], ['juice', 1]],
    mil: [['darts', 4], ['blasterB', .5], ['blasterC', .4], ['bandage', 2], ['antiviral', .7], ['can', 2], ['water', 2], ['mask', 1], ['shield', .5], ['bigbag', .5]],
    lab: [['syringe', 1], ['disinfect', 1], ['mask', 1], ['antiviral', .8], ['medium', .7]],
    golfbag: [['golfclub', 2], ['water', 1]],
    pump: [], mail: [['candy', .5]]
  };
  OB.LOOT = LOOT;
  OB.fillContainer = function (c, R) {
    if (c.items) return c.items;
    const tab = LOOT[c.kind] || []; const items = [];
    for (const [id, w] of tab) { if (!ITEMS[id]) continue; let n = Math.floor(w * (0.25 + R() * 0.55)) + (R() < (w % 1 || 0.3) * 0.5 ? 1 : 0); if (n <= 0) continue; if (ITEMS[id].stack) items.push(Object.assign(OB.item(id, id === 'darts' ? n * 6 : id === 'nails' ? n * 8 : n * 2))); else for (let k = 0; k < n; k++) { const it = OB.item(id); if (it.age != null) it.age = R() * 2; if (ITEMS[id].kind === 'gun') it.ammo = Math.floor(ITEMS[id].mag * R()); items.push(it); } }
    if (items.length > 9) items.length = 9;
    return c.items = items;
  };

  // ---------------- 아이콘 (3D 모델을 작은 그림으로) ----------------
  const ICON = {};
  let iconR = null, iconS = null, iconC = null;
  OB.icon = function (id) {
    if (ICON[id]) return ICON[id];
    const d = ITEMS[id]; if (!d || !d.model) return ICON[id] = '';
    try {
      if (!iconR) {
        iconR = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); iconR.setSize(96, 96); iconR.outputEncoding = THREE.sRGBEncoding;
        iconS = new THREE.Scene(); iconS.add(new THREE.HemisphereLight('#ffffff', '#8a8a9a', 1.05)); const dl = new THREE.DirectionalLight('#fff', .6); dl.position.set(2, 3, 2); iconS.add(dl);
        iconC = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
      }
      const [k, m] = d.model; if (!OBA.kits[k] || !OBA.kits[k].ok) return '';
      const g = OBA.mesh(k, m); g.rotation.set(0.35, 0.7, 0); iconS.add(g);
      const box = new THREE.Box3().setFromObject(g), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z);
      iconC.position.set(c.x, c.y + r * 0.2, c.z + r * 2.1); iconC.lookAt(c);
      iconR.render(iconS, iconC); const url = iconR.domElement.toDataURL(); iconS.remove(g);
      return ICON[id] = url;
    } catch (e) { return ICON[id] = ''; }
  };
})();

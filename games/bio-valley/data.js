// 바이오 밸리: 건물·기술·목표 자료. 돈 단위는 '코인'. 하루 = 1.5초(1배속), 한 달 = 20일.
export const DAY_SEC = 1.5, MONTH_DAYS = 20;
export const START_MONEY = 15000, ROAD_COST = 15, CLEAR_COST = 10, SALARY = 6, RAW_PRICE = 2;

export const CATS = [
  { id: 'road', name: '도로', icon: 'road' },
  { id: 'home', name: '주거', icon: 'home' },
  { id: 'farm', name: '생산', icon: 'leaf' },
  { id: 'factory', name: '가공', icon: 'factory' },
  { id: 'lab', name: '연구', icon: 'flask' },
  { id: 'life', name: '편의', icon: 'heart' },
  { id: 'deco', name: '조경', icon: 'tree' },
];

// size: 칸 수(정사각), jobs: 일자리, res: 주민 수(단계별), prod: 바이오매스/일, use: 바이오매스 사용/일, val: 원료 1개당 판매가,
// rev: 하루 수입(일손 100% 기준), rp: 연구 점수/일, pol: 오염, polR: 오염 반경(칸), hap: 행복 보너스, hapR: 반경, store: 저장량
export const BUILD = {
  house: { name: '연구원 숙소', cat: 'home', size: 1, cost: 300, upkeep: 4, res: [0, 4, 9, 15], road: true, model: 'house',
    desc: '바이오 밸리에서 일하는 사람들이 사는 집이에요. 주변이 쾌적하면 2층, 3층으로 커져요.',
    sci: '사람도 생태계의 일부! 공원·나무가 가까우면 스트레스 호르몬(코르티솔)이 줄어든다는 연구가 있어요.' },
  apartment: { name: '바이오 아파트', cat: 'home', size: 2, cost: 2400, upkeep: 30, res: [0, 36], road: true, model: 'apartment', tech: 'apart',
    desc: '많은 주민이 사는 큰 집. 옥상 정원과 태양광 패널이 있어요.', sci: '옥상 정원은 식물의 증산 작용으로 건물 온도를 낮춰 줘요.' },
  greenhouse: { name: '온실 농장', cat: 'farm', size: 2, cost: 800, upkeep: 20, jobs: 3, prod: 3, road: true, model: 'greenhouse', pol: 0.05, polR: 2,
    desc: '작물을 길러 바이오매스(원료)를 만들어요.', sci: '식물은 광합성으로 빛 에너지를 포도당에 저장해요: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂' },
  mushroom: { name: '버섯 재배사', cat: 'farm', size: 2, cost: 900, upkeep: 22, jobs: 3, prod: 3.4, road: true, model: 'mushroom', pol: 0.05, polR: 2, biome: 'autumn',
    desc: '나무 부스러기에서 버섯을 키워 원료를 만들어요.', sci: '버섯은 균류! 광합성 대신 셀룰로오스를 분해해 양분을 얻는 분해자예요.' },
  forestry: { name: '산림 바이오매스', cat: 'farm', size: 2, cost: 700, upkeep: 18, jobs: 3, prod: 3, road: true, model: 'forestry', pol: 0.1, polR: 3, biome: 'pine', needTrees: true,
    desc: '솎아 낸 나무와 가지를 모아 원료로 써요. 주변에 나무가 많을수록 잘돼요.', sci: '나무의 셀룰로오스는 지구에서 가장 흔한 유기물이에요.' },
  algae: { name: '미세조류 배양장', cat: 'farm', size: 3, cost: 2600, upkeep: 50, jobs: 5, prod: 10, road: true, model: 'algae', pol: 0.02, polR: 2, tech: 'algae',
    desc: '유리관 속에서 미세조류를 길러 많은 원료를 만들어요.', sci: '클로렐라 같은 미세조류는 빠르게 자라며 기름(지질)을 많이 품어 바이오 연료가 돼요.' },
  ferment: { name: '발효 공장', cat: 'factory', size: 2, cost: 1800, upkeep: 60, jobs: 5, use: 4, val: 15, road: true, model: 'ferment', pol: 0.35, polR: 4, chimney: [[-2.3, 7.2, -1.3]],
    desc: '원료로 요구르트·김치 스타터를 만들어 팔아요.', sci: '젖산균은 산소 없이 포도당을 젖산으로 바꿔요(젖산 발효). 그래서 요구르트가 새콤해요.' },
  enzyme: { name: '효소 공장', cat: 'factory', size: 2, cost: 2600, upkeep: 80, jobs: 6, use: 5, val: 19, road: true, model: 'enzyme', pol: 0.4, polR: 4, tech: 'enzyme', chimney: [[3.3, 7.6, -2]],
    desc: '세제·식품에 쓰는 효소를 만들어요.', sci: '효소는 단백질 촉매! 기질과 꼭 맞는 모양(활성 부위)에 결합해 반응을 빠르게 해요.' },
  plastic: { name: '바이오 플라스틱 공장', cat: 'factory', size: 3, cost: 4600, upkeep: 120, jobs: 8, use: 8, val: 22, road: true, model: 'plastic', pol: 0.5, polR: 5, tech: 'plastic', chimney: [[5.8, 9, -4.6]],
    desc: '옥수수·조류 원료로 썩는 플라스틱(PLA)을 만들어요.', sci: 'PLA는 미생물이 분해할 수 있는 고분자예요. 석유 대신 식물 녹말에서 만들어요.' },
  biofuel: { name: '바이오 연료 정제소', cat: 'factory', size: 3, cost: 5200, upkeep: 140, jobs: 8, use: 10, val: 21, road: true, model: 'biofuel', pol: 0.6, polR: 6, tech: 'biofuel', chimney: [[2.5, 10.8, -3.5]],
    desc: '원료를 발효해 에탄올·바이오디젤을 만들어요.', sci: '효모는 포도당을 에탄올과 이산화탄소로 바꿔요(알코올 발효).' },
  lab: { name: '연구소', cat: 'lab', size: 2, cost: 1500, upkeep: 40, jobs: 4, rp: 3, road: true, model: 'lab',
    desc: '연구 점수를 모아 새 기술과 건물을 열어요. 옥상의 커다란 현미경이 상징!', sci: '광학 현미경은 빛과 렌즈로 세포를 1000배까지 크게 봐요.' },
  genome: { name: '유전체 분석 센터', cat: 'lab', size: 2, cost: 4000, upkeep: 100, jobs: 6, rev: 150, rp: 1, road: true, model: 'genome', tech: 'genome',
    desc: 'DNA 염기서열을 읽어 주는 서비스로 돈을 벌어요.', sci: 'DNA는 A·T·G·C 네 염기의 순서로 유전 정보를 담아요. A는 T와, G는 C와 짝을 지어요.' },
  vaccine: { name: '백신 연구소', cat: 'lab', size: 3, cost: 9000, upkeep: 220, jobs: 10, rev: 360, rp: 2, road: true, model: 'vaccine', tech: 'vaccine',
    desc: '감염병을 막는 백신을 개발하고 생산해요.', sci: '백신은 약하게 만든 항원을 보여 주어 B세포가 항체를, 기억 세포가 기억을 만들게 해요.' },
  seedbank: { name: '종자 은행', cat: 'lab', size: 2, cost: 3000, upkeep: 60, jobs: 4, rev: 90, rp: 1, road: true, model: 'seedbank', tech: 'seed',
    desc: '여러 식물의 씨앗을 차갑게 보관해 생물 다양성을 지켜요.', sci: '씨앗은 건조하고 차가운 곳(-18℃)에서 수십~수백 년 살아 있을 수 있어요.' },
  waste: { name: '폐기물 처리장', cat: 'factory', size: 2, cost: 1200, upkeep: 40, jobs: 3, clean: 0.6, cleanR: 7, road: true, model: 'waste',
    desc: '주변 오염을 줄여요. 음식물 쓰레기는 미생물이 분해해 퇴비가 돼요.', sci: '혐기성 미생물은 유기물을 분해해 메테인(바이오가스)을 만들어요.' },
  water: { name: '정수장', cat: 'farm', size: 2, cost: 1000, upkeep: 30, jobs: 2, waterR: 9, road: true, model: 'water', tech: 'water',
    desc: '깨끗한 물을 공급해 근처 생산 시설이 잘 돌아가게 해요.', sci: '정수장에서는 미생물막(생물막)이 물속 유기물을 먹어 치워요.' },
  depot: { name: '물류 센터', cat: 'factory', size: 2, cost: 900, upkeep: 20, jobs: 2, store: 150, road: true, model: 'depot',
    desc: '원료를 더 많이 쌓아 둘 수 있어요(+150). 남는 원료는 헐값에 팔려요.', sci: '원료가 상하지 않게 온도·습도를 조절해 보관해요.' },
  cafe: { name: '바이오 카페', cat: 'life', size: 1, cost: 400, upkeep: 8, jobs: 2, rev: 6, hap: 10, hapR: 4, road: true, model: 'cafe',
    desc: '주민들이 쉬어 가는 카페. 주변 집의 행복이 올라요.', sci: '커피의 카페인은 아데노신 수용체를 막아 졸음을 쫓아요.' },
  park: { name: '작은 공원', cat: 'life', size: 1, cost: 150, upkeep: 2, hap: 8, hapR: 3, model: 'park',
    desc: '연못과 벤치가 있는 쉼터. 주변 집의 행복이 올라요.', sci: '연못에는 플랑크톤·수생 곤충·개구리가 사는 작은 생태계가 있어요.' },
  clinic: { name: '보건소', cat: 'life', size: 2, cost: 1600, upkeep: 40, jobs: 4, hap: 16, hapR: 7, road: true, model: 'clinic', tech: 'health',
    desc: '주민의 건강을 지켜요. 넓은 범위의 행복이 올라요.', sci: '손 씻기만 잘해도 감염병의 상당수를 막을 수 있어요.' },
  school: { name: '과학 학교', cat: 'life', size: 2, cost: 2000, upkeep: 50, jobs: 5, hap: 8, hapR: 8, research: 1.3, road: true, model: 'school', tech: 'school',
    desc: '과학 교육으로 도시 전체의 연구 속도를 30% 높여요(여러 개를 지어도 한 번만).', sci: '' },
  plaza: { name: 'DNA 광장', cat: 'life', size: 2, cost: 900, upkeep: 10, hap: 12, hapR: 5, model: 'plaza', tech: 'plaza',
    desc: '이중 나선 조형물이 있는 광장. 주변이 활기차져요.', sci: 'DNA 이중 나선은 한 바퀴에 염기쌍이 약 10개, 3.4nm 길이예요.' },
  // 조경(작은 장식, 1칸에 1개)
  tree: { name: '나무 심기', cat: 'deco', size: 1, cost: 20, deco: true, hap: 2, hapR: 2, model: 'decoTree', desc: '나무는 그늘을 만들고 이산화탄소를 흡수해요.' },
  flowerbed: { name: '꽃밭', cat: 'deco', size: 1, cost: 30, upkeep: 0, hap: 3, hapR: 2, model: 'flowerbed', desc: '꿀벌과 나비가 찾아오는 꽃밭.' },
  bench: { name: '벤치', cat: 'deco', size: 1, cost: 25, hap: 1, hapR: 2, model: 'bench', desc: '쉬어 가는 의자.' },
  lamp: { name: '가로등', cat: 'deco', size: 1, cost: 25, hap: 1, hapR: 2, model: 'lamp', desc: '밤길을 밝혀요.' },
};
export const ORDER = {
  home: ['house', 'apartment'],
  farm: ['greenhouse', 'mushroom', 'forestry', 'algae', 'water'],
  factory: ['ferment', 'enzyme', 'plastic', 'biofuel', 'depot', 'waste'],
  lab: ['lab', 'genome', 'seedbank', 'vaccine'],
  life: ['park', 'cafe', 'plaza', 'clinic', 'school'],
  deco: ['tree', 'flowerbed', 'bench', 'lamp'],
};

export const TECH = [
  { id: 'enzyme', name: '효소 공학', cost: 90, unlock: ['enzyme'], sci: '효소는 반응이 일어나는 데 필요한 에너지(활성화 에너지)를 낮춰요.' },
  { id: 'health', name: '보건 복지', cost: 100, unlock: ['clinic'], sci: '예방 접종과 위생은 집단 면역을 만들어요.' },
  { id: 'water', name: '수처리', cost: 90, unlock: ['water'], sci: '물속 미생물을 걸러 내고 소독해 마실 물을 만들어요.' },
  { id: 'school', name: '과학 교육', cost: 125, unlock: ['school'], sci: '관찰 → 가설 → 실험 → 결론, 탐구의 순서를 배워요.' },
  { id: 'plaza', name: '광장 설계', cost: 110, unlock: ['plaza'], sci: '왓슨과 크릭은 1953년 DNA 이중 나선 구조를 밝혔어요.' },
  { id: 'algae', name: '미세조류 배양', cost: 160, unlock: ['algae'], sci: '미세조류는 육지 식물보다 수십 배 빨리 자랄 수 있어요.' },
  { id: 'genome', name: '유전체 해독', cost: 180, unlock: ['genome'], sci: '사람 유전체는 약 30억 개의 염기쌍으로 이루어져 있어요.' },
  { id: 'apart', name: '고밀도 주거', cost: 200, unlock: ['apartment'], sci: '좁은 땅에 많이 모여 살면 숲을 더 많이 지킬 수 있어요.' },
  { id: 'plastic', name: '생분해 소재', cost: 215, unlock: ['plastic'], sci: '생분해 플라스틱은 퇴비 속 미생물이 물과 이산화탄소로 분해해요.' },
  { id: 'smartfarm', name: '스마트 농업', cost: 235, effect: { prod: 1.2 }, sci: '센서로 빛·온도·습도를 조절하면 작물이 더 잘 자라요. (생산 +20%)' },
  { id: 'seed', name: '종자 보존', cost: 235, unlock: ['seedbank'], sci: '노르웨이 스발바르 국제 종자 저장고에는 100만 종 넘는 씨앗이 있어요.' },
  { id: 'green', name: '친환경 공정', cost: 270, effect: { pol: 0.7 }, sci: '폐열과 부산물을 다시 쓰면 오염이 줄어요. (오염 -30%)' },
  { id: 'biofuel', name: '바이오 연료', cost: 305, unlock: ['biofuel'], sci: '바이오 연료가 탈 때 나오는 CO₂는 식물이 자라며 흡수한 것이에요.' },
  { id: 'auto', name: '공정 자동화', cost: 360, effect: { jobs: 0.8 }, sci: '로봇이 반복 작업을 맡아 필요한 일손이 줄어요. (일자리 -20%)' },
  { id: 'vaccine', name: '백신 플랫폼', cost: 470, unlock: ['vaccine'], sci: 'mRNA 백신은 세포가 항원 단백질을 직접 만들게 해요.' },
  { id: 'crispr', name: '유전자 가위', cost: 575, effect: { rev: 1.25 }, sci: 'CRISPR-Cas9은 원하는 DNA 자리를 정확히 잘라 고쳐요. (모든 수입 +25%)' },
];
export const START_UNLOCK = ['house', 'greenhouse', 'ferment', 'lab', 'waste', 'depot', 'cafe', 'park', 'tree', 'flowerbed', 'bench', 'lamp'];
export const BIOME_UNLOCK = { autumn: ['mushroom'], pine: ['forestry'], desert: ['water', 'algae'], snow: ['seedbank'], spring: ['plaza'] };

export const LEVELS = [
  { pop: 0, name: '개척지' }, { pop: 30, name: '작은 마을' }, { pop: 100, name: '바이오 마을' }, { pop: 220, name: '바이오 소도시' },
  { pop: 400, name: '바이오 시티' }, { pop: 700, name: '바이오 메트로폴리스' },
];
export const GOAL = { pop: 300, value: 40000, years: 4 };
export const MILESTONES = [
  { id: 'road', text: '입구에서 도로를 5칸 이상 깔기', check: (s) => s.roadCount >= 6, reward: 300 },
  { id: 'house2', text: '연구원 숙소 3채 짓기', check: (s) => s.count('house') + s.count('apartment') >= 3, reward: 400 },
  { id: 'farm', text: '생산 시설(온실 등) 짓기', check: (s) => s.catCount('farm') >= 1, reward: 400 },
  { id: 'factory', text: '가공 시설(발효 공장 등) 짓기', check: (s) => s.count('ferment') + s.count('enzyme') + s.count('plastic') + s.count('biofuel') >= 1, reward: 600 },
  { id: 'lab', text: '연구소 짓고 기술 1개 연구하기', check: (s) => s.techDone.size >= 1, reward: 600 },
  { id: 'pop50', text: '인구 50명', check: (s) => s.pop >= 50, reward: 800 },
  { id: 'happy', text: '평균 행복 70 이상', check: (s) => s.pop >= 20 && s.happy >= 70, reward: 800 },
  { id: 'tech4', text: '기술 4개 연구', check: (s) => s.techDone.size >= 4, reward: 1000 },
  { id: 'pop150', text: '인구 150명', check: (s) => s.pop >= 150, reward: 1500 },
  { id: 'land', text: '땅 한 구역 더 사기', check: (s) => s.landBought >= 1, reward: 800 },
  { id: 'big', text: '3×3 대형 시설 짓기', check: (s) => ['algae', 'plastic', 'biofuel', 'vaccine'].some((k) => s.count(k) > 0), reward: 2000 },
  { id: 'pop300', text: '인구 300명', check: (s) => s.pop >= 300, reward: 3000 },
];
export const NAMES = ['지우', '서연', '민준', '하은', '도윤', '수아', '예준', '지호', '서윤', '하준', '유나', '시우', '채원', '주원', '다은', '건우', '소율', '은호', '나연', '태오', '아린', '로아', '이안', '윤슬'];

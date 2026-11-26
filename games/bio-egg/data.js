// 바이오 알 도둑: 알·생물·돌연변이·업그레이드·트레일·이벤트 자료
export const RAR = [
  { id: 'c', name: '흔함', col: '#9aa4ad' }, { id: 'u', name: '드묾', col: '#5fbf6a' }, { id: 'r', name: '희귀', col: '#4f8fe0' },
  { id: 'e', name: '영웅', col: '#a46ae8' }, { id: 'l', name: '전설', col: '#f0a830' }, { id: 'm', name: '신화', col: '#ef5a6a' }, { id: 's', name: '비밀', col: '#2ad0c0' },
];
// 알 7종: zone = 놓이는 고리(0 바깥 ~ 3 중심), hatch = 부화 시간(초), jump = 받침대 높이(필요 점프)
export const EGGS = [
  { id: 'amph', name: '양서류 알', tier: 0, hatch: 10, col: '#7fd07a', col2: '#c8f0a0', spots: '#2a6a2a', jelly: true, zone: 0,
    fact: '개구리 알은 투명한 젤리 같은 막에 싸여 물속에 낳아요. 껍데기가 없어서 마르면 안 돼요.' },
  { id: 'bird', name: '조류 알', tier: 1, hatch: 20, col: '#f2e6d0', col2: '#ffffff', spots: '#8a6a4a', zone: 0,
    fact: '새의 알은 탄산칼슘 껍데기에 작은 구멍(기공)이 수천 개 있어 숨을 쉬어요.' },
  { id: 'rept', name: '파충류 알', tier: 2, hatch: 40, col: '#e8dcc0', col2: '#f6efe0', spots: '#b8a080', zone: 1, leathery: true,
    fact: '거북·뱀의 알은 가죽처럼 말랑한 껍데기예요. 거북은 모래 온도로 암수가 정해져요.' },
  { id: 'fish', name: '어류 알', tier: 3, hatch: 70, col: '#ff8a3a', col2: '#ffd08a', spots: '#c04a1a', roe: true, zone: 1, jump: 3,
    fact: '연어는 태어난 강으로 돌아와 알을 낳아요. 한 번에 수천 개의 알을 낳아요.' },
  { id: 'mono', name: '단공류 알', tier: 4, hatch: 120, col: '#d8c8a8', col2: '#f2e8d4', spots: '#7a6040', zone: 2, jump: 5,
    fact: '오리너구리와 바늘두더지는 알을 낳는 포유류(단공류)예요. 새끼는 젖을 먹고 자라요.' },
  { id: 'dino', name: '공룡 화석 알', tier: 5, hatch: 200, col: '#a88a6a', col2: '#d8c0a0', spots: '#5a4030', cracks: true, zone: 2, jump: 7,
    fact: '공룡도 알을 낳았어요. 몽골·중국에서 둥지 째 발견된 화석 알이 많아요.' },
  { id: 'gene', name: '유전자 합성 알', tier: 6, hatch: 320, col: '#7af0e0', col2: '#e0fffa', spots: '#2a80c0', glow: true, zone: 3, jump: 9,
    fact: 'DNA를 자르고 붙이는 유전자 재조합 기술로 새로운 특징을 가진 생물을 연구해요.' },
];
// 생물 28종: egg = 나오는 알, r = 희귀도(0~6), w = 뽑힐 가중치, inc = 초당 수입(기본)
export const PETS = [
  { id: 'tadpole', name: '올챙이', egg: 'amph', r: 0, w: 50, inc: 1, fact: '올챙이는 아가미로 숨 쉬다가 개구리가 되면 폐와 피부로 숨 쉬어요(변태).' },
  { id: 'frog', name: '청개구리', egg: 'amph', r: 1, w: 30, inc: 3, fact: '청개구리는 주변 색에 맞춰 몸 색을 조금 바꿀 수 있어요.' },
  { id: 'newt', name: '도롱뇽', egg: 'amph', r: 2, w: 15, inc: 7, fact: '도롱뇽은 꼬리가 잘려도 다시 자라는 재생 능력이 있어요.' },
  { id: 'axolotl', name: '아홀로틀', egg: 'amph', r: 3, w: 5, inc: 18, fact: '아홀로틀은 다 자라도 아가미가 남아 있는 "어린 모습 그대로" 사는 도롱뇽이에요(유형 성숙).' },
  { id: 'chick', name: '병아리', egg: 'bird', r: 1, w: 50, inc: 5, fact: '병아리는 알 속에서 21일 자라요. 부리 끝의 난치로 껍데기를 깨요.' },
  { id: 'penguin', name: '황제펭귄', egg: 'bird', r: 2, w: 30, inc: 12, fact: '황제펭귄 아빠는 영하 40℃에서 두 달 동안 알을 발 위에 올려 품어요.' },
  { id: 'flamingo', name: '홍학', egg: 'bird', r: 3, w: 15, inc: 28, fact: '홍학의 분홍색은 먹이(새우·조류)의 카로티노이드 색소에서 와요.' },
  { id: 'peacock', name: '공작', egg: 'bird', r: 4, w: 5, inc: 70, fact: '수컷 공작의 화려한 꼬리는 암컷의 선택을 받기 위한 성 선택의 결과예요.' },
  { id: 'turtle', name: '바다거북', egg: 'rept', r: 2, w: 50, inc: 20, fact: '바다거북 새끼는 달빛을 따라 바다로 기어가요.' },
  { id: 'chameleon', name: '카멜레온', egg: 'rept', r: 3, w: 30, inc: 45, fact: '카멜레온 피부 속 나노 결정의 간격이 바뀌면서 빛을 다르게 반사해 색이 변해요.' },
  { id: 'iguana', name: '이구아나', egg: 'rept', r: 3, w: 15, inc: 80, fact: '이구아나는 머리 위에 빛을 느끼는 "제3의 눈(두정안)"이 있어요.' },
  { id: 'komodo', name: '코모도왕도마뱀', egg: 'rept', r: 4, w: 5, inc: 200, fact: '코모도왕도마뱀은 가장 큰 도마뱀으로 길이가 3m까지 자라요.' },
  { id: 'salmon', name: '연어', egg: 'fish', r: 3, w: 50, inc: 90, fact: '연어는 냄새로 자기가 태어난 강을 기억해 돌아와요(회귀).' },
  { id: 'seahorse', name: '해마', egg: 'fish', r: 4, w: 30, inc: 220, fact: '해마는 아빠가 배 주머니에 알을 품어 새끼를 낳아요.' },
  { id: 'puffer', name: '복어', egg: 'fish', r: 4, w: 15, inc: 400, fact: '복어는 위험하면 물을 삼켜 몸을 부풀려요. 테트로도톡신이라는 강한 독이 있어요.' },
  { id: 'coelacanth', name: '실러캔스', egg: 'fish', r: 5, w: 5, inc: 1100, fact: '실러캔스는 멸종한 줄 알았다가 1938년에 발견된 "살아 있는 화석"이에요.' },
  { id: 'platypus', name: '오리너구리', egg: 'mono', r: 4, w: 50, inc: 600, fact: '오리너구리 부리는 먹잇감의 약한 전기 신호를 느껴요. 수컷 뒷발엔 독가시가 있어요.' },
  { id: 'echidna', name: '바늘두더지', egg: 'mono', r: 4, w: 30, inc: 1000, fact: '바늘두더지는 알을 배 주머니에 넣어 부화시켜요.' },
  { id: 'kiwi', name: '키위새', egg: 'mono', r: 5, w: 15, inc: 1800, fact: '키위새는 몸에 비해 아주 큰 알을 낳아요. 날개가 거의 없어 날지 못해요.' },
  { id: 'cassowary', name: '화식조', egg: 'mono', r: 5, w: 5, inc: 3500, fact: '화식조는 머리에 볏(투구)이 있고, 아빠가 알을 품고 새끼를 길러요.' },
  { id: 'raptor', name: '아기 랩터', egg: 'dino', r: 5, w: 50, inc: 2600, fact: '랩터 같은 작은 육식 공룡 중에는 깃털이 있던 종류가 많아요.' },
  { id: 'trike', name: '아기 트리케라톱스', egg: 'dino', r: 5, w: 30, inc: 4200, fact: '트리케라톱스는 뿔 세 개와 커다란 목 장식(프릴)을 가진 초식 공룡이에요.' },
  { id: 'ptera', name: '아기 프테라노돈', egg: 'dino', r: 6, w: 15, inc: 8000, fact: '프테라노돈은 공룡이 아니라 하늘을 나는 파충류(익룡)예요.' },
  { id: 'trex', name: '아기 티라노', egg: 'dino', r: 6, w: 5, inc: 15000, fact: '티라노사우루스는 바나나만 한 이빨로 강하게 무는 힘을 가졌어요.' },
  { id: 'jelly', name: '형광 해파리', egg: 'gene', r: 6, w: 45, inc: 12000, fact: '해파리의 초록 형광 단백질(GFP)은 세포 속을 보는 연구 도구가 되어 노벨상을 받았어요.' },
  { id: 'tardi', name: '물곰', egg: 'gene', r: 6, w: 30, inc: 20000, fact: '물곰(완보동물)은 우주·끓는 물·얼음 속에서도 살아남는 강한 생물이에요.' },
  { id: 'amoeba', name: '아메바 킹', egg: 'gene', r: 6, w: 17, inc: 32000, fact: '아메바는 세포 하나로 이루어진 생물로, 위족을 뻗어 움직이고 먹이를 감싸 먹어요.' },
  { id: 'dnadragon', name: 'DNA 드래곤', egg: 'gene', r: 6, w: 8, inc: 60000, fact: '이 드래곤은 상상 속 생물! DNA 이중 나선은 염기쌍 약 10개마다 한 바퀴 돌아요.' },
];
export const MUTS = [
  { id: 'none', name: '', mul: 1, p: 0 },
  { id: 'albino', name: '알비노', mul: 1.5, p: 0.06, fact: '멜라닌 색소를 만들지 못하는 돌연변이(백색증)예요. 눈이 붉게 보여요.' },
  { id: 'melan', name: '흑색증', mul: 2, p: 0.04, fact: '멜라닌 색소가 지나치게 많이 만들어지는 돌연변이예요.' },
  { id: 'gfp', name: '형광', mul: 3, p: 0.02, fact: 'GFP 유전자가 들어가 푸른 빛을 받으면 초록으로 빛나요.' },
  { id: 'giant', name: '거대화', mul: 5, p: 0.008, fact: '염색체 세트가 늘어난 배수체 생물은 몸이 커지기도 해요.' },
  { id: 'chimera', name: '키메라', mul: 10, p: 0.002, fact: '서로 다른 유전 정보를 가진 세포가 한 몸에 섞인 생물이에요.' },
];
export const TRAILS = [
  { id: 'none', name: '없음', cost: 0, spd: 0 },
  { id: 'bubble', name: '거품', cost: 2000, spd: 0.04, col: ['#bfe8ff', '#ffffff'] },
  { id: 'spore', name: '곰팡이 포자', cost: 12000, spd: 0.07, col: ['#9fd86a', '#e8f8a0'] },
  { id: 'pollen', name: '꽃가루', cost: 60000, spd: 0.1, col: ['#ffd84a', '#ff9fd0'] },
  { id: 'plankton', name: '야광 플랑크톤', cost: 300000, spd: 0.14, col: ['#5afff0', '#2a8aff'], glow: true },
  { id: 'dna', name: 'DNA 나선', cost: 1500000, spd: 0.18, col: ['#ff5a8a', '#5a8aff'], helix: true },
  { id: 'rainbow', name: '무지개 염색체', cost: 8000000, spd: 0.24, col: ['#ff5a5a', '#ffd84a', '#5aff8a', '#5a8aff', '#c85aff'] },
];
export const SHOP = {
  jump: { name: '점프력', max: 10, base: 150, k: 2.2, desc: '높은 받침대 위 희귀 알에 닿아요.' },
  bag: { name: '가방(동시에 들 수 있는 알)', max: 3, base: 2500, k: 12, desc: '알을 여러 개 들 수 있어요(무거우면 조금 느려요).' },
  incu: { name: '부화기', max: 6, base: 400, k: 3, desc: '동시에 부화시킬 수 있는 알 수.' },
  pen: { name: '우리 칸', max: 24, base: 300, k: 1.45, desc: '생물을 놓을 수 있는 칸 수.' },
  belt: { name: '러닝 벨트 레벨', max: 10, base: 200, k: 2.6, desc: '러닝 벨트 위에서 얻는 속도 점수가 늘어요.' },
};
export const EVENTS = [
  { id: 'rain', name: '알 소나기', dur: 40, desc: '하늘에서 알이 떨어져요! 빨리 주워요.' },
  { id: 'mutstorm', name: '돌연변이 폭풍', dur: 90, desc: '90초 동안 부화할 때 돌연변이가 5배 잘 나와요.' },
  { id: 'gold', name: '황금 햇살', dur: 90, desc: '90초 동안 모든 수입이 2배!' },
  { id: 'nap', name: '경비 낮잠', dur: 40, desc: '40초 동안 경비 세포가 꾸벅꾸벅 졸아요.' },
];
export const BOT_NAMES = ['멘델', '다윈', '프랭클린', '파스퇴르', '린네', '왓슨', '맥클린톡', '훅'];
export const BOT_COLS = ['#ef6a5a', '#4f8fe0', '#f0b030', '#a46ae8', '#3ab88a', '#ef7ab0'];
export const ME_COL = '#3ac8d8';
export const START = { cash: 120, jumpLv: 0, bagLv: 0, incuLv: 0, penLv: 0, beltLv: 0 };
export const lv2cost = (k, lv) => Math.round(SHOP[k].base * Math.pow(SHOP[k].k, lv) / 10) * 10;
export const rebirthCost = (n) => 25000 * Math.pow(6, n);
export const fmt = (n) => { n = Math.floor(n); if (n < 1e4) return n.toLocaleString('ko-KR'); const u = [['경', 1e16], ['조', 1e12], ['억', 1e8], ['만', 1e4]]; for (const [s, v] of u) if (n >= v) { const x = n / v; return (x >= 100 ? Math.floor(x) : x.toFixed(x >= 10 ? 1 : 2).replace(/\.?0+$/, '')) + s; } return String(n); };

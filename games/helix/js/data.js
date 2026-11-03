// 헬릭스 게임 데이터: 유전자 변이, 영구 강화, 기념품, 적 능력치, 대사
'use strict';
const LINEAGE = {
  enzyme: {name: '효소 계통', short: '효소', col: '#ff8a2a', light: '#ffd0a0', desc: '부식을 쌓아 적을 녹입니다.'},
  immune: {name: '면역 계통', short: '면역', col: '#3a8aff', light: '#b0d8ff', desc: '치명타와 방어로 버팁니다.'},
  neuro:  {name: '신경 계통', short: '신경', col: '#ffe040', light: '#fff6b0', desc: '번개처럼 빠르게, 연쇄 전격.'},
  symbio: {name: '공생 계통', short: '공생', col: '#3cffae', light: '#c0ffe8', desc: '회복과 포자로 함께 싸웁니다.'},
};
const SLOT_NAME = {attack: '베기', special: '회전베기', cast: '시약 투척', dash: '돌진', passive: '형질'};
const RARITY = [{name: '일반', col: '#c8d0dc', mul: 0}, {name: '희귀', col: '#5ab0ff', mul: 1}, {name: '영웅', col: '#d070ff', mul: 2}, {name: '전설', col: '#ffc040', mul: 3}];
// v: 등급별 수치 [일반, 희귀, 영웅, 전설]
const TRAITS = [
  {id: 'e_atk', lin: 'enzyme', slot: 'attack', name: '효소 칼날', v: [30, 45, 60, 80], d: v => `베기 피해 +${v}%, 맞은 적에게 부식 1중첩.`},
  {id: 'e_spc', lin: 'enzyme', slot: 'special', name: '산성 회전', v: [40, 60, 80, 105], d: v => `회전베기 피해 +${v}%, 부식 2중첩.`},
  {id: 'e_cst', lin: 'enzyme', slot: 'cast', name: '강산 시약', v: [100, 150, 200, 260], d: v => `시약 웅덩이 피해 +${v}%, 범위가 넓어집니다.`},
  {id: 'e_dsh', lin: 'enzyme', slot: 'dash', name: '부식 질주', v: [5, 7, 10, 13], d: v => `돌진한 자리에 산성 자국을 남깁니다 (0.4초마다 ${v} 피해).`},
  {id: 'e_cat', lin: 'enzyme', slot: 'passive', name: '촉매 반응', v: [50, 75, 100, 130], d: v => `부식 피해 +${v}%.`},
  {id: 'e_bom', lin: 'enzyme', slot: 'passive', name: '연쇄 분해', v: [20, 30, 40, 55], d: v => `부식된 적이 죽으면 터져 주변에 ${v} 피해.`},
  {id: 'i_atk', lin: 'immune', slot: 'attack', name: '항체 칼날', v: [15, 20, 25, 32], d: v => `베기 치명타 확률 +${v}% (치명타 피해 2.5배).`},
  {id: 'i_spc', lin: 'immune', slot: 'special', name: '대식 회전', v: [40, 60, 80, 105], d: v => `회전베기 피해 +${v}%, 적을 안쪽으로 끌어당깁니다.`},
  {id: 'i_cst', lin: 'immune', slot: 'cast', name: '보체 표식', v: [30, 40, 50, 65], d: v => `시약에 맞은 적이 4초 동안 받는 피해 +${v}%.`},
  {id: 'i_dsh', lin: 'immune', slot: 'dash', name: '면역 장막', v: [6, 5, 4, 3], d: v => `돌진하면 공격 1회를 막는 보호막 (재사용 ${v}초).`},
  {id: 'i_mem', lin: 'immune', slot: 'passive', name: '기억 세포', v: [15, 22, 30, 40], d: v => `중간 보스·보스에게 주는 피해 +${v}%.`},
  {id: 'i_fev', lin: 'immune', slot: 'passive', name: '발열 반응', v: [30, 45, 60, 80], d: v => `체력이 35% 이하일 때 피해 +${v}%.`},
  {id: 'n_atk', lin: 'neuro', slot: 'attack', name: '활동전위', v: [8, 12, 16, 22], d: v => `베기가 근처 적 2명에게 연쇄 전격 (${v} 피해).`},
  {id: 'n_spc', lin: 'neuro', slot: 'special', name: '시냅스 폭풍', v: [3, 4, 5, 6], d: v => `회전베기 때 주변 적 ${v}명에게 번개 (20 피해).`},
  {id: 'n_cst', lin: 'neuro', slot: 'cast', name: '전도 시약', v: [6, 8, 10, 13], d: v => `시약 자리에 전기장: 0.4초마다 ${v} 피해, 적이 느려집니다.`},
  {id: 'n_dsh', lin: 'neuro', slot: 'dash', name: '도약 전도', v: [15, 22, 30, 40], d: v => `돌진을 시작할 때 주변에 번개 (${v} 피해).`},
  {id: 'n_ref', lin: 'neuro', slot: 'passive', name: '반사 신경', v: [12, 18, 24, 32], d: v => `이동 속도 +${v}%, 공격 속도 +${Math.round(v * 0.66)}%.`},
  {id: 'n_mye', lin: 'neuro', slot: 'passive', name: '수초화', v: [1, 2, 3, 4], d: v => `연쇄 전격이 ${v}번 더 튀고 피해 +20%.`},
  {id: 's_atk', lin: 'symbio', slot: 'attack', name: '흡수 칼날', v: [1, 1, 2, 3], d: v => `베기가 적을 맞히면 체력 ${v} 회복 (한 번 휘두를 때 1회).`},
  {id: 's_spc', lin: 'symbio', slot: 'special', name: '포자 회전', v: [15, 22, 30, 40], d: v => `회전베기가 포자 2개를 남기고, 1초 뒤 터져 ${v} 피해.`},
  {id: 's_cst', lin: 'symbio', slot: 'cast', name: '균사 포탑', v: [6, 8, 10, 13], d: v => `시약 자리에 포자 포탑이 ${v}초 동안 적을 쏩니다.`},
  {id: 's_dsh', lin: 'symbio', slot: 'dash', name: '재생 질주', v: [2, 3, 4, 5], d: v => `돌진하면 체력 ${v} 회복 (재사용 3초).`},
  {id: 's_hp', lin: 'symbio', slot: 'passive', name: '공생체', v: [20, 30, 40, 55], d: v => `최대 체력 +${v}.`},
  {id: 's_pho', lin: 'symbio', slot: 'passive', name: '광합성', v: [8, 12, 16, 22], d: v => `방을 정리할 때마다 체력 ${v} 회복.`},
];
// 무기별 변이 (베기·회전 자리는 무기마다 다름)
for (const t of TRAITS) if (t.slot === 'attack' || t.slot === 'special') t.wpn = 'scythe';
TRAITS.push(
  {id: 'g_e_atk', wpn: 'gun', lin: 'enzyme', slot: 'attack', name: '부식탄', v: [20, 30, 40, 55], d: v => `사격 피해 +${v}%, 맞은 적에게 부식 1중첩.`},
  {id: 'g_i_atk', wpn: 'gun', lin: 'immune', slot: 'attack', name: '관통 항체탄', v: [1, 1, 2, 3], d: v => `탄이 적 ${v}명을 더 꿰뚫고, 치명타 확률 +12%.`},
  {id: 'g_n_atk', wpn: 'gun', lin: 'neuro', slot: 'attack', name: '전격탄', v: [6, 9, 12, 16], d: v => `네 번째 탄마다 근처 적 2명에게 연쇄 전격 (${v} 피해).`},
  {id: 'g_s_atk', wpn: 'gun', lin: 'symbio', slot: 'attack', name: '흡수탄', v: [1, 1, 2, 3], d: v => `탄으로 적을 쓰러뜨리면 체력 ${v} 회복.`},
  {id: 'g_e_spc', wpn: 'gun', lin: 'enzyme', slot: 'special', name: '산성 산탄', v: [30, 45, 60, 80], d: v => `산탄 피해 +${v}%, 앞쪽에 산성 웅덩이를 남깁니다.`},
  {id: 'g_i_spc', wpn: 'gun', lin: 'immune', slot: 'special', name: '충격 산탄', v: [0.6, 0.8, 1.0, 1.3], d: v => `산탄 피해 +25%, 맞은 적이 ${v}초 동안 기절합니다.`},
  {id: 'g_n_spc', wpn: 'gun', lin: 'neuro', slot: 'special', name: '플라스마 산탄', v: [3, 4, 5, 6], d: v => `산탄을 쏠 때 앞쪽 적 ${v}명에게 번개 (22 피해).`},
  {id: 'g_s_spc', wpn: 'gun', lin: 'symbio', slot: 'special', name: '포자 산탄', v: [12, 18, 24, 32], d: v => `산탄이 포자 3개를 남기고, 1초 뒤 터져 ${v} 피해.`},
  {id: 'd_e_atk', wpn: 'drone', lin: 'enzyme', slot: 'attack', name: '분해 광선', v: [25, 35, 50, 65], d: v => `드론 광선 피해 +${v}%, 부식 1중첩.`},
  {id: 'd_i_atk', wpn: 'drone', lin: 'immune', slot: 'attack', name: '정밀 조준', v: [15, 20, 25, 32], d: v => `드론 광선 치명타 확률 +${v}% (치명타 피해 2.5배).`},
  {id: 'd_n_atk', wpn: 'drone', lin: 'neuro', slot: 'attack', name: '테슬라 코일', v: [5, 7, 9, 12], d: v => `드론 광선이 다른 적 1명에게 튑니다 (${v} 피해).`},
  {id: 'd_s_atk', wpn: 'drone', lin: 'symbio', slot: 'attack', name: '수리 광선', v: [1, 1, 2, 2], d: v => `드론 광선이 8번 맞힐 때마다 체력 ${v} 회복.`},
  {id: 'd_e_spc', wpn: 'drone', lin: 'enzyme', slot: 'special', name: '산성 회전날', v: [30, 45, 60, 80], d: v => `드론 돌격 피해 +${v}%, 그 자리에 산성 웅덩이.`},
  {id: 'd_i_spc', wpn: 'drone', lin: 'immune', slot: 'special', name: '방어 위성', v: [6, 5, 4, 3], d: v => `드론이 돌아오면 공격 1회를 막는 보호막 (재사용 ${v}초).`},
  {id: 'd_n_spc', wpn: 'drone', lin: 'neuro', slot: 'special', name: '과부하 폭발', v: [15, 22, 30, 40], d: v => `드론 돌격이 끝날 때 번개 폭발 (${v} 피해).`},
  {id: 'd_s_spc', wpn: 'drone', lin: 'symbio', slot: 'special', name: '쌍둥이 드론', v: [4, 6, 8, 10], d: v => `드론 돌격 때 작은 드론이 ${v}초 동안 함께 싸웁니다.`},
);
const TRAIT = Object.fromEntries(TRAITS.map(t => [t.id, t]));
// 무기
const WEAPON = {
  scythe: {name: '이중나선 낫', short: '낫', col: '#3cffae', attack: '베기', special: '회전베기', desc: '넓게 휘두르는 3연속 베기와 주변을 모두 베는 회전. 가까이서 강력합니다.', spr: ['h_atk1', 3, 1]},
  gun: {name: '유전자총 G-7', short: '총', col: '#36ccff', attack: '사격', special: '산탄 폭발', desc: '누르고 있으면 계속 쏘는 연사, 가까운 적을 밀어내는 산탄. 거리를 두고 싸웁니다.', spr: ['h_shoot', 1, 1]},
  drone: {name: '공생 드론 베스파', short: '드론', col: '#ffe040', attack: '광선', special: '드론 돌격', desc: '드론이 스스로 가까운 적을 쏘고, 명령하면 돌진해 회전날로 벱니다. 움직이며 싸우기 쉽습니다.', spr: ['drone', 0, 1]},
};
const WPN = () => (G.run && G.run.wpn) || SAVE.weapon || 'scythe';
const slotName = (slot, wpn) => (slot === 'attack' || slot === 'special') ? WEAPON[wpn || WPN()][slot] : SLOT_NAME[slot];

const META = [
  {id: 'vit', name: '강화 체력', icon: 'maxhp', max: 5, cost: [10, 18, 28, 40, 60], d: l => `시작 최대 체력 +${l * 10}`},
  {id: 'dmg', name: '공격 효율', icon: 'blade', max: 5, cost: [15, 25, 35, 50, 70], d: l => `모든 피해 +${l * 5}%`},
  {id: 'dash', name: '추가 돌진', icon: 'speed', max: 1, cost: [40], d: l => `돌진 횟수 +${l}`},
  {id: 'revive', name: '재생 세포', icon: 'revive', max: 2, cost: [30, 80], d: l => `쓰러지면 ${l}번 다시 일어남 (체력 40%)`},
  {id: 'gold', name: '시작 자금', icon: 'atp', max: 3, cost: [10, 20, 30], d: l => `출정할 때 ATP +${l * 30}`},
  {id: 'luck', name: '행운 형질', icon: 'luck', max: 3, cost: [20, 35, 50], d: l => `좋은 등급 변이가 나올 확률 +${l * 8}%`},
  {id: 'ammo', name: '시약 용량', icon: 'orb_symbio', max: 2, cost: [25, 50], d: l => `시약 병 +${l}`},
  {id: 'heal', name: '응급 처치', icon: 'heal', max: 3, cost: [15, 25, 40], d: l => `받는 회복량 +${l * 10}%`},
];
const CHARMS = [
  {id: 'charm_a', name: '적혈구 펜던트', cost: 20, d: '최대 체력 +15.'},
  {id: 'charm_b', name: '항체 부적', cost: 30, d: '방마다 처음 받는 공격 1회를 막습니다.'},
  {id: 'charm_c', name: '엽록체 구슬', cost: 25, d: '얻는 ATP +30%.'},
  {id: 'charm_d', name: '신경 결정', cost: 40, d: '처음 고르는 변이가 희귀 등급 이상.'},
];

// 적 능력치: hp, 피해, 속도, 공격 거리, 예고 시간, 재사용, 행동, 무게(밀림 저항), 반지름
const FOE = {
  phage:      {hp: 34, dmg: 8, spd: 105, range: 70, wind: 0.5, cd: 1.6, ai: 'melee', shape: 'circle', area: 62, weight: 1, r: 18},
  amoeba:     {hp: 60, dmg: 11, spd: 62, range: 75, wind: 0.65, cd: 2.0, ai: 'melee', shape: 'circle', area: 80, weight: 2, r: 24},
  bacillus:   {hp: 28, dmg: 9, spd: 90, range: 230, wind: 0.55, cd: 2.2, ai: 'charge', dist: 260, weight: 1, r: 16},
  brute:      {hp: 130, dmg: 18, spd: 58, range: 90, wind: 0.8, cd: 2.4, ai: 'melee', shape: 'circle', area: 105, weight: 4, r: 30, roar: true},
  researcher: {hp: 44, dmg: 10, spd: 88, range: 72, wind: 0.45, cd: 1.5, ai: 'melee', shape: 'cone', area: 95, weight: 1.5, r: 18},
  mosquito:   {hp: 22, dmg: 8, spd: 150, range: 240, wind: 0.5, cd: 2.0, ai: 'charge', dist: 270, weight: 0.6, r: 14, fly: true},
  worm:       {hp: 40, dmg: 10, spd: 80, range: 110, wind: 0.5, cd: 1.8, ai: 'melee', shape: 'line', area: 120, weight: 1.5, r: 18},
  shroom:     {hp: 40, dmg: 8, spd: 40, range: 330, wind: 0.6, cd: 2.4, ai: 'ranged', shots: 3, spread: 0.3, pspd: 220, weight: 2, r: 18, keep: 200},
  prion:      {hp: 36, dmg: 9, spd: 60, range: 360, wind: 0.6, cd: 2.0, ai: 'ranged', shots: 1, spread: 0, pspd: 330, weight: 1.5, r: 18, keep: 240, fly: true},
  planaria:   {hp: 36, dmg: 9, spd: 95, range: 170, wind: 0.45, cd: 1.8, ai: 'charge', dist: 180, weight: 1, r: 18},
  jelly:      {hp: 42, dmg: 9, spd: 70, range: 85, wind: 0.55, cd: 1.8, ai: 'melee', shape: 'cone', area: 100, weight: 1, r: 18, fly: true},
  tick:       {hp: 30, dmg: 9, spd: 100, range: 200, wind: 0.5, cd: 2.0, ai: 'charge', dist: 210, weight: 1, r: 15},
  corona:     {hp: 38, dmg: 11, spd: 85, range: 260, wind: 0.6, cd: 2.2, ai: 'charge', dist: 300, weight: 1.5, r: 18},
  leech:      {hp: 40, dmg: 9, spd: 75, range: 160, wind: 0.45, cd: 1.8, ai: 'charge', dist: 170, weight: 1, r: 18, drain: true},
  clone:      {hp: 46, dmg: 10, spd: 70, range: 360, wind: 0.6, cd: 2.0, ai: 'ranged', shots: 1, spread: 0, pspd: 300, weight: 1.5, r: 18, keep: 240},
  rat:        {hp: 26, dmg: 7, spd: 165, range: 60, wind: 0.32, cd: 1.1, ai: 'melee', shape: 'cone', area: 70, weight: 0.8, r: 15},
  // 중간 보스
  phage_q:  {hp: 700, dmg: 16, spd: 85, range: 95, wind: 0.6, cd: 1.2, ai: 'melee', shape: 'circle', area: 105, weight: 9, r: 40, sp: 'summon:phage:3'},
  shroom_k: {hp: 760, dmg: 14, spd: 45, range: 380, wind: 0.7, cd: 1.3, ai: 'ranged', shots: 5, spread: 0.22, pspd: 240, weight: 9, r: 44, keep: 220, sp: 'nova:14'},
  leech_l:  {hp: 720, dmg: 16, spd: 80, range: 220, wind: 0.55, cd: 1.3, ai: 'charge', dist: 260, weight: 9, r: 40, sp: 'drain', drain: true},
  tick_m:   {hp: 680, dmg: 15, spd: 85, range: 220, wind: 0.55, cd: 1.3, ai: 'charge', dist: 240, weight: 9, r: 40, sp: 'summon:tick:4'},
  brute_x:  {hp: 900, dmg: 22, spd: 62, range: 115, wind: 0.75, cd: 1.3, ai: 'melee', shape: 'circle', area: 130, weight: 10, r: 46, sp: 'quake'},
  clone_c:  {hp: 760, dmg: 15, spd: 70, range: 380, wind: 0.6, cd: 1.1, ai: 'ranged', shots: 3, spread: 0.2, pspd: 320, weight: 9, r: 36, keep: 240, sp: 'rally'},
  prion_g:  {hp: 820, dmg: 15, spd: 50, range: 380, wind: 0.65, cd: 1.2, ai: 'ranged', shots: 3, spread: 0.25, pspd: 340, weight: 10, r: 44, keep: 230, sp: 'nova:16'},
  corona_n: {hp: 780, dmg: 17, spd: 85, range: 300, wind: 0.6, cd: 1.3, ai: 'charge', dist: 340, weight: 10, r: 44, sp: 'nova:18'},
  // 챕터 보스
  queen:    {hp: 2300, dmg: 20, spd: 50, range: 200, wind: 0.8, cd: 1.0, ai: 'boss', weight: 99, r: 70},
  wormking: {hp: 2700, dmg: 22, spd: 75, range: 240, wind: 0.75, cd: 0.9, ai: 'boss', weight: 99, r: 56},
  doctor:   {hp: 3100, dmg: 24, spd: 95, range: 200, wind: 0.65, cd: 0.8, ai: 'boss', weight: 99, r: 44},
  helix:    {hp: 3800, dmg: 26, spd: 80, range: 420, wind: 0.75, cd: 0.8, ai: 'boss', weight: 99, r: 56, fly: true},
};
const AREA_OF = {1: 'lab', 2: 'sewer', 3: 'ward', 4: 'vault'};
const AREA_NAME = {hub: '쉼터', lab: '배양실', sewer: '하수 저장고', ward: '격리 병동', vault: '유전체 금고'};

// 대사: 진행 상황에 맞는 줄을 고름
const TALK = {
  mentor: [
    {when: s => s.runs === 0, lines: ['이안, 정신이 드나? 다행이야. 쉼터까지 무사히 왔구나.', '유전체 금고가 폭주하면서 연구소 아래층이 전부 오염됐어. 배양실부터 금고까지, 모든 생명체가 변이하고 있지.', '금고의 핵심, 나선의 지배자를 멈추지 않으면 이 오염은 지상까지 퍼질 거야.', '네 낫의 이중나선은 변이를 흡수할 수 있어. 싸우면서 얻는 유전자 변이를 받아들여.', '쓰러져도 괜찮아. 재생 장치가 너를 이 쉼터로 다시 데려올 테니까. 준비되면 북쪽 관문으로 가.']},
    {when: s => s.runs > 0 && s.best === 0 && s.runs < 3, lines: ['돌아왔구나. 배양실은 생각보다 지독하지?', 'DNA 샘플을 모아 오면 강화대에서 몸을 단련할 수 있어. 왼쪽의 빛나는 장치를 써 봐.']},
    {when: s => s.best === 1, lines: ['원형질 여왕을 쓰러뜨렸다니! 그건 내 첫 배양 실험의 잔재였어…', '하수 저장고에는 기생 생물이 득실거려. 거머리에게 달라붙히지 않게 조심해.']},
    {when: s => s.best === 2, lines: ['기생충 왕까지… 이제 격리 병동이야.', '그곳엔 내 옛 동료가 있었어. 감염 박사라고 불리는 그 사람… 만나더라도 망설이지 마.']},
    {when: s => s.best === 3, lines: ['유전체 금고의 문이 열렸어. 마지막이야, 이안.', '나선의 지배자는 우리가 만든 생명의 설계도 그 자체야. 꼭 돌아와.']},
    {when: s => s.wins > 0, lines: ['금고가 잠잠해졌어. 네 덕분이야.', '그래도 변이의 흔적은 계속 남아 있어. 원한다면 다시 내려가 더 깊이 연구해 볼까?']},
    {when: () => true, lines: ['계통마다 변이의 성격이 달라. 효소는 녹이고, 면역은 버티고, 신경은 빠르고, 공생은 함께 살아남지.', '돌진은 공격 도중에도 쓸 수 있어. 위험하면 언제든 빠져나와.', '적이 바닥에 빨간 표시를 그리면 곧 공격한다는 뜻이야. 표시 밖으로 피해.']},
  ],
  merchant: [
    {when: s => !s.metMerchant, lines: ['어서 와, 연구원 양반. 바이알이라고 해. 지하에서 건진 것들을 팔지.', '이 기념품들은 몸에 지니면 작은 힘을 줘. 출정할 때 하나만 걸고 가.']},
    {when: () => true, lines: ['좋은 물건은 DNA 샘플로만 거래해. 왜냐고? 그게 요즘 가장 귀하거든.', '배양실 항아리를 깨면 ATP가 나와. 아래층 상점에서 쓰기 좋지.', '오늘은 뭘 걸고 갈 텐가?']},
  ],
  drone: [
    {when: () => true, lines: ['삐빅. 기록 드론 아키입니다. 지금까지의 기록과 생물 도감을 보여 드릴게요.']},
  ],
  cat: [
    {when: () => true, lines: ['냐아.', '(세포가 발밑에 몸을 비빈다.)', '냥. (꼬리가 초록빛으로 반짝인다.)']},
  ],
};

// 곡 목록 (bio-beat.html SONGS에서 뽑음) + 커버 화풍(s)·모티프(m)·색(p)
const SONGS=[
{
"id": "cellworld",
"ko": "세포 속 세상",
"en": "Inside the Cell",
"m": "cell",
"s": "pastel",
"p": [
"#f6efe4",
"#ffd8cf",
"#ff8f7a",
"#ffc2b0",
"#5a3a3a"
]
},
{
"id": "dnasecret",
"ko": "DNA의 비밀",
"en": "Secret of DNA",
"m": "dna",
"s": "chrome",
"p": [
"#ffd6f0",
"#c9b6ff",
"#7fd8ff"
]
},
{
"id": "greenmagic",
"ko": "초록빛 마법",
"en": "Green Magic",
"m": "leaf",
"s": "dreamy",
"p": [
"#ffb8d8",
"#c8b8ff",
"#9ad8ff",
"#ffe9f4",
"#ffd0e8",
"#c060a0"
]
},
{
"id": "cellpowerplant",
"ko": "세포의 발전소",
"en": "Powerhouse of the Cell",
"m": "mito",
"s": "neon",
"p": [
"#ff3ad0",
"#ffe04a",
"#3a0a5a"
]
},
{
"id": "lifespark",
"ko": "생명의 스파크",
"en": "Spark of Life",
"m": "spark",
"s": "pop",
"p": [
"#ffe14a",
"#ff4a6a",
"#4ab0ff",
"#ffffff",
"#1a1a2a"
]
},
{
"id": "immunesystem",
"ko": "면역 시스템",
"en": "Immune System",
"m": "shield",
"s": "chrome",
"p": [
"#b8f5ff",
"#a0b8ff",
"#e7b8ff"
]
},
{
"id": "mendellaws",
"ko": "멘델의 유전 법칙",
"en": "Mendel's Laws",
"m": "pea",
"s": "collage",
"p": [
"#e8dcc4",
"#ff9a7a",
"#5ab0ff",
"#ffcf3a",
"#2a2a3a"
]
},
{
"id": "enzymemagic",
"ko": "효소의 마법",
"en": "Enzyme Magic",
"m": "enzyme",
"s": "riso",
"p": [
"#ff5a8a",
"#2a4ad8"
]
},
{
"id": "heartbeat",
"ko": "심장 박동 과정",
"en": "Heartbeat Journey",
"m": "heart",
"s": "pop",
"p": [
"#4affb0",
"#7a4aff",
"#ff7a3a",
"#ffffff",
"#1a1a2a"
]
},
{
"id": "twodivisions",
"ko": "세포의 두 갈래 길",
"en": "Two Paths of Division",
"m": "divide",
"s": "editorial",
"p": [
"#121214",
"#f2efe8",
"#c8a870"
]
},
{
"id": "foodweb",
"ko": "먹이 그물의 교향곡",
"en": "Symphony of the Food Web",
"m": "web",
"s": "collage",
"p": [
"#dfe8d8",
"#9ad0a0",
"#ff7a9a",
"#5a7aff",
"#2a3a2a"
]
},
{
"id": "digestrelay",
"ko": "소화 커팅 릴레이",
"en": "Digestion Cutting Relay",
"m": "scissors",
"s": "riso",
"p": [
"#ff7a2a",
"#1a8a6a"
]
},
{
"id": "breathmagic",
"ko": "외호흡의 마법",
"en": "Magic of Breathing",
"m": "lungs",
"s": "dreamy",
"p": [
"#a8c8ff",
"#d8b8ff",
"#ffd0e0",
"#ffffff",
"#d0e8ff",
"#5a6ac0"
]
},
{
"id": "kidneyclass",
"ko": "신장의 클라스",
"en": "Kidney Class",
"m": "kidney",
"s": "glass",
"p": [
"#d8e0ff",
"#ff9ac8",
"#7ad0ff",
"#b89aff",
"#3a3a7a"
]
},
{
"id": "autofocus",
"ko": "내 눈속의 오토 포커스",
"en": "Auto Focus in My Eyes",
"m": "eye",
"s": "holo",
"p": [
"#c8b8ff",
"#ff9ad8",
"#8ae8ff",
"#ffe08a",
"#a0ffd0",
"#5a4aa0"
]
},
{
"id": "homeostasis",
"ko": "항상성 유지",
"en": "Keeping Homeostasis",
"m": "balance",
"s": "pastel",
"p": [
"#e8f0ec",
"#c8e6d4",
"#5aa880",
"#9ad4b4",
"#2e4a3c"
]
},
{
"id": "musclesecret",
"ko": "근육의 비밀",
"en": "Secret of Muscles",
"m": "muscle",
"s": "neon",
"p": [
"#3affd0",
"#ff4ad0",
"#0a2a5a"
]
},
{
"id": "crossingover",
"ko": "유전자 교차",
"en": "Crossing Over",
"m": "cross",
"s": "holo",
"p": [
"#9ad8ff",
"#c0a0ff",
"#ffb0e0",
"#a0fff0",
"#fff0a0",
"#3a5a9a"
]
},
{
"id": "petridish",
"ko": "나의 둥근 페트리 접시",
"en": "My Round Petri Dish",
"m": "petri",
"s": "riso",
"p": [
"#f0c020",
"#d02a5a"
]
},
{
"id": "myinsulin",
"ko": "내 인슐린",
"en": "My Insulin",
"m": "insulin",
"s": "glass",
"p": [
"#ffe6d8",
"#ffb07a",
"#ff7aa8",
"#ffd86a",
"#6a3a3a"
]
},
{
"id": "centraldogma",
"ko": "생명의 중심원리",
"en": "Central Dogma",
"m": "dogma",
"s": "editorial",
"p": [
"#efe9de",
"#1a1a1c",
"#b8462a"
]
},
{
"id": "photoquest",
"ko": "엽록체 광합성 퀘스트",
"en": "Chloroplast Quest",
"m": "chloro",
"s": "pop",
"p": [
"#ff7ab0",
"#2a2aff",
"#ffe04a",
"#ffffff",
"#1a1a2a"
]
},
{
"id": "lifesurfing",
"ko": "생명의 서핑",
"en": "Surfing of Life",
"m": "wave",
"s": "holo",
"p": [
"#ffc0e0",
"#ffe0a0",
"#a0e0ff",
"#d0a0ff",
"#ffa0c0",
"#8a3a6a"
]
},
{
"id": "phospholipiddance",
"ko": "인지질의 춤",
"en": "Dance of Phospholipids",
"m": "lipid",
"s": "glass",
"p": [
"#d8fff0",
"#5ae0b0",
"#7ab8ff",
"#c0ff7a",
"#1a5a4a"
]
},
{
"id": "greattree",
"ko": "생명의 거대한 나무",
"en": "Great Tree of Life",
"m": "tree",
"s": "dreamy",
"p": [
"#ffd0b0",
"#ffb0c8",
"#c8a8ff",
"#fff4e0",
"#ffe0c0",
"#c06a5a"
]
},
{
"id": "eternalhelix",
"ko": "영원한 이중나선",
"en": "Eternal Double Helix",
"m": "dna",
"s": "editorial",
"p": [
"#0e1a2a",
"#e8eef8",
"#7ab0ff"
]
},
{
"id": "actionspike",
"ko": "액션 스파이크",
"en": "Action Spike",
"m": "neuron",
"s": "neon",
"p": [
"#ff6a3a",
"#3ae0ff",
"#4a0a3a"
]
},
{
"id": "genemelody",
"ko": "유전의 멜로디",
"en": "Melody of Heredity",
"m": "note",
"s": "pastel",
"p": [
"#eef0fa",
"#d4dcff",
"#6a7cf0",
"#a8b6ff",
"#2c3462"
]
},
{
"id": "natureverdict",
"ko": "자연의 판결",
"en": "Verdict of Nature",
"m": "gavel",
"s": "editorial",
"p": [
"#1c1410",
"#f4e8d8",
"#e08a4a"
]
},
{
"id": "endoexovibe",
"ko": "내분비와 외분비의 바이브",
"en": "Endocrine & Exocrine Vibe",
"m": "gland",
"s": "holo",
"p": [
"#a0ffe0",
"#a0c0ff",
"#ffa0e0",
"#e0ffa0",
"#c0a0ff",
"#2a6a5a"
]
},
{
"id": "cellpowerhouse",
"ko": "세포 발전소",
"en": "Cell Powerhouse",
"m": "battery",
"s": "chrome",
"p": [
"#ffe9b8",
"#ffb8d9",
"#b8c8ff"
]
},
{
"id": "funkyfoodweb",
"ko": "Funky Food Web",
"en": "Funky Food Web",
"m": "web",
"s": "pop",
"p": [
"#7ae0ff",
"#ff3a5a",
"#ffd03a",
"#ffffff",
"#1a1a2a"
]
},
{
"id": "syncclone",
"ko": "100 싱크로율 클론",
"en": "100% Sync Clone",
"m": "clone",
"s": "chrome",
"p": [
"#c8ffe4",
"#9ae0ff",
"#c0a8ff"
]
},
{
"id": "eternalcatalyst",
"ko": "영원한 촉매제",
"en": "Eternal Catalyst",
"m": "star",
"s": "neon",
"p": [
"#8a6aff",
"#3affb0",
"#1a0a4a"
]
},
{
"id": "proteinswing",
"ko": "단백질 스윙 파티",
"en": "Protein Swing Party",
"m": "ribbon",
"s": "collage",
"p": [
"#f0e0e8",
"#b8a8ff",
"#ff8a5a",
"#3ac0a0",
"#3a2a3a"
]
},
{
"id": "heart44",
"ko": "심장의 4/4박자",
"en": "Heart 4/4",
"m": "heart44",
"s": "riso",
"p": [
"#3ac0e0",
"#e0402a"
]
},
{
"id": "dreamybreath",
"ko": "몽환적인 호흡",
"en": "Dreamy Breath",
"m": "dream",
"s": "dreamy",
"p": [
"#b8f0e0",
"#a8d0ff",
"#e0c0ff",
"#f0fff8",
"#c0f0e0",
"#4a8a9a"
]
},
{
"id": "nephrongroove",
"ko": "네프론의 그루브",
"en": "Nephron Groove",
"m": "nephron",
"s": "glass",
"p": [
"#f0e0ff",
"#c07aff",
"#7a9aff",
"#ff9ae0",
"#4a2a6a"
]
},
{
"id": "muscleburst",
"ko": "근수축 폭발",
"en": "Muscle Burst",
"m": "muscle",
"s": "pop",
"p": [
"#ff9a3a",
"#2ac08a",
"#ff4ab0",
"#ffffff",
"#1a1a2a"
]
},
{
"id": "innersea",
"ko": "내 안의 바다",
"en": "The Sea Within Me",
"m": "wave",
"s": "pastel",
"p": [
"#fbf3e0",
"#ffe6a8",
"#e8a020",
"#ffd070",
"#4a3818"
]
},
{
"id": "digestparty",
"ko": "소화 파티",
"en": "Digestion Party",
"m": "party",
"s": "collage",
"p": [
"#e4e8f0",
"#ffd0a0",
"#7a5aff",
"#ff5a7a",
"#2a2a40"
]
},
{
"id": "focusver1",
"ko": "너에게만 맞춘 포커스 ver1",
"en": "Focus Only On You ver1",
"m": "focus",
"s": "holo",
"p": [
"#c8b8ff",
"#ff9ad8",
"#8ae8ff",
"#ffe08a",
"#a0ffd0",
"#5a4aa0"
]
},
{
"id": "focusver2",
"ko": "너에게만 맞춘 포커스 ver2",
"en": "Focus Only On You ver2",
"m": "focus",
"s": "glass",
"p": [
"#d8e0ff",
"#ff9ac8",
"#7ad0ff",
"#b89aff",
"#3a3a7a"
]
}
];

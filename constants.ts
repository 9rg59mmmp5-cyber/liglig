import { LeagueData } from './types';

// --- KARABÜK İDMAN YURDU DATA (TFF 3. LİG 3. GRUP) ---
// Kaynak: tff.org, Hafta 22 puan cetveli (27.02.2026 itibariyle)
// NOT: Bu başlangıç verisi — TFF Sync ile otomatik güncellenir
const KARABUK_TEAMS = [
  { id: 1,  name: "Sebat Gençlik Spor",           played: 22, won: 16, drawn: 6, lost: 0,  gf: 46, ga: 16, gd: 30,  pts: 54, form: [] },
  { id: 2,  name: "52 Orduspor FK",                played: 22, won: 14, drawn: 3, lost: 5,  gf: 52, ga: 21, gd: 31,  pts: 45, form: [] },
  { id: 3,  name: "Fatsa Belediyespor",            played: 22, won: 12, drawn: 3, lost: 7,  gf: 27, ga: 21, gd: 6,   pts: 39, form: [] },
  { id: 4,  name: "Yozgat Belediye Bozokspor",     played: 22, won: 11, drawn: 5, lost: 6,  gf: 44, ga: 22, gd: 22,  pts: 38, form: [] },
  { id: 5,  name: "TCH Group Zonguldakspor",       played: 22, won: 11, drawn: 5, lost: 6,  gf: 38, ga: 17, gd: 21,  pts: 38, form: [] },
  { id: 6,  name: "KDZ. Ereğli Belediye Spor",     played: 22, won: 10, drawn: 8, lost: 4,  gf: 30, ga: 23, gd: 7,   pts: 38, form: [] },
  { id: 8,  name: "Pazarspor",                     played: 22, won: 8,  drawn: 7, lost: 7,  gf: 22, ga: 25, gd: -3,  pts: 31, form: [] },
  { id: 7,  name: "Düzce Cam Düzcespor",           played: 22, won: 8,  drawn: 5, lost: 9,  gf: 24, ga: 27, gd: -3,  pts: 29, form: [] },
  { id: 9,  name: "Tokat Belediye Spor",           played: 22, won: 7,  drawn: 5, lost: 10, gf: 21, ga: 25, gd: -4,  pts: 26, form: [] },
  { id: 11, name: "Orduspor 1967 A.Ş.",            played: 22, won: 6,  drawn: 7, lost: 9,  gf: 23, ga: 35, gd: -12, pts: 25, form: [] },
  { id: 12, name: "Karabük İdman Yurdu Spor",      played: 22, won: 7,  drawn: 4, lost: 11, gf: 21, ga: 38, gd: -17, pts: 25, form: [] },
  { id: 10, name: "1926 Bulancakspor",             played: 22, won: 6,  drawn: 5, lost: 11, gf: 22, ga: 41, gd: -19, pts: 23, form: [] },
  { id: 14, name: "Artvin Hopaspor",               played: 22, won: 6,  drawn: 4, lost: 12, gf: 23, ga: 33, gd: -10, pts: 22, form: [] },
  { id: 13, name: "Amasya Spor FK",                played: 22, won: 5,  drawn: 6, lost: 11, gf: 19, ga: 32, gd: -13, pts: 21, form: [] },
  { id: 15, name: "Çayeli Spor Kulübü",            played: 22, won: 3,  drawn: 8, lost: 11, gf: 17, ga: 32, gd: -15, pts: 17, form: [] },
  { id: 16, name: "Giresunspor",                   played: 22, won: 3,  drawn: 5, lost: 14, gf: 19, ga: 40, gd: -21, pts: 14, form: [] },
];

const KARABUK_FIXTURES = [
  // Week 22
  { id: 'k22_1', week: 22, homeTeamId: 3, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Fatsa vs Pazar
  { id: 'k22_2', week: 22, homeTeamId: 6, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Ereğli vs 52 Ordu
  { id: 'k22_3', week: 22, homeTeamId: 1, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Sebat vs Tokat
  { id: 'k22_4', week: 22, homeTeamId: 4, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Yozgat vs Amasya
  { id: 'k22_5', week: 22, homeTeamId: 10, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Bulancak vs Zonguldak
  { id: 'k22_6', week: 22, homeTeamId: 15, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Çayeli vs Karabük
  { id: 'k22_7', week: 22, homeTeamId: 14, awayTeamId: 16, homeScore: null, awayScore: null, isPlayed: false }, // Hopa vs Giresun
  { id: 'k22_8', week: 22, homeTeamId: 11, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Orduspor 1967 vs Düzce

  // Week 23
  { id: 'k23_1', week: 23, homeTeamId: 13, awayTeamId: 15, homeScore: null, awayScore: null, isPlayed: false }, // Amasya vs Çayeli
  { id: 'k23_2', week: 23, homeTeamId: 12, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Karabük vs Bulancak
  { id: 'k23_3', week: 23, homeTeamId: 2, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // 52 Ordu vs Hopa
  { id: 'k23_4', week: 23, homeTeamId: 7, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Düzce vs Sebat
  { id: 'k23_5', week: 23, homeTeamId: 8, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Pazar vs Yozgat
  { id: 'k23_6', week: 23, homeTeamId: 5, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Zonguldak vs Orduspor 1967
  { id: 'k23_7', week: 23, homeTeamId: 9, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Tokat vs Ereğli
  { id: 'k23_8', week: 23, homeTeamId: 16, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Giresun vs Fatsa

  // Week 24
  { id: 'k24_1', week: 24, homeTeamId: 10, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Bulancak vs Amasya
  { id: 'k24_2', week: 24, homeTeamId: 3, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Fatsa vs 52 Ordu
  { id: 'k24_3', week: 24, homeTeamId: 14, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Hopa vs Tokat
  { id: 'k24_4', week: 24, homeTeamId: 6, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Ereğli vs Düzce
  { id: 'k24_5', week: 24, homeTeamId: 11, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Orduspor 1967 vs Karabük
  { id: 'k24_6', week: 24, homeTeamId: 8, awayTeamId: 16, homeScore: null, awayScore: null, isPlayed: false }, // Pazar vs Giresun
  { id: 'k24_7', week: 24, homeTeamId: 1, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Sebat vs Zonguldak
  { id: 'k24_8', week: 24, homeTeamId: 4, awayTeamId: 15, homeScore: null, awayScore: null, isPlayed: false }, // Yozgat vs Çayeli

  // Week 25
  { id: 'k25_1', week: 25, homeTeamId: 2, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // 52 Ordu vs Pazar
  { id: 'k25_2', week: 25, homeTeamId: 13, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Amasya vs Orduspor 1967
  { id: 'k25_3', week: 25, homeTeamId: 15, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Çayeli vs Bulancak
  { id: 'k25_4', week: 25, homeTeamId: 7, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // Düzce vs Hopa
  { id: 'k25_5', week: 25, homeTeamId: 16, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Giresun vs Yozgat
  { id: 'k25_6', week: 25, homeTeamId: 12, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Karabük vs Sebat
  { id: 'k25_7', week: 25, homeTeamId: 9, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Tokat vs Fatsa
  { id: 'k25_8', week: 25, homeTeamId: 5, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Zonguldak vs Ereğli

  // Week 26
  { id: 'k26_1', week: 26, homeTeamId: 3, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Fatsa vs Düzce
  { id: 'k26_2', week: 26, homeTeamId: 16, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Giresun vs 52 Ordu
  { id: 'k26_3', week: 26, homeTeamId: 14, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Hopa vs Zonguldak
  { id: 'k26_4', week: 26, homeTeamId: 6, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Ereğli vs Karabük
  { id: 'k26_5', week: 26, homeTeamId: 11, awayTeamId: 15, homeScore: null, awayScore: null, isPlayed: false }, // Orduspor 1967 vs Çayeli
  { id: 'k26_6', week: 26, homeTeamId: 8, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Pazar vs Tokat
  { id: 'k26_7', week: 26, homeTeamId: 1, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Sebat vs Amasya
  { id: 'k26_8', week: 26, homeTeamId: 4, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Yozgat vs Bulancak

  // Week 27
  { id: 'k27_1', week: 27, homeTeamId: 2, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // 52 Ordu vs Yozgat
  { id: 'k27_2', week: 27, homeTeamId: 13, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Amasya vs Ereğli
  { id: 'k27_3', week: 27, homeTeamId: 10, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Bulancak vs Orduspor 1967
  { id: 'k27_4', week: 27, homeTeamId: 15, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Çayeli vs Sebat
  { id: 'k27_5', week: 27, homeTeamId: 7, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Düzce vs Pazar
  { id: 'k27_6', week: 27, homeTeamId: 12, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // Karabük vs Hopa
  { id: 'k27_7', week: 27, homeTeamId: 9, awayTeamId: 16, homeScore: null, awayScore: null, isPlayed: false }, // Tokat vs Giresun
  { id: 'k27_8', week: 27, homeTeamId: 5, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Zonguldak vs Fatsa

  // Week 28
  { id: 'k28_1', week: 28, homeTeamId: 2, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // 52 Ordu vs Tokat
  { id: 'k28_2', week: 28, homeTeamId: 3, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Fatsa vs Karabük
  { id: 'k28_3', week: 28, homeTeamId: 16, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Giresun vs Düzce
  { id: 'k28_4', week: 28, homeTeamId: 14, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Hopa vs Amasya
  { id: 'k28_5', week: 28, homeTeamId: 6, awayTeamId: 15, homeScore: null, awayScore: null, isPlayed: false }, // Ereğli vs Çayeli
  { id: 'k28_6', week: 28, homeTeamId: 8, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Pazar vs Zonguldak
  { id: 'k28_7', week: 28, homeTeamId: 1, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Sebat vs Bulancak
  { id: 'k28_8', week: 28, homeTeamId: 4, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Yozgat vs Orduspor 1967

  // Week 29
  { id: 'k29_1', week: 29, homeTeamId: 13, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Amasya vs Fatsa
  { id: 'k29_2', week: 29, homeTeamId: 10, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Bulancak vs Ereğli
  { id: 'k29_3', week: 29, homeTeamId: 15, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // Çayeli vs Hopa
  { id: 'k29_4', week: 29, homeTeamId: 7, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Düzce vs 52 Ordu
  { id: 'k29_5', week: 29, homeTeamId: 12, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Karabük vs Pazar
  { id: 'k29_6', week: 29, homeTeamId: 11, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Orduspor 1967 vs Sebat
  { id: 'k29_7', week: 29, homeTeamId: 4, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Yozgat vs Tokat
  { id: 'k29_8', week: 29, homeTeamId: 5, awayTeamId: 16, homeScore: null, awayScore: null, isPlayed: false }, // Zonguldak vs Giresun

  // Week 30
  { id: 'k30_1', week: 30, homeTeamId: 2, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // 52 Ordu vs Zonguldak
  { id: 'k30_2', week: 30, homeTeamId: 3, awayTeamId: 15, homeScore: null, awayScore: null, isPlayed: false }, // Fatsa vs Çayeli
  { id: 'k30_3', week: 30, homeTeamId: 16, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Giresun vs Karabük
  { id: 'k30_4', week: 30, homeTeamId: 14, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Hopa vs Bulancak
  { id: 'k30_5', week: 30, homeTeamId: 6, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Ereğli vs Orduspor 1967
  { id: 'k30_6', week: 30, homeTeamId: 8, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Pazar vs Amasya
  { id: 'k30_7', week: 30, homeTeamId: 1, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Sebat vs Yozgat
  { id: 'k30_8', week: 30, homeTeamId: 9, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Tokat vs Düzce
];


// --- TAVUK EVİ EFLANİ SPOR DATA (BAL 4. GRUP) ---
// Week 16 Standings
const EFLANI_TEAMS = [
  { id: 1, name: "Çarşambaspor", played: 17, won: 13, drawn: 3, lost: 1, gf: 35, ga: 7, gd: 28, pts: 42, form: [] },
  { id: 2, name: "Çankırı Futbol SK", played: 17, won: 12, drawn: 2, lost: 3, gf: 35, ga: 13, gd: 22, pts: 38, form: [] },
  { id: 3, name: "Ladik Belediyespor", played: 17, won: 9, drawn: 6, lost: 2, gf: 26, ga: 14, gd: 12, pts: 33, form: [] },
  { id: 4, name: "Sorgun Belediyespor", played: 17, won: 9, drawn: 5, lost: 3, gf: 27, ga: 15, gd: 12, pts: 32, form: [] },
  { id: 5, name: "Devrek Belediyespor", played: 17, won: 8, drawn: 3, lost: 6, gf: 29, ga: 17, gd: 12, pts: 27, form: [] },
  { id: 6, name: "1930 Bafra Spor", played: 17, won: 7, drawn: 3, lost: 7, gf: 19, ga: 22, gd: -3, pts: 24, form: [] },
  { id: 7, name: "Turhal 60 Futbol SK", played: 17, won: 5, drawn: 8, lost: 4, gf: 28, ga: 19, gd: 9, pts: 23, form: [] },
  { id: 10, name: "Merzifonspor", played: 17, won: 6, drawn: 4, lost: 7, gf: 17, ga: 22, gd: -5, pts: 22, form: [] },
  { id: 8, name: "Sinopspor", played: 17, won: 5, drawn: 5, lost: 7, gf: 20, ga: 21, gd: -1, pts: 20, form: [] },
  { id: 9, name: "AVS Çaycuma Spor Kulübü", played: 17, won: 6, drawn: 2, lost: 9, gf: 22, ga: 29, gd: -7, pts: 20, form: [] },
  { id: 11, name: "Tavuk Evi Eflani Spor Kulübü", played: 17, won: 4, drawn: 7, lost: 6, gf: 20, ga: 23, gd: -3, pts: 19, form: [] },
  { id: 12, name: "Yeniçağa Spor Kulübü", played: 17, won: 3, drawn: 3, lost: 11, gf: 16, ga: 33, gd: -17, pts: 12, form: [] },
  { id: 13, name: "Bartınspor", played: 17, won: 2, drawn: 3, lost: 12, gf: 10, ga: 31, gd: -21, pts: 9, form: [] },
  { id: 14, name: "Kırşehir Yetişen Yıldızlar Spor", played: 17, won: 2, drawn: 2, lost: 13, gf: 14, ga: 52, gd: -38, pts: 8, form: [] },
];

const EFLANI_FIXTURES = [
  // Week 17 — Kaynak: TFF 22.02.2026
  { id: 'e17_1', week: 17, homeTeamId: 9,  awayTeamId: 10, homeScore: 1, awayScore: 0, isPlayed: true }, // AVS Çaycuma 1-0 Merzifonspor
  { id: 'e17_2', week: 17, homeTeamId: 8,  awayTeamId: 5,  homeScore: 2, awayScore: 3, isPlayed: true }, // Sinopspor 2-3 Devrek Belediyespor
  { id: 'e17_3', week: 17, homeTeamId: 12, awayTeamId: 14, homeScore: 0, awayScore: 0, isPlayed: true }, // Yeniçağa 0-0 Kırşehir Yetişen Yıldızlar
  { id: 'e17_4', week: 17, homeTeamId: 3,  awayTeamId: 7,  homeScore: 2, awayScore: 1, isPlayed: true }, // Ladik Belediyespor 2-1 Turhal 60
  { id: 'e17_5', week: 17, homeTeamId: 13, awayTeamId: 11, homeScore: 2, awayScore: 1, isPlayed: true }, // Bartınspor 2-1 ASD Eflani Spor
  { id: 'e17_6', week: 17, homeTeamId: 2,  awayTeamId: 1,  homeScore: 1, awayScore: 0, isPlayed: true }, // Çankırı Futbol SK 1-0 Çarşambaspor
  { id: 'e17_7', week: 17, homeTeamId: 6,  awayTeamId: 4,  homeScore: 1, awayScore: 0, isPlayed: true }, // 1930 Bafra Spor 1-0 Sorgun Belediyespor

  // Week 18
  { id: 'e18_1', week: 18, homeTeamId: 11, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // ASD Eflani Spor - AVS Çaycumaspor
  { id: 'e18_2', week: 18, homeTeamId: 14, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Bartınspor
  { id: 'e18_3', week: 18, homeTeamId: 10, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Merzifonspor - Yeniçağa Spor
  { id: 'e18_4', week: 18, homeTeamId: 1, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Çarşambaspor - Sorgun Belediyespor
  { id: 'e18_5', week: 18, homeTeamId: 7, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Turhal 60 Futbol SK - Çankırı Futbol SK
  { id: 'e18_6', week: 18, homeTeamId: 5, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Devrek Belediyespor - Ladik Belediyespor
  { id: 'e18_7', week: 18, homeTeamId: 8, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - 1930 Bafraspor

  // Week 19
  { id: 'e19_1', week: 19, homeTeamId: 2, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Çankırı Futbol SK - ASD Eflani Spor
  { id: 'e19_2', week: 19, homeTeamId: 12, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Yeniçağa Spor - Bartınspor
  { id: 'e19_3', week: 19, homeTeamId: 4, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Sorgun Belediyespor - Merzifonspor
  { id: 'e19_4', week: 19, homeTeamId: 3, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Ladik Belediyespor - Sinopspor
  { id: 'e19_5', week: 19, homeTeamId: 9, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // AVS Çaycumaspor - Kırşehir Yetişen Yıldızlar
  { id: 'e19_6', week: 19, homeTeamId: 7, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Turhal 60 Futbol SK - Devrek Belediyespor
  { id: 'e19_7', week: 19, homeTeamId: 6, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // 1930 Bafraspor - Çarşambaspor

  // Week 20
  { id: 'e20_1', week: 20, homeTeamId: 11, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // ASD Eflani Spor - 1930 Bafraspor
  { id: 'e20_2', week: 20, homeTeamId: 13, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Bartınspor - AVS Çaycumaspor
  { id: 'e20_3', week: 20, homeTeamId: 8, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - Turhal 60 Futbol SK
  { id: 'e20_4', week: 20, homeTeamId: 10, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Merzifonspor - Çarşambaspor
  { id: 'e20_5', week: 20, homeTeamId: 5, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Devrek Belediyespor - Çankırı Futbol SK
  { id: 'e20_6', week: 20, homeTeamId: 14, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Yeniçağa Spor
  { id: 'e20_7', week: 20, homeTeamId: 3, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Ladik Belediyespor - Sorgun Belediyespor

  // Week 21
  { id: 'e21_1', week: 21, homeTeamId: 8, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - ASD Eflani Spor
  { id: 'e21_2', week: 21, homeTeamId: 2, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Çankırı Futbol SK - Ladik Belediyespor
  { id: 'e21_3', week: 21, homeTeamId: 6, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // 1930 Bafraspor - Merzifonspor
  { id: 'e21_4', week: 21, homeTeamId: 1, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Çarşambaspor - Devrek Belediyespor
  { id: 'e21_5', week: 21, homeTeamId: 7, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // Turhal 60 Futbol SK - Kırşehir Yetişen Yıldızlar
  { id: 'e21_6', week: 21, homeTeamId: 12, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Yeniçağa Spor - AVS Çaycumaspor
  { id: 'e21_7', week: 21, homeTeamId: 4, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Sorgun Belediyespor - Bartınspor

  // Week 22
  { id: 'e22_1', week: 22, homeTeamId: 11, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // ASD Eflani Spor - Ladik Belediyespor
  { id: 'e22_2', week: 22, homeTeamId: 13, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Bartınspor - 1930 Bafraspor
  { id: 'e22_3', week: 22, homeTeamId: 5, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Devrek Belediyespor - Merzifonspor
  { id: 'e22_4', week: 22, homeTeamId: 14, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Çarşambaspor
  { id: 'e22_5', week: 22, homeTeamId: 9, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // AVS Çaycumaspor - Turhal 60 Futbol SK
  { id: 'e22_6', week: 22, homeTeamId: 12, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Yeniçağa Spor - Sorgun Belediyespor
  { id: 'e22_7', week: 22, homeTeamId: 8, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - Çankırı Futbol SK

  // Week 23
  { id: 'e23_1', week: 23, homeTeamId: 7, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Turhal 60 Futbol SK - ASD Eflani Spor
  { id: 'e23_2', week: 23, homeTeamId: 3, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Ladik Belediyespor - Sinopspor
  { id: 'e23_3', week: 23, homeTeamId: 10, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Merzifonspor - Bartınspor
  { id: 'e23_4', week: 23, homeTeamId: 1, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Çarşambaspor - AVS Çaycumaspor
  { id: 'e23_5', week: 23, homeTeamId: 4, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Sorgun Belediyespor - Devrek Belediyespor
  { id: 'e23_6', week: 23, homeTeamId: 6, awayTeamId: 14, homeScore: null, awayScore: null, isPlayed: false }, // 1930 Bafraspor - Kırşehir Yetişen Yıldızlar
  { id: 'e23_7', week: 23, homeTeamId: 2, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // Çankırı Futbol SK - Yeniçağa Spor

  // Week 24
  { id: 'e24_1', week: 24, homeTeamId: 11, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // ASD Eflani Spor - Devrek Belediyespor
  { id: 'e24_2', week: 24, homeTeamId: 13, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Bartınspor - Ladik Belediyespor
  { id: 'e24_3', week: 24, homeTeamId: 14, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Merzifonspor
  { id: 'e24_4', week: 24, homeTeamId: 9, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // AVS Çaycumaspor - Çarşambaspor
  { id: 'e24_5', week: 24, homeTeamId: 12, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Yeniçağa Spor - Turhal 60 Futbol SK
  { id: 'e24_6', week: 24, homeTeamId: 8, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - Sorgun Belediyespor
  { id: 'e24_7', week: 24, homeTeamId: 2, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Çankırı Futbol SK - 1930 Bafraspor

  // Week 25
  { id: 'e25_1', week: 25, homeTeamId: 4, awayTeamId: 11, homeScore: null, awayScore: null, isPlayed: false }, // Sorgun Belediyespor - ASD Eflani Spor
  { id: 'e25_2', week: 25, homeTeamId: 5, awayTeamId: 13, homeScore: null, awayScore: null, isPlayed: false }, // Devrek Belediyespor - Bartınspor
  { id: 'e25_3', week: 25, homeTeamId: 10, awayTeamId: 9, homeScore: null, awayScore: null, isPlayed: false }, // Merzifonspor - AVS Çaycumaspor
  { id: 'e25_4', week: 25, homeTeamId: 3, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Ladik Belediyespor - Çankırı Futbol SK
  { id: 'e25_5', week: 25, homeTeamId: 7, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Turhal 60 Futbol SK - Çarşambaspor
  { id: 'e25_6', week: 25, homeTeamId: 6, awayTeamId: 12, homeScore: null, awayScore: null, isPlayed: false }, // 1930 Bafraspor - Yeniçağa Spor
  { id: 'e25_7', week: 25, homeTeamId: 14, awayTeamId: 8, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Sinopspor

  // Week 26 (Final)
  { id: 'e26_1', week: 26, homeTeamId: 11, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // ASD Eflani Spor - Çarşambaspor
  { id: 'e26_2', week: 26, homeTeamId: 13, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Bartınspor - Turhal 60 Futbol SK
  { id: 'e26_3', week: 26, homeTeamId: 8, awayTeamId: 10, homeScore: null, awayScore: null, isPlayed: false }, // Sinopspor - Merzifonspor
  { id: 'e26_4', week: 26, homeTeamId: 12, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Yeniçağa Spor - Ladik Belediyespor
  { id: 'e26_5', week: 26, homeTeamId: 2, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Çankırı Futbol SK - Sorgun Belediyespor
  { id: 'e26_6', week: 26, homeTeamId: 9, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // AVS Çaycumaspor - 1930 Bafraspor
  { id: 'e26_7', week: 26, homeTeamId: 14, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Kırşehir Yetişen Yıldızlar - Devrek Belediyespor
];

// --- KARABÜK 1. AMATÖR A GRUBU DATA ---
const AMATOR_A_TEAMS = [
  { id: 1, name: "Eskipazar Belediyespor", played: 6, won: 5, drawn: 1, lost: 0, gf: 51, ga: 7, gd: 44, pts: 16, form: [] },
  { id: 2, name: "Safranbolu Bağlarspor", played: 6, won: 5, drawn: 1, lost: 0, gf: 43, ga: 4, gd: 39, pts: 16, form: [] },
  { id: 3, name: "Yeşil Yenicespor", played: 6, won: 3, drawn: 1, lost: 2, gf: 16, ga: 23, gd: -7, pts: 10, form: [] },
  { id: 4, name: "Anadolu Gençlikspor", played: 6, won: 3, drawn: 0, lost: 3, gf: 15, ga: 19, gd: -4, pts: 9, form: [] },
  { id: 5, name: "Esentepe 3 Nisan Spor", played: 6, won: 1, drawn: 2, lost: 3, gf: 12, ga: 21, gd: -9, pts: 5, form: [] },
  { id: 6, name: "Beşbinevler Gücüspor", played: 6, won: 1, drawn: 0, lost: 5, gf: 4, ga: 22, gd: -18, pts: 3, form: [] },
  { id: 7, name: "Bozkurt 78 Spor", played: 6, won: 0, drawn: 1, lost: 5, gf: 7, ga: 52, gd: -45, pts: 1, form: [] },
];

const AMATOR_A_FIXTURES = [
  // Week 8
  { id: 'a8_1', week: 8, homeTeamId: 7, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Bozkurt 78 vs Yeşil Yenice
  { id: 'a8_2', week: 8, homeTeamId: 6, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Beşbinevler vs Saf. Bağlar
  { id: 'a8_3', week: 8, homeTeamId: 5, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // 3 Nisan vs Eskipazar
  
  // Week 9
  { id: 'a9_1', week: 9, homeTeamId: 2, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Saf. Bağlar vs Anadolu Gençlik
  { id: 'a9_2', week: 9, homeTeamId: 3, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Yeşil Yenice vs 3 Nisan
  { id: 'a9_3', week: 9, homeTeamId: 1, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Eskipazar vs Beşbinevler

  // Week 10
  { id: 'a10_1', week: 10, homeTeamId: 5, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // 3 Nisan vs Bozkurt 78
  { id: 'a10_2', week: 10, homeTeamId: 4, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Anadolu Gençlik vs Eskipazar
  { id: 'a10_3', week: 10, homeTeamId: 6, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Beşbinevler vs Yeşil Yenice

  // Week 11
  { id: 'a11_1', week: 11, homeTeamId: 1, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Eskipazar vs Saf. Bağlar
  { id: 'a11_2', week: 11, homeTeamId: 7, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Bozkurt 78 vs Beşbinevler
  { id: 'a11_3', week: 11, homeTeamId: 3, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Yeşil Yenice vs Anadolu Gençlik

  // Week 12
  { id: 'a12_1', week: 12, homeTeamId: 6, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Beşbinevler vs 3 Nisan
  { id: 'a12_2', week: 12, homeTeamId: 2, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Saf. Bağlar vs Yeşil Yenice
  { id: 'a12_3', week: 12, homeTeamId: 4, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Anadolu Gençlik vs Bozkurt 78

  // Week 13
  { id: 'a13_1', week: 13, homeTeamId: 3, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Yeşil Yenice vs Eskipazar
  { id: 'a13_2', week: 13, homeTeamId: 5, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // 3 Nisan vs Anadolu Gençlik
  { id: 'a13_3', week: 13, homeTeamId: 7, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // Bozkurt 78 vs Saf. Bağlar

  // Week 14
  { id: 'a14_1', week: 14, homeTeamId: 4, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Anadolu Gençlik vs Beşbinevler
  { id: 'a14_2', week: 14, homeTeamId: 1, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Eskipazar vs Bozkurt 78
  { id: 'a14_3', week: 14, homeTeamId: 2, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Saf. Bağlar vs 3 Nisan
];

// --- KARABÜK 1. AMATÖR B GRUBU DATA ---
const AMATOR_B_TEAMS = [
  { id: 1, name: "Yortanspor", played: 6, won: 5, drawn: 1, lost: 0, gf: 39, ga: 2, gd: 37, pts: 16, form: [] },
  { id: 2, name: "Safranboluspor", played: 6, won: 5, drawn: 1, lost: 0, gf: 33, ga: 2, gd: 31, pts: 16, form: [] },
  { id: 3, name: "Rüzgarlı FK", played: 6, won: 4, drawn: 0, lost: 2, gf: 17, ga: 16, gd: 1, pts: 12, form: [] },
  { id: 4, name: "5000 Evlerspor", played: 6, won: 3, drawn: 0, lost: 3, gf: 15, ga: 12, gd: 3, pts: 9, form: [] },
  { id: 5, name: "Burunsuz Karabükgücü", played: 6, won: 2, drawn: 0, lost: 4, gf: 17, ga: 24, gd: -7, pts: 6, form: [] },
  { id: 6, name: "Karabük Gençlerbirliği", played: 6, won: 1, drawn: 0, lost: 5, gf: 7, ga: 33, gd: -26, pts: 3, form: [] },
  { id: 7, name: "Karabük Birlikspor", played: 6, won: 0, drawn: 0, lost: 6, gf: 8, ga: 47, gd: -39, pts: 0, form: [] },
];

const AMATOR_B_FIXTURES = [
  // Week 8
  { id: 'b8_1', week: 8, homeTeamId: 6, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // K. Gençlerbirliği vs Rüzgarlı
  { id: 'b8_2', week: 8, homeTeamId: 2, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // Safranbolu vs Yortan
  { id: 'b8_3', week: 8, homeTeamId: 5, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Burunsuz vs K. Birlik

  // Week 9
  { id: 'b9_1', week: 9, homeTeamId: 1, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Yortan vs 5000 Evler
  { id: 'b9_2', week: 9, homeTeamId: 3, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Rüzgarlı vs Burunsuz
  { id: 'b9_3', week: 9, homeTeamId: 7, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // K. Birlik vs Safranbolu

  // Week 10
  { id: 'b10_1', week: 10, homeTeamId: 5, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // Burunsuz vs K. Gençlerbirliği
  { id: 'b10_2', week: 10, homeTeamId: 4, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // 5000 Evler vs K. Birlik
  { id: 'b10_3', week: 10, homeTeamId: 2, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Safranbolu vs Rüzgarlı

  // Week 11
  { id: 'b11_1', week: 11, homeTeamId: 7, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // K. Birlik vs Yortan
  { id: 'b11_2', week: 11, homeTeamId: 6, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // K. Gençlerbirliği vs Safranbolu
  { id: 'b11_3', week: 11, homeTeamId: 3, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Rüzgarlı vs 5000 Evler

  // Week 12
  { id: 'b12_1', week: 12, homeTeamId: 2, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Safranbolu vs Burunsuz
  { id: 'b12_2', week: 12, homeTeamId: 1, awayTeamId: 3, homeScore: null, awayScore: null, isPlayed: false }, // Yortan vs Rüzgarlı
  { id: 'b12_3', week: 12, homeTeamId: 4, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // 5000 Evler vs K. Gençlerbirliği

  // Week 13
  { id: 'b13_1', week: 13, homeTeamId: 3, awayTeamId: 7, homeScore: null, awayScore: null, isPlayed: false }, // Rüzgarlı vs K. Birlik
  { id: 'b13_2', week: 13, homeTeamId: 5, awayTeamId: 4, homeScore: null, awayScore: null, isPlayed: false }, // Burunsuz vs 5000 Evler
  { id: 'b13_3', week: 13, homeTeamId: 6, awayTeamId: 1, homeScore: null, awayScore: null, isPlayed: false }, // K. Gençlerbirliği vs Yortan

  // Week 14
  { id: 'b14_1', week: 14, homeTeamId: 4, awayTeamId: 2, homeScore: null, awayScore: null, isPlayed: false }, // 5000 Evler vs Safranbolu
  { id: 'b14_2', week: 14, homeTeamId: 7, awayTeamId: 6, homeScore: null, awayScore: null, isPlayed: false }, // K. Birlik vs K. Gençlerbirliği
  { id: 'b14_3', week: 14, homeTeamId: 1, awayTeamId: 5, homeScore: null, awayScore: null, isPlayed: false }, // Yortan vs Burunsuz
];


export const LEAGUES: Record<string, LeagueData> = {
  eflani: {
    id: 'eflani',
    name: 'Tavuk Evi Eflani Spor',
    leagueName: 'BÖLGESEL AMATÖR LİG 4. GRUP',
    shortName: 'Eflani Spor',
    currentWeek: 17,
    targetTeamName: 'Eflani',
    instagram: '@spor_eflani',
    teams: EFLANI_TEAMS,
    fixtures: EFLANI_FIXTURES,
    theme: {
      primary: 'bg-green-700',
      secondary: 'bg-green-900',
      accent: 'text-green-700',
      gradient: 'from-green-600 to-green-800',
      standingsHeaderBg: '#15803d',
      standingsRowBg: 'bg-green-50',
      exportGradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)',
      iconColor: 'text-green-700'
    }
  },
  karabuk: {
    id: 'karabuk',
    name: 'Karabük İdman Yurdu',
    leagueName: 'TFF 3. LİG 3. GRUP',
    shortName: 'KİY',
    currentWeek: 23,
    targetTeamName: 'Karabük İdman Yurdu',
    instagram: '@karabukidmanyurduspor',
    teams: KARABUK_TEAMS,
    fixtures: KARABUK_FIXTURES,
    theme: {
      primary: 'bg-red-700',
      secondary: 'bg-blue-900',
      accent: 'text-red-700',
      gradient: 'from-red-600 to-blue-800',
      standingsHeaderBg: '#1e3a8a',
      standingsRowBg: 'bg-slate-50',
      exportGradient: 'linear-gradient(135deg, #1e3a8a 0%, #dc2626 100%)',
      iconColor: 'text-red-700'
    }
  },
  amator_a: {
    id: 'amator_a',
    name: '1. Amatör A Grubu',
    leagueName: 'KARABÜK 1. AMATÖR A GRUBU',
    shortName: 'Amator A',
    currentWeek: 7,
    targetTeamName: '', 
    instagram: '@sporkarabuk',
    teams: AMATOR_A_TEAMS,
    fixtures: AMATOR_A_FIXTURES,
    theme: {
      primary: 'bg-orange-700',
      secondary: 'bg-orange-900',
      accent: 'text-orange-700',
      gradient: 'from-orange-600 to-red-800',
      standingsHeaderBg: '#c2410c',
      standingsRowBg: 'bg-orange-50',
      exportGradient: 'linear-gradient(135deg, #9a3412 0%, #7f1d1d 100%)',
      iconColor: 'text-orange-700'
    }
  },
  amator_b: {
    id: 'amator_b',
    name: '1. Amatör B Grubu',
    leagueName: 'KARABÜK 1. AMATÖR B GRUBU',
    shortName: 'Amator B',
    currentWeek: 7,
    targetTeamName: '', 
    instagram: '@sporkarabuk',
    teams: AMATOR_B_TEAMS,
    fixtures: AMATOR_B_FIXTURES,
    theme: {
      primary: 'bg-red-800',
      secondary: 'bg-slate-900',
      accent: 'text-red-800',
      gradient: 'from-red-700 to-slate-900',
      standingsHeaderBg: '#991b1b',
      standingsRowBg: 'bg-red-50',
      exportGradient: 'linear-gradient(135deg, #991b1b 0%, #450a0a 100%)',
      iconColor: 'text-red-800'
    }
  }
};
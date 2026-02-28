import { Team, Match } from '../types';

// ─── TFF Lig Konfigürasyonu ────────────────────────────────────────────────────
interface LeagueTFFConfig {
  grupID: string;
  pageID: string;
  maxHafta: number;
  /** true → TFF'den gelen tüm maçlar constants'ta yoksa eklenir */
  allowAddFromTFF?: boolean;
}

const LEAGUE_TFF_CONFIG: Record<string, LeagueTFFConfig> = {
  // Nesine 3. Lig Grup 3 — 16 takım, 34 haftaya kadar taranır (TFF bazen ekstra hafta ekler)
  'karabuk': { grupID: '2785', pageID: '971',  maxHafta: 34, allowAddFromTFF: true },
  // Bölgesel Amatör Lig — 14 takım, 26 hafta (güvenlik marjı: 30)
  'eflani':  { grupID: '3304', pageID: '1596', maxHafta: 30, allowAddFromTFF: true  },
};

// ─── KARABÜK 3. LİG TAKIM HARİTASI ─────────────────────────────────────────────
const KARABUK_KULUP_MAP: Record<number, number> = {
  10300: 1,   // Sebat Gençlik Spor
  4910:  2,   // 52 Orduspor FK
  4933:  3,   // Fatsa Belediyespor
  7787:  4,   // Yozgat Belediye Bozokspor
  2434:  5,   // TCH Group Zonguldakspor
  3690:  6,   // KDZ. Ereğli Belediye Spor
  98:    7,   // Düzce Cam Düzcespor
  3662:  8,   // Pazarspor
  11881: 9,   // Tokat Belediye Spor
  4193:  10,  // 1926 Bulancakspor
  4929:  11,  // Orduspor 1967 A.Ş.
  10580: 12,  // Karabük İdman Yurdu Spor
  2780:  13,  // Amasya Spor FK
  3634:  14,  // Artvin Hopaspor
  263:   15,  // Çayeli Spor Kulübü
  3629:  16,  // Giresunspor
};

// ─── EFLANİ BAL GRUP TAKIM HARİTASI ──────────────────────────────────────────
const EFLANI_KULUP_MAP: Record<number, number> = {
  3628:  1,   // Çarşambaspor
  8261:  2,   // Çankırı Futbol Spor Kulübü
  2554:  3,   // Ladik Belediyespor
  538:   4,   // Sorgun Belediyespor
  212:   5,   // Devrek Belediyespor
  3331:  6,   // 1930 Bafra Spor
  12922: 7,   // Turhal 60 Futbol Spor Kulübü
  5011:  8,   // Sinopspor
  3698:  9,   // AVS Çaycuma Spor Kulübü
  73:    10,  // Merzifonspor
  12410: 11,  // Tavuk Evi Eflani Spor
  1930:  12,  // Yeniçağa Spor Kulübü
  95:    13,  // Bartınspor
  13706: 14,  // Kırşehir Yetişen Yıldızlar Spor Kulübü
};

const KULUP_MAPS: Record<string, Record<number, number>> = {
  'karabuk': KARABUK_KULUP_MAP,
  'eflani':  EFLANI_KULUP_MAP,
};

// ─── Tipler ──────────────────────────────────────────────────────────────────
export interface TFFStanding {
  rank: number; kulupId: number; name: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; pts: number;
}
export interface TFFFixture {
  week: number;
  homeKulupId: number; homeTeamName: string;
  awayKulupId: number; awayTeamName: string;
  homeScore: number | null; awayScore: number | null; isPlayed: boolean;
}
export interface TFFSyncResult {
  success: boolean;
  standings: TFFStanding[];
  fixtures: TFFFixture[];
  lastUpdated: string;
  error?: string;
}

// ─── API çağrıları ─────────────────────────────────────────────────────────────
async function fetchTFFWeek(grupID: string, pageID: string, hafta: number): Promise<TFFSyncResult> {
  const params = new URLSearchParams({ grupID, pageID, hafta: String(hafta) });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`/api/tff-sync?${params}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`API hatası: ${response.status}`);
    return await response.json() as TFFSyncResult;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('TFF bağlantısı zaman aşımına uğradı');
    throw err;
  }
}

/**
 * En güncel geçerli haftayı otomatik bulur.
 * maxHafta'dan 1'e kadar geriye gider, standings dolu olan ilk haftayı döndürür.
 */
async function findLatestValidWeek(
  grupID: string, pageID: string, maxHafta: number
): Promise<{ data: TFFSyncResult; week: number } | null> {
  for (let hafta = maxHafta; hafta >= 1; hafta--) {
    try {
      const data = await fetchTFFWeek(grupID, pageID, hafta);
      if (data.success && data.standings && data.standings.length > 0) {
        return { data, week: hafta };
      }
    } catch (_) { /* devam */ }
  }
  return null;
}

/**
 * TAM senkronizasyon — hem puan durumu hem tüm haftaların fikstürü.
 *
 * Strateji:
 * 1. Güncel hafta sayfasını çek → puan durumu + o sayfadaki tüm fikstürler
 * 2. Güncel sayfada eksik kalan haftaları (1..currentWeek-1) tek tek çek
 * 3. Hepsini birleştir, skorları güncelle
 *
 * Bu yaklaşım hem verimli hem eksiksiz:
 * - TFF'nin "Fikstür Listesi" bölümü varsa tek çekişte tüm sezon gelir
 * - Yoksa her hafta ayrı ayrı çekilir (fallback)
 */
export async function fetchTFFData(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;

  // 1. Güncel haftayı bul — puan durumu ve mevcut fikstürler için
  const latest = await findLatestValidWeek(config.grupID, config.pageID, config.maxHafta);
  if (!latest) {
    return {
      success: false, standings: [], fixtures: [],
      lastUpdated: new Date().toISOString(),
      error: 'Güncel hafta verisi bulunamadı'
    };
  }

  const { data: latestData, week: currentWeek } = latest;

  // Güncel sayfadan gelen fikstürlerle başla
  const allFixtures: TFFFixture[] = [...(latestData.fixtures || [])];

  // 2. Güncel sayfada eksik olan haftaları tespit et
  const coveredWeeks = new Set(allFixtures.map(f => f.week));

  // Hafta 1'den currentWeek'e kadar hangileri eksik?
  const missingWeeks: number[] = [];
  for (let w = 1; w <= currentWeek; w++) {
    if (!coveredWeeks.has(w)) missingWeeks.push(w);
  }

  // 3. Eksik haftaları paralel çek
  if (missingWeeks.length > 0) {
    const missingResults = await Promise.all(
      missingWeeks.map(w =>
        fetchTFFWeek(config.grupID, config.pageID, w).catch(() => null)
      )
    );

    for (const result of missingResults) {
      if (!result?.success || !result.fixtures) continue;
      for (const f of result.fixtures) {
        mergeFixture(allFixtures, f);
      }
    }
  }

  // 4. Gelecek haftaları da çek (oynanmamış maçlar için fikstür tamamlansın)
  const futureWeeks: number[] = [];
  for (let w = currentWeek + 1; w <= config.maxHafta; w++) {
    if (!coveredWeeks.has(w)) futureWeeks.push(w);
  }
  if (futureWeeks.length > 0) {
    const futureResults = await Promise.all(
      futureWeeks.map(w =>
        fetchTFFWeek(config.grupID, config.pageID, w).catch(() => null)
      )
    );
    for (const result of futureResults) {
      if (!result?.success || !result.fixtures) continue;
      for (const f of result.fixtures) {
        mergeFixture(allFixtures, f);
      }
    }
  }

  // Hafta + takım sırasına göre sırala
  allFixtures.sort((a, b) => a.week - b.week || a.homeKulupId - b.homeKulupId);

  return { ...latestData, fixtures: allFixtures };
}

/**
 * Fikstür listesine maç ekle/güncelle — duplikasyon önle.
 * Var olan maç: skor güncelle (özellikle isPlayed: false → true geçişi için)
 * Yeni maç: ekle
 */
function mergeFixture(list: TFFFixture[], f: TFFFixture): void {
  const idx = list.findIndex(
    x => x.week === f.week &&
         x.homeKulupId === f.homeKulupId &&
         x.awayKulupId === f.awayKulupId
  );
  if (idx >= 0) {
    // Var olan maçı güncelle: yeni veri daha tazeyse (skor geldi ya da değişti)
    if (f.isPlayed || (!list[idx].isPlayed)) {
      list[idx] = f;
    }
  } else {
    list.push(f);
  }
}

/**
 * Hızlı güncelleme: sadece güncel hafta
 */
export async function fetchTFFDataQuick(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;
  const latest = await findLatestValidWeek(config.grupID, config.pageID, config.maxHafta);
  return latest?.data ?? null;
}

// ─── Puan durumu eşleştirme ───────────────────────────────────────────────────
export function mapTFFStandingsToTeams(
  tffStandings: TFFStanding[],
  localTeams: Team[],
  leagueId?: string
): Team[] {
  const kulupMap = leagueId ? (KULUP_MAPS[leagueId] ?? {}) : {};

  return tffStandings.map((tffTeam, index) => {
    const mappedId = kulupMap[tffTeam.kulupId];
    const matched  = mappedId
      ? localTeams.find(t => t.id === mappedId)
      : findMatchingTeam(tffTeam.name, localTeams);

    return {
      id:     matched?.id ?? (index + 1),
      name:   matched?.name ?? tffTeam.name,
      played: tffTeam.played,
      won:    tffTeam.won,
      drawn:  tffTeam.drawn,
      lost:   tffTeam.lost,
      gf:     tffTeam.gf,
      ga:     tffTeam.ga,
      gd:     tffTeam.gd,
      pts:    tffTeam.pts,
      form:   matched?.form ?? [],
    };
  });
}

// ─── Fikstür güncelleme ───────────────────────────────────────────────────────
export function mapTFFFixturesToMatches(
  tffFixtures: TFFFixture[],
  localTeams: Team[],
  baseFixtures: Match[],
  leagueId?: string
): Match[] {
  const kulupMap = leagueId ? (KULUP_MAPS[leagueId] ?? {}) : {};
  const config    = leagueId ? LEAGUE_TFF_CONFIG[leagueId] : undefined;
  const allowAdd  = config?.allowAddFromTFF ?? false;

  const updatedMatches = baseFixtures.map(m => ({ ...m }));

  for (const tffMatch of tffFixtures) {
    const homeLocalId = resolveTeamId(tffMatch.homeKulupId, tffMatch.homeTeamName, kulupMap, localTeams);
    const awayLocalId = resolveTeamId(tffMatch.awayKulupId, tffMatch.awayTeamName, kulupMap, localTeams);

    if (!homeLocalId || !awayLocalId) continue;
    if (homeLocalId === awayLocalId) continue;

    const existingIdx = updatedMatches.findIndex(
      m => m.week === tffMatch.week &&
           m.homeTeamId === homeLocalId &&
           m.awayTeamId === awayLocalId
    );

    if (existingIdx >= 0) {
      // Her durumda güncelle: skor eklendi ya da değişti
      updatedMatches[existingIdx] = {
        ...updatedMatches[existingIdx],
        homeScore: tffMatch.homeScore,
        awayScore: tffMatch.awayScore,
        isPlayed:  tffMatch.isPlayed,
      };
    } else if (allowAdd) {
      // allowAddFromTFF = true liglerde: yeni maçları ekle (hem oynanan hem oynanmamış)
      updatedMatches.push({
        id:         `tff_${tffMatch.week}_${homeLocalId}_${awayLocalId}`,
        week:       tffMatch.week,
        homeTeamId: homeLocalId,
        awayTeamId: awayLocalId,
        homeScore:  tffMatch.homeScore,
        awayScore:  tffMatch.awayScore,
        isPlayed:   tffMatch.isPlayed,
      });
    }
  }

  // Hafta sırasına göre sırala
  updatedMatches.sort((a, b) => a.week - b.week);

  return updatedMatches;
}

// ─── Yardımcı: kulupId veya isim ile local ID çöz ────────────────────────────
function resolveTeamId(
  kulupId: number,
  teamName: string,
  kulupMap: Record<number, number>,
  localTeams: Team[]
): number | undefined {
  const fromMap = kulupMap[kulupId];
  if (fromMap) return fromMap;

  const matched = findMatchingTeam(teamName, localTeams);
  if (matched) {
    return matched.id;
  }

  // Silently return undefined to avoid console spam, App.tsx handles this
  return undefined;
}

// ─── İsim normalize & eşleştirme ─────────────────────────────────────────────
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/([A-Z0-9])SPOR\b/g, '$1 SPOR')
    .replace(/\bBELEDIYESI\b/g, 'BELEDIYE')
    .replace(/\bBELEDIYESPOR\b/g, 'BELEDIYE SPOR')
    .replace(/\bKULUBU\b/g, '').replace(/\bFK\b/g, '')
    .replace(/\bA\.S\b/g, '').replace(/\bA\.S\.\b/g, '')
    .replace(/\bASD\b/g, '').replace(/\bAVS\b/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingTeam(tffName: string, localTeams: Team[]): Team | undefined {
  const normTFF = normalizeName(tffName);
  const exact = localTeams.find(t => normalizeName(t.name) === normTFF);
  if (exact) return exact;
  const contains = localTeams.find(t => {
    const ln = normalizeName(t.name);
    return normTFF.includes(ln) || ln.includes(normTFF);
  });
  if (contains) return contains;
  const scored = localTeams.map(t => {
    const ln    = normalizeName(t.name);
    const wA    = normTFF.split(' ').filter(w => w.length >= 5);
    const setB  = new Set(ln.split(' ').filter(w => w.length >= 5));
    const overlap = wA.filter(w => setB.has(w)).length;
    return { team: t, overlap };
  }).filter(x => x.overlap >= 2);
  if (scored.length === 1) return scored[0].team;
  if (scored.length > 1)   return scored.sort((a, b) => b.overlap - a.overlap)[0].team;
  return undefined;
}

export function hasTFFSync(leagueId: string): boolean {
  return leagueId in LEAGUE_TFF_CONFIG;
}

export function needsFullAutoSync(leagueId: string): boolean {
  // Her iki lig için de tam sync gerekli
  return leagueId in LEAGUE_TFF_CONFIG;
}

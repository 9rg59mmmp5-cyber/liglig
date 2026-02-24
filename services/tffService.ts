import { Team, Match } from '../types';

// ─── TFF Lig Konfigürasyonu ────────────────────────────────────────────────────
const LEAGUE_TFF_CONFIG: Record<string, { grupID: string; pageID: string; maxHafta: number }> = {
  'karabuk': { grupID: '2785', pageID: '971',  maxHafta: 30 }, // Nesine 3. Lig Grup 03
  'eflani':  { grupID: '3304', pageID: '1596', maxHafta: 26 }, // Bölgesel Amatör Lig Grup 4
};

// ─── KARABÜK 16 TAKIM — TFF kulupId → local team id ──────────────────────────
// Kaynak: tff.org/Default.aspx?pageID=28&kulupID=XXXX
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

const KULUP_MAPS: Record<string, Record<number, number>> = {
  'karabuk': KARABUK_KULUP_MAP,
};

// ─── Tipler ──────────────────────────────────────────────────────────────────
interface TFFStanding {
  rank: number; kulupId: number; name: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; pts: number;
}
interface TFFFixture {
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
  const response = await fetch(`/api/tff-sync?${params}`);
  if (!response.ok) throw new Error(`API hatası: ${response.status}`);
  return await response.json() as TFFSyncResult;
}

/** Tam güncelleme: puan durumu + tüm haftaların fikstürü */
export async function fetchTFFData(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;

  // Puan durumu en son haftadan alınır (her zaman güncel)
  const latestData = await fetchTFFWeek(config.grupID, config.pageID, config.maxHafta);
  if (!latestData.success) return latestData;

  // Tüm haftaların fikstürlerini paralel çek
  const weekPromises = Array.from({ length: config.maxHafta }, (_, i) =>
    fetchTFFWeek(config.grupID, config.pageID, i + 1).catch(() => null)
  );
  const weekResults = await Promise.all(weekPromises);

  const allFixtures: TFFFixture[] = [];
  for (const result of weekResults) {
    if (result?.success && result.fixtures) {
      for (const f of result.fixtures) {
        const exists = allFixtures.some(
          x => x.week === f.week && x.homeKulupId === f.homeKulupId && x.awayKulupId === f.awayKulupId
        );
        if (!exists) allFixtures.push(f);
      }
    }
  }

  return { ...latestData, fixtures: allFixtures };
}

/** Hızlı güncelleme: sadece puan durumu (son hafta) */
export async function fetchTFFDataQuick(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;
  return fetchTFFWeek(config.grupID, config.pageID, config.maxHafta);
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
/**
 * TFF fikstür sonuçlarını constants'taki fikstüre uygular.
 *
 * KRİTİK DEĞİŞİKLİK: SADECE mevcut maçları günceller, asla yeni maç eklemez.
 * Bu sayede hafta 1-21'deki yüzlerce maçın birikimi önlenir.
 * Puan durumu zaten doğrudan TFF'den (tffStandings) gelir.
 *
 * @param tffFixtures    TFF'den gelen maç sonuçları
 * @param localTeams     Yerel takım listesi
 * @param baseFixtures   Constants'tan gelen ORİJİNAL fikstür (localStorage değil!)
 * @param leagueId       Lig kimliği (kulupId haritası için)
 */
export function mapTFFFixturesToMatches(
  tffFixtures: TFFFixture[],
  localTeams: Team[],
  baseFixtures: Match[],
  leagueId?: string
): Match[] {
  const kulupMap = leagueId ? (KULUP_MAPS[leagueId] ?? {}) : {};
  // Orijinal fikstürün kopyasından başla
  const updatedMatches = baseFixtures.map(m => ({ ...m }));

  for (const tffMatch of tffFixtures) {
    if (!tffMatch.isPlayed) continue;

    const homeLocalId = kulupMap[tffMatch.homeKulupId];
    const awayLocalId = kulupMap[tffMatch.awayKulupId];

    if (!homeLocalId || !awayLocalId) continue;   // bilinmeyen takım → atla
    if (homeLocalId === awayLocalId) continue;     // aynı takım iki kez → kesinlikle hata

    // Sadece mevcut maçı bul ve güncelle — yeni maç ekleme!
    const existingIdx = updatedMatches.findIndex(
      m => m.week === tffMatch.week &&
           m.homeTeamId === homeLocalId &&
           m.awayTeamId === awayLocalId
    );

    if (existingIdx >= 0) {
      updatedMatches[existingIdx] = {
        ...updatedMatches[existingIdx],
        homeScore: tffMatch.homeScore,
        awayScore: tffMatch.awayScore,
        isPlayed:  true,
      };
    }
    // existingIdx === -1 ise → maç constants'ta yok, ekleme!
  }

  return updatedMatches;
}

// ─── İsim eşleştirme (kulupId map başarısız olursa fallback) ─────────────────
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/([A-Z0-9])SPOR\b/g, '$1 SPOR')   // PAZARSPOR → PAZAR SPOR
    .replace(/\bBELEDIYESI\b/g, 'BELEDIYE')
    .replace(/\bBELEDIYESPOR\b/g, 'BELEDIYE SPOR')
    .replace(/\bKULUBU\b/g, '').replace(/\bFK\b/g, '')
    .replace(/\bA\.S\b/g, '').replace(/\bA\.S\.\b/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingTeam(tffName: string, localTeams: Team[]): Team | undefined {
  const normTFF = normalizeName(tffName);

  // 1. Tam eşleşme
  const exact = localTeams.find(t => normalizeName(t.name) === normTFF);
  if (exact) return exact;

  // 2. Biri diğerini içeriyor
  const contains = localTeams.find(t => {
    const ln = normalizeName(t.name);
    return normTFF.includes(ln) || ln.includes(normTFF);
  });
  if (contains) return contains;

  // 3. En az 2 uzun kelime örtüşmesi (5+ harf)
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

import { Team, Match } from '../types';

// ─── TFF Lig Konfigürasyonu ────────────────────────────────────────────────────
interface LeagueTFFConfig {
  grupID: string;
  pageID: string;
  maxHafta: number;
  /** true → TFF'den gelen maçlar constants'ta yoksa eklenir (ilk sezon maçları eksik olan ligler için) */
  allowAddFromTFF?: boolean;
}

const LEAGUE_TFF_CONFIG: Record<string, LeagueTFFConfig> = {
  'karabuk': { grupID: '2785', pageID: '971', maxHafta: 34 },
  'eflani':  { grupID: '3304', pageID: '1596', maxHafta: 26, allowAddFromTFF: true },
  'amator_a': { grupID: '3448', pageID: '1633', maxHafta: 14 },
  'amator_b': { grupID: '3449', pageID: '1633', maxHafta: 14 },
};

// ─── KARABÜK 3. LİG TAKIM HARİTASI ─────────────────────────────────────────────
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

// ─── EFLANİ BAL 4. GRUP TAKIM HARİTASI ──────────────────────────────────────────
// 14 takımın tamamı: tff.org/Default.aspx?pageID=28&kulupID=XXXX
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
  12410: 11,  // Tavuk Evi Eflani Spor / ASD Eflani Spor Kulübü
  1930:  12,  // Yeniçağa Spor Kulübü
  95:    13,  // Bartınspor
  13706: 14,  // Kırşehir Yetişen Yıldızlar Spor Kulübü
  3622:  15,  // Samsun Büyükşehir Belediyespor
  2562:  16,  // Gümüşhanespor
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
  const response = await fetch(`/api/tff-sync?${params}`);
  if (!response.ok) throw new Error(`API hatası: ${response.status}`);
  return await response.json() as TFFSyncResult;
}

/**
 * En güncel geçerli haftayı otomatik bulur.
 * Önce maxHafta'dan geriye doğru, bulamazsa 1'den ileri doğru arar.
 */
async function findLatestValidWeek(
  grupID: string, pageID: string, maxHafta: number
): Promise<{ data: TFFSyncResult; week: number } | null> {
  // maxHafta'dan geriye doğru ara (sezon sonuna yakın ligler için)
  for (let hafta = maxHafta; hafta >= 1; hafta--) {
    try {
      const data = await fetchTFFWeek(grupID, pageID, hafta);
      if (data.success && data.standings && data.standings.length > 0) {
        return { data, week: hafta };
      }
    } catch (_) { /* devam et */ }
  }
  return null;
}

/** Tam güncelleme: puan durumu + tüm haftaların fikstürü */
export async function fetchTFFData(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;

  // Mevcut en güncel haftayı bul (puan durumu için)
  const latest = await findLatestValidWeek(config.grupID, config.pageID, config.maxHafta);
  if (!latest) {
    return { success: false, standings: [], fixtures: [], lastUpdated: new Date().toISOString(), error: 'Güncel hafta verisi bulunamadı' };
  }

  const { data: latestData } = latest;

  // Kullanıcı isteği: Her haftayı tek tek kontrol et (özellikle Eflani gibi BAL ligleri için)
  // config.maxHafta'ya kadar tüm haftaları paralel çekiyoruz
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

/** Hızlı güncelleme: sadece en son hafta (puan durumu + o haftanın fikstürü) */
export async function fetchTFFDataQuick(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;
  // En güncel geçerli haftayı otomatik bul
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
/**
 * TFF fikstür verilerini yerel maç listesine uygular.
 *
 * Karabük (allowAddFromTFF = false, varsayılan):
 *   - Sadece constants'ta var olan maçları günceller. Asla yeni maç eklemez.
 *   - Birikme hatası yaşanmaz.
 *
 * Eflani (allowAddFromTFF = true):
 *   - Var olan maçları günceller.
 *   - constants'ta henüz olmayan (hafta 1-16) oynanan maçları ekler.
 *   - Aynı hafta+ev+deplasman çifti için asla duplikasyon yapmaz.
 */
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
  let nextId = Math.max(0, ...updatedMatches.map(m => (typeof m.id === 'number' ? m.id : 0))) + 1;

  for (const tffMatch of tffFixtures) {
    // Henüz oynanmamış maçları ekleme/güncelleme
    const homeLocalId = resolveTeamId(tffMatch.homeKulupId, tffMatch.homeTeamName, kulupMap, localTeams);
    const awayLocalId = resolveTeamId(tffMatch.awayKulupId, tffMatch.awayTeamName, kulupMap, localTeams);

    if (!homeLocalId || !awayLocalId) continue;   // bilinmeyen takım → atla
    if (homeLocalId === awayLocalId) continue;     // aynı takım × güvenlik

    const existingIdx = updatedMatches.findIndex(
      m => m.week === tffMatch.week &&
           m.homeTeamId === homeLocalId &&
           m.awayTeamId === awayLocalId
    );

    if (existingIdx >= 0) {
      // Mevcut maçı güncelle
      if (tffMatch.isPlayed) {
        updatedMatches[existingIdx] = {
          ...updatedMatches[existingIdx],
          homeScore: tffMatch.homeScore,
          awayScore: tffMatch.awayScore,
          isPlayed:  true,
        };
      }
    } else if (allowAdd && tffMatch.isPlayed) {
      // Yalnızca allowAddFromTFF = true LİGLERDE ve SADECE oynanan maçlar için ekle
      updatedMatches.push({
        id:         nextId++,
        week:       tffMatch.week,
        homeTeamId: homeLocalId,
        awayTeamId: awayLocalId,
        homeScore:  tffMatch.homeScore,
        awayScore:  tffMatch.awayScore,
        isPlayed:   true,
      });
    }
  }

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
  // Haritada yok → isim eşleştirme (güvenli fallback)
  return findMatchingTeam(teamName, localTeams)?.id;
}

// ─── İsim normalize & eşleştirme (fallback) ──────────────────────────────────
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

/**
 * BAL gibi ligler için otomatik sync'te TÜM haftalar çekilmeli (tam senkronizasyon).
 * Nesine 3. Lig gibi liglerde sadece son hafta yeterlidir (hız için).
 */
export function needsFullAutoSync(leagueId: string): boolean {
  return LEAGUE_TFF_CONFIG[leagueId]?.allowAddFromTFF === true;
}

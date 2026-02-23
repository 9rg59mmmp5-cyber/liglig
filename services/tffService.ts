import { Team, Match } from '../types';

// TFF grupID → League config mapping
const LEAGUE_TFF_CONFIG: Record<string, { grupID: string; pageID: string; hafta: string }> = {
  'karabuk': { grupID: '2785', pageID: '971',  hafta: '32' }, // Nesine 3. Lig Grup 03
  'eflani':  { grupID: '3304', pageID: '1596', hafta: '26' }, // Bölgesel Amatör Lig Grup 4
};

interface TFFStanding {
  rank: number;
  kulupId: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

interface TFFFixture {
  week: number;
  homeKulupId: number;
  homeTeamName: string;
  awayKulupId: number;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
}

interface TFFSyncResult {
  success: boolean;
  standings: TFFStanding[];
  fixtures: TFFFixture[];
  lastUpdated: string;
  error?: string;
}

/**
 * TFF'den canlı puan durumu ve fikstür verisini çeker.
 * Sadece LEAGUE_TFF_CONFIG'de tanımlı ligler için çalışır.
 */
export async function fetchTFFData(leagueId: string): Promise<TFFSyncResult | null> {
  const config = LEAGUE_TFF_CONFIG[leagueId];
  if (!config) return null;

  const params = new URLSearchParams({
    grupID: config.grupID,
    pageID: config.pageID,
    hafta:  config.hafta,
  });
  const response = await fetch(`/api/tff-sync?${params}`);
  if (!response.ok) throw new Error(`API hatası: ${response.status}`);
  return await response.json() as TFFSyncResult;
}

/**
 * TFF puan durumunu, yerel takım ID'leriyle eşleştirerek Team[] formatına çevirir.
 * Ad eşleştirmesi yapar (normalize ederek).
 */
export function mapTFFStandingsToTeams(
  tffStandings: TFFStanding[],
  localTeams: Team[]
): Team[] {
  return tffStandings.map((tffTeam, index) => {
    // Yerel takımla isim bazlı eşleştir
    const matched = findMatchingTeam(tffTeam.name, localTeams);
    const teamId = matched?.id ?? (index + 1);

    return {
      id: teamId,
      name: matched?.name ?? tffTeam.name,
      played: tffTeam.played,
      won: tffTeam.won,
      drawn: tffTeam.drawn,
      lost: tffTeam.lost,
      gf: tffTeam.gf,
      ga: tffTeam.ga,
      gd: tffTeam.gd,
      pts: tffTeam.pts,
      form: matched?.form ?? [],
    };
  });
}

/**
 * TFF fikstürlerini Match[] formatına çevirir.
 * Sadece oynanan maçlar dahil edilir.
 */
export function mapTFFFixturesToMatches(
  tffFixtures: TFFFixture[],
  localTeams: Team[],
  existingMatches: Match[]
): Match[] {
  const updatedMatches = [...existingMatches];

  for (const tffMatch of tffFixtures) {
    if (!tffMatch.isPlayed) continue;

    const homeTeam = findMatchingTeam(tffMatch.homeTeamName, localTeams);
    const awayTeam = findMatchingTeam(tffMatch.awayTeamName, localTeams);

    if (!homeTeam || !awayTeam) continue;

    // Aynı hafta + aynı eşleşme var mı kontrol et
    const existingIdx = updatedMatches.findIndex(
      m => m.week === tffMatch.week &&
           m.homeTeamId === homeTeam.id &&
           m.awayTeamId === awayTeam.id
    );

    const matchData: Match = {
      id: existingIdx >= 0
        ? updatedMatches[existingIdx].id
        : `tff_${tffMatch.week}_${homeTeam.id}_${awayTeam.id}`,
      week: tffMatch.week,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeScore: tffMatch.homeScore,
      awayScore: tffMatch.awayScore,
      isPlayed: true,
    };

    if (existingIdx >= 0) {
      updatedMatches[existingIdx] = matchData;
    } else {
      updatedMatches.push(matchData);
    }
  }

  return updatedMatches;
}

// --- Yardımcı: İsim normalleştirme ile eşleştirme ---
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingTeam(tffName: string, localTeams: Team[]): Team | undefined {
  const normalizedTFF = normalizeName(tffName);

  // Önce tam eşleşme dene
  const exact = localTeams.find(t => normalizeName(t.name) === normalizedTFF);
  if (exact) return exact;

  // Kısmi eşleşme — TFF adı yerel adı içeriyor mu veya tersi
  const partial = localTeams.find(t => {
    const localNorm = normalizeName(t.name);
    return normalizedTFF.includes(localNorm) || localNorm.includes(normalizedTFF) ||
      // İlk 5 kelime benzerliği
      hasKeywordOverlap(normalizedTFF, localNorm);
  });

  return partial;
}

function hasKeywordOverlap(a: string, b: string): boolean {
  const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
  const wordsB = b.split(' ').filter(w => w.length > 3);
  return wordsB.some(w => wordsA.has(w));
}

// Hangi liglerin TFF sync desteği var
export function hasTFFSync(leagueId: string): boolean {
  return leagueId in LEAGUE_TFF_CONFIG;
}

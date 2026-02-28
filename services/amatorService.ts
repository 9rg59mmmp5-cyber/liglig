import { Team, Match } from '../types';

// ─── Tipler ──────────────────────────────────────────────────────────────────
export interface AmatorStanding {
  rank: number;
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

export interface AmatorFixture {
  week: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
}

export interface AmatorGroupResult {
  standings: AmatorStanding[];
  fixtures: AmatorFixture[];
}

export interface AmatorSyncResult {
  success: boolean;
  groups: {
    amator_a: AmatorGroupResult;
    amator_b: AmatorGroupResult;
  };
  lastUpdated: string;
  error?: string;
}

// ─── API çağrısı ─────────────────────────────────────────────────────────────
export async function fetchAmatorData(): Promise<AmatorSyncResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/amator-sync', { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`API hatası: ${response.status}`);
    return await response.json() as AmatorSyncResult;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('ASKF bağlantısı zaman aşımına uğradı');
    throw err;
  }
}

// ─── Puan durumu eşleştirme ─────────────────────────────────────────────────
export function mapAmatorStandingsToTeams(
  askfStandings: AmatorStanding[],
  localTeams: Team[]
): Team[] {
  if (!askfStandings || askfStandings.length === 0) return localTeams;

  return askfStandings.map((askfTeam, index) => {
    const matched = findMatchingAmatorTeam(askfTeam.name, localTeams);

    return {
      id: matched?.id ?? (index + 1),
      name: matched?.name ?? askfTeam.name,
      played: askfTeam.played,
      won: askfTeam.won,
      drawn: askfTeam.drawn,
      lost: askfTeam.lost,
      gf: askfTeam.gf,
      ga: askfTeam.ga,
      gd: askfTeam.gd,
      pts: askfTeam.pts,
      form: matched?.form ?? [],
    };
  });
}

// ─── Fikstür güncelleme ─────────────────────────────────────────────────────
export function mapAmatorFixturesToMatches(
  askfFixtures: AmatorFixture[],
  localTeams: Team[],
  baseFixtures: Match[]
): Match[] {
  if (!askfFixtures || askfFixtures.length === 0) return baseFixtures;

  const updatedMatches = baseFixtures.map(m => ({ ...m }));

  for (const askfMatch of askfFixtures) {
    const homeTeam = findMatchingAmatorTeam(askfMatch.homeTeamName, localTeams);
    const awayTeam = findMatchingAmatorTeam(askfMatch.awayTeamName, localTeams);

    if (!homeTeam || !awayTeam) continue;
    if (homeTeam.id === awayTeam.id) continue;

    const existingIdx = updatedMatches.findIndex(
      m => m.week === askfMatch.week &&
           m.homeTeamId === homeTeam.id &&
           m.awayTeamId === awayTeam.id
    );

    if (existingIdx >= 0) {
      // Mevcut maçı güncelle
      updatedMatches[existingIdx] = {
        ...updatedMatches[existingIdx],
        homeScore: askfMatch.homeScore,
        awayScore: askfMatch.awayScore,
        isPlayed: askfMatch.isPlayed,
      };
    } else {
      // Yeni maç ekle
      updatedMatches.push({
        id: `askf_${askfMatch.week}_${homeTeam.id}_${awayTeam.id}`,
        week: askfMatch.week,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeScore: askfMatch.homeScore,
        awayScore: askfMatch.awayScore,
        isPlayed: askfMatch.isPlayed,
      });
    }
  }

  updatedMatches.sort((a, b) => a.week - b.week);
  return updatedMatches;
}

// ─── ASKF → Local isim eşleştirme haritası ──────────────────────────────────
// ASKF sitesindeki isimler ile constants.ts'deki isimler farklı olabiliyor.
// Bu harita kesin eşleştirme sağlar.
const ASKF_NAME_ALIASES: Record<string, string> = {
  // A Grubu
  'eskipazar belediyespor':   'Eskipazar Belediyespor',
  'safranbolu bağlarspor':    'Safranbolu Bağlarspor',
  'yeşil yenice spor':        'Yeşil Yenicespor',
  'karabük anadolu gsk':      'Anadolu Gençlikspor',
  'karabük anadolu gençlik':  'Anadolu Gençlikspor',
  'karabük 3 nisan spor':     'Esentepe 3 Nisan Spor',
  'karabük 3 nisan':          'Esentepe 3 Nisan Spor',
  'beşbinevlergücüspor':      'Beşbinevler Gücüspor',
  'besbinevlergücüspor':      'Beşbinevler Gücüspor',
  '78 bozkurt spor kulübü':   'Bozkurt 78 Spor',
  '78 bozkurt spor':          'Bozkurt 78 Spor',
  // B Grubu
  'yortanspor':               'Yortanspor',
  'safranbolu spor':          'Safranboluspor',
  'safranboluspor':           'Safranboluspor',
  'rüzgarlı fk':              'Rüzgarlı FK',
  'rüzgarlı':                 'Rüzgarlı FK',
  '5000 evler spor':          '5000 Evlerspor',
  '5000 evlerspor':           '5000 Evlerspor',
  'burunsuz karabükgücüspor': 'Burunsuz Karabükgücü',
  'burunsuz karabükgücü':     'Burunsuz Karabükgücü',
  'k.gençlerbirliği spor':    'Karabük Gençlerbirliği',
  'karabük gençlerbirliği':   'Karabük Gençlerbirliği',
  'k.gençlerbirligi spor':    'Karabük Gençlerbirliği',
  'karabük birlik spor':      'Karabük Birlikspor',
  'karabük birlikspor':       'Karabük Birlikspor',
};

// ─── İsim normalize & eşleştirme ─────────────────────────────────────────────
function normalizeForLookup(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/([A-Z0-9])SPOR\b/g, '$1 SPOR')
    .replace(/\bBELEDIYESI\b/g, 'BELEDIYE')
    .replace(/\bBELEDIYESPOR\b/g, 'BELEDIYE SPOR')
    .replace(/\bKULUBU\b/g, '').replace(/\bFK\b/g, '')
    .replace(/\bGSK\b/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingAmatorTeam(askfName: string, localTeams: Team[]): Team | undefined {
  // 1. Önce alias haritasına bak (en güvenilir)
  const lookupKey = normalizeForLookup(askfName);
  const aliasTarget = ASKF_NAME_ALIASES[lookupKey];
  if (aliasTarget) {
    const found = localTeams.find(t => t.name === aliasTarget);
    if (found) return found;
  }

  // 2. Alias'ta bulunamadıysa kısmi alias eşleştirmesi dene
  for (const [aliasKey, aliasVal] of Object.entries(ASKF_NAME_ALIASES)) {
    if (lookupKey.includes(aliasKey) || aliasKey.includes(lookupKey)) {
      const found = localTeams.find(t => t.name === aliasVal);
      if (found) return found;
    }
  }

  // 3. Normalize edilmiş exact match
  const normASKF = normalizeName(askfName);
  const exact = localTeams.find(t => normalizeName(t.name) === normASKF);
  if (exact) return exact;

  // 4. Contains match
  const contains = localTeams.find(t => {
    const ln = normalizeName(t.name);
    return normASKF.includes(ln) || ln.includes(normASKF);
  });
  if (contains) return contains;

  // 5. Kelime örtüşme — sadece 2+ kelime eşleşirse kabul et (1 kelime çok belirsiz)
  const scored = localTeams.map(t => {
    const ln = normalizeName(t.name);
    const wA = normASKF.split(' ').filter(w => w.length >= 3);
    const setB = new Set(ln.split(' ').filter(w => w.length >= 3));
    const overlap = wA.filter(w => setB.has(w)).length;
    return { team: t, overlap };
  }).filter(x => x.overlap >= 2);

  if (scored.length === 1) return scored[0].team;
  if (scored.length > 1) return scored.sort((a, b) => b.overlap - a.overlap)[0].team;

  console.warn(`[ASKF] Eşleştirilemeyen takım: "${askfName}" (normalized: "${normASKF}")`);
  return undefined;
}

// ─── Desteklenen ligler ─────────────────────────────────────────────────────
export function hasAmatorSync(leagueId: string): boolean {
  return leagueId === 'amator_a' || leagueId === 'amator_b';
}

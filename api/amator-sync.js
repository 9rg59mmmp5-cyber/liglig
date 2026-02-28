// Vercel Serverless Function — Karabük ASKF 1. Amatör Lig Veri Çekici
// Kaynak: https://karabukaskf.com/kategori/9/1-amator
//
// A Grubu ve B Grubu puan durumu + fikstür verilerini çeker.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = 'https://karabukaskf.com/kategori/9/1-amator';

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
    'Connection': 'keep-alive',
  };

  try {
    const resp = await fetch(url, { headers, redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);

    const html = await resp.text();
    const groups = parseAmatorPage(html);
    const success = groups.amator_a.standings.length > 0 || groups.amator_b.standings.length > 0;

    return res.status(200).json({
      success,
      lastUpdated: new Date().toISOString(),
      groups,
      _debug: {
        url,
        htmlLength: html.length,
        aStandingsCount: groups.amator_a.standings.length,
        bStandingsCount: groups.amator_b.standings.length,
        aFixturesCount: groups.amator_a.fixtures.length,
        bFixturesCount: groups.amator_b.fixtures.length,
      },
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err.message,
      _debug: { url },
    });
  }
}

// ─── Ana parser ─────────────────────────────────────────────────────────────
function parseAmatorPage(html) {
  const result = {
    amator_a: { standings: [], fixtures: [] },
    amator_b: { standings: [], fixtures: [] },
  };

  // Strategy 1: Look for explicit group headings
  const groupAMatch = html.match(/A\s*GRUBU([\s\S]*?)(?=B\s*GRUBU|$)/i);
  const groupBMatch = html.match(/B\s*GRUBU([\s\S]*?)(?=C\s*GRUBU|$)/i);

  if (groupAMatch) {
    result.amator_a = parseAmatorGroup(groupAMatch[1]);
  }
  if (groupBMatch) {
    result.amator_b = parseAmatorGroup(groupBMatch[1]);
  }

  // Strategy 2: If no group headings found, try to find tables directly
  if (result.amator_a.standings.length === 0 && result.amator_b.standings.length === 0) {
    const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
    const standingsTables = tables.filter(t => {
      const nums = (t.match(/<td[^>]*>\s*\d+\s*<\/td>/gi) || []).length;
      return nums >= 20;
    });

    if (standingsTables.length >= 2) {
      result.amator_a.standings = parseAmatorStandings(standingsTables[0]);
      result.amator_b.standings = parseAmatorStandings(standingsTables[1]);
    } else if (standingsTables.length === 1) {
      result.amator_a.standings = parseAmatorStandings(standingsTables[0]);
    }
  }

  // Strategy 3: Look for div-based layouts (common in modern ASKF sites)
  if (result.amator_a.standings.length === 0 && result.amator_b.standings.length === 0) {
    // Try card/div based format
    const sections = html.split(/(?:A\s*GRUP|B\s*GRUP|1\.\s*GRUP|2\.\s*GRUP)/i);
    if (sections.length >= 3) {
      result.amator_a = parseAmatorGroup(sections[1]);
      result.amator_b = parseAmatorGroup(sections[2]);
    }
  }

  return result;
}

function parseAmatorGroup(sectionHtml) {
  const standings = [];
  const fixtures = [];

  const tables = [...sectionHtml.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  for (const table of tables) {
    const parsed = parseAmatorStandings(table);
    if (parsed.length > 0) {
      standings.push(...parsed);
      break;
    }
  }

  const fixtureMatches = parseAmatorFixtures(sectionHtml);
  fixtures.push(...fixtureMatches);

  return { standings, fixtures };
}

function parseAmatorStandings(tableHtml) {
  const results = [];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let rank = 1;

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      c => clean(c[1])
    );

    const nums = [];
    let teamName = '';

    for (const cell of cells) {
      const cleaned = cell.replace(/\*/g, '').trim();
      if (/^-?\d+$/.test(cleaned)) {
        nums.push(parseInt(cleaned, 10));
      } else if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
        if (!teamName) teamName = cleaned.replace(/^\d+\.\s*/, '').trim();
      }
    }

    if (teamName && nums.length >= 8) {
      results.push({
        rank: rank++,
        name: teamName,
        played: nums[0],
        won: nums[1],
        drawn: nums[2],
        lost: nums[3],
        gf: nums[4],
        ga: nums[5],
        gd: nums[6],
        pts: nums[7],
      });
    }
  }

  return results;
}

function parseAmatorFixtures(sectionHtml) {
  const fixtures = [];

  const weekRegex = /(\d{1,2})\.\s*(?:Hafta|HAFTA)([\s\S]*?)(?=\d{1,2}\.\s*(?:Hafta|HAFTA)|$)/gi;
  let wm;

  while ((wm = weekRegex.exec(sectionHtml)) !== null) {
    const week = parseInt(wm[1], 10);
    if (week < 1 || week > 50) continue;
    const weekHtml = wm[2];

    for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...trm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        c => clean(c[1])
      );

      if (cells.length >= 3) {
        for (let i = 0; i < cells.length - 2; i++) {
          const team1 = cells[i];
          const scoreTxt = cells[i + 1].replace(/\s+/g, '');
          const team2 = cells[i + 2];

          if (team1.length >= 3 && team2.length >= 3 && /^\d+-\d+$/.test(scoreTxt)) {
            const [hs, as] = scoreTxt.split('-').map(Number);
            fixtures.push({
              week,
              homeTeamName: team1,
              awayTeamName: team2,
              homeScore: hs,
              awayScore: as,
              isPlayed: true,
            });
            break;
          }
          if (team1.length >= 3 && team2.length >= 3 && /^[-–]$/.test(scoreTxt)) {
            fixtures.push({
              week,
              homeTeamName: team1,
              awayTeamName: team2,
              homeScore: null,
              awayScore: null,
              isPlayed: false,
            });
            break;
          }
        }
      }
    }
  }

  return fixtures;
}

function clean(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

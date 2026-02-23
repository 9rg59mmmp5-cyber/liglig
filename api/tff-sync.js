// Vercel Serverless Function — TFF Veri Çekici
// Endpoint: /api/tff-sync?grupID=2785&pageID=971&hafta=32   (Nesine 3. Lig)
//           /api/tff-sync?grupID=3304&pageID=1596&hafta=26  (Bölgesel Amatör Lig)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const grupID = req.query.grupID || '2785';
  const pageID = req.query.pageID || '971';
  const hafta  = req.query.hafta  || '32';

  const url = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SporKarabuk/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
    });

    if (!response.ok) throw new Error(`TFF yanıt hatası: ${response.status}`);

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('windows-1254');
    const html = decoder.decode(buffer);

    const standings = parseStandings(html);
    const fixtures  = parseFixtures(html);

    return res.status(200).json({
      success: true,
      grupID,
      pageID,
      lastUpdated: new Date().toISOString(),
      standings,
      fixtures,
    });

  } catch (error) {
    console.error('TFF sync error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Bilinmeyen hata' });
  }
}

// --- PUAN DURUMU PARSER ---
function parseStandings(html) {
  const standings = [];
  const tableMatch = html.match(/PUAN DURUMU[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (!tableMatch) return standings;

  const tableHtml = tableMatch[1];
  const rowRegex = /kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>([\s\S]*?)<\/tr>/gi;
  let match;
  let rank = 1;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const kulupId  = match[1];
    const rawName  = match[2].replace(/<[^>]+>/g, '').trim();
    const teamName = rawName.replace(/^\d+\.\s*/, '').trim();
    if (!teamName || teamName.length < 2) continue;

    const statsHtml = match[3];
    const tdValues  = [];
    const tdRegex   = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(statsHtml)) !== null) {
      const val = tdMatch[1].replace(/<[^>]+>/g, '').replace(/\*/g, '').trim();
      if (/^-?\d+$/.test(val)) tdValues.push(parseInt(val, 10));
    }

    if (tdValues.length >= 8) {
      standings.push({
        rank,
        kulupId: parseInt(kulupId),
        name: toTitleCase(teamName),
        played: tdValues[0],
        won:    tdValues[1],
        drawn:  tdValues[2],
        lost:   tdValues[3],
        gf:     tdValues[4],
        ga:     tdValues[5],
        gd:     tdValues[6],
        pts:    tdValues[7],
      });
      rank++;
    }
  }
  return standings;
}

// --- FİKSTÜR PARSER ---
function parseFixtures(html) {
  const fixtures = [];
  const fixtureSection = html.match(/Fikst.r Listesi[\s\S]*$/i)?.[0] || html;
  const weekRegex = /(\d+)\.Hafta([\s\S]*?)(?=\d+\.Hafta|$)/gi;
  let weekMatch;

  while ((weekMatch = weekRegex.exec(fixtureSection)) !== null) {
    const weekNumber = parseInt(weekMatch[1], 10);
    if (weekNumber > 50) continue;
    const weekHtml = weekMatch[2];

    const matchRegex = /kulupId=(\d+)[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>\s*<a[^>]*macId[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td[^>]*>.*?kulupId=(\d+)[^>]*>([^<]+)<\/a>/gi;
    let mr;

    while ((mr = matchRegex.exec(weekHtml)) !== null) {
      const homeKulupId  = parseInt(mr[1], 10);
      const homeTeamName = mr[2].trim();
      const scoreRaw     = mr[3].trim();
      const awayKulupId  = parseInt(mr[4], 10);
      const awayTeamName = mr[5].trim();

      const isPlayed = /\d/.test(scoreRaw);
      let homeScore = null, awayScore = null;

      if (isPlayed) {
        const parts = scoreRaw.replace(/\s/g, '').split('-');
        if (parts.length === 2) {
          homeScore = parseInt(parts[0], 10);
          awayScore = parseInt(parts[1], 10);
        }
      }

      fixtures.push({
        week: weekNumber,
        homeKulupId,
        homeTeamName: toTitleCase(homeTeamName),
        awayKulupId,
        awayTeamName: toTitleCase(awayTeamName),
        homeScore,
        awayScore,
        isPlayed,
      });
    }
  }
  return fixtures;
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|\.)\S/g, c => c.toUpperCase())
    .replace(/\bve\b/gi, 've')
    .replace(/\ba\.\ş\./gi, 'A.Ş.')
    .trim();
}

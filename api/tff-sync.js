// Vercel Serverless Function — TFF Veri Çekici
// BAL sayfası için POST + ViewState gerekebilir

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const grupID = req.query.grupID || '2785';
  const pageID = req.query.pageID || '971';
  const hafta  = req.query.hafta  || '1';

  const url = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.tff.org/',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      return res.status(200).json({
        success: false,
        error: `TFF HTTP ${response.status}`,
        debug: { url, status: response.status }
      });
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('windows-1254');
    const html = decoder.decode(buffer);

    // Debug: HTML boyutunu ve anahtar içerikleri logla
    const htmlLength = html.length;
    const hasPuanDurumu = html.includes('PUAN DURUMU') || html.includes('Puan Durumu');
    const hasKulupId = html.includes('kulupId=');
    const hasGrupID = html.includes(grupID);
    const firstKulupMatch = html.match(/kulupId=(\d+)/);

    const standings = parseStandings(html);
    const fixtures  = parseFixtures(html);

    return res.status(200).json({
      success: standings.length > 0,
      grupID, pageID, hafta,
      lastUpdated: new Date().toISOString(),
      standings,
      fixtures,
      // Debug bilgisi — sorun gidermek için
      _debug: {
        htmlLength,
        hasPuanDurumu,
        hasKulupId,
        hasGrupID,
        firstKulupId: firstKulupMatch?.[1] || null,
        standingsCount: standings.length,
        fixturesCount: fixtures.length,
      }
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message || 'Bilinmeyen hata',
      _debug: { url }
    });
  }
}

// --- PUAN DURUMU PARSER ---
function parseStandings(html) {
  const standings = [];

  let tableHtml = null;

  // 1. Önce klasik "PUAN DURUMU" başlığı
  const m1 = html.match(/PUAN DURUMU[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (m1) {
    tableHtml = m1[1];
  }

  // 2. BAL: "Puan Cetveli" başlığı
  if (!tableHtml) {
    const m2 = html.match(/Puan Cetveli[\s\S]*?(<table[\s\S]*?<\/table>)/i);
    if (m2) tableHtml = m2[1];
  }

  // 3. kulupId içeren herhangi bir tablo
  if (!tableHtml) {
    const allTables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
    for (const tbl of allTables) {
      if (tbl.includes('kulupId') && tbl.includes('pageID=28')) {
        tableHtml = tbl;
        break;
      }
    }
  }

  if (!tableHtml) return standings;

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
        rank, kulupId: parseInt(kulupId),
        name: toTitleCase(teamName),
        played: tdValues[0], won: tdValues[1], drawn: tdValues[2], lost: tdValues[3],
        gf: tdValues[4], ga: tdValues[5], gd: tdValues[6], pts: tdValues[7],
      });
      rank++;
    }
  }
  return standings;
}

// --- FİKSTÜR PARSER ---
function parseFixtures(html) {
  const fixtures = [];

  const fixtureSection =
    html.match(/Fikst.r Listesi[\s\S]*$/i)?.[0] ||
    html.match(/FiKST.R[\s\S]*$/i)?.[0] ||
    html;

  const weekRegex = /(\d+)\.Hafta([\s\S]*?)(?=\d+\.Hafta|$)/gi;
  let weekMatch;

  while ((weekMatch = weekRegex.exec(fixtureSection)) !== null) {
    const weekNumber = parseInt(weekMatch[1], 10);
    if (weekNumber > 50) continue;
    const weekHtml = weekMatch[2];

    const matchRegex = /<tr[^>]*>[\s\S]*?kulupId=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*macId[^>]*>([\s\S]*?)<\/a>[\s\S]*?kulupId=(\d+)[^>]*>([^<]+)<\/a>/gi;
    let mr;

    while ((mr = matchRegex.exec(weekHtml)) !== null) {
      const homeKulupId = parseInt(mr[1], 10);
      const homeTeam   = mr[2].trim();
      const scoreRaw   = mr[3].replace(/<[^>]+>/g, '').trim();
      const awayKulupId = parseInt(mr[4], 10);
      const awayTeam   = mr[5].trim();

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
        week: weekNumber, homeKulupId,
        homeTeamName: toTitleCase(homeTeam),
        awayKulupId,
        awayTeamName: toTitleCase(awayTeam),
        homeScore, awayScore, isPlayed,
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
    .replace(/\ba\.ş\./gi, 'A.Ş.')
    .trim();
}

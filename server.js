import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// ─── Timeout + Retry fetch helper ────────────────────────────────────────────
async function fetchWithRetry(url, options = {}, retries = 2, timeoutMs = 15000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= retries) {
        if (err.name === 'AbortError') throw new Error(`Bağlantı zaman aşımına uğradı (${timeoutMs / 1000}s)`);
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Bağlantı kurulamadı');
}

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/send-telegram', async (req, res) => {
  const { image, chatIds } = req.body;
  const token = "5747202724:AAHLfOnWPZE0TAyvFO0vEaJUYyVYYOOodC4";

  if (!image || !chatIds || !Array.isArray(chatIds)) {
    return res.status(400).json({ success: false, error: 'Eksik veri' });
  }

  try {
    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const results = [];
    for (const chatId of chatIds) {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'puan-durumu.png');
      formData.append('caption', '📊 Karabük 1. Amatör Lig Güncel Puan Durumu');

      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      results.push({ chatId, success: data.ok, error: data.description });
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tff-sync', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');

  const grupID = req.query.grupID || '2785';
  const pageID = req.query.pageID || '971';
  const hafta = req.query.hafta || '32';

  const url = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;

  try {
    const response = await fetchWithRetry(url, {
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
    const fixtures = parseFixtures(html);

    return res.json({
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
});

app.get('/api/amator-sync', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');

  const url = 'https://karabukaskf.com/kategori/9/1-amator';

  try {
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
      },
    });

    if (!response.ok) throw new Error(`ASKF yanıt hatası: ${response.status}`);

    const html = await response.text();
    const groups = parseAmatorPage(html);

    return res.json({
      success: true,
      lastUpdated: new Date().toISOString(),
      groups,
      _debug: { url, htmlLength: html.length },
    });
  } catch (error) {
    console.error('ASKF sync error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Bilinmeyen hata' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// ─── ASKF Amatör parser ─────────────────────────────────────────────────────
function parseAmatorPage(html) {
  const result = { amator_a: { standings: [], fixtures: [] }, amator_b: { standings: [], fixtures: [] } };

  // Try to find group sections (A Grubu, B Grubu)
  // ASKF pages typically have tables with standings and match results
  
  // Strategy 1: Look for explicit group headings
  const groupAMatch = html.match(/A\s*GRUBU([\s\S]*?)(?=B\s*GRUBU|$)/i);
  const groupBMatch = html.match(/B\s*GRUBU([\s\S]*?)(?=C\s*GRUBU|$)/i);

  if (groupAMatch) {
    result.amator_a = parseAmatorGroup(groupAMatch[1]);
  }
  if (groupBMatch) {
    result.amator_b = parseAmatorGroup(groupBMatch[1]);
  }

  // Strategy 2: If no group headings, find all tables and split them
  if (result.amator_a.standings.length === 0 && result.amator_b.standings.length === 0) {
    const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
    const standingsTables = tables.filter(t => {
      const nums = (t.match(/<td[^>]*>\s*\d+\s*<\/td>/gi) || []).length;
      return nums >= 20; // A standings table should have many number cells
    });

    if (standingsTables.length >= 2) {
      result.amator_a.standings = parseAmatorStandings(standingsTables[0]);
      result.amator_b.standings = parseAmatorStandings(standingsTables[1]);
    } else if (standingsTables.length === 1) {
      result.amator_a.standings = parseAmatorStandings(standingsTables[0]);
    }
  }

  return result;
}

function parseAmatorGroup(sectionHtml) {
  const standings = [];
  const fixtures = [];

  // Find standings table
  const tables = [...sectionHtml.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  for (const table of tables) {
    const parsed = parseAmatorStandings(table);
    if (parsed.length > 0) {
      standings.push(...parsed);
      break;
    }
  }

  // Find fixtures/results
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
      c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    );

    // Look for a row with team name + at least 8 numbers (O G B M A Y AV P)
    const nums = [];
    let teamName = '';

    for (const cell of cells) {
      const cleaned = cell.replace(/\*/g, '').trim();
      if (/^-?\d+$/.test(cleaned)) {
        nums.push(parseInt(cleaned, 10));
      } else if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
        // Likely a team name
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
  
  // Look for match results: "Team A  X - Y  Team B" or similar patterns
  // Common format in ASKF sites: Week headings + match rows
  const weekRegex = /(\d{1,2})\.\s*(?:Hafta|HAFTA)([\s\S]*?)(?=\d{1,2}\.\s*(?:Hafta|HAFTA)|$)/gi;
  let wm;

  while ((wm = weekRegex.exec(sectionHtml)) !== null) {
    const week = parseInt(wm[1], 10);
    if (week < 1 || week > 50) continue;
    const weekHtml = wm[2];

    // Try to find match rows
    for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...trm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      );

      // Look for pattern: [Team A] [Score] [Team B]
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
          // Check for unplayed: "-" or "- -"
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

function parseStandings(html) {
  const standings = [];

  // Robust: find the table with the most kulupID= links (big D = puan cetveli)
  // Skip tables that contain kisiID (gol krallığı)
  let bestTable = null;
  let bestCount = 0;

  for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const t = m[0];
    if (t.includes('kisiID') || t.includes('kisiId')) continue;
    const countBig = (t.match(/kulupID=/gi) || []).length;
    if (countBig > bestCount) {
      bestCount = countBig;
      bestTable = t;
    }
  }

  // Fallback: try "PUAN DURUMU" or "Puan Cetveli" section
  if (!bestTable) {
    const sectionMatch = html.match(/(?:PUAN DURUMU|Puan Cetveli)[\s\S]*?(<table[\s\S]*?<\/table>)/i);
    if (sectionMatch) bestTable = sectionMatch[1];
  }

  if (!bestTable) return standings;

  // Parse rows: find kulupID= links (big D for standings)
  const rowRe = /kulupID=(\d+)[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/gi;
  let match;
  let rank = 1;

  while ((match = rowRe.exec(bestTable)) !== null) {
    const kulupId = parseInt(match[1], 10);
    const rawName = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/^\d+\.\s*/, '').replace(/^\d+\s+/, '').trim();
    if (!rawName || rawName.length < 2) continue;

    const statsHtml = match[3];
    const tdValues = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(statsHtml)) !== null) {
      const val = tdMatch[1].replace(/<[^>]+>/g, '').replace(/\*/g, '').replace(/&nbsp;/g, '').trim();
      if (/^-?\d+$/.test(val)) tdValues.push(parseInt(val, 10));
    }

    if (tdValues.length >= 8) {
      standings.push({
        rank: rank++,
        kulupId,
        name: toTitleCase(rawName),
        played: tdValues[0],
        won: tdValues[1],
        drawn: tdValues[2],
        lost: tdValues[3],
        gf: tdValues[4],
        ga: tdValues[5],
        gd: tdValues[6],
        pts: tdValues[7],
      });
    }
  }
  return standings;
}

function parseFixtures(html) {
  const fixtures = [];

  // Find "Fikstür Listesi" section or use whole HTML
  const fixtureListIdx = html.indexOf('Fikstür Listesi');
  const startIdx = fixtureListIdx >= 0 ? fixtureListIdx : 0;
  const fixtureHtml = html.substring(startIdx);

  // Week blocks
  const weekRegex = /(\d{1,2})\.\s*Hafta([\s\S]*?)(?=\d{1,2}\.\s*Hafta|$)/gi;
  let weekMatch;

  while ((weekMatch = weekRegex.exec(fixtureHtml)) !== null) {
    const weekNumber = parseInt(weekMatch[1], 10);
    if (weekNumber < 1 || weekNumber > 50) continue;
    const weekHtml = weekMatch[2];

    // Parse each row in the week block
    for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const row = trm[1];

      // Find kulupId (small d) links — fixture-specific
      const kulupLinks = [...row.matchAll(/kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>/gi)];
      if (kulupLinks.length < 2) continue;

      const homeKulupId = parseInt(kulupLinks[0][1], 10);
      const homeName = kulupLinks[0][2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const awayKulupId = parseInt(kulupLinks[kulupLinks.length - 1][1], 10);
      const awayName = kulupLinks[kulupLinks.length - 1][2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

      if (!homeName || !awayName) continue;
      if (homeKulupId === awayKulupId) continue;

      // Score: macId link text
      let homeScore = null, awayScore = null, isPlayed = false;
      const macLinkMatch = row.match(/macId=\d+[^>]*>([\s\S]*?)<\/a>/i);
      if (macLinkMatch) {
        const scoreTxt = macLinkMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim();
        const scoreMatch = /^(\d+)-(\d+)$/.exec(scoreTxt);
        if (scoreMatch) {
          homeScore = parseInt(scoreMatch[1], 10);
          awayScore = parseInt(scoreMatch[2], 10);
          isPlayed = true;
        }
      }

      fixtures.push({
        week: weekNumber,
        homeKulupId,
        homeTeamName: toTitleCase(homeName),
        awayKulupId,
        awayTeamName: toTitleCase(awayName),
        homeScore,
        awayScore,
        isPlayed,
      });
    }
  }
  return fixtures;
}

function toTitleCase(str) {
  if (!str) return str;
  const lower = str
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase();
  return lower
    .replace(/(^|[\s.\-\/])(\S)/g, (_, pre, ch) => {
      if (ch === 'i') return pre + 'İ';
      if (ch === 'ı') return pre + 'I';
      return pre + ch.toUpperCase();
    })
    .replace(/\bve\b/gi, 've')
    .replace(/\ba\.ş\./gi, 'A.Ş.')
    .replace(/\bfk\b/gi, 'FK')
    .replace(/\bsk\b/gi, 'SK')
    .trim();
}

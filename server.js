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

// ─── ASKF Amatör parser (karabukaskf.com — list-based HTML, NOT table-based) ──
function parseAmatorPage(html) {
  const result = { amator_a: { standings: [], fixtures: [] }, amator_b: { standings: [], fixtures: [] } };

  // ASKF site uses "Lig A Grubu" / "Lig B Grubu" as group delimiters
  const groupAIdx = html.search(/Lig\s+A\s+Grubu/i);
  const groupBIdx = html.search(/Lig\s+B\s+Grubu/i);

  if (groupAIdx >= 0 && groupBIdx >= 0) {
    const groupAHtml = html.substring(groupAIdx, groupBIdx);
    const groupBHtml = html.substring(groupBIdx);
    result.amator_a = parseAmatorGroup(groupAHtml);
    result.amator_b = parseAmatorGroup(groupBHtml);
  } else if (groupAIdx >= 0) {
    result.amator_a = parseAmatorGroup(html.substring(groupAIdx));
  }

  // Fallback: generic "A GRUBU" / "B GRUBU"
  if (result.amator_a.standings.length === 0 && result.amator_b.standings.length === 0) {
    const altAIdx = html.search(/A\s*GRUBU/i);
    const altBIdx = html.search(/B\s*GRUBU/i);
    if (altAIdx >= 0 && altBIdx >= 0) {
      result.amator_a = parseAmatorGroup(html.substring(altAIdx, altBIdx));
      result.amator_b = parseAmatorGroup(html.substring(altBIdx));
    }
  }

  console.log(`[ASKF] Parsed A: ${result.amator_a.standings.length} standings, ${result.amator_a.fixtures.length} fixtures`);
  console.log(`[ASKF] Parsed B: ${result.amator_b.standings.length} standings, ${result.amator_b.fixtures.length} fixtures`);

  return result;
}

function parseAmatorGroup(html) {
  return {
    standings: parseAmatorStandings(html),
    fixtures: parseAmatorFixtures(html),
  };
}

function parseAmatorStandings(html) {
  const results = [];

  const pdIdx = html.lastIndexOf('Puan Durumu');
  if (pdIdx === -1) return results;
  const section = html.substring(pdIdx);

  const teamRegex = /href="\/takim\/\d+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const teamEntries = [];

  while ((m = teamRegex.exec(section)) !== null) {
    const name = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (name.length >= 2) {
      teamEntries.push({ name, endIdx: m.index + m[0].length });
    }
  }

  for (let i = 0; i < teamEntries.length; i++) {
    const entry = teamEntries[i];
    const nextStart = i + 1 < teamEntries.length
      ? teamEntries[i + 1].endIdx - 200
      : section.length;
    const afterText = section
      .substring(entry.endIdx, Math.min(entry.endIdx + 300, nextStart + 200))
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ');

    const nums = [...afterText.matchAll(/-?\d+/g)].map(n => parseInt(n[0], 10));

    if (nums.length >= 8) {
      results.push({
        rank: results.length + 1,
        name: entry.name,
        played: nums[0], won: nums[1], drawn: nums[2], lost: nums[3],
        gf: nums[4], ga: nums[5], pts: nums[6], gd: nums[7],
      });
    }
  }

  return results;
}

function parseAmatorFixtures(html) {
  const fixtures = [];

  const weekPattern = /(\d{1,2})\.\s*(?:Hafta|HAFTA)/gi;
  const weekPositions = [];
  let wm;
  while ((wm = weekPattern.exec(html)) !== null) {
    weekPositions.push({ week: parseInt(wm[1], 10), index: wm.index });
  }

  for (let w = 0; w < weekPositions.length; w++) {
    const week = weekPositions[w].week;
    if (week < 1 || week > 50) continue;

    const start = weekPositions[w].index;
    const nextWeekIdx = w + 1 < weekPositions.length ? weekPositions[w + 1].index : start + 5000;
    const ligBilgisiIdx = html.indexOf('Lig Bilgisi', start + 10);
    const sectionEnd = (ligBilgisiIdx > start && ligBilgisiIdx < nextWeekIdx)
      ? ligBilgisiIdx : nextWeekIdx;
    const weekHtml = html.substring(start, sectionEnd);

    const links = [];
    const localTeamRegex = /href="\/takim\/\d+\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = localTeamRegex.exec(weekHtml)) !== null) {
      const name = lm[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (name.length >= 2) {
        links.push({ name, index: lm.index, endIndex: lm.index + lm[0].length });
      }
    }

    for (let j = 0; j < links.length - 1; j += 2) {
      const home = links[j];
      const away = links[j + 1];
      if (!home || !away) continue;

      const between = weekHtml
        .substring(home.endIndex, away.index)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const scoreMatch = between.match(/(\d+)\s*[-–]\s*(\d+)/);

      if (scoreMatch) {
        fixtures.push({
          week,
          homeTeamName: home.name,
          awayTeamName: away.name,
          homeScore: parseInt(scoreMatch[1], 10),
          awayScore: parseInt(scoreMatch[2], 10),
          isPlayed: true,
        });
      } else {
        fixtures.push({
          week,
          homeTeamName: home.name,
          awayTeamName: away.name,
          homeScore: null,
          awayScore: null,
          isPlayed: false,
        });
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

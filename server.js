import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

function parseStandings(html) {
  const standings = [];
  const tableMatch = html.match(/PUAN DURUMU[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (!tableMatch) return standings;

  const tableHtml = tableMatch[1];
  const rowRegex = /kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>([\s\S]*?)<\/tr>/gi;
  let match;
  let rank = 1;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const kulupId = match[1];
    const rawName = match[2].replace(/<[^>]+>/g, '').trim();
    const teamName = rawName.replace(/^\d+\.\s*/, '').trim();
    if (!teamName || teamName.length < 2) continue;

    const statsHtml = match[3];
    const tdValues = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
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
        won: tdValues[1],
        drawn: tdValues[2],
        lost: tdValues[3],
        gf: tdValues[4],
        ga: tdValues[5],
        gd: tdValues[6],
        pts: tdValues[7],
      });
      rank++;
    }
  }
  return standings;
}

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
      const homeKulupId = parseInt(mr[1], 10);
      const homeTeamName = mr[2].trim();
      const scoreRaw = mr[3].trim();
      const awayKulupId = parseInt(mr[4], 10);
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

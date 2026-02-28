import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tffApiPlugin()],
    publicDir: 'public',
    server: {
      port: 5000,
      host: '0.0.0.0',
      allowedHosts: true,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react'],
          },
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

async function fetchWithRetry(url: string, options: any = {}, retries = 2, timeoutMs = 15000): Promise<Response> {
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
    } catch (err: any) {
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

function tffApiPlugin() {
  return {
    name: 'tff-api',
    configureServer(server: any) {
      // TFF Sync endpoint
      server.middlewares.use('/api/tff-sync', async (req: any, res: any) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const grupID = url.searchParams.get('grupID') || '2785';
        const pageID = url.searchParams.get('pageID') || '971';
        const hafta = url.searchParams.get('hafta') || '32';

        const tffUrl = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        try {
          const response = await fetchWithRetry(tffUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
            },
          });

          if (!response.ok) throw new Error(`TFF yanıt hatası: ${response.status}`);

          const buffer = await response.arrayBuffer();
          const decoder = new TextDecoder('windows-1254');
          const html = decoder.decode(buffer);

          const standings = parseStandings(html);
          const fixtures = parseFixtures(html);

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            grupID,
            pageID,
            lastUpdated: new Date().toISOString(),
            standings,
            fixtures,
          }));
        } catch (error: any) {
          console.error('TFF sync error:', error);
          res.statusCode = 200; // Return 200 with success: false to prevent console 500 error
          res.end(JSON.stringify({ success: false, error: error.message || 'Bilinmeyen hata' }));
        }
      });

      // Amator Sync endpoint
      server.middlewares.use('/api/amator-sync', async (req: any, res: any) => {
        const askfUrl = 'https://karabukaskf.com/kategori/9/1-amator';

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        try {
          const response = await fetchWithRetry(askfUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
            },
          });

          if (!response.ok) throw new Error(`ASKF yanıt hatası: ${response.status}`);

          const html = await response.text();
          const groups = parseAmatorPage(html);

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            lastUpdated: new Date().toISOString(),
            groups,
            _debug: { url: askfUrl, htmlLength: html.length },
          }));
        } catch (error: any) {
          console.error('ASKF sync error:', error);
          res.statusCode = 200; // Return 200 with success: false
          res.end(JSON.stringify({ success: false, error: error.message || 'Bilinmeyen hata' }));
        }
      });
    },
  };
}

function parseStandings(html: string) {
  const standings: any[] = [];

  // Robust: find the table with the most kulupID= links (big D = puan cetveli)
  // Skip tables that contain kisiID (gol krallığı)
  let bestTable: string | null = null;
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
    const tdValues: number[] = [];
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

function parseFixtures(html: string) {
  const fixtures: any[] = [];

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
      let homeScore: number | null = null, awayScore: number | null = null, isPlayed = false;
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

function parseAmatorPage(html: string) {
  const result: any = { amator_a: { standings: [], fixtures: [] }, amator_b: { standings: [], fixtures: [] } };

  const groupAMatch = html.match(/A\s*GRUBU([\s\S]*?)(?=B\s*GRUBU|$)/i);
  const groupBMatch = html.match(/B\s*GRUBU([\s\S]*?)(?=C\s*GRUBU|$)/i);

  if (groupAMatch) result.amator_a = parseAmatorGroup(groupAMatch[1]);
  if (groupBMatch) result.amator_b = parseAmatorGroup(groupBMatch[1]);

  // Fallback: find all standings tables
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

  return result;
}

function parseAmatorGroup(sectionHtml: string) {
  const standings: any[] = [];
  const fixtures: any[] = [];

  const tables = [...sectionHtml.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]);
  for (const table of tables) {
    const parsed = parseAmatorStandings(table);
    if (parsed.length > 0) { standings.push(...parsed); break; }
  }

  fixtures.push(...parseAmatorFixtures(sectionHtml));
  return { standings, fixtures };
}

function parseAmatorStandings(tableHtml: string) {
  const results: any[] = [];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let rank = 1;

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    );

    const nums: number[] = [];
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
        played: nums[0], won: nums[1], drawn: nums[2], lost: nums[3],
        gf: nums[4], ga: nums[5], gd: nums[6], pts: nums[7],
      });
    }
  }
  return results;
}

function parseAmatorFixtures(sectionHtml: string) {
  const fixtures: any[] = [];
  const weekRegex = /(\d{1,2})\.\s*(?:Hafta|HAFTA)([\s\S]*?)(?=\d{1,2}\.\s*(?:Hafta|HAFTA)|$)/gi;
  let wm;

  while ((wm = weekRegex.exec(sectionHtml)) !== null) {
    const week = parseInt(wm[1], 10);
    if (week < 1 || week > 50) continue;
    const weekHtml = wm[2];

    for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...trm[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
        c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      );

      if (cells.length >= 3) {
        for (let i = 0; i < cells.length - 2; i++) {
          const team1 = cells[i];
          const scoreTxt = cells[i + 1].replace(/\s+/g, '');
          const team2 = cells[i + 2];

          if (team1.length >= 3 && team2.length >= 3 && /^\d+-\d+$/.test(scoreTxt)) {
            const [hs, as] = scoreTxt.split('-').map(Number);
            fixtures.push({ week, homeTeamName: team1, awayTeamName: team2, homeScore: hs, awayScore: as, isPlayed: true });
            break;
          }
          if (team1.length >= 3 && team2.length >= 3 && /^[-–]$/.test(scoreTxt)) {
            fixtures.push({ week, homeTeamName: team1, awayTeamName: team2, homeScore: null, awayScore: null, isPlayed: false });
            break;
          }
        }
      }
    }
  }
  return fixtures;
}

function toTitleCase(str: string) {
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

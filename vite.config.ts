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
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});

function tffApiPlugin() {
  return {
    name: 'tff-api',
    configureServer(server: any) {
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
          const response = await fetch(tffUrl, {
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
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: error.message || 'Bilinmeyen hata' }));
        }
      });
    },
  };
}

function parseStandings(html: string) {
  const standings: any[] = [];
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
    const tdValues: number[] = [];
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

function parseFixtures(html: string) {
  const fixtures: any[] = [];
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

function toTitleCase(str: string) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|\.)\S/g, c => c.toUpperCase())
    .replace(/\bve\b/gi, 've')
    .replace(/\ba\.\ş\./gi, 'A.Ş.')
    .trim();
}

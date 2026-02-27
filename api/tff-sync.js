// Vercel Serverless Function — TFF Resmi Site Veri Çekici
// Kaynak: https://www.tff.org
//
// HTML Yapısı (Analiz edildi):
//
// PUAN CETVELİ: <a href="...kulupID=10580...">KARABÜK İDMANYURDU</a>
//   - kulupID (büyük ID) ile linkler
//   - Tabloda sütun sırası: O G B M A Y AV P
//
// FİKSTÜR LİSTESİ: <a href="...kulupId=10580...">KARABÜK İDMANYURDU</a>
//   - kulupId (büyük Id) ile linkler
//   - Skor: <a href="...macId=285551...">3 - 1</a> ya da "-" (oynanmadı)
//   - Format: "1.Hafta", "2.Hafta" blokları
//
// GOL KRALLĞI (filtrele): hem kisiID hem kulupID içerir

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const grupID    = req.query.grupID  || '3304';
  const pageID    = req.query.pageID  || '1596';
  const hafta     = parseInt(req.query.hafta || '1', 10);
  const debugMode = req.query.debug   || '';

  const url = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;

  const headers = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
    'Referer':         'https://www.tff.org/Default.aspx?pageID=981',
    'Connection':      'keep-alive',
  };

  try {
    const resp = await fetch(url, { headers, redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${url}`);

    const html = decodeW1254(await resp.arrayBuffer());

    if (debugMode === 'html') {
      const pcIdx  = html.indexOf('Puan Cetveli');
      const flIdx  = html.indexOf('Fikstür Listesi');
      const hafIdx = html.search(/\d{1,2}\.Hafta/);
      return res.status(200).json({
        debug: 'html', url, htmlLength: html.length,
        puanCetveliIdx: pcIdx,
        fixtureListesiIdx: flIdx,
        ilkHaftaIdx: hafIdx,
        puanSection: pcIdx >= 0 ? html.substring(pcIdx, pcIdx + 3000) : 'BULUNAMADI',
        fixtureSection: hafIdx >= 0 ? html.substring(Math.max(0,hafIdx-100), hafIdx + 2000) : 'BULUNAMADI',
      });
    }

    const standings = parseStandings(html);
    const fixtures  = parseFixtures(html, hafta);
    const success   = standings.length > 0 || fixtures.length > 0;

    return res.status(200).json({
      success, grupID, pageID, hafta,
      lastUpdated: new Date().toISOString(),
      standings, fixtures,
      _debug: {
        url,
        htmlLength:     html.length,
        standingsCount: standings.length,
        fixturesCount:  fixtures.length,
        hint: !success
          ? `Parser sorunu olabilir. Ham HTML için: ${url}&debug=html ekle`
          : undefined,
      },
    });

  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err.message,
      _debug: { url, grupID, pageID, hafta },
    });
  }
}

// ─── Windows-1254 decoder ────────────────────────────────────────────────────
function decodeW1254(buf) {
  try { return new TextDecoder('windows-1254').decode(buf); } catch (_) {}
  const MAP = {
    0xC7:'Ç',0xD0:'Ğ',0xD6:'Ö',0xDC:'Ü',0xDD:'İ',0xDE:'Ş',
    0xE7:'ç',0xF0:'ğ',0xF6:'ö',0xFC:'ü',0xFD:'ı',0xFE:'ş',
    0x80:'€',0x99:'™',
  };
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : (MAP[b] || '?');
  return s;
}

// ─── PUAN DURUMU PARSER ──────────────────────────────────────────────────────
// TFF sayfasında puan cetveli: kulupID (büyük ID) parametresi ile link içeriyor
// Gol Krallığı: hem kisiID hem kulupID içeriyor → filtrele
function parseStandings(html) {
  const results = [];

  let bestTable = null;
  let bestCount = 0;

  for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const t = m[0];
    // Gol krallığı kisiID içerir → atla
    if (t.includes('kisiID') || t.includes('kisiId')) continue;
    // Puan cetveli kulupID içerir
    const countBig = (t.match(/kulupID=/gi) || []).length;
    if (countBig > bestCount) {
      bestCount = countBig;
      bestTable = t;
    }
  }

  if (!bestTable) return results;

  // Satır parse: kulupID=XXXX link içeren satırlar
  const rowRe = /kulupID=(\d+)[^>]*>([\s\S]*?)<\/a>([\s\S]*?)<\/tr>/gi;
  let m;
  let rank = 1;

  while ((m = rowRe.exec(bestTable)) !== null) {
    const kulupId = parseInt(m[1], 10);

    const rawName = clean(m[2])
      .replace(/^\d+\.\s*/, '')
      .replace(/^\d+\s+/, '')
      .trim();

    if (!rawName || rawName.length < 2) continue;

    // TD içindeki sayıları topla (O G B M A Y AV P sırası)
    const nums = tdNums(m[3]);

    if (nums.length >= 8) {
      results.push({
        rank:   rank++,
        kulupId,
        name:   toTitle(rawName),
        played: nums[0],
        won:    nums[1],
        drawn:  nums[2],
        lost:   nums[3],
        gf:     nums[4],
        ga:     nums[5],
        gd:     nums[6],
        pts:    nums[7],
      });
    }
  }

  return results;
}

// ─── FİKSTÜR PARSER ─────────────────────────────────────────────────────────
// TFF'de fikstür hem "Fikstür" hafta linkleri sayfasında,
// hem de "Fikstür Listesi" bölümünde tüm haftalar birden gösterilebilir.
//
// kulupId (küçük 'd') → fikstür için
// macId → skor linki
function parseFixtures(html, requestedWeek) {
  const results = [];

  // Önce "Fikstür Listesi" bölümünü bulmaya çalış
  const fixtureListIdx = html.indexOf('Fikstür Listesi');
  const startIdx = fixtureListIdx >= 0 ? fixtureListIdx : 0;
  const fixtureHtml = html.substring(startIdx);

  // Hafta bloklarını bul
  const weekRegex = /(\d{1,2})\.\s*Hafta([\s\S]*?)(?=\d{1,2}\.\s*Hafta|$)/gi;
  let wm;

  while ((wm = weekRegex.exec(fixtureHtml)) !== null) {
    const wk = parseInt(wm[1], 10);
    if (wk < 1 || wk > 50) continue;
    const weekFixs = parseWeekBlock(wm[2], wk);
    results.push(...weekFixs);
  }

  return results;
}

function parseWeekBlock(weekHtml, week) {
  const out = [];

  for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = trm[1];

    // kulupId (küçük d) linklerini bul — fikstüre özgü
    const kulupLinks = [...row.matchAll(/kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>/gi)];
    if (kulupLinks.length < 2) continue;

    const homeKulupId  = parseInt(kulupLinks[0][1], 10);
    const homeName     = clean(kulupLinks[0][2]);
    const awayKulupId  = parseInt(kulupLinks[kulupLinks.length - 1][1], 10);
    const awayName     = clean(kulupLinks[kulupLinks.length - 1][2]);

    if (!homeName || !awayName) continue;
    if (homeKulupId === awayKulupId) continue;

    // Skor: macId linki içindeki metin
    let homeScore = null, awayScore = null, isPlayed = false;

    const macLinkMatch = row.match(/macId=\d+[^>]*>([\s\S]*?)<\/a>/i);
    if (macLinkMatch) {
      const scoreTxt = clean(macLinkMatch[1]).replace(/\s+/g, '');
      const scoreMatch = /^(\d+)-(\d+)$/.exec(scoreTxt);
      if (scoreMatch) {
        homeScore = parseInt(scoreMatch[1], 10);
        awayScore = parseInt(scoreMatch[2], 10);
        isPlayed  = true;
      }
    }

    out.push({
      week,
      homeKulupId,
      homeTeamName: toTitle(homeName),
      awayKulupId,
      awayTeamName: toTitle(awayName),
      homeScore,
      awayScore,
      isPlayed,
    });
  }

  return out;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────
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

function tdNums(tdHtml) {
  const out = [];
  for (const tm of tdHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const v = clean(tm[1]).replace(/\*/g, '').replace(/\s/g, '').trim();
    if (/^-?\d+$/.test(v)) out.push(parseInt(v, 10));
  }
  return out;
}

function toTitle(s) {
  if (!s) return s;
  const lower = s
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
    .replace(/\basd\b/gi, 'ASD')
    .replace(/\bavs\b/gi, 'AVS')
    .trim();
}

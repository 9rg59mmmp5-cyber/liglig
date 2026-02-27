// Vercel Serverless Function — TFF Resmi Site Veri Çekici
// Kaynak: https://www.tff.org (BAL Puan Cetveli ve Fikstür)
//
// KEŞİF (debug=fields): TFF BAL sayfasında dropdown yok, navigasyon direkt URL ile.
// Puan cetveli zaten ilk GET yanıtında geliyor (hasPuanCetveli: true).
// Hafta navigasyonu da GET parametresi ile: ?pageID=1596&grupID=3304&hafta=18
//
// Bu nedenle POST/ViewState gerekmez. Sadece GET + doğru parser yeterli.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const grupID    = req.query.grupID  || '3304';
  const pageID    = req.query.pageID  || '1596';
  const hafta     = parseInt(req.query.hafta || '1', 10);
  const debugMode = req.query.debug   || '';  // 'html' | ''

  // Grup navigasyonu için TFF'nin kullandığı URL formatı
  // ~/Default.aspx?pageID=1596&grupID=3304 → sayfa açıldığında güncel haftayı gösterir
  // ~/Default.aspx?pageID=1596&grupID=3304&hafta=18 → belirli hafta
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

    // Debug: ham HTML'i döndür
    if (debugMode === 'html') {
      // Puan Cetveli bölümünü bul ve 3000 char göster
      const puanIdx = html.indexOf('Puan Cetveli');
      return res.status(200).json({
        debug: 'html', url, htmlLength: html.length,
        puanSection: puanIdx >= 0 ? html.substring(puanIdx, puanIdx + 3000) : 'BULUNAMADI',
        fixtureSection: (() => {
          const i = html.indexOf('.Hafta');
          return i >= 0 ? html.substring(Math.max(0, i - 50), i + 2000) : 'BULUNAMADI';
        })(),
      });
    }

    const standings = parseStandings(html);
    const fixtures  = parseFixtures(html);
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
        puanIdx:        html.indexOf('Puan Cetveli'),
        fixtureIdx:     html.indexOf('Hafta'),
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
// TFF BAL sayfası yapısı (debug=fields keşfinden):
//   - "Puan Cetveli" başlığı var
//   - Gol Krallığı tablosu kisiId + kulupId içeriyor → bunlar atlanmalı
//   - Puan cetveli tablosu sadece kulupId içeriyor, 8+ sayısal sütun var
function parseStandings(html) {
  const results = [];

  // "Puan Cetveli" başlığından sonraki ilk kulupId'li tabloyu al
  let tableHtml = tableAfterKeyword(html, [
    'Puan Cetveli',
    'PUAN CETVELİ',
    'PUAN DURUMU',
    'puancetveli',
    'PuanCetveli',
  ]);

  // Fallback: Gol Krallığı dışında kalan (kisiId olmayan) ilk büyük kulupId tablosu
  if (!tableHtml) {
    for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
      const t = m[0];
      if (!t.includes('kulupId')) continue;
      if (t.includes('kisiId') || t.includes('kisiID')) continue;  // gol krallığı → atla
      const count = (t.match(/kulupId=/gi) || []).length;
      if (count >= 8) { tableHtml = t; break; }
    }
  }

  if (!tableHtml) return results;

  // Gol krallığı sayfasında gelen tablolar arasında puan durumu tablosunu bul
  // Satır yapısı: kulupId → takım adı → 8 sayısal sütun (O/G/B/M/AG/YG/A/P)
  const rowRe = /kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>([\s\S]*?)<\/tr>/gi;
  let m, rank = 1;

  while ((m = rowRe.exec(tableHtml)) !== null) {
    const kulupId = parseInt(m[1], 10);

    // Takım adını temizle (sıra numarası öneki kaldır: "1. Çarşamba" → "Çarşamba")
    const rawName = clean(m[2])
      .replace(/^\d+\.\s*/, '')
      .replace(/^\d+\s+/, '')
      .trim();

    if (!rawName || rawName.length < 2) continue;

    const nums = tdNums(m[3]);

    // TFF puan cetveli sütun sırası: O G B M AG YG A P (8 sütun)
    if (nums.length >= 8) {
      results.push({
        rank: rank++,
        kulupId,
        name: toTitle(rawName),
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
function parseFixtures(html) {
  const results = [];

  // TFF'de her hafta için ayrı sayfa çekildiğinden tek hafta verisi gelir.
  // Ancak bazı sayfalarda birden fazla hafta bloğu olabilir.
  const sec = fixtureSection(html);
  if (!sec) return results;

  // "17.Hafta", "17. Hafta", "17. HAFTA" gibi formatlar
  const wRe = /(\d{1,2})\.\s*Hafta([\s\S]*?)(?=\d{1,2}\.\s*Hafta|$)/gi;
  let wm;
  while ((wm = wRe.exec(sec)) !== null) {
    const wk = parseInt(wm[1], 10);
    if (wk < 1 || wk > 50) continue;
    results.push(...weekFixtures(wm[2], wk));
  }

  return results;
}

function weekFixtures(weekHtml, week) {
  const out = [];

  for (const trm of weekHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = trm[1];

    // Her satırda ev takımı + deplasman kulupId'si olmalı
    const kIds = [...row.matchAll(/kulupId=(\d+)/gi)].map(m => parseInt(m[1], 10));
    if (kIds.length < 2) continue;

    const home = kIds[0];
    const away = kIds[kIds.length - 1];
    if (home === away) continue;

    // Takım adları
    const tNames   = [...row.matchAll(/kulupId=\d+[^>]*>([\s\S]*?)<\/a>/gi)].map(m => clean(m[1]));
    const homeName = tNames[0]              || '';
    const awayName = tNames[tNames.length - 1] || '';
    if (!homeName || !awayName) continue;

    // Skor — "macId" linkinde "3-1" formatında gelir
    const sm = row.match(/macId[^>]*>([\s\S]*?)<\/a>/i);
    let hScore = null, aScore = null, played = false;
    if (sm) {
      const txt = clean(sm[1]).replace(/\s/g, '');
      const sp  = /^(\d+)-(\d+)$/.exec(txt);
      if (sp) { hScore = +sp[1]; aScore = +sp[2]; played = true; }
    }

    out.push({
      week,
      homeKulupId:  home,
      homeTeamName: toTitle(homeName),
      awayKulupId:  away,
      awayTeamName: toTitle(awayName),
      homeScore: hScore,
      awayScore: aScore,
      isPlayed:  played,
    });
  }

  return out;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

// Belirli bir anahtar kelimenin hemen ardından gelen kulupId'li tabloyu bul
function tableAfterKeyword(html, needles) {
  for (const needle of needles) {
    const idx = html.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) continue;
    const after = html.substring(idx);
    const tm    = after.match(/<table[\s\S]*?<\/table>/i);
    if (tm && tm[0].includes('kulupId')) return tm[0];
  }
  return null;
}

// Fikstür bölümünün başlangıcını bul
function fixtureSection(html) {
  const markers = [
    'Fikstür Listesi', 'FİKSTÜR LİSTESİ',
    'fikstür', 'Fikstür',
    '1.Hafta', '1. Hafta', '1. HAFTA',
  ];
  for (const mk of markers) {
    const i = html.indexOf(mk);
    if (i !== -1) return html.substring(i);
  }
  // Son çare: ilk "X.Hafta" ifadesi
  const tm = /\d{1,2}\.\s*Hafta/i.exec(html);
  return tm ? html.substring(tm.index) : null;
}

// HTML tag'larını ve boşlukları temizle
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

// TD içindeki sayısal değerleri topla
function tdNums(tdHtml) {
  const out = [];
  for (const tm of tdHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const v = clean(tm[1]).replace(/\*/g, '').trim();
    if (/^-?\d+$/.test(v)) out.push(parseInt(v, 10));
  }
  return out;
}

// Title case — Türkçe karakterlere duyarlı
function toTitle(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .replace(/(?:^|\s|\.|-)\S/g, c => c.toUpperCase())
    .replace(/\bve\b/g, 've')
    .replace(/\ba\.ş\./gi, 'A.Ş.')
    .replace(/\bfk\b/gi, 'FK')
    .replace(/\bsk\b/gi, 'SK')
    .trim();
}

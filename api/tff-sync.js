// Vercel Serverless Function — TFF Resmi Site Veri Çekici
// TFF BAL (pageID=1596) için iki adımlı GET→POST yaklaşımı kullanılır.
// Debug modu: ?debug=html → ham HTML'i döner; ?debug=fields → form alanlarını listeler

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-cache');   // debug sırasında cache istemiyoruz
  if (req.method === 'OPTIONS') return res.status(200).end();

  const grupID   = req.query.grupID   || '3304';
  const pageID   = req.query.pageID   || '1596';
  const hafta    = parseInt(req.query.hafta || '1', 10);
  const debugMode = req.query.debug   || '';  // 'html' | 'fields' | 'post' | ''

  const BASE_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5',
    'Connection':      'keep-alive',
  };

  const isBAL = pageID === '1596' || pageID === '981';
  const pageUrl = `https://www.tff.org/Default.aspx?pageID=${pageID}`;

  try {
    // ── Adım 1: İlk GET — ViewState + form alanlarını al ────────────────────
    const step1 = await fetch(pageUrl, {
      headers: { ...BASE_HEADERS, 'Referer': 'https://www.tff.org/default.aspx?pageID=981' },
      redirect: 'follow',
    });

    if (!step1.ok) throw new Error(`Step1 HTTP ${step1.status} — ${pageUrl}`);

    const html1   = decodeW1254(await step1.arrayBuffer());
    const cookies = extractCookies(step1.headers.get('set-cookie'));

    // Debug: ham HTML döndür
    if (debugMode === 'html') {
      return res.status(200).json({
        debug: 'html',
        step: 'step1_GET',
        url: pageUrl,
        htmlLength: html1.length,
        // İlk 8000 char — form alanlarını görmek için yeterli
        htmlPreview: html1.substring(0, 8000),
        cookies,
      });
    }

    // Form alanlarını bul
    const fields = extractAllFormFields(html1);

    // Debug: form alanlarını listele
    if (debugMode === 'fields') {
      return res.status(200).json({
        debug: 'fields',
        url: pageUrl,
        htmlLength: html1.length,
        fields,
        cookies: cookies ? 'var' : 'yok',
        // Dropdown'ları ara
        dropdowns: html1.match(/<select[^>]*name="([^"]+)"[^>]*>/gi) || [],
        hasPuanCetveli: html1.includes('Puan Cetveli'),
        hasGrupID: html1.includes('3304'),
        hasHafta: html1.includes('ddl') || html1.includes('Hafta'),
      });
    }

    const vs    = fields['__VIEWSTATE']          || '';
    const vsGen = fields['__VIEWSTATEGENERATOR'] || '';
    const evVal = fields['__EVENTVALIDATION']    || '';
    const prev  = fields['__PREVIOUSPAGE']       || '';

    // ── Adım 2: POST — grup + hafta seç ─────────────────────────────────────
    // TFF BAL sayfasında dropdown control adlarını keşfetmek için fields kullanıyoruz
    const grupField  = findDropdownName(fields, ['ddlGrup', 'Grup', 'grup']) || 'ctl00$ContentPlaceHolder1$ddlGrup';
    const haftaField = findDropdownName(fields, ['ddlHafta', 'Hafta', 'hafta']) || 'ctl00$ContentPlaceHolder1$ddlHafta';

    const formData = new URLSearchParams();
    if (vs)    formData.append('__VIEWSTATE',          vs);
    if (vsGen) formData.append('__VIEWSTATEGENERATOR', vsGen);
    if (evVal) formData.append('__EVENTVALIDATION',    evVal);
    if (prev)  formData.append('__PREVIOUSPAGE',       prev);

    // UpdatePanel postback için ScriptManager
    formData.append('__EVENTTARGET',   haftaField);
    formData.append('__EVENTARGUMENT', '');
    formData.append('ctl00$ScriptManager1', `ctl00$ContentPlaceHolder1$UpdatePanel1|${haftaField}`);

    formData.append(grupField,  grupID);
    formData.append(haftaField, String(hafta));

    // Debug: POST sonucunu döndür
    if (debugMode === 'post') {
      const step2 = await fetch(pageUrl, {
        method: 'POST',
        headers: {
          ...BASE_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer':      pageUrl,
          'Origin':       'https://www.tff.org',
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
        body: formData.toString(),
        redirect: 'follow',
      });
      const html2 = decodeW1254(await step2.arrayBuffer());
      return res.status(200).json({
        debug: 'post',
        postStatus: step2.status,
        html2Length: html2.length,
        html2Preview: html2.substring(0, 6000),
        grupField, haftaField,
        hasPuanCetveli: html2.includes('Puan Cetveli'),
        hasKulupId: html2.includes('kulupId'),
        formDataSent: formData.toString().substring(0, 500),
      });
    }

    // ── Normal mod: POST yap, parse et ──────────────────────────────────────
    let html;

    if (isBAL) {
      // POST dene
      const step2 = await fetch(pageUrl, {
        method: 'POST',
        headers: {
          ...BASE_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer':      pageUrl,
          'Origin':       'https://www.tff.org',
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
        body: formData.toString(),
        redirect: 'follow',
      });

      const html2 = decodeW1254(await step2.arrayBuffer());

      // POST'tan veri geldiyse kullan
      if (html2.includes('kulupId') && html2.length > 5000) {
        html = html2;
      } else {
        // Fallback: cookie ile doğrudan GET
        const directUrl = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;
        const step3 = await fetch(directUrl, {
          headers: {
            ...BASE_HEADERS,
            'Referer': pageUrl,
            ...(cookies ? { 'Cookie': cookies } : {}),
          },
          redirect: 'follow',
        });
        html = decodeW1254(await step3.arrayBuffer());
      }
    } else {
      // Nesine 3. Lig ve diğerleri — GET yeterli
      const url = `https://www.tff.org/Default.aspx?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}`;
      const r   = await fetch(url, {
        headers: { ...BASE_HEADERS, 'Referer': 'https://www.tff.org/default.aspx?pageID=971' },
        redirect: 'follow',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      html = decodeW1254(await r.arrayBuffer());
    }

    const standings = parseStandings(html);
    const fixtures  = parseFixtures(html);
    const success   = standings.length > 0 || fixtures.length > 0;

    return res.status(200).json({
      success, grupID, pageID, hafta,
      lastUpdated: new Date().toISOString(),
      standings, fixtures,
      _debug: {
        htmlLength:     html.length,
        standingsCount: standings.length,
        fixturesCount:  fixtures.length,
        puanIdx:        html.indexOf('Puan Cetveli'),
        fixtureIdx:     html.indexOf('Hafta'),
        isBAL,
        // Eğer başarısız olduysa tarayıcı devtools F12 > Network'ten form alanlarını kontrol et
        hint: !success ? `DEBUG için: /api/tff-sync?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}&debug=fields` : undefined,
      },
    });

  } catch (err) {
    return res.status(200).json({
      success: false, error: err.message,
      _debug: {
        pageID, grupID, hafta, isBAL,
        debugHint: `Hata detayı için: /api/tff-sync?pageID=${pageID}&grupID=${grupID}&hafta=${hafta}&debug=html`,
      },
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

// ─── Tüm form hidden alanlarını çıkart ──────────────────────────────────────
function extractAllFormFields(html) {
  const fields = {};
  for (const m of html.matchAll(/name="([^"]+)"[^>]*value="([^"]*)"/gi)) {
    fields[m[1]] = m[2];
  }
  return fields;
}

// ─── Dropdown adını bul ──────────────────────────────────────────────────────
function findDropdownName(fields, keywords) {
  for (const key of Object.keys(fields)) {
    for (const kw of keywords) {
      if (key.toLowerCase().includes(kw.toLowerCase())) return key;
    }
  }
  return null;
}

// ─── Set-Cookie → cookie string ──────────────────────────────────────────────
function extractCookies(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader
    .split(/,(?=[^;]+=[^;]+;|[^;]+=)/)
    .map(c => c.split(';')[0].trim())
    .join('; ');
}

// ─── PUAN DURUMU PARSER ──────────────────────────────────────────────────────
function parseStandings(html) {
  const results = [];

  let tableHtml = tableAfterText(html, ['Puan Cetveli', 'PUAN CETVELİ', 'PUAN DURUMU']);

  if (!tableHtml) {
    for (const m of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
      const t = m[0];
      if (t.includes('kulupId') && !t.includes('kisiId') && !t.includes('kisiID')) {
        const count = (t.match(/kulupId=/gi) || []).length;
        if (count >= 8) { tableHtml = t; break; }
      }
    }
  }

  if (!tableHtml) return results;

  const rowRe = /kulupId=(\d+)[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/td>([\s\S]*?)<\/tr>/gi;
  let m, rank = 1;

  while ((m = rowRe.exec(tableHtml)) !== null) {
    const kulupId = parseInt(m[1], 10);
    const rawName = clean(m[2]).replace(/^\d+\.\s*/, '').replace(/^\d+\s+/, '').trim();
    if (!rawName || rawName.length < 2) continue;
    const nums = tdNums(m[3]);
    if (nums.length >= 8) {
      results.push({
        rank: rank++, kulupId,
        name: toTitle(rawName),
        played: nums[0], won: nums[1], drawn: nums[2], lost: nums[3],
        gf: nums[4], ga: nums[5], gd: nums[6], pts: nums[7],
      });
    }
  }
  return results;
}

// ─── FİKSTÜR PARSER ─────────────────────────────────────────────────────────
function parseFixtures(html) {
  const results = [];
  const sec = fixtureSection(html);
  if (!sec) return results;

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
    const row  = trm[1];
    const kIds = [...row.matchAll(/kulupId=(\d+)/gi)].map(m => parseInt(m[1], 10));
    if (kIds.length < 2) continue;
    const home = kIds[0], away = kIds[kIds.length - 1];
    if (home === away) continue;

    const tNames   = [...row.matchAll(/kulupId=\d+[^>]*>([\s\S]*?)<\/a>/gi)].map(m => clean(m[1]));
    const homeName = tNames[0] || '', awayName = tNames[tNames.length - 1] || '';
    if (!homeName || !awayName) continue;

    const sm = row.match(/macId[^>]*>([\s\S]*?)<\/a>/i);
    let hScore = null, aScore = null, played = false;
    if (sm) {
      const txt = clean(sm[1]).replace(/\s/g, '');
      const sp  = /^(\d+)-(\d+)$/.exec(txt);
      if (sp) { hScore = +sp[1]; aScore = +sp[2]; played = true; }
    }

    out.push({
      week,
      homeKulupId: home, homeTeamName: toTitle(homeName),
      awayKulupId: away, awayTeamName: toTitle(awayName),
      homeScore: hScore, awayScore: aScore, isPlayed: played,
    });
  }
  return out;
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────
function tableAfterText(html, needles) {
  for (const n of needles) {
    const i = html.toLowerCase().indexOf(n.toLowerCase());
    if (i === -1) continue;
    const tm = html.substring(i).match(/<table[\s\S]*?<\/table>/i);
    if (tm && tm[0].includes('kulupId')) return tm[0];
  }
  return null;
}

function fixtureSection(html) {
  const markers = ['Fikstür Listesi', 'FİKSTÜR', '1.Hafta', '1. Hafta', 'fikstür'];
  for (const mk of markers) {
    const i = html.indexOf(mk);
    if (i !== -1) return html.substring(i);
  }
  const tm = /\d+\.\s*Hafta/i.exec(html);
  return tm ? html.substring(tm.index) : null;
}

function clean(s) {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function tdNums(tdHtml) {
  const out = [];
  for (const tm of tdHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const v = clean(tm[1]).replace(/\*/g, '');
    if (/^-?\d+$/.test(v)) out.push(parseInt(v, 10));
  }
  return out;
}

function toTitle(s) {
  if (!s) return s;
  return s.toLowerCase()
    .replace(/(?:^|\s|\.|-)\S/g, c => c.toUpperCase())
    .replace(/\bve\b/g, 've').replace(/\ba\.ş\./gi, 'A.Ş.').replace(/\bfk\b/gi, 'FK').replace(/\bsk\b/gi, 'SK')
    .trim();
}

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { LEAGUES } from '../constants';
import { calculateLiveStandings } from '../utils';
import { fetchTFFData, mapTFFStandingsToTeams, hasTFFSync } from '../services/tffService';
import { Match, Team } from '../types';
import { Download, X, Share, RefreshCw } from 'lucide-react';

interface LeagueStandingsExportProps {
  leagueId: 'karabuk' | 'eflani';
  onClose: () => void;
}

const BOT_TOKEN = '5747202724:AAHLfOnWPZE0TAyvFO0vEaJUYyVYYOOodC4';
const CHAT_IDS  = ['860174169', '-1001794193133', '818845314'];

const EXPORT_W = 1080;
const EXPORT_H = 1350;
const SCALE    = 2;

const ROW_H     = 46;
const ROW_PAD_X = 12;
const BADGE_W   = 32;
const BADGE_GAP = 10;
const COL_GAP   = 6;
const PAD_X     = 48;
const PAD_Y     = 48;

const COLS: { key: keyof Team | 'gd'; label: string; w: number }[] = [
  { key: 'played', label: 'O',  w: 26 },
  { key: 'won',    label: 'G',  w: 26 },
  { key: 'drawn',  label: 'B',  w: 26 },
  { key: 'lost',   label: 'M',  w: 26 },
  { key: 'gf',     label: 'A',  w: 26 },
  { key: 'ga',     label: 'Y',  w: 26 },
  { key: 'gd',     label: 'AV', w: 34 },
  { key: 'pts',    label: 'P',  w: 34 },
];

const colValue = (team: Team, key: keyof Team | 'gd'): number => {
  if (key === 'gd') return (team.gf ?? 0) - (team.ga ?? 0);
  return (team as any)[key] as number;
};

// ─── Tema konfigürasyonları ──────────────────────────────────────────────────
const THEMES = {
  karabuk: {
    gradient0: '#0c1a3b',
    gradient1: '#1e3a8a',
    gradient2: '#7f1d1d',
    leagueLabel: 'TFF 3. LİG 3. GRUP',
    teamLabel: 'KİY SPOR',
    instagram: '@karabukidmanyurduspor',
    promotionZones: 2, // ilk 2 playoff
    relegationStart: 14, // son 2 düşme
  },
  eflani: {
    gradient0: '#052e16',
    gradient1: '#14532d',
    gradient2: '#166534',
    leagueLabel: 'BÖLGESEL AMATÖR LİG 4. GRUP',
    teamLabel: 'TAVUK EVİ EFLANİ SPOR',
    instagram: '@spor_eflani',
    promotionZones: 1,
    relegationStart: 13,
  },
} as const;

// ─── Canvas çizimi ───────────────────────────────────────────────────────────
function drawCanvas(
  canvas: HTMLCanvasElement,
  standings: Team[],
  week: number,
  leagueId: 'karabuk' | 'eflani'
) {
  const W = EXPORT_W * SCALE;
  const H = EXPORT_H * SCALE;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  const S = SCALE;
  const theme = THEMES[leagueId];
  const n = standings.length;

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // Arka plan
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    theme.gradient0);
  grad.addColorStop(0.35, theme.gradient1);
  grad.addColorStop(1,    theme.gradient2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // İnce üst çizgi aksan
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, 'rgba(255,255,255,0)');
  accentGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  accentGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 3 * S);

  const leftX  = PAD_X * S;
  const rightX = (EXPORT_W - PAD_X) * S;
  const contentW = rightX - leftX;

  let y = PAD_Y * S;

  // Lig adı
  ctx.textAlign     = 'center';
  ctx.fillStyle     = 'rgba(255,255,255,0.55)';
  ctx.font          = `600 ${20 * S}px 'Arial', sans-serif`;
  ctx.letterSpacing = `${2.5 * S}px`;
  ctx.fillText(theme.leagueLabel, W / 2, y + 20 * S);
  y += 38 * S;

  // Hafta
  ctx.fillStyle     = 'rgba(255,255,255,0.4)';
  ctx.font          = `700 ${18 * S}px 'Arial', sans-serif`;
  ctx.letterSpacing = `${3 * S}px`;
  ctx.fillText(`${week}. HAFTA`, W / 2, y + 18 * S);
  y += 36 * S;

  // Ana başlık
  ctx.fillStyle     = '#ffffff';
  ctx.font          = `900 ${80 * S}px 'Arial', sans-serif`;
  ctx.letterSpacing = `${-2 * S}px`;
  ctx.fillText('PUAN DURUMU', W / 2, y + 80 * S);
  y += 100 * S;

  ctx.letterSpacing = '0px';

  // Ayırıcı çizgi
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(leftX, y, contentW, 2 * S);
  y += 16 * S;

  // Sütun başlıkları
  const colsW = COLS.reduce((s, c) => s + c.w, 0) + COL_GAP * (COLS.length - 1);
  let colX = rightX - colsW * S;

  for (const col of COLS) {
    ctx.textAlign  = 'center';
    ctx.font       = `700 ${14 * S}px 'Arial', sans-serif`;
    ctx.fillStyle  = col.key === 'pts' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
    ctx.fillText(col.label, colX + (col.w / 2) * S, y + 16 * S);
    colX += (col.w + COL_GAP) * S;
  }
  y += 26 * S;

  // İnce çizgi
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(leftX, y, contentW, 1.5 * S);
  y += 8 * S;

  // Satırlar
  standings.forEach((team, i) => {
    const isPromotion  = i < theme.promotionZones;
    const isPlayoff    = leagueId === 'karabuk' && i >= theme.promotionZones && i < theme.promotionZones + 2;
    const isRelegation = i >= n - 2;

    const badgeBg = isPromotion ? '#16a34a' :
                    isPlayoff   ? '#2563eb' :
                    isRelegation ? '#dc2626' : '#374151';

    const rowY = y;

    // Satır arka planı
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)';
    roundRect(leftX, rowY, contentW, ROW_H * S, 5 * S);
    ctx.fill();

    // Sıra rozeti
    const badgeX = leftX + ROW_PAD_X * S;
    const badgeY = rowY + ((ROW_H - BADGE_W) / 2) * S;
    ctx.fillStyle = badgeBg;
    roundRect(badgeX, badgeY, BADGE_W * S, BADGE_W * S, 4 * S);
    ctx.fill();

    ctx.fillStyle     = '#ffffff';
    ctx.font          = `900 ${15 * S}px 'Arial', sans-serif`;
    ctx.letterSpacing = '0px';
    ctx.textAlign     = 'center';
    ctx.fillText(String(i + 1), badgeX + (BADGE_W / 2) * S, rowY + (ROW_H / 2 + 5.5) * S);

    // Takım adı
    const nameX    = leftX + (ROW_PAD_X + BADGE_W + BADGE_GAP) * S;
    const nameMaxW = rightX - colsW * S - 10 * S - nameX;
    ctx.fillStyle     = '#ffffff';
    ctx.font          = `700 ${17 * S}px 'Arial', sans-serif`;
    ctx.letterSpacing = `${0.2 * S}px`;
    ctx.textAlign     = 'left';
    let name = team.name.toUpperCase();
    while (ctx.measureText(name).width > nameMaxW && name.length > 3) name = name.slice(0, -1);
    if (name !== team.name.toUpperCase()) name += '…';
    ctx.fillText(name, nameX, rowY + (ROW_H / 2 + 6) * S);

    // İstatistikler
    colX = rightX - colsW * S;
    for (const col of COLS) {
      const isPts = col.key === 'pts';
      ctx.textAlign     = 'center';
      ctx.letterSpacing = '0px';
      if (isPts) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        roundRect(colX, rowY + 7 * S, col.w * S, (ROW_H - 14) * S, 4 * S);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.font      = `900 ${17 * S}px 'Arial', sans-serif`;
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font      = `600 ${17 * S}px 'Arial', sans-serif`;
      }
      ctx.fillText(String(colValue(team, col.key)), colX + (col.w / 2) * S, rowY + (ROW_H / 2 + 6) * S);
      colX += (col.w + COL_GAP) * S;
    }
    y += (ROW_H + 3) * S;
  });

  y += 14 * S;

  // Alt çizgi
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(leftX, y, contentW, 2 * S);
  y += 16 * S;

  // Instagram tag
  ctx.textAlign     = 'center';
  ctx.fillStyle     = 'rgba(255,255,255,0.28)';
  ctx.font          = `500 ${15 * S}px 'Arial', sans-serif`;
  ctx.letterSpacing = `${1 * S}px`;
  ctx.fillText(theme.instagram, W / 2, y + 15 * S);
}

// ─── Önizleme satır bileşeni ─────────────────────────────────────────────────
const PreviewRow = ({ team, index, total, leagueId }: { team: Team; index: number; total: number; leagueId: string }) => {
  const theme = THEMES[leagueId as keyof typeof THEMES];
  const isPromotion  = index < theme.promotionZones;
  const isPlayoff    = leagueId === 'karabuk' && index >= theme.promotionZones && index < theme.promotionZones + 2;
  const isRelegation = index >= total - 2;
  const badgeBg = isPromotion ? '#16a34a' : isPlayoff ? '#2563eb' : isRelegation ? '#dc2626' : '#374151';

  return (
    <div style={{ width: '100%', height: ROW_H, display: 'flex', alignItems: 'center', background: index % 2 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)', borderRadius: 5, padding: `0 ${ROW_PAD_X}px`, boxSizing: 'border-box', flexShrink: 0 }}>
      <div style={{ background: badgeBg, width: BADGE_W, height: BADGE_W, borderRadius: 4, color: '#fff', fontSize: 15, fontWeight: 900, lineHeight: `${BADGE_W}px`, textAlign: 'center', flexShrink: 0, marginRight: BADGE_GAP, boxSizing: 'border-box' }}>{index + 1}</div>
      <div style={{ flex: 1, color: '#fff', fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: 8 }}>{team.name}</div>
      <div style={{ display: 'flex', gap: COL_GAP, flexShrink: 0, alignItems: 'center' }}>
        {COLS.map(col => {
          const isPts = col.key === 'pts';
          return (
            <span key={col.key} style={{ display: 'inline-block', width: col.w, fontSize: 17, fontWeight: isPts ? 900 : 600, lineHeight: `${isPts ? ROW_H - 14 : ROW_H}px`, textAlign: 'center', color: isPts ? '#fbbf24' : '#94a3b8', background: isPts ? 'rgba(0,0,0,0.35)' : 'transparent', borderRadius: isPts ? 4 : 0, height: isPts ? ROW_H - 14 : ROW_H, boxSizing: 'border-box' }}>
              {colValue(team, col.key)}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
const LeagueStandingsExport: React.FC<LeagueStandingsExportProps> = ({ leagueId, onClose }) => {
  const league = LEAGUES[leagueId];
  const theme  = THEMES[leagueId];

  const [isDownloading,     setIsDownloading]     = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [isSyncing,         setIsSyncing]         = useState(false);
  const [syncStatus,        setSyncStatus]        = useState<'idle' | 'ok' | 'err'>('idle');
  const [tffStandings,      setTffStandings]      = useState<Team[] | null>(null);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // LocalStorage'dan fixtures yükle
  const standings = useMemo(() => {
    if (tffStandings && tffStandings.length > 0) return tffStandings;
    const saved = localStorage.getItem(`fixtures_${leagueId}`);
    let fixtures: Match[] = [...league.fixtures];
    if (saved) { try { fixtures = JSON.parse(saved); } catch (_) { /* ignore */ } }
    return calculateLiveStandings(league.teams, fixtures);
  }, [league, leagueId, tffStandings]);

  const autoWeek = useMemo(() => {
    if (standings.length === 0) return league.currentWeek;
    const avg = Math.round(standings.reduce((s, t) => s + t.played, 0) / standings.length);
    return avg === 0 ? league.currentWeek : avg;
  }, [standings, league.currentWeek]);

  const [selectedWeek, setSelectedWeek] = useState(autoWeek);

  useEffect(() => {
    const update = () => {
      if (previewWrapperRef.current)
        setPreviewScale(Math.min(1, previewWrapperRef.current.clientWidth / EXPORT_W));
    };
    update();
    const obs = new ResizeObserver(update);
    if (previewWrapperRef.current) obs.observe(previewWrapperRef.current);
    return () => obs.disconnect();
  }, []);

  // Açılınca otomatik TFF sync
  useEffect(() => {
    if (!hasTFFSync(leagueId)) return;
    handleSync();
  }, [leagueId]); // eslint-disable-line

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const data = await fetchTFFData(leagueId);
      if (!data?.success) throw new Error('TFF verisi alınamadı');
      const mapped = mapTFFStandingsToTeams(data.standings, league.teams, leagueId);
      setTffStandings(mapped);
      setSyncStatus('ok');
    } catch (_) {
      setSyncStatus('err');
    } finally {
      setIsSyncing(false);
    }
  };

  const buildCanvas = () => {
    const canvas = document.createElement('canvas');
    drawCanvas(canvas, standings, selectedWeek, leagueId);
    return canvas;
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const canvas  = buildCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${leagueId}-puan-durumu.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${league.name} Puan Durumu` });
          return;
        }
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${leagueId}-puan-durumu.png`;
      a.click();
    } catch (err) {
      console.error('Export hatası:', err);
      alert('Görsel oluşturulamadı.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendTelegram = async () => {
    if (isSendingTelegram) return;
    setIsSendingTelegram(true);
    try {
      const canvas = buildCanvas();
      // sendDocument kullan — sendPhoto'nun "bad request" hatasından kaçınır
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(b => b ? res(b) : rej(new Error('Blob hatası')), 'image/png')
      );
      let failCount = 0;
      for (const chatId of CHAT_IDS) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('document', blob, `${leagueId}-puan-durumu.png`);
        form.append('caption', `📊 ${league.leagueName} ${selectedWeek}. Hafta Puan Durumu`);
        const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.ok) failCount++;
      }
      if (failCount === 0) alert(`✅ Gönderildi! (${CHAT_IDS.length} grup)`);
      else alert(`⚠️ ${failCount} grup gönderilemedi. Diğerleri iletildi.`);
    } catch (err: any) {
      alert('Telegram hatası: ' + (err.message || 'Bilinmeyen'));
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const bgStyle = `linear-gradient(180deg, ${theme.gradient0} 0%, ${theme.gradient1} 40%, ${theme.gradient2} 100%)`;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Üst bar */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, color: '#fff' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{league.name}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{league.leagueName}</span>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Aksiyon çubuğu */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>

          {/* Hafta göstergesi */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', padding: '8px 14px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{selectedWeek}. Hafta</span>
          </div>

          {/* TFF Sync */}
          {hasTFFSync(leagueId) && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: syncStatus === 'ok' ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.08)', border: `1px solid ${syncStatus === 'ok' ? 'rgba(22,163,74,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 8, color: syncStatus === 'ok' ? '#4ade80' : '#fff', fontSize: 13, fontWeight: 700, cursor: isSyncing ? 'wait' : 'pointer', opacity: isSyncing ? 0.7 : 1 }}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Güncelleniyor…' : syncStatus === 'ok' ? '✓ TFF Aktif' : 'TFF Güncelle'}
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Telegram */}
          <button onClick={handleSendTelegram} disabled={isSendingTelegram} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white text-sm disabled:opacity-60 transition-colors">
            {isSendingTelegram ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Share className="w-5 h-5" />}
            {isSendingTelegram ? 'Gönderiliyor…' : "Telegram'a At"}
          </button>

          {/* İndir */}
          <button onClick={handleDownload} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white text-sm disabled:opacity-60 transition-colors">
            {isDownloading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
            {isDownloading ? 'Hazırlanıyor…' : 'İndir / Paylaş'}
          </button>
        </div>

        {/* Önizleme */}
        <div ref={previewWrapperRef} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', width: '100%', height: EXPORT_H * previewScale }}>
          <div style={{ width: EXPORT_W, transformOrigin: 'top left', transform: `scale(${previewScale})` }}>
            <div style={{ width: EXPORT_W, height: EXPORT_H, background: bgStyle, padding: `${PAD_Y}px ${PAD_X}px`, display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', overflow: 'hidden' }}>
              {/* Başlık */}
              <div style={{ textAlign: 'center', flexShrink: 0, marginBottom: 20 }}>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 20, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2.5px', lineHeight: 1, marginBottom: 8 }}>{theme.leagueLabel}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', lineHeight: 1, marginBottom: 14 }}>{selectedWeek}. HAFTA</div>
                <div style={{ color: '#fff', fontSize: 80, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-2px', lineHeight: 1 }}>PUAN DURUMU</div>
              </div>

              {/* Üst ayırıcı */}
              <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.25)', borderRadius: 1, flexShrink: 0, marginBottom: 8 }} />

              {/* Sütun başlıkları */}
              <div style={{ display: 'flex', alignItems: 'center', padding: `0 ${ROW_PAD_X}px`, boxSizing: 'border-box', marginBottom: 4, flexShrink: 0 }}>
                <div style={{ width: BADGE_W + BADGE_GAP, flexShrink: 0 }} />
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: COL_GAP }}>
                  {COLS.map(col => (
                    <span key={col.key} style={{ display: 'inline-block', width: col.w, textAlign: 'center', fontSize: 14, fontWeight: 700, color: col.key === 'pts' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)' }}>{col.label}</span>
                  ))}
                </div>
              </div>

              {/* İnce çizgi */}
              <div style={{ width: '100%', height: 1.5, background: 'rgba(255,255,255,0.15)', flexShrink: 0, marginBottom: 6 }} />

              {/* Satırlar */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}>
                {standings.map((team, i) => (
                  <PreviewRow key={team.id} team={team} index={i} total={standings.length} leagueId={leagueId} />
                ))}
              </div>

              {/* Alt */}
              <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.18)', borderRadius: 1, flexShrink: 0, marginTop: 10, marginBottom: 10 }} />
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: 15, fontWeight: 500, letterSpacing: '1px', flexShrink: 0 }}>{theme.instagram}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LeagueStandingsExport;

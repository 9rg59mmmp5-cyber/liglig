import React, { useMemo, useRef, useState, useEffect } from 'react';
import { LEAGUES } from '../constants';
import { calculateLiveStandings } from '../utils';
import { Match, Team } from '../types';
import { Download, X, Share, ChevronLeft, ChevronRight } from 'lucide-react';

interface CombinedStandingsExportProps {
  onClose: () => void;
}

const BOT_TOKEN = '5747202724:AAHLfOnWPZE0TAyvFO0vEaJUYyVYYOOodC4';
const CHAT_IDS  = ['860174169', '-1001794193133', '818845314'];

const EXPORT_W = 1080;
const EXPORT_H = 1350;
const SCALE    = 2;

const ROW_H     = 52;
const ROW_PAD_X = 12;
const BADGE_W   = 34;
const BADGE_GAP = 12;
const COL_GAP   = 8;
const PAD_X     = 56;
const PAD_Y     = 52;
const MAX_WEEK  = 26;

const COLS: { key: keyof Team | 'gd'; label: string; w: number }[] = [
  { key: 'played', label: 'O',  w: 28 },
  { key: 'won',    label: 'G',  w: 28 },
  { key: 'drawn',  label: 'B',  w: 28 },
  { key: 'lost',   label: 'M',  w: 28 },
  { key: 'gf',     label: 'A',  w: 28 },
  { key: 'ga',     label: 'Y',  w: 28 },
  { key: 'gd',     label: 'AV', w: 36 },
  { key: 'pts',    label: 'P',  w: 36 },
];

const colValue = (team: Team, key: keyof Team | 'gd'): number => {
  if (key === 'gd') return (team.gf ?? 0) - (team.ga ?? 0);
  return (team as any)[key] as number;
};

// ── Canvas çizimi ────────────────────────────────────────────────────────────
function drawCanvas(
  canvas: HTMLCanvasElement,
  standingsA: Team[],
  standingsB: Team[],
  week: number
) {
  const W = EXPORT_W * SCALE;
  const H = EXPORT_H * SCALE;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d')!;
  const S = SCALE;

  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0,    '#450a0a');
  grad.addColorStop(0.42, '#7f1d1d');
  grad.addColorStop(1,    '#0f0f0f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  let y = PAD_Y * S;

  ctx.textAlign     = 'center';
  ctx.fillStyle     = 'rgba(255,255,255,0.65)';
  ctx.font          = `500 ${24 * S}px Inter, Arial, sans-serif`;
  ctx.letterSpacing = `${3 * S}px`;
  ctx.fillText('KARABÜK ALİ KEMAL ERGÜVEN 1.AMATÖR LİGİ', W / 2, y + 24 * S);
  y += 48 * S;

  ctx.fillStyle     = 'rgba(255,255,255,0.45)';
  ctx.font          = `700 ${20 * S}px Inter, Arial, sans-serif`;
  ctx.letterSpacing = `${3 * S}px`;
  ctx.fillText(`${week}. HAFTA`, W / 2, y + 20 * S);
  y += 44 * S;

  ctx.fillStyle     = '#ffffff';
  ctx.font          = `900 ${90 * S}px Inter, Arial, sans-serif`;
  ctx.letterSpacing = `${-2 * S}px`;
  ctx.fillText('PUAN DURUMU', W / 2, y + 90 * S);
  y += 120 * S;

  ctx.letterSpacing = '0px';

  const colsW    = COLS.reduce((s, c) => s + c.w, 0) + COL_GAP * (COLS.length - 1);
  const leftX    = PAD_X * S;
  const rightX   = (EXPORT_W - PAD_X) * S;
  const contentW = rightX - leftX;

  const drawTable = (title: string, standings: Team[]) => {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(leftX, y, contentW, 2 * S);
    y += 2 * S;

    const headerY = y + 10 * S;
    ctx.textAlign     = 'left';
    ctx.fillStyle     = '#ffffff';
    ctx.font          = `900 ${30 * S}px Inter, Arial, sans-serif`;
    ctx.letterSpacing = `${-0.5 * S}px`;
    ctx.fillText(title, leftX + (BADGE_W + BADGE_GAP) * S, headerY + 28 * S);

    let colX = rightX - colsW * S;
    for (const col of COLS) {
      ctx.textAlign     = 'center';
      ctx.font          = `700 ${15 * S}px Inter, Arial, sans-serif`;
      ctx.letterSpacing = '0px';
      ctx.fillStyle = col.key === 'pts' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
      ctx.fillText(col.label, colX + (col.w / 2) * S, headerY + 20 * S);
      colX += (col.w + COL_GAP) * S;
    }
    y += 56 * S;

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(leftX, y, contentW, 2 * S);
    y += 8 * S;

    standings.forEach((team, i) => {
      const badgeBg =
        i === 0 ? '#16a34a' :
        i === 1 ? '#2563eb' :
        i >= standings.length - 2 ? '#dc2626' :
        '#475569';

      const rowY = y;
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(leftX, rowY, contentW, ROW_H * S, 6 * S);
      ctx.fill();

      const badgeX = leftX + ROW_PAD_X * S;
      const badgeY = rowY + ((ROW_H - BADGE_W) / 2) * S;
      ctx.fillStyle = badgeBg;
      roundRect(badgeX, badgeY, BADGE_W * S, BADGE_W * S, 5 * S);
      ctx.fill();

      ctx.fillStyle     = '#ffffff';
      ctx.font          = `900 ${17 * S}px Inter, Arial, sans-serif`;
      ctx.letterSpacing = '0px';
      ctx.textAlign     = 'center';
      ctx.fillText(String(i + 1), badgeX + (BADGE_W / 2) * S, rowY + (ROW_H / 2 + 6) * S);

      const nameX    = leftX + (ROW_PAD_X + BADGE_W + BADGE_GAP) * S;
      const nameMaxW = rightX - colsW * S - 10 * S - nameX;
      ctx.fillStyle     = '#ffffff';
      ctx.font          = `700 ${19 * S}px Inter, Arial, sans-serif`;
      ctx.letterSpacing = `${0.3 * S}px`;
      ctx.textAlign     = 'left';
      let name = team.name.toUpperCase();
      while (ctx.measureText(name).width > nameMaxW && name.length > 3) name = name.slice(0, -1);
      if (name !== team.name.toUpperCase()) name += '…';
      ctx.fillText(name, nameX, rowY + (ROW_H / 2 + 7) * S);

      colX = rightX - colsW * S;
      for (const col of COLS) {
        const isPts = col.key === 'pts';
        ctx.textAlign     = 'center';
        ctx.letterSpacing = '0px';
        if (isPts) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          roundRect(colX, rowY + 7 * S, col.w * S, (ROW_H - 14) * S, 4 * S);
          ctx.fill();
          ctx.fillStyle = '#facc15';
          ctx.font      = `900 ${19 * S}px Inter, Arial, sans-serif`;
        } else {
          ctx.fillStyle = '#a0aec0';
          ctx.font      = `700 ${19 * S}px Inter, Arial, sans-serif`;
        }
        ctx.fillText(String(colValue(team, col.key)), colX + (col.w / 2) * S, rowY + (ROW_H / 2 + 7) * S);
        colX += (col.w + COL_GAP) * S;
      }
      y += (ROW_H + 4) * S;
    });
    y += 14 * S;
  };

  drawTable('A GRUBU', standingsA);
  y += 20 * S;
  drawTable('B GRUBU', standingsB);

  y += 6 * S;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(leftX, y, contentW, 2 * S);
  y += 16 * S;

  ctx.textAlign     = 'center';
  ctx.fillStyle     = 'rgba(255,255,255,0.3)';
  ctx.font          = `500 ${16 * S}px Inter, Arial, sans-serif`;
  ctx.letterSpacing = `${1 * S}px`;
  ctx.fillText('sporkarabuk_', W / 2, y + 16 * S);
}

// ── Önizleme bileşenleri ─────────────────────────────────────────────────────
const Divider = ({ opacity = 0.25, my = 10 }: { opacity?: number; my?: number }) => (
  <div style={{ width: '100%', height: 2, background: `rgba(255,255,255,${opacity})`, borderRadius: 1, flexShrink: 0, marginTop: my, marginBottom: my, boxSizing: 'border-box' }} />
);

const RenderTable = ({ title, standings }: { title: string; standings: Team[] }) => (
  <div style={{ width: '100%', boxSizing: 'border-box' }}>
    <Divider opacity={0.35} my={0} />
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box', padding: `10px ${ROW_PAD_X}px 8px` }}>
      <div style={{ width: BADGE_W + BADGE_GAP, flexShrink: 0 }} />
      <div style={{ flex: 1, color: '#fff', fontSize: 30, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.5px', lineHeight: 1 }}>{title}</div>
      <div style={{ display: 'flex', gap: COL_GAP, flexShrink: 0 }}>
        {COLS.map(col => (
          <span key={col.key} style={{ display: 'inline-block', width: col.w, textAlign: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1, color: col.key === 'pts' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)' }}>{col.label}</span>
        ))}
      </div>
    </div>
    <Divider opacity={0.2} my={0} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: 6, boxSizing: 'border-box' }}>
      {standings.map((team, i) => {
        const badgeBg = i === 0 ? '#16a34a' : i === 1 ? '#2563eb' : i >= standings.length - 2 ? '#dc2626' : '#475569';
        return (
          <div key={team.id} style={{ width: '100%', height: ROW_H, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: `0 ${ROW_PAD_X}px`, boxSizing: 'border-box', flexShrink: 0 }}>
            <div style={{ background: badgeBg, width: BADGE_W, height: BADGE_W, borderRadius: 5, display: 'block', color: '#fff', fontSize: 17, fontWeight: 900, lineHeight: `${BADGE_W}px`, textAlign: 'center', flexShrink: 0, marginRight: BADGE_GAP, boxShadow: '0 2px 6px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>{i + 1}</div>
            <div style={{ flex: 1, color: '#fff', fontSize: 19, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingRight: 8 }}>{team.name}</div>
            <div style={{ display: 'flex', gap: COL_GAP, flexShrink: 0, alignItems: 'center', height: ROW_H }}>
              {COLS.map(col => {
                const isPts = col.key === 'pts';
                return (
                  <span key={col.key} style={{ display: 'inline-block', width: col.w, fontSize: 19, fontWeight: isPts ? 900 : 700, lineHeight: `${isPts ? ROW_H - 14 : ROW_H}px`, textAlign: 'center', color: isPts ? '#facc15' : '#a0aec0', background: isPts ? 'rgba(0,0,0,0.4)' : 'transparent', borderRadius: isPts ? 4 : 0, height: isPts ? ROW_H - 14 : ROW_H, verticalAlign: 'middle', boxSizing: 'border-box' }}>{colValue(team, col.key)}</span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Ana bileşen ──────────────────────────────────────────────────────────────
const CombinedStandingsExport: React.FC<CombinedStandingsExportProps> = ({ onClose }) => {
  const [isDownloading,     setIsDownloading]     = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const getLeagueData = (leagueId: string) => {
    const league = LEAGUES[leagueId];
    const saved  = localStorage.getItem(`fixtures_${leagueId}`);
    let fixtures: Match[] = [...league.fixtures];
    if (saved) { try { fixtures = JSON.parse(saved); } catch (_) { /* ignore */ } }
    return { standings: calculateLiveStandings(league.teams, fixtures), currentWeek: league.currentWeek };
  };

  const dataA       = useMemo(() => getLeagueData('amator_a'), []);
  const dataB       = useMemo(() => getLeagueData('amator_b'), []);
  const autoWeek    = Math.max(dataA.currentWeek, dataB.currentWeek);

  // ── Hafta seçimi state ────────────────────────────────────────────────────
  const [selectedWeek, setSelectedWeek] = useState(autoWeek);
  const decWeek = () => setSelectedWeek(w => Math.max(1, w - 1));
  const incWeek = () => setSelectedWeek(w => Math.min(MAX_WEEK, w + 1));

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

  const buildCanvas = () => {
    const canvas = document.createElement('canvas');
    drawCanvas(canvas, dataA.standings, dataB.standings, selectedWeek);
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
        const file = new File([blob], 'karabuk-amator-puan-durumu.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Karabük 1. Amatör Puan Durumu' });
          return;
        }
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'karabuk-amator-puan-durumu.png';
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
        form.append('document', blob, 'karabuk-amator-puan-durumu.png');
        form.append('caption', `📊 Karabük 1. Amatör Lig ${selectedWeek}. Hafta Puan Durumu`);
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Üst bar ─────────────────────────────────────────────────────── */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, color: '#fff' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>1. Amatör Ortak Puan Durumu</span>
          <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Hafta seçici + aksiyon butonları ────────────────────────────── */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>

          {/* Hafta seçici */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
            <button
              onClick={decWeek}
              disabled={selectedWeek <= 1}
              style={{ padding: '8px 14px', color: selectedWeek <= 1 ? 'rgba(255,255,255,0.25)' : '#fff', background: 'transparent', border: 'none', cursor: selectedWeek <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={20} />
            </button>
            <div style={{ minWidth: 80, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1, padding: '10px 4px', borderLeft: '1px solid rgba(255,255,255,0.12)', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
              {selectedWeek}. Hafta
            </div>
            <button
              onClick={incWeek}
              disabled={selectedWeek >= MAX_WEEK}
              style={{ padding: '8px 14px', color: selectedWeek >= MAX_WEEK ? 'rgba(255,255,255,0.25)' : '#fff', background: 'transparent', border: 'none', cursor: selectedWeek >= MAX_WEEK ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Otomatik hafta sıfırlama */}
          {selectedWeek !== autoWeek && (
            <button
              onClick={() => setSelectedWeek(autoWeek)}
              style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}
            >
              Otomatike dön ({autoWeek})
            </button>
          )}

          <div style={{ flex: 1 }} />

          {/* Telegram */}
          <button onClick={handleSendTelegram} disabled={isSendingTelegram} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white text-sm disabled:opacity-60 transition-colors">
            {isSendingTelegram ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Share className="w-5 h-5" />}
            {isSendingTelegram ? 'Gönderiliyor...' : "Telegram'a At"}
          </button>

          {/* İndir */}
          <button onClick={handleDownload} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-white text-sm disabled:opacity-60 transition-colors">
            {isDownloading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
            {isDownloading ? 'Hazırlanıyor...' : 'İndir / Paylaş'}
          </button>
        </div>

        {/* ── Önizleme ────────────────────────────────────────────────────── */}
        <div ref={previewWrapperRef} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', width: '100%', height: EXPORT_H * previewScale }}>
          <div style={{ width: EXPORT_W, transformOrigin: 'top left', transform: `scale(${previewScale})` }}>
            <div style={{ width: EXPORT_W, height: EXPORT_H, background: 'linear-gradient(180deg, #450a0a 0%, #7f1d1d 42%, #0f0f0f 100%)', padding: `${PAD_Y}px ${PAD_X}px`, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, marginBottom: 26 }}>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 24, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '3px', lineHeight: 1, marginBottom: 8 }}>KARABÜK ALİ KEMAL ERGÜVEN 1.AMATÖR LİGİ</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '3px', lineHeight: 1, marginBottom: 16 }}>{selectedWeek}. HAFTA</div>
                <div style={{ color: '#fff', fontSize: 90, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-2px', lineHeight: 1 }}>PUAN DURUMU</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <RenderTable title="A GRUBU" standings={dataA.standings} />
                <RenderTable title="B GRUBU" standings={dataB.standings} />
              </div>
              <Divider opacity={0.2} my={14} />
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 500, letterSpacing: '1px', flexShrink: 0 }}>sporkarabuk_</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CombinedStandingsExport;

import React, { useMemo, useRef, useState } from 'react';
import { LEAGUES } from '../constants';
import { calculateLiveStandings } from '../utils';
import { Match, Team } from '../types';
import { Download, X, Share } from 'lucide-react';
import html2canvas from 'html2canvas';

interface CombinedStandingsExportProps {
  onClose: () => void;
}

const CombinedStandingsExport: React.FC<CombinedStandingsExportProps> = ({ onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Helper to get data for a league
  const getLeagueData = (leagueId: string) => {
    const league = LEAGUES[leagueId];
    // Try to get from local storage
    const savedFixtures = localStorage.getItem(`fixtures_${leagueId}`);
    let fixtures: Match[] = [...league.fixtures];
    
    if (savedFixtures) {
      try {
        fixtures = JSON.parse(savedFixtures);
      } catch (e) {
        console.error(`Failed to parse fixtures for ${leagueId}`, e);
      }
    }

    const standings = calculateLiveStandings(league.teams, fixtures);
    return { league, standings, currentWeek: league.currentWeek };
  };

  const dataA = useMemo(() => getLeagueData('amator_a'), []);
  const dataB = useMemo(() => getLeagueData('amator_b'), []);

  // Determine the week to display (max of both or specific)
  const displayWeek = Math.max(dataA.currentWeek, dataB.currentWeek);

  const handleDownload = async () => {
    if (!exportRef.current || isDownloading) return;
    setIsDownloading(true);

    try {
      // Wait for fonts/images
      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#450a0a',
        logging: false,
        onclone: (_clonedDoc, element) => {
          // Fix all text elements - remove any transforms/padding that cause clipping
          const allTextEls = element.querySelectorAll('*');
          allTextEls.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.paddingTop = '0';
            htmlEl.style.paddingBottom = '0';
            htmlEl.style.lineHeight = '1.2';
            htmlEl.style.overflow = 'visible';
            htmlEl.style.transform = 'none';
          });
          // Fix row height to accommodate text properly
          const rows = element.querySelectorAll('.export-row');
          rows.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.height = '60px';
            htmlEl.style.display = 'flex';
            htmlEl.style.alignItems = 'center';
          });
        }
      });

      const dataUrl = canvas.toDataURL('image/png');

      if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
         const blob = await (await fetch(dataUrl)).blob();
         const file = new File([blob], "karabuk-amator-puan-durumu.png", { type: 'image/png' });
         if (navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'Karabük 1. Amatör Puan Durumu',
            });
            setIsDownloading(false);
            return;
         }
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'karabuk-amator-puan-durumu.png';
      link.click();
    } catch (err) {
      console.error("Export failed", err);
      alert("Görsel oluşturulamadı.");
    } finally {
      setIsDownloading(false);
    }
  };

  const RenderTable = ({ title, standings }: { title: string, standings: Team[] }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-2">
         <h3 className="text-4xl font-black text-white uppercase tracking-tighter" style={{lineHeight: '1.2'}}>{title}</h3>
         <div className="flex gap-4 text-white/60 font-bold text-xl uppercase tracking-widest" style={{lineHeight: '1.2'}}>
            <span className="w-8 text-center">O</span>
            <span className="w-8 text-center">G</span>
            <span className="w-8 text-center">B</span>
            <span className="w-8 text-center">M</span>
            <span className="w-8 text-center">A</span>
            <span className="w-8 text-center">Y</span>
            <span className="w-10 text-center">AV</span>
            <span className="w-10 text-center text-white">P</span>
         </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {standings.map((team, index) => {
            let rankColor = "bg-slate-700";
            if (index === 0) rankColor = "bg-green-600"; // Champion
            if (index === standings.length - 1) rankColor = "bg-red-600"; // Relegation

            return (
                <div key={team.id} className="export-row flex items-center h-16 bg-gradient-to-r from-black/40 to-black/20 backdrop-blur-sm border-b border-white/5 px-2">
                    {/* Rank */}
                    <div className={`${rankColor} w-10 h-10 flex items-center justify-center text-white font-black text-2xl rounded shadow-lg shrink-0 mr-3`} style={{lineHeight: '1'}}>
                        {index + 1}
                    </div>
                    {/* Team Name */}
                    <div className="flex-1 text-white font-bold text-2xl uppercase tracking-tight truncate pr-2" style={{lineHeight: '1.2'}}>
                        {team.name}
                    </div>
                    {/* Stats */}
                    <div className="flex gap-4 text-white font-bold text-2xl" style={{lineHeight: '1.2'}}>
                        <span className="w-8 text-center text-white/80">{team.played}</span>
                        <span className="w-8 text-center text-white/80">{team.won}</span>
                        <span className="w-8 text-center text-white/80">{team.drawn}</span>
                        <span className="w-8 text-center text-white/80">{team.lost}</span>
                        <span className="w-8 text-center text-white/80">{team.gf}</span>
                        <span className="w-8 text-center text-white/80">{team.ga}</span>
                        <span className="w-10 text-center text-white/80">{team.gd}</span>
                        <span className="w-10 text-center text-yellow-400 font-black bg-black/30 rounded flex items-center justify-center">{team.pts}</span>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl flex flex-col items-center">
        {/* Controls */}
        <div className="w-full flex justify-between items-center mb-4 text-white">
            <h2 className="text-xl font-bold">1. Amatör Ortak Puan Durumu</h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
                >
                    {isDownloading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
                    İndir / Paylaş
                </button>
                <button 
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        {/* Preview Container (Scaled down for view) */}
        <div className="overflow-auto max-h-[80vh] border border-white/10 rounded-xl shadow-2xl">
            {/* The Export Node */}
            <div 
                id="combined-export"
                ref={exportRef}
                style={{
                    width: '1080px',
                    height: '1350px',
                    background: 'linear-gradient(180deg, #450a0a 0%, #7f1d1d 40%, #000000 100%)',
                    padding: '60px',
                    display: 'flex',
                    flexDirection: 'column',
                    fontFamily: 'Inter, sans-serif',
                    position: 'relative'
                }}
            >
                {/* Header */}
                <div className="text-center mb-10">
                    <h2 className="text-white/80 text-3xl font-medium tracking-widest uppercase mb-2" style={{lineHeight: '1.2'}}>KARABÜK ALİ KEMAL ERGÜVEN 1.AMATÖR LİGİ</h2>
                    <h3 className="text-white/60 text-2xl font-bold tracking-widest uppercase mb-6" style={{lineHeight: '1.2'}}>{displayWeek}. HAFTA</h3>
                    <h1 className="text-white text-8xl font-black uppercase tracking-tighter drop-shadow-2xl" style={{lineHeight: '1.1', paddingBottom: '8px'}}>PUAN DURUMU</h1>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center gap-8">
                    <RenderTable title="A GRUBU" standings={dataA.standings} />
                    <RenderTable title="B GRUBU" standings={dataB.standings} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedStandingsExport;

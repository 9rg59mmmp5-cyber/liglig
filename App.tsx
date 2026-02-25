import React, { useState, useMemo, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { LEAGUES } from './constants';
import { calculateLiveStandings } from './utils';
import { Match, Team } from './types';
import StandingsTable from './components/StandingsTable';
import FixtureList from './components/FixtureList';
import { BarChart3, ArrowDown, Image, Smartphone, Calendar, Trophy, ChevronDown, CheckCircle2, X, Share, Settings, RefreshCw } from 'lucide-react';
import CombinedStandingsExport from './components/CombinedStandingsExport';
import LeagueStandingsExport from './components/LeagueStandingsExport';
import { fetchTFFData, mapTFFStandingsToTeams, mapTFFFixturesToMatches, hasTFFSync } from './services/tffService';

const App: React.FC = () => {
  // State for active league
  const [activeLeagueId, setActiveLeagueId] = useState<string>('eflani');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCombinedExport, setShowCombinedExport] = useState(false);
  const [showLeagueExport, setShowLeagueExport] = useState<'karabuk' | 'eflani' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // TFF Sync state
  const [tffStandings, setTffStandings] = useState<Team[] | null>(null);
  const [isTFFSyncing, setIsTFFSyncing] = useState(false);
  const [tffLastSync, setTffLastSync] = useState<string | null>(null);
  const [tffSyncError, setTffSyncError] = useState<string | null>(null);
  
  // Get current league config
  const currentLeague = LEAGUES[activeLeagueId];

  const [fixtures, setFixtures] = useState<Match[]>([...currentLeague.fixtures]);
  const [exportFormat, setExportFormat] = useState<'post' | 'story' | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'fixtures' | 'standings'>('standings');
  
  // New state for image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Load fixtures from local storage or constants when league changes
  // Bozuk/şişmiş veri tespiti: TFF sync birikimiyle 100+ maç eklenmiş olabilir
  useEffect(() => {
    const league = LEAGUES[activeLeagueId];
    // Tam tur-rövanş (tam sezon) için teorik maksimum: n*(n-1)
    // Bu sayede eflani gibi TFF'den ekstra hafta çeken liglerde yanlış reset olmaz
    const fullSeasonMax = league.teams.length * (league.teams.length - 1);
    const maxExpected = Math.max(league.fixtures.length * 3, fullSeasonMax + 10);
    const savedFixtures = localStorage.getItem(`fixtures_${activeLeagueId}`);
    if (savedFixtures) {
      try {
        const parsed: Match[] = JSON.parse(savedFixtures);
        if (parsed.length > maxExpected) {
          // Bozuk veri — sıfırla ve TFF'i yeniden sync'e zorla
          console.warn(`[TFF] Bozuk fixtures (${parsed.length} maç > beklenen ${maxExpected}), temizleniyor.`);
          localStorage.removeItem(`fixtures_${activeLeagueId}`);
          localStorage.removeItem(`tff_last_auto_${activeLeagueId}`);
          setFixtures([...league.fixtures]);
        } else {
          setFixtures(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved fixtures", e);
        setFixtures([...league.fixtures]);
      }
    } else {
      setFixtures([...league.fixtures]);
    }
  }, [activeLeagueId]);

  const handleSaveFixtures = () => {
    try {
      localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(fixtures));
      alert("Fikstür ve skorlar başarıyla kaydedildi! Sayfayı yenileseniz bile verileriniz korunacaktır.");
    } catch (error) {
      console.error("Save failed", error);
      alert("Kaydetme sırasında bir hata oluştu.");
    }
  };

  // TFF senkronizasyon handler (manuel tam güncelleme — tüm haftalar)
  const handleTFFSync = useCallback(async () => {
    if (isTFFSyncing) return;
    setIsTFFSyncing(true);
    setTffSyncError(null);

    try {
      const data = await fetchTFFData(activeLeagueId);
      if (!data || !data.success) {
        throw new Error(data?.error || 'TFF verisi alınamadı');
      }

      // Puan durumu doğrudan TFF'den
      const mappedStandings = mapTFFStandingsToTeams(data.standings, currentLeague.teams, activeLeagueId);
      setTffStandings(mappedStandings);

      // Fixtures: constants'taki temiz listeyi base al — birikmiş localStorage değil
      const baseFixtures: Match[] = [...currentLeague.fixtures];
      const updatedFixtures = mapTFFFixturesToMatches(data.fixtures, currentLeague.teams, baseFixtures, activeLeagueId);
      setFixtures(updatedFixtures);
      localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
      localStorage.setItem(`tff_last_auto_${activeLeagueId}`, String(Date.now()));

      const syncTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setTffLastSync(syncTime);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      setTffSyncError(message);
      console.error('TFF sync hatası:', err);
    } finally {
      setIsTFFSyncing(false);
    }
  }, [activeLeagueId, isTFFSyncing, currentLeague.teams, currentLeague.fixtures]);

  // Lig değişince TFF state'i sıfırla
  useEffect(() => {
    setTffStandings(null);
    setTffLastSync(null);
    setTffSyncError(null);
  }, [activeLeagueId]);

  // TFF destekli ligde otomatik çek (lig açılınca, 5 dk caching)
  useEffect(() => {
    if (!hasTFFSync(activeLeagueId)) return;

    const cacheKey = `tff_last_auto_${activeLeagueId}`;
    const lastAuto = parseInt(localStorage.getItem(cacheKey) || '0', 10);
    if (Date.now() - lastAuto < 5 * 60 * 1000) return;

    let cancelled = false;
    (async () => {
      try {
        const { fetchTFFData, fetchTFFDataQuick, needsFullAutoSync, mapTFFStandingsToTeams: mapStandings, mapTFFFixturesToMatches: mapFixtures } = await import('./services/tffService');
        if (cancelled) return;
        // BAL gibi tüm haftaları çekmesi gereken ligler için fetchTFFData,
        // Nesine 3. Lig gibi sadece son hafta yeterli olanlar için fetchTFFDataQuick
        const fetchFn = needsFullAutoSync(activeLeagueId) ? fetchTFFData : fetchTFFDataQuick;
        const data = await fetchFn(activeLeagueId);
        if (cancelled || !data?.success) return;

        // Puan durumunu TFF'den doğrudan al
        const mappedStandings = mapStandings(data.standings, currentLeague.teams, activeLeagueId);
        setTffStandings(mappedStandings);

        // Fixtures: birikmiş localStorage DEĞİL, constants'taki temiz listeyi base al
        // Bu sayede her sync'te sıfırdan doğru fixture listesi oluşur
        const baseFixtures: Match[] = [...currentLeague.fixtures];
        const updatedFixtures = mapFixtures(data.fixtures, currentLeague.teams, baseFixtures, activeLeagueId);
        setFixtures(updatedFixtures);
        localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
        localStorage.setItem(cacheKey, String(Date.now()));

        const syncTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        setTffLastSync(syncTime);
      } catch (_) { /* otomatik çekme hatası sessizce geç */ }
    })();
    return () => { cancelled = true; };
  }, [activeLeagueId, currentLeague.teams, currentLeague.fixtures]);

  // Recalculate standings — TFF verisi varsa onu kullan
  const liveTeams = useMemo(() => {
    if (tffStandings && tffStandings.length > 0) return tffStandings;
    return calculateLiveStandings(currentLeague.teams, fixtures);
  }, [fixtures, currentLeague.teams, tffStandings]);

  // Calculate dynamic week based on average matches played
  const dynamicWeek = useMemo(() => {
      if (liveTeams.length === 0) return currentLeague.currentWeek;
      
      const totalPlayed = liveTeams.reduce((acc, team) => acc + team.played, 0);
      const avg = Math.round(totalPlayed / liveTeams.length);
      
      // If no matches played (avg 0), fallback to configured current week, otherwise use average
      return avg === 0 ? currentLeague.currentWeek : avg;
  }, [liveTeams, currentLeague.currentWeek]);

  const handleUpdateScore = (matchId: string, homeScoreStr: string, awayScoreStr: string) => {
    setFixtures(prev => prev.map(match => {
      if (match.id === matchId) {
        const homeScore = homeScoreStr === '' ? null : parseInt(homeScoreStr);
        const awayScore = awayScoreStr === '' ? null : parseInt(awayScoreStr);
        
        return {
          ...match,
          homeScore,
          awayScore,
          isPlayed: homeScore !== null && awayScore !== null
        };
      }
      return match;
    }));
  };

  const handleUpdateMatchTeams = (matchId: string, homeTeamId: number, awayTeamId: number) => {
    setFixtures(prev => prev.map(match => {
      if (match.id === matchId) {
        return {
          ...match,
          homeTeamId,
          awayTeamId
        };
      }
      return match;
    }));
  };

  const handleExport = async (format: 'post' | 'story') => {
    if (isDownloading) return;
    setIsDownloading(true);
    setExportFormat(format);

    // Give React time to render the specific layout (post/story) before capturing
    setTimeout(async () => {
      try {
          const element = document.getElementById('standings-table-capture');
          if (!element) throw new Error("Element not found");

          const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              backgroundColor: null, // Transparent background handled by CSS
              logging: false,
          });

          const dataUrl = canvas.toDataURL('image/png');

          // 1. Try Native Web Share API (Mobile Experience)
          if (navigator.share) {
            try {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], `${currentLeague.id}-puan-durumu.png`, { type: 'image/png' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Puan Durumu',
                        text: `${currentLeague.leagueName} Puan Durumu`,
                    });
                    setIsDownloading(false);
                    setExportFormat(null);
                    return; // Success, exit
                }
            } catch (shareError) {
                console.log("Share API cancelled or failed, falling back to download/preview", shareError);
                // Continue to fallback
            }
          }

          // 2. Fallback: Show Preview Modal (Best for iOS PWA if Share fails)
          // or Desktop Download
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          
          if (isMobile) {
              setPreviewImage(dataUrl);
          } else {
              // Desktop: Direct Download
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = `${currentLeague.id}-puan-durumu-${format}.png`;
              link.click();
          }

      } catch (err) {
          console.error("Görsel oluşturulamadı", err);
          alert("Görsel oluşturulurken bir hata meydana geldi.");
      } finally {
          setIsDownloading(false);
          setExportFormat(null);
      }
    }, 150); // Increased timeout slightly for better rendering
  };

  // Theme constants shortcut
  const theme = currentLeague.theme;

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-100 font-inter overflow-hidden">
      {/* Header - Fixed at top */}
      <header className={`${theme.secondary} text-white shadow-lg z-50 border-b-4 border-white/10 transition-colors duration-500 shrink-0`}>
        <div className="container mx-auto px-4 py-3">
            {/* League Selector */}
            <div className="relative z-50">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="w-full md:w-auto bg-black/20 hover:bg-black/30 border border-white/20 rounded-xl p-2 pr-4 flex items-center gap-3 transition-all active:scale-95 group"
                >
                    {/* Icon Box */}
                    <div className="bg-white p-2.5 rounded-lg shadow-sm shrink-0">
                        <BarChart3 className={`w-6 h-6 ${theme.accent}`} />
                    </div>
                    
                    {/* Text Area */}
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest flex items-center gap-1 group-hover:text-white transition-colors">
                            LİG / TAKIM DEĞİŞTİR 
                            <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </span>
                        <h1 className="text-lg md:text-xl font-black text-white leading-none mt-1 uppercase tracking-tight">
                            {currentLeague.name}
                        </h1>
                    </div>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" onClick={() => setIsMenuOpen(false)}></div>
                        
                        <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
                             <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mevcut Ligler</span>
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">Seçim Yapınız</span>
                             </div>
                             
                             <div className="max-h-[60vh] overflow-y-auto">
                                {Object.values(LEAGUES).map(league => {
                                    const isActive = activeLeagueId === league.id;
                                    return (
                                        <button
                                            key={league.id}
                                            onClick={() => { setActiveLeagueId(league.id); setIsMenuOpen(false); }}
                                            className={`w-full text-left px-4 py-4 text-sm font-bold border-b border-slate-50 flex items-center justify-between transition-colors
                                                ${isActive ? 'bg-blue-50/50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-base font-black uppercase">{league.name}</span>
                                                <span className={`text-xs font-medium mt-0.5 ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                                                    {league.leagueName}
                                                </span>
                                            </div>
                                            {isActive && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                                        </button>
                                    );
                                })}
                             </div>
                        </div>
                    </>
                )}
            </div>

            {/* Settings Button */}
            <div className="relative z-50 ml-auto">
                <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="bg-black/20 hover:bg-black/30 border border-white/20 p-2.5 rounded-xl text-white transition-all active:scale-95"
                >
                    <Settings className="w-6 h-6" />
                </button>
                
                {isSettingsOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                        <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 ring-1 ring-black/5">
                            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ayarlar & Araçlar</span>
                            </div>
                            <button
                                onClick={() => { setShowCombinedExport(true); setIsSettingsOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-3"
                            >
                                <Image className="w-4 h-4 text-purple-600" />
                                1. Amatör (A+B) Ortak Puan
                            </button>
                            <button
                                onClick={() => { setShowLeagueExport('karabuk'); setIsSettingsOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-3"
                            >
                                <Image className="w-4 h-4 text-red-600" />
                                Karabük İdman Yurdu Puan Durumu
                            </button>
                            <button
                                onClick={() => { setShowLeagueExport('eflani'); setIsSettingsOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-3"
                            >
                                <Image className="w-4 h-4 text-green-600" />
                                Tavuk Evi Eflani Spor Puan Durumu
                            </button>
                            {hasTFFSync(activeLeagueId) && (
                              <button
                                onClick={() => { handleTFFSync(); setIsSettingsOpen(false); }}
                                disabled={isTFFSyncing}
                                className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-3 disabled:opacity-60"
                              >
                                <RefreshCw className={`w-4 h-4 text-green-600 ${isTFFSyncing ? 'animate-spin' : ''}`} />
                                <div className="flex flex-col">
                                  <span>TFF'den Otomatik Güncelle</span>
                                  {tffLastSync && (
                                    <span className="text-xs text-green-600 font-medium">Son sync: {tffLastSync}</span>
                                  )}
                                  {tffSyncError && (
                                    <span className="text-xs text-red-500 font-medium">Hata: {tffSyncError}</span>
                                  )}
                                  {tffStandings && (
                                    <span className="text-xs text-blue-500 font-medium">✓ TFF verisi aktif</span>
                                  )}
                                </div>
                              </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
      </header>

      {/* Main Content Area - Flexible height */}
      <main className="flex-1 flex flex-col overflow-hidden relative">

        {/* Mobile Tab Navigation - Fixed under header on mobile */}
        <div className="lg:hidden shrink-0 z-30 bg-slate-100 px-2 pt-2 pb-2">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <button 
                    onClick={() => setActiveTab('standings')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'standings' 
                        ? `${theme.primary} text-white shadow-md` 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Trophy className="w-4 h-4" />
                    Puan Durumu
                </button>
                <button 
                    onClick={() => setActiveTab('fixtures')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'fixtures' 
                        ? `${theme.primary} text-white shadow-md` 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                    Fikstür & Skor
                </button>
            </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-hidden container mx-auto lg:px-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-full">
            
            {/* Left Column: Fixtures */}
            <div className={`lg:col-span-5 flex flex-col gap-4 h-full overflow-y-auto pb-20 lg:pb-0 px-2 lg:px-0 pt-2 lg:pt-8 ${activeTab === 'fixtures' ? 'block' : 'hidden lg:block'}`}>
                {/* Info Box */}
                <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                    <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <span className={`w-1.5 h-6 rounded-full ${theme.primary}`}></span>
                        Fikstür & Skor
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">Skorları girin, tablo güncellensin.</p>
                    </div>
                </div>
                
                {/* Fixture List - Scrollable */}
                <FixtureList 
                    matches={fixtures} 
                    teams={currentLeague.teams} 
                    onUpdateScore={handleUpdateScore}
                    onUpdateMatchTeams={handleUpdateMatchTeams}
                    onSave={handleSaveFixtures}
                    theme={theme}
                    targetTeamName={currentLeague.targetTeamName}
                />
            </div>

            {/* Right Column: Standings */}
            <div className={`lg:col-span-7 h-full overflow-y-auto pb-20 lg:pb-0 px-2 lg:px-0 pt-2 lg:pt-8 ${activeTab === 'standings' ? 'block' : 'hidden lg:block'}`}>
                {/* Action Buttons */}
                <div className="flex items-center justify-end mb-4 gap-2 shrink-0">
                    {/* TFF Sync Quick Button */}
                    {hasTFFSync(activeLeagueId) && (
                      <button
                        onClick={handleTFFSync}
                        disabled={isTFFSyncing}
                        title="TFF'den canlı güncelle"
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all border ${
                          tffStandings
                            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isTFFSyncing ? 'opacity-60' : ''}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTFFSyncing ? 'animate-spin' : ''}`} />
                        <span>{tffStandings ? '✓ TFF Aktif' : 'TFF Güncelle'}</span>
                      </button>
                    )}
                    <button 
                    onClick={() => handleExport('post')}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r ${theme.gradient} text-white rounded-lg shadow-lg transition-all transform hover:scale-105 font-bold text-xs sm:text-sm`}
                    >
                        {isDownloading && exportFormat === 'post' ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Image className="w-4 h-4" />
                        )}
                        <span>Gönderi (4:5)</span>
                    </button>

                    <button 
                    onClick={() => handleExport('story')}
                    disabled={isDownloading}
                    className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r ${theme.gradient} text-white rounded-lg shadow-lg transition-all transform hover:scale-105 font-bold text-xs sm:text-sm opacity-90`}
                    >
                        {isDownloading && exportFormat === 'story' ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Smartphone className="w-4 h-4" />
                        )}
                        <span>Hikaye (9:16)</span>
                    </button>
                </div>

                <StandingsTable 
                    teams={liveTeams} 
                    exportFormat={exportFormat} 
                    currentWeek={dynamicWeek}
                    leagueName={currentLeague.leagueName}
                    shortName={currentLeague.shortName}
                    instagram={currentLeague.instagram}
                    targetTeamName={currentLeague.targetTeamName}
                    theme={theme}
                />
                
                <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm shrink-0 mb-8">
                    <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-full shrink-0 shadow-sm">
                        <ArrowDown className={`w-5 h-5 ${theme.iconColor}`} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">Otomatik Hesaplama</h4>
                        <p className="text-sm text-slate-600 mt-1">
                        Fikstür sekmesinden maç sonuçlarını girdiğinizde, puan durumu anlık olarak averaj ve puan kurallarına göre yeniden hesaplanır.
                        </p>
                    </div>
                    </div>
                </div>
            </div>

            </div>
        </div>
      </main>

      {/* Combined Export Modal */}
      {showCombinedExport && (
        <CombinedStandingsExport onClose={() => setShowCombinedExport(false)} />
      )}

      {/* Karabük / Eflani Puan Durumu Export Modal */}
      {showLeagueExport && (
        <LeagueStandingsExport
          leagueId={showLeagueExport}
          onClose={() => setShowLeagueExport(null)}
        />
      )}

      {/* Image Preview Modal (Fallback for Mobile if Share fails) */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative">
                {/* Modal Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Görsel Hazır</h3>
                    <button 
                        onClick={() => setPreviewImage(null)}
                        className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                
                {/* Image Area */}
                <div className="p-6 flex flex-col items-center bg-slate-100">
                    <img src={previewImage} alt="Generated Standings" className="w-full h-auto rounded shadow-lg border border-white/20" />
                    <p className="mt-4 text-xs text-center text-slate-500 font-medium">
                        Görseli kaydetmek veya paylaşmak için üzerine <span className="text-slate-800 font-bold">basılı tutun</span>.
                    </p>
                </div>

                {/* Modal Actions */}
                <div className="p-4 border-t border-slate-100 flex gap-3">
                     <button 
                        onClick={() => {
                             // Try share again manually
                             fetch(previewImage)
                                .then(res => res.blob())
                                .then(blob => {
                                    const file = new File([blob], "puan-durumu.png", { type: "image/png" });
                                    if(navigator.share) navigator.share({ files: [file] });
                                })
                                .catch(() => alert("Paylaşım desteklenmiyor, lütfen resme basılı tutup kaydedin."));
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white shadow-lg ${theme.primary}`}
                    >
                        <Share className="w-4 h-4" />
                        Paylaş
                    </button>
                    <button 
                        onClick={() => setPreviewImage(null)}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { LEAGUES } from './constants';
import { calculateLiveStandings } from './utils';
import { Match, Team } from './types';
import StandingsTable from './components/StandingsTable';
import FixtureList from './components/FixtureList';
import { BarChart3, ArrowDown, Image, Calendar, Trophy, ChevronDown, CheckCircle2, X, Share, RefreshCw } from 'lucide-react';
import CombinedStandingsExport from './components/CombinedStandingsExport';
import LeagueStandingsExport from './components/LeagueStandingsExport';
import { fetchTFFData, mapTFFStandingsToTeams, mapTFFFixturesToMatches, hasTFFSync } from './services/tffService';
import { fetchAmatorData, mapAmatorStandingsToTeams, mapAmatorFixturesToMatches, hasAmatorSync } from './services/amatorService';

const App: React.FC = () => {
  // State for active league
  const [activeLeagueId, setActiveLeagueId] = useState<string>('karabuk');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCombinedExport, setShowCombinedExport] = useState(false);
  const [showLeagueExport, setShowLeagueExport] = useState<'karabuk' | 'eflani' | null>(null);

  // TFF Sync state
  const [tffStandings, setTffStandings] = useState<Team[] | null>(null);
  const [manualWeek, setManualWeek] = useState<number | null>(null);
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
  const [previewFormat, setPreviewFormat] = useState<'post' | 'story' | null>(null);

  // Auto-save refs
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Load fixtures from local storage or constants when league changes
  // Constants değiştiğinde localStorage'ı sıfırla — versiyon kontrolü ile
  useEffect(() => {
    const league = LEAGUES[activeLeagueId];
    // Constants'ın parmak izi: toplam maç sayısı + ilk/son maç ID'si
    const constantsFingerprint = `${league.fixtures.length}_${league.fixtures[0]?.id ?? ''}_${league.fixtures[league.fixtures.length - 1]?.id ?? ''}`;
    const fingerprintKey = `fixtures_fingerprint_${activeLeagueId}`;
    const savedFingerprint = localStorage.getItem(fingerprintKey);

    // Tam tur-rövanş için teorik maksimum: n*(n-1)
    const fullSeasonMax = league.teams.length * (league.teams.length - 1);
    const maxExpected = Math.max(league.fixtures.length * 3, fullSeasonMax + 10);
    const savedFixtures = localStorage.getItem(`fixtures_${activeLeagueId}`);

    // Constants değiştiyse localStorage'ı tamamen sıfırla
    if (savedFingerprint !== constantsFingerprint) {
      console.log(`[App] Constants güncellenmiş (${savedFingerprint} → ${constantsFingerprint}), localStorage sıfırlanıyor.`);
      localStorage.removeItem(`fixtures_${activeLeagueId}`);
      localStorage.removeItem(`tff_last_auto_${activeLeagueId}`);
      localStorage.setItem(fingerprintKey, constantsFingerprint);
      setFixtures([...league.fixtures]);
      return;
    }

    if (savedFixtures) {
      try {
        const parsed: Match[] = JSON.parse(savedFixtures);
        if (parsed.length > maxExpected) {
          console.warn(`[TFF] Bozuk fixtures (${parsed.length} > ${maxExpected}), temizleniyor.`);
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

  // ─── Skor değiştiğinde otomatik kaydet (800ms debounce) ─────────────────────
  useEffect(() => {
    // İlk yüklemede kaydetme (localStorage'dan okunan veriyi tekrar yazmaya gerek yok)
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(fixtures));
      } catch (_) { /* sessizce geç */ }
    }, 800);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [fixtures, activeLeagueId]);

  // TFF / ASKF senkronizasyon handler (manuel tam güncelleme)
  const handleTFFSync = useCallback(async () => {
    if (isTFFSyncing) return;
    setIsTFFSyncing(true);
    setTffSyncError(null);

    try {
      if (hasTFFSync(activeLeagueId)) {
        // TFF ligleri (karabuk, eflani)
        const data = await fetchTFFData(activeLeagueId);
        if (!data || !data.success) {
          throw new Error(data?.error || 'TFF verisi alınamadı');
        }

        const mappedStandings = mapTFFStandingsToTeams(data.standings, currentLeague.teams, activeLeagueId);
        setTffStandings(mappedStandings);

        const baseFixtures: Match[] = [...currentLeague.fixtures];
        const updatedFixtures = mapTFFFixturesToMatches(data.fixtures, currentLeague.teams, baseFixtures, activeLeagueId);
        setFixtures(updatedFixtures);
        localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
        localStorage.setItem(`tff_last_auto_${activeLeagueId}`, String(Date.now()));
      } else if (hasAmatorSync(activeLeagueId)) {
        // ASKF Amatör ligler
        const data = await fetchAmatorData();
        if (!data || !data.success) {
          throw new Error(data?.error || 'ASKF verisi alınamadı');
        }

        const groupData = activeLeagueId === 'amator_a' ? data.groups.amator_a : data.groups.amator_b;

        if (groupData.standings.length > 0) {
          const mappedStandings = mapAmatorStandingsToTeams(groupData.standings, currentLeague.teams);
          setTffStandings(mappedStandings);
        }

        if (groupData.fixtures.length > 0) {
          const baseFixtures: Match[] = [...currentLeague.fixtures];
          const updatedFixtures = mapAmatorFixturesToMatches(groupData.fixtures, currentLeague.teams, baseFixtures);
          setFixtures(updatedFixtures);
          localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
        }
        localStorage.setItem(`tff_last_auto_${activeLeagueId}`, String(Date.now()));
      }

      const syncTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setTffLastSync(syncTime);
    } catch (err: unknown) {
      let message = 'Bilinmeyen hata';
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch')) {
          message = 'Sunucuya bağlanılamadı — internet bağlantınızı kontrol edin';
        } else if (err.message.includes('AbortError') || err.message.includes('zaman aşımı')) {
          message = 'Bağlantı zaman aşımına uğradı — tekrar deneyin';
        } else {
          message = err.message;
        }
      }
      setTffSyncError(message);
      console.error('Sync hatası:', err);
    } finally {
      setIsTFFSyncing(false);
    }
  }, [activeLeagueId, isTFFSyncing, currentLeague.teams, currentLeague.fixtures]);

  // Lig değişince TFF state'i sıfırla
  useEffect(() => {
    setTffStandings(null);
    setManualWeek(null);
    setTffLastSync(null);
    setTffSyncError(null);
    initialLoadDoneRef.current = false;
  }, [activeLeagueId]);

  // TFF/ASKF destekli ligde otomatik çek (lig açılınca)
  useEffect(() => {
    const isTFF = hasTFFSync(activeLeagueId);
    const isAmator = hasAmatorSync(activeLeagueId);
    if (!isTFF && !isAmator) return;

    let cancelled = false;
    (async () => {
      try {
        if (isTFF) {
          const { fetchTFFData, mapTFFStandingsToTeams: mapStandings, mapTFFFixturesToMatches: mapFixtures } = await import('./services/tffService');
          if (cancelled) return;
          const data = await fetchTFFData(activeLeagueId);
          if (cancelled || !data?.success) return;

          const mappedStandings = mapStandings(data.standings, currentLeague.teams, activeLeagueId);
          setTffStandings(mappedStandings);

          const baseFixtures: Match[] = [...currentLeague.fixtures];
          const updatedFixtures = mapFixtures(data.fixtures, currentLeague.teams, baseFixtures, activeLeagueId);
          setFixtures(updatedFixtures);
          localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
        } else if (isAmator) {
          const { fetchAmatorData, mapAmatorStandingsToTeams: mapStandings, mapAmatorFixturesToMatches: mapFixtures } = await import('./services/amatorService');
          if (cancelled) return;
          const data = await fetchAmatorData();
          if (cancelled || !data?.success) return;

          const groupData = activeLeagueId === 'amator_a' ? data.groups.amator_a : data.groups.amator_b;

          if (groupData.standings.length > 0) {
            const mappedStandings = mapStandings(groupData.standings, currentLeague.teams);
            setTffStandings(mappedStandings);
          }

          if (groupData.fixtures.length > 0) {
            const baseFixtures: Match[] = [...currentLeague.fixtures];
            const updatedFixtures = mapFixtures(groupData.fixtures, currentLeague.teams, baseFixtures);
            setFixtures(updatedFixtures);
            localStorage.setItem(`fixtures_${activeLeagueId}`, JSON.stringify(updatedFixtures));
          }
        }

        const syncTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        setTffLastSync(syncTime);
      } catch (_) { /* otomatik çekme hatası sessizce geç */ }
    })();
    return () => { cancelled = true; };
  }, [activeLeagueId, currentLeague.teams, currentLeague.fixtures]);

  // Her 5 dakikada bir TFF/ASKF verisini otomatik kontrol et
  useEffect(() => {
    const isTFF = hasTFFSync(activeLeagueId);
    const isAmator = hasAmatorSync(activeLeagueId);
    if (!isTFF && !isAmator) return;

    const POLL_INTERVAL = 5 * 60 * 1000; // 5 dakika
    const intervalId = setInterval(() => {
      handleTFFSync();
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [activeLeagueId, handleTFFSync]);

  // Recalculate standings
  // TFF sync olan liglerde (karabük, eflani): TFF verisi gelince onu kullan
  // TFF yok / sync başarısız: fixtures üzerinden sıfırdan hesapla
  const liveTeams = useMemo(() => {
    if (tffStandings && tffStandings.length > 0) return tffStandings;
    return calculateLiveStandings(currentLeague.teams, fixtures);
  }, [fixtures, currentLeague.teams, tffStandings]);

  // Calculate dynamic week based on average matches played
  const dynamicWeek = useMemo(() => {
      if (manualWeek !== null) return manualWeek;
      if (liveTeams.length === 0) return currentLeague.currentWeek;
      
      const totalPlayed = liveTeams.reduce((acc, team) => acc + team.played, 0);
      const avg = Math.round(totalPlayed / liveTeams.length);
      
      // If no matches played (avg 0), fallback to configured current week, otherwise use average
      return avg === 0 ? currentLeague.currentWeek : avg;
  }, [liveTeams, currentLeague.currentWeek, manualWeek]);

  const handleUpdateScore = (matchId: string, homeScoreStr: string, awayScoreStr: string) => {
    // Manuel skor girişinde TFF standings'i temizle, 
    // böylece calculateLiveStandings fixtures üzerinden yeniden hesaplar
    if (tffStandings) setTffStandings(null);
    
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
    if (tffStandings) setTffStandings(null);
    
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

    setTimeout(async () => {
      try {
          const element = document.getElementById('standings-table-capture');
          if (!element) throw new Error("Element not found");

          const canvas = await html2canvas(element, {
              scale: 2,
              useCORS: true,
              backgroundColor: null,
              logging: false,
          });

          const dataUrl = canvas.toDataURL('image/png');

          // Her platformda önizleme modal'ı göster
          setPreviewImage(dataUrl);
          setPreviewFormat(format);

      } catch (err) {
          console.error("Görsel oluşturulamadı", err);
          alert("Görsel oluşturulurken bir hata meydana geldi.");
      } finally {
          setIsDownloading(false);
          setExportFormat(null);
      }
    }, 150);
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
                {/* Action bar: Güncelle + Puan Durumu Görseli butonları */}
                <div className="flex items-center justify-end mb-4 gap-2 shrink-0 flex-wrap">
                    {/* Puan Durumu Görsel Export butonu — lige göre */}
                    {activeLeagueId === 'karabuk' && (
                      <button
                        onClick={() => setShowLeagueExport('karabuk')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Image className="w-4 h-4 text-red-600" />
                        <span className="font-black text-xs tracking-wide">Puan Durumu Görseli</span>
                      </button>
                    )}
                    {activeLeagueId === 'eflani' && (
                      <button
                        onClick={() => setShowLeagueExport('eflani')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Image className="w-4 h-4 text-green-600" />
                        <span className="font-black text-xs tracking-wide">Puan Durumu Görseli</span>
                      </button>
                    )}
                    {(activeLeagueId === 'amator_a' || activeLeagueId === 'amator_b') && (
                      <button
                        onClick={() => setShowCombinedExport(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Image className="w-4 h-4 text-purple-600" />
                        <span className="font-black text-xs tracking-wide">A+B Ortak Görsel</span>
                      </button>
                    )}

                    {/* TFF / ASKF Güncelle butonu */}
                    {(hasTFFSync(activeLeagueId) || hasAmatorSync(activeLeagueId)) && (
                      <button
                        onClick={handleTFFSync}
                        disabled={isTFFSyncing}
                        title={hasAmatorSync(activeLeagueId) ? 'ASKF\'den canlı güncelle' : 'TFF\'den canlı güncelle'}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border shadow-sm ${
                          tffStandings
                            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        } ${isTFFSyncing ? 'opacity-60' : ''}`}
                      >
                        <RefreshCw className={`w-4 h-4 ${isTFFSyncing ? 'animate-spin' : ''}`} />
                        <div className="flex flex-col items-start leading-tight">
                          <span className="font-black text-xs tracking-wide">
                            {isTFFSyncing ? 'Güncelleniyor…' : tffStandings ? `✓ ${hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} Aktif` : `${hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} Güncelle`}
                          </span>
                          {tffLastSync && !isTFFSyncing && (
                            <span className="text-[10px] font-medium opacity-70">
                              Son: {tffLastSync}
                            </span>
                          )}
                          {tffSyncError && !isTFFSyncing && (
                            <span 
                              className="text-[10px] font-medium text-red-500 cursor-pointer hover:underline"
                              onClick={(e) => { e.stopPropagation(); setTffSyncError(null); handleTFFSync(); }}
                              title="Tekrar denemek için tıklayın"
                            >
                              ⚠ {tffSyncError.length > 40 ? tffSyncError.slice(0, 40) + '…' : tffSyncError} (↻)
                            </span>
                          )}
                        </div>
                      </button>
                    )}
                </div>

                <StandingsTable 
                    teams={liveTeams} 
                    exportFormat={exportFormat} 
                    currentWeek={dynamicWeek}
                    onWeekChange={setManualWeek}
                    leagueName={currentLeague.leagueName}
                    shortName={currentLeague.shortName}
                    instagram={currentLeague.instagram}
                    targetTeamName={currentLeague.targetTeamName}
                    theme={theme}
                />
                
                <div className="mt-4 bg-slate-50 border border-slate-200 p-4 rounded-lg shadow-sm shrink-0 mb-8">
                    <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-full shrink-0 shadow-sm">
                        <RefreshCw className={`w-5 h-5 ${theme.iconColor}`} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} Otomatik Güncelleme
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                          {(hasTFFSync(activeLeagueId) || hasAmatorSync(activeLeagueId))
                            ? tffStandings
                              ? `${hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} verisi aktif — ${tffLastSync ? `Son güncelleme: ${tffLastSync}` : 'sayfa açılışında çekildi'}. Yeni hafta oynandıktan sonra "${hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} Güncelle" butonuna basarak puan durumu ve fikstürü otomatik olarak güncelleyebilirsiniz.`
                              : `${hasAmatorSync(activeLeagueId) ? 'ASKF' : 'TFF'} Güncelle butonuna basarak resmi verileri otomatik çekin. Puan durumu ve fikstür aynı anda güncellenir.`
                            : 'Fikstür sekmesinden maç sonuçlarını girdiğinizde puan durumu anlık olarak yeniden hesaplanır.'
                          }
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

      {/* ─── Görsel Önizleme Modal ─── */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center animate-in fade-in duration-200"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setPreviewImage(null); setPreviewFormat(null); } }}
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
            
            {/* Drag Handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-green-500 animate-pulse`} />
                <span className="font-bold text-slate-800 text-sm">
                  Görsel Hazır — {previewFormat === 'story' ? '9:16 Hikaye' : '4:5 Gönderi'}
                </span>
              </div>
              <button 
                onClick={() => { setPreviewImage(null); setPreviewFormat(null); }}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="bg-slate-900 flex items-center justify-center p-4 relative" style={{ maxHeight: '50vh', overflow: 'hidden' }}>
              <img 
                src={previewImage} 
                alt="Puan Durumu Görseli" 
                className="max-h-[46vh] w-auto object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
                style={{ maxWidth: '100%' }}
              />
              {/* Mobile long-press hint */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center sm:hidden">
                <span className="bg-black/60 text-white text-[10px] px-3 py-1 rounded-full font-medium backdrop-blur-sm">
                  Görsele basılı tutarak kaydedin
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 space-y-3">
              {/* Primary: Share */}
              <button
                onClick={async () => {
                  try {
                    const blob = await (await fetch(previewImage)).blob();
                    const filename = `${currentLeague.id}-puan-durumu-${previewFormat}.png`;
                    const file = new File([blob], filename, { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        files: [file],
                        title: `${currentLeague.leagueName} Puan Durumu`,
                        text: `${currentLeague.leagueName} — ${dynamicWeek}. Hafta Puan Durumu`,
                      });
                    } else {
                      alert('Paylaşım bu cihazda desteklenmiyor. Görseli indirip paylaşabilirsiniz.');
                    }
                  } catch (e) {
                    if ((e as Error).name !== 'AbortError') {
                      alert('Paylaşım iptal edildi veya hata oluştu.');
                    }
                  }
                }}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-white text-sm shadow-lg transition-all active:scale-95 bg-gradient-to-r ${theme.gradient}`}
              >
                <Share className="w-4 h-4" />
                Paylaş
              </button>

              {/* Secondary row: Download + Copy */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewImage;
                    link.download = `${currentLeague.id}-puan-durumu-${previewFormat}.png`;
                    link.click();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-700 text-sm bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                >
                  <ArrowDown className="w-4 h-4" />
                  İndir
                </button>
                <button
                  onClick={() => {
                    (async () => {
                      try {
                        const blob = await (await fetch(previewImage)).blob();
                        await navigator.clipboard.write([
                          new ClipboardItem({ 'image/png': blob })
                        ]);
                        alert('Görsel panoya kopyalandı!');
                      } catch {
                        alert('Panoya kopyalama bu tarayıcıda desteklenmiyor.');
                      }
                    })();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-700 text-sm bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                >
                  <Image className="w-4 h-4" />
                  Kopyala
                </button>
                <button
                  onClick={() => { setPreviewImage(null); setPreviewFormat(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-500 text-sm bg-slate-50 hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                >
                  <X className="w-4 h-4" />
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
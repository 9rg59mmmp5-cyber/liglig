import React from 'react';
import { Team, ThemeConfig } from '../types';
import { ShieldAlert, Trophy, Instagram } from 'lucide-react';

interface StandingsTableProps {
  teams: Team[];
  exportFormat?: 'post' | 'story' | null;
  currentWeek?: number;
  leagueName: string;
  shortName: string;
  instagram: string;
  targetTeamName: string;
  theme: ThemeConfig;
}

const StandingsTable: React.FC<StandingsTableProps> = ({ 
    teams, 
    exportFormat = null, 
    currentWeek, 
    leagueName,
    shortName,
    instagram,
    targetTeamName,
    theme
}) => {
  const isExporting = exportFormat !== null;

  const containerStyle = isExporting ? {
    width: '1080px',
    height: exportFormat === 'story' ? '1920px' : '1350px',
    padding: '20px',
    paddingTop: '30px',
    background: theme.exportGradient,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: exportFormat === 'story' ? 'center' : 'flex-start'
  } : {};

  return (
    <div 
      id="standings-table-capture" 
      className={`bg-white overflow-hidden relative ${isExporting ? 'shadow-none' : 'shadow-xl rounded-lg border border-slate-200'}`}
      style={isExporting ? containerStyle : {}}
    >
      {/* Watermarks - Only visible during export or subtle in app */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex flex-col items-center justify-center opacity-10">
         <span className="text-[80px] font-black text-slate-400 -rotate-12 whitespace-nowrap uppercase">SPORKARABUK</span>
         <span className="text-[80px] font-black text-slate-400 -rotate-12 whitespace-nowrap mt-32 uppercase">SPORKARABUK</span>
      </div>

      {/* Main Content Container */}
      <div className={`relative z-10 ${isExporting ? 'bg-white/95 rounded-2xl overflow-hidden shadow-2xl' : ''}`}>
        
        {/* Header */}
        <div className="text-white p-0 relative overflow-hidden" style={{ backgroundColor: theme.standingsHeaderBg }}>
            {/* Top Info Bar */}
            <div className="flex justify-between items-center px-4 py-2 bg-black/20 text-xs md:text-sm font-medium opacity-90">
                <span>{leagueName}</span>
                <span>{currentWeek}. HAFTA</span>
            </div>

            {/* Main Title Area */}
            <div className="py-4 w-full flex flex-col items-center justify-center relative">
                 {/* Decorative Logos for Export */}
                {isExporting && (
                    <>
                         <div className="absolute top-1/2 -translate-y-1/2 right-8 opacity-90">
                            <Trophy className="w-16 h-16 text-yellow-400 drop-shadow-lg" />
                        </div>
                    </>
                )}

                <h1 className={`font-black uppercase tracking-tighter leading-none text-center w-full ${isExporting ? 'text-6xl drop-shadow-2xl' : 'text-4xl'}`}>
                PUAN DURUMU
                </h1>
                
                {!isExporting && (
                    <div className="mt-2 text-white/60 text-xs font-bold tracking-widest uppercase">
                    Canlı Puan Durumu Simülasyonu
                    </div>
                )}
            </div>
        </div>
        
        <div className="overflow-x-auto bg-white relative">
            {/* Center Table Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span className={`font-black text-black/5 -rotate-12 select-none ${isExporting ? 'text-4xl' : 'text-2xl'}`}>
                    sporkarabuk_
                </span>
            </div>

            <table className="w-full text-left border-collapse relative z-10">
            <thead className={`text-white uppercase text-[10px] sm:text-xs md:text-sm leading-normal ${isExporting ? '' : 'sticky top-0 z-20 shadow-md'}`} style={{ backgroundColor: theme.standingsHeaderBg }}>
                <tr>
                    <th className={`py-2 text-center font-bold border-r border-white/20 bg-black/20 ${isExporting ? 'w-24 text-xl' : 'w-8 px-1'}`}>S</th>
                    <th className={`py-2 font-bold border-r border-white/20 px-2 ${isExporting ? 'text-xl' : ''}`}>Takım</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>O</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>G</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>B</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>M</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>A</th>
                    <th className={`py-2 text-center w-8 border-r border-white/20 ${isExporting ? 'text-xl w-16' : 'px-1'}`}>Y</th>
                    <th className={`py-2 text-center w-10 font-bold border-r border-white/20 ${isExporting ? 'text-xl w-20' : 'px-1'}`}>AV</th>
                    <th className={`py-2 text-center w-10 font-black bg-[#fbbf24] text-black/80 ${isExporting ? 'text-2xl w-20' : 'px-2 text-sm'}`}>P</th>
                </tr>
            </thead>
            <tbody className="text-gray-700 text-sm font-medium">
                {teams.map((team, index) => {
                const isTargetTeam = targetTeamName ? team.name.includes(targetTeamName) : false;
                const isFirst = index === 0;
                
                // Dynamic colors for alternating rows
                let rowBg = index % 2 === 0 ? theme.standingsRowBg : "bg-white"; 
                let textColor = "text-slate-800";
                
                // Rank Box Color
                let rankBoxColor = "bg-slate-500"; 
                
                if (leagueName.includes("3. LİG")) {
                    // TFF 3. Lig Rules
                    if (index === 0) {
                        rankBoxColor = "bg-green-600"; // Champion
                    } else if (index >= 1 && index <= 5) {
                        rankBoxColor = "bg-blue-600"; // Play-off
                    } else if (index >= teams.length - 3) {
                        rankBoxColor = "bg-red-600"; // Relegation
                    }
                } else if (leagueName.includes("BÖLGESEL AMATÖR")) {
                    // BAL Rules
                    if (index === 0) {
                        rankBoxColor = "bg-green-600"; // Champion
                    } else if (index >= teams.length - 2) {
                        rankBoxColor = "bg-red-600"; // Relegation
                    }
                } else if (leagueName.includes("AMATÖR")) {
                    // Karabük Amateur League Rules
                    if (index === 0) {
                        rankBoxColor = "bg-green-600"; // Champion/Play-off
                    } else if (index === teams.length - 1) {
                        rankBoxColor = "bg-red-600"; // Relegation
                    }
                } 

                // Special Override for Target Team
                if (isTargetTeam) {
                    rowBg = "bg-[#ca8a04] text-white"; // Gold/Dark Yellow background
                    textColor = "text-white";
                    rankBoxColor = `bg-white/20 border border-white`;
                }

                // Increase font size for export
                const cellPadding = isExporting ? 'py-1' : 'py-1.5';
                const fontSize = isExporting ? 'text-base' : 'text-[11px] sm:text-xs md:text-sm';
                
                // Rank Number Styling
                const rankSize = isExporting 
                    ? 'w-8 h-8 text-lg font-black' 
                    : 'w-6 h-6 text-[10px] md:text-xs';

                return (
                    <tr key={team.id} className={`${rowBg} border-b border-slate-100`}>
                    <td className={`${cellPadding} text-center align-middle`}>
                        <div className={`${rankSize} flex items-center justify-center rounded-md mx-auto text-white shadow-sm ${rankBoxColor}`}>
                        {index + 1}
                        </div>
                    </td>
                    <td className={`${cellPadding} px-2 font-bold ${textColor} ${isExporting ? 'text-lg tracking-tight' : ''} flex items-center gap-1`}>
                        <span className={`${isExporting ? '' : 'text-[9px] sm:text-xs md:text-sm'} leading-tight`}>{team.name}</span>
                        {isTargetTeam && !isExporting && <ShieldAlert className="w-3 h-3 ml-0.5 shrink-0" />}
                    </td>
                    <td className={`${cellPadding} text-center font-bold ${textColor} ${fontSize}`}>{team.played}</td>
                    <td className={`${cellPadding} text-center ${textColor} ${fontSize}`}>{team.won}</td>
                    <td className={`${cellPadding} text-center ${textColor} ${fontSize}`}>{team.drawn}</td>
                    <td className={`${cellPadding} text-center ${textColor} ${fontSize}`}>{team.lost}</td>
                    <td className={`${cellPadding} text-center ${textColor} ${fontSize}`}>{team.gf}</td>
                    <td className={`${cellPadding} text-center ${textColor} ${fontSize}`}>{team.ga}</td>
                    <td className={`${cellPadding} text-center font-black ${textColor} ${fontSize}`}>
                        {team.gd > 0 ? `+${team.gd}` : team.gd}
                    </td>
                    <td className={`${cellPadding} text-center font-black ${isTargetTeam ? 'bg-white text-[#ca8a04]' : 'bg-[#fbbf24] text-[#14532d]'} ${isExporting ? 'text-3xl' : 'text-sm md:text-lg'}`}>
                        {team.pts}
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>
        
        {/* Footer */}
        {isExporting && (
            <div className="text-white p-4 flex justify-between items-center border-t border-white/20" style={{ backgroundColor: theme.standingsHeaderBg }}>
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-lg">
                        <span className="font-black text-xl tracking-widest uppercase flex items-center gap-2">
                           <Instagram className="w-6 h-6" /> sporkarabuk_
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-light opacity-80">Hazırlayan</p>
                    <p className="font-bold text-lg">sporkarabuk_</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StandingsTable;

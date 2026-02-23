import React, { useState } from 'react';
import { Match, Team, ThemeConfig } from '../types';
import { getTeamName } from '../utils';
import { Calendar, Edit, Check } from 'lucide-react';

interface FixtureListProps {
  matches: Match[];
  teams: Team[];
  onUpdateScore: (matchId: string, homeScore: string, awayScore: string) => void;
  onUpdateMatchTeams: (matchId: string, homeTeamId: number, awayTeamId: number) => void;
  onSave: () => void;
  theme: ThemeConfig;
  targetTeamName: string;
}

const FixtureList: React.FC<FixtureListProps> = ({ 
  matches, 
  teams, 
  onUpdateScore, 
  onUpdateMatchTeams,
  onSave,
  theme, 
  targetTeamName 
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Group matches by week
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.week]) acc[match.week] = [];
    acc[match.week].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  const weeks = Object.keys(groupedMatches).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-end gap-2 sticky top-0 z-20 bg-slate-100/95 backdrop-blur-sm py-2 border-b border-slate-200 -mx-2 px-2 lg:mx-0 lg:px-0">
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all"
        >
          <Check className="w-4 h-4" />
          KAYDET
        </button>

        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            isEditing 
              ? 'bg-green-600 text-white shadow-md' 
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          {isEditing ? (
            <>
              <Check className="w-4 h-4" />
              DÜZENLEMEYİ BİTİR
            </>
          ) : (
            <>
              <Edit className="w-4 h-4" />
              FİKSTÜRÜ DÜZENLE
            </>
          )}
        </button>
      </div>

      {weeks.map(week => (
        <div key={week} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden ring-1 ring-slate-100">
          <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white border-b border-slate-800 sticky top-0 z-10 shadow-md">
            <h3 className="font-bold flex items-center gap-2 text-base md:text-lg">
              <Calendar className={`w-5 h-5 ${theme.iconColor}`} />
              {week}. HAFTA
            </h3>
            <span className={`text-[10px] md:text-xs px-2 py-1 rounded font-bold tracking-wider text-white ${theme.primary}`}>
              {isEditing ? 'DÜZENLEME MODU' : 'MAÇ SKORLARI'}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {groupedMatches[week].map(match => {
              const homeName = getTeamName(teams, match.homeTeamId);
              const awayName = getTeamName(teams, match.awayTeamId);
              const isTargetMatch = homeName.includes(targetTeamName) || awayName.includes(targetTeamName);

              return (
                <div 
                  key={match.id} 
                  className={`p-3 md:p-4 transition-all duration-200 ${
                    isTargetMatch ? 'bg-slate-50 border-l-4' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
                  style={isTargetMatch ? { borderLeftColor: theme.standingsHeaderBg } : {}}
                >
                  <div className="flex flex-col gap-2">
                    {/* Teams and Inputs Row */}
                    <div className="flex items-center justify-between gap-1 md:gap-4">
                      {/* Home Team */}
                      <div className={`flex-1 text-right font-semibold text-xs md:text-sm leading-tight ${homeName.includes(targetTeamName) ? `${theme.accent} font-bold` : "text-slate-700"}`}>
                         {isEditing ? (
                           <select 
                             className="w-full text-xs p-1 border rounded bg-slate-50 text-slate-800"
                             value={match.homeTeamId}
                             onChange={(e) => onUpdateMatchTeams(match.id, parseInt(e.target.value), match.awayTeamId)}
                           >
                             {teams.map(t => (
                               <option key={t.id} value={t.id}>{t.name}</option>
                             ))}
                           </select>
                         ) : (
                           homeName
                         )}
                      </div>

                      {/* Score Inputs */}
                      <div className="flex items-center gap-1 shrink-0 px-1">
                        <input
                          type="number"
                          min="0"
                          className={`w-12 h-10 md:w-14 md:h-11 text-center font-bold text-xl rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none transition-all shadow-sm
                            ${match.homeScore !== null 
                              ? 'bg-slate-800 text-white border-none' 
                              : 'bg-white border-2 border-slate-200 text-slate-900'}`}
                          value={match.homeScore === null ? '' : match.homeScore}
                          onChange={(e) => onUpdateScore(match.id, e.target.value, match.awayScore?.toString() || '')}
                          placeholder="-"
                        />
                        <span className="text-slate-300 font-bold text-lg px-0.5">:</span>
                        <input
                          type="number"
                          min="0"
                          className={`w-12 h-10 md:w-14 md:h-11 text-center font-bold text-xl rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none transition-all shadow-sm
                            ${match.awayScore !== null 
                              ? 'bg-slate-800 text-white border-none' 
                              : 'bg-white border-2 border-slate-200 text-slate-900'}`}
                          value={match.awayScore === null ? '' : match.awayScore}
                          onChange={(e) => onUpdateScore(match.id, match.homeScore?.toString() || '', e.target.value)}
                          placeholder="-"
                        />
                      </div>

                      {/* Away Team */}
                      <div className={`flex-1 text-left font-semibold text-xs md:text-sm leading-tight ${awayName.includes(targetTeamName) ? `${theme.accent} font-bold` : "text-slate-700"}`}>
                        {isEditing ? (
                           <select 
                             className="w-full text-xs p-1 border rounded bg-slate-50 text-slate-800"
                             value={match.awayTeamId}
                             onChange={(e) => onUpdateMatchTeams(match.id, match.homeTeamId, parseInt(e.target.value))}
                           >
                             {teams.map(t => (
                               <option key={t.id} value={t.id}>{t.name}</option>
                             ))}
                           </select>
                         ) : (
                           awayName
                         )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FixtureList;
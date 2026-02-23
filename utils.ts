import { Team, Match } from './types';

export const calculateLiveStandings = (initialTeams: Team[], matches: Match[]): Team[] => {
  // Deep copy initial teams to avoid mutating constants
  const liveTeams = initialTeams.map(t => ({ ...t }));

  matches.forEach(match => {
    if (match.isPlayed && match.homeScore !== null && match.awayScore !== null) {
      const homeTeam = liveTeams.find(t => t.id === match.homeTeamId);
      const awayTeam = liveTeams.find(t => t.id === match.awayTeamId);

      if (homeTeam && awayTeam) {
        // Update Played
        homeTeam.played += 1;
        awayTeam.played += 1;

        // Update Goals
        homeTeam.gf += match.homeScore;
        homeTeam.ga += match.awayScore;
        homeTeam.gd = homeTeam.gf - homeTeam.ga;

        awayTeam.gf += match.awayScore;
        awayTeam.ga += match.homeScore;
        awayTeam.gd = awayTeam.gf - awayTeam.ga;

        // Update Points
        if (match.homeScore > match.awayScore) {
          homeTeam.won += 1;
          homeTeam.pts += 3;
          awayTeam.lost += 1;
          homeTeam.form = [...homeTeam.form.slice(-4), 'W'];
          awayTeam.form = [...awayTeam.form.slice(-4), 'L'];
        } else if (match.homeScore < match.awayScore) {
          awayTeam.won += 1;
          awayTeam.pts += 3;
          homeTeam.lost += 1;
          awayTeam.form = [...awayTeam.form.slice(-4), 'W'];
          homeTeam.form = [...homeTeam.form.slice(-4), 'L'];
        } else {
          homeTeam.drawn += 1;
          homeTeam.pts += 1;
          awayTeam.drawn += 1;
          awayTeam.pts += 1;
          homeTeam.form = [...homeTeam.form.slice(-4), 'D'];
          awayTeam.form = [...awayTeam.form.slice(-4), 'D'];
        }
      }
    }
  });

  // Sort: Points DESC, then Goal Diff DESC, then Goals For DESC
  return liveTeams.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
};

export const getTeamName = (teams: Team[], id: number) => {
  return teams.find(t => t.id === id)?.name || 'Bilinmeyen Takım';
};

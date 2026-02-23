export interface Team {
  id: number;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number; // Goals For
  ga: number; // Goals Against
  gd: number; // Goal Difference
  pts: number; // Points
  form: string[]; // Recent form (W, D, L) - optional
}

export interface Match {
  id: string;
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  isPlayed: boolean;
}

export interface ThemeConfig {
  primary: string; // e.g. 'bg-red-700'
  secondary: string; // e.g. 'bg-blue-900'
  accent: string; // e.g. 'text-red-700'
  gradient: string; // e.g. 'from-red-600 to-blue-800'
  standingsHeaderBg: string; // Hex code for html2canvas
  standingsRowBg: string; // Hex code for alternate rows
  exportGradient: string; // CSS Gradient string
  iconColor: string;
}

export interface LeagueData {
  id: string;
  name: string;
  leagueName: string;
  shortName: string;
  currentWeek: number;
  targetTeamName: string; // Name to highlight
  instagram: string;
  teams: Team[];
  fixtures: Match[];
  theme: ThemeConfig;
}

export interface LeagueState {
  teams: Team[];
  matches: Match[];
}
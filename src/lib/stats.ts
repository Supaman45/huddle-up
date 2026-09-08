import type { Sport } from '@/lib/types';

export interface StatDef {
  key: string;
  label: string; // what the scorekeeper taps
  short: string; // column header on a player card
  points: number; // added to the team score
  scoring?: boolean;
}

// Deliberately small. One thumb, standing up, watching the field.
export const STATS: Record<Sport, StatDef[]> = {
  soccer: [
    { key: 'goal', label: 'Goal', short: 'G', points: 1, scoring: true },
    { key: 'assist', label: 'Assist', short: 'A', points: 0 },
    { key: 'shot', label: 'Shot', short: 'SH', points: 0 },
    { key: 'save', label: 'Save', short: 'SV', points: 0 },
  ],
  basketball: [
    { key: 'fg2', label: '2 pt', short: '2P', points: 2, scoring: true },
    { key: 'fg3', label: '3 pt', short: '3P', points: 3, scoring: true },
    { key: 'ft', label: 'Free throw', short: 'FT', points: 1, scoring: true },
    { key: 'rebound', label: 'Rebound', short: 'REB', points: 0 },
    { key: 'assist', label: 'Assist', short: 'AST', points: 0 },
    { key: 'steal', label: 'Steal', short: 'STL', points: 0 },
  ],
  other: [
    { key: 'score', label: 'Score', short: 'PTS', points: 1, scoring: true },
    { key: 'assist', label: 'Assist', short: 'A', points: 0 },
  ],
};

export function statDef(sport: Sport, key: string): StatDef | undefined {
  return STATS[sport]?.find((s) => s.key === key);
}

export function periodLabel(sport: Sport, period: number): string {
  if (sport === 'soccer') return period === 1 ? '1st half' : period === 2 ? '2nd half' : `OT ${period - 2}`;
  if (sport === 'basketball') return period <= 4 ? `Q${period}` : `OT ${period - 4}`;
  return `Period ${period}`;
}

export function maxPeriods(sport: Sport): number {
  return sport === 'soccer' ? 2 : sport === 'basketball' ? 4 : 4;
}

// The headline line on a player card, per sport.
export function summaryLine(sport: Sport, totals: Record<string, number>): string {
  if (sport === 'basketball') {
    const pts = (totals.fg2 ?? 0) * 2 + (totals.fg3 ?? 0) * 3 + (totals.ft ?? 0);
    return `${pts} pts · ${totals.rebound ?? 0} reb · ${totals.assist ?? 0} ast`;
  }
  if (sport === 'soccer') {
    return `${totals.goal ?? 0} goals · ${totals.assist ?? 0} assists · ${totals.save ?? 0} saves`;
  }
  return `${totals.score ?? 0} scored`;
}

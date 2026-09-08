import { describe, expect, it } from 'vitest';

import { STATS, maxPeriods, periodLabel, statDef, summaryLine } from '@/lib/stats';

describe('summaryLine', () => {
  it('computes basketball points from the shot types, not a stored total', () => {
    expect(summaryLine('basketball', { fg2: 4, fg3: 2, ft: 3, rebound: 5, assist: 1 })).toBe('17 pts · 5 reb · 1 ast');
  });

  it('reads zero for a kid who has played but not scored', () => {
    expect(summaryLine('soccer', {})).toBe('0 goals · 0 assists · 0 saves');
  });

  it('uses each sport its own vocabulary', () => {
    expect(summaryLine('soccer', { goal: 2, assist: 1, save: 0 })).toBe('2 goals · 1 assists · 0 saves');
    expect(summaryLine('other', { score: 7 })).toBe('7 scored');
  });
});

describe('statDef', () => {
  it('finds a stat by key within its sport', () => {
    expect(statDef('soccer', 'goal')?.short).toBe('G');
    expect(statDef('basketball', 'fg3')?.points).toBe(3);
  });

  it('returns nothing for a stat that does not belong to the sport', () => {
    expect(statDef('soccer', 'fg3')).toBeUndefined();
  });
});

describe('periods', () => {
  it('names periods the way the sport does', () => {
    expect(periodLabel('soccer', 1)).toBe('1st half');
    expect(periodLabel('soccer', 3)).toBe('OT 1');
    expect(periodLabel('basketball', 4)).toBe('Q4');
    expect(periodLabel('basketball', 5)).toBe('OT 1');
  });

  it('agrees with the period count for each sport', () => {
    expect(maxPeriods('soccer')).toBe(2);
    expect(maxPeriods('basketball')).toBe(4);
  });
});

describe('the stat catalog', () => {
  it('gives every sport at least one scoring stat, or no game can be scored', () => {
    for (const [sport, defs] of Object.entries(STATS)) {
      expect(
        defs.some((d) => d.scoring),
        `${sport} has no scoring stat`,
      ).toBe(true);
    }
  });

  it('uses unique keys within a sport, since tallies are grouped by key', () => {
    for (const [sport, defs] of Object.entries(STATS)) {
      expect(new Set(defs.map((d) => d.key)).size, `${sport} has duplicate keys`).toBe(defs.length);
    }
  });
});

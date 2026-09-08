import { describe, expect, it } from 'vitest';

import { defaultMinutes, findDuplicate, parseSchedule } from '@/lib/schedule-parse';

// Fixed so year inference is deterministic and these tests still pass next December.
const TODAY = new Date(2026, 8, 8); // 8 Sep 2026

function parse(text: string) {
  return parseSchedule(text, { today: TODAY });
}

describe('the shapes a league actually sends', () => {
  it('reads the common one-line-per-game format', () => {
    const { rows, skipped } = parse(`
9/13  9:00 AM  vs Red Robin  Fort Steilacoom #4
9/20  10:30 AM  vs Puyallup Blue  Sparks Stadium
    `);
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ month: 9, day: 13, hour: 9, minute: 0, type: 'game', location: 'Fort Steilacoom #4' });
    expect(rows[0].title).toContain('Red Robin');
    expect(rows[1]).toMatchObject({ month: 9, day: 20, hour: 10, minute: 30 });
  });

  it('reads a copied spreadsheet, tabs and header row included', () => {
    const { rows, skipped } = parse(
      ['Date\tTime\tOpponent\tLocation', '9/13/2026\t9:00 AM\tRed Robin\tFort Steilacoom #4', '9/20/2026\t10:30 AM\tPuyallup Blue\tSparks Stadium'].join('\n'),
    );
    expect(skipped).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].year).toBe(2026);
    expect(rows[0].confidence).toBe('high');
    expect(rows[0].location).toBe('Fort Steilacoom #4');
  });

  it('reads written-out dates in either order', () => {
    const { rows } = parse(['September 13 - 9:00am - Practice - Harry Todd Park', '20 Sep 2026, 10:30 AM, vs Puyallup Blue'].join('\n'));
    expect(rows[0]).toMatchObject({ month: 9, day: 13, hour: 9, type: 'practice' });
    expect(rows[1]).toMatchObject({ month: 9, day: 20, year: 2026, hour: 10, minute: 30 });
  });

  it('reads 24-hour times', () => {
    const { rows } = parse('9/13 14:30 vs Red Robin');
    expect(rows[0]).toMatchObject({ hour: 14, minute: 30 });
  });

  it('handles noon and midnight without flipping them', () => {
    const { rows } = parse(['9/13 12:00 PM vs Noon FC', '9/14 12:00 AM vs Midnight FC'].join('\n'));
    expect(rows[0].hour).toBe(12);
    expect(rows[1].hour).toBe(0);
  });
});

describe('what it refuses to guess at', () => {
  it('skips a line with no date rather than inventing one', () => {
    const { rows, skipped } = parse('vs Red Robin at Fort Steilacoom');
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/date/i);
  });

  it('skips a line with a date but no time', () => {
    const { rows, skipped } = parse('9/13 vs Red Robin');
    expect(rows).toHaveLength(0);
    expect(skipped[0].reason).toMatch(/time/i);
  });

  it('reports the line number so a coach can find it in their paste', () => {
    const { skipped } = parse(['9/13 9:00 AM vs Red Robin', 'TBD opponent, time to follow'].join('\n'));
    expect(skipped[0].line).toBe(2);
  });

  it('rejects an impossible date instead of creating a game in month 45', () => {
    const { rows, skipped } = parse('45/99 9:00 AM vs Nowhere');
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(1);
  });

  it('ignores headers, rules and page furniture', () => {
    const { rows, skipped } = parse(['FALL 2026 SCHEDULE', '------------------', 'Date  Time  Opponent', 'Page 1 of 3', '', '9/13 9:00 AM vs Red Robin'].join('\n'));
    expect(rows).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });
});

describe('the year, which schedules usually omit', () => {
  it('marks an inferred year as low confidence and says so', () => {
    const { rows } = parse('9/13 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2026);
    expect(rows[0].confidence).toBe('low');
    expect(rows[0].note).toMatch(/2026/);
  });

  it('reads January as next season, not eleven months ago', () => {
    // Pasted in September: a 1/10 game is the coming January.
    const { rows } = parse('1/10 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2027);
  });

  it('keeps a recent past date in this year rather than jumping forward', () => {
    // Late August, three weeks ago, is a real row in a season already underway.
    const { rows } = parse('8/22 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2026);
  });

  it('trusts an explicit year over any inference', () => {
    // 10 Jan 2026 really is a Saturday, so the line agrees with itself.
    const { rows } = parse('Sat 1/10/2026 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2026);
    expect(rows[0].confidence).toBe('high');
  });

  it('lets a named weekday pin the year, which is as good as the text stating it', () => {
    // 12 Sep is a Saturday in 2026. No year in the text, but only one candidate fits.
    const { rows } = parse('Sat 9/12 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2026);
    expect(rows[0].confidence).toBe('high');
    expect(rows[0].note).toBeUndefined();
  });

  it('flags a line whose weekday disagrees with its own date', () => {
    // A league email that says Sat but gives a Sunday date is wrong somewhere, and a coach
    // should be told which, not have one side silently chosen.
    const { rows } = parse('Sat 9/13/2026 9:00 AM vs Red Robin');
    expect(rows[0].confidence).toBe('low');
    expect(rows[0].note).toMatch(/Saturday/);
    expect(rows[0].note).toMatch(/Sunday/);
  });

  it('still produces the event when the weekday disagrees, rather than dropping it', () => {
    const { rows } = parse('Sat 9/13/2026 9:00 AM vs Red Robin');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ year: 2026, month: 9, day: 13, hour: 9 });
  });

  it('expands a two-digit year', () => {
    const { rows } = parse('9/13/27 9:00 AM vs Red Robin');
    expect(rows[0].year).toBe(2027);
  });
});

describe('reading what kind of event it is', () => {
  it('calls a practice a practice', () => {
    expect(parse('9/13 5:30 PM Practice at Harry Todd Park').rows[0].type).toBe('practice');
  });
  it('calls a tournament a tournament', () => {
    expect(parse('9/13 8:00 AM Puyallup Fall Classic').rows[0].type).toBe('tournament');
  });
  it('calls a versus line a game', () => {
    expect(parse('9/13 9:00 AM vs Red Robin').rows[0].type).toBe('game');
  });
  it('gives each type a sensible length', () => {
    expect(defaultMinutes('game')).toBe(90);
    expect(defaultMinutes('tournament')).toBe(240);
    expect(defaultMinutes('practice')).toBe(60);
  });
});

describe('titles and locations', () => {
  it('splits on an explicit at, keeping the opponent out of the location', () => {
    const { rows } = parse('9/13 9:00 AM vs Red Robin @ Fort Steilacoom #4');
    expect(rows[0].title).toBe('vs Red Robin');
    expect(rows[0].location).toBe('Fort Steilacoom #4');
  });

  it('does not mistake an away game marker for a location', () => {
    const { rows } = parse('9/13 9:00 AM at Red Robin');
    expect(rows[0].location).toBeNull();
    expect(rows[0].title).toMatch(/Red Robin/);
  });

  it('strips the weekday so it does not end up in the title', () => {
    const { rows } = parse('Saturday 9/13 9:00 AM vs Red Robin');
    expect(rows[0].title).not.toMatch(/saturday/i);
  });

  it('falls back to a usable name and flags it when there is nothing to read', () => {
    const { rows } = parse('9/13 9:00 AM');
    expect(rows[0].title).toBe('Game');
    expect(rows[0].confidence).toBe('low');
    expect(rows[0].note).toMatch(/opponent/i);
  });
});

describe('findDuplicate', () => {
  const existing = [
    { starts_at: '2026-09-13T16:00:00.000Z', title: 'Game vs Red Robin' },
    { starts_at: '2026-09-20T17:30:00.000Z', title: 'Game vs Puyallup Blue' },
  ];

  it('catches the same slot pasted twice, even if the league renamed the opponent', () => {
    const hit = findDuplicate(new Date('2026-09-13T16:00:00.000Z'), existing);
    expect(hit?.title).toBe('Game vs Red Robin');
  });

  it('tolerates a minute of drift between sources', () => {
    expect(findDuplicate(new Date('2026-09-13T16:00:30.000Z'), existing)).toBeTruthy();
  });

  it('does not call a different kickoff a duplicate', () => {
    expect(findDuplicate(new Date('2026-09-13T18:00:00.000Z'), existing)).toBeUndefined();
  });

  it('finds nothing in an empty schedule', () => {
    expect(findDuplicate(new Date(), [])).toBeUndefined();
  });
});

describe('a whole realistic paste', () => {
  it('gets every row out of a league email', () => {
    const email = `
Tacoma Sharks U10 — Fall 2026 Schedule

DATE        TIME       OPPONENT            LOCATION
Sat 9/12    9:00 AM    vs Red Robin        Fort Steilacoom #4
Sat 9/19    10:30 AM   at Puyallup Blue    Sparks Stadium
Sat 9/26    9:00 AM    vs Lakewood United  Fort Steilacoom #2
Wed 9/30    5:30 PM    Practice            Harry Todd Park
Sat 10/10   8:00 AM    Puyallup Fall Classic

Questions? Reply to this email.
    `;
    const { rows, skipped } = parse(email);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.type)).toEqual(['game', 'game', 'game', 'practice', 'tournament']);
    expect(rows.every((r) => r.year === 2026)).toBe(true);
    // Every weekday in this email agrees with its date, so nothing needs a second look.
    expect(rows.every((r) => r.confidence === 'high')).toBe(true);
    // "Questions? Reply to this email." has no date, so it is reported rather than dropped.
    expect(skipped.map((s) => s.raw)).toContain('Questions? Reply to this email.');
  });
});

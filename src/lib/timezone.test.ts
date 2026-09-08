import { describe, expect, it } from 'vitest';

import { supportsNamedZones, zonedTimeToUtc } from '@/lib/timezone';

describe('zonedTimeToUtc', () => {
  it('resolves a Pacific summer morning to the right instant', () => {
    // 9am PDT on 13 Sep 2026 is 16:00 UTC.
    expect(zonedTimeToUtc(2026, 9, 13, 9, 0, 'America/Los_Angeles').toISOString()).toBe('2026-09-13T16:00:00.000Z');
  });

  it('resolves a Pacific winter morning an hour differently', () => {
    // 9am PST on 13 Jan 2026 is 17:00 UTC. Same wall clock, different instant.
    expect(zonedTimeToUtc(2026, 1, 13, 9, 0, 'America/Los_Angeles').toISOString()).toBe('2026-01-13T17:00:00.000Z');
  });

  it('does not depend on the machine running it', () => {
    // The whole point: a coach in another zone pasting a Tacoma schedule gets Tacoma times.
    expect(zonedTimeToUtc(2026, 9, 13, 9, 0, 'America/New_York').toISOString()).toBe('2026-09-13T13:00:00.000Z');
    expect(zonedTimeToUtc(2026, 9, 13, 9, 0, 'UTC').toISOString()).toBe('2026-09-13T09:00:00.000Z');
  });

  it('handles the evening before a date line correctly', () => {
    // 8pm Pacific is the following day in UTC. An off-by-one here moves a game a day.
    expect(zonedTimeToUtc(2026, 9, 13, 20, 0, 'America/Los_Angeles').toISOString()).toBe('2026-09-14T03:00:00.000Z');
  });

  it('resolves the hour after spring-forward, which does exist', () => {
    // DST starts 8 Mar 2026 at 2am Pacific. 3am is real and is 10:00 UTC.
    expect(zonedTimeToUtc(2026, 3, 8, 3, 0, 'America/Los_Angeles').toISOString()).toBe('2026-03-08T10:00:00.000Z');
  });

  it('resolves the hour that does not exist forward rather than throwing', () => {
    // 2:30am on 8 Mar 2026 Pacific never happens. A schedule should still import.
    const d = zonedTimeToUtc(2026, 3, 8, 2, 30, 'America/Los_Angeles');
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.toISOString()).toBe('2026-03-08T10:30:00.000Z');
  });

  it('picks one side of the repeated autumn hour rather than failing', () => {
    // DST ends 1 Nov 2026. 1:30am happens twice; either is defensible, neither may crash.
    const d = zonedTimeToUtc(2026, 11, 1, 1, 30, 'America/Los_Angeles');
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(['2026-11-01T08:30:00.000Z', '2026-11-01T09:30:00.000Z']).toContain(d.toISOString());
  });

  it('reports whether this runtime really understands named zones', () => {
    expect(supportsNamedZones()).toBe(true);
  });
});

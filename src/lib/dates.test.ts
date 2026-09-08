import { describe, expect, it } from 'vitest';

import { dayLabel, groupByDay, rangeLabel, timeLabel } from '@/lib/dates';

describe('timeLabel', () => {
  it('drops the minutes on the hour, because 9 AM reads faster than 9:00 AM', () => {
    expect(timeLabel(new Date('2026-09-13T09:00:00'))).toBe('9 AM');
    expect(timeLabel(new Date('2026-09-13T09:30:00'))).toBe('9:30 AM');
  });
});

describe('rangeLabel', () => {
  it('shows a single time when there is no end', () => {
    expect(rangeLabel(new Date('2026-09-13T09:00:00'), null)).toBe('9 AM');
  });
  it('joins start and end in words a parent would say', () => {
    expect(rangeLabel(new Date('2026-09-13T09:00:00'), new Date('2026-09-13T10:30:00'))).toBe('9 AM to 10:30 AM');
  });
});

describe('dayLabel', () => {
  it('prefers Today and Tomorrow to a date', () => {
    expect(dayLabel(new Date())).toBe('Today');
    expect(dayLabel(new Date(Date.now() + 24 * 3600_000))).toBe('Tomorrow');
  });
});

describe('groupByDay', () => {
  it('keeps consecutive items from the same day in one group', () => {
    const items = [{ at: new Date('2026-09-13T09:00:00') }, { at: new Date('2026-09-13T15:00:00') }, { at: new Date('2026-09-14T09:00:00') }];
    const groups = groupByDay(items, (i) => i.at);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
  });

  it('starts a new group when the day changes and back again', () => {
    // Input is assumed sorted; unsorted input should not silently merge distant days.
    const items = [{ at: new Date('2026-09-13T09:00:00') }, { at: new Date('2026-09-14T09:00:00') }, { at: new Date('2026-09-13T18:00:00') }];
    expect(groupByDay(items, (i) => i.at)).toHaveLength(3);
  });

  it('returns nothing for an empty list', () => {
    expect(groupByDay([], (d: Date) => d)).toEqual([]);
  });
});

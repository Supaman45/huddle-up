import { describe, expect, it } from 'vitest';

import { headline } from '@/lib/headline';
import type { MyEvent } from '@/lib/types';

const HOUR = 3600_000;

function event(over: Partial<MyEvent> = {}): MyEvent {
  return {
    event_id: 'e1',
    team_id: 't1',
    team_name: 'Sharks',
    team_color: '#F5B849',
    sport: 'soccer',
    title: 'Practice',
    type: 'practice',
    starts_at: new Date(Date.now() + 48 * HOUR).toISOString(),
    ends_at: null,
    location_name: null,
    location_address: null,
    cancelled: false,
    athlete_ids: ['a1'],
    offers: 0,
    open_requests: 0,
    open_slots: 0,
    my_ride_status: null,
    going: 0,
    out_count: 0,
    unanswered: 0,
    my_rsvps: {},
    ride_driver: null,
    ride_driver_phone: null,
    ride_note: null,
    seats_open: 0,
    my_seats_open: null,
    my_riders: null,
    ...over,
  } as MyEvent;
}

describe('headline', () => {
  it('says the calendar is quiet when nothing is coming', () => {
    expect(headline([]).big).toBe('Quiet week.');
  });

  it('ignores a cancelled event rather than counting it as next up', () => {
    const only = event({ cancelled: true });
    expect(headline([only]).big).toBe('Quiet week.');
  });

  it('leads with the next game even when a practice comes first', () => {
    const practice = event({ type: 'practice', starts_at: new Date(Date.now() + 2 * HOUR).toISOString() });
    const game = event({ event_id: 'e2', type: 'game', starts_at: new Date(Date.now() + 26 * HOUR).toISOString() });
    expect(headline([practice, game]).big.startsWith('Game day')).toBe(true);
  });

  it('says today and tomorrow rather than a weekday name', () => {
    const today = event({ type: 'game', starts_at: new Date(Date.now() + 2 * HOUR).toISOString() });
    expect(headline([today]).big).toContain('today.');
    const tomorrow = event({ type: 'game', starts_at: new Date(Date.now() + 26 * HOUR).toISOString() });
    expect(headline([tomorrow]).big).toContain('tomorrow.');
  });

  it('counts rides and unanswered RSVPs in the sub-line', () => {
    const needsRide = event({ my_ride_status: 'needs_ride' });
    const unanswered = event({ event_id: 'e2', athlete_ids: ['a1', 'a2'], my_rsvps: { a1: 'going' } });
    const sub = headline([needsRide, unanswered]).sub;
    expect(sub).toContain('1 still needs a ride');
    expect(sub).toContain('RSVP');
  });

  it('does not count a ride or an RSVP that is already settled', () => {
    const settled = event({ my_ride_status: 'matched', my_rsvps: { a1: 'going' } });
    expect(headline([settled]).sub).toBe('1 event coming up.');
  });
});

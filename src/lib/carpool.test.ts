import { describe, expect, it } from 'vitest';

import { rideLine, rideState } from '@/lib/carpool';
import type { MyEvent } from '@/lib/types';

function event(over: Partial<MyEvent> = {}): MyEvent {
  return {
    event_id: 'e1',
    team_id: 't1',
    team_name: 'Sharks',
    team_color: '#F5B849',
    sport: 'soccer',
    title: 'Game vs Red Robin',
    type: 'game',
    starts_at: '2026-09-13T16:00:00Z',
    ends_at: null,
    location_name: 'Field 4',
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

describe('rideState', () => {
  it('puts driving ahead of every other state', () => {
    // A parent can be driving AND have asked for a ride for a second kid. The car wins,
    // because that is the commitment other families are counting on.
    const ev = event({ my_ride_status: 'driving', my_seats_open: 2, open_requests: 3 });
    expect(rideState(ev)).toBe('driving_open');
  });

  it('separates a full car from one with seats', () => {
    expect(rideState(event({ my_ride_status: 'driving', my_seats_open: 0 }))).toBe('driving_full');
    expect(rideState(event({ my_ride_status: 'driving', my_seats_open: 1 }))).toBe('driving_open');
  });

  it('treats a null seat count as full rather than inviting more riders', () => {
    expect(rideState(event({ my_ride_status: 'driving', my_seats_open: null }))).toBe('driving_full');
  });

  it('is waiting when my own kid has an open request', () => {
    expect(rideState(event({ my_ride_status: 'needs_ride', open_requests: 1 }))).toBe('waiting');
  });

  it('offers help only when someone else is waiting and I am not', () => {
    expect(rideState(event({ open_requests: 2 }))).toBe('can_help');
    expect(rideState(event({ open_requests: 0, offers: 1 }))).toBe('quiet');
  });
});

describe('rideLine', () => {
  it('names the driver once a ride is matched, because a name is the whole point', () => {
    const ev = event({ my_ride_status: 'matched', ride_driver: 'Ryan' });
    expect(rideLine(ev, rideState(ev))).toBe('Riding with Ryan');
  });

  it('falls back gracefully when the driver has no name on file', () => {
    const ev = event({ my_ride_status: 'matched', ride_driver: null });
    expect(rideLine(ev, rideState(ev))).toBe('Ride set');
  });

  it('tells a waiting parent whether any seats exist at all', () => {
    const none = event({ my_ride_status: 'needs_ride', seats_open: 0 });
    expect(rideLine(none, rideState(none))).toBe('Waiting on a driver');
    const some = event({ my_ride_status: 'needs_ride', seats_open: 3 });
    expect(rideLine(some, rideState(some))).toBe('Waiting on a driver · 3 seats open');
  });

  it('counts kids, not requests, in singular and plural', () => {
    const one = event({ open_requests: 1 });
    expect(rideLine(one, rideState(one))).toBe('1 kid needs a ride');
    const two = event({ open_requests: 2 });
    expect(rideLine(two, rideState(two))).toBe('2 kids need a ride');
  });

  it('says how many seats are left in my own car', () => {
    const ev = event({ my_ride_status: 'driving', my_seats_open: 1 });
    expect(rideLine(ev, rideState(ev))).toBe("You're driving · 1 seat left");
  });
});

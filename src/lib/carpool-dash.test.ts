import { describe, expect, it } from 'vitest';

import {
  askableAthleteIds,
  badgeCount,
  contactLinks,
  driverMessage,
  eventState,
  kidName,
  filterCounts,
  filterHeadline,
  matchesFilter,
  seatsLeft,
  seatsOpen,
  stateLine,
  summarize,
} from '@/lib/carpool-dash';
import type { CarpoolAsk, CarpoolCar, CarpoolEvent } from '@/lib/types';

function ask(over: Partial<CarpoolAsk> = {}): CarpoolAsk {
  return {
    id: 'r1',
    athlete_id: 'a1',
    first_name: 'Tyrone',
    last_initial: 'W',
    color: '#fff',
    photo_url: null,
    status: 'open',
    offer_id: null,
    requested_by: 'p2',
    requester_name: 'Zaki Waller',
    requester_phone: '253-555-0100',
    mine: false,
    created_at: '2026-09-08T00:00:00Z',
    ...over,
  };
}

function car(over: Partial<CarpoolCar> = {}): CarpoolCar {
  return {
    id: 'o1',
    driver_id: 'p1',
    driver_name: 'Seri Strong',
    driver_phone: '(253) 555-0199',
    driver_email: 'seri@example.com',
    direction: 'both',
    seats: 2,
    taken: 0,
    pickup_note: null,
    mine: false,
    riders: [],
    ...over,
  };
}

function event(over: Partial<CarpoolEvent> = {}): CarpoolEvent {
  return {
    event_id: 'e1',
    title: 'Game vs Red Robin',
    starts_at: '2026-09-12T16:00:00Z',
    location_name: 'Fort Steilacoom #4',
    event_type: 'game',
    team_id: 't1',
    team_name: 'Tacoma Sharks',
    team_color: '#8CD5A5',
    my_athlete_ids: [],
    requests: [],
    offers: [],
    ...over,
  };
}

describe('eventState, in the order a parent cares', () => {
  it('puts my own waiting kid above everything', () => {
    const ev = event({ requests: [ask({ mine: true }), ask({ id: 'r2' })], offers: [car({ mine: true })] });
    expect(eventState(ev)).toBe('my_kid_waiting');
  });

  it('flags other kids waiting when mine are fine', () => {
    expect(eventState(event({ requests: [ask()] }))).toBe('kids_waiting');
  });

  it('knows when I am the driver and nobody is waiting', () => {
    expect(eventState(event({ offers: [car({ mine: true })] }))).toBe('im_driving');
  });

  it('calls a matched ride settled', () => {
    const ev = event({ requests: [ask({ status: 'matched', offer_id: 'o1', mine: true })], offers: [car({ taken: 1 })] });
    expect(eventState(ev)).toBe('settled');
  });

  it('is quiet when nothing has happened', () => {
    expect(eventState(event())).toBe('quiet');
  });
});

describe('stateLine', () => {
  it('names my kid and counts the seats that could take them', () => {
    const ev = event({ requests: [ask({ mine: true })], offers: [car({ seats: 3, taken: 1 })] });
    expect(stateLine(ev, 'my_kid_waiting')).toBe('Tyrone still needs a ride · 2 seats open');
  });

  it('does not promise seats that are not there', () => {
    const ev = event({ requests: [ask({ mine: true })] });
    expect(stateLine(ev, 'my_kid_waiting')).toBe('Tyrone still needs a ride');
  });

  it('counts the kids other drivers could help', () => {
    const ev = event({ requests: [ask(), ask({ id: 'r2', first_name: 'Maya' })] });
    expect(stateLine(ev, 'kids_waiting')).toBe('2 kids need a ride');
  });

  it('tells a driver what is left in their car', () => {
    expect(stateLine(event({ offers: [car({ mine: true, seats: 3, taken: 1 })] }), 'im_driving')).toBe("You're driving · 2 seats left");
    expect(stateLine(event({ offers: [car({ mine: true, seats: 2, taken: 2 })] }), 'im_driving')).toBe("You're driving · car full");
  });
});

describe('seats', () => {
  it('never reports negative seats when the data disagrees with itself', () => {
    expect(seatsLeft(car({ seats: 1, taken: 3 }))).toBe(0);
  });
  it('sums across cars', () => {
    expect(seatsOpen(event({ offers: [car({ seats: 2, taken: 1 }), car({ id: 'o2', seats: 4, taken: 1 })] }))).toBe(4);
  });
});

describe('summarize and badge', () => {
  const events = [
    event({ requests: [ask({ mine: true }), ask({ id: 'r2' })], offers: [car({ seats: 2, taken: 0 })] }),
    event({ event_id: 'e2', requests: [ask({ id: 'r3', status: 'matched', offer_id: 'o2', mine: true })], offers: [car({ id: 'o2', mine: true, seats: 3, taken: 1 })] }),
  ];

  it('counts what is unresolved across every team', () => {
    expect(summarize(events)).toEqual({ waiting: 2, mineWaiting: 1, seats: 4, driving: 1, riding: 1 });
  });

  it('badges only what this parent alone can fix', () => {
    expect(badgeCount(events)).toBe(1);
  });
});

describe('filters', () => {
  const waiting = event({ requests: [ask()] });
  const quietWithMyKid = event({ event_id: 'e2', my_athlete_ids: ['a9'] });
  const quietNotMine = event({ event_id: 'e3' });
  const myAsk = event({ event_id: 'e4', my_athlete_ids: ['a9'], requests: [ask({ mine: true })] });
  const imDriving = event({ event_id: 'e5', my_athlete_ids: ['a9'], offers: [car({ mine: true })] });

  it('needs shows only events with an open request', () => {
    expect(matchesFilter(waiting, 'needs')).toBe(true);
    expect(matchesFilter(quietWithMyKid, 'needs')).toBe(false);
  });

  it('mine shows rides I am in, by asking or by driving', () => {
    expect(matchesFilter(myAsk, 'mine')).toBe(true);
    expect(matchesFilter(imDriving, 'mine')).toBe(true);
  });

  it('mine excludes an event my kid plays in where no ride involves me', () => {
    // Every event on this tab is already one of my kids' events. Matching on that made Mine a
    // second copy of All, which is exactly what it looked like on a phone.
    expect(matchesFilter(quietWithMyKid, 'mine')).toBe(false);
    expect(matchesFilter(waiting, 'mine')).toBe(false);
    expect(matchesFilter(quietNotMine, 'mine')).toBe(false);
  });

  it('gives each tab its own count so they differ before anyone taps', () => {
    const all = [waiting, quietWithMyKid, myAsk, imDriving];
    expect(filterCounts(all)).toEqual({ all: 4, needs: 2, mine: 2 });
  });

  it('never lets every tab show the same set', () => {
    const all = [waiting, quietWithMyKid, myAsk, imDriving];
    const c = filterCounts(all);
    expect(new Set([c.all, c.needs, c.mine]).size).toBeGreaterThan(1);
  });
});

describe('filterHeadline', () => {
  const sum = { waiting: 3, mineWaiting: 1, seats: 5, driving: 1, riding: 2 };

  it('answers the question the chosen tab is asking', () => {
    expect(filterHeadline('needs', sum)).toBe('3 kids need a ride.');
    expect(filterHeadline('mine', sum)).toBe('One of your kids still needs a ride.');
  });

  it('changes when the tab changes, so the screen does not look frozen', () => {
    const settled = { waiting: 0, mineWaiting: 0, seats: 4, driving: 1, riding: 0 };
    expect(filterHeadline('needs', settled)).toBe('Every kid has a seat.');
    expect(filterHeadline('mine', settled)).toBe("You're driving once.");
    expect(filterHeadline('all', settled)).not.toBe(filterHeadline('needs', settled));
  });
});

describe('askableAthleteIds', () => {
  it('offers a ride request only for my kids not already spoken for', () => {
    const ev = event({ my_athlete_ids: ['a1', 'a2'], requests: [ask({ athlete_id: 'a1', mine: true })] });
    expect(askableAthleteIds(ev)).toEqual(['a2']);
  });
});

describe('names and contact links', () => {
  it('shows kids as first name and last initial only', () => {
    expect(kidName({ first_name: 'Tyrone', last_initial: 'W' })).toBe('Tyrone W.');
    expect(kidName({ first_name: 'Maya', last_initial: null })).toBe('Maya');
  });

  it('strips formatting from a phone number before it goes into a URL', () => {
    const links = contactLinks('(253) 555-0199', null, 'hi', 'android');
    expect(links.tel).toBe('tel:2535550199');
    expect(links.sms).toBe('sms:2535550199?body=hi');
  });

  it('keeps a leading plus for international numbers', () => {
    expect(contactLinks('+1 253 555 0199', null, 'hi', 'ios').tel).toBe('tel:+12535550199');
  });

  it('uses the iOS separator on iOS, because the other one loses the message', () => {
    expect(contactLinks('2535550199', null, 'see you', 'ios').sms).toBe('sms:2535550199&body=see%20you');
  });

  it('returns null links rather than a broken href when a detail is missing', () => {
    const links = contactLinks(null, null, 'hi', 'ios');
    expect(links).toEqual({ tel: null, sms: null, mailto: null });
  });

  it('builds a mailto with the message in the body', () => {
    expect(contactLinks(null, 'seri@example.com', 'hi there', 'web').mailto).toBe('mailto:seri@example.com?subject=Carpool&body=hi%20there');
  });
});

describe('driverMessage', () => {
  it('uses the driver first name and lists the kids naturally', () => {
    expect(driverMessage('Zaki Waller', 'Game vs Red Robin', ['Tyrone W.'])).toBe('Hi Zaki, checking in about Tyrone W. riding to Game vs Red Robin.');
    expect(driverMessage('Zaki Waller', 'Practice', ['Tyrone W.', 'Maya S.', 'Leo P.'])).toMatch(/Tyrone W\., Maya S\. and Leo P\./);
  });

  it('still says something sensible when no kid of mine is in the car', () => {
    expect(driverMessage('Zaki Waller', 'Practice', [])).toBe('Hi Zaki, about the carpool to Practice.');
  });
});

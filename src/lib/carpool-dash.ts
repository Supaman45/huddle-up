import type { CarpoolAsk, CarpoolCar, CarpoolEvent } from '@/lib/types';

/**
 * The carpool dashboard, decided here rather than inside the screen.
 *
 * Two parents look at this tab with opposite jobs. One needs a seat and wants to know whether
 * anyone took their kid, who has them, and how to reach that adult on Saturday morning. The
 * other has seats and wants a target: which kids are still unclaimed and can they pick one up
 * on the way. Everything below answers one of those two questions; anything that answers
 * neither does not belong on the screen.
 *
 * Orange means unresolved and a person has to act. Green means settled. Nothing else earns a
 * colour, so a parent scanning the tab at a stoplight can count the orange and stop reading.
 */

/** Where an event sits, in the order a parent cares about it. */
export type EventState = 'my_kid_waiting' | 'kids_waiting' | 'im_driving' | 'settled' | 'quiet';

export const stateRank: Record<EventState, number> = {
  my_kid_waiting: 0,
  kids_waiting: 1,
  im_driving: 2,
  settled: 3,
  quiet: 4,
};

/** Requests nobody has taken yet. These are the only rows that need a human. */
export function openAsks(ev: CarpoolEvent): CarpoolAsk[] {
  return ev.requests.filter((r) => r.status === 'open');
}

/** Requests already sitting in a car. */
export function matchedAsks(ev: CarpoolEvent): CarpoolAsk[] {
  return ev.requests.filter((r) => r.status === 'matched');
}

/** Seats left in one car. Never negative, even if the data disagrees with itself. */
export function seatsLeft(car: CarpoolCar): number {
  return Math.max(0, car.seats - car.taken);
}

/** Seats left across every car on this event. */
export function seatsOpen(ev: CarpoolEvent): number {
  return ev.offers.reduce((n, c) => n + seatsLeft(c), 0);
}

export function myCars(ev: CarpoolEvent): CarpoolCar[] {
  return ev.offers.filter((c) => c.mine);
}

/**
 * What this event is, for this parent.
 *
 * Ordering matters: a parent's own kid waiting outranks everything, because it is the only
 * row where nobody else can solve it for them. Driving outranks a settled ride because a
 * driver still has a job to do.
 */
export function eventState(ev: CarpoolEvent): EventState {
  const open = openAsks(ev);
  if (open.some((r) => r.mine)) return 'my_kid_waiting';
  if (open.length > 0) return 'kids_waiting';
  if (myCars(ev).length > 0) return 'im_driving';
  if (ev.requests.length > 0 || ev.offers.length > 0) return 'settled';
  return 'quiet';
}

/** The one line that goes on the event's header. Short enough to read while walking. */
export function stateLine(ev: CarpoolEvent, state: EventState): string {
  const open = openAsks(ev);
  const free = seatsOpen(ev);
  switch (state) {
    case 'my_kid_waiting': {
      const names = open.filter((r) => r.mine).map((r) => r.first_name);
      const who = names.length === 1 ? names[0] : `${names.length} of your kids`;
      return free > 0
        ? `${who} still needs a ride · ${free} ${free === 1 ? 'seat' : 'seats'} open`
        : `${who} still needs a ride`;
    }
    case 'kids_waiting':
      return `${open.length} ${open.length === 1 ? 'kid needs' : 'kids need'} a ride`;
    case 'im_driving': {
      const mine = myCars(ev);
      const left = mine.reduce((n, c) => n + seatsLeft(c), 0);
      const riders = mine.reduce((n, c) => n + c.taken, 0);
      if (left > 0) return `You're driving · ${left} ${left === 1 ? 'seat' : 'seats'} left`;
      return riders > 0 ? `You're driving · car full` : `You're driving`;
    }
    case 'settled': {
      const cars = ev.offers.length;
      const riders = matchedAsks(ev).length;
      if (cars === 0) return 'Rides sorted';
      return `${cars} ${cars === 1 ? 'car' : 'cars'} · ${riders} ${riders === 1 ? 'kid' : 'kids'} riding`;
    }
    default:
      return 'No carpools yet';
  }
}

/** The number that belongs on the tab bar: things only this parent can resolve. */
export function badgeCount(events: CarpoolEvent[]): number {
  return events.filter((ev) => eventState(ev) === 'my_kid_waiting').length;
}

export interface DashSummary {
  waiting: number;
  mineWaiting: number;
  seats: number;
  driving: number;
  riding: number;
}

/** The strip at the top: what is unresolved across every team, in one glance. */
export function summarize(events: CarpoolEvent[]): DashSummary {
  let waiting = 0;
  let mineWaiting = 0;
  let seats = 0;
  let driving = 0;
  let riding = 0;
  for (const ev of events) {
    for (const r of ev.requests) {
      if (r.status === 'open') {
        waiting += 1;
        if (r.mine) mineWaiting += 1;
      } else if (r.status === 'matched' && r.mine) {
        riding += 1;
      }
    }
    for (const c of ev.offers) {
      seats += seatsLeft(c);
      if (c.mine) driving += 1;
    }
  }
  return { waiting, mineWaiting, seats, driving, riding };
}

export type DashFilter = 'all' | 'needs' | 'mine';

/** Does this event survive the chosen filter. */
export function matchesFilter(ev: CarpoolEvent, filter: DashFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'needs') return openAsks(ev).length > 0;
  // Mine means a ride this parent is personally in: their kid asked, their kid is in a car, or
  // they are driving. It deliberately does NOT include "my kid plays in this game". Every event
  // on this tab already belongs to one of their teams, so that test matches nearly everything
  // and the tab silently becomes a second copy of All.
  return ev.offers.some((c) => c.mine) || ev.requests.some((r) => r.mine);
}

/**
 * How many events each filter would show. The tabs carry these numbers so a parent sees the
 * difference between them before tapping, rather than tapping three times to find out.
 */
export function filterCounts(events: CarpoolEvent[]): Record<DashFilter, number> {
  return {
    all: events.length,
    needs: events.filter((ev) => matchesFilter(ev, 'needs')).length,
    mine: events.filter((ev) => matchesFilter(ev, 'mine')).length,
  };
}

/** The headline, which answers the question the chosen tab is asking. */
export function filterHeadline(filter: DashFilter, sum: DashSummary): string {
  if (filter === 'needs') {
    if (sum.waiting === 0) return 'Every kid has a seat.';
    return `${sum.waiting} ${sum.waiting === 1 ? 'kid needs' : 'kids need'} a ride.`;
  }
  if (filter === 'mine') {
    if (sum.mineWaiting > 0) {
      return sum.mineWaiting === 1 ? 'One of your kids still needs a ride.' : `${sum.mineWaiting} of your kids still need a ride.`;
    }
    if (sum.driving > 0) return `You're driving ${sum.driving === 1 ? 'once' : `${sum.driving} times`}.`;
    if (sum.riding > 0) return `${sum.riding} of your rides ${sum.riding === 1 ? 'is' : 'are'} set.`;
    return 'You have no rides yet.';
  }
  if (sum.mineWaiting > 0) {
    return sum.mineWaiting === 1 ? 'One of your kids still needs a ride.' : `${sum.mineWaiting} of your kids still need a ride.`;
  }
  if (sum.waiting > 0) return `${sum.waiting} ${sum.waiting === 1 ? 'kid needs' : 'kids need'} a ride this month.`;
  if (sum.driving > 0) return `You're driving ${sum.driving === 1 ? 'once' : `${sum.driving} times`}. Everyone else is set.`;
  return 'Everyone has a ride.';
}

/**
 * My kids on this team who have not asked for a ride and are not already in a car. These are
 * the only kids an "ask for a ride" button can name without being wrong.
 */
export function askableAthleteIds(ev: CarpoolEvent): string[] {
  const spoken = new Set(ev.requests.map((r) => r.athlete_id));
  return ev.my_athlete_ids.filter((id) => !spoken.has(id));
}

/** First name plus last initial, the only way a child's name is ever shown. */
export function kidName(k: { first_name: string; last_initial: string | null }): string {
  return k.last_initial ? `${k.first_name} ${k.last_initial}.` : k.first_name;
}

/**
 * The links behind a driver's contact card.
 *
 * A phone number arrives however a parent typed it, so everything but digits and a leading
 * plus is stripped before it goes into a URL. iOS and Android disagree about the separator
 * before an SMS body, and getting that wrong opens an empty message with the text lost, which
 * is exactly the kind of small break nobody reports. The platform is passed in, not read
 * from react-native, so this stays a plain function the tests can run.
 */
export function contactLinks(
  phone: string | null,
  email: string | null,
  message: string,
  os: string,
): { tel: string | null; sms: string | null; mailto: string | null } {
  const digits = (phone ?? '').replace(/[^\d+]/g, '');
  const body = encodeURIComponent(message);
  return {
    tel: digits ? `tel:${digits}` : null,
    sms: digits ? (os === 'ios' ? `sms:${digits}&body=${body}` : `sms:${digits}?body=${body}`) : null,
    mailto: email ? `mailto:${email}?subject=${encodeURIComponent('Carpool')}&body=${body}` : null,
  };
}

/** What a parent would actually type, pre-filled so they only have to hit send. */
export function driverMessage(driverName: string, eventTitle: string, kidNames: string[]): string {
  const first = driverName.split(' ')[0] || driverName;
  if (kidNames.length === 0) return `Hi ${first}, about the carpool to ${eventTitle}.`;
  const who = kidNames.length === 1 ? kidNames[0] : `${kidNames.slice(0, -1).join(', ')} and ${kidNames[kidNames.length - 1]}`;
  return `Hi ${first}, checking in about ${who} riding to ${eventTitle}.`;
}

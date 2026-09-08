import { format, isToday, isTomorrow, startOfDay } from 'date-fns';

import type { MyEvent } from '@/lib/types';

/**
 * The two lines at the top of Home. The big line names the next thing that matters, the
 * small line counts what is still waiting on this parent. Pure, so it is testable.
 */
export function headline(events: MyEvent[]): { big: string; sub: string } {
  const upcoming = events.filter((e) => !e.cancelled && new Date(e.starts_at) >= startOfDay(new Date()));
  const next = upcoming[0];
  if (!next) return { big: 'Quiet week.', sub: 'Nothing on the calendar coming up.' };
  const rides = upcoming.filter((e) => e.my_ride_status === 'needs_ride').length;
  const unanswered = upcoming.reduce((n, e) => n + e.athlete_ids.filter((id) => !e.my_rsvps?.[id]).length, 0);
  const nextGame = upcoming.find((e) => e.type === 'game');
  const when = (d: Date) => (isToday(d) ? 'today.' : isTomorrow(d) ? 'tomorrow.' : `${format(d, 'EEEE')}.`);
  const big = nextGame ? `Game day\n${when(new Date(nextGame.starts_at))}` : `${next.type === 'practice' ? 'Practice' : 'Next up'}\n${when(new Date(next.starts_at))}`;
  const parts = [`${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'} coming up`];
  if (rides) parts.push(`${rides} still ${rides === 1 ? 'needs' : 'need'} a ride`);
  if (unanswered) parts.push(`${unanswered} RSVP${unanswered === 1 ? '' : 's'} waiting on you`);
  return { big, sub: parts.join('. ') + '.' };
}

import type { MyEvent } from '@/lib/types';

// A carpool has two people with opposite jobs. The parent who needs a ride wants certainty:
// did anyone take it, who, and how do I reach them. The parent with seats wants a target:
// how many kids need a ride and can I grab one on the way. Orange means unresolved and
// someone has to act. Green means settled. Nothing else earns a color.
export type RideState = 'driving_open' | 'driving_full' | 'matched' | 'waiting' | 'can_help' | 'quiet';

export function rideState(ev: MyEvent): RideState {
  if (ev.my_ride_status === 'driving') return (ev.my_seats_open ?? 0) > 0 ? 'driving_open' : 'driving_full';
  if (ev.my_ride_status === 'matched') return 'matched';
  if (ev.my_ride_status === 'needs_ride') return 'waiting';
  if (ev.open_requests > 0) return 'can_help';
  return 'quiet';
}

export function rideLine(ev: MyEvent, state: RideState): string {
  const seats = ev.seats_open;
  switch (state) {
    case 'driving_open':
      return `You're driving · ${ev.my_seats_open} ${ev.my_seats_open === 1 ? 'seat' : 'seats'} left`;
    case 'driving_full':
      return `You're driving · car full`;
    case 'matched':
      return ev.ride_driver ? `Riding with ${ev.ride_driver}` : 'Ride set';
    case 'waiting':
      return seats > 0 ? `Waiting on a driver · ${seats} ${seats === 1 ? 'seat' : 'seats'} open` : 'Waiting on a driver';
    case 'can_help':
      return `${ev.open_requests} ${ev.open_requests === 1 ? 'kid needs' : 'kids need'} a ride`;
    default:
      return ev.offers > 0 ? `${ev.offers} ${ev.offers === 1 ? 'car' : 'cars'} going` : 'No carpools yet';
  }
}

// App-facing types. Everything that mirrors a table or an RPC is DERIVED from the
// generated schema, so a migration that renames a column breaks the build instead of
// producing an undefined at a field on a Saturday morning. Only shapes the database
// does not describe (joined rows, the RSVP map inside my_events) are written by hand.
import type { Enums, FnReturns, Tables } from '@/lib/database.types';

export type Sport = Enums<'sport'>;
export type EventType = Enums<'event_type'>;
export type RideDirection = Enums<'ride_direction'>;
export type MediaConsent = Enums<'media_consent'>;
export type TeamRole = Enums<'team_role'>;
export type HouseholdRole = Enums<'household_role'>;
export type RsvpStatus = Enums<'rsvp_status'>;
export type RequestStatus = Enums<'request_status'>;
export type SlotKind = Enums<'slot_kind'>;
export type GameStatus = Enums<'game_status'>;
export type ActivityKind = Enums<'activity_kind'>;

export type Profile = Tables<'profiles'>;
export type Household = Tables<'households'>;
export type Athlete = Tables<'athletes'>;
export type Team = Tables<'teams'>;
export type Event = Tables<'events'>;
export type Game = Tables<'games'>;
export type AwayRange = Tables<'athlete_away'>;
export type RidePattern = Tables<'ride_patterns'>;
export type TeamPlace = Tables<'team_places'>;
export type Trip = Tables<'trips'>;
export type TripRosterRow = FnReturns<'trip_roster'>;

// Rows that arrive with a joined relation. The join is a PostgREST select string, not
// something the schema types know about, so the extra fields are declared here.
export type TeamMember = Tables<'team_members'> & { profile?: Profile };
export type CarpoolOffer = Tables<'carpool_offers'> & { driver?: Profile };
export type CarpoolRequest = Tables<'carpool_requests'> & { athlete?: Athlete; requester?: Profile };
export type SignupClaim = Tables<'signup_claims'> & { profile?: Profile };
export type SignupSlot = Tables<'signup_slots'> & { claims?: SignupClaim[] };
export type Rsvp = Tables<'rsvps'> & { athlete?: Athlete };
export type StatEvent = Tables<'stat_events'> & { athlete?: Athlete };
export type Message = Tables<'messages'> & { author?: Profile; reactions?: { emoji: string; profile_id: string }[] };

// RPC result rows.
export type CardRow = FnReturns<'athlete_card'>;
export type ActivityRow = FnReturns<'my_activity'>;
export type TeamRecord = FnReturns<'team_record'>;
export type LeaderRow = FnReturns<'team_leaders'>;
export type SeenBy = FnReturns<'message_seen_by'>;

/**
 * The generated types describe a function's OUT columns as non-null, which Postgres does
 * not guarantee: the ride fields are null unless a ride is matched, and the car fields are
 * null unless this parent is driving. Narrowing them here is what stops a crash at the
 * point of use. `my_rsvps` is jsonb, which the generator calls Json.
 */
export type MyEvent = Omit<
  FnReturns<'my_events'>,
  'my_rsvps' | 'my_ride_status' | 'ride_driver' | 'ride_driver_phone' | 'ride_note' | 'my_seats_open' | 'my_riders' | 'location_name' | 'location_address' | 'ends_at'
> & {
  my_rsvps: Record<string, RsvpStatus>;
  my_ride_status: 'driving' | 'matched' | 'needs_ride' | null;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  /** Set only when my_ride_status is 'matched'. */
  ride_driver: string | null;
  ride_driver_phone: string | null;
  ride_note: string | null;
  /** Set only when my_ride_status is 'driving'. */
  my_seats_open: number | null;
  my_riders: number | null;
};

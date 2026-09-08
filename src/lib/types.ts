export type Sport = 'soccer' | 'basketball' | 'other';
export type EventType = 'game' | 'practice' | 'tournament' | 'other';
export type RideDirection = 'to' | 'from' | 'both';
export type MediaConsent = 'household' | 'team' | 'shareable';
export type TeamRole = 'manager' | 'coach' | 'parent';
export type RsvpStatus = 'going' | 'out' | 'maybe';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface Household {
  id: string;
  name: string;
}

export interface Athlete {
  id: string;
  household_id: string;
  first_name: string;
  last_initial: string;
  birth_year: number | null;
  color: string;
  media_consent: MediaConsent;
}

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  season: string;
  color: string;
  join_code: string;
  timezone: string;
  ics_url: string | null;
  ics_last_synced_at: string | null;
  ics_last_error: string | null;
  default_arrive_minutes: number;
  /** Team crest in the team-media bucket under <team_id>/brand/. Staff only. */
  logo_path: string | null;
  /** Overrides the app accent inside this team's screens when set. */
  accent_color: string | null;
}

export interface TeamMember {
  team_id: string;
  profile_id: string;
  role: TeamRole;
  profile?: Profile;
}

export interface Event {
  id: string;
  team_id: string;
  title: string;
  type: EventType;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  notes: string | null;
  arrive_minutes: number | null;
  source: 'manual' | 'ics';
  cancelled: boolean;
}

export interface MyEvent {
  event_id: string;
  team_id: string;
  team_name: string;
  team_color: string;
  sport: Sport;
  title: string;
  type: EventType;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  cancelled: boolean;
  athlete_ids: string[];
  offers: number;
  open_requests: number;
  open_slots: number;
  my_ride_status: 'driving' | 'matched' | 'needs_ride' | null;
  going: number;
  out_count: number;
  unanswered: number;
  my_rsvps: Record<string, RsvpStatus>;
  /** First name of the parent driving my kid, when a ride is matched. */
  ride_driver: string | null;
  ride_driver_phone: string | null;
  ride_note: string | null;
  /** Unclaimed seats across every car offered for this event. */
  seats_open: number;
  /** Unclaimed seats in my own car, when I am driving. */
  my_seats_open: number | null;
  my_riders: number | null;
}

export interface CarpoolOffer {
  id: string;
  event_id: string;
  driver_id: string;
  direction: RideDirection;
  seats: number;
  pickup_note: string | null;
  driver?: Profile;
}

export interface CarpoolRequest {
  id: string;
  event_id: string;
  athlete_id: string;
  requested_by: string;
  direction: RideDirection;
  offer_id: string | null;
  status: 'open' | 'matched' | 'cancelled';
  note: string | null;
  created_at?: string;
  athlete?: Athlete;
  requester?: Profile;
}

export interface SignupSlot {
  id: string;
  event_id: string;
  kind: 'snack' | 'volunteer' | 'equipment';
  title: string;
  needed: number;
  created_by: string;
  claims?: SignupClaim[];
}

export interface SignupClaim {
  id: string;
  slot_id: string;
  profile_id: string;
  note: string | null;
  profile?: Profile;
}

export interface Rsvp {
  event_id: string;
  athlete_id: string;
  status: RsvpStatus;
  set_by: string;
  note: string | null;
  athlete?: Athlete;
}

export interface Message {
  id: string;
  team_id: string;
  author_id: string;
  body: string | null;
  image_path: string | null;
  event_id: string | null;
  created_at: string;
  author?: Profile;
  reactions?: { emoji: string; profile_id: string }[];
}

export type GameStatus = 'scheduled' | 'live' | 'final';

export interface Game {
  id: string;
  event_id: string;
  team_id: string;
  opponent_name: string;
  opponent_team_id: string | null;
  is_home: boolean;
  status: GameStatus;
  our_score: number;
  their_score: number;
  period: number;
  scorekeeper_id: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface StatEvent {
  id: string;
  game_id: string;
  athlete_id: string | null;
  stat_type: string;
  points: number;
  period: number;
  recorded_by: string;
  created_at: string;
  athlete?: Athlete;
}

export interface CardRow {
  first_name: string;
  last_initial: string;
  color: string;
  birth_year: number | null;
  team_id: string | null;
  team_name: string | null;
  sport: Sport | null;
  season: string | null;
  games: number | null;
  stat_type: string | null;
  tally: number | null;
  points: number | null;
  is_current: boolean | null;
}

export type ActivityKind =
  | 'event_added'
  | 'event_changed'
  | 'event_cancelled'
  | 'ride_needed'
  | 'ride_filled'
  | 'slot_claimed'
  | 'game_final';

export interface ActivityRow {
  id: string;
  team_id: string;
  team_name: string;
  team_color: string;
  event_id: string | null;
  kind: ActivityKind;
  title: string;
  body: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
  is_new: boolean;
}

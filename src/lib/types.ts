export type Sport = 'soccer' | 'basketball' | 'other';
export type EventType = 'game' | 'practice' | 'tournament' | 'other';
export type RideDirection = 'to' | 'from' | 'both';
export type MediaConsent = 'household' | 'team' | 'shareable';
export type TeamRole = 'manager' | 'coach' | 'parent';

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

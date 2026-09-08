// Generated from the live schema. Do not hand-edit.
// Regenerate after any migration:
//   npx supabase gen types typescript --project-id ftaxrqwsscitsqrqedxm > src/lib/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' };
  public: {
    Tables: {
      activity: {
        Row: { actor_id: string | null; body: string; created_at: string; event_id: string | null; id: string; kind: Database['public']['Enums']['activity_kind']; team_id: string; title: string };
        Insert: { actor_id?: string | null; body?: string; created_at?: string; event_id?: string | null; id?: string; kind: Database['public']['Enums']['activity_kind']; team_id: string; title: string };
        Update: { actor_id?: string | null; body?: string; created_at?: string; event_id?: string | null; id?: string; kind?: Database['public']['Enums']['activity_kind']; team_id?: string; title?: string };
        Relationships: [
          { foreignKeyName: 'activity_actor_id_fkey'; columns: ['actor_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'activity_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'activity_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      activity_reads: {
        Row: { last_read_at: string; profile_id: string };
        Insert: { last_read_at?: string; profile_id: string };
        Update: { last_read_at?: string; profile_id?: string };
        Relationships: [
          { foreignKeyName: 'activity_reads_profile_id_fkey'; columns: ['profile_id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      athlete_away: {
        Row: { athlete_id: string; created_at: string; created_by: string; ends_on: string; id: string; reason: string | null; starts_on: string };
        Insert: { athlete_id: string; created_at?: string; created_by: string; ends_on: string; id?: string; reason?: string | null; starts_on: string };
        Update: { athlete_id?: string; created_at?: string; created_by?: string; ends_on?: string; id?: string; reason?: string | null; starts_on?: string };
        Relationships: [
          { foreignKeyName: 'athlete_away_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'athlete_away_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      app_admins: {
        Row: { created_at: string; profile_id: string };
        Insert: { created_at?: string; profile_id: string };
        Update: { created_at?: string; profile_id?: string };
        Relationships: [{ foreignKeyName: 'app_admins_profile_id_fkey'; columns: ['profile_id']; isOneToOne: true; referencedRelation: 'profiles'; referencedColumns: ['id'] }];
      };
      athletes: {
        Row: { birth_year: number | null; color: string; created_at: string; first_name: string; household_id: string; id: string; last_initial: string; media_consent: Database['public']['Enums']['media_consent']; photo_url: string | null };
        Insert: { birth_year?: number | null; color?: string; created_at?: string; first_name: string; household_id: string; id?: string; last_initial?: string; media_consent?: Database['public']['Enums']['media_consent']; photo_url?: string | null };
        Update: { birth_year?: number | null; color?: string; created_at?: string; first_name?: string; household_id?: string; id?: string; last_initial?: string; media_consent?: Database['public']['Enums']['media_consent']; photo_url?: string | null };
        Relationships: [
          { foreignKeyName: 'athletes_household_id_fkey'; columns: ['household_id']; isOneToOne: false; referencedRelation: 'households'; referencedColumns: ['id'] },
        ];
      };
      carpool_offers: {
        Row: { created_at: string; direction: Database['public']['Enums']['ride_direction']; driver_id: string; event_id: string; id: string; pickup_note: string | null; seats: number };
        Insert: { created_at?: string; direction?: Database['public']['Enums']['ride_direction']; driver_id: string; event_id: string; id?: string; pickup_note?: string | null; seats: number };
        Update: { created_at?: string; direction?: Database['public']['Enums']['ride_direction']; driver_id?: string; event_id?: string; id?: string; pickup_note?: string | null; seats?: number };
        Relationships: [
          { foreignKeyName: 'carpool_offers_driver_id_fkey'; columns: ['driver_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'carpool_offers_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
        ];
      };
      carpool_requests: {
        Row: { athlete_id: string; created_at: string; direction: Database['public']['Enums']['ride_direction']; event_id: string; id: string; note: string | null; offer_id: string | null; requested_by: string; status: Database['public']['Enums']['request_status'] };
        Insert: { athlete_id: string; created_at?: string; direction?: Database['public']['Enums']['ride_direction']; event_id: string; id?: string; note?: string | null; offer_id?: string | null; requested_by: string; status?: Database['public']['Enums']['request_status'] };
        Update: { athlete_id?: string; created_at?: string; direction?: Database['public']['Enums']['ride_direction']; event_id?: string; id?: string; note?: string | null; offer_id?: string | null; requested_by?: string; status?: Database['public']['Enums']['request_status'] };
        Relationships: [
          { foreignKeyName: 'carpool_requests_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'carpool_requests_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'carpool_requests_offer_id_fkey'; columns: ['offer_id']; isOneToOne: false; referencedRelation: 'carpool_offers'; referencedColumns: ['id'] },
          { foreignKeyName: 'carpool_requests_requested_by_fkey'; columns: ['requested_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      events: {
        Row: { arrive_minutes: number | null; cancelled: boolean; created_at: string; ends_at: string | null; external_uid: string | null; id: string; location_address: string | null; location_name: string | null; notes: string | null; source: Database['public']['Enums']['event_source']; starts_at: string; team_id: string; title: string; type: Database['public']['Enums']['event_type']; updated_at: string };
        Insert: { arrive_minutes?: number | null; cancelled?: boolean; created_at?: string; ends_at?: string | null; external_uid?: string | null; id?: string; location_address?: string | null; location_name?: string | null; notes?: string | null; source?: Database['public']['Enums']['event_source']; starts_at: string; team_id: string; title: string; type?: Database['public']['Enums']['event_type']; updated_at?: string };
        Update: { arrive_minutes?: number | null; cancelled?: boolean; created_at?: string; ends_at?: string | null; external_uid?: string | null; id?: string; location_address?: string | null; location_name?: string | null; notes?: string | null; source?: Database['public']['Enums']['event_source']; starts_at?: string; team_id?: string; title?: string; type?: Database['public']['Enums']['event_type']; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'events_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      games: {
        Row: { created_at: string; ended_at: string | null; event_id: string; id: string; is_home: boolean; opponent_name: string; opponent_team_id: string | null; our_score: number; period: number; scorekeeper_id: string | null; started_at: string | null; status: Database['public']['Enums']['game_status']; team_id: string; their_score: number };
        Insert: { created_at?: string; ended_at?: string | null; event_id: string; id?: string; is_home?: boolean; opponent_name?: string; opponent_team_id?: string | null; our_score?: number; period?: number; scorekeeper_id?: string | null; started_at?: string | null; status?: Database['public']['Enums']['game_status']; team_id: string; their_score?: number };
        Update: { created_at?: string; ended_at?: string | null; event_id?: string; id?: string; is_home?: boolean; opponent_name?: string; opponent_team_id?: string | null; our_score?: number; period?: number; scorekeeper_id?: string | null; started_at?: string | null; status?: Database['public']['Enums']['game_status']; team_id?: string; their_score?: number };
        Relationships: [
          { foreignKeyName: 'games_event_id_fkey'; columns: ['event_id']; isOneToOne: true; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'games_opponent_team_id_fkey'; columns: ['opponent_team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'games_scorekeeper_id_fkey'; columns: ['scorekeeper_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'games_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      household_invites: {
        Row: { code: string; created_at: string; created_by: string; expires_at: string; household_id: string; id: string; label: string | null; used_by: string | null };
        Insert: { code?: string; created_at?: string; created_by: string; expires_at?: string; household_id: string; id?: string; label?: string | null; used_by?: string | null };
        Update: { code?: string; created_at?: string; created_by?: string; expires_at?: string; household_id?: string; id?: string; label?: string | null; used_by?: string | null };
        Relationships: [
          { foreignKeyName: 'household_invites_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'household_invites_household_id_fkey'; columns: ['household_id']; isOneToOne: false; referencedRelation: 'households'; referencedColumns: ['id'] },
          { foreignKeyName: 'household_invites_used_by_fkey'; columns: ['used_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      household_members: {
        Row: { created_at: string; household_id: string; label: string | null; profile_id: string; role: Database['public']['Enums']['household_role'] };
        Insert: { created_at?: string; household_id: string; label?: string | null; profile_id: string; role?: Database['public']['Enums']['household_role'] };
        Update: { created_at?: string; household_id?: string; label?: string | null; profile_id?: string; role?: Database['public']['Enums']['household_role'] };
        Relationships: [
          { foreignKeyName: 'household_members_household_id_fkey'; columns: ['household_id']; isOneToOne: false; referencedRelation: 'households'; referencedColumns: ['id'] },
          { foreignKeyName: 'household_members_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      households: {
        Row: { created_at: string; created_by: string; ics_token: string; id: string; name: string };
        Insert: { created_at?: string; created_by: string; ics_token?: string; id?: string; name: string };
        Update: { created_at?: string; created_by?: string; ics_token?: string; id?: string; name?: string };
        Relationships: [
          { foreignKeyName: 'households_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      media: {
        Row: { caption: string | null; created_at: string; event_id: string | null; id: string; storage_path: string; taken_at: string; team_id: string; uploaded_by: string };
        Insert: { caption?: string | null; created_at?: string; event_id?: string | null; id?: string; storage_path: string; taken_at?: string; team_id: string; uploaded_by: string };
        Update: { caption?: string | null; created_at?: string; event_id?: string | null; id?: string; storage_path?: string; taken_at?: string; team_id?: string; uploaded_by?: string };
        Relationships: [
          { foreignKeyName: 'media_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'media_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'media_uploaded_by_fkey'; columns: ['uploaded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      media_tags: {
        Row: { athlete_id: string; media_id: string };
        Insert: { athlete_id: string; media_id: string };
        Update: { athlete_id?: string; media_id?: string };
        Relationships: [
          { foreignKeyName: 'media_tags_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'media_tags_media_id_fkey'; columns: ['media_id']; isOneToOne: false; referencedRelation: 'media'; referencedColumns: ['id'] },
        ];
      };
      message_reactions: {
        Row: { emoji: string; message_id: string; profile_id: string };
        Insert: { emoji: string; message_id: string; profile_id: string };
        Update: { emoji?: string; message_id?: string; profile_id?: string };
        Relationships: [
          { foreignKeyName: 'message_reactions_message_id_fkey'; columns: ['message_id']; isOneToOne: false; referencedRelation: 'messages'; referencedColumns: ['id'] },
          { foreignKeyName: 'message_reactions_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      messages: {
        Row: { author_id: string; body: string | null; created_at: string; event_id: string | null; id: string; image_path: string | null; important: boolean; team_id: string };
        Insert: { author_id: string; body?: string | null; created_at?: string; event_id?: string | null; id?: string; image_path?: string | null; important?: boolean; team_id: string };
        Update: { author_id?: string; body?: string | null; created_at?: string; event_id?: string | null; id?: string; image_path?: string | null; important?: boolean; team_id?: string };
        Relationships: [
          { foreignKeyName: 'messages_author_id_fkey'; columns: ['author_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'messages_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      notification_prefs: {
        Row: { athlete_id: string | null; carpool: boolean; chat: boolean; email: boolean; event_type: Database['public']['Enums']['event_type'] | null; id: string; profile_id: string; push: boolean; reminders: boolean; schedule_changes: boolean; signups: boolean; sms: boolean };
        Insert: { athlete_id?: string | null; carpool?: boolean; chat?: boolean; email?: boolean; event_type?: Database['public']['Enums']['event_type'] | null; id?: string; profile_id: string; push?: boolean; reminders?: boolean; schedule_changes?: boolean; signups?: boolean; sms?: boolean };
        Update: { athlete_id?: string | null; carpool?: boolean; chat?: boolean; email?: boolean; event_type?: Database['public']['Enums']['event_type'] | null; id?: string; profile_id?: string; push?: boolean; reminders?: boolean; schedule_changes?: boolean; signups?: boolean; sms?: boolean };
        Relationships: [
          { foreignKeyName: 'notification_prefs_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'notification_prefs_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      profiles: {
        Row: { avatar_url: string | null; created_at: string; email: string | null; full_name: string; id: string; phone: string | null };
        Insert: { avatar_url?: string | null; created_at?: string; email?: string | null; full_name?: string; id: string; phone?: string | null };
        Update: { avatar_url?: string | null; created_at?: string; email?: string | null; full_name?: string; id?: string; phone?: string | null };
        Relationships: [];
      };
      push_tokens: {
        Row: { created_at: string; platform: string; profile_id: string; token: string };
        Insert: { created_at?: string; platform: string; profile_id: string; token: string };
        Update: { created_at?: string; platform?: string; profile_id?: string; token?: string };
        Relationships: [
          { foreignKeyName: 'push_tokens_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      ride_patterns: {
        Row: { active: boolean; created_at: string; direction: Database['public']['Enums']['ride_direction']; driver_id: string; event_type: Database['public']['Enums']['event_type'] | null; id: string; pickup_note: string | null; seats: number; team_id: string; weekday: number };
        Insert: { active?: boolean; created_at?: string; direction?: Database['public']['Enums']['ride_direction']; driver_id: string; event_type?: Database['public']['Enums']['event_type'] | null; id?: string; pickup_note?: string | null; seats: number; team_id: string; weekday: number };
        Update: { active?: boolean; created_at?: string; direction?: Database['public']['Enums']['ride_direction']; driver_id?: string; event_type?: Database['public']['Enums']['event_type'] | null; id?: string; pickup_note?: string | null; seats?: number; team_id?: string; weekday?: number };
        Relationships: [
          { foreignKeyName: 'ride_patterns_driver_id_fkey'; columns: ['driver_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'ride_patterns_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      rsvps: {
        Row: { athlete_id: string; event_id: string; note: string | null; set_by: string; status: Database['public']['Enums']['rsvp_status']; updated_at: string };
        Insert: { athlete_id: string; event_id: string; note?: string | null; set_by: string; status: Database['public']['Enums']['rsvp_status']; updated_at?: string };
        Update: { athlete_id?: string; event_id?: string; note?: string | null; set_by?: string; status?: Database['public']['Enums']['rsvp_status']; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'rsvps_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'rsvps_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'rsvps_set_by_fkey'; columns: ['set_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      signup_claims: {
        Row: { created_at: string; id: string; note: string | null; profile_id: string; slot_id: string };
        Insert: { created_at?: string; id?: string; note?: string | null; profile_id: string; slot_id: string };
        Update: { created_at?: string; id?: string; note?: string | null; profile_id?: string; slot_id?: string };
        Relationships: [
          { foreignKeyName: 'signup_claims_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'signup_claims_slot_id_fkey'; columns: ['slot_id']; isOneToOne: false; referencedRelation: 'signup_slots'; referencedColumns: ['id'] },
        ];
      };
      signup_slots: {
        Row: { created_at: string; created_by: string; event_id: string; id: string; kind: Database['public']['Enums']['slot_kind']; needed: number; title: string };
        Insert: { created_at?: string; created_by: string; event_id: string; id?: string; kind?: Database['public']['Enums']['slot_kind']; needed?: number; title: string };
        Update: { created_at?: string; created_by?: string; event_id?: string; id?: string; kind?: Database['public']['Enums']['slot_kind']; needed?: number; title?: string };
        Relationships: [
          { foreignKeyName: 'signup_slots_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'signup_slots_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
        ];
      };
      stat_events: {
        Row: { athlete_id: string | null; created_at: string; game_id: string; id: string; period: number; points: number; recorded_by: string; stat_type: string };
        Insert: { athlete_id?: string | null; created_at?: string; game_id: string; id?: string; period?: number; points?: number; recorded_by: string; stat_type: string };
        Update: { athlete_id?: string | null; created_at?: string; game_id?: string; id?: string; period?: number; points?: number; recorded_by?: string; stat_type?: string };
        Relationships: [
          { foreignKeyName: 'stat_events_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'stat_events_game_id_fkey'; columns: ['game_id']; isOneToOne: false; referencedRelation: 'games'; referencedColumns: ['id'] },
          { foreignKeyName: 'stat_events_recorded_by_fkey'; columns: ['recorded_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      team_athletes: {
        Row: { athlete_id: string; created_at: string; jersey_number: string | null; team_id: string };
        Insert: { athlete_id: string; created_at?: string; jersey_number?: string | null; team_id: string };
        Update: { athlete_id?: string; created_at?: string; jersey_number?: string | null; team_id?: string };
        Relationships: [
          { foreignKeyName: 'team_athletes_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'team_athletes_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      team_members: {
        Row: { created_at: string; profile_id: string; role: Database['public']['Enums']['team_role']; team_id: string };
        Insert: { created_at?: string; profile_id: string; role?: Database['public']['Enums']['team_role']; team_id: string };
        Update: { created_at?: string; profile_id?: string; role?: Database['public']['Enums']['team_role']; team_id?: string };
        Relationships: [
          { foreignKeyName: 'team_members_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'team_members_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      team_places: {
        Row: { bring_note: string | null; created_at: string; created_by: string; id: string; map_url: string | null; name: string; parking_note: string | null; team_id: string; updated_at: string };
        Insert: { bring_note?: string | null; created_at?: string; created_by: string; id?: string; map_url?: string | null; name: string; parking_note?: string | null; team_id: string; updated_at?: string };
        Update: { bring_note?: string | null; created_at?: string; created_by?: string; id?: string; map_url?: string | null; name?: string; parking_note?: string | null; team_id?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'team_places_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'team_places_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      team_reads: {
        Row: { last_read_at: string; profile_id: string; team_id: string };
        Insert: { last_read_at?: string; profile_id: string; team_id: string };
        Update: { last_read_at?: string; profile_id?: string; team_id?: string };
        Relationships: [
          { foreignKeyName: 'team_reads_profile_id_fkey'; columns: ['profile_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'team_reads_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      trips: {
        Row: { base_name: string | null; base_url: string | null; created_at: string; created_by: string; ends_on: string; id: string; name: string; notes: string | null; starts_on: string; team_id: string };
        Insert: { base_name?: string | null; base_url?: string | null; created_at?: string; created_by: string; ends_on: string; id?: string; name: string; notes?: string | null; starts_on: string; team_id: string };
        Update: { base_name?: string | null; base_url?: string | null; created_at?: string; created_by?: string; ends_on?: string; id?: string; name?: string; notes?: string | null; starts_on?: string; team_id?: string };
        Relationships: [
          { foreignKeyName: 'trips_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'trips_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
        ];
      };
      trip_attendance: {
        Row: { adults: number; athlete_id: string; going: boolean; night_count?: never; nights: number; note: string | null; set_by: string; trip_id: string; updated_at: string };
        Insert: { adults?: number; athlete_id: string; going?: boolean; nights?: number; note?: string | null; set_by: string; trip_id: string; updated_at?: string };
        Update: { adults?: number; athlete_id?: string; going?: boolean; nights?: number; note?: string | null; set_by?: string; trip_id?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: 'trip_attendance_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
          { foreignKeyName: 'trip_attendance_trip_id_fkey'; columns: ['trip_id']; isOneToOne: false; referencedRelation: 'trips'; referencedColumns: ['id'] },
        ];
      };
      teams: {
        Row: { accent_color: string | null; color: string; created_at: string; created_by: string; default_arrive_minutes: number; ics_last_error: string | null; ics_last_synced_at: string | null; ics_url: string | null; id: string; is_demo: boolean; join_code: string; logo_path: string | null; name: string; season: string; sport: Database['public']['Enums']['sport']; timezone: string };
        Insert: { accent_color?: string | null; color?: string; created_at?: string; created_by: string; default_arrive_minutes?: number; ics_last_error?: string | null; ics_last_synced_at?: string | null; ics_url?: string | null; id?: string; is_demo?: boolean; join_code?: string; logo_path?: string | null; name: string; season?: string; sport?: Database['public']['Enums']['sport']; timezone?: string };
        Update: { accent_color?: string | null; color?: string; created_at?: string; created_by?: string; default_arrive_minutes?: number; ics_last_error?: string | null; ics_last_synced_at?: string | null; ics_url?: string | null; id?: string; is_demo?: boolean; join_code?: string; logo_path?: string | null; name?: string; season?: string; sport?: Database['public']['Enums']['sport']; timezone?: string };
        Relationships: [
          { foreignKeyName: 'teams_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: {
      athlete_stat_totals: {
        Row: { athlete_id: string | null; games: number | null; points: number | null; season: string | null; sport: Database['public']['Enums']['sport'] | null; stat_type: string | null; tally: number | null; team_id: string | null; team_name: string | null };
        Relationships: [
          { foreignKeyName: 'games_team_id_fkey'; columns: ['team_id']; isOneToOne: false; referencedRelation: 'teams'; referencedColumns: ['id'] },
          { foreignKeyName: 'stat_events_athlete_id_fkey'; columns: ['athlete_id']; isOneToOne: false; referencedRelation: 'athletes'; referencedColumns: ['id'] },
        ];
      };
    };
    Functions: {
      accept_household_invite: { Args: { p_code: string }; Returns: string };
      announce_departure: { Args: { p_offer_id: string; p_minutes?: number }; Returns: undefined };
      apply_ride_patterns: { Args: { p_horizon_days?: number }; Returns: number };
      athlete_card: {
        Args: { p_athlete_id: string };
        Returns: { birth_year: number; color: string; first_name: string; games: number; is_current: boolean; last_initial: string; points: number; season: string; sport: Database['public']['Enums']['sport']; stat_type: string; tally: number; team_id: string; team_name: string }[];
      };
      athlete_media: {
        Args: { p_athlete_id: string; p_limit?: number };
        Returns: { caption: string; id: string; storage_path: string; taken_at: string; team_name: string }[];
      };
      away_athletes: { Args: { p_event_id: string }; Returns: string[] };
      can_see_athlete: { Args: { aid: string }; Returns: boolean };
      check_cron_token: { Args: { p_token: string }; Returns: boolean };
      create_household: { Args: { p_name: string }; Returns: string };
      create_team: {
        Args: { p_color: string; p_ics_url: string | null; p_name: string; p_season: string; p_sport: Database['public']['Enums']['sport'] };
        Returns: string;
      };
      is_household_member: { Args: { hid: string }; Returns: boolean };
      is_household_owner: { Args: { hid: string }; Returns: boolean };
      is_team_member: { Args: { tid: string }; Returns: boolean };
      is_team_staff: { Args: { tid: string }; Returns: boolean };
      join_team: { Args: { p_code: string }; Returns: string };
      mark_activity_read: { Args: never; Returns: undefined };
      message_seen_by: {
        Args: { p_message_id: string };
        Returns: { full_name: string; profile_id: string; seen: boolean }[];
      };
      is_app_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_activity: {
        Args: { p_limit?: number };
        Returns: { actor_id: string; actor_name: string; body: string; created_at: string; event_id: string; id: string; is_new: boolean; kind: Database['public']['Enums']['activity_kind']; team_color: string; team_id: string; team_name: string; title: string }[];
      };
      my_carpool: {
        Args: { p_days?: number };
        Returns: {
          event_id: string; title: string; starts_at: string; location_name: string | null;
          event_type: Database['public']['Enums']['event_type'];
          team_id: string; team_name: string; team_color: string;
          my_athlete_ids: string[]; requests: Json; offers: Json;
        }[];
      };
      my_events: {
        Args: { p_from: string; p_to: string };
        Returns: {
          athlete_ids: string[]; cancelled: boolean; ends_at: string; event_id: string; going: number;
          location_address: string; location_name: string; my_ride_status: string; my_riders: number;
          my_rsvps: Json; my_seats_open: number; offers: number; open_requests: number; open_slots: number;
          out_count: number; ride_driver: string; ride_driver_phone: string; ride_note: string;
          seats_open: number; sport: Database['public']['Enums']['sport']; starts_at: string;
          team_color: string; team_id: string; team_name: string; title: string;
          type: Database['public']['Enums']['event_type']; unanswered: number; away_ids: string[];
        }[];
      };
      peek_team: {
        Args: { p_code: string };
        Returns: { color: string; id: string; name: string; season: string; sport: Database['public']['Enums']['sport'] }[];
      };
      rotate_ics_token: { Args: { p_household_id: string }; Returns: string };
      rotate_signups: {
        Args: { p_team_id: string; p_kind?: Database['public']['Enums']['slot_kind']; p_title?: string; p_from?: string; p_to?: string };
        Returns: number;
      };
      shares_context_with: { Args: { pid: string }; Returns: boolean };
      start_game: { Args: { p_event_id: string; p_is_home: boolean; p_opponent: string }; Returns: string };
      team_leaders: {
        Args: { p_team_id: string };
        Returns: { athlete_id: string; color: string; first_name: string; last_initial: string; stat_type: string; tally: number }[];
      };
      team_record: {
        Args: { p_team_id: string };
        Returns: { games_played: number; losses: number; points_against: number; points_for: number; ties: number; wins: number }[];
      };
      team_tz: { Args: { tid: string }; Returns: string };
      trip_events: { Args: { p_trip_id: string }; Returns: Database['public']['Tables']['events']['Row'][] };
      trip_roster: {
        Args: { p_trip_id: string };
        Returns: { adults: number; athlete_id: string; color: string; first_name: string; going: boolean; last_initial: string; nights: number; note: string | null }[];
      };
      unread_activity: { Args: never; Returns: number };
      when_txt: { Args: { tid: string; ts: string }; Returns: string };
    };
    Enums: {
      activity_kind: 'event_added' | 'event_changed' | 'event_cancelled' | 'ride_needed' | 'ride_filled' | 'slot_claimed' | 'game_final' | 'ride_leaving';
      event_source: 'manual' | 'ics';
      event_type: 'game' | 'practice' | 'tournament' | 'other';
      game_status: 'scheduled' | 'live' | 'final';
      household_role: 'owner' | 'adult';
      media_consent: 'household' | 'team' | 'shareable';
      request_status: 'open' | 'matched' | 'cancelled';
      ride_direction: 'to' | 'from' | 'both';
      rsvp_status: 'going' | 'out' | 'maybe';
      slot_kind: 'snack' | 'volunteer' | 'equipment';
      sport: 'soccer' | 'basketball' | 'other';
      team_role: 'manager' | 'coach' | 'parent';
    };
    CompositeTypes: Record<never, never>;
  };
};

type Public = Database['public'];

/** Row shape of a table or view: Tables<'teams'> */
export type Tables<T extends keyof (Public['Tables'] & Public['Views'])> = (Public['Tables'] & Public['Views'])[T] extends { Row: infer R } ? R : never;
/** Insert shape of a table: TablesInsert<'events'> */
export type TablesInsert<T extends keyof Public['Tables']> = Public['Tables'][T] extends { Insert: infer I } ? I : never;
/** Update shape of a table: TablesUpdate<'events'> */
export type TablesUpdate<T extends keyof Public['Tables']> = Public['Tables'][T] extends { Update: infer U } ? U : never;
/** A database enum: Enums<'rsvp_status'> */
export type Enums<T extends keyof Public['Enums']> = Public['Enums'][T];
/** The row type a function returns: FnReturns<'my_events'> */
export type FnReturns<T extends keyof Public['Functions']> = Public['Functions'][T]['Returns'] extends (infer R)[] ? R : Public['Functions'][T]['Returns'];

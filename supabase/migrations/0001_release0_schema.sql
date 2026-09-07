-- Huddle Up · Release 0 schema
-- Principles baked in:
--   * Children are records inside a parent-owned household. They never have auth accounts.
--   * Every row is reachable only through household or team membership (RLS below).
--   * Media consent lives on the athlete and defaults to household-only.

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type public.household_role as enum ('owner', 'adult');
create type public.team_role as enum ('manager', 'coach', 'parent');
create type public.media_consent as enum ('household', 'team', 'shareable');
create type public.event_type as enum ('game', 'practice', 'tournament', 'other');
create type public.event_source as enum ('manual', 'ics');
create type public.ride_direction as enum ('to', 'from', 'both');
create type public.request_status as enum ('open', 'matched', 'cancelled');
create type public.slot_kind as enum ('snack', 'volunteer', 'equipment');
create type public.sport as enum ('soccer', 'basketball', 'other');

-- ---------- profiles (adults only) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- households ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'adult',
  label text, -- "Mom", "Grandpa", "Carpool driver"
  created_at timestamptz not null default now(),
  primary key (household_id, profile_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  label text,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- athletes (children as records) ----------
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  first_name text not null,
  last_initial text not null default '',
  birth_year int check (birth_year between 1990 and 2030),
  color text not null default '#1F7A4D',
  media_consent public.media_consent not null default 'household',
  created_at timestamptz not null default now()
);

-- ---------- teams ----------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport public.sport not null default 'soccer',
  season text not null default '',
  color text not null default '#1F7A4D',
  join_code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  timezone text not null default 'America/Los_Angeles',
  ics_url text,
  ics_last_synced_at timestamptz,
  ics_last_error text,
  default_arrive_minutes int not null default 30,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (team_id, profile_id)
);

create table public.team_athletes (
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  jersey_number text,
  created_at timestamptz not null default now(),
  primary key (team_id, athlete_id)
);

-- ---------- events ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  type public.event_type not null default 'practice',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text,
  location_address text,
  notes text,
  arrive_minutes int,
  source public.event_source not null default 'manual',
  external_uid text,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, external_uid)
);
create index events_team_starts_idx on public.events (team_id, starts_at);

-- ---------- carpools ----------
create table public.carpool_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  direction public.ride_direction not null default 'both',
  seats int not null check (seats between 1 and 8),
  pickup_note text,
  created_at timestamptz not null default now()
);
create index carpool_offers_event_idx on public.carpool_offers (event_id);

create table public.carpool_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  direction public.ride_direction not null default 'both',
  offer_id uuid references public.carpool_offers(id) on delete set null,
  status public.request_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, athlete_id, direction)
);
create index carpool_requests_event_idx on public.carpool_requests (event_id);

-- ---------- signups (snack, volunteer, equipment) ----------
create table public.signup_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind public.slot_kind not null default 'snack',
  title text not null,
  needed int not null default 1 check (needed between 1 and 20),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.signup_claims (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.signup_slots(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (slot_id, profile_id)
);

-- ---------- notification preferences ----------
create table public.notification_prefs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  event_type public.event_type,
  reminders boolean not null default true,
  schedule_changes boolean not null default true,
  carpool boolean not null default true,
  signups boolean not null default true,
  chat boolean not null default true,
  push boolean not null default true,
  sms boolean not null default false,
  email boolean not null default false,
  primary key (profile_id, athlete_id, event_type)
);

-- ---------- push tokens ----------
create table public.push_tokens (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, token)
);

-- ---------- helper functions ----------
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members hm
    where hm.household_id = hid and hm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_team_member(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = tid and tm.profile_id = auth.uid()
  );
$$;

create or replace function public.is_team_staff(tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = tid and tm.profile_id = auth.uid()
      and tm.role in ('manager', 'coach')
  );
$$;

-- an athlete is visible to a user if they share a household OR a team with the athlete
create or replace function public.can_see_athlete(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.athletes a
    where a.id = aid and public.is_household_member(a.household_id)
  ) or exists (
    select 1 from public.team_athletes ta
    where ta.athlete_id = aid and public.is_team_member(ta.team_id)
  );
$$;

-- ---------- RPCs ----------
-- Create a household and make the caller its owner in one step.
create or replace function public.create_household(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into public.households (name, created_by) values (p_name, auth.uid()) returning id into hid;
  insert into public.household_members (household_id, profile_id, role) values (hid, auth.uid(), 'owner');
  return hid;
end $$;

-- Create a team and make the caller its manager.
create or replace function public.create_team(p_name text, p_sport public.sport, p_season text, p_color text, p_ics_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  insert into public.teams (name, sport, season, color, ics_url, created_by)
  values (p_name, p_sport, coalesce(p_season, ''), coalesce(p_color, '#1F7A4D'), nullif(p_ics_url, ''), auth.uid())
  returning id into tid;
  insert into public.team_members (team_id, profile_id, role) values (tid, auth.uid(), 'manager');
  return tid;
end $$;

-- Join a team by its 6-character code. Returns the team id.
create or replace function public.join_team(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select id into tid from public.teams where join_code = upper(trim(p_code));
  if tid is null then raise exception 'No team with that code'; end if;
  insert into public.team_members (team_id, profile_id, role) values (tid, auth.uid(), 'parent')
  on conflict do nothing;
  return tid;
end $$;

-- Preview a team by code without joining (name, sport, season only).
create or replace function public.peek_team(p_code text)
returns table (id uuid, name text, sport public.sport, season text, color text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.sport, t.season, t.color from public.teams t where t.join_code = upper(trim(p_code));
$$;

-- Accept a household invite code.
create or replace function public.accept_household_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv record;
begin
  select * into inv from public.household_invites where code = p_code and used_by is null and expires_at > now();
  if inv is null then raise exception 'Invite is invalid or expired'; end if;
  insert into public.household_members (household_id, profile_id, role, label)
  values (inv.household_id, auth.uid(), 'adult', inv.label) on conflict do nothing;
  update public.household_invites set used_by = auth.uid() where id = inv.id;
  return inv.household_id;
end $$;

-- Everything on my plate: events across every team any of my athletes plays on, plus teams I manage.
create or replace function public.my_events(p_from timestamptz, p_to timestamptz)
returns table (
  event_id uuid, team_id uuid, team_name text, team_color text, sport public.sport,
  title text, type public.event_type, starts_at timestamptz, ends_at timestamptz,
  location_name text, location_address text, cancelled boolean,
  athlete_ids uuid[], offers int, open_requests int, open_slots int, my_ride_status text
) language sql stable security definer set search_path = public as $$
  with my_teams as (
    select tm.team_id from public.team_members tm where tm.profile_id = auth.uid()
  ),
  my_athletes as (
    select a.id from public.athletes a
    join public.household_members hm on hm.household_id = a.household_id
    where hm.profile_id = auth.uid()
  )
  select
    e.id, t.id, t.name, t.color, t.sport,
    e.title, e.type, e.starts_at, e.ends_at, e.location_name, e.location_address, e.cancelled,
    coalesce(array_agg(distinct ta.athlete_id) filter (where ta.athlete_id in (select id from my_athletes)), '{}'),
    (select count(*)::int from public.carpool_offers o where o.event_id = e.id),
    (select count(*)::int from public.carpool_requests r where r.event_id = e.id and r.status = 'open'),
    (select coalesce(sum(s.needed - (select count(*) from public.signup_claims c where c.slot_id = s.id)), 0)::int
       from public.signup_slots s where s.event_id = e.id),
    (select case
       when exists (select 1 from public.carpool_offers o where o.event_id = e.id and o.driver_id = auth.uid()) then 'driving'
       when exists (select 1 from public.carpool_requests r where r.event_id = e.id and r.requested_by = auth.uid() and r.status = 'matched') then 'matched'
       when exists (select 1 from public.carpool_requests r where r.event_id = e.id and r.requested_by = auth.uid() and r.status = 'open') then 'needs_ride'
       else null end)
  from public.events e
  join public.teams t on t.id = e.team_id
  left join public.team_athletes ta on ta.team_id = t.id
  where e.team_id in (select team_id from my_teams)
    and e.starts_at >= p_from and e.starts_at < p_to
  group by e.id, t.id
  order by e.starts_at;
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.athletes enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_athletes enable row level security;
alter table public.events enable row level security;
alter table public.carpool_offers enable row level security;
alter table public.carpool_requests enable row level security;
alter table public.signup_slots enable row level security;
alter table public.signup_claims enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_tokens enable row level security;

-- profiles: see yourself, and adults you share a household or team with
create policy "profiles: self" on public.profiles for select using (id = auth.uid());
create policy "profiles: shared context" on public.profiles for select using (
  exists (select 1 from public.household_members a join public.household_members b on a.household_id = b.household_id
          where a.profile_id = auth.uid() and b.profile_id = profiles.id)
  or exists (select 1 from public.team_members a join public.team_members b on a.team_id = b.team_id
          where a.profile_id = auth.uid() and b.profile_id = profiles.id)
);
create policy "profiles: update self" on public.profiles for update using (id = auth.uid());

-- households
create policy "households: members read" on public.households for select using (public.is_household_member(id));
create policy "households: owner update" on public.households for update using (
  exists (select 1 from public.household_members hm where hm.household_id = id and hm.profile_id = auth.uid() and hm.role = 'owner')
);

create policy "household_members: members read" on public.household_members for select using (public.is_household_member(household_id));
create policy "household_members: owner manage" on public.household_members for all using (
  exists (select 1 from public.household_members hm where hm.household_id = household_members.household_id and hm.profile_id = auth.uid() and hm.role = 'owner')
);

create policy "household_invites: members" on public.household_invites for all using (public.is_household_member(household_id));

-- athletes: household members manage; teammates' adults may read
create policy "athletes: read" on public.athletes for select using (public.can_see_athlete(id));
create policy "athletes: household write" on public.athletes for insert with check (public.is_household_member(household_id));
create policy "athletes: household update" on public.athletes for update using (public.is_household_member(household_id));
create policy "athletes: household delete" on public.athletes for delete using (public.is_household_member(household_id));

-- teams
create policy "teams: members read" on public.teams for select using (public.is_team_member(id));
create policy "teams: staff update" on public.teams for update using (public.is_team_staff(id));

create policy "team_members: members read" on public.team_members for select using (public.is_team_member(team_id));
create policy "team_members: staff manage" on public.team_members for all using (public.is_team_staff(team_id));
create policy "team_members: leave" on public.team_members for delete using (profile_id = auth.uid());

-- team_athletes: a parent may add their own child to a team they belong to
create policy "team_athletes: members read" on public.team_athletes for select using (public.is_team_member(team_id));
create policy "team_athletes: parent add own" on public.team_athletes for insert with check (
  public.is_team_member(team_id) and exists (
    select 1 from public.athletes a where a.id = athlete_id and public.is_household_member(a.household_id))
);
create policy "team_athletes: parent or staff remove" on public.team_athletes for delete using (
  public.is_team_staff(team_id) or exists (
    select 1 from public.athletes a where a.id = athlete_id and public.is_household_member(a.household_id))
);

-- events
create policy "events: members read" on public.events for select using (public.is_team_member(team_id));
create policy "events: staff write" on public.events for insert with check (public.is_team_staff(team_id));
create policy "events: staff update" on public.events for update using (public.is_team_staff(team_id));
create policy "events: staff delete" on public.events for delete using (public.is_team_staff(team_id));

-- carpools: any team adult may offer or request; only the author (or staff) edits
create policy "offers: members read" on public.carpool_offers for select using (
  exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id)));
create policy "offers: member insert" on public.carpool_offers for insert with check (
  driver_id = auth.uid() and exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id)));
create policy "offers: author update" on public.carpool_offers for update using (driver_id = auth.uid());
create policy "offers: author delete" on public.carpool_offers for delete using (driver_id = auth.uid());

create policy "requests: members read" on public.carpool_requests for select using (
  exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id)));
create policy "requests: parent insert own child" on public.carpool_requests for insert with check (
  requested_by = auth.uid()
  and exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id))
  and exists (select 1 from public.athletes a where a.id = athlete_id and public.is_household_member(a.household_id)));
create policy "requests: parent or matched driver update" on public.carpool_requests for update using (
  requested_by = auth.uid()
  or exists (select 1 from public.carpool_offers o where o.id = offer_id and o.driver_id = auth.uid())
  or exists (select 1 from public.carpool_offers o join public.events e on e.id = o.event_id
             where o.event_id = carpool_requests.event_id and o.driver_id = auth.uid()));
create policy "requests: author delete" on public.carpool_requests for delete using (requested_by = auth.uid());

-- signups
create policy "slots: members read" on public.signup_slots for select using (
  exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id)));
create policy "slots: members insert" on public.signup_slots for insert with check (
  created_by = auth.uid() and exists (select 1 from public.events e where e.id = event_id and public.is_team_member(e.team_id)));
create policy "slots: author or staff manage" on public.signup_slots for update using (
  created_by = auth.uid() or exists (select 1 from public.events e where e.id = event_id and public.is_team_staff(e.team_id)));
create policy "slots: author or staff delete" on public.signup_slots for delete using (
  created_by = auth.uid() or exists (select 1 from public.events e where e.id = event_id and public.is_team_staff(e.team_id)));

create policy "claims: members read" on public.signup_claims for select using (
  exists (select 1 from public.signup_slots s join public.events e on e.id = s.event_id where s.id = slot_id and public.is_team_member(e.team_id)));
create policy "claims: self insert" on public.signup_claims for insert with check (
  profile_id = auth.uid() and exists (select 1 from public.signup_slots s join public.events e on e.id = s.event_id where s.id = slot_id and public.is_team_member(e.team_id)));
create policy "claims: self delete" on public.signup_claims for delete using (profile_id = auth.uid());

-- prefs and tokens: self only
create policy "prefs: self" on public.notification_prefs for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "tokens: self" on public.push_tokens for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- realtime ----------
alter publication supabase_realtime add table public.events, public.carpool_offers, public.carpool_requests, public.signup_slots, public.signup_claims;

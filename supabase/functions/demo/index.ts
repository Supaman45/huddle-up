// Huddle Up · demo
//
// Loads a complete walkthrough team on demand, or removes every trace of one. Only a profile in
// app_admins can call it. Everything it creates is marked: the team has is_demo = true, and the
// parents it invents have emails under @demo.huddleup.test, so reset can find all of it and
// nothing from a real season is ever touched.
//
// POST { action: 'load', sport: 'soccer' | 'basketball' }  → creates the team, adds the caller as
//      manager (and their first kid to the roster), returns counts.
// POST { action: 'reset' }                                   → deletes every demo team and demo parent.
//
// Every date is computed from "now" in the team's zone, so the schedule is always ahead of
// whoever is holding the phone, whichever week the demo runs.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const DEMO_DOMAIN = 'demo.huddleup.test';
const TZ = 'America/Los_Angeles';

type Sport = 'soccer' | 'basketball';

// deno-lint-ignore no-explicit-any
type Admin = any;

// ---------- Time ----------

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - utcMs;
}

/** A wall-clock time in the team's zone, as an instant. Two passes, same as the app. */
function at(y: number, m: number, d: number, h: number, mi: number): Date {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  const first = naive - zoneOffsetMs(naive, TZ);
  return new Date(naive - zoneOffsetMs(first, TZ));
}

/** Today's calendar date in the team's zone. */
function todayInZone(): { y: number; m: number; d: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), dow };
}

/** The Nth upcoming instance of a weekday (0 = Sunday), never today, as y/m/d. */
function upcoming(weekday: number, nth: number): { y: number; m: number; d: number } {
  const t = todayInZone();
  let ahead = (weekday - t.dow + 7) % 7;
  if (ahead === 0) ahead = 7;
  ahead += 7 * nth;
  const base = new Date(Date.UTC(t.y, t.m - 1, t.d + ahead));
  return { y: base.getUTCFullYear(), m: base.getUTCMonth() + 1, d: base.getUTCDate() };
}

/** The calendar day after a y/m/d, across month and year ends. */
function dayAfter(d: { y: number; m: number; d: number }): { y: number; m: number; d: number } {
  const n = new Date(Date.UTC(d.y, d.m - 1, d.d + 1));
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
}

// ---------- Cast ----------

interface Kid {
  first: string;
  last: string;
  number: string;
  color: string;
  seed: string;
}
interface Parent {
  first: string;
  last: string;
  phone: string;
  kids: number[];
  role?: 'coach';
}

const COLORS = ['#F3A56B', '#8CD5A5', '#7FB6FF', '#F5B849', '#D98CF0', '#FF8FA3', '#6FD3D3', '#C5E17A'];

const SOCCER: { team: string; color: string; kids: Kid[]; venues: string[]; opponents: string[] } = {
  team: 'Tacoma Sharks U10',
  color: '#1F7A4D',
  venues: ['Fort Steilacoom Park #4', 'Harry Todd Park', 'Sparks Stadium', 'Fort Steilacoom Park #2', 'Heritage Rec Center'],
  opponents: ['Red Robin FC', 'Puyallup Blue', 'Lakewood United', 'Gig Harbor Tide', 'Spanaway Storm', 'University Place Rovers'],
  kids: [
    k('Maya', 'S', '1'), k('Tyrell', 'J', '3'), k('Sofia', 'R', '4'), k('Jaxon', 'O', '5'), k('Priya', 'N', '6'), k('Elijah', 'W', '7'),
    k('Harper', 'K', '8'), k('Mateo', 'G', '9'), k('Zoe', 'L', '10'), k('Kai', 'T', '11'), k('Amara', 'B', '12'), k('Leo', 'P', '14'),
    k('Nia', 'D', '15'), k('Owen', 'H', '17'),
  ],
};

const BASKETBALL: typeof SOCCER = {
  team: 'Lakewood Lightning 5th',
  color: '#3D5AFE',
  venues: ['Clover Park HS Gym', 'Lakewood YMCA', 'Hudtloff Middle School', 'Tacoma Boys & Girls Club'],
  opponents: ['Puyallup Vikings', 'Steilacoom Sentinels', 'Tacoma Thunder', 'Federal Way Eagles', 'Spanaway Lake Heat', 'Curtis Cougars'],
  kids: [
    k('Maya', 'S', '2'), k('Tyrell', 'J', '5'), k('Sofia', 'R', '7'), k('Jaxon', 'O', '10'), k('Priya', 'N', '11'), k('Elijah', 'W', '12'),
    k('Harper', 'K', '14'), k('Mateo', 'G', '21'), k('Zoe', 'L', '23'), k('Kai', 'T', '24'), k('Amara', 'B', '30'), k('Leo', 'P', '33'),
  ],
};

function k(first: string, last: string, number: string): Kid {
  return { first, last, number, color: COLORS[(first.charCodeAt(0) + first.length) % COLORS.length], seed: `${first}-${last}-${number}` };
}

// One household per kid, in roster order. Two kids share the Okafor household (siblings).
// Phone numbers are 555 numbers, which are reserved for fiction.
const PARENTS: Parent[] = [
  { first: 'Dana', last: 'Okafor', phone: '(253) 555-0101', kids: [0, 12] },
  { first: 'Marcus', last: 'Reyes', phone: '(253) 555-0102', kids: [1] },
  { first: 'Priya', last: 'Natarajan', phone: '(253) 555-0103', kids: [2] },
  { first: 'Jordan', last: 'Whitfield', phone: '(253) 555-0104', kids: [3] },
  { first: 'Amelia', last: 'Chen', phone: '(253) 555-0105', kids: [4] },
  { first: 'Devon', last: 'Brooks', phone: '(253) 555-0106', kids: [5] },
  { first: 'Rosa', last: 'Delgado', phone: '(253) 555-0107', kids: [6] },
  { first: 'Sam', last: 'Kowalski', phone: '(253) 555-0108', kids: [7] },
  { first: 'Grace', last: 'Nakamura', phone: '(253) 555-0109', kids: [8] },
  { first: 'Andre', last: 'Thompson', phone: '(253) 555-0110', kids: [9] },
  { first: 'Fatima', last: 'Hassan', phone: '(253) 555-0111', kids: [10] },
  { first: 'Chris', last: 'Lindqvist', phone: '(253) 555-0112', kids: [11] },
  { first: 'Nicole', last: 'Park', phone: '(253) 555-0113', kids: [13] },
  { first: 'Coach Ray', last: 'Bennett', phone: '(253) 555-0120', kids: [], role: 'coach' },
];

/** Illustrated, not photographic. Kids in a demo get a drawing, never a generated face. */
function avatar(seed: string): string {
  return `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(seed)}&size=160&backgroundColor=1b2635`;
}

// ---------- Load ----------

async function load(admin: Admin, callerId: string, sport: Sport) {
  const cast = sport === 'soccer' ? SOCCER : BASKETBALL;
  const kids = cast.kids;

  // 1. Team, with the caller as manager so they see the coach's side.
  const { data: team, error: teamErr } = await admin
    .from('teams')
    .insert({ name: cast.team, sport, season: 'Fall 2026', color: cast.color, created_by: callerId, timezone: TZ, is_demo: true })
    .select('id')
    .single();
  if (teamErr) throw teamErr;
  const teamId = team.id as string;
  await admin.from('team_members').insert({ team_id: teamId, profile_id: callerId, role: 'manager' });

  // 2. Parents: real auth users, so every FK and every RLS check behaves exactly as in a season.
  const parentIds: string[] = [];
  for (const p of PARENTS) {
    const email = `${p.first}.${p.last}`.toLowerCase().replace(/[^a-z.]/g, '') + `@${DEMO_DOMAIN}`;
    const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { full_name: `${p.first} ${p.last}` },
      });
      if (error) throw error;
      id = data.user.id;
    }
    await admin.from('profiles').update({ full_name: `${p.first} ${p.last}`, phone: p.phone }).eq('id', id);
    parentIds.push(id);
    await admin.from('team_members').insert({ team_id: teamId, profile_id: id, role: p.role ?? 'parent' });
  }
  const coachId = parentIds[PARENTS.length - 1];

  // 3. Households and kids, with jersey numbers and pictures.
  const kidIds: string[] = [];
  const kidParent: string[] = [];
  for (let pi = 0; pi < PARENTS.length; pi++) {
    const p = PARENTS[pi];
    if (!p.kids.length) continue;
    const { data: hh, error: hhErr } = await admin.from('households').insert({ name: `${p.last} family`, created_by: parentIds[pi] }).select('id').single();
    if (hhErr) throw hhErr;
    await admin.from('household_members').insert({ household_id: hh.id, profile_id: parentIds[pi], role: 'owner' });
    for (const ki of p.kids) {
      const kid = kids[ki];
      if (!kid) continue;
      const { data: a, error: aErr } = await admin
        .from('athletes')
        .insert({ household_id: hh.id, first_name: kid.first, last_initial: kid.last, color: kid.color, photo_url: avatar(kid.seed), media_consent: 'team' })
        .select('id')
        .single();
      if (aErr) throw aErr;
      kidIds[ki] = a.id;
      kidParent[ki] = parentIds[pi];
      await admin.from('team_athletes').insert({ team_id: teamId, athlete_id: a.id, jersey_number: kid.number });
    }
  }

  // The caller's own first kid joins the roster, so the parent side of the demo is theirs too.
  const { data: myHouseholds } = await admin.from('household_members').select('household_id').eq('profile_id', callerId);
  const hhIds = ((myHouseholds ?? []) as { household_id: string }[]).map((h) => h.household_id);
  const { data: myKid } = hhIds.length
    ? await admin.from('athletes').select('id, first_name').in('household_id', hhIds).order('created_at').limit(1).maybeSingle()
    : { data: null };
  if (myKid) await admin.from('team_athletes').insert({ team_id: teamId, athlete_id: myKid.id, jersey_number: '00' });

  // 4. Schedule: six weeks ahead, always in the future.
  const events: { id: string; type: string; index: number }[] = [];
  const insertEvent = async (row: Record<string, unknown>) => {
    const { data, error } = await admin.from('events').insert({ team_id: teamId, source: 'manual', ...row }).select('id, type').single();
    if (error) throw error;
    events.push({ id: data.id, type: data.type, index: events.length });
    return data.id as string;
  };
  const gameIds: string[] = [];
  const gameLenMin = sport === 'soccer' ? 75 : 60;
  for (let w = 0; w < 6; w++) {
    const d = upcoming(6, w); // Saturday
    const hour = [9, 10, 12, 9, 11, 10][w];
    const minute = [0, 30, 0, 0, 0, 30][w];
    const start = at(d.y, d.m, d.d, hour, minute);
    const home = w % 2 === 0;
    const opp = cast.opponents[w % cast.opponents.length];
    if (w === 4) {
      // Tournament weekend, both days.
      const sun = dayAfter(d);
      await insertEvent({ title: `${sport === 'soccer' ? 'Puyallup Fall Classic' : 'South Sound Hoops Jam'}`, type: 'tournament', starts_at: at(d.y, d.m, d.d, 8, 0).toISOString(), ends_at: at(d.y, d.m, d.d, 15, 0).toISOString(), location_name: 'Sparks Stadium', location_address: '601 7th Ave SW, Puyallup, WA', arrive_minutes: 45 });
      await insertEvent({ title: 'Tournament, day two', type: 'tournament', starts_at: at(sun.y, sun.m, sun.d, 9, 0).toISOString(), ends_at: at(sun.y, sun.m, sun.d, 14, 0).toISOString(), location_name: 'Sparks Stadium', location_address: '601 7th Ave SW, Puyallup, WA', arrive_minutes: 45 });
      continue;
    }
    const id = await insertEvent({
      title: `${home ? 'vs' : 'at'} ${opp}`,
      type: 'game',
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + gameLenMin * 60000).toISOString(),
      location_name: cast.venues[w % cast.venues.length],
      arrive_minutes: 30,
    });
    gameIds.push(id);
  }
  const practiceDays = sport === 'soccer' ? [2, 4] : [3]; // Tue/Thu or Wed
  const practiceIds: string[] = [];
  for (let w = 0; w < 6; w++) {
    for (const dow of practiceDays) {
      const d = upcoming(dow, w);
      const start = at(d.y, d.m, d.d, 17, 30);
      practiceIds.push(
        await insertEvent({ title: 'Practice', type: 'practice', starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 60 * 60000).toISOString(), location_name: cast.venues[1] }),
      );
    }
  }

  // 5. Rides. Two parents drive every Saturday (patterns, then materialised), one drives once.
  const dana = parentIds[0];
  const marcus = parentIds[1];
  const priya = parentIds[2];
  await admin.from('ride_patterns').insert([
    { team_id: teamId, driver_id: dana, weekday: 6, direction: 'both', seats: 3, pickup_note: 'Leaving Lakewood Towne Center Starbucks 45 min before. Text me.', event_type: 'game' },
    { team_id: teamId, driver_id: marcus, weekday: 6, direction: 'both', seats: 2, pickup_note: 'Can grab anyone near Steilacoom Blvd.', event_type: 'game' },
  ]);
  await admin.rpc('apply_ride_patterns', { p_horizon_days: 60 });
  await admin.from('carpool_offers').insert({ event_id: gameIds[1], driver_id: priya, direction: 'from', seats: 1, pickup_note: 'Only the ride home, heading to University Place after.' });

  const offerFor = async (eventId: string, driverId: string) => {
    const { data } = await admin.from('carpool_offers').select('id').eq('event_id', eventId).eq('driver_id', driverId).maybeSingle();
    return data?.id as string | undefined;
  };
  const ask = async (eventId: string, ki: number, offerId?: string) => {
    if (!kidIds[ki]) return;
    await admin.from('carpool_requests').insert({ event_id: eventId, athlete_id: kidIds[ki], requested_by: kidParent[ki], direction: 'both', offer_id: offerId ?? null, status: offerId ? 'matched' : 'open' });
  };

  // Game 1: two kids placed, two still waiting. One of the waiting kids belongs to the caller.
  await ask(gameIds[0], 6, await offerFor(gameIds[0], dana)); // Harper with Dana
  await ask(gameIds[0], 8, await offerFor(gameIds[0], dana)); // Zoe with Dana
  await ask(gameIds[0], 4, await offerFor(gameIds[0], marcus)); // Priya N with Marcus
  await ask(gameIds[0], 9); // Kai, waiting
  if (myKid) await admin.from('carpool_requests').insert({ event_id: gameIds[0], athlete_id: myKid.id, requested_by: callerId, direction: 'both', status: 'open' });
  // Game 2: one matched into the one-off car, one waiting.
  await ask(gameIds[1], 2, await offerFor(gameIds[1], priya)); // Sofia with Priya
  await ask(gameIds[1], 11); // Leo, waiting
  // Game 3: cars but no asks, settled and quiet.
  // Practice 1: one kid waiting, nobody driving yet.
  await ask(practiceIds[0], 3);

  // 6. RSVPs: most families answer, a few have not.
  const rsvps: Record<string, unknown>[] = [];
  kidIds.forEach((aid, i) => {
    if (!aid) return;
    if (i === 5) rsvps.push({ event_id: gameIds[0], athlete_id: aid, set_by: kidParent[i], status: 'out', note: 'Grandma visiting' });
    else if (i !== 10 && i !== 13) rsvps.push({ event_id: gameIds[0], athlete_id: aid, set_by: kidParent[i], status: 'going' });
    if (i % 3 !== 0) rsvps.push({ event_id: gameIds[1], athlete_id: aid, set_by: kidParent[i], status: i === 7 ? 'maybe' : 'going' });
    if (i % 2 === 0) rsvps.push({ event_id: practiceIds[0], athlete_id: aid, set_by: kidParent[i], status: 'going' });
  });
  await admin.from('rsvps').insert(rsvps);

  // 7. Snacks and volunteers.
  const { data: s1 } = await admin.from('signup_slots').insert({ event_id: gameIds[0], created_by: coachId, kind: 'snack', title: 'Halftime snacks', needed: 2 }).select('id').single();
  await admin.from('signup_claims').insert({ slot_id: s1.id, profile_id: parentIds[4], note: 'Orange slices and water' });
  await admin.from('signup_slots').insert([
    { event_id: gameIds[1], created_by: coachId, kind: 'snack', title: 'Post-game snack', needed: 1 },
    { event_id: gameIds[0], created_by: coachId, kind: 'volunteer', title: 'Set up the bench and cones', needed: 1 },
  ]);
  const { data: s3 } = await admin.from('signup_slots').insert({ event_id: practiceIds[0], created_by: coachId, kind: 'equipment', title: sport === 'soccer' ? 'Bring the pop-up goals' : 'Bring the ball bag', needed: 1 }).select('id').single();
  await admin.from('signup_claims').insert({ slot_id: s3.id, profile_id: parentIds[7] });

  // 8. Team chat: enough to look lived in.
  await admin.from('messages').insert([
    { team_id: teamId, author_id: coachId, body: `Welcome to the season. Practice ${sport === 'soccer' ? 'Tuesdays and Thursdays' : 'Wednesdays'} at 5:30, games Saturday mornings. Bring water and shin guards.`, important: false },
    { team_id: teamId, author_id: coachId, event_id: gameIds[0], body: 'Field change this Saturday: we are on #4, not #2. Arrive 30 minutes early for warmups.', important: true },
    { team_id: teamId, author_id: parentIds[9], body: 'Anyone able to grab Kai from the Lakewood side on Saturday? I have an early shift.', important: false },
    { team_id: teamId, author_id: parentIds[0], body: 'I have three seats every Saturday, leaving from the Towne Center Starbucks. Put your kid in my car on the Carpool tab.', important: false },
    { team_id: teamId, author_id: coachId, body: 'Picture day is the second game. White jerseys.', important: false },
  ]);

  return { team_id: teamId, team: cast.team, kids: kidIds.filter(Boolean).length, parents: parentIds.length, events: events.length, my_kid_added: !!myKid };
}

// ---------- Reset ----------

async function reset(admin: Admin) {
  const { data: teams } = await admin.from('teams').select('id').eq('is_demo', true);
  const teamIds = ((teams ?? []) as { id: string }[]).map((t) => t.id);
  if (teamIds.length) await admin.from('teams').delete().in('id', teamIds);

  const { data: demoProfiles } = await admin.from('profiles').select('id').like('email', `%@${DEMO_DOMAIN}`);
  const ids = ((demoProfiles ?? []) as { id: string }[]).map((p) => p.id);
  // Households do not cascade from their creator, so they go first; athletes follow them.
  if (ids.length) await admin.from('households').delete().in('created_by', ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);

  return { teams_removed: teamIds.length, parents_removed: ids.length };
}

// ---------- Handler ----------

// The web build calls this from a different origin, so the browser asks first.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const text = (body: string, status: number) => new Response(body, { status, headers: CORS });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return text('Method not allowed', 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const authHeader = req.headers.get('Authorization') ?? '';
  const user = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: me } = await user.auth.getUser();
  if (!me?.user) return text('Unauthorized', 401);

  const { data: isAdmin } = await admin.from('app_admins').select('profile_id').eq('profile_id', me.user.id).maybeSingle();
  if (!isAdmin) return text('Demo mode is not available on this account', 403);

  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === 'reset') return json(await reset(admin));
    if (body.action === 'load') {
      const sport: Sport = body.sport === 'basketball' ? 'basketball' : 'soccer';
      // One demo team at a time: loading again replaces the last one.
      await reset(admin);
      return json(await load(admin, me.user.id, sport));
    }
    return text('Unknown action', 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

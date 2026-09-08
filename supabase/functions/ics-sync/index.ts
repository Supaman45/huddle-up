// Huddle Up · ics-sync
// Pulls the linked calendar (TeamSnap, SportsEngine, GameChanger, Google) for one team or every team
// and upserts events by external_uid. Manual events are never touched.
//
// Invoke:  POST { team_id } with a user JWT  → syncs that team if the caller is staff on it
//          POST {} with the service role key (cron) → syncs every team with an ics_url
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface VEvent {
  uid: string;
  summary: string;
  start: Date;
  end: Date | null;
  location: string | null;
  description: string | null;
  status: string | null;
}

// Minimal RFC 5545 parser: handles folding, DTSTART/DTEND with TZID or Z or all-day dates.
// Recurring rules (RRULE) are skipped; team feeds expand occurrences already.
function parseIcs(text: string): VEvent[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: VEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;
  for (const raw of lines) {
    if (raw === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (raw === 'END:VEVENT') {
      if (cur && cur.UID && cur.DTSTART && !cur.RRULE) {
        const start = parseDate(cur.DTSTART.value, cur.DTSTART.params);
        if (start) {
          out.push({
            uid: cur.UID.value,
            summary: unescapeText(cur.SUMMARY?.value ?? 'Event'),
            start,
            end: cur.DTEND ? parseDate(cur.DTEND.value, cur.DTEND.params) : null,
            location: cur.LOCATION ? unescapeText(cur.LOCATION.value) : null,
            description: cur.DESCRIPTION ? unescapeText(cur.DESCRIPTION.value) : null,
            status: cur.STATUS?.value ?? null,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = raw.indexOf(':');
    if (idx < 0) continue;
    const head = raw.slice(0, idx);
    const value = raw.slice(idx + 1);
    const [name, ...paramParts] = head.split(';');
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, v] = p.split('=');
      if (k && v) params[k] = v;
    }
    cur[name] = { value, params };
  }
  return out;
}

function unescapeText(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function parseDate(v: string, params: Record<string, string>): Date | null {
  // 20260914T163000Z | 20260914T093000 (with TZID) | 20260914 (all-day)
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh = '09', mm = '00', ss = '00', z] = m;
  if (z || params.VALUE === 'DATE') {
    return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss));
  }
  const tz = params.TZID ?? 'America/Los_Angeles';
  return zonedToUtc(+y, +mo - 1, +d, +hh, +mm, +ss, tz);
}

// Convert a wall-clock time in a named zone to UTC without a library.
function zonedToUtc(y: number, mo: number, d: number, hh: number, mm: number, ss: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, mo, d, hh, mm, ss));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(guess).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function classify(summary: string): 'game' | 'practice' | 'tournament' | 'other' {
  const s = summary.toLowerCase();
  if (/tournament|jamboree|showcase/.test(s)) return 'tournament';
  if (/game|match|\bvs\b|\bv\.?\b|@|scrimmage/.test(s)) return 'game';
  if (/practice|training|session/.test(s)) return 'practice';
  return 'other';
}

// deno-lint-ignore no-explicit-any
async function syncTeam(admin: any, team: { id: string; ics_url: string }) {
  try {
    const res = await fetch(team.ics_url, { headers: { 'User-Agent': 'HuddleUp/1.0 (+https://huddleup.app)' } });
    if (!res.ok) throw new Error(`Calendar returned ${res.status}`);
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link is not a calendar feed');
    const events = parseIcs(text);
    const horizonPast = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const rows = events
      .filter((e) => e.start.getTime() > horizonPast)
      .map((e) => ({
        team_id: team.id,
        external_uid: e.uid,
        source: 'ics',
        title: e.summary,
        type: classify(e.summary),
        starts_at: e.start.toISOString(),
        ends_at: e.end?.toISOString() ?? null,
        location_name: e.location,
        notes: e.description ? e.description.slice(0, 2000) : null,
        cancelled: e.status === 'CANCELLED' || /cancel/i.test(e.summary),
        updated_at: new Date().toISOString(),
      }));
    if (rows.length) {
      const { error } = await admin.from('events').upsert(rows, { onConflict: 'team_id,external_uid' });
      if (error) throw error;
    }
    // events that vanished from the feed are marked cancelled rather than deleted, so carpools stay visible
    const liveUids = new Set(rows.map((r) => r.external_uid));
    const { data: existing } = await admin.from('events').select('id, external_uid').eq('team_id', team.id).eq('source', 'ics').gte('starts_at', new Date().toISOString());
    // deno-lint-ignore no-explicit-any
    const gone = ((existing ?? []) as any[]).filter((e) => e.external_uid && !liveUids.has(e.external_uid)).map((e) => e.id);
    if (gone.length) await admin.from('events').update({ cancelled: true }).in('id', gone);
    await admin.from('teams').update({ ics_last_synced_at: new Date().toISOString(), ics_last_error: null }).eq('id', team.id);
    return { team_id: team.id, upserted: rows.length, cancelled: gone.length };
  } catch (e) {
    await admin.from('teams').update({ ics_last_error: (e as Error).message.slice(0, 300) }).eq('id', team.id);
    return { team_id: team.id, error: (e as Error).message };
  }
}

// The web build calls "Sync now" from a different origin, so the browser preflights first.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const authHeader = req.headers.get('Authorization') ?? '';

  if (body.team_id) {
    // caller must be staff on the team
    const user = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: me } = await user.auth.getUser();
    if (!me?.user) return new Response('Unauthorized', { status: 401, headers: CORS });
    const { data: membership } = await admin.from('team_members').select('role').eq('team_id', body.team_id).eq('profile_id', me.user.id).maybeSingle();
    if (!membership || !['manager', 'coach'].includes(membership.role)) return new Response('Only team staff can sync', { status: 403, headers: CORS });
    const { data: team } = await admin.from('teams').select('id, ics_url').eq('id', body.team_id).single();
    if (!team?.ics_url) return Response.json({ skipped: 'no ics_url' }, { headers: CORS });
    return Response.json(await syncTeam(admin, team as { id: string; ics_url: string }), { headers: CORS });
  }

  // Scheduled path: the hourly pg_cron job presents a token stored only in the database.
  const cronToken = req.headers.get('x-cron-token') ?? '';
  const { data: okCron } = cronToken ? await admin.rpc('check_cron_token', { p_token: cronToken }) : { data: false };
  if (!okCron && !authHeader.includes(SERVICE_KEY)) return new Response('Unauthorized', { status: 401, headers: CORS });
  const { data: teams } = await admin.from('teams').select('id, ics_url').not('ics_url', 'is', null);
  const results = [];
  for (const t of (teams ?? []) as { id: string; ics_url: string }[]) results.push(await syncTeam(admin, t));
  return Response.json({ synced: results.length, results }, { headers: CORS });
});

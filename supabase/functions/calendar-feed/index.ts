// Huddle Up · calendar-feed
// Serves one household's whole sports calendar as an .ics subscription.
// Auth is the unguessable token in the URL; rotate_ics_token() invalidates a leaked link.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function esc(s: string): string {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545 wants lines folded at 75 octets.
function fold(line: string): string {
  if (line.length <= 74) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    out.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') ?? url.pathname.split('/').pop();
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return new Response('Not found', { status: 404 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: household } = await admin.from('households').select('id, name').eq('ics_token', token).maybeSingle();
  if (!household) return new Response('Not found', { status: 404 });

  // Every team any adult in this household belongs to.
  const { data: members } = await admin.from('household_members').select('profile_id').eq('household_id', household.id);
  const ids = (members ?? []).map((m: { profile_id: string }) => m.profile_id);
  const { data: memberships } = await admin.from('team_members').select('team_id').in('profile_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  const teamIds = [...new Set((memberships ?? []).map((m: { team_id: string }) => m.team_id))];

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
  const { data: events } = teamIds.length
    ? await admin
        .from('events')
        .select('id, title, type, starts_at, ends_at, location_name, location_address, notes, cancelled, updated_at, team:teams(name, default_arrive_minutes)')
        .in('team_id', teamIds)
        .gte('starts_at', since)
        .order('starts_at')
    : { data: [] };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Huddle Up//Household Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(household.name)} sports`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];

  // deno-lint-ignore no-explicit-any
  for (const e of (events ?? []) as any[]) {
    const start = new Date(e.starts_at);
    const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 60 * 60000);
    const team = e.team?.name ?? 'Team';
    const arrive = e.team?.default_arrive_minutes ?? 30;
    const desc = [
      e.type === 'game' || e.type === 'tournament' ? `Arrive ${arrive} minutes early.` : null,
      e.notes ?? null,
      'Carpools and snack signups are in Huddle Up.',
    ]
      .filter(Boolean)
      .join('\n');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@huddleup.app`);
    lines.push(`DTSTAMP:${stamp(new Date(e.updated_at ?? Date.now()))}`);
    lines.push(`DTSTART:${stamp(start)}`);
    lines.push(`DTEND:${stamp(end)}`);
    lines.push(fold(`SUMMARY:${esc(`${team}: ${e.title}`)}`));
    if (e.location_name || e.location_address) {
      lines.push(fold(`LOCATION:${esc([e.location_name, e.location_address].filter(Boolean).join(', '))}`));
    }
    lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    lines.push(`STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-PT2H');
    lines.push('ACTION:DISPLAY');
    lines.push(fold(`DESCRIPTION:${esc(`${team}: ${e.title}`)}`));
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
      'Content-Disposition': 'inline; filename="huddle-up.ics"',
    },
  });
});

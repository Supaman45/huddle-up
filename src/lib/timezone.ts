/**
 * Converting a wall-clock time in a named zone to a real instant.
 *
 * A league schedule says "Sat 9/13 9:00 AM". That is a wall-clock time in the TEAM's zone,
 * not in the zone of whichever phone is pasting it, and not UTC. A coach on a work trip in
 * Denver pasting a Tacoma schedule must still create 9am Pacific games. Getting this wrong
 * shifts a whole season by an hour or three and nobody notices until a family shows up late.
 *
 * date-fns-tz is not installed and this is the only place that needs it, so this is the
 * two-pass Intl technique rather than a dependency.
 */

/** How far ahead of UTC the zone is, in ms, at a given instant. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl renders midnight as hour 24 in some engines; Date.UTC normalizes it either way.
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asIfUtc - utcMs;
}

/**
 * Turn a wall-clock time in `timeZone` into the instant it names.
 *
 * Two passes because the offset depends on the instant we are still solving for: the first
 * pass gets close, the second corrects it when the guess landed on the wrong side of a
 * daylight-saving boundary. On the spring-forward hour, which does not exist, this resolves
 * forward, the same as every calendar app.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const firstPass = naive - zoneOffsetMs(naive, timeZone);
    const corrected = naive - zoneOffsetMs(firstPass, timeZone);

    // On the spring-forward gap the requested wall clock does not exist, and the corrected
    // pass lands an hour BEFORE it rather than after. Checking that the answer renders back
    // to what was asked for is what distinguishes the two cases; when it does not, the
    // first pass is the forward resolution, which is what calendars do.
    if (naive - zoneOffsetMs(corrected, timeZone) !== corrected) return new Date(firstPass);
    return new Date(corrected);
  } catch {
    // A runtime without full Intl time-zone data. Falling back to the device's own zone is
    // wrong for a travelling coach, but the review screen shows every resulting time before
    // anything is saved, so a bad conversion is visible rather than silent.
    return new Date(year, month - 1, day, hour, minute);
  }
}

/** True when this runtime can actually resolve named zones, so callers can warn if not. */
export function supportsNamedZones(): boolean {
  try {
    const a = zoneOffsetMs(Date.UTC(2026, 0, 15), 'America/Los_Angeles');
    const b = zoneOffsetMs(Date.UTC(2026, 6, 15), 'America/Los_Angeles');
    // Pacific is -8 in January and -7 in July. If those match, the zone was ignored.
    return a !== b;
  } catch {
    return false;
  }
}

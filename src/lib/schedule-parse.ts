import type { EventType } from '@/lib/types';

/**
 * Reading a season out of whatever a coach has in hand.
 *
 * Most coaches do not have an .ics link. They have a league email, a PDF pasted into a text
 * box, or a copied spreadsheet, and re-typing thirty rows by hand is where a team gives up on
 * an app. This turns that paste into proposed events.
 *
 * Deliberately deterministic and pure. Every line either parses, with a confidence, or is
 * handed back unparsed for a human. Nothing here reaches the network or the clock except
 * through the `today` argument, so the tests fix time and are not flaky in December.
 */

export interface ParsedRow {
  /** 1-based line number in the pasted text, so the review screen can point at it. */
  line: number;
  raw: string;
  /** Wall-clock in the team's zone. Resolved to an instant later, by the caller. */
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  title: string;
  type: EventType;
  location: string | null;
  /** Low when the year was inferred or the line was unusual, so review can sort by it. */
  confidence: 'high' | 'low';
  /** Why confidence is low, in words a coach can act on. */
  note?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Lines that looked like content but had no date or no time. */
  skipped: { line: number; raw: string; reason: string }[];
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** M/D or M/D/Y, with a 2- or 4-digit year. */
function numericDate(s: string): { month: number; day: number; year?: number } | null {
  const m = s.match(/(?<!\d)(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?!\d)/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year: number | undefined;
  if (m[3]) {
    const y = Number(m[3]);
    year = y < 100 ? 2000 + y : y;
  }
  return { month, day, year };
}

/** "Sep 13", "September 13th", "13 Sep", each optionally followed by a year. */
function wordDate(s: string): { month: number; day: number; year?: number } | null {
  const monthFirst = s.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 4).toLowerCase()] ?? MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    const day = Number(monthFirst[2]);
    if (month && day >= 1 && day <= 31) return { month, day, year: monthFirst[3] ? Number(monthFirst[3]) : undefined };
  }
  const dayFirst = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?(?:,?\s*(\d{4}))?/i);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].slice(0, 4).toLowerCase()] ?? MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    const day = Number(dayFirst[1]);
    if (month && day >= 1 && day <= 31) return { month, day, year: dayFirst[3] ? Number(dayFirst[3]) : undefined };
  }
  return null;
}

/** "9:00 AM", "9am", "14:30". Returns 24-hour. */
function findTime(s: string): { hour: number; minute: number; matched: string } | null {
  const m = s.match(/(?<!\d)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] ? Number(m[2]) : 0;
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const pm = m[3].toLowerCase() === 'p';
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return { hour, minute, matched: m[0] };
  }
  // 24-hour, but only with a colon: a bare "1430" in a schedule is more likely a field number.
  const h24 = s.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (h24) return { hour: Number(h24[1]), minute: Number(h24[2]), matched: h24[0] };
  return null;
}

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/** The weekday the text NAMES, 0-6, if it names one. */
export function statedWeekday(text: string): number | null {
  const m = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\b/i);
  return m ? (DAY_NAMES[m[1].toLowerCase()] ?? null) : null;
}

/**
 * A schedule rarely states the year, and "9/13" in a list pasted in December means next year.
 * Choosing the nearest sensible season beats defaulting to the current year, which silently
 * files January games eleven months in the past.
 *
 * When the line also names a weekday, that decides it. "Sat 9/13" is a fact with a year
 * hidden inside: only some years have 13 September on a Saturday. Using it turns the single
 * most damaging failure this parser could have -- a whole season imported into the wrong
 * year -- into something the text itself rules out.
 */
function inferYear(month: number, day: number, today: Date, weekday: number | null): { year: number; matchedWeekday: boolean } {
  const floor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  floor.setDate(floor.getDate() - 45);

  const candidates: { year: number; distance: number; matches: boolean }[] = [];
  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1, today.getFullYear() + 2]) {
    const when = new Date(year, month - 1, day);
    if (when.getMonth() !== month - 1) continue; // 29 Feb in a common year
    if (when < floor) continue;
    candidates.push({ year, distance: when.getTime() - floor.getTime(), matches: weekday !== null && when.getDay() === weekday });
  }
  if (!candidates.length) return { year: today.getFullYear(), matchedWeekday: false };

  candidates.sort((a, b) => a.distance - b.distance);
  const onWeekday = candidates.find((c) => c.matches);
  if (onWeekday) return { year: onWeekday.year, matchedWeekday: true };
  return { year: candidates[0].year, matchedWeekday: false };
}

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function classify(text: string): EventType {
  const t = text.toLowerCase();
  if (/\b(tournament|tourney|cup|classic|showcase|jamboree)\b/.test(t)) return 'tournament';
  if (/\b(practice|training|session|skills)\b/.test(t)) return 'practice';
  if (/\b(vs\.?|v\.|versus|@|at)\b/.test(t) || /\bgame\b/.test(t)) return 'game';
  return 'other';
}

/** Split a residue into an opponent-or-title and a location, on the usual separators. */
function splitTitleAndLocation(residue: string): { title: string; location: string | null } {
  const cleaned = residue.replace(/\s{2,}/g, '  ').trim();

  // An explicit separator wins: "vs Red Robin @ Field 4", "Practice - Harry Todd Park".
  const atSplit = cleaned.match(/^(.*?)\s+(?:@|at)\s+(.+)$/i);
  if (atSplit && /\b(vs\.?|v\.|versus)\b/i.test(atSplit[1])) {
    return { title: tidy(atSplit[1]), location: tidy(atSplit[2]) || null };
  }
  const dashSplit = cleaned.split(/\s+[-–|]\s+/);
  if (dashSplit.length >= 2) {
    return { title: tidy(dashSplit[0]), location: tidy(dashSplit.slice(1).join(' ')) || null };
  }
  // Two or more spaces is how a copied table arrives.
  const columns = cleaned.split(/\s{2,}/).filter(Boolean);
  if (columns.length >= 2) {
    return { title: tidy(columns[0]), location: tidy(columns.slice(1).join(' ')) || null };
  }
  return { title: tidy(cleaned), location: null };
}

function tidy(s: string): string {
  return s
    .replace(/^[\s,;:|\-–]+/, '')
    .replace(/[\s,;:|\-–]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Lines that are plainly not events: rules, page numbers, column headers, the title across
 * the top of a league PDF.
 *
 * Deliberately narrow. Everything this does NOT catch and cannot parse is reported back to
 * the coach as a skipped line, because showing one extra line they can ignore costs nothing
 * and silently dropping a real game costs a family their Saturday.
 */
function isNoise(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return true;
  if (/^[-=_*·•\s|]+$/.test(t)) return true;
  if (/^page \b/i.test(t)) return true;
  // A column header: only header words, no digits. "vs" and "away" are excluded from this
  // list on purpose, because a real line often opens with them.
  if (/^(date|day|time|opponent|location|field|event)\b/i.test(t) && !/\d/.test(t)) return true;
  // A banner title: shouting, and carrying neither a date nor a time.
  if (t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !findTime(t) && !numericDate(t) && !wordDate(t)) return true;
  return false;
}

// Longest first, or "sat" consumes the start of "Saturday" and leaves "urday" behind.
const WEEKDAYS = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat|sun)\.?\b/gi;

/**
 * Parse pasted schedule text into proposed events.
 *
 * `today` is injected so the year inference is testable and the tests do not rot.
 */
export function parseSchedule(text: string, opts: { today?: Date; defaultTitle?: string } = {}): ParseResult {
  const today = opts.today ?? new Date();
  const rows: ParsedRow[] = [];
  const skipped: ParseResult['skipped'] = [];

  // A copied table sometimes arrives tab-separated on one line per row; both are handled by
  // treating each physical line as one candidate event.
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const line = i + 1;
    const raw = rawLine.replace(/\t/g, '  ').trimEnd();
    if (!raw.trim() || isNoise(raw)) return;

    const date = numericDate(raw) ?? wordDate(raw);
    if (!date) {
      skipped.push({ line, raw: raw.trim(), reason: 'No date on this line' });
      return;
    }
    const time = findTime(raw);
    if (!time) {
      skipped.push({ line, raw: raw.trim(), reason: 'No start time on this line' });
      return;
    }

    const weekday = statedWeekday(raw);
    let year = date.year;
    let note: string | undefined;
    let confidence: ParsedRow['confidence'] = 'high';

    if (!year) {
      const inferred = inferYear(date.month, date.day, today, weekday);
      year = inferred.year;
      if (inferred.matchedWeekday) {
        // The named weekday pinned the year, which is as good as the text stating it.
        confidence = 'high';
      } else {
        confidence = 'low';
        note = `Year not in the text, read as ${year}`;
      }
    }

    // Whether the year came from the text or from us, a weekday that disagrees means one of
    // them is wrong. Saying which is more useful than silently picking a side.
    if (weekday !== null) {
      const actual = new Date(year, date.month - 1, date.day).getDay();
      if (actual !== weekday) {
        confidence = 'low';
        const said = DAY_LABEL[weekday];
        const is = DAY_LABEL[actual];
        note = `Text says ${said}, but ${date.month}/${date.day}/${year} is a ${is}`;
      }
    }

    // Everything that is not the date, the time or a weekday name is the description.
    let residue = raw;
    const dateMatch = raw.match(/(?<!\d)\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?!\d)/);
    if (dateMatch) residue = residue.replace(dateMatch[0], ' ');
    else residue = residue.replace(/\b[a-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?/i, ' ');
    residue = residue.replace(time.matched, ' ').replace(WEEKDAYS, ' ');

    const type = classify(raw);
    const { title, location } = splitTitleAndLocation(residue);
    const finalTitle = title || opts.defaultTitle || (type === 'practice' ? 'Practice' : 'Game');
    if (!title) {
      confidence = 'low';
      note = note ? `${note}. No opponent or name found` : 'No opponent or name found';
    }

    rows.push({ line, raw: raw.trim(), year, month: date.month, day: date.day, hour: time.hour, minute: time.minute, title: finalTitle, type, location, confidence, note });
  });

  return { rows, skipped };
}

/** Default length in minutes, so a coach is not asked about every row. */
export function defaultMinutes(type: EventType): number {
  return type === 'game' ? 90 : type === 'tournament' ? 240 : 60;
}

/**
 * Does this proposed row already exist on the schedule?
 *
 * Pasting the same email twice is the normal way to double-book a season, and a coach who
 * has to spot duplicates by eye will not. Same day and same start minute is the match: an
 * identical title is not required, because leagues rename opponents between emails.
 */
export function findDuplicate<T extends { starts_at: string; title: string }>(
  candidateStartsAt: Date,
  existing: T[],
): T | undefined {
  const at = candidateStartsAt.getTime();
  return existing.find((e) => Math.abs(new Date(e.starts_at).getTime() - at) < 60_000);
}

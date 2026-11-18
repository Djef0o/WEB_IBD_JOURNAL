import { daysInMonth, dateParts, dateTimeParts, type LocalDateTime } from '../domain/time';
import type { RepeatUnit } from '../domain/profile';

/*
 * iCalendar (RFC 5545) writer for the `.ics` export that replaces the phone-calendar sync of
 * the Android app (`CalendarSync.kt`, `PhoneCalendar.kt`). Pure: no DOM, no i18n, no clock; the
 * caller provides texts, the time zone and the export instant.
 *
 * Event times are the app's local wall-clock times, written with `TZID=<IANA zone of the
 * user>`; a VTIMEZONE built from `Intl` accompanies them so that every calendar app places
 * them identically.
 */

const CRLF = '\r\n';

/** One event of the export. `repeatUnit` ONCE: a single event, otherwise a series. */
export interface IcsEvent {
  /** Stable identifier ("dose:12"): importing the file again updates the same events. */
  key: string;
  start: LocalDateTime;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
  title: string;
  description: string;
  /** The alert goes off this many minutes before `start` (0: at the time of the event). */
  alarmMinutesBefore: number;
}

export interface IcsOptions {
  /** IANA zone of the user ("Europe/Paris"). */
  timeZone: string;
  /** Moment of the export, in epoch milliseconds (DTSTAMP, SEQUENCE). */
  exportedAt: number;
  calendarName: string;
}

/** Same duration as the events the Android app creates in the phone calendar. */
export const EVENT_DURATION = 'PT15M';

// --- Text ---

/** Escapes a TEXT value (RFC 5545 §3.3.11): backslash, semicolon, comma, line breaks. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * Folds a content line at 75 octets (RFC 5545 §3.1): each continuation starts with one space,
 * which counts toward the 75 octets. Never cuts a UTF-8 sequence. Returns the lines joined by CRLF.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > limit) {
      parts.push(current);
      current = ' ';
      size = 1;
      limit = 75;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join(CRLF);
}

// --- Dates ---

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** "20261204T093000": local date-time, form 1 of RFC 5545 §3.3.5. */
export function icsLocal(value: LocalDateTime): string {
  const p = dateTimeParts(value);
  return `${pad(p.year, 4)}${pad(p.month)}${pad(p.day)}T${pad(p.hour)}${pad(p.minute)}${pad(p.second)}`;
}

/** "20261118T101500Z": UTC date-time (DTSTAMP). */
export function icsUtc(epochMillis: number): string {
  const d = new Date(epochMillis);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// --- Recurrence ---

/**
 * RRULE of a series, or null for a one-off event.
 *
 * Months are counted from the start date, like the app's reminders. A series starting on the
 * 29th, 30th or 31st falls on the last day of shorter months in the app; a plain
 * `FREQ=MONTHLY` would skip those months, so those series use `BYMONTHDAY=28..start day` with
 * `BYSETPOS=-1` (the last day of that range that exists in the month).
 */
export function rrule(unit: RepeatUnit, repeatEvery: number, start: LocalDateTime): string | null {
  if (unit === 'ONCE') return null;
  const interval = Math.max(Math.trunc(repeatEvery), 1);
  const freq = unit === 'DAY' ? 'DAILY' : unit === 'WEEK' ? 'WEEKLY' : 'MONTHLY';
  let rule = `FREQ=${freq};INTERVAL=${interval}`;
  if (unit === 'MONTH') {
    const { day } = dateParts(start.slice(0, 10));
    if (day >= 29) {
      const days = Array.from({ length: day - 27 }, (_, i) => 28 + i);
      rule += `;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
    }
  }
  return rule;
}

// --- Time zone ---

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Offset from UTC, in minutes, of `timeZone` at the instant `epochMillis`. */
export function utcOffsetMinutes(timeZone: string, epochMillis: number): number {
  const parts: Record<string, number> = {};
  for (const p of zoneFormatter(timeZone).formatToParts(epochMillis)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const wall = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour! % 24, parts.minute!, parts.second!);
  return Math.round((wall - Math.floor(epochMillis / 1000) * 1000) / 60_000);
}

/** "+0200" / "-0430" (TZOFFSETFROM / TZOFFSETTO). */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

interface Transition {
  /** First instant with the new offset. */
  at: number;
  from: number;
  to: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Offset changes (daylight saving time…) of `timeZone` during `year`, minute-accurate. */
export function transitionsIn(timeZone: string, year: number): Transition[] {
  const result: Transition[] = [];
  const end = Date.UTC(year + 1, 0, 1);
  let day = Date.UTC(year, 0, 1);
  let offset = utcOffsetMinutes(timeZone, day);
  for (; day < end; day += DAY) {
    const nextDay = Math.min(day + DAY, end);
    const nextOffset = utcOffsetMinutes(timeZone, nextDay);
    if (nextOffset === offset) continue;
    // Binary search for the first minute whose offset differs from `offset`.
    let low = day;
    let high = nextDay;
    while (high - low > MINUTE) {
      const mid = low + Math.floor((high - low) / 2 / MINUTE) * MINUTE;
      if (utcOffsetMinutes(timeZone, mid) === offset) low = mid;
      else high = mid;
    }
    const to = utcOffsetMinutes(timeZone, high);
    result.push({ at: high, from: offset, to });
    offset = to;
    // `nextDay` may already be past a second change inside the same day (never happens in the tz database).
    if (utcOffsetMinutes(timeZone, nextDay) !== to) offset = utcOffsetMinutes(timeZone, nextDay);
  }
  return result;
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

/** Recurrence of a yearly offset change, e.g. "FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU". */
function transitionRule(wallDate: Date): string {
  const month = wallDate.getUTCMonth() + 1;
  const day = wallDate.getUTCDate();
  const weekday = WEEKDAYS[wallDate.getUTCDay()]!;
  const ordinal = day + 7 > daysInMonth(wallDate.getUTCFullYear(), month) ? -1 : Math.ceil(day / 7);
  return `FREQ=YEARLY;BYMONTH=${month};BYDAY=${ordinal}${weekday}`;
}

/**
 * VTIMEZONE of `timeZone` from the offsets `Intl` reports in `year` (the earliest year of the
 * events): one STANDARD/DAYLIGHT component per yearly offset change, repeating every year, or a
 * single fixed STANDARD component for a zone without changes. Content lines, unfolded.
 */
export function vtimezoneLines(timeZone: string, year: number): string[] {
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`];
  const changes = transitionsIn(timeZone, year);
  if (changes.length === 0) {
    const offset = formatOffset(utcOffsetMinutes(timeZone, Date.UTC(year, 0, 1)));
    lines.push('BEGIN:STANDARD', 'DTSTART:19700101T000000', `TZOFFSETFROM:${offset}`, `TZOFFSETTO:${offset}`, 'END:STANDARD');
  }
  for (const change of changes) {
    // Local time just before the change, in the old offset.
    const wall = new Date(change.at + change.from * MINUTE);
    const local = `${pad(wall.getUTCFullYear(), 4)}${pad(wall.getUTCMonth() + 1)}${pad(wall.getUTCDate())}`
      + `T${pad(wall.getUTCHours())}${pad(wall.getUTCMinutes())}00`;
    const component = change.to > change.from ? 'DAYLIGHT' : 'STANDARD';
    lines.push(
      `BEGIN:${component}`,
      `DTSTART:${local}`,
      `TZOFFSETFROM:${formatOffset(change.from)}`,
      `TZOFFSETTO:${formatOffset(change.to)}`,
      `RRULE:${transitionRule(wall)}`,
      `END:${component}`,
    );
  }
  lines.push('END:VTIMEZONE');
  return lines;
}

// --- Calendar ---

/** UID of an event: stable across exports (domain: not an email address, only an identifier). */
export function eventUid(key: string): string {
  return `${key.replace(/:/g, '-')}@ibd-journal`;
}

function eventLines(event: IcsEvent, options: IcsOptions): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${eventUid(event.key)}`,
    `DTSTAMP:${icsUtc(options.exportedAt)}`,
    // A newer export must replace the events of the previous one in the calendar.
    `SEQUENCE:${Math.floor(options.exportedAt / MINUTE)}`,
    `DTSTART;TZID=${options.timeZone}:${icsLocal(event.start)}`,
    `DURATION:${EVENT_DURATION}`,
  ];
  const rule = rrule(event.repeatUnit, event.repeatEvery, event.start);
  if (rule !== null) lines.push(`RRULE:${rule}`);
  lines.push(
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    `TRIGGER:${event.alarmMinutesBefore > 0 ? `-PT${event.alarmMinutesBefore}M` : 'PT0S'}`,
    'END:VALARM',
    'END:VEVENT',
  );
  return lines;
}

/** The whole `.ics` document: CRLF line ends, lines folded at 75 octets, final CRLF. */
export function buildIcs(events: readonly IcsEvent[], options: IcsOptions): string {
  const firstYear = events.length === 0
    ? new Date(options.exportedAt).getUTCFullYear()
    : Math.min(...events.map((e) => dateParts(e.start.slice(0, 10)).year));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IBD Journal//Web//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
    `X-WR-TIMEZONE:${options.timeZone}`,
    ...vtimezoneLines(options.timeZone, firstYear),
    ...events.flatMap((event) => eventLines(event, options)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

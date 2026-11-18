import { describe, expect, it } from 'vitest';
import {
  buildIcs, escapeText, eventUid, foldLine, formatOffset, icsLocal, icsUtc, rrule, transitionsIn, utcOffsetMinutes,
  vtimezoneLines, type IcsEvent,
} from '../src/reminders/ics';

const octets = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replace(/\r\n /g, '');

const base: IcsEvent = {
  key: 'dose:12',
  start: '2026-12-04T09:30',
  repeatEvery: 1,
  repeatUnit: 'DAY',
  title: 'Take Mesalazine · 2 g',
  description: 'Reminder added by IBD Journal.',
  alarmMinutesBefore: 0,
};
const options = { timeZone: 'Europe/Paris', exportedAt: Date.UTC(2026, 10, 18, 10, 15, 0), calendarName: 'IBD Journal' };

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and line breaks', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
  it('leaves accents and quotes alone', () => {
    expect(escapeText('Prise de sang « CRP » à jeun')).toBe('Prise de sang « CRP » à jeun');
  });
});

describe('foldLine', () => {
  it('keeps short lines as they are', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds at 75 octets with a leading space on continuations, and unfolds to the original', () => {
    const line = `DESCRIPTION:${'x'.repeat(200)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(2);
    for (const part of parts) expect(octets(part)).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) expect(part.startsWith(' ')).toBe(true);
    expect(unfold(folded)).toBe(line);
  });

  it('never cuts a multi-byte character', () => {
    const line = `SUMMARY:${'é'.repeat(80)}${'😀'.repeat(20)}`;
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) {
      expect(octets(part)).toBeLessThanOrEqual(75);
      expect(part).not.toContain('\uFFFD');
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe('rrule', () => {
  it('has no rule for a one-off event', () => {
    expect(rrule('ONCE', 1, '2026-12-04T09:30')).toBeNull();
  });

  it.each([
    ['DAY', 1, 'FREQ=DAILY;INTERVAL=1'],
    ['DAY', 3, 'FREQ=DAILY;INTERVAL=3'],
    ['WEEK', 2, 'FREQ=WEEKLY;INTERVAL=2'],
    ['MONTH', 1, 'FREQ=MONTHLY;INTERVAL=1'],
    ['MONTH', 6, 'FREQ=MONTHLY;INTERVAL=6'],
  ] as const)('%s every %i', (unit, every, expected) => {
    expect(rrule(unit, every, '2026-12-15T08:00')).toBe(expected);
  });

  it('treats an interval below 1 as 1 (as the app does)', () => {
    expect(rrule('WEEK', 0, '2026-12-15T08:00')).toBe('FREQ=WEEKLY;INTERVAL=1');
  });

  it('keeps the last day of short months for a monthly series starting on the 29th, 30th or 31st', () => {
    expect(rrule('MONTH', 1, '2026-01-31T08:00')).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(rrule('MONTH', 2, '2026-01-30T08:00')).toBe('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29,30;BYSETPOS=-1');
    expect(rrule('MONTH', 1, '2026-01-29T08:00')).toBe('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=28,29;BYSETPOS=-1');
    expect(rrule('MONTH', 1, '2026-01-28T08:00')).toBe('FREQ=MONTHLY;INTERVAL=1');
  });
});

describe('date formats', () => {
  it('formats local and UTC date-times', () => {
    expect(icsLocal('2026-12-04T09:30')).toBe('20261204T093000');
    expect(icsLocal('2026-12-04T09:30:15')).toBe('20261204T093015');
    expect(icsUtc(Date.UTC(2026, 10, 18, 10, 15, 0))).toBe('20261118T101500Z');
    expect(formatOffset(120)).toBe('+0200');
    expect(formatOffset(-270)).toBe('-0430');
  });
});

describe('time zones', () => {
  it('reads offsets and transitions from Intl', () => {
    expect(utcOffsetMinutes('Europe/Paris', Date.UTC(2026, 0, 15))).toBe(60);
    expect(utcOffsetMinutes('Europe/Paris', Date.UTC(2026, 6, 15))).toBe(120);
    const changes = transitionsIn('Europe/Paris', 2026);
    expect(changes.map((c) => [c.from, c.to])).toEqual([[60, 120], [120, 60]]);
    expect(new Date(changes[0]!.at).toISOString()).toBe('2026-03-29T01:00:00.000Z');
    expect(transitionsIn('Asia/Tokyo', 2026)).toEqual([]);
  });

  it('writes a VTIMEZONE with yearly rules (Europe/Paris)', () => {
    expect(vtimezoneLines('Europe/Paris', 2026)).toEqual([
      'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT', 'DTSTART:20260329T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'DTSTART:20261025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
      'END:VTIMEZONE',
    ]);
  });

  it('uses "nth weekday" rules where the zone does (America/New_York)', () => {
    const lines = vtimezoneLines('America/New_York', 2026);
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    expect(lines).toContain('TZOFFSETFROM:-0500');
    expect(lines).toContain('TZOFFSETTO:-0400');
  });

  it('writes a single fixed component for a zone without daylight saving time', () => {
    expect(vtimezoneLines('Asia/Tokyo', 2026)).toEqual([
      'BEGIN:VTIMEZONE', 'TZID:Asia/Tokyo',
      'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'END:STANDARD',
      'END:VTIMEZONE',
    ]);
  });
});

describe('buildIcs', () => {
  const events: IcsEvent[] = [
    base,
    {
      key: 'exam:3', start: '2026-12-04T09:30', repeatEvery: 1, repeatUnit: 'ONCE',
      title: 'Colonoscopy · Parc Clinic, Dr; Martin', description: 'Reminder added by IBD Journal.',
      alarmMinutesBefore: 120,
    },
    { ...base, key: 'refill:12', start: '2026-12-28T08:00', repeatEvery: 2, repeatUnit: 'MONTH', title: 'x'.repeat(150) },
  ];
  const text = buildIcs(events, options);

  it('uses CRLF everywhere and ends with a line break', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('never has a line longer than 75 octets', () => {
    for (const line of text.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it('has the calendar structure, VTIMEZONE and the events', () => {
    const lines = unfold(text).split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(3);
    expect(lines.filter((l) => l === 'END:VEVENT')).toHaveLength(3);
    expect(lines).toContain('TZID:Europe/Paris');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
  });

  it('writes a recurring dose with its rule, local time in the user zone, alarm and stable UID', () => {
    const lines = unfold(text).split('\r\n');
    expect(lines).toContain('UID:dose-12@ibd-journal');
    expect(lines).toContain('DTSTAMP:20261118T101500Z');
    expect(lines).toContain('DTSTART;TZID=Europe/Paris:20261204T093000');
    expect(lines).toContain('RRULE:FREQ=DAILY;INTERVAL=1');
    expect(lines).toContain('SUMMARY:Take Mesalazine · 2 g');
    expect(lines).toContain('TRIGGER:PT0S');
  });

  it('escapes text and gives appointments a lead alarm; one-off events have no RRULE', () => {
    const lines = unfold(text).split('\r\n');
    const start = lines.indexOf('UID:exam-3@ibd-journal');
    const exam = lines.slice(start, lines.indexOf('END:VEVENT', start));
    expect(exam).toContain('SUMMARY:Colonoscopy · Parc Clinic\\, Dr\\; Martin');
    expect(exam).toContain('TRIGGER:-PT120M');
    expect(exam.some((l) => l.startsWith('RRULE'))).toBe(false);
  });

  it('keeps UIDs stable between exports and changes SEQUENCE so the calendar updates the events', () => {
    const later = buildIcs(events, { ...options, exportedAt: options.exportedAt + 3_600_000 });
    const uids = (s: string) => unfold(s).split('\r\n').filter((l) => l.startsWith('UID:'));
    expect(uids(later)).toEqual(uids(text));
    expect(later).not.toBe(text);
    expect(eventUid('exam_prep_first:4')).toBe('exam_prep_first-4@ibd-journal');
  });

  it('is a valid empty calendar without events', () => {
    const empty = buildIcs([], options);
    expect(empty).toContain('BEGIN:VCALENDAR');
    expect(empty).not.toContain('VEVENT');
  });
});

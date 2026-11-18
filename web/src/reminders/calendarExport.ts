import { checkupEvent, doseEvent, examEvents, refillEvent, type CalendarEventSpec } from '../domain/calendarEvents';
import { APPOINTMENT_REMINDER_LEAD_MINUTES, EXAM_STEPS } from '../domain/examPlan';
import type { LocalDateTime } from '../domain/time';
import { t } from '../i18n';
import { buildIcs, type IcsEvent } from './ics';
import type { ReminderData } from './schedule';
import { checkupTitle, doseText, examStepTitle } from './text';

/** Kinds notified ahead of time: appointments leave time to get there (`stepReminderAt`). */
const APPOINTMENTS: ReadonlySet<string> = new Set(['EXAM_ANESTHESIA', 'EXAM']);

function toIcsEvent(spec: CalendarEventSpec, title: string): IcsEvent {
  return {
    key: spec.key,
    start: spec.start,
    repeatEvery: spec.repeatEvery,
    repeatUnit: spec.repeatUnit,
    title,
    description: t('calendar_event_description'),
    alarmMinutesBefore: APPOINTMENTS.has(spec.kind) ? APPOINTMENT_REMINDER_LEAD_MINUTES : 0,
  };
}

/**
 * Events of the export: doses, reorder alerts, checkups and exam steps whose reminder is on
 * (same events as `CalendarSync`). A one-off event already past is left out: the file is
 * imported once, a past appointment would only add noise to the calendar.
 */
export function exportEvents(data: ReminderData, now: LocalDateTime): IcsEvent[] {
  const events: IcsEvent[] = [];
  for (const medication of data.medications) {
    const dose = doseEvent(medication);
    if (dose) events.push(toIcsEvent(dose, doseText(medication)));
    const refill = refillEvent(medication);
    if (refill) events.push(toIcsEvent(refill, t('calendar_refill_title', [medication.name])));
  }
  for (const checkup of data.checkups) {
    const spec = checkupEvent(checkup);
    if (spec) events.push(toIcsEvent(spec, checkupTitle(checkup)));
  }
  for (const exam of data.exams) {
    const specs = examEvents(exam);
    for (const step of EXAM_STEPS) {
      const spec = specs[step];
      if (spec) events.push(toIcsEvent(spec, examStepTitle(exam, step)));
    }
  }
  return events
    .filter((e) => e.repeatUnit !== 'ONCE' || e.start >= now)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.key < b.key ? -1 : 1));
}

/** The `.ics` text for the user's agenda; `count` is the number of events (0: nothing to export). */
export function buildCalendarFile(
  data: ReminderData, now: LocalDateTime, exportedAt: number, timeZone: string,
): { text: string; count: number } {
  const events = exportEvents(data, now);
  const text = buildIcs(events, { timeZone, exportedAt, calendarName: t('app_name') });
  return { text, count: events.length };
}

import { APPOINTMENT_EVENING_HOUR } from '../domain/appointmentReminders';
import {
  appointmentEvent, checkupEvent, doseEvent, examEvents, refillEvent, vaccineEvent, weighInEvent,
  type CalendarEventSpec,
} from '../domain/calendarEvents';
import { APPOINTMENT_REMINDER_LEAD_MINUTES, EXAM_STEPS } from '../domain/examPlan';
import { dateTimeParts, type LocalDateTime } from '../domain/time';
import { VACCINE_REMINDER_LEAD_DAYS } from '../domain/vaccineReminders';
import { t } from '../i18n';
import { APPOINTMENT_KIND_LABEL } from '../ui/care/appointments/appointmentLabels';
import { VACCINE_TYPE_LABEL } from '../ui/care/vaccinations/vaccineLabels';
import { buildIcs, type IcsEvent } from './ics';
import type { ReminderData } from './schedule';
import { checkupTitle, doseText, examStepTitle } from './text';

/** Kinds notified ahead of time: appointments leave time to get there (`stepReminderAt`). */
const APPOINTMENTS: ReadonlySet<string> = new Set(['EXAM_ANESTHESIA', 'EXAM', 'APPOINTMENT']);

const MINUTES_PER_DAY = 24 * 60;

function toIcsEvent(spec: CalendarEventSpec, title: string, extraAlarmsMinutesBefore: readonly number[] = []): IcsEvent {
  return {
    key: spec.key,
    start: spec.start,
    repeatEvery: spec.repeatEvery,
    repeatUnit: spec.repeatUnit,
    title,
    description: t('calendar_event_description'),
    alarmMinutesBefore: APPOINTMENTS.has(spec.kind) ? APPOINTMENT_REMINDER_LEAD_MINUTES : 0,
    extraAlarmsMinutesBefore,
  };
}

/** Minutes between the evening-before reminder of an appointment (wall clock) and the appointment. */
function eveningLeadMinutes(at: LocalDateTime): number {
  const { hour, minute } = dateTimeParts(at);
  return MINUTES_PER_DAY + hour * 60 + minute - APPOINTMENT_EVENING_HOUR * 60;
}

/**
 * Events of the export: doses, reorder alerts, checkups, exam steps, vaccines, appointments and
 * the weekly weigh-in, whose reminder is on (the events of `CalendarSync`, plus vaccines,
 * appointments and weigh-ins: once the app is closed, the calendar is the only reminder on the
 * web). Vaccines alert a week before and on the day, appointments the evening before and 2 h
 * before, as the app's reminders do. A one-off event already past is left out: the file is
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
  for (const vaccination of data.vaccinations) {
    const spec = vaccineEvent(vaccination);
    if (spec) {
      events.push(toIcsEvent(
        spec,
        `${t('vaccine_reminder_title')} · ${VACCINE_TYPE_LABEL[vaccination.type]()}`,
        [VACCINE_REMINDER_LEAD_DAYS * MINUTES_PER_DAY],
      ));
    }
  }
  for (const appointment of data.appointments) {
    const spec = appointmentEvent(appointment);
    if (spec) {
      events.push(toIcsEvent(
        spec,
        `${t('appointment_reminder_title')} · ${APPOINTMENT_KIND_LABEL[appointment.kind]()}`,
        [eveningLeadMinutes(appointment.at)],
      ));
    }
  }
  const weighIn = weighInEvent(data.weighIn, now);
  if (weighIn) events.push(toIcsEvent(weighIn, t('weigh_in_title')));
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

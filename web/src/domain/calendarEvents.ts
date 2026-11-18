import { EXAM_STEPS, examSteps, type ExamStep } from './examPlan';
import type { Exam } from './models';
import {
  REFILL_LEAD_DAYS, refillBasis,
  type Checkup, type Medication, type ReminderSchedule, type RepeatUnit,
} from './profile';
import { atTime, minusDays, type LocalDateTime } from './time';

/** Calendar event type, one stable key per app item. */
export const CALENDAR_EVENT_KINDS = [
  'DOSE', 'REFILL', 'CHECKUP',
  // Exam steps: a series of one-off events per exam.
  'EXAM_ANESTHESIA', 'EXAM_DIET', 'EXAM_PREP_FIRST', 'EXAM_PREP_SECOND', 'EXAM',
] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

/**
 * Calendar event derived from a reminder, platform-independent (`.ics` export).
 * `repeatUnit` ONCE = one-off event.
 */
export interface CalendarEventSpec {
  kind: CalendarEventKind;
  itemId: number;
  start: LocalDateTime;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
  /** Stable identifier of the item ("dose:12"), to find the created event again. */
  key: string;
}

export function calendarEventKey(kind: CalendarEventKind, itemId: number): string {
  return `${kind.toLowerCase()}:${itemId}`;
}

function eventSpec(
  kind: CalendarEventKind, itemId: number, start: LocalDateTime, repeatEvery: number, repeatUnit: RepeatUnit,
): CalendarEventSpec {
  return { kind, itemId, start, repeatEvery, repeatUnit, key: calendarEventKey(kind, itemId) };
}

function scheduleEvent(
  schedule: ReminderSchedule, kind: CalendarEventKind, itemId: number, shiftDays = 0,
): CalendarEventSpec {
  return eventSpec(
    kind,
    itemId,
    atTime(minusDays(schedule.startDate, shiftDays), schedule.hour, schedule.minute),
    Math.max(schedule.repeatEvery, 1),
    schedule.repeatUnit,
  );
}

/** Dose event, only if the reminder is enabled. */
export function doseEvent(med: Medication): CalendarEventSpec | null {
  return med.schedule.enabled ? scheduleEvent(med.schedule, 'DOSE', med.id) : null;
}

/**
 * "Order" event: series shifted REFILL_LEAD_DAYS days before the doses, or a
 * one-off event before the stock runs out. Same rule as `nextRefillAlert`.
 */
export function refillEvent(med: Medication): CalendarEventSpec | null {
  if (!med.refillAlert) return null;
  if (refillBasis(med) === 'BEFORE_DOSE') return scheduleEvent(med.schedule, 'REFILL', med.id, REFILL_LEAD_DAYS);
  if (med.stockEndDate === null) return null;
  return eventSpec(
    'REFILL',
    med.id,
    atTime(minusDays(med.stockEndDate, REFILL_LEAD_DAYS), med.schedule.hour, med.schedule.minute),
    1,
    'ONCE',
  );
}

/** Checkup event (blood test, stool test), if the reminder is enabled. */
export function checkupEvent(checkup: Checkup): CalendarEventSpec | null {
  return checkup.schedule.enabled ? scheduleEvent(checkup.schedule, 'CHECKUP', checkup.id) : null;
}

/** Calendar event type for each exam step. */
export const EXAM_STEP_CALENDAR_KIND: Readonly<Record<ExamStep, CalendarEventKind>> = {
  ANESTHESIA: 'EXAM_ANESTHESIA',
  DIET: 'EXAM_DIET',
  PREP_FIRST: 'EXAM_PREP_FIRST',
  PREP_SECOND: 'EXAM_PREP_SECOND',
  EXAM: 'EXAM',
};

/**
 * Event for each exam step, at the step's time (the calendar notifies by itself);
 * null for a missing step or when the exam's reminders are off.
 */
export function examEvents(exam: Exam): Record<ExamStep, CalendarEventSpec | null> {
  const byStep = new Map(exam.remindersEnabled ? examSteps(exam).map((s) => [s.step, s]) : []);
  return Object.fromEntries(
    EXAM_STEPS.map((step) => {
      const found = byStep.get(step);
      return [step, found ? eventSpec(EXAM_STEP_CALENDAR_KIND[step], exam.id, found.at, 1, 'ONCE') : null];
    }),
  ) as Record<ExamStep, CalendarEventSpec | null>;
}

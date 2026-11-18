import type { Exam, ExamType } from './models';
import { atLocalTime, minusDays, plusMinutes, dateOf, type LocalDate, type LocalDateTime, type LocalTime } from './time';

/** Steps of an exam, in the order they usually occur. */
export const EXAM_STEPS = ['ANESTHESIA', 'DIET', 'PREP_FIRST', 'PREP_SECOND', 'EXAM'] as const;
export type ExamStep = (typeof EXAM_STEPS)[number];

/** Dated step of an exam: `at` time of the step (diet start: the morning). */
export interface ExamStepTime {
  step: ExamStep;
  at: LocalDateTime;
}

/** The low-residue diet starts that day, reminder in the morning. */
export const DIET_REMINDER_TIME: LocalTime = '08:00';

/** Reminder for an appointment (exam, anesthesiologist): before the time, leaving time to get there (2 h). */
export const APPOINTMENT_REMINDER_LEAD_MINUTES = 120;

/** First day of the low-residue diet, or null with no diet. */
export function dietStart(exam: Exam): LocalDate | null {
  return exam.dietDays > 0 ? minusDays(dateOf(exam.at), exam.dietDays) : null;
}

/** All filled-in steps, in chronological order. */
export function examSteps(exam: Exam): ExamStepTime[] {
  const diet = dietStart(exam);
  const steps: ExamStepTime[] = [];
  if (exam.anesthesiaAt !== null) steps.push({ step: 'ANESTHESIA', at: exam.anesthesiaAt });
  if (diet !== null) steps.push({ step: 'DIET', at: atLocalTime(diet, DIET_REMINDER_TIME) });
  if (exam.prepFirstAt !== null) steps.push({ step: 'PREP_FIRST', at: exam.prepFirstAt });
  if (exam.prepSecondAt !== null) steps.push({ step: 'PREP_SECOND', at: exam.prepSecondAt });
  steps.push({ step: 'EXAM', at: exam.at });
  return steps.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Notification time of a step: before an appointment, on time for the rest. */
export function stepReminderAt(step: ExamStepTime): LocalDateTime {
  switch (step.step) {
    case 'ANESTHESIA':
    case 'EXAM':
      // Clock arithmetic, independent of time changes: we stay in local time.
      return plusMinutes(step.at, -APPOINTMENT_REMINDER_LEAD_MINUTES);
    case 'DIET':
    case 'PREP_FIRST':
    case 'PREP_SECOND':
      return step.at;
  }
}

/** A colonoscopy is done under anesthesia: the consultation must be planned. */
export function needsAnesthesia(type: ExamType): boolean {
  return type === 'COLONOSCOPY';
}

/** Anesthesia consultation to schedule (colonoscopy with no fixed appointment). */
export function anesthesiaMissing(exam: Exam): boolean {
  return needsAnesthesia(exam.type) && exam.anesthesiaAt === null;
}

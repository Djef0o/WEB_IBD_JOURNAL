import type { ExamStep, ExamStepTime } from '../domain/examPlan';
import type { Exam, ExamType } from '../domain/models';
import {
  nextOccurrence, refillBasis, type Checkup, type CheckupType, type Medication, type ReminderSchedule,
} from '../domain/profile';
import { dateOf, dateTimeParts, type LocalDate, type LocalDateTime } from '../domain/time';
import { lang, t, tp } from '../i18n';
import { formatLocalDate, formatTime } from '../ui/format';
import type { ReminderItem } from './schedule';
import type { Appointment, VaccineType } from '../domain/care';
import { APPOINTMENT_KIND_LABEL } from '../ui/care/appointments/appointmentLabels';
import { VACCINE_TYPE_LABEL } from '../ui/care/vaccinations/vaccineLabels';

/*
 * Texts of the reminders (notifications, `.ics` events, "to do today" card). Same wording as
 * `NotificationHelper`, `TreatmentReminderScheduler`, `ExamReminderText` and `CalendarSync`.
 */

const WEEKDAY_DAY_MONTH: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };

/** "lundi 30 novembre", for use inside a sentence (`weekdayDayMonthInline`). */
export function weekdayDayMonthInline(date: LocalDate): string {
  return formatLocalDate(date, WEEKDAY_DAY_MONTH);
}

/** "Lundi 30 novembre" / "Monday, November 30" (`weekdayDayMonth`). */
export function weekdayDayMonth(date: LocalDate): string {
  const text = weekdayDayMonthInline(date);
  const first = text.codePointAt(0);
  if (first === undefined) return text;
  const head = String.fromCodePoint(first);
  return head.toLocaleUpperCase(lang.value) + text.slice(head.length);
}

/** "Thursday, December 4 at 09:30" (`dateTimeLabel`). */
export function dateTimeLabel(at: LocalDateTime): string {
  const { hour, minute } = dateTimeParts(at);
  return t('date_at', [weekdayDayMonth(dateOf(at)), formatTime(hour, minute)]);
}

/** Time of a local date-time ("09:30" / "9:30 AM"). */
export function timeLabel(at: LocalDateTime): string {
  const { hour, minute } = dateTimeParts(at);
  return formatTime(hour, minute);
}

export const EXAM_TYPE_LABEL: Readonly<Record<ExamType, () => string>> = {
  COLONOSCOPY: () => t('exam_colonoscopy'),
  RECTOSIGMOIDOSCOPY: () => t('exam_rectosigmoidoscopy'),
};

export const EXAM_STEP_LABEL: Readonly<Record<ExamStep, () => string>> = {
  ANESTHESIA: () => t('exam_step_anesthesia'),
  DIET: () => t('exam_step_diet'),
  PREP_FIRST: () => t('exam_step_prep_first'),
  PREP_SECOND: () => t('exam_step_prep_second'),
  EXAM: () => t('exam_step_exam'),
};

export const CHECKUP_TYPE_LABEL: Readonly<Record<CheckupType, () => string>> = {
  BLOOD_TEST: () => t('checkup_blood_test'),
  STOOL_TEST: () => t('checkup_stool_test'),
};

/** "Take Mesalazine · 2 g" (`medication_reminder_text`). */
export function doseText(medication: Medication): string {
  return medication.dosage.trim() === ''
    ? t('medication_reminder_text', [medication.name])
    : t('medication_reminder_text_dosage', [medication.name, medication.dosage]);
}

/** "Blood test · CRP" (title of a checkup event). */
export function checkupTitle(checkup: Checkup): string {
  return [CHECKUP_TYPE_LABEL[checkup.type](), checkup.note].filter((s) => s.trim() !== '').join(' · ');
}

/**
 * Title of an exam step: the exam itself ("Colonoscopy · Parc Clinic") or the step and its
 * exam ("1st dose of bowel prep · Colonoscopy") (`examStepTitle`).
 */
export function examStepTitle(exam: Exam, step: ExamStep): string {
  const type = EXAM_TYPE_LABEL[exam.type]();
  return step === 'EXAM'
    ? [type, exam.note].filter((s) => s.trim() !== '').join(' · ')
    : `${EXAM_STEP_LABEL[step]()} · ${type}`;
}

/** Text of a step: its time and what needs to be done (`examStepText`). */
export function examStepText(exam: Exam, step: ExamStep, at: LocalDateTime): string {
  const examWhen = t('exam_reminder_when', [weekdayDayMonthInline(dateOf(exam.at)), timeLabel(exam.at)]);
  switch (step) {
    case 'ANESTHESIA': return t('exam_reminder_anesthesia', [timeLabel(at), examWhen]);
    case 'DIET': return t('exam_reminder_diet', [examWhen]);
    case 'PREP_FIRST':
    case 'PREP_SECOND': return t('exam_reminder_prep', [examWhen]);
    case 'EXAM': return t('exam_reminder_exam', [timeLabel(at)]);
  }
}

/** Body of a reorder reminder: the next dose, or the end of stock (`showRefill`). */
export function refillText(medication: Medication, alertAt: LocalDateTime): string {
  if (refillBasis(medication) === 'BEFORE_DOSE') {
    const dose = nextOccurrence(medication.schedule, alertAt);
    return dose === null ? medication.name : t('refill_reminder_text_dose', [medication.name, weekdayDayMonth(dateOf(dose))]);
  }
  return medication.stockEndDate === null
    ? medication.name
    : t('refill_reminder_text_stock', [medication.name, weekdayDayMonth(medication.stockEndDate)]);
}

/** "Influenza: next dose planned on Monday, December 7." (`showVaccine`). */
export function vaccineText(type: VaccineType, due: LocalDate): string {
  return t('vaccine_reminder_text', [VACCINE_TYPE_LABEL[type](), weekdayDayMonth(due)]);
}

/** "Gastroenterologist: Thursday, December 4 at 09:30", then the place on a second line (`showAppointment`). */
export function appointmentText(appointment: Appointment): string {
  const { hour, minute } = dateTimeParts(appointment.at);
  const text = t('appointment_reminder_text', [
    APPOINTMENT_KIND_LABEL[appointment.kind](), weekdayDayMonth(dateOf(appointment.at)), formatTime(hour, minute),
  ]);
  return appointment.place.trim() === '' ? text : `${text}\n${appointment.place}`;
}

/** How old the last encrypted backup is, or that none was ever made (`showBackup`). */
export function backupText(lastBackup: LocalDate | null): string {
  return lastBackup === null ? t('backup_reminder_text_never') : t('backup_reminder_text', [formatLocalDate(lastBackup)]);
}

/** Low-stock alert: the treatment and how many intakes are left (`showLowStock`); null without a count. */
export function lowStockContent(medication: Medication): { title: string; body: string } | null {
  const left = medication.stockDoses;
  if (left === null) return null;
  return { title: t('stock_notification_title'), body: t('stock_notification_text', [medication.name, tp('stock_intakes', left)]) };
}

/** Title and body of a reminder, as in the Android notification of the same kind. */
export function reminderContent(item: ReminderItem): { title: string; body: string } {
  switch (item.kind) {
    case 'DOSE':
      return { title: t('medication_reminder_title'), body: doseText(item.medication) };
    case 'REFILL':
      return { title: t('refill_reminder_title'), body: refillText(item.medication, item.at) };
    case 'CHECKUP':
      return {
        title: CHECKUP_TYPE_LABEL[item.checkup.type](),
        body: item.checkup.note.trim() === '' ? t('checkup_reminder_text') : item.checkup.note,
      };
    case 'VACCINE':
      return { title: t('vaccine_reminder_title'), body: vaccineText(item.vaccination.type, item.due) };
    case 'APPOINTMENT':
      return { title: t('appointment_reminder_title'), body: appointmentText(item.appointment) };
    case 'BACKUP':
      return { title: t('backup_reminder_title'), body: backupText(item.lastBackup) };
    case 'WEIGH_IN':
      return { title: t('weigh_in_title'), body: t('weigh_in_text') };
    default:
      return { title: examStepTitle(item.exam, item.step.step), body: examStepText(item.exam, item.step.step, item.step.at) };
  }
}

/** "Every day", "Every 2 weeks", "Once" (`repeatSummary`). */
export function repeatSummary(schedule: ReminderSchedule): string {
  const n = schedule.repeatEvery;
  switch (schedule.repeatUnit) {
    case 'ONCE': return t('repeat_once');
    case 'DAY': return tp('repeat_every_days', n);
    case 'WEEK': return tp('repeat_every_weeks', n);
    case 'MONTH': return tp('repeat_every_months', n);
  }
}

/**
 * Status line: recurrence and next due date; a past one-off date just shows its date
 * (`scheduleStatus`).
 */
export function scheduleStatus(schedule: ReminderSchedule, now: LocalDateTime): string {
  const next = nextOccurrence(schedule, now);
  const date = next === null
    ? formatLocalDate(schedule.startDate)
    : t('schedule_next', [dateTimeLabel(next)]);
  return `${repeatSummary(schedule)} · ${date}`;
}

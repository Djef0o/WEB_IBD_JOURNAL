import { dosesOn, occursOn, type DoseDue } from '../domain/adherence';
import { examSteps, type ExamStepTime } from '../domain/examPlan';
import type { DoseLog } from '../domain/health';
import type { Exam } from '../domain/models';
import { nextRefillAlert, type Checkup, type Medication } from '../domain/profile';
import { atTime, dateOf, type LocalDate, type LocalDateTime } from '../domain/time';
import { dayEnd, dayStart } from './schedule';

/** What the "to do today" card lists, in chronological order. */
export type TodayTask =
  | { type: 'dose'; at: LocalDateTime; due: DoseDue }
  | { type: 'refill'; at: LocalDateTime; medication: Medication }
  | { type: 'checkup'; at: LocalDateTime; checkup: Checkup }
  | { type: 'exam'; at: LocalDateTime; exam: Exam; step: ExamStepTime };

export interface TodayInput {
  date: LocalDate;
  medications: readonly Medication[];
  checkups: readonly Checkup[];
  exams: readonly Exam[];
  doseLogs: readonly DoseLog[];
}

/** Order inside the same minute: doses first, then the rest. */
const RANK: Record<TodayTask['type'], number> = { dose: 0, checkup: 1, exam: 2, refill: 3 };

/**
 * Doses of the day (with their answer), checkups and reorder alerts falling today, exam
 * steps dated today and the evening check-in once its time has passed and it is incomplete.
 * Reminder switches do not matter here: `enabled` only controls notifications, the date
 * stays useful (same rule as the doses card of the Android home screen).
 */
export function todayTasks(input: TodayInput): TodayTask[] {
  const { date } = input;
  const tasks: TodayTask[] = [];

  for (const due of dosesOn(date, [...input.medications], [...input.doseLogs])) {
    tasks.push({ type: 'dose', at: due.at, due });
  }
  for (const checkup of input.checkups) {
    if (occursOn(checkup.schedule, date)) {
      tasks.push({ type: 'checkup', at: atTime(date, checkup.schedule.hour, checkup.schedule.minute), checkup });
    }
  }
  for (const medication of input.medications) {
    const alert = nextRefillAlert(medication, dayStart(date));
    if (alert !== null && alert <= dayEnd(date)) tasks.push({ type: 'refill', at: alert, medication });
  }
  for (const exam of input.exams) {
    for (const step of examSteps(exam)) {
      if (dateOf(step.at) === date) tasks.push({ type: 'exam', at: step.at, exam, step });
    }
  }

  return tasks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : RANK[a.type] - RANK[b.type]));
}

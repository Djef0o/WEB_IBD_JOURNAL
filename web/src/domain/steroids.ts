import type { SteroidCourse } from './care';
import { daysUntil, plusDays, type LocalDate } from './time';

/** Steroid courses (`Steroids.kt`, `SteroidUi.kt`): doses decrease by steps from the start date. */

/** Upper bounds of the entry, far above any prescription; they keep the totals and dates sane. */
export const MAX_DOSE_MG = 2000;
export const MAX_STEP_DAYS = 365;

const nonNegative = (days: number): number => Math.max(days, 0);

/** Number of days of the whole course. */
export function steroidTotalDays(course: SteroidCourse): number {
  return course.steps.reduce((sum, step) => sum + nonNegative(step.days), 0);
}

/** Last day of the course; `start` for an empty course. */
export function steroidEnd(course: SteroidCourse): LocalDate {
  return plusDays(course.start, Math.max(steroidTotalDays(course) - 1, 0));
}

/** Total dose of the whole course, in mg. */
export function steroidTotalMg(course: SteroidCourse): number {
  return course.steps.reduce((sum, step) => sum + step.doseMg * nonNegative(step.days), 0);
}

/** Dose planned on `date`, or null before the start and after the end. */
export function steroidDoseOn(course: SteroidCourse, date: LocalDate): number | null {
  let day = daysUntil(course.start, date);
  if (day < 0) return null;
  for (const step of course.steps) {
    const days = nonNegative(step.days);
    if (day < days) return step.doseMg;
    day -= days;
  }
  return null;
}

/** Dose taken from the start through `date` included, in mg. */
export function steroidCumulativeMgThrough(course: SteroidCourse, date: LocalDate): number {
  let remaining = daysUntil(course.start, date) + 1;
  if (remaining <= 0) return 0;
  let total = 0;
  for (const step of course.steps) {
    const days = Math.min(remaining, nonNegative(step.days));
    total += step.doseMg * days;
    remaining -= days;
    if (remaining <= 0) break;
  }
  return total;
}

/** Taken in the course, not yet finished, on `date`. */
export function steroidActiveOn(course: SteroidCourse, date: LocalDate): boolean {
  return steroidDoseOn(course, date) !== null;
}

/** Kotlin `String.toDoubleOrNull` syntax (decimal, optional exponent). */
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Comma or dot, whatever the keyboard; null unless above 0 and within `MAX_DOSE_MG`. */
export function parseDose(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!DECIMAL.test(normalized)) return null;
  const value = Number(normalized);
  return value > 0 && value <= MAX_DOSE_MG ? value : null;
}

/** Whole number of days from 1 to `MAX_STEP_DAYS`. */
export function parseDays(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 && value <= MAX_STEP_DAYS ? value : null;
}

/** Courses under way on `today` (most recent start first), then the others (same order). */
export function partitionSteroidCourses(
  courses: readonly SteroidCourse[],
  today: LocalDate,
): { active: SteroidCourse[]; others: SteroidCourse[] } {
  const byStartDesc = (a: SteroidCourse, b: SteroidCourse): number => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0);
  return {
    active: courses.filter((c) => steroidActiveOn(c, today)).sort(byStartDesc),
    others: courses.filter((c) => !steroidActiveOn(c, today)).sort(byStartDesc),
  };
}

import { atTime, plusDays, toEpochDays, type LocalDate, type LocalDateTime } from './time';

/*
 * Weekly weigh-in reminder (WeekSummary.kt: `nextWeighIn`, `WEIGH_IN_HOUR`). Days of the week use
 * the ISO number, 1 = Monday … 7 = Sunday (`DayOfWeek.isoDayNumber`), as stored in `weigh_in_day`.
 */

/** Hour of the weekly weigh-in reminder. */
export const WEIGH_IN_HOUR = 9;

export const DEFAULT_WEIGH_IN_DAY = 7;

/** ISO day of the week of a date, 1 = Monday … 7 = Sunday. 1970-01-01 was a Thursday. */
export function isoDayOfWeek(date: LocalDate): number {
  return ((((toEpochDays(date) + 3) % 7) + 7) % 7) + 1;
}

/** Next weigh-in reminder strictly after `after`: the chosen weekday at `WEIGH_IN_HOUR`. */
export function nextWeighIn(isoDay: number, after: LocalDateTime): LocalDateTime {
  const day = after.slice(0, 10);
  const offset = (isoDay - isoDayOfWeek(day) + 7) % 7;
  const due = atTime(plusDays(day, offset), WEIGH_IN_HOUR, 0);
  return due > after ? due : atTime(plusDays(due.slice(0, 10), 7), WEIGH_IN_HOUR, 0);
}

const MIN_KG = 20;
const MAX_KG = 400;

/** Kotlin `round`: half to even. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Weight typed in the weigh-in reminder: "71.8", "71,8", "72 kg". Null if it is not a plausible
 * body weight; rounded to 0.1 kg (`parseWeightKg`).
 */
export function parseWeightKg(text: string): number | null {
  const number = text.trim().replace(/(kg|KG|Kg)$/, '').trim().replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(number)) return null;
  const kg = Number(number);
  if (!Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) return null;
  return roundHalfEven(kg * 10) / 10;
}

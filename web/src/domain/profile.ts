import type { Diagnosis } from './care';
import {
  atTime, dateOf, minusDays, plusDays, plusUnit, untilUnit,
  type DateUnit, type LocalDate, type LocalDateTime,
} from './time';

export const SEXES = ['FEMALE', 'MALE'] as const;
export type Sex = (typeof SEXES)[number];

/**
 * User identity (Settings → Profile). `sex`: identity mention on the report;
 * null = not provided. The app draws no interpretation from it.
 */
export interface Profile {
  firstName: string;
  lastName: string;
  birthDate: LocalDate | null;
  sex: Sex | null;
  diagnosis: Diagnosis | null;
}

export function profile(init: Partial<Profile> = {}): Profile {
  return { firstName: '', lastName: '', birthDate: null, sex: null, diagnosis: null, ...init };
}

export const REPEAT_UNITS = ['ONCE', 'DAY', 'WEEK', 'MONTH'] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

/**
 * Reminder scheduling: first occurrence on `startDate` at `hour`:`minute`, then
 * every `repeatEvery` units of `repeatUnit` (ONCE: only once).
 * `enabled` only controls the notification; the date stays useful without a reminder.
 */
export interface ReminderSchedule {
  enabled: boolean;
  startDate: LocalDate;
  hour: number;
  minute: number;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
}

export function reminderSchedule(
  init: Pick<ReminderSchedule, 'startDate'> & Partial<ReminderSchedule>,
): ReminderSchedule {
  return { enabled: true, hour: 8, minute: 0, repeatEvery: 1, repeatUnit: 'DAY', ...init };
}

/**
 * First occurrence strictly after `after`, or null if the series is over.
 * Months are counted from `startDate` (not from occurrence to occurrence): a reminder
 * on the 31st falls on April 30 then returns to May 31, without drifting.
 */
export function nextOccurrence(schedule: ReminderSchedule, after: LocalDateTime): LocalDateTime | null {
  const { startDate, hour, minute, repeatUnit } = schedule;
  const first = atTime(startDate, hour, minute);
  if (first > after) return first;
  if (repeatUnit === 'ONCE') return null;
  const unit: DateUnit = repeatUnit;
  const step = Math.max(schedule.repeatEvery, 1);
  // Starting point just before `after`, then advance by one step at most twice.
  let index = Math.trunc(untilUnit(startDate, dateOf(after), unit) / step);
  for (;;) {
    const candidate = atTime(plusUnit(startDate, index * step, unit), hour, minute);
    if (candidate > after) return candidate;
    index++;
  }
}

/** Lead time of the "remember to reorder" alert, in days. */
export const REFILL_LEAD_DAYS = 7;

/** Reference of the reorder alert, derived from the dose frequency. */
export const REFILL_BASES = [
  /** Doses spaced more than REFILL_LEAD_DAYS days apart (injections…): before each dose. */
  'BEFORE_DOSE',
  /** Frequent doses (daily…): before the entered stock end date. */
  'STOCK_END',
] as const;
export type RefillBasis = (typeof REFILL_BASES)[number];

/** Intakes left at which the low-stock notification fires, unless the user chooses otherwise. */
export const DEFAULT_LOW_STOCK_DOSES = 7;

/**
 * Tracked treatment, from the standard list or freely entered. `refillAlert` enables
 * the reorder alert; `stockEndDate` is only used in STOCK_END mode. `stockDoses`: intakes left,
 * counted down as doses are confirmed taken (null: not counted); the low-stock alert fires
 * when it reaches `lowStockDoses`.
 */
export interface Medication {
  id: number;
  name: string;
  dosage: string;
  schedule: ReminderSchedule;
  refillAlert: boolean;
  stockDoses: number | null;
  lowStockDoses: number;
  stockEndDate: LocalDate | null;
}

export function medication(init: Pick<Medication, 'name' | 'schedule'> & Partial<Medication>): Medication {
  return {
    id: 0, dosage: '', refillAlert: false, stockDoses: null, lowStockDoses: DEFAULT_LOW_STOCK_DOSES,
    stockEndDate: null, ...init,
  };
}

/** True when the counted stock has reached `lowStockDoses` or less; false when not counted. */
export function isLowStock(med: Medication): boolean {
  return med.stockDoses !== null && med.stockDoses <= med.lowStockDoses;
}

export function refillBasis(med: Medication): RefillBasis {
  const { repeatUnit, repeatEvery } = med.schedule;
  let intervalDays: number;
  switch (repeatUnit) {
    case 'ONCE': return 'BEFORE_DOSE';
    case 'DAY': intervalDays = repeatEvery; break;
    case 'WEEK': intervalDays = repeatEvery * 7; break;
    case 'MONTH': intervalDays = repeatEvery * 28; break;
  }
  return intervalDays > REFILL_LEAD_DAYS ? 'BEFORE_DOSE' : 'STOCK_END';
}

/**
 * Next reorder alert strictly after `after`, at the dose time, or null.
 * Before a dose: the dose must fall more than REFILL_LEAD_DAYS days after `after`.
 */
export function nextRefillAlert(med: Medication, after: LocalDateTime): LocalDateTime | null {
  if (!med.refillAlert) return null;
  let alert: LocalDateTime | null;
  if (refillBasis(med) === 'BEFORE_DOSE') {
    // Same time of day as `after`, seven days later (the time part of the string is kept as is).
    const dose = nextOccurrence(med.schedule, `${plusDays(dateOf(after), REFILL_LEAD_DAYS)}${after.slice(10)}`);
    if (dose === null) return null;
    alert = `${minusDays(dateOf(dose), REFILL_LEAD_DAYS)}${dose.slice(10)}`;
  } else {
    alert = med.stockEndDate === null
      ? null
      : atTime(minusDays(med.stockEndDate, REFILL_LEAD_DAYS), med.schedule.hour, med.schedule.minute);
  }
  return alert !== null && alert > after ? alert : null;
}

export const CHECKUP_TYPES = ['BLOOD_TEST', 'STOOL_TEST'] as const;
export type CheckupType = (typeof CHECKUP_TYPES)[number];

/** Scheduled medical checkup: blood test or stool test (calprotectin…). */
export interface Checkup {
  id: number;
  type: CheckupType;
  note: string;
  schedule: ReminderSchedule;
}

export function checkup(init: Pick<Checkup, 'type' | 'schedule'> & Partial<Checkup>): Checkup {
  return { id: 0, note: '', ...init };
}

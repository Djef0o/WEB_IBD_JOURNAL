/**
 * Dates without a time zone, as plain ISO strings (the form kotlinx-datetime serializes them in
 * backups): `LocalDate` "2026-11-15", `LocalDateTime` "2026-11-15T08:00" (seconds only when
 * non-zero, like Kotlin's `toString`), `LocalTime` "08:00". Same-format strings sort
 * chronologically, so plain `<` / `>` comparisons are correct.
 *
 * Pure arithmetic only: no DOM, no Temporal. Only `today`, `now`, `localDateTimeAt`
 * and `toEpochMillis` read the device time zone, through `Date`.
 */
export type LocalDate = string;
export type LocalTime = string;
export type LocalDateTime = string;

/** Date-based units, as in `DateTimeUnit`. */
export type DateUnit = 'DAY' | 'WEEK' | 'MONTH';

export interface DateParts { year: number; month: number; day: number }
export interface DateTimeParts extends DateParts { hour: number; minute: number; second: number }

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// --- LocalDate ---

/** Builds a date; throws RangeError if it does not exist. */
export function localDate(year: number, month: number, day: number): LocalDate {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
    month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid date: ${year}-${month}-${day}`);
  }
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Parses "YYYY-MM-DD" (`LocalDate.parse`); throws RangeError if invalid. */
export function parseLocalDate(text: string): LocalDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new RangeError(`Invalid date: ${text}`);
  return localDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function dateParts(date: LocalDate): DateParts {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

/** Days since 1970-01-01 (`toEpochDays`); this is the persisted `dateEpochDay`. */
export function toEpochDays(date: LocalDate): number {
  let { year, month, day } = dateParts(date);
  if (month <= 2) year -= 1;
  const era = Math.floor(year / 400);
  const yoe = year - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse of {@link toEpochDays} (`LocalDate.fromEpochDays`). */
export function fromEpochDays(epochDays: number): LocalDate {
  const z = epochDays + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return localDate(year, month, day);
}

export function plusDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDays(toEpochDays(date) + days);
}

export function minusDays(date: LocalDate, days: number): LocalDate {
  return plusDays(date, -days);
}

/** Adds months, clamping the day to the end of the target month (Jan 31 + 1 month = Feb 28). */
export function plusMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = dateParts(date);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = total - newYear * 12 + 1;
  return localDate(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

/** `date.plus(amount, unit)`. */
export function plusUnit(date: LocalDate, amount: number, unit: DateUnit): LocalDate {
  switch (unit) {
    case 'DAY': return plusDays(date, amount);
    case 'WEEK': return plusDays(date, amount * 7);
    case 'MONTH': return plusMonths(date, amount);
  }
}

/** Whole days from [from] to [to] (negative if [to] is earlier). */
export function daysUntil(from: LocalDate, to: LocalDate): number {
  return toEpochDays(to) - toEpochDays(from);
}

/**
 * Whole months from [from] to [to], truncated toward zero: Jan 31 to Feb 28 is 0 months
 * (same rule as kotlinx-datetime / java.time).
 */
export function monthsUntil(from: LocalDate, to: LocalDate): number {
  const a = dateParts(from);
  const b = dateParts(to);
  const packed = ((b.year * 12 + b.month) - (a.year * 12 + a.month)) * 32 + (b.day - a.day);
  return Math.trunc(packed / 32);
}

/** `date.until(other, unit)` for date-based units, truncated toward zero. */
export function untilUnit(from: LocalDate, to: LocalDate, unit: DateUnit): number {
  switch (unit) {
    case 'DAY': return daysUntil(from, to);
    case 'WEEK': return Math.trunc(daysUntil(from, to) / 7);
    case 'MONTH': return monthsUntil(from, to);
  }
}

// --- LocalDateTime ---

/** Builds a date-time; throws RangeError if invalid. */
export function localDateTime(
  year: number, month: number, day: number, hour = 0, minute = 0, second = 0,
): LocalDateTime {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new RangeError(`Invalid time: ${hour}:${minute}:${second}`);
  }
  const base = `${localDate(year, month, day)}T${pad(hour)}:${pad(minute)}`;
  return second === 0 ? base : `${base}:${pad(second)}`;
}

/** Parses "YYYY-MM-DDTHH:mm[:ss[.fraction]]" (`LocalDateTime.parse`); throws RangeError if invalid. */
export function parseLocalDateTime(text: string): LocalDateTime {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(text);
  if (!m) throw new RangeError(`Invalid date-time: ${text}`);
  return localDateTime(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
}

export function dateTimeParts(value: LocalDateTime): DateTimeParts {
  return {
    ...dateParts(value),
    hour: Number(value.slice(11, 13)),
    minute: Number(value.slice(14, 16)),
    second: value.length >= 19 ? Number(value.slice(17, 19)) : 0,
  };
}

/** `date.atTime(hour, minute)`. */
export function atTime(date: LocalDate, hour: number, minute: number): LocalDateTime {
  const { year, month, day } = dateParts(date);
  return localDateTime(year, month, day, hour, minute);
}

/** `LocalTime(hour, minute)`. */
export function localTime(hour: number, minute: number): LocalTime {
  return `${pad(hour)}:${pad(minute)}`;
}

/** `date.atTime(time)`. */
export function atLocalTime(date: LocalDate, time: LocalTime): LocalDateTime {
  return atTime(date, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
}

/** Date part (`LocalDateTime.date`). */
export function dateOf(value: LocalDateTime): LocalDate {
  return value.slice(0, 10);
}

/** Time part, "HH:mm" (`LocalDateTime.time`). */
export function timeOf(value: LocalDateTime): LocalTime {
  return value.slice(11, 16);
}

/** Wall-clock arithmetic (no time zone, no DST): minutes added on the local clock. */
export function plusMinutes(value: LocalDateTime, minutes: number): LocalDateTime {
  const { hour, minute, second } = dateTimeParts(value);
  const total = toEpochDays(dateOf(value)) * 1440 + hour * 60 + minute + minutes;
  const day = Math.floor(total / 1440);
  const rest = total - day * 1440;
  const d = dateParts(fromEpochDays(day));
  return localDateTime(d.year, d.month, d.day, Math.floor(rest / 60), rest % 60, second);
}

// --- Device time zone ---

/** Today's date in the device's time zone. */
export function today(): LocalDate {
  const d = new Date();
  return localDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Current local date and time. */
export function now(): LocalDateTime {
  return localDateTimeAt(Date.now());
}

/** Local date and time of a timestamp in milliseconds. */
export function localDateTimeAt(epochMillis: number): LocalDateTime {
  const d = new Date(epochMillis);
  return localDateTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
}

/** Timestamp in milliseconds of a local date and time, in the device's time zone. */
export function toEpochMillis(value: LocalDateTime): number {
  const p = dateTimeParts(value);
  const d = new Date(2000, 0, 1, p.hour, p.minute, p.second, 0);
  d.setFullYear(p.year, p.month - 1, p.day); // setFullYear: years 0–99 are not remapped to 19xx
  return d.getTime();
}

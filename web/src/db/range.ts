import { daysInMonth, localDate, toEpochDays, type LocalDate } from '../domain/time';

/** First and last day of a month (`month`: 1 to 12). */
export function monthBounds(year: number, month: number): { from: LocalDate; to: LocalDate } {
  return { from: localDate(year, month, 1), to: localDate(year, month, daysInMonth(year, month)) };
}

/**
 * IDBKeyRange of the `dateEpochDay`s between two dates, both included (SQL `BETWEEN`);
 * `null` if `from` is after `to` (an empty range: IDBKeyRange.bound would throw).
 */
export function dayRange(from: LocalDate, to: LocalDate): IDBKeyRange | null {
  const first = toEpochDays(from);
  const last = toEpochDays(to);
  return first > last ? null : IDBKeyRange.bound(first, last);
}

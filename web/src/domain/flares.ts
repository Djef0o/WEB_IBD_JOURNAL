import type { Flare } from './care';
import { daysUntil, today as todayDate, type LocalDate } from './time';

/** Flare periods (`Flares.kt`). An ongoing flare (`end` null) lasts through today. */

/** True if `date` falls within the flare; an ongoing flare lasts through `today`. */
export function flareCovers(flare: Flare, date: LocalDate, today: LocalDate = todayDate()): boolean {
  return date >= flare.start && date <= (flare.end ?? today);
}

/** First element with the greatest `start` (Kotlin `maxByOrNull`: the first one wins a tie). */
function latestStarted(flares: readonly Flare[]): Flare | null {
  let best: Flare | null = null;
  for (const flare of flares) if (best === null || flare.start > best.start) best = flare;
  return best;
}

/** The flare in progress on `date`, if any (the most recently started one when several overlap). */
export function flareActiveOn(flares: readonly Flare[], date: LocalDate, today: LocalDate = todayDate()): Flare | null {
  return latestStarted(flares.filter((f) => flareCovers(f, date, today)));
}

/** Days from the start of the flare through `today`, at least 1; null before the start. */
export function flareDayNumberOn(flare: Flare, today: LocalDate): number | null {
  return today < flare.start ? null : daysUntil(flare.start, today) + 1;
}

/** The ongoing flare (`end` null, already started) on `today`, if any. */
export function flareOngoingOn(flares: readonly Flare[], today: LocalDate): Flare | null {
  return latestStarted(flares.filter((f) => f.end === null && f.start <= today));
}

/** Days among `dates` covered by at least one flare (calendar marks, chart bands). */
export function flareDaysAmong(flares: readonly Flare[], dates: readonly LocalDate[], today: LocalDate = todayDate()): Set<LocalDate> {
  const covered = new Set<LocalDate>();
  if (flares.length === 0) return covered;
  for (const date of dates) if (flares.some((f) => flareCovers(f, date, today))) covered.add(date);
  return covered;
}

/** Number of days of an ended flare, inclusive of both ends (row summary). */
export function flareLengthDays(start: LocalDate, end: LocalDate): number {
  return daysUntil(start, end) + 1;
}

/** Display order of the Care list: ongoing flares first, then the most recent (`flareOrder`). */
export function sortFlaresForList(flares: readonly Flare[]): Flare[] {
  return [...flares].sort(
    (a, b) =>
      Number(b.end === null) - Number(a.end === null) ||
      (a.start < b.start ? 1 : a.start > b.start ? -1 : 0) ||
      b.id - a.id,
  );
}

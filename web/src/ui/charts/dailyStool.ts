import type { Flare } from '../../domain/care';
import { flareCovers } from '../../domain/flares';
import { isRealStool, type Stool } from '../../domain/models';
import { daysUntil, minusDays, plusDays, today as todayDate, type LocalDate } from '../../domain/time';
import { bristolColor } from '../components/bristol';

/** Minimum days displayed in the app, even with a shorter history. */
export const CHART_MIN_DAYS = 14;

/** Categories stacked from bottom to top; type 0 ("no stool") is not a stool. */
export const STOOL_CATEGORIES = [
  { id: 'HARD', min: 1, max: 2, legendKey: 'analysis_legend_hard', color: bristolColor(1) },
  { id: 'NORMAL', min: 3, max: 4, legendKey: 'analysis_legend_normal', color: bristolColor(3) },
  { id: 'LOOSE', min: 5, max: 7, legendKey: 'analysis_legend_loose', color: bristolColor(5) },
] as const;

export const BLOOD_COLOR = bristolColor(0);

export interface DayBar {
  date: LocalDate;
  /** Stool count per category, in `STOOL_CATEGORIES` order. */
  counts: number[];
  /** Stools of the day (all categories). */
  total: number;
  /** Bristol types of the day's real stools, in entry order. */
  types: number[];
  falseUrges: number;
  /** At least one entry of the day reports blood. */
  blood: boolean;
  /** The day falls within a flare: shaded behind the bar. */
  flare: boolean;
}

/** Bar of one day from that day's entries (`DayBar` of DailyStoolChart.kt); `flare`: the day falls within a flare. */
export function dayBar(date: LocalDate, stools: readonly Stool[], flare = false): DayBar {
  const counts = STOOL_CATEGORIES.map((c) => stools.filter((s) => s.bristolType >= c.min && s.bristolType <= c.max).length);
  return {
    date,
    counts,
    total: counts.reduce((a, b) => a + b, 0),
    types: stools.filter(isRealStool).map((s) => s.bristolType),
    falseUrges: stools.filter((s) => s.falseUrge).length,
    blood: stools.some((s) => s.bloodLevel > 0),
    flare,
  };
}

/** One bar per day from `from` to `to` inclusive, oldest first; days within a flare (an ongoing one lasts through `today`) are flagged. */
export function barsBetween(
  stools: readonly Stool[], from: LocalDate, to: LocalDate, flares: readonly Flare[] = [], today: LocalDate = todayDate(),
): DayBar[] {
  const byDate = new Map<LocalDate, Stool[]>();
  for (const s of stools) {
    if (s.date < from || s.date > to) continue;
    const list = byDate.get(s.date);
    if (list) list.push(s);
    else byDate.set(s.date, [s]);
  }
  const bars: DayBar[] = [];
  const count = daysUntil(from, to) + 1;
  let date = from;
  for (let i = 0; i < count; i++, date = plusDays(date, 1)) {
    bars.push(dayBar(date, byDate.get(date) ?? [], flares.some((f) => flareCovers(f, date, today))));
  }
  return bars;
}

/** The whole history up to `today`, at least `CHART_MIN_DAYS` days, oldest first; days within a flare are flagged. */
export function historyBars(stools: readonly Stool[], today: LocalDate, flares: readonly Flare[] = []): DayBar[] {
  const oldest = stools.reduce<LocalDate>((min, s) => (s.date < min ? s.date : min), today);
  const minimum = minusDays(today, CHART_MIN_DAYS - 1);
  return barsBetween(stools, oldest < minimum ? oldest : minimum, today, flares, today);
}

/** Vertical scale: the tallest day, at least 1. */
export function maxTotal(bars: readonly DayBar[]): number {
  return bars.reduce((max, b) => Math.max(max, b.total), 1);
}

/** Every `n`-th label (counted from the last bar) so that two labels are at least `minSpacing` apart. */
export function labelStep(slot: number, minSpacing: number): number {
  return Math.max(1, Math.ceil(minSpacing / slot));
}

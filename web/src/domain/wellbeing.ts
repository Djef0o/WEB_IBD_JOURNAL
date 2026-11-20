import { isWellbeingEmpty, type WellbeingDay } from './care';
import type { Stool } from './models';
import { isBadStool } from './mealSymptoms';
import type { LocalDate } from './time';

/*
 * Daily well-being compared with symptoms and averaged over a period (`Wellbeing.kt`).
 * Observations on logged data, never a cause.
 */

/** What a day can be flagged with, for the comparison with symptoms. */
export const WELLBEING_FACTORS = ['POOR_SLEEP', 'HIGH_STRESS', 'LOW_MOOD', 'PERIOD'] as const;
export type WellbeingFactor = (typeof WELLBEING_FACTORS)[number];

/** Sleep of 2 or less, stress of 4 or more, mood of 2 or less. */
const LOW_MAX = 2;
const HIGH_MIN = 4;

/**
 * Whether `factor` holds that day; null if the day says nothing about it (value not noted), so
 * that it is left out of both sides of the comparison. For `PERIOD`, any entry counts as
 * knowing whether the period was on.
 */
function holds(day: WellbeingDay, factor: WellbeingFactor): boolean | null {
  switch (factor) {
    case 'POOR_SLEEP': return day.sleep === null ? null : day.sleep <= LOW_MAX;
    case 'HIGH_STRESS': return day.stress === null ? null : day.stress >= HIGH_MIN;
    case 'LOW_MOOD': return day.mood === null ? null : day.mood <= LOW_MAX;
    case 'PERIOD': return day.period;
  }
}

/**
 * Days flagged with `factor` that were bad days clearly more often than the other days with a
 * note. `days`: flagged days with stools logged; `badRate`: share of them with symptoms;
 * `baseline`: the same share for the other days.
 */
export interface WellbeingLink {
  factor: WellbeingFactor;
  days: number;
  badRate: number;
  baseline: number;
}

/** Minimum flagged days (with stools logged) before a link can appear. */
export const MIN_WELLBEING_DAYS = 5;

/** Minimum gap above the baseline (share of days) to be reported. */
const MIN_EXCESS = 0.2;

/**
 * Factors that came with bad days (liquid stool, blood, pain of 3 and above) clearly more often
 * than usual, most striking first. Only days with at least one stool logged are compared.
 */
export function wellbeingLinks(days: readonly WellbeingDay[], stools: readonly Stool[]): WellbeingLink[] {
  const badByDay = new Map<LocalDate, boolean>();
  for (const stool of stools) badByDay.set(stool.date, (badByDay.get(stool.date) ?? false) || isBadStool(stool));
  const compared = days.filter((d) => badByDay.has(d.date));
  const links: WellbeingLink[] = [];
  for (const factor of WELLBEING_FACTORS) {
    const flagged: WellbeingDay[] = [];
    const others: WellbeingDay[] = [];
    for (const day of compared) {
      const flag = holds(day, factor);
      if (flag === true) flagged.push(day);
      else if (flag === false) others.push(day);
    }
    if (flagged.length < MIN_WELLBEING_DAYS || others.length === 0) continue;
    const rate = (list: readonly WellbeingDay[]): number => list.filter((d) => badByDay.get(d.date) === true).length / list.length;
    const badRate = rate(flagged);
    const baseline = rate(others);
    if (badRate - baseline >= MIN_EXCESS) links.push({ factor, days: flagged.length, badRate, baseline });
  }
  return links.sort((a, b) => b.badRate - b.baseline - (a.badRate - a.baseline));
}

/** Means over a period: null where nothing was noted. `periodDays`: days with a period. */
export interface WellbeingAverages {
  sleep: number | null;
  stress: number | null;
  mood: number | null;
  periodDays: number;
  entries: number;
}

export function wellbeingAverages(days: readonly WellbeingDay[], from: LocalDate, to: LocalDate): WellbeingAverages {
  const inPeriod = days.filter((d) => d.date >= from && d.date <= to && !isWellbeingEmpty(d));
  const mean = (values: number[]): number | null =>
    values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
  const noted = (pick: (d: WellbeingDay) => number | null): number[] =>
    inPeriod.map(pick).filter((v): v is number => v !== null);
  return {
    sleep: mean(noted((d) => d.sleep)),
    stress: mean(noted((d) => d.stress)),
    mood: mean(noted((d) => d.mood)),
    periodDays: inPeriod.filter((d) => d.period).length,
    entries: inPeriod.length,
  };
}

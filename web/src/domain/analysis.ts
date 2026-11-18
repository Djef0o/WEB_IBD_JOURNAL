import { isRealStool, type Meal, type Stool } from './models';
import { daysUntil, minusDays, type LocalDate } from './time';

/**
 * Period analyzed by the Trends screen (tiles and symptoms). `days` null = the whole
 * history, with no comparison period.
 */
export const ANALYSIS_PERIODS = ['LAST_30', 'LAST_90', 'ALL'] as const;
export type AnalysisPeriod = (typeof ANALYSIS_PERIODS)[number];

export const ANALYSIS_PERIOD_DAYS: Readonly<Record<AnalysisPeriod, number | null>> = {
  LAST_30: 30,
  LAST_90: 90,
  ALL: null,
};

/** Bristol 6–7: liquid stools, criterion of clinical scores (Mayo, Harvey-Bradshaw). */
const LIQUID_MIN_TYPE = 6;

/** "Strong" threshold for the 0–5 pain and fatigue scales. */
const STRONG_LEVEL = 3;

/**
 * Symptoms counted in affected days rather than as an average: three days of blood out of thirty
 * stay visible, where a per-stool average diluted them down to ~0. Array order = display order.
 */
export const SYMPTOMS = [
  'BLOOD', 'MUCUS', 'STRONG_PAIN', 'STRONG_FATIGUE', 'URGENCY', 'NOCTURNAL', 'FALSE_URGE',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

const IS_PRESENT: Readonly<Record<Symptom, (stool: Stool) => boolean>> = {
  BLOOD: (s) => s.bloodLevel > 0,
  MUCUS: (s) => s.mucusLevel > 0,
  STRONG_PAIN: (s) => s.painLevel >= STRONG_LEVEL,
  STRONG_FATIGUE: (s) => s.fatigueLevel >= STRONG_LEVEL,
  URGENCY: (s) => s.urgency,
  NOCTURNAL: (s) => s.nocturnal,
  FALSE_URGE: (s) => s.falseUrge,
};

/** Whether the stool shows the symptom (`Symptom.isPresent`). */
export function isSymptomPresent(symptom: Symptom, stool: Stool): boolean {
  return IS_PRESENT[symptom](stool);
}

/** `previousDays` is null without a comparison period or if nothing was logged in it. */
export interface SymptomDays {
  symptom: Symptom;
  days: number;
  previousDays: number | null;
}

export interface AnalysisSummary {
  period: AnalysisPeriod;
  /** Number of days covered by the period (denominator of the symptom bars). */
  periodDays: number;
  /** Stools of the period (tiles). */
  stools: Stool[];
  /** Meals of the period. */
  meals: Meal[];
  /** All recorded stools (per-day chart, scrollable). */
  stoolHistory: Stool[];
  symptomDays: SymptomDays[];
  /** Liquid stools per logged day over the period; null with no logged day. */
  liquidPerDay: number | null;
}

/** Real stools of the period: excluding no-stool days (type 0) and false urges. */
export function realStools(summary: AnalysisSummary): Stool[] {
  return summary.stools.filter(isRealStool);
}

/** Average Bristol of real stools, or null with no stool. */
export function averageBristol(summary: AnalysisSummary): number | null {
  const real = realStools(summary);
  return real.length === 0 ? null : real.reduce((sum, s) => sum + s.bristolType, 0) / real.length;
}

/** First day of `period` ending at `today`, or null for "the whole history". */
export function startFrom(period: AnalysisPeriod, today: LocalDate): LocalDate | null {
  const days = ANALYSIS_PERIOD_DAYS[period];
  return days === null ? null : minusDays(today, days - 1);
}

const distinctDays = (stools: Stool[]) => new Set(stools.map((s) => s.date)).size;

export function analyze(
  history: Stool[],
  meals: Meal[],
  today: LocalDate,
  period: AnalysisPeriod,
): AnalysisSummary {
  let start = startFrom(period, today);
  if (start === null) {
    const first = history.reduce<LocalDate | null>((min, s) => (min === null || s.date < min ? s.date : min), null);
    start = first === null ? today : first < today ? first : today;
  }
  const periodDays = daysUntil(start, today) + 1;
  const inPeriod = (date: LocalDate) => date >= start && date <= today;
  const current = history.filter((s) => inPeriod(s.date));
  // Comparison period: same length, right before.
  const days = ANALYSIS_PERIOD_DAYS[period];
  let previous: Stool[] = [];
  if (days !== null) {
    const previousStart = minusDays(start, days);
    previous = history.filter((s) => s.date >= previousStart && s.date < start);
  }

  const daysWith = (stools: Stool[], symptom: Symptom) =>
    distinctDays(stools.filter((s) => IS_PRESENT[symptom](s)));

  const trackedDays = distinctDays(current);
  return {
    period,
    periodDays,
    stools: current,
    meals: meals.filter((m) => inPeriod(m.date)),
    stoolHistory: history,
    symptomDays: SYMPTOMS.map((symptom) => ({
      symptom,
      days: daysWith(current, symptom),
      previousDays: previous.length === 0 ? null : daysWith(previous, symptom),
    })),
    liquidPerDay: trackedDays === 0
      ? null
      : current.filter((s) => s.bristolType >= LIQUID_MIN_TYPE).length / trackedDays,
  };
}

import { LAB_PERIODS, type LabPeriodId } from '../labs/labValues';
import { plusMonths, toEpochDays, type LocalDate } from '../../domain/time';
import type { Weight } from '../../domain/models';

/** Accepted entry range, in kg (`WEIGHT_RANGE` of `WeightUi.kt`). */
export const MIN_KG = 1;
export const MAX_KG = 400;

/** Weight typed by the user (`68,4` or `68.4`), kg; null outside the accepted range. */
export function parseKg(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const kg = Number(normalized);
  return Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG ? kg : null;
}

export interface ChartBox { left: number; right: number; top: number; bottom: number }

export interface WeightChartModel {
  /** Scale bounds: the lowest and highest kilograms of the window (`TimeSeriesChart`). */
  min: number;
  max: number;
  yMin: number;
  yMax: number;
  path: string;
  points: { weight: Weight; x: number; y: number }[];
}

/** Points in chronological order, positioned by date (not by index) between the box edges. */
export function buildWeightChart(weights: readonly Weight[], box: ChartBox): WeightChartModel {
  const kgs = weights.map((w) => w.kg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const first = toEpochDays(weights[0]!.date);
  const span = toEpochDays(weights[weights.length - 1]!.date) - first;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  // A single point is centered, equal dates are spread out (`timeFraction`).
  const fraction = (index: number): number =>
    weights.length === 1 ? 0.5 : span === 0 ? index / (weights.length - 1) : (toEpochDays(weights[index]!.date) - first) / span;
  const y = (kg: number) => (max === min ? box.top + height / 2 : box.top + height * ((max - kg) / (max - min)));
  const points = weights.map((weight, index) => ({ weight, x: box.left + width * fraction(index), y: y(weight.kg) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { min, max, yMin: y(min), yMax: y(max), path, points };
}

/** Weights (chronological) of each chart window: 6 months, 1 year, whole history (same windows as the lab charts). */
export function weightsByPeriod(weights: readonly Weight[], today: LocalDate): Record<LabPeriodId, Weight[]> {
  const out = {} as Record<LabPeriodId, Weight[]>;
  for (const period of LAB_PERIODS) {
    out[period.id] = period.months === null ? [...weights] : weights.filter((w) => w.date >= plusMonths(today, -period.months));
  }
  return out;
}

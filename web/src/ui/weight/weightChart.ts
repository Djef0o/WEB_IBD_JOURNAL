import { toEpochDays } from '../../domain/time';
import type { Weight } from '../../domain/models';

export const MIN_KG = 20;
export const MAX_KG = 400;

/** Weight typed by the user (`68,4` or `68.4`), kg; null if it is not a plausible weight. */
export function parseKg(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null;
  const kg = Number(normalized);
  return kg >= MIN_KG && kg <= MAX_KG ? kg : null;
}

export interface ChartBox { left: number; right: number; top: number; bottom: number }

export interface WeightChartModel {
  /** Scale bounds, whole kilograms, with a margin around the data. */
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
  const min = Math.floor(Math.min(...kgs) - 0.5);
  const max = Math.ceil(Math.max(...kgs) + 0.5);
  const first = toEpochDays(weights[0]!.date);
  const span = toEpochDays(weights[weights.length - 1]!.date) - first;
  const x = (date: string) => (span === 0 ? (box.left + box.right) / 2 : box.left + ((toEpochDays(date) - first) / span) * (box.right - box.left));
  const y = (kg: number) => box.bottom - ((kg - min) / (max - min)) * (box.bottom - box.top);
  const points = weights.map((weight) => ({ weight, x: x(weight.date), y: y(weight.kg) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { min, max, yMin: y(min), yMax: y(max), path, points };
}

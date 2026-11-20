import type { ActivityScore } from '../../../domain/care';
import { scoreTotal } from '../../../domain/activity';
import { toEpochDays } from '../../../domain/time';

export interface ChartBox { left: number; right: number; top: number; bottom: number }

export interface ScorePoint { score: ActivityScore; total: number; x: number; y: number }

export interface ScoreChartModel {
  /** Scale: 0 to `max` (at least 5, whole numbers). */
  max: number;
  yMin: number;
  yMax: number;
  path: string;
  points: ScorePoint[];
}

/** Points in chronological order, positioned by date between the box edges; the scale starts at 0. */
export function buildScoreChart(scores: readonly ActivityScore[], box: ChartBox): ScoreChartModel {
  const totals = scores.map(scoreTotal);
  const max = Math.max(5, ...totals);
  const first = toEpochDays(scores[0]!.date);
  const span = toEpochDays(scores[scores.length - 1]!.date) - first;
  const x = (date: string): number =>
    span === 0 ? (box.left + box.right) / 2 : box.left + ((toEpochDays(date) - first) / span) * (box.right - box.left);
  const y = (value: number): number => box.bottom - (value / max) * (box.bottom - box.top);
  const points = scores.map((score, i): ScorePoint => ({ score, total: totals[i]!, x: x(score.date), y: y(totals[i]!) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return { max, yMin: y(0), yMax: y(max), path, points };
}

import { useMemo } from 'preact/hooks';
import type { LabResult } from '../../domain/health';
import { sparkline } from './labValues';

const W = 80;
const H = 28;
const R = 2.5;

/** Decorative mini-curve (the text next to it carries the information); the last point is marked. */
export function LabSparkline({ points, outside }: { points: readonly LabResult[]; outside: boolean }) {
  const model = useMemo(() => sparkline(points, W, H, R), [points]);
  if (!model) return null;
  return (
    <svg class="lab-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" data-outside={outside ? '' : undefined}>
      {model.path && <path d={model.path} />}
      <circle cx={model.last.x} cy={model.last.y} r={R} />
    </svg>
  );
}

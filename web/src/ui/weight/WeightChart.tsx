import { useMemo, useRef } from 'preact/hooks';
import type { Weight } from '../../domain/models';
import { t } from '../../i18n';
import { formatDecimal, formatLocalDate } from '../format';
import { useElementWidth } from '../labs/LabChart';
import { buildWeightChart } from './weightChart';

const HEIGHT = 184;
const LEFT = 40;
const TOP = 10;
const BOTTOM = 150;
const RIGHT_PAD = 10;

/** Weight curve (inline SVG, drawn in real pixels so its text stays legible); the list next to it holds every value. */
export function WeightChart({ weights }: { weights: readonly Weight[] }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 320);
  const model = useMemo(
    () => buildWeightChart(weights, { left: LEFT, right: width - RIGHT_PAD, top: TOP, bottom: BOTTOM }),
    [weights, width],
  );
  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  const day = (w: Weight) => formatLocalDate(w.date, { dateStyle: 'medium' });
  const description = t('web_weight_chart_desc', [weights.length, day(first), day(last), formatDecimal(last.kg)]);
  return (
    <figure class="weight-chart">
      <div class="weight-chart-box" ref={box}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} role="img" aria-label={description}>
          <line class="weight-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMax} y2={model.yMax} />
          <line class="weight-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMin} y2={model.yMin} />
          <text x={LEFT - 6} y={model.yMax} text-anchor="end" dominant-baseline="central">{model.max}</text>
          <text x={LEFT - 6} y={model.yMin} text-anchor="end" dominant-baseline="central">{model.min}</text>
          {weights.length > 1 && <path class="weight-line" d={model.path} />}
          {model.points.map((p) => <circle key={p.weight.id} class="weight-point" cx={p.x} cy={p.y} r={4.5} />)}
          {first.date === last.date ? (
            <text x={(LEFT + width - RIGHT_PAD) / 2} y={BOTTOM + 26} text-anchor="middle">{day(first)}</text>
          ) : (
            <>
              <text x={LEFT} y={BOTTOM + 26} text-anchor="start">{day(first)}</text>
              <text x={width - RIGHT_PAD} y={BOTTOM + 26} text-anchor="end">{day(last)}</text>
            </>
          )}
        </svg>
      </div>
    </figure>
  );
}

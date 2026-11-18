import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { labTestUnit, type LabResult, type LabTest } from '../../domain/health';
import { labStatus, type ReferenceRange } from '../../domain/labReference';
import { t } from '../../i18n';
import { formatLocalDate } from '../format';
import { displayRange, displayValue, formatLabValue, labTestLabel } from './labFormat';
import { buildChart } from './labValues';

const HEIGHT = 184;
const LEFT = 48;
const TOP = 10;
const BOTTOM = 150;
const RIGHT_PAD = 10;
const R = 4.5;

/** Width of an element, kept up to date (the chart is drawn in real pixels so its text stays legible). */
function useElementWidth(ref: { current: HTMLElement | null }, initial: number): number {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.max(200, Math.floor(element.getBoundingClientRect().width)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return width;
}

interface Props {
  test: LabTest;
  /** Chronological order, non-empty. */
  points: readonly LabResult[];
  reference: ReferenceRange | null;
}

/**
 * Value chart over the band of the lab's reference values. Inline SVG with a text alternative:
 * the table of results next to it lists every point.
 */
export function LabChart({ test, points, reference }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 320);
  const model = useMemo(
    () => buildChart(points, reference, { left: LEFT, right: width - RIGHT_PAD, top: TOP, bottom: BOTTOM }, (r) => labStatus(r) !== null),
    [points, reference, width],
  );
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const unit = labTestUnit(test);
  const description = `${t('lab_chart_description', [labTestLabel(test)])}. ${t('web_lab_chart_summary', [
    points.length,
    formatLocalDate(first.date, { dateStyle: 'medium' }),
    formatLocalDate(last.date, { dateStyle: 'medium' }),
    displayValue(last, true, unit),
  ])}`;
  const same = first.date === last.date;
  const hasHollow = points.some((p) => p.qualifier !== 'EXACT');
  return (
    <figure class="lab-chart">
      <div class="lab-chart-box" ref={box}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} role="img" aria-label={description}>
          {model.band && (
            <rect class="lab-band" x={LEFT} y={model.band.top} width={width - RIGHT_PAD - LEFT} height={Math.max(0, model.band.bottom - model.band.top)} />
          )}
          <line class="lab-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMax} y2={model.yMax} />
          {model.yMin !== model.yMax && <line class="lab-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMin} y2={model.yMin} />}
          <text x={LEFT - 6} y={model.yMax} text-anchor="end" dominant-baseline="central">{formatLabValue(model.max)}</text>
          {model.min !== model.max && (
            <text x={LEFT - 6} y={model.yMin} text-anchor="end" dominant-baseline="central">{formatLabValue(model.min)}</text>
          )}
          {model.path && <path class="lab-line" d={model.path} />}
          {model.points.map((p) => (
            <circle
              key={p.result.id || p.x}
              class="lab-point"
              cx={p.x}
              cy={p.y}
              r={R}
              data-outside={p.outside ? '' : undefined}
              data-hollow={p.hollow ? '' : undefined}
            />
          ))}
          {same ? (
            <text x={(LEFT + width - RIGHT_PAD) / 2} y={BOTTOM + 26} text-anchor="middle">{formatLocalDate(first.date, { dateStyle: 'medium' })}</text>
          ) : (
            <>
              <text x={LEFT} y={BOTTOM + 26} text-anchor="start">{formatLocalDate(first.date, { dateStyle: 'medium' })}</text>
              <text x={width - RIGHT_PAD} y={BOTTOM + 26} text-anchor="end">{formatLocalDate(last.date, { dateStyle: 'medium' })}</text>
            </>
          )}
        </svg>
      </div>
      <figcaption>
        {reference && <span>{t('lab_reference', [`${displayRange(reference)} ${unit}`])}</span>}
        {reference && hasHollow && ' · '}
        {hasHollow && <span>{t('web_lab_chart_hollow')}</span>}
      </figcaption>
    </figure>
  );
}

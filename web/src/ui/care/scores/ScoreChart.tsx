import { useMemo, useRef } from 'preact/hooks';
import type { ActivityScore } from '../../../domain/care';
import { t } from '../../../i18n';
import { formatLocalDate } from '../../format';
import { useElementWidth } from '../../labs/LabChart';
import { buildScoreChart } from './scoreChart';

const HEIGHT = 184;
const LEFT = 40;
const TOP = 10;
const BOTTOM = 150;
const RIGHT_PAD = 10;

/** Curve of the totals of one questionnaire (inline SVG in real pixels); the history list holds every value. */
export function ScoreChart({ scores, description }: { scores: readonly ActivityScore[]; description: string }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 320);
  const model = useMemo(
    () => buildScoreChart(scores, { left: LEFT, right: width - RIGHT_PAD, top: TOP, bottom: BOTTOM }),
    [scores, width],
  );
  const first = scores[0]!;
  const last = scores[scores.length - 1]!;
  const day = (s: ActivityScore): string => formatLocalDate(s.date, { dateStyle: 'medium' });
  return (
    <figure class="score-chart">
      <div class="score-chart-box" ref={box}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} role="img" aria-label={description}>
          <line class="score-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMax} y2={model.yMax} />
          <line class="score-grid" x1={LEFT} x2={width - RIGHT_PAD} y1={model.yMin} y2={model.yMin} />
          <text x={LEFT - 6} y={model.yMax} text-anchor="end" dominant-baseline="central">{model.max}</text>
          <text x={LEFT - 6} y={model.yMin} text-anchor="end" dominant-baseline="central">0</text>
          {scores.length > 1 && <path class="score-line" d={model.path} />}
          {model.points.map((p) => (
            <circle key={p.score.id} class="score-point" cx={p.x} cy={p.y} r={4.5}>
              <title>{t('score_headline', [t(p.score.kind === 'HBI' ? 'score_hbi' : 'score_sccai'), p.total])} · {day(p.score)}</title>
            </circle>
          ))}
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

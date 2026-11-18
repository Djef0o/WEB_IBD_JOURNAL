import { ANALYSIS_PERIOD_DAYS, type AnalysisSummary, type SymptomDays } from '../../../domain/analysis';
import { t, tp } from '../../../i18n';
import { Card } from '../../components';
import { symptomLabel } from './period';

/** Days affected per symptom over the period, with the difference from the previous period. */
export function SymptomsCard({ summary }: { summary: AnalysisSummary }) {
  const days = ANALYSIS_PERIOD_DAYS[summary.period];
  return (
    <Card variant="outlined" title={t('analysis_symptoms')}>
      <p class="text-muted text-sm">
        {days === null ? t('analysis_symptoms_days') : t('analysis_symptoms_compare', [days])}
      </p>
      <ul class="symptom-list" role="list">
        {summary.symptomDays.map((row) => (
          <SymptomRow key={row.symptom} row={row} periodDays={summary.periodDays} />
        ))}
      </ul>
    </Card>
  );
}

function SymptomRow({ row, periodDays }: { row: SymptomDays; periodDays: number }) {
  const delta = row.previousDays === null ? null : row.days - row.previousDays;
  return (
    <li class="symptom-row">
      <div class="symptom-head">
        <span class="symptom-name">{symptomLabel(row.symptom)}</span>
        <span class="symptom-days">{tp('analysis_symptom_days', row.days)}</span>
        {delta !== null && (
          <span class="symptom-delta" data-trend={delta > 0 ? 'more' : delta < 0 ? 'less' : 'same'}>
            <span aria-hidden="true">{delta > 0 ? `↑ ${delta}` : delta < 0 ? `↓ ${-delta}` : '='}</span>
            <span class="visually-hidden">
              {delta > 0 ? t('web_delta_more', [delta]) : delta < 0 ? t('web_delta_less', [-delta]) : t('web_delta_same')}
            </span>
          </span>
        )}
      </div>
      {/* Share of the period's days: the day count above already says it in text. */}
      <progress class="symptom-bar" data-symptom={row.symptom} value={Math.min(row.days, periodDays)} max={periodDays} aria-hidden="true" />
    </li>
  );
}

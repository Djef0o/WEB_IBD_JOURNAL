import { signal } from '@preact/signals';
import { ANALYSIS_PERIODS, type AnalysisPeriod, type Symptom } from '../../../domain/analysis';
import { t } from '../../../i18n';

/** Period shared by Trends and the report (the app keeps it in the Trends view model). */
export const analysisPeriod = signal<AnalysisPeriod>('LAST_30');

/** Short labels of the selector ("30 days"). */
export function periodOptions(): { value: AnalysisPeriod; label: string }[] {
  const labels: Record<AnalysisPeriod, string> = {
    LAST_30: t('analysis_period_30_short'),
    LAST_90: t('analysis_period_90_short'),
    ALL: t('analysis_period_all_short'),
  };
  return ANALYSIS_PERIODS.map((value) => ({ value, label: labels[value] }));
}

/** Full label of a period ("Last 30 days"). */
export function periodLabel(period: AnalysisPeriod): string {
  switch (period) {
    case 'LAST_30': return t('analysis_period_30');
    case 'LAST_90': return t('analysis_period_90');
    case 'ALL': return t('analysis_period_all');
  }
}

/** Display label of a symptom (`Symptom.labelRes`). */
export function symptomLabel(symptom: Symptom): string {
  switch (symptom) {
    case 'BLOOD': return t('analysis_blood');
    case 'MUCUS': return t('analysis_mucus');
    case 'STRONG_PAIN': return t('analysis_pain_strong');
    case 'STRONG_FATIGUE': return t('analysis_fatigue_strong');
    case 'URGENCY': return t('analysis_urgency');
    case 'NOCTURNAL': return t('analysis_nocturnal');
    case 'FALSE_URGE': return t('analysis_false_urge');
  }
}

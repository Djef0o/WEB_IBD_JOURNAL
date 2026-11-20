import { DIAGNOSES, type Diagnosis } from '../../domain/care';
import { t } from '../../i18n';
import { SegmentedControl } from '../components';

/** Full name, for display. */
export function diagnosisLabel(diagnosis: Diagnosis): string {
  // i18n-keys: diagnosis_crohn diagnosis_uc diagnosis_other
  switch (diagnosis) {
    case 'CROHN': return t('diagnosis_crohn');
    case 'ULCERATIVE_COLITIS': return t('diagnosis_uc');
    case 'OTHER': return t('diagnosis_other');
  }
}

/** Short name, to fit in a segment. */
function shortLabel(diagnosis: Diagnosis): string {
  // i18n-keys: indication_crohn indication_uc diagnosis_other_short
  switch (diagnosis) {
    case 'CROHN': return t('indication_crohn');
    case 'ULCERATIVE_COLITIS': return t('indication_uc');
    case 'OTHER': return t('diagnosis_other_short');
  }
}

/** Crohn's / ulcerative colitis / other: shown on the emergency sheet and in the profile (`DiagnosisSelector`). */
export function DiagnosisSelector({ value, onChange }: { value: Diagnosis | null; onChange: (value: Diagnosis) => void }) {
  return (
    <SegmentedControl<Diagnosis | ''>
      label={t('diagnosis_title')}
      hideLabel={false}
      value={value ?? ''}
      options={DIAGNOSES.map((d) => ({ value: d, label: shortLabel(d) }))}
      onChange={(next) => {
        if (next !== '') onChange(next);
      }}
    />
  );
}

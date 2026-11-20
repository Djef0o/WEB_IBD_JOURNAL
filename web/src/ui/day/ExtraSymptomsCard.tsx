import { useLiveQuery } from '../../db';
import { getExtraSymptoms, normalizeExtraSymptoms, saveExtraSymptoms } from '../../db/followup';
import { EXTRA_SYMPTOMS, type ExtraSymptom } from '../../domain/care';
import type { LocalDate } from '../../domain/time';
import { t } from '../../i18n';
import { CollapsibleCard } from './CollapsibleCard';

/** Name of the manifestation, in the app's language (`ExtraSymptomLabels.kt`). */
export function extraSymptomLabel(symptom: ExtraSymptom): string {
  // i18n-keys: extra_symptom_joints extra_symptom_skin extra_symptom_eyes extra_symptom_mouth_ulcers extra_symptom_fever
  switch (symptom) {
    case 'JOINTS': return t('extra_symptom_joints');
    case 'SKIN': return t('extra_symptom_skin');
    case 'EYES': return t('extra_symptom_eyes');
    case 'MOUTH_ULCERS': return t('extra_symptom_mouth_ulcers');
    case 'FEVER': return t('extra_symptom_fever');
  }
}

/** Extra-intestinal symptoms of `date`: one toggle per manifestation, saved as soon as it changes (`DayExtrasCard`). */
export function ExtraSymptomsCard({ date }: { date: LocalDate }) {
  const day = useLiveQuery(['extra_symptoms'], () => getExtraSymptoms(date), [date]);
  const selected: readonly ExtraSymptom[] = day?.symptoms ?? [];
  const summary = EXTRA_SYMPTOMS.filter((s) => selected.includes(s)).map(extraSymptomLabel).join(', ') || t('day_card_none');

  const toggle = (symptom: ExtraSymptom): void => {
    const next = selected.includes(symptom) ? selected.filter((s) => s !== symptom) : [...selected, symptom];
    void saveExtraSymptoms(date, normalizeExtraSymptoms(next));
  };

  return (
    <CollapsibleCard title={t('extra_card_title')} summary={summary}>
      <p class="text-muted text-sm">{t('extra_card_hint')}</p>
      <div class="chip-row" role="group" aria-label={t('extra_card_title')}>
        {EXTRA_SYMPTOMS.map((symptom) => (
          <button
            key={symptom}
            type="button"
            class="chip"
            aria-pressed={selected.includes(symptom)}
            onClick={() => toggle(symptom)}
          >
            {extraSymptomLabel(symptom)}
          </button>
        ))}
      </div>
    </CollapsibleCard>
  );
}

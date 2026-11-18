import { useState } from 'preact/hooks';
import { MEDICATION_CATEGORIES, STANDARD_MEDICATIONS } from '../../domain/standardMedications';
import { t } from '../../i18n';
import { Dialog } from '../components';
import { TextField } from '../forms';
import { categoryLabel, indicationsLabel, medicationLabel } from './medicationLabels';

interface MedicationPickerProps {
  initialQuery: string;
  onPick: (name: string) => void;
  onClose: () => void;
}

/** Filterable standard list by category; "Other" keeps the typed text as is (`MedicationPickerDialog`). */
export function MedicationPicker({ initialQuery, onPick, onClose }: MedicationPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const needle = query.trim().toLocaleLowerCase();
  const labelled = STANDARD_MEDICATIONS.map((med) => ({ med, label: medicationLabel(med) }));
  const matches = labelled.filter(({ label }) => label.toLocaleLowerCase().includes(needle));

  return (
    <Dialog open onClose={onClose} title={t('treatment_choose')} closeLabel={t('close')} variant="center">
      <div class="stack">
        <TextField label={t('treatment_search')} type="search" value={query} onInput={setQuery} autocomplete="off" />
        <ul class="pick-list">
          <li>
            <button
              type="button"
              class="pick-item"
              onClick={() => (needle === '' ? onClose() : onPick(query.trim()))}
            >
              <strong>{needle === '' ? t('treatment_other') : t('treatment_other_named', [query.trim()])}</strong>
              <span class="text-muted text-sm">{t('treatment_other_desc')}</span>
            </button>
          </li>
        </ul>
        {MEDICATION_CATEGORIES.map((category) => {
          const inCategory = matches.filter(({ med }) => med.category === category);
          if (inCategory.length === 0) return null;
          return (
            <section key={category} class="stack-sm">
              <h3 class="pick-category">{categoryLabel(category)}</h3>
              <ul class="pick-list">
                {inCategory.map(({ med, label }) => (
                  <li key={label}>
                    <button type="button" class="pick-item" onClick={() => onPick(label)}>
                      <span>{label}</span>
                      {med.indications.length > 0 && <span class="text-muted text-sm">{indicationsLabel(med)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}

import { SEXES, type Profile, type Sex } from '../../../domain/profile';
import { today } from '../../../domain/time';
import { t } from '../../../i18n';
import { SegmentedControl } from '../../components';
import { TextField } from '../../forms';
import { DiagnosisSelector } from '../../emergency/DiagnosisSelector';

const SEX_LABEL: Record<Sex, () => string> = {
  FEMALE: () => t('sex_female'),
  MALE: () => t('sex_male'),
};

/** Champs du profil (identité du rapport médecin), partagés par l'onboarding et les Réglages. */
export function ProfileFields({ value, onChange }: { value: Profile; onChange: (next: Profile) => void }) {
  return (
    <div class="stack">
      <TextField
        label={t('profile_first_name')}
        value={value.firstName}
        onInput={(firstName) => onChange({ ...value, firstName })}
        autocomplete="given-name"
        autocapitalize="words"
      />
      <TextField
        label={t('profile_last_name')}
        value={value.lastName}
        onInput={(lastName) => onChange({ ...value, lastName })}
        autocomplete="family-name"
        autocapitalize="words"
      />
      <TextField
        label={t('profile_birth_date')}
        type="date"
        value={value.birthDate ?? ''}
        max={today()}
        onInput={(v) => onChange({ ...value, birthDate: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null })}
        autocomplete="bday"
      />
      <SegmentedControl<Sex | ''>
        label={t('profile_sex')}
        hideLabel={false}
        value={value.sex ?? ''}
        options={SEXES.map((s) => ({ value: s, label: SEX_LABEL[s]() }))}
        onChange={(sex) => {
          if (sex !== '') onChange({ ...value, sex });
        }}
      />
      <DiagnosisSelector value={value.diagnosis} onChange={(diagnosis) => onChange({ ...value, diagnosis })} />
    </div>
  );
}

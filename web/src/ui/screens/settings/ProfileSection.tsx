import './settings.css';
import { useState } from 'preact/hooks';
import { profileSignal, saveProfile } from '../../../db/profile';
import { profile as emptyProfile, type Profile } from '../../../domain/profile';
import { monthsUntil, today } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { Button, Card, Dialog } from '../../components';
import { formatLocalDate } from '../../format';
import { diagnosisLabel } from '../../emergency/DiagnosisSelector';
import { ProfileFields } from './ProfileFields';

function EditForm({ initial, onDone }: { initial: Profile; onDone: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await saveProfile({ ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim() });
    onDone();
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)}>
      <ProfileFields value={draft} onChange={setDraft} />
      <div class="dialog-actions">
        <Button variant="text" type="button" onClick={onDone}>{t('cancel')}</Button>
        <Button type="submit" aria-disabled={busy || undefined}>{t('save')}</Button>
      </div>
    </form>
  );
}

/** Identité du patient (nom, date de naissance, sexe), en tête du rapport pour le médecin. */
export function ProfileSection() {
  const [editing, setEditing] = useState(false);
  const profile = profileSignal.value ?? emptyProfile();
  const fullName = [profile.firstName, profile.lastName].filter((s) => s.trim() !== '').join(' ');
  const age = profile.birthDate ? Math.trunc(monthsUntil(profile.birthDate, today()) / 12) : null;

  return (
    <>
      <Card title={t('profile_title')}>
        <div class="setting-row">
          <div>
            <p class="setting-title">{fullName || t('profile_empty_name')}</p>
            <p class="text-muted setting-lines">
              {profile.birthDate && age !== null
                ? t('profile_born_on', [formatLocalDate(profile.birthDate), tp('profile_age', age)])
                : t('profile_birth_date_missing')}
              {'\n'}
              {profile.sex ? t(profile.sex === 'FEMALE' ? 'sex_female' : 'sex_male') : t('profile_sex_missing')}
              {'\n'}
              {profile.diagnosis ? diagnosisLabel(profile.diagnosis) : t('diagnosis_missing')}
            </p>
          </div>
          <Button variant="tonal" onClick={() => setEditing(true)}>{t('modify')}</Button>
        </div>
      </Card>
      <Dialog open={editing} onClose={() => setEditing(false)} title={t('profile_edit')} closeLabel={t('close')} lightDismiss={false}>
        <EditForm initial={profile} onDone={() => setEditing(false)} />
      </Dialog>
    </>
  );
}

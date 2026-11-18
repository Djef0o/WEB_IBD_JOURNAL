import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useLiveQuery } from '../../db/live';
import { getAllMedications } from '../../db/medications';
import { markOnboardingDone } from '../../db/prefs';
import { saveProfile } from '../../db/profile';
import { profile as emptyProfile, type Medication, type Profile } from '../../domain/profile';
import { t } from '../../i18n';
import { navigate, type ScreenProps } from '../../router';
import { vaultStatus } from '../../security/vault';
import { PinSetup } from '../security/PinSetup';
import { ImportBackupButton } from '../backup/ImportBackup';
import { BristolIcon, Button, Dialog } from '../components';
import { Glyph, TAB_ICONS } from '../shell/Nav';
import { MedicationForm, describeSchedule } from './onboarding/MedicationForm';
import { NotificationPermission } from './settings/NotificationPermission';
import { ProfileFields } from './settings/ProfileFields';
import './settings/settings.css';

type StepId = 'WELCOME' | 'SECURITY' | 'PROFILE' | 'TREATMENTS' | 'TOUR_TODAY' | 'TOUR_HISTORY' | 'TOUR_TRENDS' | 'TOUR_CARE' | 'REMINDERS';
const STEPS: readonly StepId[] = ['WELCOME', 'SECURITY', 'PROFILE', 'TREATMENTS', 'TOUR_TODAY', 'TOUR_HISTORY', 'TOUR_TRENDS', 'TOUR_CARE', 'REMINDERS'];

const ICON: Record<StepId, ComponentChildren> = {
  WELCOME: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
    </>
  ),
  SECURITY: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  PROFILE: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  TREATMENTS: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)" />
      <path d="m9.3 7.5 7.2 9" />
    </>
  ),
  TOUR_TODAY: TAB_ICONS.home,
  TOUR_HISTORY: TAB_ICONS.history,
  TOUR_TRENDS: TAB_ICONS.analysis,
  TOUR_CARE: TAB_ICONS.care,
  REMINDERS: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
};

const TITLE: Record<StepId, () => string> = {
  WELCOME: () => t('onboarding_title'),
  SECURITY: () => t('web_onboarding_security_title'),
  PROFILE: () => t('onboarding_profile_title'),
  TREATMENTS: () => t('onboarding_treatments_title'),
  TOUR_TODAY: () => t('onboarding_tour_today_title'),
  TOUR_HISTORY: () => t('onboarding_tour_history_title'),
  TOUR_TRENDS: () => t('onboarding_tour_trends_title'),
  TOUR_CARE: () => t('onboarding_tour_care_title'),
  REMINDERS: () => t('web_onboarding_reminders_title'),
};

const TEXT: Record<StepId, () => string> = {
  WELCOME: () => t('onboarding_text'),
  SECURITY: () => t('web_onboarding_security_text'),
  PROFILE: () => t('onboarding_profile_text'),
  TREATMENTS: () => t('onboarding_treatments_text'),
  TOUR_TODAY: () => t('onboarding_tour_today_text'),
  TOUR_HISTORY: () => t('onboarding_tour_history_text'),
  TOUR_TRENDS: () => t('onboarding_tour_trends_text'),
  TOUR_CARE: () => t('onboarding_tour_care_text'),
  REMINDERS: () => t('web_onboarding_reminders_text'),
};

/** Quitte l'onboarding : marque comme terminé puis ouvre l'accueil. */
async function finish(): Promise<void> {
  await markOnboardingDone();
  await navigate('/', { replace: true });
}

function TreatmentsStep() {
  const meds = useLiveQuery(['medications'], getAllMedications) ?? [];
  const [editing, setEditing] = useState<{ item: Medication | null } | null>(null);
  return (
    <>
      {meds.length === 0 ? (
        <p class="text-muted">{t('onboarding_treatments_empty')}</p>
      ) : (
        <ul class="med-list" role="list">
          {meds.map((m) => (
            <li key={m.id} class="med-item">
              <div>
                <p class="setting-title">{[m.name, m.dosage].filter((s) => s.trim() !== '').join(' · ')}</p>
                <p class="text-muted text-sm">{describeSchedule(m)}</p>
              </div>
              <Button variant="tonal" onClick={() => setEditing({ item: m })}>{t('modify')}</Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outlined" onClick={() => setEditing({ item: null })}>{t('treatment_add')}</Button>
      </div>
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t(editing?.item ? 'treatment_edit' : 'treatment_add')}
        closeLabel={t('close')}
        lightDismiss={false}
      >
        {editing && <MedicationForm initial={editing.item} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

export default function Onboarding(_props: ScreenProps) {
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Profile>(emptyProfile());
  const meds = useLiveQuery(['medications'], getAllMedications);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const step = STEPS[index] ?? 'WELCOME';
  const isLast = index === STEPS.length - 1;
  const profileEmpty = draft.firstName.trim() === '' && draft.lastName.trim() === '' && draft.birthDate === null && draft.sex === null;
  // « Passer » plutôt que « Suivant » quand l'étape de saisie est restée vide.
  const skipping = (step === 'PROFILE' && profileEmpty) || (step === 'TREATMENTS' && (meds?.length ?? 0) === 0);

  // Le titre de l'étape reçoit le focus à chaque changement : les lecteurs d'écran l'annoncent.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, [index]);

  const pinPending = step === 'SECURITY' && vaultStatus.value !== 'unlocked';

  async function next(): Promise<void> {
    if (busy || pinPending) return;
    if (step === 'PROFILE' && !profileEmpty) {
      await saveProfile({ ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim() });
    }
    if (isLast) {
      setBusy(true);
      await finish();
      return;
    }
    setIndex(index + 1);
  }

  return (
    <div class="onboarding">
      <div>
        <progress class="onboarding-progress" max={STEPS.length} value={index + 1} aria-hidden="true" />
        <p class="text-muted text-sm">{t('onboarding_step', [index + 1, STEPS.length])}</p>
      </div>
      <section class="onboarding-body" aria-labelledby="onboarding-title">
        <div class="onboarding-icon"><Glyph>{ICON[step]}</Glyph></div>
        <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{TITLE[step]()}</h1>
        <p class="text-muted">{TEXT[step]()}</p>
        {step === 'WELCOME' && (
          <>
            <p class="callout text-sm">{t('onboarding_disclaimer')}</p>
            <div class="stack-sm">
              <p class="text-muted text-sm">{t('web_onboarding_restore_hint')}</p>
              <div>
                <ImportBackupButton variant="outlined" onImported={() => void finish()}>{t('import_data')}</ImportBackupButton>
              </div>
            </div>
          </>
        )}
        {step === 'SECURITY' && (vaultStatus.value === 'unlocked'
          ? <p class="callout" role="status">{t('web_pin_done')}</p>
          : <PinSetup onDone={() => setIndex((i) => i + 1)} />)}
        {step === 'PROFILE' && <ProfileFields value={draft} onChange={setDraft} />}
        {step === 'TREATMENTS' && <TreatmentsStep />}
        {step === 'TOUR_TODAY' && (
          <div class="bristol-strip">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <BristolIcon key={n} type={n} size="sm" />)}
          </div>
        )}
        {step === 'REMINDERS' && <NotificationPermission />}
      </section>
      <div class="onboarding-nav">
        {index > 0 && <Button variant="text" onClick={() => setIndex(index - 1)}>{t('onboarding_back')}</Button>}
        <span class="spacer" />
        <Button variant={skipping ? 'outlined' : 'filled'} aria-disabled={busy || pinPending || undefined} onClick={() => void next()}>
          {isLast ? t('start') : skipping ? t('onboarding_skip') : t('onboarding_next')}
        </Button>
      </div>
    </div>
  );
}

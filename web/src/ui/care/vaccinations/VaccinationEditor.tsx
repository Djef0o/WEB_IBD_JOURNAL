import { useState } from 'preact/hooks';
import { deleteVaccination, saveVaccination } from '../../../db/vaccinations';
import { VACCINE_TYPES, vaccination as newVaccination, type Vaccination, type VaccineType } from '../../../domain/care';
import { plusMonths, today } from '../../../domain/time';
import { t } from '../../../i18n';
import { notificationPermission, requestNotificationPermission } from '../../../reminders/notify';
import { Button, Sheet, Switch } from '../../components';
import { SelectField, TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';
import { NoteField } from '../records/NoteField';
import { VACCINE_TYPE_LABEL } from './vaccineLabels';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface VaccinationEditorProps {
  /** null: new vaccination, given today by default. */
  initial: Vaccination | null;
  onClose: () => void;
}

/** Vaccination sheet: vaccine, date given, optional next dose with its reminder, note (`VaccinationEditorSheet`). */
export function VaccinationEditor({ initial, onClose }: VaccinationEditorProps) {
  const now = today();
  const [type, setType] = useState<VaccineType>(initial?.type ?? 'INFLUENZA');
  const [date, setDate] = useState(initial?.date ?? now);
  /** '' = not planned. */
  const [nextDue, setNextDue] = useState(initial?.nextDue ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [reminder, setReminder] = useState(initial?.reminderEnabled === true);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const dateError = !ISO_DATE.test(date) ? t('profile_not_set') : date > now ? t('web_weight_invalid_date') : null;
  const planned = nextDue !== '';
  const nextError = !planned
    ? null
    : !ISO_DATE.test(nextDue)
      ? t('profile_not_set')
      : ISO_DATE.test(date) && nextDue <= date
        ? t('vaccine_next_before_date')
        : null;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (dateError !== null || nextError !== null) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    const reminderEnabled = reminder && planned;
    // The permission prompt needs the user gesture: ask before the (asynchronous) save, as Android does.
    if (reminderEnabled && notificationPermission.value === 'default') void requestNotificationPermission();
    setBusy(true);
    await saveVaccination({
      ...(initial ?? newVaccination({ type, date })),
      type,
      date,
      nextDue: planned ? nextDue : null,
      note: note.trim(),
      reminderEnabled,
    });
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteVaccination(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'vaccine_edit' : 'vaccine_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <SelectField
          label={t('vaccine_type')}
          value={type}
          onChange={setType}
          options={VACCINE_TYPES.map((value) => ({ value, label: VACCINE_TYPE_LABEL[value]() }))}
        />
        <TextField
          label={t('vaccine_date')}
          type="date"
          value={date}
          onInput={setDate}
          max={now}
          error={dateError}
          showError={attempted}
          required
        />
        {planned ? (
          <div class="care-line care-line-field">
            <TextField
              label={t('vaccine_next_due')}
              type="date"
              value={nextDue}
              onInput={setNextDue}
              min={ISO_DATE.test(date) ? date : undefined}
              error={nextError}
              // The "after the date given" message is a live warning, as on Android.
              showError={attempted || nextError === t('vaccine_next_before_date')}
              required
            />
            <button type="button" class="icon-btn" aria-label={`${t('exam_clear')}: ${t('vaccine_next_due')}`} onClick={() => setNextDue('')}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div class="care-line">
            <div class="stack-sm">
              <span class="field-name">{t('vaccine_next_due')}</span>
              <span class="text-muted">{t('vaccine_next_none')}</span>
            </div>
            <Button
              variant="tonal"
              aria-label={`${t('add')}: ${t('vaccine_next_due')}`}
              // Suggestion: one year after the dose.
              onClick={() => setNextDue(plusMonths(ISO_DATE.test(date) ? date : now, 12))}
            >
              {t('add')}
            </Button>
          </div>
        )}
        <NoteField label={t('vaccine_note')} value={note} onInput={setNote} />
        {planned && (
          <Switch label={t('vaccine_reminder_switch')} description={t('vaccine_reminder_hint')} checked={reminder} onChange={setReminder} />
        )}

        <div class="dialog-actions">
          {initial && <Button variant="danger" onClick={() => void remove()} aria-disabled={busy || undefined}>{t('delete')}</Button>}
          <span class="spacer" />
          <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" aria-disabled={busy || undefined}>{t('save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}

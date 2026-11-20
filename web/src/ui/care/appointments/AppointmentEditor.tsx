import { useState } from 'preact/hooks';
import { deleteAppointment, saveAppointment } from '../../../db/followup';
import { APPOINTMENT_KINDS, appointment as newAppointment, type Appointment, type AppointmentKind } from '../../../domain/care';
import { now, plusDays, today } from '../../../domain/time';
import { t } from '../../../i18n';
import { Button, Sheet, Switch } from '../../components';
import { SelectField, TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';
import { isDateTime } from '../examDraft';
import { APPOINTMENT_KIND_LABEL } from './appointmentLabels';

/** New appointment: in a week, in the morning. */
const NEW_APPOINTMENT_DAYS_AHEAD = 7;
const NEW_APPOINTMENT_TIME = '09:00';

interface AppointmentEditorProps {
  /** null: new appointment, a week ahead by default. Past dates are allowed to log a visit. */
  initial: Appointment | null;
  onClose: () => void;
}

/** Appointment sheet (`AppointmentEditorSheet`). */
export function AppointmentEditor({ initial, onClose }: AppointmentEditorProps) {
  const [kind, setKind] = useState<AppointmentKind>(initial?.kind ?? 'GASTROENTEROLOGIST');
  const [at, setAt] = useState(initial?.at ?? `${plusDays(today(), NEW_APPOINTMENT_DAYS_AHEAD)}T${NEW_APPOINTMENT_TIME}`);
  const [place, setPlace] = useState(initial?.place ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [reminders, setReminders] = useState(initial?.remindersEnabled ?? true);
  // Until the switch is touched (or for an existing appointment), reminders follow the date: off once past.
  const [touched, setTouched] = useState(initial !== null);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  function changeAt(value: string): void {
    setAt(value);
    if (!touched && isDateTime(value)) setReminders(value >= now());
  }

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (!isDateTime(at)) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveAppointment({
      ...(initial ?? newAppointment({ kind, at })),
      kind,
      at,
      place: place.trim(),
      note: note.trim(),
      remindersEnabled: reminders,
    });
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteAppointment(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'appointmentui_edit' : 'appointmentui_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <SelectField<AppointmentKind>
          label={t('appointmentui_title')}
          value={kind}
          onChange={setKind}
          options={APPOINTMENT_KINDS.map((value) => ({ value, label: APPOINTMENT_KIND_LABEL[value]() }))}
        />
        <TextField
          label={`${t('appointmentui_date')} · ${t('appointmentui_time')}`}
          type="datetime-local"
          value={at}
          onInput={changeAt}
          error={isDateTime(at) ? null : t('profile_not_set')}
          showError={attempted}
          required
        />
        <TextField
          label={t('appointmentui_place')}
          value={place}
          onInput={setPlace}
          autocomplete="off"
          autocapitalize="sentences"
        />
        <TextField
          label={t('appointmentui_note')}
          value={note}
          onInput={setNote}
          autocomplete="off"
          autocapitalize="sentences"
        />
        <Switch
          label={t('appointmentui_reminders')}
          description={t('appointmentui_reminders_hint')}
          checked={reminders}
          onChange={(value) => {
            setReminders(value);
            setTouched(true);
          }}
        />
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

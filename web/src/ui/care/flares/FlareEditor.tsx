import { useState } from 'preact/hooks';
import { deleteFlare, saveFlare } from '../../../db/flares';
import { flare as newFlare, type Flare } from '../../../domain/care';
import { today } from '../../../domain/time';
import { t } from '../../../i18n';
import { Button, Sheet, Switch } from '../../components';
import { TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';
import { NoteField } from '../records/NoteField';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface FlareEditorProps {
  /** null: new flare, ongoing since today by default. */
  initial: Flare | null;
  onClose: () => void;
}

/** Flare sheet: start, ongoing or end date, treatment, hospitalization, note (`FlareEditorSheet`). */
export function FlareEditor({ initial, onClose }: FlareEditorProps) {
  const now = today();
  const [start, setStart] = useState(initial?.start ?? now);
  const [ongoing, setOngoing] = useState(initial === null || initial.end === null);
  const [end, setEnd] = useState(initial?.end ?? now);
  const [treatment, setTreatment] = useState(initial?.treatment ?? '');
  const [hospitalized, setHospitalized] = useState(initial?.hospitalized ?? false);
  const [note, setNote] = useState(initial?.note ?? '');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const startError = !ISO_DATE.test(start) ? t('profile_not_set') : start > now ? t('web_weight_invalid_date') : null;
  const endError = ongoing
    ? null
    : !ISO_DATE.test(end)
      ? t('profile_not_set')
      : end > now
        ? t('web_weight_invalid_date')
        : startError === null && end < start
          ? t('flare_end_before_start')
          : null;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (startError !== null || endError !== null) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveFlare({
      ...(initial ?? newFlare({ start })),
      start,
      end: ongoing ? null : end,
      treatment: treatment.trim(),
      hospitalized,
      note: note.trim(),
    });
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteFlare(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'flare_edit' : 'flare_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <TextField
          label={t('flare_start')}
          type="date"
          value={start}
          onInput={setStart}
          max={now}
          error={startError}
          showError={attempted}
          required
        />
        <Switch label={t('flare_ongoing')} checked={ongoing} onChange={setOngoing} />
        {!ongoing && (
          <TextField
            label={t('flare_end')}
            type="date"
            value={end}
            onInput={setEnd}
            min={ISO_DATE.test(start) ? start : undefined}
            max={now}
            error={endError}
            // The end-before-start message is shown at once, as on Android (it is a live warning, not a required field).
            showError={attempted || endError === t('flare_end_before_start')}
            required
          />
        )}
        <TextField
          label={t('flare_treatment')}
          hint={t('flare_treatment_hint')}
          value={treatment}
          onInput={setTreatment}
          autocomplete="off"
          autocapitalize="sentences"
        />
        <Switch label={t('flare_hospitalized')} checked={hospitalized} onChange={setHospitalized} />
        <NoteField label={t('flare_note')} value={note} onInput={setNote} />

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

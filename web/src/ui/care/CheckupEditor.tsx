import { useState } from 'preact/hooks';
import { deleteCheckup, saveCheckup } from '../../db/checkups';
import { checkup as newCheckup, CHECKUP_TYPES, type Checkup, type CheckupType } from '../../domain/profile';
import { today } from '../../domain/time';
import { t } from '../../i18n';
import { CHECKUP_TYPE_LABEL } from '../../reminders/text';
import { Button, SegmentedControl, Sheet } from '../components';
import { TextField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import { ScheduleFields } from './ScheduleFields';
import { draftFromSchedule, newDraft, scheduleFromDraft } from './scheduleDraft';

interface CheckupEditorProps {
  /** null: new checkup. */
  initial: Checkup | null;
  onClose: () => void;
}

/** Blood or stool test sheet (`CheckupEditorSheet`). */
export function CheckupEditor({ initial, onClose }: CheckupEditorProps) {
  const [type, setType] = useState<CheckupType>(initial?.type ?? 'BLOOD_TEST');
  const [note, setNote] = useState(initial?.note ?? '');
  const [draft, setDraft] = useState(() => (initial ? draftFromSchedule(initial.schedule) : newDraft('ONCE', today())));
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    const schedule = scheduleFromDraft(draft);
    if (!schedule) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveCheckup(
      initial ? { ...initial, type, note: note.trim(), schedule } : newCheckup({ type, note: note.trim(), schedule }),
    );
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteCheckup(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'checkup_edit' : 'checkup_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <SegmentedControl
          label={t('checkups_title')}
          value={type}
          onChange={setType}
          options={CHECKUP_TYPES.map((value) => ({ value, label: CHECKUP_TYPE_LABEL[value]() }))}
        />
        <TextField
          label={t('checkup_note')}
          hint={t('checkup_note_hint')}
          value={note}
          onInput={setNote}
          autocomplete="off"
        />
        <ScheduleFields draft={draft} onChange={setDraft} dateLabel={t('checkup_date')} showErrors={attempted} />
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

import { useId, useState } from 'preact/hooks';
import { deleteDoctorQuestion, saveDoctorQuestion } from '../../../db/followup';
import { doctorQuestion, type DoctorQuestion } from '../../../domain/care';
import { t } from '../../../i18n';
import { Button, Sheet } from '../../components';

interface QuestionEditorProps {
  /** null: new question. */
  initial: DoctorQuestion | null;
  onClose: () => void;
}

/** Sheet to write or edit a question for the doctor (`QuestionEditorSheet`). */
export function QuestionEditor({ initial, onClose }: QuestionEditorProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [busy, setBusy] = useState(false);
  const id = useId();
  const canSave = text.trim() !== '';

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy || !canSave) return;
    setBusy(true);
    await saveDoctorQuestion({ ...(initial ?? doctorQuestion({ text: '' })), text: text.trim() });
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteDoctorQuestion(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'question_edit' : 'question_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <div class="field">
          <label class="field-name" for={id}>{t('question_field')}</label>
          <textarea
            id={id}
            class="input"
            rows={3}
            value={text}
            autocapitalize="sentences"
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </div>
        <div class="dialog-actions">
          {initial && <Button variant="danger" onClick={() => void remove()} aria-disabled={busy || undefined}>{t('delete')}</Button>}
          <span class="spacer" />
          <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" aria-disabled={busy || !canSave || undefined}>{t('save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}

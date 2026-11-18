import { useState } from 'preact/hooks';
import { deleteExam, saveExam } from '../../db/exams';
import { APPOINTMENT_REMINDER_LEAD_MINUTES, DIET_REMINDER_TIME, dietStart, needsAnesthesia } from '../../domain/examPlan';
import { EXAM_TYPES, exam as modelExam, type Exam } from '../../domain/models';
import { today } from '../../domain/time';
import { formatTime } from '../format';
import { t, tp } from '../../i18n';
import { EXAM_TYPE_LABEL, weekdayDayMonth } from '../../reminders/text';
import { Button, SegmentedControl, Sheet, Switch } from '../components';
import { TextField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import { draftFromExam, examFromDraft, isDateTime, MAX_DIET_DAYS, newExamDraft, type ExamDraft } from './examDraft';
import { Stepper } from './Stepper';

/** Date-time that may be absent: "Not scheduled yet" until added (`OptionalDateTimeField`). */
function OptionalDateTime({ label, value, fallback, onChange, showErrors }: {
  label: string;
  value: string;
  /** Proposed value when added. */
  fallback: string;
  onChange: (value: string) => void;
  showErrors: boolean;
}) {
  if (value === '') {
    return (
      <div class="care-line">
        <div class="stack-sm">
          <span class="field-name">{label}</span>
          <span class="text-muted">{t('exam_not_set')}</span>
        </div>
        <Button variant="tonal" onClick={() => onChange(fallback)} aria-label={`${t('add')}: ${label}`}>{t('add')}</Button>
      </div>
    );
  }
  return (
    <div class="care-line care-line-field">
      <TextField
        label={label}
        type="datetime-local"
        value={value}
        onInput={onChange}
        error={isDateTime(value) ? null : t('profile_not_set')}
        showError={showErrors}
        required
      />
      <button type="button" class="icon-btn" aria-label={`${t('exam_clear')}: ${label}`} onClick={() => onChange('')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

interface ExamEditorProps {
  /** null: new exam. */
  initial: Exam | null;
  onClose: () => void;
}

/** Exam sheet: date, note, anesthesia consultation, diet and bowel prep doses (`ExamEditorSheet`). */
export function ExamEditor({ initial, onClose }: ExamEditorProps) {
  const [draft, setDraft] = useState<ExamDraft>(() => (initial ? draftFromExam(initial) : newExamDraft(today())));
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const patch = (changes: Partial<ExamDraft>): void => setDraft((d) => ({ ...d, ...changes }));

  const current = examFromDraft(draft, initial?.id ?? 0);
  const diet = isDateTime(draft.at) ? dietStart(modelExam({ type: draft.type, at: draft.at, dietDays: draft.dietDays })) : null;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (!current) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveExam(current);
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteExam(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'exam_edit' : 'exam_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <SegmentedControl
          label={t('exams_title')}
          value={draft.type}
          onChange={(type) => patch({ type })}
          options={EXAM_TYPES.map((value) => ({ value, label: EXAM_TYPE_LABEL[value]() }))}
        />
        <TextField
          label={t('exam_date')}
          type="datetime-local"
          value={draft.at}
          onInput={(at) => patch({ at })}
          error={isDateTime(draft.at) ? null : t('profile_not_set')}
          showError={attempted}
          required
        />
        <TextField
          label={t('exam_note')}
          hint={t('exam_note_hint')}
          value={draft.note}
          onInput={(note) => patch({ note })}
          autocomplete="off"
          autocapitalize="sentences"
        />

        {needsAnesthesia(draft.type) && (
          <OptionalDateTime
            label={t('exam_step_anesthesia')}
            value={draft.anesthesiaAt}
            fallback={draft.at}
            onChange={(anesthesiaAt) => patch({ anesthesiaAt })}
            showErrors={attempted}
          />
        )}

        <fieldset class="stack">
          <legend class="care-legend">{t('exam_preparation')}</legend>
          <p class="text-muted text-sm">{t('exam_preparation_desc')}</p>
          <div class="care-line">
            <div class="stack-sm">
              <span>{draft.dietDays === 0 ? t('exam_diet_none') : tp('exam_diet_days', draft.dietDays)}</span>
              {diet !== null && <span class="text-muted text-sm">{t('exam_diet_start', [weekdayDayMonth(diet)])}</span>}
            </div>
            <Stepper
              value={draft.dietDays}
              min={0}
              max={MAX_DIET_DAYS}
              label={t('exam_step_diet')}
              onChange={(dietDays) => patch({ dietDays })}
            />
          </div>
          <OptionalDateTime
            label={t('exam_step_prep_first')}
            value={draft.prepFirstAt}
            fallback={draft.at}
            onChange={(prepFirstAt) => patch({ prepFirstAt })}
            showErrors={attempted}
          />
          {/* Optional second dose, once the first is noted. */}
          {(draft.prepFirstAt !== '' || draft.prepSecondAt !== '') && (
            <OptionalDateTime
              label={t('exam_step_prep_second')}
              value={draft.prepSecondAt}
              fallback={draft.prepFirstAt || draft.at}
              onChange={(prepSecondAt) => patch({ prepSecondAt })}
              showErrors={attempted}
            />
          )}
        </fieldset>

        <Switch
          label={t('exam_reminders')}
          description={t('exam_reminders_desc', [
            APPOINTMENT_REMINDER_LEAD_MINUTES / 60,
            formatTime(Number(DIET_REMINDER_TIME.slice(0, 2)), Number(DIET_REMINDER_TIME.slice(3, 5))),
          ])}
          checked={draft.remindersEnabled}
          onChange={(remindersEnabled) => patch({ remindersEnabled })}
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

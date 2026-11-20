import { useId, useState } from 'preact/hooks';
import { deleteSteroidCourse, saveSteroidCourse } from '../../../db/steroids';
import { steroidCourse as newCourse, type SteroidCourse } from '../../../domain/care';
import { parseDays, parseDose, steroidEnd, steroidTotalDays, steroidTotalMg } from '../../../domain/steroids';
import { today } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { Button, Sheet } from '../../components';
import { TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';
import { formatLocalDate } from '../../format';
import { NoteField } from '../records/NoteField';
import { formatMg } from './steroidFormat';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Drug names offered as chips (the field stays free). */
function drugSuggestions(): string[] {
  return [
    t('steroid_drug_prednisone'),
    t('steroid_drug_prednisolone'),
    t('steroid_drug_methylprednisolone'),
    t('steroid_drug_budesonide'),
  ];
}

/** Step being typed: raw field contents; `key` keeps the inputs attached to their step when one is removed. */
interface StepDraft {
  key: number;
  dose: string;
  days: string;
}

const doseRejected = (step: StepDraft): boolean => step.dose.trim() !== '' && parseDose(step.dose) === null;
const daysRejected = (step: StepDraft): boolean => step.days.trim() !== '' && parseDays(step.days) === null;

interface SteroidEditorProps {
  /** null: new course, starting today by default. */
  initial: SteroidCourse | null;
  onClose: () => void;
}

/** Steroid course sheet: drug, start, dose steps with the resulting total and end (`SteroidEditorSheet`). */
export function SteroidEditor({ initial, onClose }: SteroidEditorProps) {
  const [drug, setDrug] = useState(initial?.drug ?? '');
  const [start, setStart] = useState(initial?.start ?? today());
  const [note, setNote] = useState(initial?.note ?? '');
  const [nextKey, setNextKey] = useState(() => Math.max(initial?.steps.length ?? 0, 1));
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    initial && initial.steps.length > 0
      ? initial.steps.map((s, key) => ({ key, dose: formatMg(s.doseMg), days: String(s.days) }))
      : [{ key: 0, dose: '', days: '' }],
  );
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const stepsErrorId = useId();

  const stepsValid = steps.length > 0 && steps.every((s) => parseDose(s.dose) !== null && parseDays(s.days) !== null);
  const course: SteroidCourse | null =
    stepsValid && ISO_DATE.test(start)
      ? {
          ...(initial ?? newCourse({ drug: '', start, steps: [] })),
          drug: drug.trim(),
          start,
          steps: steps.map((s) => ({ doseMg: parseDose(s.dose)!, days: parseDays(s.days)! })),
          note: note.trim(),
        }
      : null;
  const drugMissing = drug.trim() === '';
  const stepsMessage = steps.some((s) => doseRejected(s) || daysRejected(s)) || (attempted && !stepsValid);

  const patchStep = (key: number, changes: Partial<StepDraft>): void =>
    setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...changes } : s)));

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (!course || drugMissing) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveSteroidCourse(course);
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteSteroidCourse(initial.id);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'steroid_edit' : 'steroid_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <TextField
          label={t('steroid_drug')}
          value={drug}
          onInput={setDrug}
          autocomplete="off"
          autocapitalize="sentences"
          error={drugMissing ? t('profile_not_set') : null}
          showError={attempted}
          required
        />
        <div class="steroid-chips" role="group" aria-label={t('steroid_drug')}>
          {drugSuggestions().map((name) => (
            <button key={name} type="button" class="steroid-chip" aria-pressed={drug === name} onClick={() => setDrug(name)}>
              {name}
            </button>
          ))}
        </div>
        <TextField
          label={t('steroid_start')}
          type="date"
          value={start}
          onInput={setStart}
          error={ISO_DATE.test(start) ? null : t('profile_not_set')}
          showError={attempted}
          required
        />

        <fieldset class="stack-sm steroid-steps">
          <legend class="care-legend">{t('steroid_steps')}</legend>
          <p class="text-muted text-sm">{t('steroid_steps_hint')}</p>
          {steps.map((step) => (
            <StepFields
              key={step.key}
              step={step}
              errorId={stepsMessage ? stepsErrorId : undefined}
              attempted={attempted}
              canRemove={steps.length > 1}
              onChange={(changes) => patchStep(step.key, changes)}
              onRemove={() => setSteps((list) => list.filter((s) => s.key !== step.key))}
            />
          ))}
          {stepsMessage && <p class="error-msg" id={stepsErrorId} role="alert">{t('steroid_steps_invalid')}</p>}
          <div class="steroid-steps-actions">
            <Button
              variant="tonal"
              onClick={() => {
                setSteps((list) => [...list, { key: nextKey, dose: '', days: '' }]);
                setNextKey(nextKey + 1);
              }}
            >
              {t('steroid_add_step')}
            </Button>
          </div>
        </fieldset>

        {course && (
          <p class="steroid-summary" aria-live="polite">
            {tp('steroid_summary', steroidTotalDays(course), [
              formatMg(steroidTotalMg(course)),
              steroidTotalDays(course),
              formatLocalDate(steroidEnd(course)),
            ])}
          </p>
        )}
        <NoteField label={t('steroid_note')} value={note} onInput={setNote} />

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

/** One step: daily dose (mg) and number of days, with a remove button (kept while at least two steps remain). */
function StepFields({ step, errorId, attempted, canRemove, onChange, onRemove }: {
  step: StepDraft;
  errorId: string | undefined;
  attempted: boolean;
  canRemove: boolean;
  onChange: (changes: Partial<StepDraft>) => void;
  onRemove: () => void;
}) {
  const doseId = useId();
  const daysId = useId();
  // Invalid when typed wrongly, or empty once a save was attempted (the shared message below explains both).
  const doseInvalid = doseRejected(step) || (attempted && parseDose(step.dose) === null);
  const daysInvalid = daysRejected(step) || (attempted && parseDays(step.days) === null);
  return (
    <div class="steroid-step">
      <div class="field" data-invalid={doseInvalid ? '' : undefined}>
        <label class="field-name" for={doseId}>{t('steroid_dose')}</label>
        <div class="field-control">
          <input
            id={doseId}
            class="input steroid-dose-input"
            type="text"
            inputMode="decimal"
            autocomplete="off"
            value={step.dose}
            aria-invalid={doseInvalid ? 'true' : 'false'}
            aria-describedby={doseInvalid ? errorId : undefined}
            onInput={(e) => onChange({ dose: e.currentTarget.value })}
          />
          <span class="steroid-unit" aria-hidden="true">{t('steroid_mg')}</span>
        </div>
      </div>
      <div class="field" data-invalid={daysInvalid ? '' : undefined}>
        <label class="field-name" for={daysId}>{t('steroid_days')}</label>
        <input
          id={daysId}
          class="input"
          type="text"
          inputMode="numeric"
          autocomplete="off"
          value={step.days}
          aria-invalid={daysInvalid ? 'true' : 'false'}
          aria-describedby={daysInvalid ? errorId : undefined}
          onInput={(e) => onChange({ days: e.currentTarget.value })}
        />
      </div>
      <button type="button" class="icon-btn" aria-label={t('steroid_remove_step')} disabled={!canRemove} onClick={onRemove}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

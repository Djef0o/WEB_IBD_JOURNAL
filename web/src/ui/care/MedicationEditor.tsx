import { useState } from 'preact/hooks';
import { deleteMedication, saveMedication } from '../../db/medications';
import {
  medication as newMedication, nextRefillAlert, REFILL_LEAD_DAYS, refillBasis, type Medication,
} from '../../domain/profile';
import { localDateTimeAt, today, type LocalDateTime } from '../../domain/time';
import { t } from '../../i18n';
import { dateTimeLabel } from '../../reminders/text';
import { Button, Sheet, Switch } from '../components';
import { TextField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import { MedicationPicker } from './MedicationPicker';
import { ScheduleFields } from './ScheduleFields';
import { draftFromSchedule, newDraft, scheduleFromDraft } from './scheduleDraft';

/** "Order: alert Monday, November 23 at 08:00", or null without an upcoming alert (`refillStatus`). */
export function refillStatus(medication: Medication, now: LocalDateTime): string | null {
  const next = nextRefillAlert(medication, now);
  return next === null ? null : t('refill_next', [dateTimeLabel(next)]);
}

interface MedicationEditorProps {
  /** null: new treatment. */
  initial: Medication | null;
  onClose: () => void;
}

/** Treatment sheet: name (standard list or free), dosage, schedule, reorder alert (`MedicationEditorSheet`). */
export function MedicationEditor({ initial, onClose }: MedicationEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [draft, setDraft] = useState(() => (initial ? draftFromSchedule(initial.schedule) : newDraft('DAY', today())));
  const [refillAlert, setRefillAlert] = useState(initial?.refillAlert ?? false);
  const [stockEnd, setStockEnd] = useState(initial?.stockEndDate ?? '');
  const [picking, setPicking] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const schedule = scheduleFromDraft(draft);
  const draftMedication: Medication | null = schedule && {
    id: initial?.id ?? 0,
    name: name.trim(),
    dosage: dosage.trim(),
    schedule,
    refillAlert,
    stockEndDate: /^\d{4}-\d{2}-\d{2}$/.test(stockEnd) ? stockEnd : null,
  };
  const basis = draftMedication ? refillBasis(draftMedication) : null;
  // In "end of stock" mode, the alert makes no sense without the date.
  const stockMissing = refillAlert && basis === 'STOCK_END' && draftMedication?.stockEndDate === null;
  const nameMissing = name.trim() === '';
  const status = refillAlert && draftMedication ? refillStatus(draftMedication, localDateTimeAt(Date.now())) : null;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (!draftMedication || nameMissing || stockMissing) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    await saveMedication(initial ? { ...initial, ...draftMedication } : newMedication(draftMedication));
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteMedication(initial.id);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={t(initial ? 'treatment_edit' : 'treatment_add')}
      closeLabel={t('close')}
      lightDismiss={false}
    >
      <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
        <div class="care-name-row">
          <TextField
            label={t('treatment_name')}
            value={name}
            onInput={setName}
            autocomplete="off"
            autocapitalize="sentences"
            error={nameMissing ? t('treatment_choose') : null}
            showError={attempted}
            required
          />
          <Button variant="tonal" onClick={() => setPicking(true)}>{t('treatment_choose')}</Button>
        </div>
        <TextField
          label={t('treatment_dosage')}
          hint={t('treatment_dosage_hint')}
          value={dosage}
          onInput={setDosage}
          autocomplete="off"
        />
        <ScheduleFields draft={draft} onChange={setDraft} dateLabel={t('treatment_start_date')} showErrors={attempted} />

        <div class="stack-sm">
          <Switch label={t('refill_alert_label', [REFILL_LEAD_DAYS])} checked={refillAlert} onChange={setRefillAlert} />
          {refillAlert && basis === 'BEFORE_DOSE' && <p class="text-muted text-sm">{t('refill_hint_dose', [REFILL_LEAD_DAYS])}</p>}
          {refillAlert && basis === 'STOCK_END' && (
            <>
              <TextField
                label={t('refill_stock_end')}
                type="date"
                value={stockEnd}
                onInput={setStockEnd}
                error={stockMissing ? t('profile_not_set') : null}
                showError={attempted}
                required
              />
              <p class="text-muted text-sm">{t('refill_hint_stock', [REFILL_LEAD_DAYS])}</p>
            </>
          )}
          {refillAlert && status !== null && <p class="text-muted text-sm">{status}</p>}
        </div>

        <div class="dialog-actions">
          {initial && <Button variant="danger" onClick={() => void remove()} aria-disabled={busy || undefined}>{t('delete')}</Button>}
          <span class="spacer" />
          <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" aria-disabled={busy || undefined}>{t('save')}</Button>
        </div>
      </form>
      {picking && (
        <MedicationPicker
          initialQuery={name}
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            setName(picked);
            setPicking(false);
          }}
        />
      )}
    </Sheet>
  );
}

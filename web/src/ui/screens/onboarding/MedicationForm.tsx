import { useState } from 'preact/hooks';
import { deleteMedication, saveMedication } from '../../../db/medications';
import { medication as newMedication, reminderSchedule, REPEAT_UNITS, type Medication, type RepeatUnit } from '../../../domain/profile';
import { STANDARD_MEDICATIONS, type StandardMedication } from '../../../domain/standardMedications';
import { today } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { Button, Switch } from '../../components';
import { formatTime } from '../../format';
import { SelectField, TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';

const SUPPORTIVE_LABEL: Record<NonNullable<StandardMedication['supportive']>, () => string> = {
  IRON: () => t('med_iron'),
  VITAMIN_D: () => t('med_vitamin_d'),
  VITAMIN_B12: () => t('med_vitamin_b12'),
  FOLIC_ACID: () => t('med_folic_acid'),
  CALCIUM: () => t('med_calcium'),
  LOPERAMIDE: () => t('med_loperamide'),
};

/** Noms proposés dans la liste de suggestions : DCI, ou libellé traduit des traitements de soutien. */
export function standardMedicationNames(): string[] {
  return STANDARD_MEDICATIONS.map((m) => (m.inn ?? (m.supportive ? SUPPORTIVE_LABEL[m.supportive]() : '')));
}

const UNIT_LABEL: Record<RepeatUnit, () => string> = {
  ONCE: () => t('repeat_unit_once'),
  DAY: () => t('repeat_unit_day'),
  WEEK: () => t('repeat_unit_week'),
  MONTH: () => t('repeat_unit_month'),
};

/** Résumé lisible de la périodicité, ex. « Toutes les 2 semaines · 08:00 ». */
export function describeSchedule(med: Medication): string {
  const { repeatUnit, repeatEvery, hour, minute, enabled } = med.schedule;
  const repeat =
    repeatUnit === 'ONCE'
      ? t('repeat_once')
      : repeatUnit === 'DAY'
        ? tp('repeat_every_days', repeatEvery)
        : repeatUnit === 'WEEK'
          ? tp('repeat_every_weeks', repeatEvery)
          : tp('repeat_every_months', repeatEvery);
  const parts = [repeat, formatTime(hour, minute)];
  if (!enabled) parts.push(t('reminder_off'));
  return parts.join(' · ');
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Saisie d'un traitement (nom, dosage, périodicité, rappel). Les autres options se règlent ensuite dans Soins. */
export function MedicationForm({ initial, onDone }: { initial: Medication | null; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [startDate, setStartDate] = useState(initial?.schedule.startDate ?? today());
  const [time, setTime] = useState(initial ? `${pad(initial.schedule.hour)}:${pad(initial.schedule.minute)}` : '08:00');
  const [unit, setUnit] = useState<RepeatUnit>(initial?.schedule.repeatUnit ?? 'DAY');
  const [every, setEvery] = useState(String(initial?.schedule.repeatEvery ?? 1));
  const [enabled, setEnabled] = useState(initial?.schedule.enabled ?? true);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);

  const nameMissing = name.trim() === '';
  const everyNumber = Number.parseInt(every, 10);
  const everyInvalid = unit !== 'ONCE' && !(everyNumber >= 1 && everyNumber <= 365);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const timeMatch = /^(\d{2}):(\d{2})/.exec(time);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (nameMissing || everyInvalid || !dateValid || !timeMatch) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    const schedule = reminderSchedule({
      startDate,
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2]),
      repeatUnit: unit,
      repeatEvery: unit === 'ONCE' ? 1 : everyNumber,
      enabled,
    });
    await saveMedication(
      initial
        ? { ...initial, name: name.trim(), dosage: dosage.trim(), schedule }
        : newMedication({ name: name.trim(), dosage: dosage.trim(), schedule }),
    );
    onDone();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await deleteMedication(initial.id);
    onDone();
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)} noValidate>
      <TextField
        label={t('treatment_name')}
        hint={t('treatment_other_desc')}
        value={name}
        onInput={setName}
        list="standard-medications"
        autocomplete="off"
        error={nameMissing ? t('treatment_choose') : null}
        showError={attempted}
        required
      />
      <datalist id="standard-medications">
        {standardMedicationNames().map((n) => <option key={n} value={n} />)}
      </datalist>
      <TextField label={t('treatment_dosage')} hint={t('treatment_dosage_hint')} value={dosage} onInput={setDosage} autocomplete="off" />
      <div class="form-grid-2">
        <TextField
          label={t('treatment_start_date')}
          type="date"
          value={startDate}
          onInput={setStartDate}
          error={dateValid ? null : t('profile_not_set')}
          showError={attempted}
          required
        />
        <TextField
          label={t('reminder_time')}
          type="time"
          value={time}
          onInput={setTime}
          error={timeMatch ? null : t('profile_not_set')}
          showError={attempted}
          required
        />
      </div>
      <div class="form-grid-2">
        <SelectField
          label={t('repeat_label')}
          value={unit}
          options={REPEAT_UNITS.map((u) => ({ value: u, label: UNIT_LABEL[u]() }))}
          onChange={setUnit}
        />
        {unit !== 'ONCE' && (
          <TextField
            label={t('web_repeat_every')}
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            step={1}
            value={every}
            onInput={setEvery}
            error={everyInvalid ? t('web_repeat_every_invalid') : null}
            showError={attempted}
            required
          />
        )}
      </div>
      <Switch label={t('reminder_enabled')} description={t('reminder_enabled_desc')} checked={enabled} onChange={setEnabled} />
      <div class="dialog-actions">
        {initial && <Button variant="danger" type="button" onClick={() => void remove()} aria-disabled={busy || undefined}>{t('delete')}</Button>}
        <span class="spacer" />
        <Button variant="text" type="button" onClick={onDone}>{t('cancel')}</Button>
        <Button type="submit" aria-disabled={busy || undefined}>{t('save')}</Button>
      </div>
    </form>
  );
}

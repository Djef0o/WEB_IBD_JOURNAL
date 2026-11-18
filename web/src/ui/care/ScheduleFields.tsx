import { t } from '../../i18n';
import { REPEAT_UNITS, type RepeatUnit } from '../../domain/profile';
import { Switch } from '../components';
import { SelectField, TextField } from '../forms';
import { repeatSummary } from '../../reminders/text';
import { MAX_REPEAT_EVERY, scheduleFromDraft, validateDraft, type ScheduleDraft } from './scheduleDraft';
import { Stepper } from './Stepper';

const UNIT_LABEL: Readonly<Record<RepeatUnit, () => string>> = {
  ONCE: () => t('repeat_unit_once'),
  DAY: () => t('repeat_unit_day'),
  WEEK: () => t('repeat_unit_week'),
  MONTH: () => t('repeat_unit_month'),
};

interface ScheduleFieldsProps {
  draft: ScheduleDraft;
  onChange: (draft: ScheduleDraft) => void;
  dateLabel: string;
  /** Show the errors (a save was attempted). */
  showErrors: boolean;
}

/** Date, time, recurrence and reminder switch (`ScheduleEditor`). */
export function ScheduleFields({ draft, onChange, dateLabel, showErrors }: ScheduleFieldsProps) {
  const validity = validateDraft(draft);
  const schedule = scheduleFromDraft(draft);
  return (
    <div class="stack">
      <div class="form-grid-2">
        <TextField
          label={dateLabel}
          type="date"
          value={draft.startDate}
          onInput={(startDate) => onChange({ ...draft, startDate })}
          error={validity.date ? null : t('profile_not_set')}
          showError={showErrors}
          required
        />
        <TextField
          label={t('hour')}
          type="time"
          value={draft.time}
          onInput={(time) => onChange({ ...draft, time })}
          error={validity.time ? null : t('profile_not_set')}
          showError={showErrors}
          required
        />
      </div>
      <SelectField
        label={t('repeat_label')}
        value={draft.unit}
        options={REPEAT_UNITS.map((unit) => ({ value: unit, label: UNIT_LABEL[unit]() }))}
        onChange={(unit) => onChange({ ...draft, unit })}
      />
      {draft.unit !== 'ONCE' && (
        <div class="care-line">
          <span>{schedule ? repeatSummary(schedule) : ''}</span>
          <Stepper
            value={draft.every}
            min={1}
            max={MAX_REPEAT_EVERY}
            label={t('web_repeat_every')}
            onChange={(every) => onChange({ ...draft, every })}
          />
        </div>
      )}
      <Switch
        label={t('reminder_enabled')}
        description={t('reminder_enabled_desc')}
        checked={draft.enabled}
        onChange={(enabled) => onChange({ ...draft, enabled })}
      />
    </div>
  );
}

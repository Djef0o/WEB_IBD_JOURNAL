import { useId, useState } from 'preact/hooks';
import { LAB_QUALIFIERS, LAB_TESTS, labResult, labTestCategory, labTestUnit, type LabCategory, type LabQualifier, type LabResult, type LabTest } from '../../domain/health';
import { today } from '../../domain/time';
import { t } from '../../i18n';
import { Button, SegmentedControl, Sheet } from '../components';
import { TextField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import { formatLabValue, labCategoryLabel, labTestLabel, qualifierLabel, QUALIFIER_SYMBOL } from './labFormat';
import { parseLabBound, parseLabValue } from './labValues';

/** Entry in progress: `result` null = new result, `test` = preselected test. */
export interface LabEditing {
  result: LabResult | null;
  test: LabTest;
}

interface Props {
  editing: LabEditing | null;
  onSave(result: LabResult): void;
  onDelete(result: LabResult): void;
  onClose(): void;
}

export function LabEditorSheet({ editing, onSave, onDelete, onClose }: Props) {
  const adding = editing?.result == null;
  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={adding ? t('lab_result_add') : t('lab_result_edit')}
      closeLabel={t('cancel')}
      lightDismiss={false}
    >
      {editing && <LabEditorForm editing={editing} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </Sheet>
  );
}

const CATEGORY_ORDER: LabCategory[] = [...new Set(LAB_TESTS.map(labTestCategory))];

function boundText(value: number | null | undefined): string {
  return value == null ? '' : formatLabValue(value, false);
}

function LabEditorForm({ editing, onSave, onDelete, onClose }: Omit<Props, 'editing'> & { editing: LabEditing }) {
  const initial = editing.result;
  const testId = useId();
  const [test, setTest] = useState<LabTest>(initial?.test ?? editing.test);
  const [qualifier, setQualifier] = useState<LabQualifier>(initial?.qualifier ?? 'EXACT');
  const [valueText, setValueText] = useState(initial ? formatLabValue(initial.value, false) : '');
  const [date, setDate] = useState(initial?.date ?? today());
  const [note, setNote] = useState(initial?.note ?? '');
  // Lab reference values printed on the report, optional.
  const [lowText, setLowText] = useState(boundText(initial?.referenceLow));
  const [highText, setHighText] = useState(boundText(initial?.referenceHigh));
  const [attempted, setAttempted] = useState(false);

  const unit = labTestUnit(test);
  const value = parseLabValue(valueText);
  const low = parseLabBound(lowText);
  const high = parseLabBound(highText);
  const lowInvalid = lowText.trim() !== '' && low === null;
  const highInvalid = highText.trim() !== '' && high === null;
  const reversed = low !== null && high !== null && low > high;
  const dateValid = date !== '' && date <= today();
  const canSave = value !== null && !lowInvalid && !highInvalid && !reversed && dateValid;

  const submit = (event: Event) => {
    event.preventDefault();
    if (!canSave || value === null) {
      setAttempted(true);
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    const base = initial ?? labResult({ test, value, date });
    onSave({ ...base, test, value, date, note: note.trim(), qualifier, referenceLow: low, referenceHigh: high });
    onClose();
  };

  return (
    <form class="lab-form" onSubmit={submit} noValidate>
      <div class="field">
        <label class="field-name" for={testId}>{t('lab_result_test')}</label>
        <select
          id={testId}
          class="input"
          onChange={(e) => {
            const next = e.currentTarget.value as LabTest;
            if (next !== test) {
              setTest(next);
              // The lab's reference values apply to the original test only.
              setLowText('');
              setHighText('');
            }
          }}
        >
          {CATEGORY_ORDER.map((category) => (
            <optgroup key={category} label={labCategoryLabel(category)}>
              {LAB_TESTS.filter((option) => labTestCategory(option) === category).map((option) => (
                <option key={option} value={option} selected={option === test}>
                  {labTestLabel(option)} ({labTestUnit(option)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div class="lab-qualifier">
        <SegmentedControl
          label={t('web_lab_qualifier')}
          hideLabel={false}
          value={qualifier}
          onChange={setQualifier}
          options={LAB_QUALIFIERS.map((q) => ({ value: q, label: `${QUALIFIER_SYMBOL[q]} ${qualifierLabel(q)}` }))}
        />
      </div>
      <TextField
        label={`${t('lab_result_value')} (${unit})`}
        value={valueText}
        onInput={setValueText}
        inputMode="decimal"
        autocomplete="off"
        required
        error={value === null ? t('lab_result_value_invalid') : null}
        showError={attempted}
      />
      <TextField
        label={t('lab_result_date')}
        type="date"
        value={date}
        onInput={setDate}
        max={today()}
        required
        error={dateValid ? null : t('web_lab_date_invalid')}
        showError={attempted}
      />
      <fieldset class="stack-sm">
        <legend class="field-name">{t('lab_result_reference_title')}</legend>
        <p class="text-muted text-sm">{t('lab_result_reference_desc')}</p>
        <div class="form-grid-2">
          <TextField
            label={`${t('lab_result_reference_low')} (${unit})`}
            value={lowText}
            onInput={setLowText}
            inputMode="decimal"
            autocomplete="off"
            error={lowInvalid ? t('lab_result_number_invalid') : reversed ? t('lab_result_reference_reversed') : null}
            showError={attempted}
          />
          <TextField
            label={`${t('lab_result_reference_high')} (${unit})`}
            value={highText}
            onInput={setHighText}
            inputMode="decimal"
            autocomplete="off"
            error={highInvalid ? t('lab_result_number_invalid') : null}
            showError={attempted}
          />
        </div>
      </fieldset>
      <TextField label={t('lab_result_note')} value={note} onInput={setNote} autocapitalize="sentences" />
      <div class="lab-form-actions">
        {initial && (
          <Button variant="text" class="lab-delete" onClick={() => { onDelete(initial); onClose(); }}>{t('delete')}</Button>
        )}
        <span class="spacer" />
        <button type="submit" class="btn" data-variant="filled">{t('save')}</button>
      </div>
    </form>
  );
}

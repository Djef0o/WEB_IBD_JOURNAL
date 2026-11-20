import './weight.css';
import { useMemo, useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { deleteWeight, getAllWeights, saveWeight } from '../../db/weights';
import type { Weight } from '../../domain/models';
import { today } from '../../domain/time';
import { t } from '../../i18n';
import { Button, Card, SegmentedControl, showToast } from '../components';
import { TextField } from '../forms';
import { formatDecimal, formatLocalDate } from '../format';
import type { LabPeriodId } from '../labs/labValues';
import { WeightChart } from './WeightChart';
import { parseKg, weightsByPeriod } from './weightChart';

// i18n-keys: lab_period_6_months lab_period_1_year lab_period_all
const periodOptions = (): { value: LabPeriodId; label: string }[] => [
  { value: '6m', label: t('lab_period_6_months') },
  { value: '1y', label: t('lab_period_1_year') },
  { value: 'all', label: t('lab_period_all') },
];

/** Below this, the change is rounded to "+0,0" and would read as a change (`WeightCard`). */
const UNCHANGED_KG = 0.05;

/**
 * Weight entry (new or edit of a measurement), latest weight with its change since the previous
 * weighing, curve over the chosen window and the list of measurements (`WeightUi.kt`).
 */
export function WeightCard() {
  const weights = useLiveQuery(['weights'], getAllWeights, []);
  const [editing, setEditing] = useState<Weight | null>(null);
  const [date, setDate] = useState(today());
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /** Remounts the field after a save so that it does not show an error while empty. */
  const [fieldKey, setFieldKey] = useState(0);
  const kg = parseKg(text);
  const recent = useMemo(() => (weights ? [...weights].reverse() : []), [weights]);
  const [period, setPeriod] = useState<LabPeriodId>('6m');
  const byPeriod = useMemo(() => weightsByPeriod(weights ?? [], today()), [weights]);
  // No weighing in the chosen window: whole history (as on Android).
  const shown: LabPeriodId = byPeriod[period].length === 0 ? 'all' : period;

  const reset = (): void => {
    setEditing(null);
    setDate(today());
    setText('');
    setSubmitted(false);
    setFieldKey((k) => k + 1);
  };

  const edit = (weight: Weight): void => {
    setEditing(weight);
    setDate(weight.date);
    setText(String(weight.kg));
    setSubmitted(false);
    setFieldKey((k) => k + 1);
  };

  const save = (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (kg === null || date === '' || date > today()) return;
    void saveWeight({ id: editing?.id ?? 0, date, kg }).then(() => {
      showToast(t('web_weight_saved'));
      reset();
    });
  };

  const remove = (weight: Weight): void => {
    void deleteWeight(weight.id);
    if (editing?.id === weight.id) reset();
  };

  const last = weights?.[weights.length - 1];
  const previous = weights && weights.length > 1 ? weights[weights.length - 2] : undefined;
  const delta = last && previous ? last.kg - previous.kg : null;
  const since = previous ? formatLocalDate(previous.date, { dateStyle: 'medium' }) : '';

  return (
    <Card variant="outlined" title={t('web_weight_title')}>
      <div class="stack">
        <form class="weight-form" onSubmit={save} noValidate>
          <TextField
            key={fieldKey}
            label={t('web_weight_kg_label')}
            value={text}
            onInput={setText}
            inputMode="decimal"
            autocomplete="off"
            required
            error={kg === null ? t('weight_value_invalid') : null}
            showError={submitted}
          />
          <TextField
            label={t('web_weight_date_label')}
            type="date"
            value={date}
            onInput={setDate}
            max={today()}
            required
            error={date === '' || date > today() ? t('web_weight_invalid_date') : null}
            showError={submitted}
          />
          <div class="weight-form-actions">
            <Button type="submit">{editing ? t('save') : t('web_weight_save')}</Button>
            {editing && <Button variant="text" onClick={reset}>{t('cancel')}</Button>}
          </div>
        </form>

        {weights && weights.length === 0 && <p class="text-muted">{t('weights_empty')}</p>}
        {last && (
          <>
            <p>
              <strong class="weight-latest">{formatDecimal(last.kg)} kg</strong>
              <br />
              <span class="text-muted">{t('weight_latest', [formatLocalDate(last.date, { dateStyle: 'medium' })])}</span>
              {delta !== null && (
                <>
                  <br />
                  <span class="text-muted">
                    {Math.abs(delta) < UNCHANGED_KG
                      ? t('weight_unchanged', [since])
                      : t('weight_change', [`${delta > 0 ? '+' : ''}${formatDecimal(delta)}`, since])}
                  </span>
                </>
              )}
            </p>
            {/* i18n-keys: lab_period_6_months lab_period_1_year lab_period_all */}
            <SegmentedControl
              options={periodOptions().filter((p) => byPeriod[p.value].length > 0 || p.value === shown)}
              value={shown}
              onChange={setPeriod}
              label={t('web_lab_period')}
            />
            <WeightChart weights={byPeriod[shown]} />
            <details class="weight-list">
              <summary>{t('web_weight_history')}</summary>
              <ul role="list">
                {recent.map((w) => {
                  const day = formatLocalDate(w.date, { dateStyle: 'medium' });
                  return (
                    <li key={w.id}>
                      <span>{day}</span>
                      <span class="weight-value">{formatDecimal(w.kg)} kg</span>
                      <Button variant="text" aria-label={`${t('weight_edit')}: ${day}`} onClick={() => edit(w)}>
                        {t('modify')}
                      </Button>
                      <Button variant="text" aria-label={t('web_weight_delete', [day])} onClick={() => remove(w)}>
                        {t('delete')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}

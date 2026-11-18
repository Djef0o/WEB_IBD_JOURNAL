import './weight.css';
import { useMemo, useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { deleteWeight, getAllWeights, saveWeight } from '../../db/weights';
import { today } from '../../domain/time';
import { t } from '../../i18n';
import { Button, Card, showToast } from '../components';
import { TextField } from '../forms';
import { formatDecimal, formatLocalDate } from '../format';
import { WeightChart } from './WeightChart';
import { parseKg } from './weightChart';

/** Weight entry (one value per day), curve over the whole history and the list of measurements. */
export function WeightCard() {
  const weights = useLiveQuery(['weights'], getAllWeights, []);
  const [date, setDate] = useState(today());
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /** Remounts the field after a save so that it does not show an error while empty. */
  const [fieldKey, setFieldKey] = useState(0);
  const kg = parseKg(text);
  const recent = useMemo(() => (weights ? [...weights].reverse() : []), [weights]);

  const save = (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (kg === null || date === '' || date > today()) return;
    void saveWeight({ id: 0, date, kg }).then(() => {
      showToast(t('web_weight_saved'));
      setText('');
      setSubmitted(false);
      setFieldKey((k) => k + 1);
    });
  };

  const first = weights?.[0];
  const last = weights?.[weights.length - 1];
  const change = first && last && first !== last ? last.kg - first.kg : null;

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
            error={kg === null ? t('web_weight_invalid') : null}
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
          <Button type="submit">{t('web_weight_save')}</Button>
        </form>

        {weights && weights.length === 0 && <p class="text-muted">{t('web_weight_empty')}</p>}
        {last && (
          <>
            <p>
              <strong>{t('web_weight_latest', [formatDecimal(last.kg)])}</strong>
              {change !== null && (
                <span class="text-muted">
                  {' · '}
                  {t('web_weight_change', [`${change > 0 ? '+' : ''}${formatDecimal(change)}`, formatLocalDate(first!.date, { dateStyle: 'medium' })])}
                </span>
              )}
            </p>
            <WeightChart weights={weights!} />
            <details class="weight-list">
              <summary>{t('web_weight_history')}</summary>
              <ul role="list">
                {recent.map((w) => (
                  <li key={w.id}>
                    <span>{formatLocalDate(w.date, { dateStyle: 'medium' })}</span>
                    <span class="weight-value">{formatDecimal(w.kg)} kg</span>
                    <Button
                      variant="text"
                      aria-label={t('web_weight_delete', [formatLocalDate(w.date, { dateStyle: 'medium' })])}
                      onClick={() => { void deleteWeight(w.id); }}
                    >
                      {t('delete')}
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}

import { useMemo, useState } from 'preact/hooks';
import { labTestUnit, type LabResult, type LabTest } from '../../domain/health';
import { labReference, labStatus } from '../../domain/labReference';
import { today } from '../../domain/time';
import { t } from '../../i18n';
import { Button, SegmentedControl, Sheet } from '../components';
import { formatLocalDate } from '../format';
import { displayValue, labTestLabel, statusLabel, STATUS_ARROW } from './labFormat';
import { LabChart } from './LabChart';
import { LAB_PERIODS, resultsByPeriod, type LabPeriodId } from './labValues';

interface Props {
  open: boolean;
  test: LabTest;
  /** From most recent to oldest. */
  history: LabResult[];
  onClose(): void;
  onAdd(): void;
  onEdit(result: LabResult): void;
}

const PERIOD_LABEL: Record<LabPeriodId, string> = {
  '6m': 'lab_period_6_months',
  '1y': 'lab_period_1_year',
  all: 'lab_period_all',
};

/** Chart then table of a test's results. */
export function LabDetailSheet({ open, test, history, onClose, onAdd, onEdit }: Props) {
  const unit = labTestUnit(test);
  // The lab's reference values from the latest report draw the band; none without them.
  const reference = labReference(history[0]!);
  const byPeriod = useMemo(() => resultsByPeriod(history, today()), [history]);
  const [period, setPeriod] = useState<LabPeriodId>('1y');
  // No point in the chosen window: whole history.
  const shown: LabPeriodId = byPeriod[period].length === 0 ? 'all' : period;
  const options = LAB_PERIODS.filter((p) => byPeriod[p.id].length > 0 || p.id === shown).map((p) => ({
    value: p.id,
    // i18n-keys: lab_period_6_months lab_period_1_year lab_period_all
    label: t(PERIOD_LABEL[p.id]),
  }));
  return (
    <Sheet open={open} onClose={onClose} title={`${labTestLabel(test)} (${unit})`} closeLabel={t('close')}>
      <div class="lab-detail">
        <SegmentedControl options={options} value={shown} onChange={setPeriod} label={t('web_lab_period')} />
        <LabChart test={test} points={byPeriod[shown]} reference={reference} />
        <table class="lab-results">
          <caption class="visually-hidden">{t('web_lab_results_table', [labTestLabel(test)])}</caption>
          <thead>
            <tr>
              <th scope="col">{t('lab_result_date')}</th>
              <th scope="col">{t('lab_result_value')}</th>
              <th scope="col">{t('lab_result_note')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((result) => {
              const status = labStatus(result);
              return (
                <tr key={result.id}>
                  <th scope="row">
                    <button type="button" class="lab-link-btn" onClick={() => onEdit(result)}>
                      {formatLocalDate(result.date, { dateStyle: 'medium' })}
                      <span class="visually-hidden"> – {t('lab_result_edit')}</span>
                    </button>
                  </th>
                  <td>
                    {displayValue(result, true, unit)}
                    {status && <> <span class="lab-chip">{STATUS_ARROW[status]} {statusLabel(status)}</span></>}
                  </td>
                  <td class="lab-note">{result.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div class="lab-detail-actions">
          <Button variant="tonal" onClick={onAdd}>{t('add')}</Button>
        </div>
      </div>
    </Sheet>
  );
}

import { useId, useMemo } from 'preact/hooks';
import { labTestUnit, type LabResult, type LabTest } from '../../domain/health';
import { labStatus } from '../../domain/labReference';
import { dateParts, today } from '../../domain/time';
import { formatDate, t } from '../../i18n';
import { formatLocalDate } from '../format';
import { displayValue, labCategoryLabel, labTestLabel, statusLabel, STATUS_ARROW } from './labFormat';
import { panelTable } from './labValues';

interface Props {
  histories: ReadonlyMap<LabTest, LabResult[]>;
  onEditResult(result: LabResult): void;
}

/**
 * One row per test, grouped under a category; one column per collection date, most recent
 * first. Column and row headers stay in view while the dates scroll horizontally.
 */
export function LabPanelTable({ histories, onEditResult }: Props) {
  const captionId = useId();
  const table = useMemo(() => panelTable(histories), [histories]);
  const currentYear = dateParts(today()).year;
  const columns = table.dates.length + 1;
  return (
    <div class="lab-table-wrap" tabIndex={0} role="region" aria-labelledby={captionId}>
      <table class="lab-table">
        <caption id={captionId} class="visually-hidden">{t('web_lab_table_caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('lab_table_test')}</th>
            {table.dates.map((date) => {
              const { year, month, day } = dateParts(date);
              return (
                <th scope="col" key={date}>
                  <time dateTime={date}>{formatDate(new Date(year, month - 1, day), { day: 'numeric', month: 'short' })}</time>
                  {year !== currentYear && <span class="lab-year">{year}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        {table.groups.map(({ category, tests }) => (
          <tbody key={category}>
            <tr>
              <th scope="rowgroup" colSpan={columns}>
                <span class="lab-sticky-label">{labCategoryLabel(category)}</span>
              </th>
            </tr>
            {tests.map((test) => (
              <tr key={test}>
                <th scope="row">
                  {labTestLabel(test)}
                  <small>{labTestUnit(test)}</small>
                </th>
                {table.dates.map((date) => {
                  const result = table.cell(test, date);
                  if (!result) {
                    return <td key={date}><span class="lab-empty-cell">–</span></td>;
                  }
                  const status = labStatus(result);
                  const text = displayValue(result, false, '');
                  return (
                    <td key={date}>
                      <button
                        type="button"
                        class="lab-cell"
                        data-outside={status ? '' : undefined}
                        aria-label={`${labTestLabel(test)}, ${formatLocalDate(date, { dateStyle: 'medium' })}: ${displayValue(result, true, labTestUnit(test))}${status ? `, ${statusLabel(status)}` : ''}`}
                        onClick={() => onEditResult(result)}
                      >
                        {status && <span aria-hidden="true">{STATUS_ARROW[status]}</span>}
                        {text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

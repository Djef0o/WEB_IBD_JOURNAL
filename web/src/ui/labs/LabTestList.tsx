import { useMemo } from 'preact/hooks';
import type { LabResult, LabTest } from '../../domain/health';
import { labStatus } from '../../domain/labReference';
import { labTestUnit } from '../../domain/health';
import { t } from '../../i18n';
import { formatLocalDate } from '../format';
import { displayValue, labCategoryLabel, labTestLabel, statusLabel, STATUS_ARROW } from './labFormat';
import { LabSparkline } from './LabSparkline';
import { groupTests, SPARKLINE_POINTS } from './labValues';

interface Props {
  histories: ReadonlyMap<LabTest, LabResult[]>;
  onOpenTest(test: LabTest): void;
}

/**
 * Tests outside the lab's reference values first, then the others by category; each row shows
 * the latest value, its status and the curve of the last results.
 */
export function LabTestList({ histories, onOpenTest }: Props) {
  const groups = useMemo(() => groupTests(histories, labStatus), [histories]);
  return (
    <>
      {groups.map((group) => (
        <section class="lab-group" key={group.category ?? 'outside'}>
          <h2>{group.category === null ? t('lab_group_outside') : labCategoryLabel(group.category)}</h2>
          <ul class="lab-list">
            {group.entries.map(({ test, history }) => {
              const latest = history[0]!;
              const status = labStatus(latest);
              const recent = history.slice(0, SPARKLINE_POINTS).reverse();
              return (
                <li key={test}>
                  <button type="button" class="lab-row" onClick={() => onOpenTest(test)}>
                    <span class="lab-row-name">
                      {labTestLabel(test)}
                      {status && <span class="lab-chip">{STATUS_ARROW[status]} {statusLabel(status)}</span>}
                    </span>
                    <span class="lab-row-value">
                      {displayValue(latest, true, labTestUnit(test))} · {formatLocalDate(latest.date, { dateStyle: 'medium' })}
                    </span>
                    <LabSparkline points={recent} outside={status !== null} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

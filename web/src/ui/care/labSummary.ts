import type { LabResult, LabTest } from '../../domain/health';
import { labStatus } from '../../domain/labReference';
import type { LocalDate } from '../../domain/time';

/** Per test, newest first (`labHistories`). */
export function labHistories(results: readonly LabResult[]): Map<LabTest, LabResult[]> {
  const byTest = new Map<LabTest, LabResult[]>();
  for (const result of results) {
    const list = byTest.get(result.test);
    if (list) list.push(result);
    else byTest.set(result.test, [result]);
  }
  for (const list of byTest.values()) {
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }
  return byTest;
}

export interface LabSummary {
  latest: LocalDate | null;
  tests: number;
  /** Tests whose latest result is outside the laboratory's own reference values. */
  outside: number;
}

/** Summary shown on the Care screen: latest date, tracked tests, results flagged by the lab. */
export function summarizeLabs(results: readonly LabResult[]): LabSummary {
  const histories = labHistories(results);
  let latest: LocalDate | null = null;
  for (const r of results) if (latest === null || r.date > latest) latest = r.date;
  let outside = 0;
  for (const history of histories.values()) if (labStatus(history[0]!) !== null) outside++;
  return { latest, tests: histories.size, outside };
}

import { formatNumber } from '../../../i18n';

/** "20" for a whole dose, "2,5" otherwise (two decimals at most, no grouping so that the editor can read it back). */
export function formatMg(mg: number): string {
  return Number.isInteger(mg)
    ? String(mg)
    : formatNumber(mg, { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: false });
}

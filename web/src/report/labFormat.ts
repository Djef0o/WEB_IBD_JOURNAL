import type { LabResult } from '../domain/health';
import { labTestUnit } from '../domain/health';
import type { ReferenceRange } from '../domain/labReference';
import { formatNumber } from '../i18n';

/** Up to two decimals, without useless zeros: "12", "0,5", "13,25" (`formatLabValue`). */
export function formatLabValue(value: number, grouping = true): string {
  return formatNumber(value, { maximumFractionDigits: 2, useGrouping: grouping });
}

/** "< 1 mg/L", "12,5 mg/L"; without unit for table cells (`LabResult.displayValue`). */
export function displayLabValue(result: LabResult, withUnit = true): string {
  const prefix = result.qualifier === 'BELOW' ? '< ' : result.qualifier === 'ABOVE' ? '> ' : '';
  const number = prefix + formatLabValue(result.value);
  return withUnit ? `${number} ${labTestUnit(result.test)}` : number;
}

/** "13,4 – 16,7", "< 5", "> 30" (`ReferenceRange.display`). */
export function displayReference(range: ReferenceRange): string {
  const { low, high } = range;
  if (low !== null && high !== null) return `${formatLabValue(low)} – ${formatLabValue(high)}`;
  if (high !== null) return `< ${formatLabValue(high)}`;
  if (low !== null) return `> ${formatLabValue(low)}`;
  return '';
}

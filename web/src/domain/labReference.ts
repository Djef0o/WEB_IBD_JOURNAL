import type { LabResult } from './health';

/** Values printed by the laboratory; a missing bound is not checked (CRP: only a maximum). */
export interface ReferenceRange {
  low: number | null;
  high: number | null;
}

/** Result outside the laboratory's values, as flagged by its report. */
export type LabStatus = 'BELOW' | 'ABOVE';

/** Laboratory values (imported or entered), or null if it gives none: the app provides none. */
export function labReference(result: LabResult): ReferenceRange | null {
  return result.referenceLow !== null || result.referenceHigh !== null
    ? { low: result.referenceLow, high: result.referenceHigh }
    : null;
}

/**
 * Position relative to the laboratory's values; null if inside or without laboratory values.
 * A threshold ("< 1") only says on one side where the value is: "< 1" is never above,
 * "> 300" never below; it is only flagged if the threshold itself is outside the values.
 */
export function labStatus(result: LabResult): LabStatus | null {
  const range = labReference(result);
  if (range === null) return null;
  const { low, high } = range;
  const { value, qualifier } = result;
  if (qualifier !== 'ABOVE' && low !== null && value < low) return 'BELOW';
  if (qualifier === 'BELOW' && low !== null && value <= low) return 'BELOW';
  if (qualifier !== 'BELOW' && high !== null && value > high) return 'ABOVE';
  if (qualifier === 'ABOVE' && high !== null && value >= high) return 'ABOVE';
  return null;
}

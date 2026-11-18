import { describe, expect, it } from 'vitest';
import { LAB_TESTS, labResult, type LabQualifier, type LabTest } from '../src/domain/health';
import { labReference, labStatus } from '../src/domain/labReference';
import { localDate } from '../src/domain/time';

describe('LabReferenceTest', () => {
  const result = (
    test: LabTest,
    value: number,
    qualifier: LabQualifier = 'EXACT',
    low: number | null = null,
    high: number | null = null,
  ) => labResult({
    test, value, date: localDate(2026, 11, 10), qualifier, referenceLow: low, referenceHigh: high,
  });

  it('withoutLabValuesThereIsNoReferenceNorStatus', () => {
    // The app provides no reference value, whatever the value.
    for (const test of LAB_TESTS) {
      expect(labReference(result(test, 0.001))).toBeNull();
      expect(labStatus(result(test, 100_000.0))).toBeNull();
    }
  });

  it('comparesOnlyToTheLabValues', () => {
    expect(labStatus(result('HEMOGLOBIN', 16.1, 'EXACT', 13.4, 16.7))).toBeNull();
    expect(labStatus(result('HEMOGLOBIN', 16.9, 'EXACT', 13.4, 16.7))).toBe('ABOVE');
    expect(labStatus(result('HEMOGLOBIN', 13.0, 'EXACT', 13.4, 16.7))).toBe('BELOW');
    // Threshold alone: no lower bound checked.
    expect(labStatus(result('CRP', 0.5, 'EXACT', null, 5.0))).toBeNull();
  });

  it('aThresholdOnlyFlagsWhatItProves', () => {
    // "< 1" under a maximum of 5: inside; never above.
    expect(labStatus(result('CRP', 1.0, 'BELOW', null, 5.0))).toBeNull();
    // "< 10" under a minimum of 30: necessarily below.
    expect(labStatus(result('VITAMIN_D', 10.0, 'BELOW', 30.0))).toBe('BELOW');
    // "> 160" above a maximum of 5: necessarily above.
    expect(labStatus(result('CRP', 160.0, 'ABOVE', null, 5.0))).toBe('ABOVE');
    // "< 50" with a maximum of 5: cannot conclude.
    expect(labStatus(result('CRP', 50.0, 'BELOW', null, 5.0))).toBeNull();
  });
});

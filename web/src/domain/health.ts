import { nowEpochMillis } from './models';
import type { LocalDate } from './time';

/** Lab test families, in display order. */
export const LAB_CATEGORIES = [
  'INFLAMMATION', 'BLOOD_COUNT', 'IRON', 'KIDNEY', 'LIVER', 'METABOLIC', 'NUTRITION', 'DRUG_MONITORING', 'OTHER',
] as const;
export type LabCategory = (typeof LAB_CATEGORIES)[number];

interface LabTestInfo { readonly name: string; readonly unit: string; readonly category: LabCategory }

/**
 * Recognized lab tests, with the entry unit: that of the most common French lab reports
 * (other units are converted on import). The array order is the display order; the
 * database stores the name, not the rank.
 */
const LAB_TEST_TABLE = [
  ['CRP', 'mg/L', 'INFLAMMATION'],
  ['CALPROTECTIN', 'µg/g', 'INFLAMMATION'],

  ['RED_BLOOD_CELLS', 'T/L', 'BLOOD_COUNT'],
  ['HEMOGLOBIN', 'g/dL', 'BLOOD_COUNT'],
  ['HEMATOCRIT', '%', 'BLOOD_COUNT'],
  ['MCV', 'fL', 'BLOOD_COUNT'],
  ['MCH', 'pg', 'BLOOD_COUNT'],
  ['MCHC', 'g/dL', 'BLOOD_COUNT'],
  ['WHITE_BLOOD_CELLS', 'G/L', 'BLOOD_COUNT'],
  ['NEUTROPHILS', 'G/L', 'BLOOD_COUNT'],
  ['LYMPHOCYTES', 'G/L', 'BLOOD_COUNT'],
  ['MONOCYTES', 'G/L', 'BLOOD_COUNT'],
  ['EOSINOPHILS', 'G/L', 'BLOOD_COUNT'],
  ['BASOPHILS', 'G/L', 'BLOOD_COUNT'],
  ['PLATELETS', 'G/L', 'BLOOD_COUNT'],

  ['FERRITIN', 'µg/L', 'IRON'],
  ['IRON', 'µg/dL', 'IRON'],
  ['TRANSFERRIN', 'g/L', 'IRON'],
  ['IRON_BINDING_CAPACITY', 'µg/dL', 'IRON'],
  ['TRANSFERRIN_SATURATION', '%', 'IRON'],

  ['CREATININE', 'µmol/L', 'KIDNEY'],
  ['EGFR', 'mL/min/1,73 m²', 'KIDNEY'],
  ['SODIUM', 'mmol/L', 'KIDNEY'],
  ['POTASSIUM', 'mmol/L', 'KIDNEY'],
  ['CHLORIDE', 'mmol/L', 'KIDNEY'],
  ['CALCIUM', 'mmol/L', 'KIDNEY'],
  ['URINE_PROTEIN', 'g/L', 'KIDNEY'],

  ['AST', 'U/L', 'LIVER'],
  ['ALT', 'U/L', 'LIVER'],
  ['GGT', 'U/L', 'LIVER'],
  ['ALKALINE_PHOSPHATASE', 'U/L', 'LIVER'],
  ['BILIRUBIN_TOTAL', 'µmol/L', 'LIVER'],
  ['BILIRUBIN_DIRECT', 'µmol/L', 'LIVER'],
  ['BILIRUBIN_INDIRECT', 'µmol/L', 'LIVER'],

  ['GLUCOSE', 'g/L', 'METABOLIC'],
  ['CHOLESTEROL_TOTAL', 'g/L', 'METABOLIC'],
  ['CHOLESTEROL_HDL', 'g/L', 'METABOLIC'],
  ['CHOLESTEROL_LDL', 'g/L', 'METABOLIC'],
  ['TRIGLYCERIDES', 'g/L', 'METABOLIC'],

  ['VITAMIN_D', 'ng/mL', 'NUTRITION'],
  ['ALBUMIN', 'g/L', 'NUTRITION'],

  // Biologic drug monitoring: trough level and anti-drug antibodies. Entered by hand (assays and
  // units vary by laboratory; the antibody unit may be AU/mL on some reports: note it in the comment).
  ['INFLIXIMAB_LEVEL', 'µg/mL', 'DRUG_MONITORING'],
  ['ADALIMUMAB_LEVEL', 'µg/mL', 'DRUG_MONITORING'],
  ['ANTI_INFLIXIMAB_ANTIBODIES', 'ng/mL', 'DRUG_MONITORING'],
  ['ANTI_ADALIMUMAB_ANTIBODIES', 'ng/mL', 'DRUG_MONITORING'],

  ['PROTHROMBIN_TIME', '%', 'OTHER'],
  ['PSA', 'µg/L', 'OTHER'],
] as const;

export type LabTest = (typeof LAB_TEST_TABLE)[number][0];

/** All lab tests, in display order. */
export const LAB_TESTS: readonly LabTest[] = LAB_TEST_TABLE.map((row) => row[0]);

/** Entry unit and category of each test. */
export const LAB_TEST_INFO = Object.fromEntries(
  LAB_TEST_TABLE.map(([name, unit, category]) => [name, { name, unit, category }]),
) as Readonly<Record<LabTest, LabTestInfo>>;

/** Entry unit of a test (`LabTest.unit`). */
export const labTestUnit = (test: LabTest): string => LAB_TEST_INFO[test].unit;

/** Category of a test (`LabTest.category`). */
export const labTestCategory = (test: LabTest): LabCategory => LAB_TEST_INFO[test].category;

/** Tests of a category, in display order. */
export const labTestsOf = (category: LabCategory): LabTest[] =>
  LAB_TESTS.filter((test) => LAB_TEST_INFO[test].category === category);

/** Exact result, or only bounded: "< 1,0" (BELOW), "> 300" (ABOVE). */
export const LAB_QUALIFIERS = ['EXACT', 'BELOW', 'ABOVE'] as const;
export type LabQualifier = (typeof LAB_QUALIFIERS)[number];

/**
 * Lab result. `qualifier`: result given as a threshold ("< 1,0": below the measurement
 * threshold). `referenceLow`/`referenceHigh`: the lab's reference values, read from the
 * report or entered; null if the report gives none (the app does not supply any).
 */
export interface LabResult {
  id: number;
  test: LabTest;
  value: number;
  date: LocalDate;
  note: string;
  qualifier: LabQualifier;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export function labResult(init: Pick<LabResult, 'test' | 'value' | 'date'> & Partial<LabResult>): LabResult {
  return {
    id: 0, note: '', qualifier: 'EXACT', referenceLow: null, referenceHigh: null, ...init,
  };
}

export const DOSE_STATUSES = ['TAKEN', 'MISSED'] as const;
export type DoseStatus = (typeof DOSE_STATUSES)[number];

/**
 * Confirmed scheduled dose (taken or missed). `scheduledAt`: local timestamp of the scheduled
 * occurrence, in milliseconds; a single entry per treatment and per occurrence.
 */
export interface DoseLog {
  id: number;
  medicationId: number;
  scheduledAt: number;
  status: DoseStatus;
  loggedAt: number;
}

export function doseLog(
  init: Pick<DoseLog, 'medicationId' | 'scheduledAt' | 'status'> & Partial<DoseLog>,
): DoseLog {
  return { id: 0, loggedAt: nowEpochMillis(), ...init };
}

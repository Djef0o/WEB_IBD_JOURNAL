/*
 * Review of the values read from lab reports (`LabImportUi.kt`): nothing is saved without
 * validation. Pure state transitions, so the screen only renders them.
 */
import { labResult, type LabResult, type LabTest } from '../domain/health';
import type { DetectedLabValue, LabReportScan } from '../domain/labReportParser';
import type { LocalDate } from '../domain/time';
import { parseLabValue } from '../ui/labs/labValues';

/** Report read at import; `failed`: unreadable, `scan` then empty. */
export interface ImportedDocument {
  name: string | null;
  scan: LabReportScan;
  failed: boolean;
}

/** Value proposed at import, editable before saving. */
export interface ImportDraft {
  detected: DetectedLabValue;
  valueText: string;
  selected: boolean;
}

export interface DocumentReview {
  document: ImportedDocument;
  date: LocalDate;
  drafts: ImportDraft[];
}

/** Duplicate of a proposed value: already saved, or read on an earlier import report. */
export type Duplicate = 'SAVED' | 'IN_IMPORT';

/**
 * Is the `test` of report `index` already present, at its date, in the saved results or on an
 * earlier import report (two panels on the same day)?
 */
export function duplicateOf(
  reviews: readonly DocumentReview[], index: number, test: LabTest, existing: readonly LabResult[],
): Duplicate | null {
  const date = reviews[index]!.date;
  if (existing.some((r) => r.test === test && r.date === date)) return 'SAVED';
  for (let earlier = 0; earlier < index; earlier++) {
    const review = reviews[earlier]!;
    if (review.date === date && review.drafts.some((d) => d.detected.test === test)) return 'IN_IMPORT';
  }
  return null;
}

/**
 * Reviews from the oldest collection to the most recent (unknown date last), order frozen on
 * opening. Each value is checked unless it duplicates a saved one or an earlier report's.
 * `formatValue` renders a value for the input (locale decimal, no grouping).
 */
export function buildReviews(
  documents: readonly ImportedDocument[],
  existing: readonly LabResult[],
  today: LocalDate,
  formatValue: (value: number) => string,
): DocumentReview[] {
  const sorted = [...documents].sort((a, b) => {
    const da = a.scan.sampleDate;
    const db = b.scan.sampleDate;
    if (da === db) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? -1 : 1;
  });
  const reviews: DocumentReview[] = sorted.map((document) => ({
    document, date: document.scan.sampleDate ?? today, drafts: [],
  }));
  reviews.forEach((review, index) => {
    review.drafts = review.document.scan.values.map((detected) => ({
      detected,
      valueText: formatValue(detected.value),
      selected: duplicateOf(reviews, index, detected.test, existing) === null,
    }));
  });
  return reviews;
}

/**
 * An edited date changes the duplicates of this report and the following ones: only the values
 * whose duplicate status changes are unchecked or rechecked. Returns new reviews.
 */
export function changeDate(
  reviews: readonly DocumentReview[], index: number, date: LocalDate, existing: readonly LabResult[],
): DocumentReview[] {
  const duplicates = (list: readonly DocumentReview[]) =>
    list.map((review, k) => (k < index ? [] : review.drafts.map((d) => duplicateOf(list, k, d.detected.test, existing) !== null)));
  const before = duplicates(reviews);
  const next = reviews.map((review, k) => (k === index ? { ...review, date } : review));
  const after = duplicates(next);
  return next.map((review, k) => {
    if (k < index) return review;
    return {
      ...review,
      drafts: review.drafts.map((draft, j) =>
        after[k]![j] !== before[k]![j] ? { ...draft, selected: !after[k]![j] } : draft),
    };
  });
}

export function updateDraft(
  reviews: readonly DocumentReview[], index: number, position: number, change: Partial<ImportDraft>,
): DocumentReview[] {
  return reviews.map((review, k) =>
    k === index
      ? { ...review, drafts: review.drafts.map((d, j) => (j === position ? { ...d, ...change } : d)) }
      : review);
}

export interface ImportSelection {
  /** The checked values, ready to save; empty while one of them has an invalid number. */
  results: LabResult[];
  /** Number of checked values. */
  count: number;
  allValid: boolean;
}

export function selection(reviews: readonly DocumentReview[]): ImportSelection {
  const chosen = reviews.flatMap((review) => review.drafts.filter((d) => d.selected).map((draft) => ({ date: review.date, draft })));
  const parsed = chosen.map(({ date, draft }) => ({ date, draft, value: parseLabValue(draft.valueText) }));
  const allValid = parsed.every((p) => p.value !== null);
  return {
    count: chosen.length,
    allValid,
    results: allValid
      ? parsed.map(({ date, draft, value }) =>
        labResult({
          test: draft.detected.test,
          value: value!,
          date,
          qualifier: draft.detected.qualifier,
          referenceLow: draft.detected.referenceLow,
          referenceHigh: draft.detected.referenceHigh,
        }))
      : [],
  };
}

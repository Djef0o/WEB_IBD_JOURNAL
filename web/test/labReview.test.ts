import { describe, expect, it } from 'vitest';
import { labResult } from '../src/domain/health';
import type { DetectedLabValue } from '../src/domain/labReportParser';
import {
  buildReviews, changeDate, duplicateOf, selection, updateDraft, type ImportedDocument,
} from '../src/labimport/review';

const detected = (test: DetectedLabValue['test'], value: number, extra: Partial<DetectedLabValue> = {}): DetectedLabValue => ({
  test, value, qualifier: 'EXACT', unitFound: null, sourceText: `${test} ${value}`, referenceLow: null, referenceHigh: null, ...extra,
});
const doc = (name: string, sampleDate: string | null, ...values: DetectedLabValue[]): ImportedDocument => ({
  name, scan: { sampleDate, values }, failed: false,
});
const fmt = (v: number) => String(v);

describe('import review', () => {
  it('orders documents from the oldest collection, unknown date last, and defaults it to today', () => {
    const reviews = buildReviews([
      doc('c', null, detected('CRP', 1)),
      doc('b', '2026-03-01', detected('CRP', 2)),
      doc('a', '2026-01-01', detected('CRP', 3)),
    ], [], '2026-11-18', fmt);
    expect(reviews.map((x) => x.document.name)).toEqual(['a', 'b', 'c']);
    expect(reviews[2]!.date).toBe('2026-11-18');
  });

  it('unchecks the values already saved, or already read on an earlier report of the same day', () => {
    const existing = [labResult({ test: 'CRP', value: 1, date: '2026-01-01' })];
    const reviews = buildReviews([
      doc('a', '2026-01-01', detected('CRP', 1), detected('FERRITIN', 50)),
      doc('b', '2026-01-01', detected('FERRITIN', 52), detected('IRON', 80)),
    ], existing, '2026-11-18', fmt);
    expect(reviews[0]!.drafts.map((d) => d.selected)).toEqual([false, true]);
    expect(duplicateOf(reviews, 0, 'CRP', existing)).toBe('SAVED');
    expect(reviews[1]!.drafts.map((d) => d.selected)).toEqual([false, true]);
    expect(duplicateOf(reviews, 1, 'FERRITIN', existing)).toBe('IN_IMPORT');
  });

  it('only flips the values whose duplicate status changes when a date is edited', () => {
    const existing = [labResult({ test: 'CRP', value: 1, date: '2026-02-01' })];
    let reviews = buildReviews([
      doc('a', '2026-01-01', detected('CRP', 1), detected('IRON', 80)),
    ], existing, '2026-11-18', fmt);
    reviews = updateDraft(reviews, 0, 1, { selected: false }); // manual choice on IRON
    reviews = changeDate(reviews, 0, '2026-02-01', existing);
    expect(reviews[0]!.date).toBe('2026-02-01');
    expect(reviews[0]!.drafts.map((d) => d.selected)).toEqual([false, false]); // CRP now a duplicate; IRON untouched
    reviews = changeDate(reviews, 0, '2026-03-01', existing);
    expect(reviews[0]!.drafts.map((d) => d.selected)).toEqual([true, false]);
  });

  it('turns the checked values into results, with the lab references and qualifier', () => {
    let reviews = buildReviews([
      doc('a', '2026-01-01',
        detected('CRP', 1, { qualifier: 'BELOW', referenceHigh: 5 }), detected('IRON', 80)),
    ], [], '2026-11-18', fmt);
    reviews = updateDraft(reviews, 0, 1, { valueText: '81,5' });
    const chosen = selection(reviews);
    expect(chosen.count).toBe(2);
    expect(chosen.allValid).toBe(true);
    expect(chosen.results[0]).toMatchObject({ test: 'CRP', value: 1, qualifier: 'BELOW', referenceHigh: 5, date: '2026-01-01', id: 0 });
    expect(chosen.results[1]).toMatchObject({ test: 'IRON', value: 81.5 });
  });

  it('refuses to save while a checked value is not a number, ignores unchecked ones', () => {
    let reviews = buildReviews([doc('a', '2026-01-01', detected('CRP', 1), detected('IRON', 80))], [], '2026-11-18', fmt);
    reviews = updateDraft(reviews, 0, 0, { valueText: 'x' });
    expect(selection(reviews)).toMatchObject({ allValid: false, results: [] });
    reviews = updateDraft(reviews, 0, 0, { selected: false });
    expect(selection(reviews)).toMatchObject({ allValid: true, count: 1 });
  });

  it('keeps a failed document without values', () => {
    const failed: ImportedDocument = { name: 'x.pdf', scan: { sampleDate: null, values: [] }, failed: true };
    const reviews = buildReviews([failed], [], '2026-11-18', fmt);
    expect(reviews[0]!.drafts).toEqual([]);
    expect(selection(reviews).count).toBe(0);
  });
});

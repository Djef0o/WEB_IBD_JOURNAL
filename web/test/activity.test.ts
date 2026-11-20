import { describe, expect, it } from 'vitest';
import { prefilledAnswers, scoreLevel, scoreTotal, suggestedScore } from '../src/domain/activity';
import { activityScore } from '../src/domain/care';
import { stool } from '../src/domain/models';

const day = '2026-11-18';
const hbi = (answers: number[]) => activityScore({ date: day, kind: 'HBI', answers });
const sccai = (answers: number[]) => activityScore({ date: day, kind: 'SCCAI', answers });

describe('activity score', () => {
  it('HBI adds answers and counts complication bits', () => {
    const score = hbi([2, 1, 5, 0, 0b101]);
    expect(scoreTotal(score)).toBe(2 + 1 + 5 + 0 + 2);
    expect(scoreLevel(score)).toBe('MODERATE');
  });

  it('HBI bands follow the usual thresholds', () => {
    const level = (total: number) => scoreLevel(hbi([0, 0, total, 0, 0]));
    expect(level(4)).toBe('REMISSION');
    expect(level(5)).toBe('MILD');
    expect(level(7)).toBe('MILD');
    expect(level(8)).toBe('MODERATE');
    expect(level(16)).toBe('MODERATE');
    expect(level(17)).toBe('SEVERE');
  });

  it('SCCAI maximum is 19 and the middle band has no label', () => {
    const worst = sccai([3, 2, 3, 3, 4, 0b1111]);
    expect(scoreTotal(worst)).toBe(19);
    expect(scoreLevel(worst)).toBe('ACTIVE');
    const middle = sccai([1, 1, 1, 0, 0, 0]);
    expect(scoreTotal(middle)).toBe(3);
    expect(scoreLevel(middle)).toBeNull();
    expect(scoreLevel(sccai([1, 1, 0, 0, 0, 0]))).toBe('REMISSION');
  });

  it('missing answers count as 0', () => {
    expect(scoreTotal(hbi([3]))).toBe(3);
  });

  it('suggests the questionnaire from the diagnosis', () => {
    expect(suggestedScore('CROHN')).toBe('HBI');
    expect(suggestedScore('ULCERATIVE_COLITIS')).toBe('SCCAI');
    expect(suggestedScore('OTHER')).toBeNull();
    expect(suggestedScore(null)).toBeNull();
  });

  it('prefill counts liquid stools and ignores false urges', () => {
    const stools = [
      stool({ date: day, bristolType: 7 }),
      stool({ date: day, bristolType: 6, urgency: true, nocturnal: true }),
      stool({ date: day, bristolType: 4 }),
      stool({ date: day, bristolType: 0, falseUrge: true }),
    ];
    expect(prefilledAnswers('HBI', stools)[2]).toBe(2);
    expect(prefilledAnswers('SCCAI', stools)).toEqual([0, 1, 1, 0, 0, 0]);
  });

  it('noted symptoms check the matching complications', () => {
    const extras = new Set(['JOINTS', 'EYES', 'MOUTH_ULCERS'] as const);
    expect(prefilledAnswers('HBI', [], extras)[4]).toBe(0b1011);
    expect(prefilledAnswers('SCCAI', [], extras)[5]).toBe(0b1001);
    expect(prefilledAnswers('HBI', [stool({ date: day })], new Set())[4]).toBe(0);
  });
});

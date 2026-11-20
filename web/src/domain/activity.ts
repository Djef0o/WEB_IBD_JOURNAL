import type { ActivityScore, Diagnosis, ExtraSymptom, ScoreKind } from './care';
import { isRealStool, type Stool } from './models';

/*
 * Questionnaires, in the order of `ActivityScore.answers` (`Activity.kt`).
 *
 * HBI (Harvey-Bradshaw index, Crohn's disease), for the day:
 * 0 general well-being (0 very well … 4 terrible); 1 abdominal pain (0 none … 3 severe);
 * 2 number of liquid or soft stools; 3 abdominal mass (0 none … 3 definite and tender);
 * 4 complications, bit mask of `HBI_COMPLICATIONS` items, 1 point each.
 *
 * SCCAI (Simple Clinical Colitis Activity Index, ulcerative colitis):
 * 0 stools per day (0: 1–3, 1: 4–6, 2: 7–9, 3: more); 1 stools at night (0: none, 1: 1–3, 2: 4–6);
 * 2 urgency (0 none, 1 hurry, 2 immediate, 3 incontinence); 3 blood in stool (0 none … 3 usually frank);
 * 4 general well-being (0 very well … 4 terrible); 5 extracolonic features, bit mask of
 * `SCCAI_EXTRACOLONIC` items, 1 point each. Maximum 19.
 */
export const HBI_COMPLICATIONS = 8;
export const SCCAI_EXTRACOLONIC = 4;

/** Answer count of each questionnaire. */
export function questionCount(kind: ScoreKind): number {
  return kind === 'HBI' ? 5 : 6;
}

function countOneBits(value: number): number {
  let count = 0;
  for (let v = value >>> 0; v !== 0; v >>>= 1) count += v & 1;
  return count;
}

/** Total of the questionnaire; missing answers count as 0. */
export function scoreTotal(score: Pick<ActivityScore, 'kind' | 'answers'>): number {
  const answer = (index: number): number => Math.max(score.answers[index] ?? 0, 0);
  const sum = (to: number): number => {
    let total = 0;
    for (let i = 0; i <= to; i++) total += answer(i);
    return total;
  };
  return score.kind === 'HBI' ? sum(3) + countOneBits(answer(4)) : sum(4) + countOneBits(answer(5));
}

export type ActivityLevel = 'REMISSION' | 'MILD' | 'MODERATE' | 'SEVERE' | 'ACTIVE';

/**
 * Usual interpretation: HBI under 5 remission, 5–7 mild, 8–16 moderate, above 16 severe;
 * SCCAI up to 2 remission, 5 and above active, in between none.
 */
export function scoreLevel(score: Pick<ActivityScore, 'kind' | 'answers'>): ActivityLevel | null {
  const total = scoreTotal(score);
  if (score.kind === 'HBI') {
    if (total < 5) return 'REMISSION';
    if (total <= 7) return 'MILD';
    if (total <= 16) return 'MODERATE';
    return 'SEVERE';
  }
  if (total <= 2) return 'REMISSION';
  if (total >= 5) return 'ACTIVE';
  return null;
}

/** Questionnaire suggested by the diagnosis; null if unknown. */
export function suggestedScore(diagnosis: Diagnosis | null | undefined): ScoreKind | null {
  if (diagnosis === 'CROHN') return 'HBI';
  if (diagnosis === 'ULCERATIVE_COLITIS') return 'SCCAI';
  return null;
}

/**
 * Answers that the day's data settle: liquid stools and the extra-intestinal manifestations noted
 * that day (HBI), daily and night frequency, urgency and manifestations (SCCAI). The others stay at
 * 0 for the user to answer. `dayStools` all from the same date.
 */
export function prefilledAnswers(
  kind: ScoreKind,
  dayStools: readonly Stool[],
  extras: ReadonlySet<ExtraSymptom> = new Set(),
): number[] {
  const real = dayStools.filter(isRealStool);
  const bit = (index: number, symptom: ExtraSymptom): number => (extras.has(symptom) ? 1 << index : 0);
  if (kind === 'HBI') {
    return [
      0, 0, real.filter((s) => s.bristolType >= 6).length, 0,
      bit(0, 'JOINTS') | bit(1, 'EYES') | bit(2, 'SKIN') | bit(3, 'MOUTH_ULCERS'),
    ];
  }
  const night = real.filter((s) => s.nocturnal).length;
  return [
    real.length <= 3 ? 0 : real.length <= 6 ? 1 : real.length <= 9 ? 2 : 3,
    night === 0 ? 0 : night <= 3 ? 1 : 2,
    real.some((s) => s.urgency) ? 1 : 0,
    0, 0,
    bit(0, 'JOINTS') | bit(2, 'SKIN') | bit(3, 'EYES'),
  ];
}

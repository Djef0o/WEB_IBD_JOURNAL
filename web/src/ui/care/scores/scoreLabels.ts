import { scoreLevel, scoreTotal, type ActivityLevel } from '../../../domain/activity';
import type { ActivityScore } from '../../../domain/care';
import { t } from '../../../i18n';

const LEVEL_KEY: Record<ActivityLevel, string> = {
  REMISSION: 'score_level_remission',
  MILD: 'score_level_mild',
  MODERATE: 'score_level_moderate',
  SEVERE: 'score_level_severe',
  ACTIVE: 'score_level_active',
};

export const KIND_KEY = { HBI: 'score_hbi', SCCAI: 'score_sccai' } as const;
export const KIND_FULL_KEY = { HBI: 'score_hbi_full', SCCAI: 'score_sccai_full' } as const;

/** Level label, or null for the SCCAI middle band. */
export function levelLabel(score: ActivityScore): string | null {
  const level = scoreLevel(score);
  // i18n-keys: score_level_remission score_level_mild score_level_moderate score_level_severe score_level_active
  return level === null ? null : t(LEVEL_KEY[level]);
}

/** "HBI: 4". */
export function headline(score: ActivityScore): string {
  // i18n-keys: score_hbi score_sccai
  return t('score_headline', [t(KIND_KEY[score.kind]), scoreTotal(score)]);
}

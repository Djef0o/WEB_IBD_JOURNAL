import { t } from '../../i18n';
import type { Stool } from '../../domain/models';

/** « Selle · Type 4 », ou « Fausse envie » (`stoolTitle`). */
export function stoolTitle(stool: Stool): string {
  return stool.falseUrge ? t('false_urge') : t('stool_title', [stool.bristolType]);
}

/**
 * Signe le plus notable d'une selle (sang, mucus, douleur), sinon le commentaire ; urgence et
 * réveil nocturne en suffixe (`stoolSummary`).
 */
export function stoolSummary(stool: Stool): string {
  let main: string | null = null;
  if (stool.bloodLevel > 0) main = t('stool_flag_blood');
  else if (stool.mucusLevel > 0) main = t('stool_flag_mucus');
  else if (stool.painLevel > 0) main = t('stool_flag_pain', [stool.painLevel]);
  else if (stool.comment.trim() !== '') main = stool.comment;
  const parts = [main, stool.urgency ? t('stool_urgency') : null, stool.nocturnal ? t('stool_nocturnal') : null];
  const shown = parts.filter((part): part is string => part !== null);
  return shown.length === 0 ? t('stool_flag_none') : shown.join(' · ');
}

/** Libellé accessible d'un type de Bristol : « Type 4 · Lisse et molle ». */
export function bristolLabel(type: number): string {
  // i18n-keys: bristol_desc_0 bristol_desc_1 bristol_desc_2 bristol_desc_3 bristol_desc_4 bristol_desc_5 bristol_desc_6 bristol_desc_7
  return `${t('analysis_type', [type])} · ${t(`bristol_desc_${type}`)}`;
}

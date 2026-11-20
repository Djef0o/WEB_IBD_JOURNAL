import type { VaccineType } from '../../../domain/care';
import { t } from '../../../i18n';

/** Display name of each vaccine (`VaccineType.nameRes`). */
export const VACCINE_TYPE_LABEL: Readonly<Record<VaccineType, () => string>> = {
  INFLUENZA: () => t('vaccine_type_influenza'),
  PNEUMOCOCCAL: () => t('vaccine_type_pneumococcal'),
  COVID19: () => t('vaccine_type_covid19'),
  HEPATITIS_B: () => t('vaccine_type_hepatitis_b'),
  HPV: () => t('vaccine_type_hpv'),
  ZOSTER: () => t('vaccine_type_zoster'),
  TETANUS: () => t('vaccine_type_tetanus'),
  OTHER: () => t('vaccine_type_other'),
};

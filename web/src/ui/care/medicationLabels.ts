import type { Indication, MedicationCategory, StandardMedication, SupportiveMedication } from '../../domain/standardMedications';
import { t } from '../../i18n';

const CATEGORY_LABEL: Readonly<Record<MedicationCategory, () => string>> = {
  AMINOSALICYLATES: () => t('med_category_aminosalicylates'),
  CORTICOSTEROIDS: () => t('med_category_corticosteroids'),
  IMMUNOSUPPRESSANTS: () => t('med_category_immunosuppressants'),
  BIOLOGICS: () => t('med_category_biologics'),
  SMALL_MOLECULES: () => t('med_category_small_molecules'),
  ANTIBIOTICS: () => t('med_category_antibiotics'),
  SUPPORTIVE: () => t('med_category_supportive'),
};

const SUPPORTIVE_LABEL: Readonly<Record<SupportiveMedication, () => string>> = {
  IRON: () => t('med_iron'),
  VITAMIN_D: () => t('med_vitamin_d'),
  VITAMIN_B12: () => t('med_vitamin_b12'),
  FOLIC_ACID: () => t('med_folic_acid'),
  CALCIUM: () => t('med_calcium'),
  LOPERAMIDE: () => t('med_loperamide'),
};

const INDICATION_LABEL: Readonly<Record<Indication, () => string>> = {
  CROHN: () => t('indication_crohn'),
  UC: () => t('indication_uc'),
};

export const categoryLabel = (category: MedicationCategory): string => CATEGORY_LABEL[category]();

export const indicationsLabel = (med: StandardMedication): string =>
  med.indications.map((i) => INDICATION_LABEL[i]()).join(' · ');

/** Name written into the treatment: the INN, or the translated label of a supportive treatment (`displayName`). */
export function medicationLabel(med: StandardMedication): string {
  return med.inn ?? (med.supportive ? SUPPORTIVE_LABEL[med.supportive]() : '');
}

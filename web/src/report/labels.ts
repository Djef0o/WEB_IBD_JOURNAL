import type { LabCategory, LabTest } from '../domain/health';
import type { CheckupType, RepeatUnit, Sex } from '../domain/profile';
import { t } from '../i18n';

/** Display labels of the shared module's enumerations (`Labels.kt`); `Record` keeps them exhaustive. */

const LAB_TEST_LABEL: Record<LabTest, () => string> = {
  CRP: () => t('lab_crp'),
  CALPROTECTIN: () => t('lab_calprotectin'),
  RED_BLOOD_CELLS: () => t('lab_red_blood_cells'),
  HEMOGLOBIN: () => t('lab_hemoglobin'),
  HEMATOCRIT: () => t('lab_hematocrit'),
  MCV: () => t('lab_mcv'),
  MCH: () => t('lab_mch'),
  MCHC: () => t('lab_mchc'),
  WHITE_BLOOD_CELLS: () => t('lab_white_blood_cells'),
  NEUTROPHILS: () => t('lab_neutrophils'),
  LYMPHOCYTES: () => t('lab_lymphocytes'),
  MONOCYTES: () => t('lab_monocytes'),
  EOSINOPHILS: () => t('lab_eosinophils'),
  BASOPHILS: () => t('lab_basophils'),
  PLATELETS: () => t('lab_platelets'),
  FERRITIN: () => t('lab_ferritin'),
  IRON: () => t('lab_iron'),
  TRANSFERRIN: () => t('lab_transferrin'),
  IRON_BINDING_CAPACITY: () => t('lab_iron_binding_capacity'),
  TRANSFERRIN_SATURATION: () => t('lab_transferrin_saturation'),
  CREATININE: () => t('lab_creatinine'),
  EGFR: () => t('lab_egfr'),
  SODIUM: () => t('lab_sodium'),
  POTASSIUM: () => t('lab_potassium'),
  CHLORIDE: () => t('lab_chloride'),
  CALCIUM: () => t('lab_calcium'),
  URINE_PROTEIN: () => t('lab_urine_protein'),
  AST: () => t('lab_ast'),
  ALT: () => t('lab_alt'),
  GGT: () => t('lab_ggt'),
  ALKALINE_PHOSPHATASE: () => t('lab_alkaline_phosphatase'),
  BILIRUBIN_TOTAL: () => t('lab_bilirubin_total'),
  BILIRUBIN_DIRECT: () => t('lab_bilirubin_direct'),
  BILIRUBIN_INDIRECT: () => t('lab_bilirubin_indirect'),
  GLUCOSE: () => t('lab_glucose'),
  CHOLESTEROL_TOTAL: () => t('lab_cholesterol_total'),
  CHOLESTEROL_HDL: () => t('lab_cholesterol_hdl'),
  CHOLESTEROL_LDL: () => t('lab_cholesterol_ldl'),
  TRIGLYCERIDES: () => t('lab_triglycerides'),
  VITAMIN_D: () => t('lab_vitamin_d'),
  ALBUMIN: () => t('lab_albumin'),
  PROTHROMBIN_TIME: () => t('lab_prothrombin_time'),
  PSA: () => t('lab_psa'),
};

export const labTestLabel = (test: LabTest): string => LAB_TEST_LABEL[test]();

const LAB_CATEGORY_LABEL: Record<LabCategory, () => string> = {
  INFLAMMATION: () => t('lab_category_inflammation'),
  BLOOD_COUNT: () => t('lab_category_blood_count'),
  IRON: () => t('lab_category_iron'),
  KIDNEY: () => t('lab_category_kidney'),
  LIVER: () => t('lab_category_liver'),
  METABOLIC: () => t('lab_category_metabolic'),
  NUTRITION: () => t('lab_category_nutrition'),
  OTHER: () => t('lab_category_other'),
};

export const labCategoryLabel = (category: LabCategory): string => LAB_CATEGORY_LABEL[category]();

export const sexLabel = (sex: Sex): string => (sex === 'FEMALE' ? t('sex_female') : t('sex_male'));

export const checkupTypeLabel = (type: CheckupType): string =>
  (type === 'BLOOD_TEST' ? t('checkup_blood_test') : t('checkup_stool_test'));

// i18n-keys: repeat_every_days repeat_every_weeks repeat_every_months
/** `RepeatUnit` other than ONCE → plural key of "Every n days/weeks/months". */
export const REPEAT_EVERY_KEY: Record<Exclude<RepeatUnit, 'ONCE'>, string> = {
  DAY: 'repeat_every_days',
  WEEK: 'repeat_every_weeks',
  MONTH: 'repeat_every_months',
};

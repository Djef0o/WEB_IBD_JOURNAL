import type { ActivityLevel } from '../domain/activity';
import type { AppointmentKind, Diagnosis, ExtraSymptom, ScoreKind, VaccineType } from '../domain/care';
import type { WellbeingFactor } from '../domain/wellbeing';
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
  INFLIXIMAB_LEVEL: () => t('lab_infliximab_level'),
  ADALIMUMAB_LEVEL: () => t('lab_adalimumab_level'),
  ANTI_INFLIXIMAB_ANTIBODIES: () => t('lab_anti_infliximab_antibodies'),
  ANTI_ADALIMUMAB_ANTIBODIES: () => t('lab_anti_adalimumab_antibodies'),
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
  DRUG_MONITORING: () => t('lab_category_drug_monitoring'),
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

/** Name of each questionnaire in the report (`scoreName`). */
export const scoreKindLabel = (kind: ScoreKind): string =>
  (kind === 'HBI' ? t('report_care_score_hbi') : t('report_care_score_sccai'));

const ACTIVITY_LEVEL_LABEL: Record<ActivityLevel, () => string> = {
  REMISSION: () => t('report_care_level_remission'),
  MILD: () => t('report_care_level_mild'),
  MODERATE: () => t('report_care_level_moderate'),
  SEVERE: () => t('report_care_level_severe'),
  ACTIVE: () => t('report_care_level_active'),
};
export const activityLevelLabel = (level: ActivityLevel): string => ACTIVITY_LEVEL_LABEL[level]();

const DIAGNOSIS_LABEL: Record<Diagnosis, () => string> = {
  CROHN: () => t('report_care_diagnosis_crohn'),
  ULCERATIVE_COLITIS: () => t('report_care_diagnosis_uc'),
  OTHER: () => t('report_care_diagnosis_other'),
};
export const diagnosisLabel = (diagnosis: Diagnosis): string => DIAGNOSIS_LABEL[diagnosis]();

const VACCINE_LABEL: Record<VaccineType, () => string> = {
  INFLUENZA: () => t('report_care_vaccine_influenza'),
  PNEUMOCOCCAL: () => t('report_care_vaccine_pneumococcal'),
  COVID19: () => t('report_care_vaccine_covid19'),
  HEPATITIS_B: () => t('report_care_vaccine_hepatitis_b'),
  HPV: () => t('report_care_vaccine_hpv'),
  ZOSTER: () => t('report_care_vaccine_zoster'),
  TETANUS: () => t('report_care_vaccine_tetanus'),
  OTHER: () => t('report_care_vaccine_other'),
};
export const vaccineLabel = (type: VaccineType): string => VACCINE_LABEL[type]();

const EXTRA_SYMPTOM_LABEL: Record<ExtraSymptom, () => string> = {
  JOINTS: () => t('extra_symptom_joints'),
  SKIN: () => t('extra_symptom_skin'),
  EYES: () => t('extra_symptom_eyes'),
  MOUTH_ULCERS: () => t('extra_symptom_mouth_ulcers'),
  FEVER: () => t('extra_symptom_fever'),
};
export const extraSymptomLabel = (symptom: ExtraSymptom): string => EXTRA_SYMPTOM_LABEL[symptom]();

const WELLBEING_FACTOR_LABEL: Record<WellbeingFactor, () => string> = {
  POOR_SLEEP: () => t('wellbeing_factor_poor_sleep'),
  HIGH_STRESS: () => t('wellbeing_factor_high_stress'),
  LOW_MOOD: () => t('wellbeing_factor_low_mood'),
  PERIOD: () => t('wellbeing_factor_period'),
};
export const wellbeingFactorLabel = (factor: WellbeingFactor): string => WELLBEING_FACTOR_LABEL[factor]();

const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, () => string> = {
  GASTROENTEROLOGIST: () => t('appointment_kind_gastroenterologist'),
  DERMATOLOGIST: () => t('appointment_kind_dermatologist'),
  OPHTHALMOLOGIST: () => t('appointment_kind_ophthalmologist'),
  RHEUMATOLOGIST: () => t('appointment_kind_rheumatologist'),
  DIETITIAN: () => t('appointment_kind_dietitian'),
  GENERAL_PRACTITIONER: () => t('appointment_kind_general_practitioner'),
  OTHER: () => t('appointment_kind_other'),
};
export const appointmentKindLabel = (kind: AppointmentKind): string => APPOINTMENT_KIND_LABEL[kind]();

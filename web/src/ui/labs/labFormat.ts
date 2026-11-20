import type { LabCategory, LabQualifier, LabResult, LabTest } from '../../domain/health';
import type { LabStatus, ReferenceRange } from '../../domain/labReference';
import { formatNumber, t } from '../../i18n';

/** Up to two decimals, without useless zeros: "12", "0,5", "13,25". */
export function formatLabValue(value: number, grouping = true): string {
  return formatNumber(value, { maximumFractionDigits: 2, useGrouping: grouping });
}

const PREFIX: Record<LabQualifier, string> = { EXACT: '', BELOW: '< ', ABOVE: '> ' };

/** "< 1", "12,5"; "< 1 mg/L" with the unit. */
export function displayValue(result: LabResult, withUnit: boolean, unit: string): string {
  const number = PREFIX[result.qualifier] + formatLabValue(result.value);
  return withUnit ? `${number} ${unit}` : number;
}

/** "13,4 – 16,7", "< 5", "> 30". */
export function displayRange({ low, high }: ReferenceRange): string {
  if (low !== null && high !== null) return `${formatLabValue(low)} – ${formatLabValue(high)}`;
  if (high !== null) return `< ${formatLabValue(high)}`;
  if (low !== null) return `> ${formatLabValue(low)}`;
  return '';
}

export const QUALIFIER_SYMBOL: Record<LabQualifier, string> = { EXACT: '=', BELOW: '<', ABOVE: '>' };

export function qualifierLabel(qualifier: LabQualifier): string {
  switch (qualifier) {
    case 'EXACT': return t('lab_qualifier_exact');
    case 'BELOW': return t('lab_qualifier_below');
    case 'ABOVE': return t('lab_qualifier_above');
  }
}

export function statusLabel(status: LabStatus): string {
  return status === 'BELOW' ? t('lab_status_below') : t('lab_status_above');
}

/** Arrow that doubles the colour of a result outside the lab's reference values. */
export const STATUS_ARROW: Record<LabStatus, string> = { BELOW: '↓', ABOVE: '↑' };

// i18n-keys: lab_crp lab_calprotectin lab_red_blood_cells lab_hemoglobin lab_hematocrit lab_mcv lab_mch lab_mchc lab_white_blood_cells lab_neutrophils lab_lymphocytes lab_monocytes lab_eosinophils lab_basophils lab_platelets lab_ferritin lab_iron lab_transferrin lab_iron_binding_capacity lab_transferrin_saturation lab_creatinine lab_egfr lab_sodium lab_potassium lab_chloride lab_calcium lab_urine_protein lab_ast lab_alt lab_ggt lab_alkaline_phosphatase lab_bilirubin_total lab_bilirubin_direct lab_bilirubin_indirect lab_glucose lab_cholesterol_total lab_cholesterol_hdl lab_cholesterol_ldl lab_triglycerides lab_vitamin_d lab_albumin lab_prothrombin_time lab_psa
// i18n-keys: lab_infliximab_level lab_adalimumab_level lab_anti_infliximab_antibodies lab_anti_adalimumab_antibodies
export function labTestLabel(test: LabTest): string {
  return t(`lab_${test.toLowerCase()}`);
}

// i18n-keys: lab_category_blood_count lab_category_inflammation lab_category_iron lab_category_kidney lab_category_liver lab_category_metabolic lab_category_nutrition lab_category_other
// i18n-keys: lab_category_drug_monitoring
export function labCategoryLabel(category: LabCategory): string {
  return t(`lab_category_${category.toLowerCase()}`);
}

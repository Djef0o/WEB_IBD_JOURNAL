import type { AppointmentKind } from '../../../domain/care';
import { t } from '../../../i18n';

/** Name of the kind of doctor, in the app's language (`AppointmentLabels.kt`). */
export const APPOINTMENT_KIND_LABEL: Readonly<Record<AppointmentKind, () => string>> = {
  GASTROENTEROLOGIST: () => t('appointment_kind_gastroenterologist'),
  DERMATOLOGIST: () => t('appointment_kind_dermatologist'),
  OPHTHALMOLOGIST: () => t('appointment_kind_ophthalmologist'),
  RHEUMATOLOGIST: () => t('appointment_kind_rheumatologist'),
  DIETITIAN: () => t('appointment_kind_dietitian'),
  GENERAL_PRACTITIONER: () => t('appointment_kind_general_practitioner'),
  OTHER: () => t('appointment_kind_other'),
};

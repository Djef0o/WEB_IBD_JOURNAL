import './emergency.css';
import {
  emergencyDataEmpty, emergencyName, type EmergencyData,
} from '../../domain/emergencySheet';
import { monthsUntil, today } from '../../domain/time';
import { t, tp } from '../../i18n';
import { Button, Sheet } from '../components';
import { formatLocalDate } from '../format';
import { diagnosisLabel } from './DiagnosisSelector';

/** Label, big value and, if given, a call link; nothing at all when everything is blank. */
function Field({ label, value, phone = '' }: { label: string; value: string; phone?: string }) {
  if (value.trim() === '' && phone.trim() === '') return null;
  // The dialer opens with the number filled in: the call is never placed by the app.
  const dial = phone.trim().replace(/[^\d+*#]/g, '') || phone.trim();
  return (
    <div class="emergency-field">
      <p class="emergency-label">{label}</p>
      {value.trim() !== '' && <p class="emergency-value">{value}</p>}
      {phone.trim() !== '' && (
        <Button variant="tonal" class="emergency-call" href={`tel:${dial}`}>{phone.trim()}</Button>
      )}
    </div>
  );
}

/** Emergency information for a first responder: large text, phone numbers open the dialer (`EmergencySheet`). */
export function EmergencySheet({ data, open, onClose }: { data: EmergencyData; open: boolean; onClose: () => void }) {
  const { profile, info } = data;
  const born = profile.birthDate
    ? t('profile_born_on', [formatLocalDate(profile.birthDate), tp('profile_age', Math.trunc(monthsUntil(profile.birthDate, today()) / 12))])
    : '';
  const diagnosis = profile.diagnosis ? diagnosisLabel(profile.diagnosis) : '';

  return (
    <Sheet open={open} onClose={onClose} title={t('emergency_sheet_title')} closeLabel={t('close')}>
      <div class="emergency-sheet">
        {emergencyDataEmpty(data) && <p class="emergency-empty">{t('emergency_sheet_empty')}</p>}
        <Field label={t('emergency_field_name')} value={emergencyName(profile)} />
        <Field label={t('emergency_field_born')} value={born} />
        <Field label={t('diagnosis_title')} value={diagnosis} />
        <Field label={t('emergency_field_allergies')} value={info.allergies} />
        <Field label={t('emergency_field_treatments')} value={data.treatments.join('\n')} />
        <Field label={t('emergency_field_doctor')} value={info.doctorName} phone={info.doctorPhone} />
        <Field label={t('emergency_field_contact')} value={info.contactName} phone={info.contactPhone} />
        <Field label={t('emergency_field_notes')} value={info.notes} />
      </div>
    </Sheet>
  );
}

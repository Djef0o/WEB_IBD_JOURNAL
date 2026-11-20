import './travel.css';
import type { EmergencyInfo } from '../../../domain/care';
import type { Profile, ReminderSchedule } from '../../../domain/profile';
import { travelTotal, tripDays, type TravelLine } from '../../../domain/travel';
import { dateParts, type LocalDate } from '../../../domain/time';
import type { Translator } from '../../../i18n/translator';

/**
 * Travel pack in the language of the destination (content of TravelPdfBuilder.kt): the medication
 * list with quantities, a letter for the treating physician to date, sign and stamp, and the
 * urgent-need card with the emergency contacts. Every text comes from the strings of that
 * language, not of the interface. Paper layout: travel.css.
 */

export interface TravelPack {
  profile: Profile;
  emergency: EmergencyInfo;
  lines: readonly TravelLine[];
  departure: LocalDate;
  returnDate: LocalDate;
  marginDays: number;
  destination: string;
}

/** Blank to fill in by hand (`BLANK`). */
const BLANK = '………………………';

const pad = (n: number): string => String(n).padStart(2, '0');

// i18n-keys: travel_pdf_title travel_pdf_trip travel_pdf_destination travel_pdf_list_title travel_pdf_col_medication
// i18n-keys: travel_pdf_col_schedule travel_pdf_col_quantity travel_pdf_empty travel_pdf_margin_note travel_pdf_carry_note
// i18n-keys: travel_pdf_schedule travel_pdf_schedule_once travel_pdf_card_empty travel_pdf_days travel_pdf_intakes
// i18n-keys: travel_cert_title travel_cert_greeting travel_cert_body travel_cert_list_ref travel_cert_customs
// i18n-keys: travel_cert_sign_place travel_cert_sign_doctor travel_cert_disclaimer travel_cert_condition_default
// i18n-keys: urgent_card_title urgent_card_text emergency_field_born emergency_field_allergies emergency_field_doctor
// i18n-keys: emergency_field_contact emergency_field_notes diagnosis_title diagnosis_crohn diagnosis_uc diagnosis_other
// i18n-keys: repeat_every_days repeat_every_weeks repeat_every_months

export function TravelDocument({ pack, tr }: { pack: TravelPack; tr: Translator }) {
  const { profile, emergency, lines, departure, returnDate, marginDays } = pack;
  const date = (value: LocalDate): string => {
    const { year, month, day } = dateParts(value);
    return new Intl.DateTimeFormat(tr.lang, { dateStyle: 'long' }).format(new Date(year, month - 1, day));
  };
  const schedule = (s: ReminderSchedule): string => {
    const every = Math.max(s.repeatEvery, 1);
    let repeat: string;
    switch (s.repeatUnit) {
      case 'ONCE': return tr.t('travel_pdf_schedule_once');
      case 'DAY': repeat = tr.tp('repeat_every_days', every); break;
      case 'WEEK': repeat = tr.tp('repeat_every_weeks', every); break;
      case 'MONTH': repeat = tr.tp('repeat_every_months', every); break;
    }
    return tr.t('travel_pdf_schedule', [repeat, `${pad(s.hour)}:${pad(s.minute)}`]);
  };
  const diagnosis = ((): string | null => {
    switch (profile.diagnosis) {
      case 'CROHN': return tr.t('diagnosis_crohn');
      case 'ULCERATIVE_COLITIS': return tr.t('diagnosis_uc');
      case 'OTHER': return tr.t('diagnosis_other');
      default: return null;
    }
  })();
  const traveler = [profile.firstName, profile.lastName].filter((part) => part.trim() !== '').join(' ') || BLANK;
  const destination = pack.destination.trim();
  const join = (...parts: string[]): string => parts.filter((part) => part.trim() !== '').join(' · ');
  const cardFields = [
    [tr.t('emergency_field_allergies'), emergency.allergies],
    [tr.t('emergency_field_doctor'), join(emergency.doctorName, emergency.doctorPhone)],
    [tr.t('emergency_field_contact'), join(emergency.contactName, emergency.contactPhone)],
    [tr.t('emergency_field_notes'), emergency.notes],
  ].filter(([, value]) => value!.trim() !== '');

  return (
    <div class="travel-doc" lang={tr.lang}>
      <article class="travel-sheet travel-page" aria-labelledby="travel-title">
        <h1 id="travel-title">{tr.t('travel_pdf_title')}</h1>
        <p class="travel-strong">
          {tr.t('travel_pdf_trip', [date(departure), date(returnDate), tr.tp('travel_pdf_days', tripDays(departure, returnDate))])}
        </p>
        {destination !== '' && <p>{tr.t('travel_pdf_destination', [destination])}</p>}
        <hr />
        <p class="travel-strong">{traveler}</p>
        {profile.birthDate !== null && <p>{tr.t('emergency_field_born')}: {date(profile.birthDate)}</p>}
        {diagnosis !== null && <p>{tr.t('diagnosis_title')}: {diagnosis}</p>}
        <h2>{tr.t('travel_pdf_list_title')}</h2>
        <table class="travel-table">
          <thead>
            <tr>
              <th scope="col">{tr.t('travel_pdf_col_medication')}</th>
              <th scope="col">{tr.t('travel_pdf_col_schedule')}</th>
              <th scope="col">{tr.t('travel_pdf_col_quantity')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.medication.id}>
                <th scope="row">
                  <span>{line.medication.name}</span>
                  {line.medication.dosage.trim() !== '' && <span class="travel-dosage">{line.medication.dosage.trim()}</span>}
                </th>
                <td>{schedule(line.medication.schedule)}</td>
                <td>{tr.tp('travel_pdf_intakes', travelTotal(line))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length === 0 && <p>{tr.t('travel_pdf_empty')}</p>}
        <p class="travel-muted">{tr.t('travel_pdf_margin_note', [marginDays])}</p>
        <p class="travel-muted">{tr.t('travel_pdf_carry_note')}</p>
      </article>

      <article class="travel-sheet travel-page" aria-labelledby="travel-letter-title">
        <h1 id="travel-letter-title">{tr.t('travel_cert_title')}</h1>
        <p>{tr.t('travel_cert_greeting')}</p>
        <p>
          {tr.t('travel_cert_body', [
            traveler,
            profile.birthDate === null ? BLANK : date(profile.birthDate),
            diagnosis ?? tr.t('travel_cert_condition_default'),
            date(departure),
            date(returnDate),
          ])}
        </p>
        <p>{tr.t('travel_cert_list_ref', [marginDays])}</p>
        <p>{tr.t('travel_cert_customs')}</p>
        <p class="travel-strong travel-sign">{tr.t('travel_cert_sign_place')}</p>
        <p class="travel-strong travel-sign-doctor">{tr.t('travel_cert_sign_doctor')}</p>
        <hr />
        <p class="travel-muted">{tr.t('travel_cert_disclaimer')}</p>
      </article>

      <article class="travel-sheet travel-page" aria-labelledby="travel-card-title">
        <h1 id="travel-card-title" class="travel-card-title">{tr.t('urgent_card_title')}</h1>
        <p class="travel-card-text">{tr.t('urgent_card_text')}</p>
        <hr />
        <dl class="travel-card-fields">
          {cardFields.map(([label, value]) => (
            <div key={label}>
              <dt class="travel-strong">{label}</dt>
              <dd>{value!.trim()}</dd>
            </div>
          ))}
        </dl>
        {cardFields.length === 0 && <p class="travel-muted">{tr.t('travel_pdf_card_empty')}</p>}
      </article>
    </div>
  );
}

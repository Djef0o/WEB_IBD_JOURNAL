import './travel/travel.css';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { getEmergencyInfo } from '../../db/emergency';
import { getAllMedications } from '../../db/medications';
import { getProfile } from '../../db/profile';
import { emergencyInfo } from '../../domain/care';
import { profile as emptyProfile } from '../../domain/profile';
import { parseLocalDate, plusDays, today, type LocalDate } from '../../domain/time';
import {
  DEFAULT_TRAVEL_MARGIN_DAYS, MAX_TRAVEL_MARGIN_DAYS, travelMissing, travelPlan, travelTotal,
} from '../../domain/travel';
import { lang as uiLang, t, tp } from '../../i18n';
import { loadTranslator, type Translator } from '../../i18n/translator';
import type { ScreenProps } from '../../router';
import { Button, Card, SegmentedControl } from '../components';
import { TextField } from '../forms';
import { TravelDocument } from './travel/TravelDocument';

/** Languages the travel pack can be written in (`TravelLanguage`). */
const TRAVEL_LANGUAGES = ['fr', 'en', 'es', 'de'] as const;
type TravelLanguage = (typeof TRAVEL_LANGUAGES)[number];

const MAX_DESTINATION_LENGTH = 60;

/** The app's language when the pack is offered in it, English otherwise. */
function defaultLanguage(): TravelLanguage {
  return TRAVEL_LANGUAGES.find((language) => language === uiLang.peek()) ?? 'en';
}

/** "Français", "English", "Español", "Deutsch": each language in its own language. */
function languageName(language: TravelLanguage): string {
  const name = new Intl.DisplayNames(language, { type: 'language' }).of(language) ?? language;
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}

function isDate(value: string): boolean {
  try {
    parseLocalDate(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Travel pack: dates, destination and language of the documents, the medication to take along
 * (the schedule over the trip plus a safety margin, compared with the counted stock), and the
 * printable documents (browser "Save as PDF"): list, letter for the doctor to sign, urgent-need card.
 */
export default function Travel(_props: ScreenProps) {
  const [departure, setDeparture] = useState<LocalDate>(() => plusDays(today(), 7));
  const [returnDate, setReturnDate] = useState<LocalDate>(() => plusDays(today(), 14));
  const [marginText, setMarginText] = useState(String(DEFAULT_TRAVEL_MARGIN_DAYS));
  const [destination, setDestination] = useState('');
  const [language, setLanguage] = useState<TravelLanguage>(defaultLanguage);
  const [translator, setTranslator] = useState<Translator | null>(null);

  const margin = Math.min(Math.max(Number.parseInt(marginText, 10) || 0, 0), MAX_TRAVEL_MARGIN_DAYS);

  useEffect(() => {
    let current = true;
    void loadTranslator(language).then((loaded) => {
      if (current) setTranslator(loaded);
    });
    return () => { current = false; };
  }, [language]);

  const data = useLiveQuery(['profile', 'medications', 'emergency_info'], async () => {
    const [profile, medications, emergency] = await Promise.all([getProfile(), getAllMedications(), getEmergencyInfo()]);
    return { profile: profile ?? emptyProfile(), medications, emergency: emergency ?? emergencyInfo() };
  });
  const lines = useMemo(
    () => (data === undefined ? [] : travelPlan(data.medications, departure, returnDate, margin)),
    [data, departure, returnDate, margin],
  );
  const ready = data !== undefined && translator !== null && translator.lang === language;

  function changeDeparture(value: string): void {
    if (!isDate(value)) return;
    setDeparture(value);
    if (returnDate < value) setReturnDate(value);
  }
  function changeReturn(value: string): void {
    if (!isDate(value)) return;
    setReturnDate(value);
    if (departure > value) setDeparture(value);
  }

  return (
    <div class="travel">
      <div class="travel-toolbar">
        <Button variant="text" href="/care">{t('cancel')}</Button>
        <h1 class="page-title">{t('travel_title')}</h1>
      </div>

      <div class="travel-form">
        <Card title={t('travel_title')}>
          <div class="travel-dates">
            <TextField label={t('travel_departure')} type="date" value={departure} onInput={changeDeparture} required />
            <TextField label={t('travel_return')} type="date" value={returnDate} min={departure} onInput={changeReturn} required />
          </div>
          <TextField
            label={t('travel_margin')}
            hint={t('travel_margin_hint')}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_TRAVEL_MARGIN_DAYS}
            value={marginText}
            onInput={setMarginText}
          />
          <p class="text-muted text-sm" role="status">{tp('travel_margin_days', margin)}</p>
          <TextField
            label={t('travel_destination')}
            value={destination}
            maxLength={MAX_DESTINATION_LENGTH}
            autocomplete="off"
            onInput={setDestination}
          />
          <SegmentedControl
            label={t('travel_language')}
            hideLabel={false}
            options={TRAVEL_LANGUAGES.map((value) => ({ value, label: languageName(value) }))}
            value={language}
            onChange={setLanguage}
          />
        </Card>

        <Card title={t('travel_list_title')}>
          {data !== undefined && lines.length === 0 && <p class="text-muted">{t('travel_empty')}</p>}
          <ul class="travel-lines">
            {lines.map((line) => {
              const { medication } = line;
              const missing = travelMissing(line);
              return (
                <li key={medication.id} class="travel-line">
                  <span class="travel-line-name">
                    {[medication.name, medication.dosage].filter((part) => part.trim() !== '').join(' · ')}
                  </span>
                  <span class="text-muted text-sm">
                    {tp('travel_intakes', travelTotal(line))} · {t('travel_line_detail', [line.onTrip, line.margin])}
                  </span>
                  {missing !== null && missing > 0 && (
                    <span class="travel-missing text-sm">{t('travel_line_missing', [medication.stockDoses ?? 0, missing])}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p class="travel-note">{t('travel_vaccines')}</p>
          <p class="travel-note">{t('travel_disclaimer')}</p>
          <div class="travel-actions">
            <Button onClick={() => window.print()} disabled={!ready}>{t('travel_create')}</Button>
            <p class="text-muted text-sm">{t('web_print_hint')}</p>
          </div>
        </Card>
      </div>

      {ready && (
        <TravelDocument
          tr={translator}
          pack={{
            profile: data.profile, emergency: data.emergency, lines, departure, returnDate,
            marginDays: margin, destination,
          }}
        />
      )}
    </div>
  );
}

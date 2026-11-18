import { dateParts, plusDays, type LocalDate } from '../../../domain/time';
import { formatDate, lang, tp, t } from '../../../i18n';
import { formatLocalDate } from '../../format';
import type { Stool } from '../../../domain/models';
import { lastStool, realCount, type MonthRef } from './calendar';

/** Première lettre en capitale dans la langue courante (`DateFormats.capitalize`). */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(lang.value) + text.slice(1);
}

/** « Novembre 2026 » (`DateFormats.monthYear`). */
export function monthLabel(m: MonthRef): string {
  return capitalize(formatDate(new Date(m.year, m.month - 1, 1), { month: 'long', year: 'numeric' }));
}

/** « Samedi 14 novembre » (`DateFormats.weekdayDayMonth`). */
export function weekdayDayMonth(date: LocalDate): string {
  return capitalize(formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** « Samedi 14 novembre 2026 » (`DateFormats.fullDate`). */
export function fullDate(date: LocalDate): string {
  return capitalize(formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
}

/** En-têtes de colonnes, lundi d'abord : initiale et nom complet. */
export function weekdayHeaders(): { narrow: string; long: string }[] {
  const monday = '2024-01-01';
  return Array.from({ length: 7 }, (_, i) => {
    const d = plusDays(monday, i);
    return { narrow: formatLocalDate(d, { weekday: 'narrow' }), long: formatLocalDate(d, { weekday: 'long' }) };
  });
}

export function narrowWeekdayAndDay(date: LocalDate): string {
  return `${formatLocalDate(date, { weekday: 'narrow' })} ${dateParts(date).day}`;
}

/** Heure locale courte d'une saisie (`DateFormats.time(epochMillis)`). */
export function timeOfDay(epochMillis: number): string {
  return formatDate(epochMillis, { timeStyle: 'short' });
}

/** Résumé d'un jour pour les lecteurs d'écran : nombre de selles et type de la dernière entrée. */
export function daySummary(stools: readonly Stool[]): string {
  const last = lastStool(stools);
  if (!last) return t('empty_day');
  const count = realCount(stools);
  if (count === 0) return t('false_urge');
  return `${tp('stools_count', count)}, ${t('analysis_type', [last.bristolType])}`;
}

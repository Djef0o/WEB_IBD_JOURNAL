import { dateParts, type LocalDate } from '../domain/time';
import { formatDate, formatNumber } from '../i18n';

/** Date calendaire (AAAA-MM-JJ) dans la langue courante ; sans fuseau, donc sans décalage possible. */
export function formatLocalDate(date: LocalDate, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }): string {
  const { year, month, day } = dateParts(date);
  return formatDate(new Date(year, month - 1, day), options);
}

/** Heure `HH:MM` dans la langue courante (12 h ou 24 h selon la langue). */
export function formatTime(hour: number, minute: number): string {
  return formatDate(new Date(2000, 0, 1, hour, minute), { timeStyle: 'short' });
}

/** Un chiffre après la virgule, dans la langue courante (`formatDecimal`). */
export function formatDecimal(value: number): string {
  return formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** `m:ss`, like the lock screen of the Android app. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

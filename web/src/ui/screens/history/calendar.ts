import { daysInMonth, dateParts, localDate, minusDays, plusDays, plusMonths, toEpochDays, type LocalDate } from '../../../domain/time';
import { isRealStool, type Stool } from '../../../domain/models';

/** Logique pure du calendrier mensuel (`HistoryScreen.kt`, `HistoryViewModel.kt`). La semaine commence le lundi. */

export interface MonthRef {
  year: number;
  /** 1 à 12. */
  month: number;
}

export function monthOf(date: LocalDate): MonthRef {
  const { year, month } = dateParts(date);
  return { year, month };
}

export function sameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

export function shiftMonth(m: MonthRef, delta: number): MonthRef {
  return monthOf(plusMonths(localDate(m.year, m.month, 1), delta));
}

export function firstDayOf(m: MonthRef): LocalDate {
  return localDate(m.year, m.month, 1);
}

export function lastDayOf(m: MonthRef): LocalDate {
  return localDate(m.year, m.month, daysInMonth(m.year, m.month));
}

/** Jour de la semaine, 0 = lundi … 6 = dimanche (le 1970-01-01 est un jeudi). */
export function weekdayIndex(date: LocalDate): number {
  return (((toEpochDays(date) + 3) % 7) + 7) % 7;
}

/** Lignes de 7 cases (lundi d'abord) ; `null` pour les cases hors du mois. */
export function monthCells(m: MonthRef): (LocalDate | null)[][] {
  const leading = weekdayIndex(firstDayOf(m));
  const total = daysInMonth(m.year, m.month);
  const rows = Math.ceil((leading + total) / 7);
  const result: (LocalDate | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (LocalDate | null)[] = [];
    for (let c = 0; c < 7; c++) {
      const day = r * 7 + c - leading + 1;
      row.push(day >= 1 && day <= total ? localDate(m.year, m.month, day) : null);
    }
    result.push(row);
  }
  return result;
}

/** Selles regroupées par jour, dans l'ordre reçu. */
export function groupByDate(stools: readonly Stool[]): Map<LocalDate, Stool[]> {
  const map = new Map<LocalDate, Stool[]>();
  for (const s of stools) {
    const list = map.get(s.date);
    if (list) list.push(s);
    else map.set(s.date, [s]);
  }
  return map;
}

/** Dernière entrée du jour (`maxByOrNull { createdAt }`) : elle donne la couleur du jour. */
export function lastStool(stools: readonly Stool[]): Stool | undefined {
  let best: Stool | undefined;
  for (const s of stools) if (!best || s.createdAt > best.createdAt) best = s;
  return best;
}

export function realCount(stools: readonly Stool[]): number {
  return stools.filter(isRealStool).length;
}

/** Moyenne de Bristol des vraies selles, `null` sans selle. */
export function averageBristol(stools: readonly Stool[]): number | null {
  const real = stools.filter(isRealStool);
  if (real.length === 0) return null;
  return real.reduce((sum, s) => sum + s.bristolType, 0) / real.length;
}

export interface WeekDay {
  date: LocalDate;
  count: number;
  /** Type de Bristol de la dernière entrée, `null` sans entrée. */
  type: number | null;
  /** Hauteur de la barre en px (3 si vide, sinon 8 + 32·n/max, comme Android). */
  barPx: number;
}

/** Les 7 derniers jours se terminant à `today`, du plus ancien au plus récent. */
export function lastWeek(today: LocalDate, byDay: ReadonlyMap<LocalDate, readonly Stool[]>): WeekDay[] {
  const days: LocalDate[] = [];
  for (let offset = 6; offset >= 0; offset--) days.push(minusDays(today, offset));
  const counts = days.map((d) => realCount(byDay.get(d) ?? []));
  const max = Math.max(1, ...counts);
  return days.map((date, i) => {
    const count = counts[i]!;
    return {
      date,
      count,
      type: lastStool(byDay.get(date) ?? [])?.bristolType ?? null,
      barPx: count === 0 ? 3 : Math.floor(8 + (32 * count) / max),
    };
  });
}

/** Les `limit` jours les plus récents ayant des entrées, du plus récent au plus ancien. */
export function recentDays(byDay: ReadonlyMap<LocalDate, readonly Stool[]>, limit = 5): { date: LocalDate; stools: readonly Stool[] }[] {
  return [...byDay.entries()]
    .filter(([, list]) => list.length > 0)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, limit)
    .map(([date, stools]) => ({ date, stools }));
}

/**
 * Case voisine pour une touche de navigation du calendrier ; `null` si la touche n'en déplace pas.
 * Flèches : ±1 jour / ±7 jours ; Début/Fin : lundi/dimanche de la semaine ;
 * Page précédente/suivante : même jour le mois précédent/suivant (borné à la fin du mois).
 */
export function moveFocus(date: LocalDate, key: string): LocalDate | null {
  switch (key) {
    case 'ArrowLeft': return minusDays(date, 1);
    case 'ArrowRight': return plusDays(date, 1);
    case 'ArrowUp': return minusDays(date, 7);
    case 'ArrowDown': return plusDays(date, 7);
    case 'Home': return minusDays(date, weekdayIndex(date));
    case 'End': return plusDays(date, 6 - weekdayIndex(date));
    case 'PageUp': return plusMonths(date, -1);
    case 'PageDown': return plusMonths(date, 1);
    default: return null;
  }
}


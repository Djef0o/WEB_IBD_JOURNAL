import { useEffect, useRef, useState } from 'preact/hooks';
import type { Stool } from '../../../domain/models';
import type { LocalDate } from '../../../domain/time';
import { dateParts } from '../../../domain/time';
import { t } from '../../../i18n';
import '../../care/flares/flares.css';
import { firstDayOf, lastStool, monthCells, monthOf, moveFocus, sameMonth, type MonthRef } from './calendar';
import { daySummary, fullDate, weekdayHeaders } from './labels';

interface MonthGridProps {
  month: MonthRef;
  byDay: ReadonlyMap<LocalDate, readonly Stool[]>;
  today: LocalDate;
  labelledBy: string;
  /** Jours couverts par une poussée : barre rouge en haut de la case (`FlareMark`). */
  flareDays?: ReadonlySet<LocalDate>;
  /** Le focus clavier sort du mois : l'écran affiche le mois de `date`. */
  onMonthChange(month: MonthRef): void;
}

/**
 * Calendrier mensuel : `role="grid"` à tabulation itinérante (un seul arrêt de Tab), navigation
 * aux flèches, Début/Fin, PageHaut/PageBas. Chaque jour est un lien vers `/day/AAAA-MM-JJ` dont
 * le nom annonce la date et le résumé (nombre de selles, dernier type).
 */
export function MonthGrid({ month, byDay, today, labelledBy, flareDays, onMonthChange }: MonthGridProps) {
  const root = useRef<HTMLDivElement>(null);
  const [focusDate, setFocusDate] = useState<LocalDate | null>(null);
  const moveFocusPending = useRef(false);

  const inMonth = (d: LocalDate): boolean => sameMonth(monthOf(d), month);
  const tabStop = focusDate && inMonth(focusDate) ? focusDate : inMonth(today) ? today : firstDayOf(month);

  useEffect(() => {
    if (!moveFocusPending.current || !focusDate) return;
    const link = root.current?.querySelector<HTMLElement>(`a[data-date="${focusDate}"]`);
    if (link) {
      moveFocusPending.current = false;
      link.focus();
    }
  }, [focusDate, month]);

  const headers = weekdayHeaders();

  function link(e: Event): HTMLAnchorElement | null {
    return (e.target as Element).closest<HTMLAnchorElement>('a[data-date]');
  }

  return (
    <div
      ref={root}
      class="cal"
      role="grid"
      aria-labelledby={labelledBy}
      onKeyDown={(e) => {
        const a = link(e);
        if (!a || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === ' ') {
          e.preventDefault(); // pas de défilement ; l'activation se fait au relâchement, comme un bouton
          return;
        }
        const next = moveFocus(a.dataset.date!, e.key);
        if (!next) return;
        e.preventDefault();
        moveFocusPending.current = true;
        setFocusDate(next);
        if (!inMonth(next)) onMonthChange(monthOf(next));
      }}
      onKeyUp={(e) => {
        const a = link(e);
        if (a && e.key === ' ') a.click();
      }}
    >
      <div class="cal-row" role="row">
        {headers.map((h) => (
          <div key={h.long} class="cal-head" role="columnheader">
            <span class="visually-hidden">{h.long}</span>
            <span aria-hidden="true">{h.narrow}</span>
          </div>
        ))}
      </div>
      {monthCells(month).map((row, r) => (
        <div key={r} class="cal-row" role="row">
          {row.map((date, c) => {
            if (date === null) return <div key={c} class="cal-cell" role="gridcell" aria-hidden="true" />;
            const stools = byDay.get(date) ?? [];
            const last = lastStool(stools);
            const isToday = date === today;
            const isFlare = flareDays?.has(date) === true;
            return (
              <div key={c} class="cal-cell" role="gridcell">
                <a
                  class="cal-day"
                  href={`/day/${date}`}
                  data-date={date}
                  data-bristol={last ? last.bristolType : undefined}
                  data-today={isToday ? '' : undefined}
                  data-flare={isFlare ? '' : undefined}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${isFlare ? t('flaremark_day_desc', [fullDate(date)]) : fullDate(date)}${isToday ? `, ${t('today')}` : ''}, ${daySummary(stools)}`}
                  tabIndex={date === tabStop ? 0 : -1}
                  onFocus={() => setFocusDate(date)}
                >
                  <span class="cal-num" aria-hidden="true">{dateParts(date).day}</span>
                  <span class="cal-bar" aria-hidden="true" />
                </a>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

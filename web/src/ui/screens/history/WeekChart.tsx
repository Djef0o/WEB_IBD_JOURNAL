import type { WeekDay } from './calendar';
import { t, tp } from '../../../i18n';
import { fullDate, narrowWeekdayAndDay } from './labels';

/** Selles par jour sur les 7 derniers jours (liste ; texte masqué pour les lecteurs d'écran). */
export function WeekChart({ days }: { days: readonly WeekDay[] }) {
  return (
    <figure class="week">
      <figcaption class="text-muted text-sm">{t('history_chart_caption')}</figcaption>
      <ol class="week-list" role="list">
        {days.map((d) => (
          <li key={d.date} class="week-day">
            <span class="visually-hidden">{`${fullDate(d.date)} : ${tp('stools_count', d.count)}`}</span>
            <span class="week-count" data-zero={d.count === 0 ? '' : undefined} aria-hidden="true">{d.count}</span>
            <span class="week-track" aria-hidden="true">
              <span class="week-bar" data-bristol={d.type ?? undefined} style={{ '--bar': `${d.barPx}px` }} />
            </span>
            <span class="week-label text-muted" aria-hidden="true">{narrowWeekdayAndDay(d.date)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

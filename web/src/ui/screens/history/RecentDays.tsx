import type { Stool } from '../../../domain/models';
import type { LocalDate } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { BristolIcon } from '../../components';
import { lastStool, realCount } from './calendar';
import { timeOfDay, weekdayDayMonth } from './labels';

/** Les 5 jours récents du mois affiché, avec la dernière entrée de chaque jour. */
export function RecentDays({ days }: { days: readonly { date: LocalDate; stools: readonly Stool[] }[] }) {
  if (days.length === 0) return null;
  return (
    <section class="stack-sm" aria-labelledby="recent-title">
      <h2 id="recent-title">{t('history_recent')}</h2>
      <ul class="recent-list" role="list">
        {days.map(({ date, stools }) => {
          const last = lastStool(stools)!;
          return (
            <li key={date}>
              <a class="recent-item" href={`/day/${date}`}>
                <BristolIcon type={last.bristolType} size="sm" />
                <span class="recent-text">
                  <span class="recent-date">{weekdayDayMonth(date)}</span>
                  <span class="text-muted text-sm">
                    {`${tp('stools_count', realCount(stools))} · ${t('analysis_type', [last.bristolType])}`}
                  </span>
                </span>
                <span class="text-muted text-sm">{timeOfDay(last.createdAt)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

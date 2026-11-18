import './history/history.css';
import { signal } from '@preact/signals';
import { useRef } from 'preact/hooks';
import { useLiveQuery } from '../../db/live';
import { getStoolsBetween, getStoolsInMonth } from '../../db/stools';
import type { Stool } from '../../domain/models';
import { minusDays, today as todayDate } from '../../domain/time';
import { formatNumber, t, tp } from '../../i18n';
import type { ScreenProps } from '../../router';
import { Button, Card } from '../components';
import { averageBristol, groupByDate, lastWeek, monthOf, realCount, recentDays, sameMonth, shiftMonth, type MonthRef } from './history/calendar';
import { monthLabel } from './history/labels';
import { MonthGrid } from './history/MonthGrid';
import { RecentDays } from './history/RecentDays';
import { WeekChart } from './history/WeekChart';

/** Mois affiché : conservé pendant la session (retour depuis un jour). */
const shown = signal<MonthRef>(monthOf(todayDate()));

/** Historique : calendrier mensuel coloré par consistance, statistiques du mois, jours récents. */
export default function History(_props: ScreenProps) {
  const month = shown.value;
  const now = todayDate();
  const isCurrent = sameMonth(month, monthOf(now));

  const loaded = useLiveQuery(['stools'], () => getStoolsInMonth(month.year, month.month), [month.year, month.month]);
  // Garde les données du mois précédent pendant le chargement : pas de clignotement des couleurs.
  const previous = useRef<Stool[]>([]);
  if (loaded) previous.current = loaded;
  const stools = loaded ?? previous.current;

  const week = useLiveQuery(
    ['stools'],
    () => (isCurrent ? getStoolsBetween(minusDays(now, 6), now) : Promise.resolve([] as Stool[])),
    [isCurrent, now],
  );

  const byDay = groupByDate(stools);
  const average = averageBristol(stools);
  const days = isCurrent && stools.length > 0 && week ? lastWeek(now, groupByDate(week)) : null;
  const label = monthLabel(month);
  const go = (delta: number) => {
    shown.value = shiftMonth(month, delta);
  };

  return (
    <div class="history">
      <header class="history-head">
        <p class="text-muted text-sm">{label}</p>
        <h1 class="page-title">{t('history_title')}</h1>
      </header>

      <div class="history-layout">
        <Card variant="outlined" class="history-month">
          <div class="history-nav">
            <Button variant="text" class="history-step" aria-label={t('previous')} onClick={() => go(-1)}>
              <Chevron dir="prev" />
            </Button>
            <h2 id="month-title" class="history-month-title" aria-live="polite">{label}</h2>
            <Button variant="text" class="history-step" aria-label={t('next')} onClick={() => go(1)}>
              <Chevron dir="next" />
            </Button>
          </div>
          {!isCurrent && (
            <Button
              variant="text"
              class="history-today"
              onClick={() => {
                shown.value = monthOf(now);
              }}
            >
              {t('today')}
            </Button>
          )}
          <MonthGrid
            month={month}
            byDay={byDay}
            today={now}
            labelledBy="month-title"
            onMonthChange={(m) => {
              shown.value = m;
            }}
          />
          <div class="legend" aria-hidden="true">
            <span class="text-muted text-sm">{t('history_legend')}</span>
            <span class="text-muted text-sm">0</span>
            <span class="legend-dots">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <i key={n} class="legend-dot" data-bristol={n} />)}
            </span>
            <span class="text-muted text-sm">7</span>
          </div>
          <p class="text-muted text-sm">{t('history_legend_note')}</p>
        </Card>

        <div class="stack">
          <Card variant="outlined" title={t('history_month')}>
            <div class="stats-row">
              <p class="stats-count">{tp('history_month_stools', realCount(stools))}</p>
              <p class="stats-avg">
                {t('history_avg', [average === null ? '—' : formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })])}
              </p>
            </div>
            {days && <WeekChart days={days} />}
          </Card>
          <RecentDays days={recentDays(byDay)} />
        </div>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg class="chevron" data-dir={dir} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

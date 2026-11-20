import './analysis/analysis.css';
import { useMemo } from 'preact/hooks';
import { analyze, averageBristol, realStools, startFrom } from '../../domain/analysis';
import { fromEpochDays, today as todayDate } from '../../domain/time';
import { getAllStools } from '../../db/stools';
import { getMealsBetween } from '../../db/meals';
import { useLiveQuery } from '../../db';
import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { daysFollowed } from '../../report/reportData';
import { Button, Card, SegmentedControl } from '../components';
import { DailyStoolChart } from '../charts/DailyStoolChart';
import { historyBars } from '../charts/dailyStool';
import { formatDecimal } from '../format';
import { WeightCard } from '../weight/WeightCard';
import { FoodLinksCard } from './analysis/FoodLinksCard';
import { SymptomsCard } from './analysis/SymptomsCard';
import { WellbeingLinksCard } from './analysis/WellbeingLinksCard';
import { analysisPeriod, periodLabel, periodOptions } from './analysis/period';
import { useFlares } from '../care/flares/FlareMarks';

/** Trends: tiles and symptoms over the chosen period; the chart always covers the whole history. */
export default function Analysis(_props: ScreenProps) {
  const period = analysisPeriod.value;
  const data = useLiveQuery(['stools', 'meals', 'products'], async () => {
    const today = todayDate();
    // Without a start bound ("All"): all meals since the beginning.
    const mealsFrom = startFrom(period, today) ?? fromEpochDays(0);
    const [history, meals] = await Promise.all([getAllStools(), getMealsBetween(mealsFrom, today)]);
    return { today, history, meals };
  }, [period]);

  const summary = useMemo(
    () => (data ? analyze(data.history, data.meals, data.today, period) : null),
    [data, period],
  );
  const flares = useFlares();
  const bars = useMemo(() => (data ? historyBars(data.history, data.today, flares ?? []) : null), [data, flares]);

  return (
    <div class="stack">
      <header class="stack-sm">
        <p class="text-muted text-sm">{periodLabel(period)}</p>
        <h1 class="page-title">{t('analysis_title')}</h1>
        {/* Drives the tiles and the symptoms; the chart always covers the whole history. */}
        <SegmentedControl
          label={t('web_period_label')}
          options={periodOptions()}
          value={period}
          onChange={(value) => { analysisPeriod.value = value; }}
        />
        <div>
          <Button variant="outlined" href="/report">{t('web_report_open')}</Button>
        </div>
      </header>

      {summary && bars && (
        <>
          <div class="metric-grid">
            <Metric value={String(realStools(summary).length)} label={t('analysis_stools')} />
            <Metric value={decimalOrDash(averageBristol(summary))} label={t('analysis_avg')} />
            <Metric value={String(summary.meals.length)} label={t('analysis_meals')} />
            <Metric value={String(daysFollowed(summary))} label={t('analysis_days')} />
            <Metric value={decimalOrDash(summary.liquidPerDay)} label={t('analysis_liquid_per_day')} wide />
          </div>
          {data!.history.length > 0 && (
            <Card variant="outlined">
              <DailyStoolChart
                bars={bars}
                layout="scroll"
                title={t('analysis_daily')}
                subtitle={t('analysis_daily_period')}
              />
            </Card>
          )}
          {summary.stools.length === 0
            ? <Card><p class="text-muted">{t('analysis_no_data')}</p></Card>
            : <SymptomsCard summary={summary} />}
          <FoodLinksCard />
          <WellbeingLinksCard />
          <WeightCard />
        </>
      )}
    </div>
  );
}

function decimalOrDash(value: number | null): string {
  return value === null ? '—' : formatDecimal(value);
}

function Metric({ value, label, wide = false }: { value: string; label: string; wide?: boolean }) {
  return (
    <div class="metric" data-wide={wide ? '' : undefined}>
      <p class="metric-value">{value}</p>
      <p class="text-muted text-sm">{label}</p>
    </div>
  );
}

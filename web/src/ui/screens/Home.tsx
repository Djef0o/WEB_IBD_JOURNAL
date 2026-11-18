import './home/home.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { getMealsBetween } from '../../db/meals';
import { notificationSettings } from '../../db/prefs';
import { getStoolsBetween } from '../../db/stools';
import { localDate, toEpochDays } from '../../domain/time';
import type { MealType } from '../../domain/models';
import { formatNumber, t, tp } from '../../i18n';
import TodayTasksCard from '../../reminders/TodayTasksCard';
import type { ScreenProps } from '../../router';
import { Card, EmptyState } from '../components';
import { formatLocalDate, formatTime } from '../format';
import { MealEditorSheet } from '../meal/MealEditorSheet';
import { MealTypeSheet } from '../meal/MealTypeSheet';
import { QuickStoolSheet } from '../stool/QuickStoolSheet';
import { StoolSheet } from '../stool/StoolSheet';
import { stoolSummary, stoolTitle } from '../stool/stoolText';
import { BristolBadge } from './home/BristolBadge';
import { CheckInCard } from './home/CheckInCard';
import { BellIcon, DropIcon, EditIcon, RestaurantIcon } from './home/icons';
import { averageBristol, feedEntries, isCalmDay, realStoolCount, weekStart } from './home/homeLogic';
import { useNow } from './home/useNow';

interface StoolEditor {
  stoolId?: number;
  initialBristol?: number;
  initialFalseUrge?: boolean;
}
interface MealEditor {
  type: MealType;
  mealId?: number;
}

const formatAverage = (value: number | null): string =>
  value === null ? '—' : formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div class="stat">
      <span class="stat-value">{value}</span>
      <span class="stat-label text-muted text-sm">{label}</span>
    </div>
  );
}

/** Tableau de bord : résumé du jour, saisies rapides, fil du jour, semaine, bilan du soir. */
export default function Home(_props: ScreenProps) {
  const now = useNow();
  const date = localDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const epochDay = toEpochDays(date);
  const minutesOfDay = now.getHours() * 60 + now.getMinutes();
  const from = weekStart(date);

  const week = useLiveQuery(
    ['stools', 'meals', 'products'],
    async () => ({ stools: await getStoolsBetween(from, date), meals: await getMealsBetween(from, date) }),
    [date],
  );
  const reminder = notificationSettings.value;

  const [quickOpen, setQuickOpen] = useState(false);
  const [mealTypesOpen, setMealTypesOpen] = useState(false);
  const [stoolEditor, setStoolEditor] = useState<StoolEditor | null>(null);
  const [mealEditor, setMealEditor] = useState<MealEditor | null>(null);
  // Les feuilles gardent leur dernier état pendant leur animation de fermeture.
  const [lastStoolEditor, setLastStoolEditor] = useState<StoolEditor>({});
  const [lastMealEditor, setLastMealEditor] = useState<MealEditor>({ type: 'BREAKFAST' });
  const openStool = (editor: StoolEditor) => { setLastStoolEditor(editor); setStoolEditor(editor); };
  const openMeal = (editor: MealEditor) => { setLastMealEditor(editor); setMealEditor(editor); };

  const stools = week?.stools.filter((s) => s.date === date) ?? [];
  const meals = week?.meals.filter((m) => m.date === date) ?? [];
  const entries = feedEntries(meals, stools);
  const todayCount = realStoolCount(stools);
  const weekCount = realStoolCount(week?.stools ?? []);

  return (
    <div class="home">
      <header class="home-header">
        <p class="text-muted text-sm">{t('home_greeting')}</p>
        <h1 class="page-title">{formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
      </header>

      <div class="home-grid">
        <div class="home-col home-col-main">
          <Card variant="outlined" class="home-card home-summary" title={t('home_today')} headingLevel={2}>
            {isCalmDay(stools) && <span class="pill">{t('home_calm')}</span>}
            <div class="stats">
              <Stat value={String(todayCount)} label={tp('stools_label', todayCount)} />
              <Stat value={String(meals.length)} label={tp('meals_label', meals.length)} />
              <Stat value={formatAverage(averageBristol(stools))} label={t('home_stat_bristol')} />
            </div>
          </Card>

          <div class="home-actions">
            <button type="button" class="action-card" data-tone="tertiary" onClick={() => setMealTypesOpen(true)}>
              <span class="action-icon"><RestaurantIcon /></span>
              <span class="action-title">{t('home_action_meal')}</span>
              <span class="text-muted text-sm">{t('home_action_meal_sub')}</span>
            </button>
            <button type="button" class="action-card" data-tone="primary" onClick={() => setQuickOpen(true)}>
              <span class="action-icon"><DropIcon /></span>
              <span class="action-title">{t('home_action_stool')}</span>
              <span class="text-muted text-sm">{t('home_action_stool_sub')}</span>
            </button>
          </div>

          <section class="home-feed" aria-labelledby="home-feed-title">
            <h2 id="home-feed-title">{t('home_feed')}</h2>
            {week && entries.length === 0 ? (
              <EmptyState title={t('home_empty')} />
            ) : (
              <ol class="feed">
                {entries.map((entry) => (
                  <li key={entry.key} data-kind={entry.kind}>
                    <button
                      type="button"
                      class="feed-row"
                      onClick={() =>
                        entry.kind === 'meal'
                          ? openMeal({ type: entry.meal.type, mealId: entry.meal.id })
                          : openStool({ stoolId: entry.stool.id })
                      }
                    >
                      <span class="feed-text">
                        <span class="feed-title">
                          {entry.kind === 'meal' ? <MealLabel type={entry.meal.type} /> : stoolTitle(entry.stool)}
                        </span>
                        <span class="text-muted text-sm feed-sub">
                          {entry.kind === 'meal' ? entry.meal.description || '—' : stoolSummary(entry.stool)}
                        </span>
                      </span>
                      {entry.kind === 'stool' && (
                        <time class="text-muted text-sm" dateTime={new Date(entry.stool.createdAt).toISOString()}>
                          {formatTime(new Date(entry.stool.createdAt).getHours(), new Date(entry.stool.createdAt).getMinutes())}
                        </time>
                      )}
                      {entry.kind === 'meal' ? <span class="feed-icon"><RestaurantIcon /></span> : <BristolBadge type={entry.stool.bristolType} />}
                      <span class="feed-edit"><EditIcon /><span class="visually-hidden">{t('edit')}</span></span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div class="home-col home-col-side">
          <div class="home-todo">
            <CheckInCard date={date} minutesOfDay={minutesOfDay} />
            <TodayTasksCard />
          </div>

          <Card variant="outlined" class="home-card home-week" title={t('home_week')} headingLevel={2}>
            <div class="stats">
              <Stat value={String(weekCount)} label={tp('stools_label', weekCount)} />
              <Stat value={formatAverage(averageBristol(week?.stools ?? []))} label={t('home_week_avg')} />
              <Stat value={String(week?.meals.length ?? 0)} label={t('home_week_meals')} />
            </div>
          </Card>

          {reminder?.enabled && (
            <aside class="home-reminder">
              <span class="action-icon" data-tone="primary"><BellIcon /></span>
              <div>
                <p class="feed-title">{t('home_reminder', [formatTime(reminder.hour, reminder.minute)])}</p>
                <p class="text-muted text-sm">{t('home_reminder_sub')}</p>
              </div>
            </aside>
          )}
        </div>
      </div>

      <MealTypeSheet
        open={mealTypesOpen}
        onClose={() => setMealTypesOpen(false)}
        onPick={(type) => { setMealTypesOpen(false); openMeal({ type }); }}
      />
      <QuickStoolSheet
        open={quickOpen}
        dateEpochDay={epochDay}
        onClose={() => setQuickOpen(false)}
        onDetails={(initialBristol, initialFalseUrge) => {
          setQuickOpen(false);
          openStool({ initialBristol, initialFalseUrge });
        }}
      />
      <StoolSheet
        open={stoolEditor !== null}
        dateEpochDay={epochDay}
        stoolId={lastStoolEditor.stoolId}
        initialBristol={lastStoolEditor.initialBristol}
        initialFalseUrge={lastStoolEditor.initialFalseUrge}
        onClose={() => setStoolEditor(null)}
      />
      <MealEditorSheet
        open={mealEditor !== null}
        date={date}
        mealType={lastMealEditor.type}
        mealId={lastMealEditor.mealId}
        onClose={() => setMealEditor(null)}
      />
    </div>
  );
}

function MealLabel({ type }: { type: MealType }) {
  // i18n-keys: meal_breakfast meal_lunch meal_dinner
  return <>{t(type === 'BREAKFAST' ? 'meal_breakfast' : type === 'LUNCH' ? 'meal_lunch' : 'meal_dinner')}</>;
}

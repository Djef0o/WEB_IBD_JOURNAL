import './day/day.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../db/live';
import { deleteMeal, getMealsBetween } from '../../db/meals';
import { deleteStool, getStoolsBetween } from '../../db/stools';
import type { Meal, MealType, Stool } from '../../domain/models';
import { isRealStool } from '../../domain/models';
import { plusDays, today as todayDate, toEpochDays, type LocalDate } from '../../domain/time';
import { formatNumber, t } from '../../i18n';
import { usePageTitle, type ScreenProps } from '../../router';
import { BristolIcon, Button, Card, showToast } from '../components';
import { MealEditorSheet, MEAL_LABEL_KEYS } from '../meal/MealEditorSheet';
import { MealTypeSheet } from '../meal/MealTypeSheet';
import { StoolSheet } from '../stool/StoolSheet';
import { stoolSummary, stoolTitle } from '../stool/stoolText';
import { averageBristol } from './history/calendar';
import { timeOfDay, weekdayDayMonth } from './history/labels';

/** Vue d'un jour : repas et selles, avec ajout, modification et suppression (`DayScreen.kt`). */
export default function Day({ params }: ScreenProps) {
  const date = params.date!;
  // Le composant est remonté à chaque changement de jour : les feuilles ouvertes ne survivent pas.
  return <DayView key={date} date={date} />;
}

type MealEditor = { type: MealType; mealId?: number };

function DayView({ date }: { date: LocalDate }) {
  const title = weekdayDayMonth(date);
  usePageTitle(title);

  const meals = useLiveQuery(['meals', 'products'], () => getMealsBetween(date, date), [date]);
  const stools = useLiveQuery(['stools'], () => getStoolsBetween(date, date), [date]);

  const [pickingType, setPickingType] = useState(false);
  const [mealEditor, setMealEditor] = useState<MealEditor | null>(null);
  const [stoolSheet, setStoolSheet] = useState<{ stoolId?: number } | null>(null);

  const average = stools ? averageBristol(stools) : null;
  const isToday = date === todayDate();

  async function removeMeal(m: Meal): Promise<void> {
    await deleteMeal(m.id);
    showToast(t('web_entry_deleted'));
  }
  async function removeStool(s: Stool): Promise<void> {
    await deleteStool(s.id);
    showToast(t('web_entry_deleted'));
  }

  return (
    <div class="day">
      <header class="day-head">
        <a class="icon-btn day-back" href="/history" aria-label={t('history_title')}>
          <Arrow dir="back" />
        </a>
        <div class="day-title">
          <p class="text-muted text-sm">{t('day_journal')}</p>
          <h1>{title}</h1>
        </div>
        <a class="icon-btn" href={`/day/${plusDays(date, -1)}`} aria-label={t('previous')}><Arrow dir="prev" /></a>
        <a class="icon-btn" href={`/day/${plusDays(date, 1)}`} aria-label={t('next')}><Arrow dir="next" /></a>
      </header>

      {!isToday && (
        <div class="day-today">
          <Button variant="text" href={`/day/${todayDate()}`}>{t('today')}</Button>
        </div>
      )}

      <div class="day-layout">
        <Card variant="outlined" class="day-summary">
          <dl class="day-stats">
            <Stat value={String(stools?.filter(isRealStool).length ?? 0)} label={t('stools_section')} />
            <Stat value={String(meals?.length ?? 0)} label={t('meals_section')} />
            <Stat
              value={average === null ? '—' : formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              label={t('home_stat_bristol')}
            />
          </dl>
        </Card>

        <section class="stack-sm" aria-labelledby="meals-title">
          <div class="day-section-head">
            <h2 id="meals-title">{t('meals_section')}</h2>
            <Button variant="text" onClick={() => setPickingType(true)}>{t('add')}</Button>
          </div>
          {meals && meals.length === 0 && <p class="day-empty text-muted">{t('empty_day')}</p>}
          {meals && meals.length > 0 && (
            <ul class="day-list" role="list">
              {meals.map((m) => {
                const label = t(MEAL_LABEL_KEYS[m.type]);
                return (
                  <li key={m.id} class="day-item">
                    <button type="button" class="day-item-main" onClick={() => setMealEditor({ type: m.type, mealId: m.id })}>
                      <span class="day-item-icon day-item-meal" aria-hidden="true"><Fork /></span>
                      <span class="day-item-text">
                        <span class="day-item-title">{label}</span>
                        <span class="text-muted text-sm day-clamp">{m.description.trim() === '' ? '—' : m.description}</span>
                      </span>
                    </button>
                    <button type="button" class="icon-btn day-delete" aria-label={`${t('delete')} : ${label}`} onClick={() => void removeMeal(m)}>
                      <Bin />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section class="stack-sm" aria-labelledby="stools-title">
          <div class="day-section-head">
            <h2 id="stools-title">{t('stools_section')}</h2>
            <Button variant="text" onClick={() => setStoolSheet({})}>{t('add')}</Button>
          </div>
          {stools && stools.length === 0 && <p class="day-empty text-muted">{t('empty_day')}</p>}
          {stools && stools.length > 0 && (
            <ul class="day-list" role="list">
              {stools.map((s) => (
                <li key={s.id} class="day-item">
                  <button type="button" class="day-item-main" onClick={() => setStoolSheet({ stoolId: s.id })}>
                    <BristolIcon type={s.bristolType} size="sm" />
                    <span class="day-item-text">
                      <span class="day-item-title">{stoolTitle(s)}</span>
                      <span class="text-muted text-sm day-clamp">{`${timeOfDay(s.createdAt)} · ${stoolSummary(s)}`}</span>
                    </span>
                  </button>
                  <button type="button" class="icon-btn day-delete" aria-label={`${t('delete')} : ${stoolTitle(s)}, ${timeOfDay(s.createdAt)}`} onClick={() => void removeStool(s)}>
                    <Bin />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <MealTypeSheet
        open={pickingType}
        onClose={() => setPickingType(false)}
        onPick={(type) => {
          setPickingType(false);
          setMealEditor({ type });
        }}
      />
      <MealEditorSheet
        open={mealEditor !== null}
        date={date}
        mealType={mealEditor?.type ?? 'BREAKFAST'}
        mealId={mealEditor?.mealId}
        onClose={() => setMealEditor(null)}
      />
      <StoolSheet
        open={stoolSheet !== null}
        dateEpochDay={toEpochDays(date)}
        stoolId={stoolSheet?.stoolId}
        onClose={() => setStoolSheet(null)}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div class="day-stat">
      <dd class="day-stat-value">{value}</dd>
      <dt class="text-muted text-sm">{label}</dt>
    </div>
  );
}

function Arrow({ dir }: { dir: 'back' | 'prev' | 'next' }) {
  return (
    <svg class="chevron" data-dir={dir === 'next' ? 'next' : 'prev'} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path d={dir === 'back' ? 'M19 12H5M11 6l-6 6 6 6' : 'M15 5l-7 7 7 7'} fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function Fork() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M7 3v8M4.5 3v5a2.5 2.5 0 005 0V3M7 11v10M17 21V3c-2.5 1.5-3.5 4-3.5 7.5H17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function Bin() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

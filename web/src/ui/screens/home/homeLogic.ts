/*
 * Logique pure de l'accueil : comptes du jour et de la semaine, fil du jour, bilan du soir
 * (ports de `HomeScreen.kt`, `CheckInScale.kt` et de `NotificationReceiver.recordStool`).
 */
import type { DailyCheckIn, NotificationSettings } from '../../../db/prefs';
import { isRealStool, stool as newStool, type Meal, type MealType, type Stool } from '../../../domain/models';
import { localDateTimeAt, minusDays, timeOf, type LocalDate } from '../../../domain/time';

/** Moyenne de Bristol des vraies selles (hors jour sans selle et fausses envies), ou null. */
export function averageBristol(stools: readonly Stool[]): number | null {
  const real = stools.filter(isRealStool);
  return real.length === 0 ? null : real.reduce((sum, s) => sum + s.bristolType, 0) / real.length;
}

export function realStoolCount(stools: readonly Stool[]): number {
  return stools.filter(isRealStool).length;
}

/** Journée calme : au moins une entrée, aucune avec sang, mucus ni douleur. */
export function isCalmDay(stools: readonly Stool[]): boolean {
  return stools.length > 0 && stools.every((s) => s.bloodLevel === 0 && s.mucusLevel === 0 && s.painLevel === 0);
}

/** Les 7 jours qui finissent aujourd'hui (`today - 6 .. today`). */
export function weekStart(today: LocalDate): LocalDate {
  return minusDays(today, 6);
}

/** Heure approximative d'un repas dans le fil (minutes depuis minuit). */
const MEAL_SORT_MINUTES: Record<MealType, number> = { BREAKFAST: 8 * 60, LUNCH: 13 * 60, DINNER: 19 * 60 + 30 };

export type FeedEntry =
  | { kind: 'meal'; key: string; sortKey: number; meal: Meal }
  | { kind: 'stool'; key: string; sortKey: number; stool: Stool };

/** Fil du jour : repas (heure fixe par type) et selles (heure de création), tri stable. */
export function feedEntries(meals: readonly Meal[], stools: readonly Stool[]): FeedEntry[] {
  const entries: FeedEntry[] = [
    ...meals.map((meal): FeedEntry => ({ kind: 'meal', key: `m${meal.id}`, sortKey: MEAL_SORT_MINUTES[meal.type], meal })),
    ...stools.map((stool): FeedEntry => {
      const time = timeOf(localDateTimeAt(stool.createdAt));
      return { kind: 'stool', key: `s${stool.id}`, sortKey: Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)), stool };
    }),
  ];
  return entries.sort((a, b) => a.sortKey - b.sortKey);
}

// --- Bilan du soir (`DailyCheckIn`, `CheckInScale`) ---

export type CheckInScale = 'PAIN' | 'FATIGUE';
export const CHECK_IN_SCALES: readonly CheckInScale[] = ['PAIN', 'FATIGUE'];

export function scaleAnswer(checkIn: DailyCheckIn, scale: CheckInScale): number | null {
  return scale === 'PAIN' ? checkIn.painLevel : checkIn.fatigueLevel;
}

export function answerScale(checkIn: DailyCheckIn, scale: CheckInScale, level: number): DailyCheckIn {
  return scale === 'PAIN' ? { ...checkIn, painLevel: level } : { ...checkIn, fatigueLevel: level };
}

export function applyScale(stool: Stool, scale: CheckInScale, level: number): Stool {
  return scale === 'PAIN' ? { ...stool, painLevel: level } : { ...stool, fatigueLevel: level };
}

/**
 * Selle du bilan : une seule par rappel, corrigée si l'utilisateur change d'avis ; une nouvelle
 * selle reprend la douleur et la fatigue déjà données.
 */
export function stoolForCheckIn(existing: Stool | null, bristolType: number, checkIn: DailyCheckIn, date: LocalDate): Stool {
  if (existing) return { ...existing, bristolType };
  return newStool({
    date,
    bristolType,
    painLevel: checkIn.painLevel ?? 0,
    fatigueLevel: checkIn.fatigueLevel ?? 0,
  });
}

/** La carte est affichée à partir de l'heure du rappel, tant qu'une réponse manque. */
export function isCheckInDue(settings: NotificationSettings, minutesOfDay: number, checkIn: DailyCheckIn): boolean {
  const complete = checkIn.bristolType !== null && checkIn.painLevel !== null && checkIn.fatigueLevel !== null;
  return settings.enabled && minutesOfDay >= settings.hour * 60 + settings.minute && !complete;
}

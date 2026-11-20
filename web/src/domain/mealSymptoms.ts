import { isRealStool, type Meal, type Stool } from './models';
import { plusDays, type LocalDate } from './time';

/**
 * A food that came before many bad days (`MealSymptoms.kt`). `occurrences`: days it was eaten, with
 * stools logged that day or the next; `badRate`: share of those followed by symptoms; `baseline`:
 * the same share for all days with meals. An observation on logged data, not a cause.
 */
export interface FoodLink {
  item: string;
  occurrences: number;
  badRate: number;
  baseline: number;
}

/** Minimum days a food must have been eaten before it can appear. */
export const MIN_FOOD_OCCURRENCES = 4;

/** Minimum gap above the baseline (share of days) to be reported. */
const MIN_EXCESS = 0.2;

/** Bad day: liquid stool (Bristol 6–7), blood, or pain of 3 and above. */
export function isBadStool(stool: Stool): boolean {
  return isRealStool(stool) && (stool.bristolType >= 6 || stool.bloodLevel >= 1 || stool.painLevel >= 3);
}

/** Foods of a meal: product name and description items split on commas, semicolons, "+" and line breaks. */
export function mealItems(meal: Meal): Set<string> {
  const items: string[] = [];
  if (meal.product?.name) items.push(meal.product.name);
  items.push(...meal.description.split(/[,;+\n]/));
  return new Set(
    items.map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).filter((s) => s.length >= 3),
  );
}

function groupByDate<T extends { date: LocalDate }>(list: readonly T[]): Map<LocalDate, T[]> {
  const groups = new Map<LocalDate, T[]>();
  for (const item of list) {
    const group = groups.get(item.date);
    if (group) group.push(item);
    else groups.set(item.date, [item]);
  }
  return groups;
}

/**
 * Foods eaten on days that were followed (same day or next day) by a bad day clearly more often
 * than usual, most striking first, at most `limit`.
 */
export function foodSymptomLinks(meals: readonly Meal[], stools: readonly Stool[], limit = 5): FoodLink[] {
  const stoolsByDay = groupByDate(stools);
  /** Outcome of the meal day `day`: null if no stool was logged that day or the next. */
  const outcome = (day: LocalDate): boolean | null => {
    const window = [stoolsByDay.get(day), stoolsByDay.get(plusDays(day, 1))].filter((s) => s !== undefined);
    if (window.length === 0) return null;
    return window.some((dayStools) => dayStools.some(isBadStool));
  };

  const mealsByDay = groupByDate(meals);
  const outcomes = new Map<LocalDate, boolean>();
  for (const day of mealsByDay.keys()) {
    const result = outcome(day);
    if (result !== null) outcomes.set(day, result);
  }
  if (outcomes.size === 0) return [];
  const baseline = [...outcomes.values()].filter(Boolean).length / outcomes.size;

  const daysByItem = new Map<string, Set<LocalDate>>();
  for (const [day, dayMeals] of mealsByDay) {
    if (!outcomes.has(day)) continue;
    for (const item of dayMeals.flatMap((m) => [...mealItems(m)])) {
      const days = daysByItem.get(item);
      if (days) days.add(day);
      else daysByItem.set(item, new Set([day]));
    }
  }
  return [...daysByItem]
    .filter(([, days]) => days.size >= MIN_FOOD_OCCURRENCES)
    .map(([item, days]): FoodLink => ({
      item,
      occurrences: days.size,
      badRate: [...days].filter((d) => outcomes.get(d)).length / days.size,
      baseline,
    }))
    .filter((link) => link.badRate - link.baseline >= MIN_EXCESS)
    .sort((a, b) => b.badRate - b.baseline - (a.badRate - a.baseline) || b.occurrences - a.occurrences)
    .slice(0, limit);
}

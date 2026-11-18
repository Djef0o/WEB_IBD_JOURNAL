import {
  mealFromEntity, mealToEntity, type MealEntity, type ProductEntity,
} from '../domain/entities';
import type { Meal } from '../domain/models';
import type { LocalDate } from '../domain/time';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';
import { dayRange, monthBounds } from './range';

/*
 * Meals (`MealDao`, `DiaryRepository`). Live queries over meals with their product must
 * declare `['meals', 'products']`.
 */

/** `CASE mealType WHEN 'BREAKFAST' THEN 0 WHEN 'LUNCH' THEN 1 ELSE 2 END` */
function mealRank(entity: MealEntity): number {
  return entity.mealType === 'BREAKFAST' ? 0 : entity.mealType === 'LUNCH' ? 1 : 2;
}

/** `ORDER BY dateEpochDay, <meal time>` (ties: insertion order). */
function compareMeals(a: MealEntity, b: MealEntity): number {
  return a.dateEpochDay - b.dateEpochDay || mealRank(a) - mealRank(b) || a.id - b.id;
}

/**
 * Meals between two days (both included) with the product sheet from the Open Food Facts
 * cache, ordered by day then breakfast, lunch, dinner (`observeBetween`).
 */
export async function getMealsBetween(from: LocalDate, to: LocalDate): Promise<Meal[]> {
  const range = dayRange(from, to);
  if (range === null) return [];
  return transaction(['meals', 'products'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('meals').index('dateEpochDay').getAll(range);
    entities.sort(compareMeals);
    const barcodes = new Set<string>();
    for (const entity of entities) {
      if (entity.productBarcode !== null) barcodes.add(entity.productBarcode);
    }
    const products = new Map<string, ProductEntity>();
    await Promise.all(
      [...barcodes].map(async (barcode) => {
        const product = await tx.objectStore('products').get(barcode);
        if (product) products.set(barcode, product);
      }),
    );
    return entities.map((entity) =>
      mealFromEntity(entity, entity.productBarcode === null ? null : (products.get(entity.productBarcode) ?? null)),
    );
  });
}

/** A meal with its product sheet, or `null` if the id is unknown. */
export function getMeal(id: number): Promise<Meal | null> {
  return transaction(['meals', 'products'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('meals').get(id);
    if (!entity) return null;
    const product = entity.productBarcode === null ? undefined : await tx.objectStore('products').get(entity.productBarcode);
    return mealFromEntity(entity, product ?? null);
  });
}

/** Meals of a month (`month`: 1 to 12). */
export function getMealsInMonth(year: number, month: number): Promise<Meal[]> {
  const { from, to } = monthBounds(year, month);
  return getMealsBetween(from, to);
}

/**
 * Saves (or replaces) the meal and returns its identifier (`id` 0: new meal). Editing a
 * meal keeps its creation time. A replaced photo is not deleted here: call `deletePhoto`.
 */
export function saveMeal(meal: Meal): Promise<number> {
  return transaction(['meals'], 'readwrite', async (tx) => {
    const store = tx.objectStore('meals');
    const existing = meal.id === 0 ? undefined : await store.get(meal.id);
    return store.put(stripAutoId(mealToEntity(meal, existing?.createdAt)));
  });
}

/** Deletes the meal and its photo (`deleteMeal`). */
export function deleteMeal(id: number): Promise<void> {
  return transaction(['meals', 'photos'], 'readwrite', async (tx) => {
    const meal = await tx.objectStore('meals').get(id);
    if (meal?.photoPath) await tx.objectStore('photos').delete(meal.photoPath);
    await tx.objectStore('meals').delete(id);
  });
}

// --- Backup access (caller-owned transaction over the `meals` store) ---

/** All the stored meals, in key order (`getAll`). */
export function getAllMealEntities(tx: ReadTx): Promise<MealEntity[]> {
  return tx.objectStore('meals').getAll();
}

export function deleteAllMeals(tx: Tx): Promise<void> {
  return tx.objectStore('meals').clear();
}

/** Adds the meals with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertMealEntities(tx: Tx, entities: readonly MealEntity[]): Promise<void> {
  const store = tx.objectStore('meals');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}

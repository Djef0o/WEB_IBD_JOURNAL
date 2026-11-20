import type { DoseStatus } from './health';
import { isLowStock, type Medication } from './profile';

/**
 * Change of the intakes left when a dose goes from `previous` to `next` (null: no confirmation):
 * -1 when it becomes taken, +1 when a taken dose is undone or changed to missed, 0 otherwise.
 * A scheduled dose nobody confirmed never counts as taken (`Stock.kt`).
 */
export function stockDelta(previous: DoseStatus | null, next: DoseStatus | null): number {
  return (previous === 'TAKEN' ? 1 : 0) - (next === 'TAKEN' ? 1 : 0);
}

/** True when `after` has just fallen to its low-stock threshold or below, from above it. */
export function crossedLowStock(before: Medication | null, after: Medication): boolean {
  return isLowStock(after) && before !== null && before.stockDoses !== null && !isLowStock(before);
}

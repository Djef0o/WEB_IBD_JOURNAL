import { isLowStock, type Medication } from '../../domain/profile';
import { t, tp } from '../../i18n';

/** "12 intakes left", with a reorder hint at or below the threshold; null when the stock is not counted (`stockStatus`). */
export function stockStatus(medication: Medication): string | null {
  const left = medication.stockDoses;
  if (left === null) return null;
  const text = tp('stock_left', left);
  return isLowStock(medication) ? t('stock_status_low', [text]) : text;
}

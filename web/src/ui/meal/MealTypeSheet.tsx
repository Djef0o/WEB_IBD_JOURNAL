import './meal.css';
import { MEAL_TYPES, type MealType } from '../../domain/models';
import { t } from '../../i18n';
import { Sheet } from '../components';
import { MEAL_LABEL_KEYS } from './MealEditorSheet';

export interface MealTypeSheetProps {
  open: boolean;
  onPick(type: MealType): void;
  onClose(): void;
}

/** Choix du moment du repas avant l'éditeur (`MealTypeSheet` de HomeSheets.kt). */
export function MealTypeSheet({ open, onPick, onClose }: MealTypeSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={t('add_meal')} closeLabel={t('close')}>
      <ul class="meal-type-list" role="list">
        {MEAL_TYPES.map((type) => (
          <li key={type}>
            <button type="button" class="meal-type-btn" onClick={() => onPick(type)}>
              {t(MEAL_LABEL_KEYS[type])}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

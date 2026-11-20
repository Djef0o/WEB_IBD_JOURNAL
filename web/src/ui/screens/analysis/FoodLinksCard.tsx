import './foodLinks.css';
import { getAllStools } from '../../../db/stools';
import { getMealsBetween } from '../../../db/meals';
import { useLiveQuery } from '../../../db';
import { foodSymptomLinks, MIN_FOOD_OCCURRENCES, type FoodLink } from '../../../domain/mealSymptoms';
import { fromEpochDays, today } from '../../../domain/time';
import { t } from '../../../i18n';
import { Card } from '../../components';

/**
 * Foods that came before bad days more often than usual: an observation, never advice. Always
 * computed over the whole history, whatever the chosen period (`FoodLinksCard`).
 */
export function FoodLinksCard() {
  const links = useLiveQuery(['stools', 'meals', 'products'], async () => {
    const [stools, meals] = await Promise.all([getAllStools(), getMealsBetween(fromEpochDays(0), today())]);
    return foodSymptomLinks(meals, stools);
  });
  if (!links) return null;
  return (
    <Card variant="outlined" title={t('foodlink_title')}>
      {links.length === 0 ? (
        <p class="text-muted">{t('foodlink_empty', [MIN_FOOD_OCCURRENCES])}</p>
      ) : (
        <ul class="foodlink-list" role="list">
          {links.map((link) => <FoodLinkRow key={link.item} link={link} />)}
        </ul>
      )}
      <p class="text-sm foodlink-caveat">{t('foodlink_caveat')}</p>
      <p class="text-muted text-sm">{t('foodlink_definition')}</p>
    </Card>
  );
}

const percent = (share: number): string => `${Math.min(100, Math.max(0, share * 100))}%`;

/** Food with its bad-day rate as a bar; the tick marks the usual rate over all days with meals. */
function FoodLinkRow({ link }: { link: FoodLink }) {
  const badDays = Math.round(link.badRate * link.occurrences);
  const name = link.item.charAt(0).toUpperCase() + link.item.slice(1);
  return (
    <li class="foodlink-row">
      <span class="foodlink-name">{name}</span>
      <span class="text-muted text-sm">
        {t('foodlink_row', [badDays, link.occurrences, Math.round(link.baseline * 100)])}
      </span>
      {/* The sentence above already says it in text. */}
      <div class="foodlink-bar" aria-hidden="true">
        <div class="foodlink-fill" style={{ inlineSize: percent(link.badRate) }} />
        <div class="foodlink-tick" style={{ insetInlineStart: percent(link.baseline) }} />
      </div>
    </li>
  );
}

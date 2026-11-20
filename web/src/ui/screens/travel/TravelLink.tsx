import '../../care/care.css';
import { t } from '../../../i18n';
import { Card } from '../../components';
import { ChevronIcon } from '../../care/icons';

/** Entry of the travel pack in the care screen (`travel_title` section of CareScreen.kt). */
export function TravelLink() {
  return (
    <Card title={t('travel_title')}>
      <a class="care-lab-link" href="/travel">
        <span class="care-row-text">
          <span class="care-row-title">{t('travel_row_title')}</span>
          <span class="text-muted text-sm">{t('travel_row_desc')}</span>
        </span>
        <ChevronIcon />
      </a>
    </Card>
  );
}

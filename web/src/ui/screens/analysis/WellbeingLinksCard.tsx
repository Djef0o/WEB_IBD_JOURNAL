import './wellbeingLinks.css';
import { useLiveQuery } from '../../../db';
import { getAllStools } from '../../../db/stools';
import { getAllWellbeing } from '../../../db/wellbeing';
import { wellbeingLinks, type WellbeingFactor, type WellbeingLink } from '../../../domain/wellbeing';
import { t } from '../../../i18n';
import { Card } from '../../components';

function factorLabel(factor: WellbeingFactor): string {
  // i18n-keys: wellbeing_factor_poor_sleep wellbeing_factor_high_stress wellbeing_factor_low_mood wellbeing_factor_period
  switch (factor) {
    case 'POOR_SLEEP': return t('wellbeing_factor_poor_sleep');
    case 'HIGH_STRESS': return t('wellbeing_factor_high_stress');
    case 'LOW_MOOD': return t('wellbeing_factor_low_mood');
    case 'PERIOD': return t('wellbeing_factor_period');
  }
}

const percent = (share: number): string => `${Math.min(100, Math.max(0, share * 100))}%`;

/** Rate of bad days as a bar; the tick marks the usual rate for comparison. */
function LinkRow({ link }: { link: WellbeingLink }) {
  const badDays = Math.round(link.badRate * link.days);
  return (
    <li class="wellbeing-link-row">
      <span class="wellbeing-link-name">{factorLabel(link.factor)}</span>
      <span class="text-muted text-sm">
        {t('wellbeing_link_row', [badDays, link.days, Math.round(link.baseline * 100)])}
      </span>
      {/* The sentence above already says it in text. */}
      <div class="wellbeing-link-bar" aria-hidden="true">
        <div class="wellbeing-link-fill" style={{ inlineSize: percent(link.badRate) }} />
        <div class="wellbeing-link-tick" style={{ insetInlineStart: percent(link.baseline) }} />
      </div>
    </li>
  );
}

/**
 * Sleep, stress, mood or period that came with bad days more often than usual: shown only when there
 * is one; always over the whole history, whatever the chosen period (`WellbeingLinksCard`).
 */
export function WellbeingLinksCard() {
  const links = useLiveQuery(['wellbeing', 'stools'], async () => {
    const [days, stools] = await Promise.all([getAllWellbeing(), getAllStools()]);
    return wellbeingLinks(days, stools);
  });
  if (!links || links.length === 0) return null;
  return (
    <Card variant="outlined" title={t('wellbeing_link_title')}>
      <ul class="wellbeing-link-list" role="list">
        {links.map((link) => <LinkRow key={link.factor} link={link} />)}
      </ul>
      <p class="text-sm wellbeing-link-caveat">{t('wellbeing_link_caveat')}</p>
      <p class="text-muted text-sm">{t('wellbeing_link_definition')}</p>
    </Card>
  );
}

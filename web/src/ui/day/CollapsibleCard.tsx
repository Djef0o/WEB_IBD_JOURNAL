import './dayCards.css';
import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { Card } from '../components';

interface CollapsibleCardProps {
  title: string;
  /** One line of what is already noted, shown while folded. */
  summary: string;
  children: ComponentChildren;
}

/**
 * Optional day card that starts folded so it does not push meals and stools off screen: the header
 * shows `title` and a `summary`; selecting it unfolds the content (`CollapsibleCard.kt`).
 */
export function CollapsibleCard({ title, summary, children }: CollapsibleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  return (
    <Card variant="outlined" class="collapsible">
      <h2 class="collapsible-head">
        <button
          type="button"
          class="collapsible-toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(!expanded)}
        >
          <span class="collapsible-text">
            <span class="collapsible-title">{title}</span>
            <span class="collapsible-summary">{summary}</span>
          </span>
          <svg class="collapsible-chevron" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label={t(expanded ? 'day_card_collapse' : 'day_card_expand')}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>
      <div id={bodyId} class="collapsible-body" hidden={!expanded}>{children}</div>
    </Card>
  );
}

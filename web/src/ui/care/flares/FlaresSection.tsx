import './flares.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { getAllFlares } from '../../../db/flares';
import type { Flare } from '../../../domain/care';
import { flareLengthDays, sortFlaresForList } from '../../../domain/flares';
import { t, tp } from '../../../i18n';
import { Button, Card } from '../../components';
import { formatLocalDate } from '../../format';
import { FlareEditor } from './FlareEditor';

/** Flame icon of the rows (decorative: the title says it all). */
function FlameIcon() {
  return (
    <svg class="flare-row-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3s5 4.5 5 9.5a5 5 0 0 1-10 0C7 10 8.5 8.5 9.5 7.5 10 9 11 9.5 11 9.5 11 7 12 3 12 3z" />
    </svg>
  );
}

/** "12 March 2026 – 20 March 2026 (9 days)" or "Since 12 March 2026 (ongoing)" (`FlareRow`). */
function flareTitle(flare: Flare): string {
  if (flare.end === null) return t('flare_ongoing_since', [formatLocalDate(flare.start)]);
  const days = flareLengthDays(flare.start, flare.end);
  return tp('flare_range_days', days, [formatLocalDate(flare.start), formatLocalDate(flare.end), days]);
}

/** Care section: flare periods, with the editor sheet (`FlaresSection`). Ongoing flares first, then the most recent. */
export function FlaresSection() {
  const flares = useLiveQuery(['flares'], getAllFlares);
  const [editing, setEditing] = useState<{ item: Flare | null } | null>(null);
  const sorted = flares ? sortFlaresForList(flares) : [];

  return (
    <Card title={t('flare_title')}>
      {flares && flares.length === 0 && <p class="text-muted">{t('flare_empty')}</p>}
      {sorted.length > 0 && (
        <ul class="care-list">
          {sorted.map((flare) => (
            <li key={flare.id}>
              <button
                type="button"
                class="care-row flare-row"
                data-ongoing={flare.end === null ? '' : undefined}
                onClick={() => setEditing({ item: flare })}
              >
                <span class="flare-row-lead">
                  <FlameIcon />
                  <span class="care-row-text">
                    <span class="care-row-title">{flareTitle(flare)}</span>
                    {flare.treatment.trim() !== '' && <span class="care-row-detail text-muted text-sm">{flare.treatment}</span>}
                    {flare.note.trim() !== '' && <span class="care-row-detail text-muted text-sm">{flare.note}</span>}
                    {flare.hospitalized && <span class="flare-badge">{t('flare_hospitalized')}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('flare_add')}</Button>
      </div>
      {editing && <FlareEditor initial={editing.item} onClose={() => setEditing(null)} />}
    </Card>
  );
}

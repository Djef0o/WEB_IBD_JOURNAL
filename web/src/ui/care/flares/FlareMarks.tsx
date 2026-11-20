import './flares.css';
import { useLiveQuery } from '../../../db';
import { getAllFlares } from '../../../db/flares';
import { flareActiveOn, flareDayNumberOn, flareOngoingOn } from '../../../domain/flares';
import { today as todayDate, type LocalDate } from '../../../domain/time';
import { t } from '../../../i18n';
import { formatLocalDate } from '../../format';

/** Every flare, chronological, kept up to date (`null` until the first read). */
export function useFlares() {
  return useLiveQuery(['flares'], getAllFlares);
}

/** Today: reminder that a flare is in progress, informational only (`FlareCard`). Nothing without an ongoing flare. */
export function FlareHomeCard({ today }: { today: LocalDate }) {
  const flares = useFlares();
  const flare = flares ? flareOngoingOn(flares, today) : null;
  if (!flare) return null;
  return (
    <p class="flare-home">
      {t('flaremark_home', [formatLocalDate(flare.start), flareDayNumberOn(flare, today) ?? 1])}
    </p>
  );
}

/** Day screen: "Flare · day 3 · Hospitalized" when the day falls within a flare (`FlareChip`). */
export function FlareDayChip({ date }: { date: LocalDate }) {
  const flares = useFlares();
  const flare = flares ? flareActiveOn(flares, date, todayDate()) : null;
  if (!flare) return null;
  const day = flareDayNumberOn(flare, date);
  const text = [
    day === null ? t('flaremark_chart_legend') : t('flaremark_day', [day]),
    ...(flare.hospitalized ? [t('flaremark_hospitalized')] : []),
  ].join(' · ');
  return (
    <div class="flare-chip">
      <span>{text}</span>
    </div>
  );
}

/** Calendar legend: the red bar of the flare days (`FlareLegend`). */
export function FlareLegend() {
  return (
    <p class="flare-legend text-muted text-sm" aria-hidden="true">
      <span class="flare-legend-bar" />
      <span>{t('flaremark_legend')}</span>
    </p>
  );
}

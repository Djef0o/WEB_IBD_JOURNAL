import { useId } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { profileSignal } from '../../db/profile';
import { getWellbeing, saveWellbeing } from '../../db/wellbeing';
import { WELLBEING_MAX, WELLBEING_MIN, wellbeingDay, type WellbeingDay } from '../../domain/care';
import type { LocalDate } from '../../domain/time';
import { t } from '../../i18n';
import { CollapsibleCard } from './CollapsibleCard';

const LEVELS = Array.from({ length: WELLBEING_MAX - WELLBEING_MIN + 1 }, (_, i) => WELLBEING_MIN + i);

/** One 1 to 5 scale: label, the five values, then what the ends mean. Selecting the chosen value again clears it. */
function ScaleRow({ label, scale, value, onChange }: {
  label: string;
  scale: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  return (
    <>
      <p class="scale-label" id={id}>{label}</p>
      <div class="chip-row" role="group" aria-labelledby={id}>
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            class="chip"
            aria-pressed={value === level}
            onClick={() => onChange(value === level ? null : level)}
          >
            {level}
          </button>
        ))}
      </div>
      <p class="text-muted text-sm">{scale}</p>
    </>
  );
}

/**
 * Sleep, stress and mood of `date` on 1 to 5 scales, and the menstrual period when the profile
 * allows it. Saved as soon as it changes (`DayWellbeingCard`).
 */
export function WellbeingCard({ date }: { date: LocalDate }) {
  const stored = useLiveQuery(['wellbeing'], () => getWellbeing(date), [date]);
  const day = stored ?? wellbeingDay({ date });
  const periodAvailable = profileSignal.value?.sex === 'FEMALE';

  const save = (changes: Partial<WellbeingDay>): void => {
    void saveWellbeing({ ...day, ...changes });
  };

  const parts = [
    day.sleep !== null ? `${t('wellbeing_sleep')} ${day.sleep}` : null,
    day.stress !== null ? `${t('wellbeing_stress')} ${day.stress}` : null,
    day.mood !== null ? `${t('wellbeing_mood')} ${day.mood}` : null,
    day.period ? t('wellbeing_period') : null,
  ].filter((s): s is string => s !== null);

  return (
    <CollapsibleCard title={t('wellbeing_card_title')} summary={parts.length === 0 ? t('day_card_none') : parts.join(' · ')}>
      <p class="text-muted text-sm">{t('wellbeing_card_hint')}</p>
      <ScaleRow label={t('wellbeing_sleep')} scale={t('wellbeing_sleep_scale')} value={day.sleep} onChange={(sleep) => save({ sleep })} />
      <ScaleRow label={t('wellbeing_stress')} scale={t('wellbeing_stress_scale')} value={day.stress} onChange={(stress) => save({ stress })} />
      <ScaleRow label={t('wellbeing_mood')} scale={t('wellbeing_mood_scale')} value={day.mood} onChange={(mood) => save({ mood })} />
      {(periodAvailable || day.period) && (
        <div class="chip-row">
          <button type="button" class="chip" aria-pressed={day.period} onClick={() => save({ period: !day.period })}>
            {t('wellbeing_period')}
          </button>
        </div>
      )}
    </CollapsibleCard>
  );
}

import { t } from '../../i18n';

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Accessible name of the group (what is being counted). */
  label: string;
}

/** − / + around a value, for small bounded counts (every N, diet days). Targets of 44 px. */
export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <div class="stepper" role="group" aria-label={label}>
      <button type="button" class="icon-btn" aria-label={t('decrease')} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <output class="stepper-value">{value}</output>
      <button type="button" class="icon-btn" aria-label={t('increase')} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M5 12h14M12 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

import './components.css';
import { useId } from 'preact/hooks';

interface Scale0to5Props {
  value: number | null;
  onChange: (value: number) => void;
  /** Nom accessible du groupe (ex. « Douleur »). */
  label: string;
  /** Libellés des extrémités, affichés sous l'échelle (optionnel). */
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
}

const VALUES = [0, 1, 2, 3, 4, 5] as const;

/** Échelle 0–5 : groupe de boutons radio natifs (flèches, Tab sur la valeur choisie). */
export function Scale0to5({ value, onChange, label, minLabel, maxLabel, disabled }: Scale0to5Props) {
  const name = useId();
  return (
    <fieldset class="scale" disabled={disabled}>
      <legend class="field-label">{label}</legend>
      <div class="scale-track">
        {VALUES.map((n) => (
          <label key={n} class="scale-option">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} />
            <span>{n}</span>
          </label>
        ))}
      </div>
      {(minLabel || maxLabel) && (
        <div class="scale-ends text-muted text-sm" aria-hidden="true">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </fieldset>
  );
}

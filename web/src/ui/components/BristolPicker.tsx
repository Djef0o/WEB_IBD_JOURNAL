import './components.css';
import { useId } from 'preact/hooks';
import { BRISTOL_TYPES } from './bristol';
import { BristolIcon } from './Bristol';

interface BristolPickerProps {
  value: number | null;
  onChange: (type: number) => void;
  /** Nom accessible du groupe. */
  label: string;
  /** Libellé accessible de chaque type (ex. « Type 3 : saucisse craquelée »). */
  typeLabel: (type: number) => string;
  disabled?: boolean;
}

/** Sélecteur Bristol 0–7 : boutons radio natifs avec icône SVG et couleur de BristolColors.kt. */
export function BristolPicker({ value, onChange, label, typeLabel, disabled }: BristolPickerProps) {
  const name = useId();
  return (
    <fieldset class="bristol-picker" disabled={disabled}>
      <legend class="field-label">{label}</legend>
      <div class="bristol-grid">
        {BRISTOL_TYPES.map((t) => (
          <label key={t} class="bristol-option" data-bristol={t}>
            <input
              type="radio"
              name={name}
              value={t}
              checked={value === t}
              aria-label={typeLabel(t)}
              onChange={() => onChange(t)}
            />
            <span class="bristol-option-face" aria-hidden="true">
              <BristolIcon type={t} />
              <span class="bristol-option-num">{t}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

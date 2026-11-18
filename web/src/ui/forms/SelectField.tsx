import './forms.css';
import { useId } from 'preact/hooks';

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
  /** Libellé réservé aux technologies d'assistance (le contexte visuel suffit, ex. titre de carte). */
  hideLabel?: boolean;
  disabled?: boolean;
  name?: string;
}

/** Liste déroulante native (accessible et adaptée au tactile). */
export function SelectField<T extends string>({ label, value, options, onChange, hint, hideLabel, disabled, name }: SelectFieldProps<T>) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div class="field">
      <label class={hideLabel ? 'visually-hidden' : 'field-name'} for={id}>{label}</label>
      {hint && <span class="field-hint" id={hintId}>{hint}</span>}
      <select
        id={id}
        name={name}
        class="input"
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.currentTarget.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} selected={o.value === value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

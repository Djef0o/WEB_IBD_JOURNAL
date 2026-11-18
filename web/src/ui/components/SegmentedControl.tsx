import './components.css';
import { useId } from 'preact/hooks';

interface Option<T extends string> {
  value: T;
  label: string;
}
interface SegmentedControlProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nom accessible du groupe. */
  label: string;
  hideLabel?: boolean;
}

/** Groupe de boutons radio natifs (flèches du clavier), présenté en segments. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, hideLabel = true }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset class="segmented">
      <legend class={hideLabel ? 'visually-hidden' : 'field-label'}>{label}</legend>
      <div class="segmented-track">
        {options.map((o) => (
          <label key={o.value} class="segmented-option">
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import './components.css';
import { useId } from 'preact/hooks';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Interrupteur : case à cocher native avec role="switch" (clavier : Espace). */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const descId = useId();
  return (
    <label class="switch">
      <span class="switch-text">
        <span>{label}</span>
        {description && <span class="text-muted text-sm" id={descId}>{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={description ? descId : undefined}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="switch-track" aria-hidden="true" />
    </label>
  );
}

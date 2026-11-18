import './forms.css';
import type { ComponentChildren, Ref } from 'preact';
import { useId, useState } from 'preact/hooks';
import { t } from '../../i18n';

export interface TextFieldProps {
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: 'text' | 'password' | 'time' | 'date' | 'datetime-local' | 'number' | 'email' | 'search';
  /** Indication affichée au-dessus du champ. */
  hint?: string;
  /** Message d'erreur courant (vide : champ valide). Affiché après la première sortie du champ. */
  error?: string | null;
  /** Force l'affichage de l'erreur (tentative de validation du formulaire). */
  showError?: boolean;
  name?: string;
  autocomplete?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'search';
  autocapitalize?: 'off' | 'none' | 'words' | 'sentences';
  list?: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Contrôle ancré à droite du champ (ex. afficher/masquer le mot de passe). */
  trailing?: ComponentChildren;
}

/**
 * Champ texte avec libellé visible, indication au-dessus et erreur « après interaction » :
 * le message n'apparaît qu'une fois le champ quitté (ou sur `showError`), et n'est lié par
 * `aria-describedby` que pendant qu'il est affiché.
 */
export function TextField(props: TextFieldProps) {
  const { label, value, onInput, type = 'text', hint, error, showError, trailing, inputRef, ...rest } = props;
  const id = useId();
  const [touched, setTouched] = useState(false);
  const invalid = Boolean(error) && (touched || showError === true);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint ? hintId : '', invalid ? errorId : ''].filter(Boolean).join(' ');
  return (
    <div class="field" data-invalid={invalid ? '' : undefined}>
      <label class="field-name" for={id}>{label}</label>
      {hint && <span class="field-hint" id={hintId}>{hint}</span>}
      <div class="field-control">
        <input
          {...rest}
          ref={inputRef}
          id={id}
          class="input"
          // Le typage de Preact discrimine `type` et `list` : `text` accepte les deux, le type réel reste `type`.
          type={type as 'text'}
          value={value}
          aria-invalid={invalid ? 'true' : 'false'}
          aria-describedby={described || undefined}
          onInput={(e) => onInput(e.currentTarget.value)}
          onBlur={() => setTouched(true)}
        />
        {trailing && <div class="field-trailing">{trailing}</div>}
      </div>
      {invalid && (
        <p class="error-msg" id={errorId}>
          <svg role="img" aria-label={t('web_error')} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="9.5" />
            <path d="M12 7v6M12 16.5v.5" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { TextField, type TextFieldProps } from './TextField';

type Props = Omit<TextFieldProps, 'type' | 'trailing'> & {
  /** `new-password` à la création, `current-password` à la saisie d'un mot de passe existant. */
  autocomplete: 'new-password' | 'current-password';
};

/** Champ mot de passe avec bouton afficher/masquer. */
export function PasswordField(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autocapitalize="off"
      trailing={
        <button
          type="button"
          class="icon-btn"
          aria-label={t(visible ? 'backup_password_hide' : 'backup_password_show')}
          onClick={() => setVisible((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
    />
  );
}

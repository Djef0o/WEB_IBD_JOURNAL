import { useState } from 'preact/hooks';
import { exportBackup, backupFileName } from '../../backup';
import { markBackupDone } from '../../db/prefs';
import { t } from '../../i18n';
import { Button, Dialog, showToast } from '../components';
import { downloadBlob } from '../download';
import { PasswordField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import '../screens/settings/settings.css';

/** Même longueur minimale que l'app Android (`MIN_PASSWORD_LENGTH`). */
export const MIN_PASSWORD_LENGTH = 8;

function ExportForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmation !== password;

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    setAttempted(true);
    if (busy) return;
    if (tooShort || mismatch) {
      focusFirstInvalid(e.currentTarget as HTMLFormElement);
      return;
    }
    setBusy(true);
    try {
      downloadBlob(await exportBackup(password), backupFileName());
      await markBackupDone();
      showToast(t('backup_export_done'));
      onDone();
    } catch (error) {
      console.error(error);
      showToast(t('backup_export_failed'));
      setBusy(false);
    }
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)} noValidate>
      <p>{t('backup_export_message')}</p>
      <PasswordField
        label={t('backup_password')}
        autocomplete="new-password"
        value={password}
        onInput={setPassword}
        hint={t('backup_password_min_length', [MIN_PASSWORD_LENGTH])}
        error={tooShort ? t('backup_password_min_length', [MIN_PASSWORD_LENGTH]) : null}
        showError={attempted}
        disabled={busy}
        required
      />
      <PasswordField
        label={t('backup_password_confirm')}
        autocomplete="new-password"
        value={confirmation}
        onInput={setConfirmation}
        error={mismatch ? t('backup_password_mismatch') : null}
        showError={attempted}
        disabled={busy}
        required
      />
      <p class="text-error">{t('backup_password_warning')}</p>
      {busy && <p class="backup-status" role="status">{t('backup_exporting')}</p>}
      <div class="dialog-actions">
        <Button variant="text" type="button" onClick={onDone} disabled={busy}>{t('cancel')}</Button>
        <Button type="submit" aria-disabled={busy || undefined}>{t('export_data')}</Button>
      </div>
    </form>
  );
}

/** Choix du mot de passe, chiffrement puis téléchargement du fichier `.ibdj`. */
export function ExportBackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={t('backup_export_title')} closeLabel={t('close')} lightDismiss={false}>
      <ExportForm onDone={onClose} />
    </Dialog>
  );
}

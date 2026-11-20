import './settings.css';
import { useState } from 'preact/hooks';
import { snapshot } from '../../../backup';
import { today } from '../../../domain/time';
import { csvArchiveName, exportCsvArchive } from '../../../export/csvArchive';
import { t } from '../../../i18n';
import { MIN_PASSWORD_LENGTH } from '../../backup/ExportBackupDialog';
import { Button, Dialog, showToast } from '../../components';
import { downloadBlob } from '../../download';
import { PasswordField, TextField } from '../../forms';
import { focusFirstInvalid } from '../../forms/focus';

/** Characters a file name cannot hold on common systems. */
const FORBIDDEN_IN_NAME = /[\\/:*?"<>|\u0000-\u001f]/g;

/** `.zip` file name from what the user typed; empty gives the default. */
export function csvFileName(typed: string, fallback: string): string {
  const base = typed.trim().replace(FORBIDDEN_IN_NAME, '_').replace(/^\.+/, '');
  if (base === '' || base.toLowerCase() === '.zip') return fallback;
  return /\.zip$/i.test(base) ? base : `${base}.zip`;
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fileName, setFileName] = useState(() => csvArchiveName(today()));
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
      const archive = await exportCsvArchive(await snapshot(), password);
      downloadBlob(archive, csvFileName(fileName, csvArchiveName(today())));
      showToast(t('csv_export_done'));
      onDone();
    } catch (error) {
      console.error(error);
      showToast(t('csv_export_failed'));
      setBusy(false);
    }
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)} noValidate>
      <p>{t('csv_password_message')}</p>
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
      <TextField label={t('web_csv_file_name')} value={fileName} onInput={setFileName} autocomplete="off" disabled={busy} />
      <p class="text-error">{t('csv_password_warning')}</p>
      {busy && <p class="backup-status" role="status">{t('backup_exporting')}</p>}
      <div class="dialog-actions">
        <Button variant="text" type="button" onClick={onDone} disabled={busy}>{t('cancel')}</Button>
        <Button type="submit" aria-disabled={busy || undefined}>{t('export_data')}</Button>
      </div>
    </form>
  );
}

type Step = 'closed' | 'warning' | 'password';

/**
 * CSV export (`CsvExportManager`): a warning about the sensitivity of the data first, then the
 * archive password and file name; the CSV files go straight into a password-protected AES-256 ZIP.
 */
export function CsvExportRow() {
  const [step, setStep] = useState<Step>('closed');
  const close = () => setStep('closed');
  return (
    <>
      <div class="setting-row">
        <div>
          <p class="setting-title">{t('csv_export_title')}</p>
          <p class="text-muted text-sm">{t('csv_export_desc')}</p>
        </div>
        <Button variant="outlined" onClick={() => setStep('warning')}>{t('csv_export_title')}</Button>
      </div>
      <Dialog open={step === 'warning'} onClose={close} title={t('csv_warning_title')} closeLabel={t('close')} variant="center">
        <div class="stack">
          <p>{t('csv_warning_text')}</p>
          <div class="dialog-actions">
            <Button variant="text" type="button" onClick={close}>{t('cancel')}</Button>
            <Button type="button" onClick={() => setStep('password')}>{t('csv_warning_continue')}</Button>
          </div>
        </div>
      </Dialog>
      <Dialog open={step === 'password'} onClose={close} title={t('csv_password_title')} closeLabel={t('close')} lightDismiss={false}>
        {step === 'password' && <PasswordForm onDone={close} />}
      </Dialog>
    </>
  );
}

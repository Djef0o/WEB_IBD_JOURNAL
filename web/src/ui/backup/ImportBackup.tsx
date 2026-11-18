import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { InvalidBackupError, WrongPasswordError, importBackup, isEncryptedBackup } from '../../backup';
import { t } from '../../i18n';
import { Button, Dialog, showToast } from '../components';
import { PasswordField } from '../forms';
import '../screens/settings/settings.css';

interface PickedFile {
  name: string;
  data: Uint8Array;
}

function ImportForm({ file, onDone, onImported }: { file: PickedFile; onDone: () => void; onImported?: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [wrong, setWrong] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy || password === '' || !confirmed) return;
    setBusy(true);
    setWrong(false);
    try {
      await importBackup(file.data, password);
      showToast(t('backup_import_done'));
      onDone();
      onImported?.();
    } catch (error) {
      setBusy(false);
      if (error instanceof WrongPasswordError) {
        setWrong(true);
        // Le champ était désactivé pendant le déchiffrement : on rend le focus une fois réactivé.
        setTimeout(() => {
          passwordInput.current?.focus();
          passwordInput.current?.select();
        }, 0);
        return;
      }
      if (!(error instanceof InvalidBackupError)) console.error(error);
      showToast(t('backup_import_failed'));
      onDone();
    }
  }

  return (
    <form class="stack" onSubmit={(e) => void submit(e)}>
      <p class="text-muted text-sm">{file.name}</p>
      <p>{t('backup_import_message')}</p>
      <PasswordField
        inputRef={passwordInput}
        label={t('backup_password')}
        autocomplete="current-password"
        value={password}
        onInput={(v) => {
          setPassword(v);
          setWrong(false);
        }}
        error={wrong ? t('backup_import_wrong_password') : null}
        showError={wrong}
        disabled={busy}
        required
      />
      <label class="check">
        <input type="checkbox" checked={confirmed} disabled={busy} onChange={(e) => setConfirmed(e.currentTarget.checked)} />
        <span>{t('web_restore_confirm_check')}</span>
      </label>
      {busy && <p class="backup-status" role="status">{t('backup_importing')}</p>}
      <div class="dialog-actions">
        <Button variant="text" type="button" onClick={onDone} disabled={busy}>{t('cancel')}</Button>
        <Button type="submit" variant="danger" aria-disabled={busy || password === '' || !confirmed ? true : undefined}>
          {t('backup_import_button')}
        </Button>
      </div>
    </form>
  );
}

interface ImportBackupButtonProps {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  children?: ComponentChildren;
  /** Après une restauration réussie. */
  onImported?: () => void;
}

/**
 * Bouton « Importer » : choix du fichier, puis dialogue de mot de passe avec confirmation explicite
 * (la restauration remplace les données actuelles). Rien n'est modifié avant le déchiffrement complet.
 */
export function ImportBackupButton({ variant = 'outlined', children, onImported }: ImportBackupButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<PickedFile | null>(null);

  async function onPick(e: Event): Promise<void> {
    const field = e.currentTarget as HTMLInputElement;
    const picked = field.files?.[0];
    field.value = ''; // permet de rechoisir le même fichier
    if (!picked) return;
    try {
      const data = new Uint8Array(await picked.arrayBuffer());
      if (!isEncryptedBackup(data)) {
        showToast(t('backup_import_unrecognized'));
        return;
      }
      setFile({ name: picked.name, data });
    } catch {
      showToast(t('backup_import_failed'));
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => input.current?.click()}>{children ?? t('import_data')}</Button>
      {/* Tout type de fichier : les `.ibdj` n'ont pas de type MIME reconnu (comme sur Android). */}
      <input ref={input} type="file" hidden tabIndex={-1} onChange={(e) => void onPick(e)} />
      <Dialog
        open={file !== null}
        onClose={() => setFile(null)}
        title={t('backup_import_title')}
        closeLabel={t('close')}
        lightDismiss={false}
      >
        {file && <ImportForm file={file} onDone={() => setFile(null)} onImported={onImported} />}
      </Dialog>
    </>
  );
}

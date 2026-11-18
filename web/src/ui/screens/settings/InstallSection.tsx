import './settings.css';
import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button, Card } from '../../components';
import { installState, promptInstall } from '../../install';

/** « Installer l'app » : bouton seulement si le navigateur sait installer (voir `install.ts`). */
export function InstallSection() {
  const state = installState.value;
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function install(): Promise<void> {
    if (busy) return;
    setBusy(true); // `aria-disabled` plutôt que `disabled` : le focus reste sur le bouton
    // Appel direct depuis le clic : l'activation utilisateur est requise.
    const outcome = await promptInstall();
    setBusy(false);
    setStatus(outcome === 'accepted' ? t('web_installed') : outcome === 'dismissed' ? t('web_install_canceled') : t('web_install_failed'));
  }

  return (
    <Card title={t('web_install_app')}>
      {state === 'installed' ? (
        <p>{t('web_installed')}</p>
      ) : state === 'available' ? (
        <>
          <p class="text-muted">{t('web_install_desc')}</p>
          <div>
            <Button variant="tonal" aria-disabled={busy || undefined} onClick={() => void install()}>{t('web_install_app')}</Button>
          </div>
        </>
      ) : (
        <p class="text-muted">{t('web_install_unavailable')}</p>
      )}
      <p class="text-muted text-sm" role="status">{status}</p>
    </Card>
  );
}

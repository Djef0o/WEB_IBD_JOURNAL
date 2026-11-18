import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { BiometricUnsupportedError, biometricAvailable } from '../../../security/biometric';
import { biometricEnrolled, disableBiometric, enableBiometric, lock } from '../../../security/vault';
import { Button, Card, Switch, showToast } from '../../components';

/** PIN lock: lock now, and biometric unlock on or off. */
export function SecuritySection() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void biometricAvailable().then(setAvailable);
  }, []);

  const toggle = async (on: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (on) await enableBiometric(t('app_name'));
      else await disableBiometric();
    } catch (error) {
      if (!(error instanceof BiometricUnsupportedError)) console.warn(error);
      showToast(t('web_pin_bio_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('web_security_title')}>
      <p class="text-muted">{t('web_security_text')}</p>
      <div class="stack-sm">
        {available && (
          <Switch
            label={t('web_pin_bio_label')}
            description={t('web_pin_bio_desc')}
            checked={biometricEnrolled.value}
            disabled={busy}
            onChange={(on) => void toggle(on)}
          />
        )}
        <div>
          <Button variant="outlined" onClick={lock}>{t('web_lock_now')}</Button>
        </div>
      </div>
    </Card>
  );
}

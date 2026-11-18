import './security.css';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { BiometricUnsupportedError, biometricAvailable } from '../../security/biometric';
import { PIN_MAX, PIN_MIN, enableBiometric, encrypting, isValidPin, setupVault } from '../../security/vault';
import { Button } from '../components';
import { PasswordField } from '../forms';

/**
 * Choice of the PIN (and, if the device can, of biometric unlock). Sets the vault up and encrypts
 * the data already on the device; `onDone` runs once the app is unlocked.
 */
export function PinSetup({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [bio, setBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void biometricAvailable().then(setBioAvailable);
  }, []);

  const pinError = isValidPin(pin) ? null : t('web_pin_invalid', [PIN_MIN, PIN_MAX]);
  const confirmError = confirm === pin ? null : t('web_pin_mismatch');

  const submit = async (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (pinError || confirmError || busy) return;
    setBusy(true);
    try {
      await setupVault(pin);
    } catch (error) {
      console.error(error);
      setMessage(t('web_pin_setup_failed'));
      setBusy(false);
      return;
    }
    if (bio) {
      try {
        await enableBiometric(t('app_name'));
      } catch (error) {
        // The PIN is set: only the fingerprint is missing; the user can retry from the settings.
        if (!(error instanceof BiometricUnsupportedError)) console.warn(error);
        setMessage(t('web_pin_bio_failed'));
      }
    }
    setBusy(false);
    onDone();
  };

  return (
    <form class="stack pin-form" onSubmit={(e) => void submit(e)} noValidate>
      <PasswordField
        label={t('web_pin_label')}
        hint={t('web_pin_hint', [PIN_MIN, PIN_MAX])}
        value={pin}
        onInput={(v) => setPin(v.replace(/\D/g, ''))}
        inputMode="numeric"
        autocomplete="new-password"
        maxLength={PIN_MAX}
        required
        error={pinError}
        showError={submitted}
      />
      <PasswordField
        label={t('web_pin_confirm_label')}
        value={confirm}
        onInput={(v) => setConfirm(v.replace(/\D/g, ''))}
        inputMode="numeric"
        autocomplete="new-password"
        maxLength={PIN_MAX}
        required
        error={confirmError}
        showError={submitted}
      />
      {bioAvailable && (
        <label class="pin-bio">
          <input type="checkbox" checked={bio} onChange={(e) => setBio(e.currentTarget.checked)} />
          <span>
            <span class="setting-title">{t('web_pin_bio_label')}</span>
            <span class="text-muted text-sm">{t('web_pin_bio_desc')}</span>
          </span>
        </label>
      )}
      <p class="callout text-sm">{t('web_pin_warning')}</p>
      {message && <p role="alert" class="text-sm">{message}</p>}
      <div>
        <Button type="submit" aria-disabled={busy || undefined}>
          {encrypting.value ? t('web_pin_encrypting') : t('web_pin_set')}
        </Button>
      </div>
    </form>
  );
}

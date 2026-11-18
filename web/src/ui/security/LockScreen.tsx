import './security.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  PIN_MAX, TooManyAttemptsError, WrongPinError, biometricEnrolled, eraseEverything, isValidPin,
  unlockWithBiometric, unlockWithPin,
} from '../../security/vault';
import { Button, Dialog } from '../components';
import { PasswordField } from '../forms';

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erasing, setErasing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const attempt = async (run: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      if (e instanceof TooManyAttemptsError) setError(t('web_pin_too_many', [e.seconds]));
      else if (e instanceof WrongPinError) setError(t('web_pin_wrong'));
      else {
        console.error(e);
        setError(t('web_pin_unlock_failed'));
      }
      setPin('');
      setBusy(false);
    }
  };

  return (
    <main class="lock-screen" aria-labelledby="lock-title">
      <h1 id="lock-title">{t('web_lock_title')}</h1>
      <form
        class="stack pin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (isValidPin(pin)) void attempt(() => unlockWithPin(pin));
        }}
        noValidate
      >
        <PasswordField
          label={t('web_pin_label')}
          value={pin}
          onInput={(v) => setPin(v.replace(/\D/g, ''))}
          inputMode="numeric"
          autocomplete="current-password"
          maxLength={PIN_MAX}
          inputRef={input}
          error={error}
          showError
        />
        <div class="lock-actions">
          <Button type="submit" aria-disabled={busy || !isValidPin(pin) || undefined}>{t('web_lock_unlock')}</Button>
          {biometricEnrolled.value && (
            <Button variant="outlined" onClick={() => void attempt(unlockWithBiometric)}>{t('web_lock_use_bio')}</Button>
          )}
        </div>
      </form>
      <div>
        <Button variant="text" onClick={() => setErasing(true)}>{t('web_pin_forgot')}</Button>
      </div>
      <Dialog open={erasing} onClose={() => setErasing(false)} title={t('web_pin_forgot')} closeLabel={t('close')} variant="center">
        <div class="stack">
          <p>{t('web_pin_forgot_text')}</p>
          <div class="lock-actions">
            <Button variant="danger" onClick={() => void eraseEverything()}>{t('web_pin_erase')}</Button>
            <Button variant="text" onClick={() => setErasing(false)}>{t('cancel')}</Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
}

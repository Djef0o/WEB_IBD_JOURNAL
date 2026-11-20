import './security.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import {
  PIN_MAX, TooManyAttemptsError, WrongPinError, biometricEnrolled, eraseEverything, isValidPin,
  lockedOutSeconds, unlockWithBiometric, unlockWithPin,
} from '../../security/vault';
import { Button, Dialog } from '../components';
import { PasswordField } from '../forms';
import { LockScreenEmergency } from '../emergency/LockScreenEmergency';
import { formatCountdown } from '../format';

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erasing, setErasing] = useState(false);
  /** End of the current waiting time (ms), after too many wrong PINs. */
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    void lockedOutSeconds().then((seconds) => {
      if (seconds > 0) setUntil(Date.now() + seconds * 1000);
    });
  }, []);
  useEffect(() => {
    if (until <= Date.now()) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) {
        window.clearInterval(timer);
        setUntil(0);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  const remaining = until > now ? Math.ceil((until - now) / 1000) : 0;
  const lockedOut = remaining > 0;

  const attempt = async (run: () => Promise<void>): Promise<void> => {
    if (busy || lockedOut) return;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      if (e instanceof TooManyAttemptsError) setUntil(Date.now() + e.seconds * 1000);
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
          error={lockedOut ? t('pin_locked_out', [formatCountdown(remaining)]) : error}
          showError
        />
        <div class="lock-actions">
          <Button type="submit" aria-disabled={busy || lockedOut || !isValidPin(pin) || undefined}>{t('web_lock_unlock')}</Button>
          {biometricEnrolled.value && (
            <Button variant="outlined" aria-disabled={lockedOut || undefined} onClick={() => void attempt(unlockWithBiometric)}>{t('web_lock_use_bio')}</Button>
          )}
        </div>
      </form>
      <div>
        <Button variant="text" onClick={() => setErasing(true)}>{t('web_pin_forgot')}</Button>
      </div>
      <LockScreenEmergency />
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

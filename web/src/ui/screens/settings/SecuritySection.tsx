import { useEffect, useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { BiometricUnsupportedError, biometricAvailable } from '../../../security/biometric';
import {
  PIN_MAX, PIN_MIN, TooManyAttemptsError, WrongPinError, biometricEnrolled, changePin, disableBiometric,
  enableBiometric, isValidPin, lock,
} from '../../../security/vault';
import { Button, Card, Dialog, Switch, showToast } from '../../components';
import { PasswordField } from '../../forms';
import { formatCountdown } from '../../format';

/** PIN lock: lock now, and biometric unlock on or off. */
export function SecuritySection() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
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
    <>
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
          {' '}
          <Button variant="outlined" onClick={() => setChanging(true)}>{t('web_pin_change')}</Button>
        </div>
      </div>
    </Card>
    <Dialog open={changing} onClose={() => setChanging(false)} title={t('web_pin_change')} closeLabel={t('close')} lightDismiss={false}>
      {changing && <ChangePinForm onDone={() => setChanging(false)} />}
    </Dialog>
    </>
  );
}

function ChangePinForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const digits = (v: string) => v.replace(/\D/g, '');

  const nextError = isValidPin(next) ? null : t('web_pin_invalid', [PIN_MIN, PIN_MAX]);
  const confirmError = confirm === next ? null : t('web_pin_mismatch');

  const submit = async (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    setWrong(null);
    if (busy || !isValidPin(current) || nextError || confirmError) return;
    setBusy(true);
    try {
      await changePin(current, next);
      showToast(t('web_pin_changed'));
      onDone();
    } catch (error) {
      if (error instanceof TooManyAttemptsError) setWrong(t('pin_locked_out', [formatCountdown(error.seconds)]));
      else if (error instanceof WrongPinError) setWrong(t('web_pin_wrong'));
      else {
        console.error(error);
        setWrong(t('web_pin_setup_failed'));
      }
      setBusy(false);
    }
  };

  return (
    <form class="stack" onSubmit={(e) => void submit(e)} noValidate>
      <PasswordField
        label={t('web_pin_current_label')} value={current} onInput={(v) => setCurrent(digits(v))} inputMode="numeric"
        autocomplete="current-password" maxLength={PIN_MAX} required
        error={wrong ?? (isValidPin(current) ? null : t('web_pin_invalid', [PIN_MIN, PIN_MAX]))} showError={submitted}
      />
      <PasswordField
        label={t('web_pin_new_label')} hint={t('web_pin_hint', [PIN_MIN, PIN_MAX])} value={next} onInput={(v) => setNext(digits(v))}
        inputMode="numeric" autocomplete="new-password" maxLength={PIN_MAX} required error={nextError} showError={submitted}
      />
      <PasswordField
        label={t('web_pin_confirm_label')} value={confirm} onInput={(v) => setConfirm(digits(v))} inputMode="numeric"
        autocomplete="new-password" maxLength={PIN_MAX} required error={confirmError} showError={submitted}
      />
      <div class="sheet-actions">
        <Button type="submit" aria-disabled={busy || undefined}>{t('web_pin_change')}</Button>
      </div>
    </form>
  );
}

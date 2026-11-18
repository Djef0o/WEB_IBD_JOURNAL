import './security.css';
import { t } from '../../i18n';
import { PinSetup } from './PinSetup';

/** Full-screen PIN setup for an install that predates the PIN: the app stays closed until it is done. */
export function SetupGate() {
  return (
    <main class="lock-screen" aria-labelledby="gate-title">
      <h1 id="gate-title">{t('web_pin_gate_title')}</h1>
      <p class="text-muted">{t('web_pin_gate_text')}</p>
      <PinSetup onDone={() => undefined} />
    </main>
  );
}

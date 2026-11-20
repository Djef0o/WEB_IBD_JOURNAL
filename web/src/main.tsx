import { effect, untracked } from '@preact/signals';
import { render } from 'preact';
import './styles/reset.css';
import './styles/tokens.css';
import './styles/palettes.css';
import './styles/contrast.css';
import './styles/layout.css';
import './ui/shell/shell.css';
import { App } from './app';
import { requestPersistentStorage } from './db';
import { getPrefs } from './db/prefs';
import { initI18n } from './i18n';
import { registerServiceWorker } from './pwa/register';
import { startReminderNotifier } from './reminders/notify';
import { initRouter } from './router';
import { initInstall } from './ui/install';
import { restoreAppearance, syncAppearanceAcrossTabs } from './ui/prefsSync';
import { initGlow } from './ui/glow/glowPref';
import { initTheme } from './ui/theme';
import { loadVault, vaultStatus } from './security/vault';
import { startLockScreenEmergencySync } from './db/emergencyLock';

/**
 * First visit: the app redirects every screen to the onboarding. Doing it before the router loads
 * the first screen saves downloading (and discarding) the home screen's code.
 */
async function startRouter(): Promise<void> {
  if (location.pathname !== '/onboarding') {
    try {
      if (!(await getPrefs()).onboardingDone) history.replaceState(history.state, '', '/onboarding');
    } catch {
      /* storage unavailable: the app's own redirect logic takes over */
    }
  }
  await initRouter();
}

async function boot(): Promise<void> {
  initTheme();
  initGlow();
  initInstall();
  // The dictionary and the first screen are independent downloads: fetch them side by side
  // (awaiting one after the other adds a full network round trip before the first render).
  await Promise.all([initI18n(), startRouter(), loadVault()]);
  render(<App />, document.getElementById('app')!);
  void requestPersistentStorage();
  // The reminders read the journal: they wait for the unlock.
  let notifier = false;
  effect(() => {
    const status = vaultStatus.value;
    if (notifier || (status !== 'none' && status !== 'unlocked')) return;
    notifier = true;
    untracked(() => { startReminderNotifier(); });
  });
  // The emergency sheet copy readable on the lock screen follows the journal while it is open.
  let lockCopy = false;
  effect(() => {
    const status = vaultStatus.value;
    if (lockCopy || (status !== 'none' && status !== 'unlocked')) return;
    lockCopy = true;
    untracked(() => { startLockScreenEmergencySync(); });
  });
  registerServiceWorker();
  syncAppearanceAcrossTabs();
  restoreAppearance().catch((error: unknown) => console.error(error));
}

void boot();

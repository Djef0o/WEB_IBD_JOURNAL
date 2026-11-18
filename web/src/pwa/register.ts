import { t } from '../i18n';
import { showToast } from '../ui/components';

/*
 * Service worker registration (offline app shell, see vite.config.ts).
 *
 * - `navigator.serviceWorker.register()` is a Trusted Types sink (`require-trusted-types-for
 *   'script'`): the only URL we ever pass is our own `/sw.js`, wrapped by a policy that checks it.
 *   This is why `vite-plugin-pwa`'s virtual register module (plain string URL) is not used.
 * - A new version never takes over by itself: the new worker waits, the user is offered an
 *   "Update" action in a toast, and the page only reloads once they accept. A form being filled
 *   in, in this tab or another one, is never discarded behind their back.
 */

const SW_URL = '/sw.js';
/** The toast stays long enough to be seen without being sticky; it is offered again on the next visit. */
const TOAST_MS = 60_000;
/** Long-lived PWAs rarely navigate: look for a new version when the app comes back to the front, at most this often. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

let policy: TrustedTypePolicy | null = null;
function trustedScriptUrl(path: string): string | TrustedScriptURL {
  // `trustedTypes` is not in the DOM lib yet (see labimport/trustedTypes.d.ts) and absent from older browsers.
  const types: TrustedTypePolicyFactory | undefined = Reflect.get(globalThis, 'trustedTypes');
  if (!types) return path;
  policy ??= types.createPolicy('ibdj-service-worker', {
    createScriptURL: (value: string) => {
      if (new URL(value, location.href).origin !== location.origin) throw new TypeError('Cross-origin service worker');
      return value;
    },
  });
  return policy.createScriptURL(path);
}

/** Registers `/sw.js` (production only) and wires the "new version" prompt. */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const container = navigator.serviceWorker;
  let updateRequested = false;
  let prompted = false;

  // Reload only for the tab that asked for the update.
  container.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });

  const offerUpdate = (worker: ServiceWorker): void => {
    if (prompted) return;
    prompted = true;
    const show = (): void => {
      showToast(t('web_update_available'), {
        actionLabel: t('web_update_action'),
        duration: TOAST_MS,
        onAction: () => {
          updateRequested = true;
          worker.postMessage({ type: 'SKIP_WAITING' });
        },
      });
    };
    if (!document.querySelector('dialog[open]')) {
      show();
      return;
    }
    // A modal sheet (a form being filled in) makes the rest of the page inert, toast included:
    // wait until it is closed rather than interrupting or hiding the prompt behind it.
    const onClosed = (): void => {
      if (document.querySelector('dialog[open]')) return;
      document.removeEventListener('close', onClosed, true);
      show();
    };
    document.addEventListener('close', onClosed, true); // `close` does not bubble
  };

  const watch = (registration: ServiceWorkerRegistration): void => {
    // A first install has no controller: nothing to update yet, the worker simply starts serving.
    if (registration.waiting && container.controller) offerUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      incoming?.addEventListener('statechange', () => {
        if (incoming.state === 'installed' && container.controller) offerUpdate(incoming);
      });
    });
    let lastCheck = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_CHECK_MS) return;
      lastCheck = Date.now();
      registration.update().catch(() => undefined); // offline: try again next time
    });
  };

  // After `load`, so that registration never competes with the first render.
  const start = (): void => {
    container
      .register(trustedScriptUrl(SW_URL) as string, { scope: '/' })
      .then((registration: ServiceWorkerRegistration | undefined) => { if (registration) watch(registration); })
      .catch((error: unknown) => console.error('Service worker registration failed', error));
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

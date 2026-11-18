/*
 * Installation de l'app (PWA). Deux mécanismes, le premier disponible l'emporte :
 *  1. `navigator.install()` (Web Install API) ;
 *  2. l'événement `beforeinstallprompt` (Chromium), capturé au démarrage car il peut arriver
 *     avant l'ouverture des Réglages.
 * Sans l'un ni l'autre, aucun bouton : le navigateur garde son propre menu d'installation.
 */
import { computed, signal } from '@preact/signals';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Membres non standard de `navigator` : absents du typage DOM, présents selon le navigateur. */
interface InstallableNavigator extends Navigator {
  install?: () => Promise<unknown>;
  standalone?: boolean;
}
const nav: InstallableNavigator = navigator;
const supportsWebInstall = typeof nav.install === 'function';
const isStandalone = (): boolean => matchMedia('(display-mode: standalone)').matches || nav.standalone === true;

const deferred = signal<BeforeInstallPromptEvent | null>(null);
const installed = signal(false);

export type InstallState = 'installed' | 'available' | 'unavailable';

export const installState = computed<InstallState>(() => {
  if (installed.value) return 'installed';
  return supportsWebInstall || deferred.value ? 'available' : 'unavailable';
});

export type InstallOutcome = 'accepted' | 'dismissed' | 'error';

/** À appeler directement depuis le gestionnaire de clic (l'activation utilisateur est requise). */
export async function promptInstall(): Promise<InstallOutcome> {
  try {
    if (supportsWebInstall && nav.install) {
      await nav.install();
      installed.value = true;
      return 'accepted';
    }
    const event = deferred.value;
    if (!event) return 'error';
    // L'événement est à usage unique : on l'écarte avant d'attendre le choix.
    deferred.value = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') installed.value = true;
    return outcome;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'dismissed';
    console.error(error);
    return 'error';
  }
}

let started = false;

export function initInstall(): void {
  if (started) return;
  started = true;
  installed.value = isStandalone();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred.value = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed.value = true;
    deferred.value = null;
  });
}

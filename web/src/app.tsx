import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { SOURCE_URL } from './config';
import { onboardingDone } from './db/prefs';
import { t } from './i18n';
import { currentRoute, markRouteRendered, navigate, titleOverride } from './router';
import { ToastHost } from './ui/components';
import { vaultStatus } from './security/vault';
import { LockScreen } from './ui/security/LockScreen';
import { SetupGate } from './ui/security/SetupGate';
import { Nav } from './ui/shell/Nav';

/** Place le focus sur le titre de la nouvelle page (sinon sur <main>) : le lecteur d'écran l'annonce. */
function focusPage(): void {
  const main = document.getElementById('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

export function App() {
  const route = currentRoute.value;
  const done = onboardingDone.value; // undefined tant que les préférences ne sont pas lues
  const vault = vaultStatus.value;
  const previousPath = useRef<string | null>(null);

  const title = route ? (titleOverride.value ?? t(route.titleKey)) : '';
  useEffect(() => {
    if (title) document.title = `${title} · ${t('app_name')}`;
  }, [title, t('app_name')]);

  // Nouvelle vue dans le DOM : libère la transition en cours, puis gère le focus (pas au premier affichage).
  useLayoutEffect(() => {
    markRouteRendered();
    if (previousPath.current !== null && route && previousPath.current !== route.path) focusPage();
    previousPath.current = route?.path ?? null;
  }, [route]);

  // MainViewModel : onboarding tant qu'il n'est pas terminé, et inversement.
  const needsOnboarding = done === false && route?.name !== 'onboarding';
  const leaveOnboarding = done === true && route?.name === 'onboarding';
  useEffect(() => {
    if (needsOnboarding) void navigate('/onboarding', { replace: true });
    else if (leaveOnboarding) void navigate('/', { replace: true });
  }, [needsOnboarding, leaveOnboarding]);

  // Code PIN : écran de verrouillage ; installation existante sans PIN : configuration obligatoire.
  const locked = vault === 'locked';
  const needsPin = vault === 'none' && done === true && route?.name !== 'onboarding';
  const ready = done !== undefined && !needsOnboarding && !leaveOnboarding && vault !== 'loading';
  const bare = route?.name === 'onboarding' || route?.name === 'urgent';

  return (
    <>
      {locked ? (
        <LockScreen />
      ) : needsPin ? (
        <SetupGate />
      ) : ready && route ? (
        <div class="app-shell" data-bare={bare ? '' : undefined}>
          <a
            class="skip-link"
            href="#main"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('main')?.focus();
            }}
          >
            {t('web_skip_to_content')}
          </a>
          {!bare && <Nav current={route.tab} />}
          <div class="app-content">
            <main id="main" class="app-main" tabIndex={-1}>
              <route.Component key={route.path} params={route.params} />
            </main>
            <footer class="app-footer">
              <span>{t('web_footer_license')}</span>
              <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{t('web_source_code')}</a>
            </footer>
          </div>
        </div>
      ) : (
        <div class="splash" role="status">{t('web_loading')}</div>
      )}
      <ToastHost label={t('notifications')} closeLabel={t('close')} />
    </>
  );
}

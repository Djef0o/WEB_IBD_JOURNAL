/*
 * Routeur History API minimal.
 *
 * - Les écrans sont chargés à la demande (`import()`), un chunk par écran. La navigation attend
 *   le chunk avant de changer de vue : pas d'écran de chargement intermédiaire.
 * - Les liens `<a href="/chemin">` internes sont interceptés globalement (clic simple, sans
 *   modificateur, sans `target`/`download`) : les écrans écrivent de simples liens.
 * - Transition de vue (`document.startViewTransition`) en amélioration progressive, désactivée si
 *   l'utilisateur préfère réduire les animations.
 * - Le défilement est restauré au retour arrière, remis en haut sinon.
 */
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { useEffect } from 'preact/hooks';
import { parseLocalDate } from './domain/time';

/** Propriétés reçues par chaque écran. `params.date` pour `/day/:date` (AAAA-MM-JJ). */
export interface ScreenProps {
  params: Record<string, string>;
}
type Screen = ComponentType<ScreenProps>;
type Loader = () => Promise<{ default: Screen }>;

export type TabId = 'home' | 'history' | 'analysis' | 'care' | 'settings';
export type RouteName =
  | 'home' | 'history' | 'day' | 'analysis' | 'care' | 'labs'
  | 'settings' | 'onboarding' | 'report' | 'scan' | 'notFound';

interface RouteDef {
  name: RouteName;
  /** Segments, `:nom` pour un paramètre. */
  pattern: string;
  load: Loader;
  /** Destination de navigation mise en avant. */
  tab: TabId | null;
  /** Clé i18n du titre de document (sinon `app_name` seul). */
  titleKey: string;
  validate?: (params: Record<string, string>) => boolean;
}

const isDate = (p: Record<string, string>): boolean => {
  try {
    parseLocalDate(p.date ?? '');
    return true;
  } catch {
    return false;
  }
};

const ROUTES: readonly RouteDef[] = [
  { name: 'home', pattern: '/', load: () => import('./ui/screens/Home'), tab: 'home', titleKey: 'nav_home' },
  { name: 'history', pattern: '/history', load: () => import('./ui/screens/History'), tab: 'history', titleKey: 'history_title' },
  { name: 'day', pattern: '/day/:date', load: () => import('./ui/screens/Day'), tab: 'history', titleKey: 'day_journal', validate: isDate },
  { name: 'analysis', pattern: '/analysis', load: () => import('./ui/screens/Analysis'), tab: 'analysis', titleKey: 'analysis_title' },
  { name: 'care', pattern: '/care', load: () => import('./ui/screens/Care'), tab: 'care', titleKey: 'care_title' },
  { name: 'labs', pattern: '/care/labs', load: () => import('./ui/screens/Labs'), tab: 'care', titleKey: 'lab_results_title' },
  { name: 'settings', pattern: '/settings', load: () => import('./ui/screens/Settings'), tab: 'settings', titleKey: 'nav_settings' },
  { name: 'onboarding', pattern: '/onboarding', load: () => import('./ui/screens/Onboarding'), tab: null, titleKey: 'onboarding_title' },
  { name: 'report', pattern: '/report', load: () => import('./ui/screens/Report'), tab: 'analysis', titleKey: 'report_title' },
  { name: 'scan', pattern: '/scan', load: () => import('./ui/screens/Scan'), tab: 'home', titleKey: 'scan_title' },
];
const NOT_FOUND: RouteDef = {
  name: 'notFound', pattern: '*', load: () => import('./ui/screens/NotFound'), tab: null, titleKey: 'web_not_found_title',
};

export interface ResolvedRoute {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  tab: TabId | null;
  titleKey: string;
  Component: Screen;
}

/** Route affichée ; `null` tant que la première route n'est pas chargée. */
export const currentRoute = signal<ResolvedRoute | null>(null);
/** Titre propre à l'écran (ex. la date d'un jour) ; remplace le titre par défaut de la route. */
export const titleOverride = signal<string | null>(null);

/** Fixe le titre de document de l'écran courant tant qu'il est monté. */
export function usePageTitle(title: string | null): void {
  useEffect(() => {
    titleOverride.value = title;
    return () => {
      if (titleOverride.peek() === title) titleOverride.value = null;
    };
  }, [title]);
}

function normalize(pathname: string): string {
  const p = pathname.replace(/\/{2,}/g, '/');
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/');
  const b = path.split('/');
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i]!;
    const actual = b[i]!;
    if (seg.startsWith(':')) {
      let value: string;
      try {
        value = decodeURIComponent(actual);
      } catch {
        return null;
      }
      if (!value) return null;
      params[seg.slice(1)] = value;
    } else if (seg !== actual) {
      return null;
    }
  }
  return params;
}

/** Résout un chemin vers sa définition et charge l'écran. */
export async function resolveRoute(pathname: string): Promise<ResolvedRoute> {
  const path = normalize(pathname);
  let def: RouteDef = NOT_FOUND;
  let params: Record<string, string> = {};
  for (const r of ROUTES) {
    const m = match(r.pattern, path);
    if (m && (!r.validate || r.validate(m))) {
      def = r;
      params = m;
      break;
    }
  }
  const mod = await def.load();
  return { name: def.name, path, params, tab: def.tab, titleKey: def.titleKey, Component: mod.default };
}

// --- Rendu et transition ---------------------------------------------------------------

let renderWaiter: (() => void) | null = null;

/** Appelé par l'application une fois la nouvelle vue dans le DOM (fin de la mise à jour). */
export function markRouteRendered(): void {
  renderWaiter?.();
  renderWaiter = null;
}

function rendered(): Promise<void> {
  // Baseline « récent » seulement : pas de Promise.withResolvers.
  return new Promise((resolve) => {
    renderWaiter = resolve;
    // Garde-fou : ne jamais bloquer la transition si le rendu ne notifie pas.
    setTimeout(markRouteRendered, 400);
  });
}

async function applyWithTransition(update: () => void): Promise<void> {
  if (typeof document.startViewTransition !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const done = rendered();
    update();
    await done;
    return;
  }
  const transition = document.startViewTransition(async () => {
    const done = rendered();
    update();
    await done;
  });
  // A skipped transition (a newer navigation started) rejects `ready`, `updateCallbackDone` and
  // `finished` alike; none of them is an error for us, and an unhandled one shows up as a page error.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  await transition.finished.catch(() => undefined);
}

// --- Navigation ------------------------------------------------------------------------

interface HistoryState {
  scrollY?: number;
}

let token = 0;

function rememberScroll(): void {
  const state = (history.state ?? {}) as HistoryState;
  history.replaceState({ ...state, scrollY: window.scrollY }, '');
}

export interface NavigateOptions {
  /** Remplace l'entrée d'historique au lieu d'en ajouter une. */
  replace?: boolean;
}

/** Navigue vers un chemin interne (`/history`, `/day/2026-11-18?x=1`). Les URL externes sont ouvertes normalement. */
export async function navigate(to: string, options: NavigateOptions = {}): Promise<void> {
  const url = new URL(to, location.href);
  if (url.origin !== location.origin) {
    location.assign(url);
    return;
  }
  const target = normalize(url.pathname) + url.search + url.hash;
  const here = normalize(location.pathname) + location.search + location.hash;
  if (target === here && currentRoute.value) return;
  const mine = ++token;
  const next = await resolveRoute(url.pathname);
  if (mine !== token) return;
  const apply = (): void => {
    if (options.replace) history.replaceState({}, '', target);
    else {
      rememberScroll();
      history.pushState({}, '', target);
    }
    currentRoute.value = next;
    window.scrollTo(0, 0);
  };
  await applyWithTransition(apply);
}

async function onPopState(): Promise<void> {
  const mine = ++token;
  const next = await resolveRoute(location.pathname);
  if (mine !== token) return;
  const y = ((history.state ?? {}) as HistoryState).scrollY ?? 0;
  await applyWithTransition(() => {
    currentRoute.value = next;
    window.scrollTo(0, y);
  });
}

function onClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const raw = a.getAttribute('href');
  if (!raw || raw.startsWith('#')) return;
  const url = new URL(a.href, location.href);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== location.origin) return;
  e.preventDefault();
  void navigate(url.pathname + url.search + url.hash);
}

let started = false;

/** À appeler une fois : charge la route de l'URL courante et écoute l'historique et les liens. */
export async function initRouter(): Promise<void> {
  if (started) return;
  started = true;
  history.scrollRestoration = 'manual';
  currentRoute.value = await resolveRoute(location.pathname);
  window.addEventListener('popstate', () => void onPopState());
  document.addEventListener('click', onClick);
}

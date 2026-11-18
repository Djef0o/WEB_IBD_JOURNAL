import { getPrefs } from '../db/prefs';
import { STORAGE_KEY, isLang, setLang } from '../i18n';
import {
  PALETTE_KEY, THEME_KEY, THEME_MODES, THEME_PALETTES, setThemeMode, setThemePalette,
  type ThemeMode, type ThemePalette,
} from './theme';

function hasLocal(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true; // stockage indisponible : rien à rétablir
  }
}

/**
 * Thème et langue s'appliquent dès le démarrage depuis `localStorage` (lecture synchrone, pas de
 * flash). Les mêmes choix sont copiés dans les préférences IndexedDB : si `localStorage` a été vidé
 * seul, on les rétablit ici.
 */
export async function restoreAppearance(): Promise<void> {
  const prefs = await getPrefs();
  if (!hasLocal(THEME_KEY) && prefs.appearance.mode !== 'SYSTEM') setThemeMode(prefs.appearance.mode);
  if (!hasLocal(PALETTE_KEY) && prefs.appearance.palette !== 'SAGE') setThemePalette(prefs.appearance.palette);
  if (!hasLocal(STORAGE_KEY) && prefs.lang) await setLang(prefs.lang);
}

/** Un choix fait dans un autre onglet s'applique ici aussitôt (événement `storage`). */
export function syncAppearanceAcrossTabs(): void {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage) return;
    if (event.key === THEME_KEY) setThemeMode(THEME_MODES.find((m): m is ThemeMode => m === event.newValue) ?? 'SYSTEM');
    else if (event.key === PALETTE_KEY) setThemePalette(THEME_PALETTES.find((p): p is ThemePalette => p === event.newValue) ?? 'SAGE');
    else if (event.key === STORAGE_KEY) void setLang(isLang(event.newValue) ? event.newValue : null);
  });
}

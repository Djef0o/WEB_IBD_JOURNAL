import { effect, signal } from '@preact/signals';

/** Mêmes noms que `ThemeMode` / `ThemePalette` de l'app Android (Appearance.kt). */
export type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK' | 'AMOLED';
export type ThemePalette = 'SAGE' | 'SOLARIZED' | 'NORD' | 'GRUVBOX' | 'CATPPUCCIN' | 'ROSE_PINE';

export const THEME_MODES: readonly ThemeMode[] = ['SYSTEM', 'LIGHT', 'DARK', 'AMOLED'];
export const THEME_PALETTES: readonly ThemePalette[] = ['SAGE', 'SOLARIZED', 'NORD', 'GRUVBOX', 'CATPPUCCIN', 'ROSE_PINE'];

export const THEME_KEY = 'ibdj.theme';
export const PALETTE_KEY = 'ibdj.palette';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible (navigation privée) : le choix reste valable pour la session */
  }
}

export const themeMode = signal<ThemeMode>(read(THEME_KEY, THEME_MODES, 'SYSTEM'));
export const themePalette = signal<ThemePalette>(read(PALETTE_KEY, THEME_PALETTES, 'SAGE'));

export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode;
  write(THEME_KEY, mode);
}

export function setThemePalette(palette: ThemePalette): void {
  themePalette.value = palette;
  write(PALETTE_KEY, palette);
}

/** Identifiant CSS (`data-palette`) d'une palette. */
export const paletteAttr = (p: ThemePalette): string => p.toLowerCase().replace('_', '-');
export const modeAttr = (m: ThemeMode): string => m.toLowerCase();

/** Aligne <meta name="theme-color"> sur la couleur de fond réellement affichée. */
function syncThemeColor(): void {
  const color = getComputedStyle(document.body).backgroundColor;
  let metas = Array.from(document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  if (metas.length === 0) {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    document.head.append(m);
    metas = [m];
  }
  for (const m of metas) {
    m.removeAttribute('media'); // le choix de l'utilisateur prime sur prefers-color-scheme
    m.content = color;
  }
}

let started = false;

/** À appeler une fois au démarrage : applique les data-attributes et les maintient à jour. */
export function initTheme(): void {
  if (started) return;
  started = true;
  const root = document.documentElement;
  effect(() => {
    root.dataset.theme = modeAttr(themeMode.value);
    root.dataset.palette = paletteAttr(themePalette.value);
    syncThemeColor();
  });
  // En mode « système », le fond change avec l'OS sans que nos signaux bougent.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);
}

/** Hook : lecture et écriture des préférences d'apparence. */
export function useTheme() {
  return {
    mode: themeMode.value,
    palette: themePalette.value,
    setMode: setThemeMode,
    setPalette: setThemePalette,
  };
}

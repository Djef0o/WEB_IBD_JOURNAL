import { signal } from '@preact/signals';

const KEY = 'ibdj.glow';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

/** Animated background preference: on by default, stored as `0` when turned off. */
export const glowEnabled = signal(read());

let stop: (() => void) | null = null;
let starting = false;

/** True when the resolved theme is dark (explicit dark / AMOLED, or "system" on a dark OS). */
function isDark(): boolean {
  const mode = document.documentElement.dataset.theme;
  if (mode === 'dark' || mode === 'amoled') return true;
  return mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Starts the background only while it is wanted (enabled and dark theme), so a light-theme user
 * never downloads the code or opens a WebGL context.
 */
function sync(): void {
  const root = document.documentElement;
  const want = glowEnabled.value && isDark();
  if (glowEnabled.value) root.dataset.glow = '';
  else delete root.dataset.glow;
  if (want && !stop && !starting) {
    starting = true;
    void import('./glow')
      .then((m) => {
        if (glowEnabled.value && isDark()) stop = m.startGlow();
      })
      .catch((error: unknown) => console.error(error))
      .finally(() => { starting = false; });
  } else if (!want && stop) {
    stop();
    stop = null;
  }
}

export function setGlowEnabled(enabled: boolean): void {
  glowEnabled.value = enabled;
  try {
    if (enabled) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '0');
  } catch {
    /* storage unavailable: the choice lasts for this session only */
  }
  sync();
}

export function initGlow(): void {
  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
}

import './settings.css';
import type { CSSProperties } from 'preact';
import { useId } from 'preact/hooks';
import { setThemeModePref, setThemePalettePref } from '../../../db/prefs';
import { t } from '../../../i18n';
import { Card, SegmentedControl, Switch } from '../../components';
import { glowEnabled, setGlowEnabled } from '../../glow/glowPref';
import {
  THEME_MODES, THEME_PALETTES, setThemeMode, setThemePalette, themeMode, themePalette,
  type ThemeMode, type ThemePalette,
} from '../../theme';
import { PALETTE_SWATCHES } from './paletteSwatches';

const MODE_LABEL: Record<ThemeMode, () => string> = {
  SYSTEM: () => t('theme_mode_system'),
  LIGHT: () => t('theme_mode_light'),
  DARK: () => t('theme_mode_dark'),
  AMOLED: () => t('theme_mode_amoled'),
};

const PALETTE_LABEL: Record<ThemePalette, () => string> = {
  SAGE: () => t('palette_sage'),
  SOLARIZED: () => t('palette_solarized'),
  NORD: () => t('palette_nord'),
  GRUVBOX: () => t('palette_gruvbox'),
  CATPPUCCIN: () => t('palette_catppuccin'),
  ROSE_PINE: () => t('palette_rose_pine'),
};

function swatchStyle(palette: ThemePalette): CSSProperties {
  const s = PALETTE_SWATCHES[palette];
  return {
    '--sw-bg-l': s.background[0], '--sw-bg-d': s.background[1],
    '--sw-p-l': s.primary[0], '--sw-p-d': s.primary[1],
    '--sw-t-l': s.tertiary[0], '--sw-t-d': s.tertiary[1],
    '--sw-op-l': s.onPrimary[0], '--sw-op-d': s.onPrimary[1],
  };
}

/** Luminosité (système / clair / sombre / AMOLED) et palette : appliquées et enregistrées aussitôt. */
export function AppearanceSection() {
  const name = useId();
  const mode = themeMode.value;
  const palette = themePalette.value;
  return (
    <Card title={t('settings_appearance')}>
      <SegmentedControl
        label={t('theme_mode')}
        hideLabel={false}
        value={mode}
        options={THEME_MODES.map((m) => ({ value: m, label: MODE_LABEL[m]() }))}
        onChange={(m) => {
          setThemeMode(m);
          void setThemeModePref(m);
        }}
      />
      <fieldset>
        <legend class="field-label">{t('theme_palette')}</legend>
        <div class="palette-grid">
          {THEME_PALETTES.map((p) => (
            <label key={p} class="palette-option">
              <input
                type="radio"
                name={name}
                value={p}
                checked={p === palette}
                onChange={() => {
                  setThemePalette(p);
                  void setThemePalettePref(p);
                }}
              />
              <span class="swatch" style={swatchStyle(p)} aria-hidden="true">
                <i class="swatch-bg" />
                <i class="swatch-primary" />
                <i class="swatch-tertiary" />
                <span class="swatch-check">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" focusable="false">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                </span>
              </span>
              <span class="palette-name">{PALETTE_LABEL[p]()}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Switch
        label={t('web_glow_label')}
        description={t('web_glow_description')}
        checked={glowEnabled.value}
        onChange={setGlowEnabled}
      />
    </Card>
  );
}

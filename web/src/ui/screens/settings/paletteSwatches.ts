import type { ThemePalette } from '../../theme';

/** [clair, sombre] : fond, accent principal, accent tertiaire de chaque palette (tirés de palettes.css). */
type Pair = readonly [string, string];

export const PALETTE_SWATCHES: Record<ThemePalette, { background: Pair; primary: Pair; tertiary: Pair; onPrimary: Pair }> = {
  SAGE: { background: ['#F7FAF8', '#0C1311'], primary: ['#0B6E63', '#7FD8C4'], tertiary: ['#9A5B22', '#F3B57C'], onPrimary: ['#FFFFFF', '#00332C'] },
  SOLARIZED: { background: ['#FDF6E3', '#002B36'], primary: ['#1E7F78', '#39A89F'], tertiary: ['#CB4B16', '#DB815C'], onPrimary: ['#FFFFFF', '#FFFFFF'] },
  NORD: { background: ['#ECEFF4', '#2E3440'], primary: ['#56759D', '#88C0D0'], tertiary: ['#A6604B', '#DAA08E'], onPrimary: ['#FFFFFF', '#2E3440'] },
  GRUVBOX: { background: ['#FBF1C7', '#1D2021'], primary: ['#427B58', '#8EC07C'], tertiary: ['#AF3A03', '#FE8019'], onPrimary: ['#FFFFFF', '#1D2021'] },
  CATPPUCCIN: { background: ['#E6E9EF', '#181825'], primary: ['#8839EF', '#CBA6F7'], tertiary: ['#BC4A08', '#FAB387'], onPrimary: ['#FFFFFF', '#181825'] },
  ROSE_PINE: { background: ['#FAF4ED', '#191724'], primary: ['#286983', '#9CCFD8'], tertiary: ['#9D6819', '#F6C177'], onPrimary: ['#FFFFFF', '#191724'] },
};

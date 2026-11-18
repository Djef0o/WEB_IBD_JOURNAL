import type { ComponentChildren } from 'preact';
import { t } from '../../i18n';
import type { TabId } from '../../router';

/** Pictogramme décoratif 24×24 (trait), hérite de `currentColor`. */
export function Glyph({ children }: { children: ComponentChildren }) {
  return (
    <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      {children}
    </svg>
  );
}

/** Tracés des cinq destinations (réutilisés par l'onboarding). */
export const TAB_ICONS: Record<TabId, ComponentChildren> = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  history: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  analysis: <path d="M5 20V11M12 20V4M19 20v-6" />,
  care: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M12 10.5v6M9 13.5h6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

const DESTINATIONS: readonly { id: TabId; href: string; label: () => string }[] = [
  { id: 'home', href: '/', label: () => t('nav_home') },
  { id: 'history', href: '/history', label: () => t('nav_history') },
  { id: 'analysis', href: '/analysis', label: () => t('nav_analysis') },
  { id: 'care', href: '/care', label: () => t('nav_care') },
  { id: 'settings', href: '/settings', label: () => t('nav_settings') },
];

/** Navigation principale : barre en bas sous 600 px, rail latéral au-delà (voir layout.css). */
export function Nav({ current }: { current: TabId | null }) {
  return (
    <nav class="app-nav" aria-label={t('web_nav_aria')}>
      <ul role="list">
        {DESTINATIONS.map((d) => (
          <li key={d.id}>
            <a href={d.href} aria-current={current === d.id ? 'page' : undefined}>
              <Glyph>{TAB_ICONS[d.id]}</Glyph>
              <span>{d.label()}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

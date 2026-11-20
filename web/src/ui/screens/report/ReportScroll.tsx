import type { ComponentChildren } from 'preact';

/**
 * Horizontal scroll area for wide tables on narrow screens (focusable, named). A `group`, not a
 * `region`: it shares its name with the section that holds it, and landmarks must be unique.
 */
export function Scroll({ label, children }: { label: string; children: ComponentChildren }) {
  return <div class="report-scroll" role="group" tabIndex={0} aria-label={label}>{children}</div>;
}

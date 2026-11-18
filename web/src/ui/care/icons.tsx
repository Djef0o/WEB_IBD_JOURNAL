import { t } from '../../i18n';

const common = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

/** Bell: reminder on / off, with a text alternative (the state is never conveyed by color alone). */
export function ReminderIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg {...common} role="img" aria-label={enabled ? t('reminder_enabled') : t('reminder_off')} class="care-bell" data-on={enabled ? '' : undefined}>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9zM10 20a2 2 0 0 0 4 0" />
      {!enabled && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

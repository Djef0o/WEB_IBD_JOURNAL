const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': true, focusable: 'false' } as const;

/** Medical information: a card with a cross. */
export function MedicalInfoIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...common} width={size} height={size}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

/** Toilet sign: two figures. */
export function ToiletIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...common} width={size} height={size}>
      <circle cx="6.5" cy="4.5" r="1.7" />
      <circle cx="17.5" cy="4.5" r="1.7" />
      <path d="M4.5 21v-6h-1.5l1.5-6.5h4l1.5 6.5H8.5v6M17.5 21v-7.5M14.5 14l3-5 3 5z" />
      <path d="M12 3v18" />
    </svg>
  );
}

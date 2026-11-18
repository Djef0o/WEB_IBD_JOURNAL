/** Icônes décoratives de l'accueil (SVG inline, héritent de `currentColor`). */
const base = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': true, focusable: 'false' } as const;

export function RestaurantIcon() {
  return (
    <svg {...base}>
      <path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M8 3v5M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </svg>
  );
}

export function DropIcon() {
  return (
    <svg {...base}>
      <path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg {...base}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
    </svg>
  );
}

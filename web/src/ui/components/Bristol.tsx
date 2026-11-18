import './components.css';
import { bristolIconUrl } from './bristol';

interface BristolIconProps {
  type: number;
  /** Texte alternatif ; vide = décoratif. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Icône SVG d'un type de Bristol, cerclée de sa couleur (BristolColors.kt). */
export function BristolIcon({ type, label = '', size = 'md' }: BristolIconProps) {
  return (
    <span class="bristol-icon" data-bristol={type} data-size={size}>
      <img src={bristolIconUrl(type)} alt={label} width="48" height="48" decoding="async" />
    </span>
  );
}

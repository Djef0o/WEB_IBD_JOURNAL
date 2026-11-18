import './components.css';
import type { ComponentChildren } from 'preact';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ComponentChildren;
  /** Actions (boutons). */
  children?: ComponentChildren;
  /** Niveau du titre : 1 quand l'état vide est le contenu principal de la page (aucun autre h1). */
  level?: 1 | 2;
}

export function EmptyState({ title, description, icon, children, level = 2 }: EmptyStateProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div class="empty-state">
      {icon && <div class="empty-state-icon" aria-hidden="true">{icon}</div>}
      <Heading>{title}</Heading>
      {description && <p class="text-muted">{description}</p>}
      {children && <div class="row-wrap empty-state-actions">{children}</div>}
    </div>
  );
}

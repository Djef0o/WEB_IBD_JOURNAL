import './components.css';
import type { ComponentChildren } from 'preact';

interface CardProps {
  title?: string;
  /** Niveau de titre (défaut h2). */
  headingLevel?: 2 | 3 | 4;
  variant?: 'filled' | 'outlined' | 'elevated';
  class?: string;
  children?: ComponentChildren;
}

export function Card({ title, headingLevel = 2, variant = 'filled', class: cls, children }: CardProps) {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <section class={`card${cls ? ` ${cls}` : ''}`} data-variant={variant}>
      {title && <H class="card-title">{title}</H>}
      {children}
    </section>
  );
}

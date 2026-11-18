import './components.css';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentChildren } from 'preact';

type Variant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

interface Common {
  variant?: Variant;
  icon?: ComponentChildren;
  children?: ComponentChildren;
}
type ButtonProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'icon'> & { href?: undefined };
type LinkProps = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'filled', icon, children, class: cls, ...rest } = props;
  const className = `btn${cls ? ` ${cls}` : ''}`;
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (typeof rest.href === 'string') {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} class={className} data-variant={variant}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} class={className} data-variant={variant}>
      {content}
    </button>
  );
}

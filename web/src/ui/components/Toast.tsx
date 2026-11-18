import './components.css';
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** Durée en ms avant disparition (défaut 6000). Si l'action est présente, la pause au survol/focus s'applique. */
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const toasts = signal<ToastItem[]>([]);
let nextId = 1;

export function showToast(message: string, options: ToastOptions = {}): number {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message, ...options }];
  const root = document.documentElement as HTMLElement & { ariaNotify?: (m: string) => void };
  root.ariaNotify?.(options.actionLabel ? `${message}. ${options.actionLabel}` : message);
  return id;
}

export function dismissToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

function ToastView({ item, closeLabel }: { item: ToastItem; closeLabel: string }) {
  const timer = useRef<number | undefined>(undefined);
  const el = useRef<HTMLDivElement>(null);
  const start = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => dismissToast(item.id), item.duration ?? 6000);
  };
  const pause = () => window.clearTimeout(timer.current);
  useEffect(() => {
    start();
    return pause;
  }, []);
  return (
    <div
      ref={el}
      class="toast"
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocusIn={pause}
      onFocusOut={(e) => { if (!el.current?.contains(e.relatedTarget as Node | null)) start(); }}
    >
      <p class="toast-message">{item.message}</p>
      {item.actionLabel && (
        <button type="button" class="toast-action" onClick={() => { item.onAction?.(); dismissToast(item.id); }}>
          {item.actionLabel}
        </button>
      )}
      <button type="button" class="icon-btn toast-close" aria-label={closeLabel} onClick={() => dismissToast(item.id)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Conteneur unique des toasts (à monter une fois dans l'app). Région nommée, popover="manual"
 * dans la couche supérieure, annonce via ariaNotify() sinon région live.
 */
export function ToastHost({ label, closeLabel }: { label: string; closeLabel: string }) {
  const host = useRef<HTMLDivElement>(null);
  const items = toasts.value;
  const hasAriaNotify = 'ariaNotify' in document.documentElement;

  useEffect(() => {
    const h = host.current;
    if (!h || typeof h.showPopover !== 'function') return;
    const shown = h.matches(':popover-open');
    if (items.length > 0 && !shown) h.showPopover();
    else if (items.length === 0 && shown) h.hidePopover();
  }, [items.length]);

  return (
    <>
      <div ref={host} class="toast-host" popover="manual" role="region" aria-label={label}>
        {items.map((t) => <ToastView key={t.id} item={t} closeLabel={closeLabel} />)}
      </div>
      {!hasAriaNotify && (
        <div class="visually-hidden" aria-live="polite" aria-atomic="true">
          {items.at(-1)?.message}
        </div>
      )}
    </>
  );
}

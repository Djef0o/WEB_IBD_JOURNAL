import './components.css';
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';

export interface DialogProps {
  open: boolean;
  /** Appelé à toute fermeture native (Échap, retour, clic extérieur, bouton) ; `returnValue` vient de <form method="dialog">. */
  onClose: (returnValue: string) => void;
  title: string;
  /** Libellé accessible du bouton de fermeture. */
  closeLabel: string;
  /** `sheet` : feuille en bas sous 600px, centré au-delà (défaut). `center` : toujours centré. */
  variant?: 'sheet' | 'center';
  /** Désactive la fermeture par clic extérieur (formulaire avec saisie non enregistrée). */
  lightDismiss?: boolean;
  children?: ComponentChildren;
}

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

function outside(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/**
 * <dialog> modal natif : Échap et geste/bouton retour (closedby), clic extérieur,
 * focus piégé et page inerte fournis par le navigateur ; le scroll de fond est bloqué en CSS.
 */
export function Dialog({ open, onClose, title, closeLabel, variant = 'sheet', lightDismiss = true, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  openRef.current = open;
  onCloseRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onNativeClose = () => {
      const value = d.returnValue;
      d.returnValue = '';
      if (openRef.current) onCloseRef.current(value);
    };
    d.addEventListener('close', onNativeClose);
    // Safari : pas de closedby, on reproduit le clic extérieur (press ET release à l'extérieur).
    let pressedOutside = false;
    const down = (e: PointerEvent) => { pressedOutside = outside(e, d); };
    const up = (e: PointerEvent) => { if (pressedOutside && outside(e, d)) (d.requestClose ? d.requestClose() : d.close()); };
    if (!supportsClosedBy && lightDismiss) {
      d.addEventListener('pointerdown', down);
      d.addEventListener('pointerup', up);
    }
    return () => {
      d.removeEventListener('close', onNativeClose);
      d.removeEventListener('pointerdown', down);
      d.removeEventListener('pointerup', up);
    };
  }, [lightDismiss]);

  // `closedby` n'est pas encore typé par Preact.
  const extra = { closedby: lightDismiss ? ('any' as const) : ('closerequest' as const) };

  return (
    <dialog ref={ref} class="dialog" data-variant={variant} aria-labelledby={titleId} {...extra}>
      {open && (
        <>
          <header class="dialog-header">
            <h2 id={titleId}>{title}</h2>
            <form method="dialog">
              <button class="icon-btn" aria-label={closeLabel}>
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </form>
          </header>
          <div class="dialog-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

/** Feuille modale : en bas de l'écran sur mobile, centrée sur grand écran. */
export function Sheet(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="sheet" />;
}

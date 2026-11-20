import './emergency.css';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../i18n';
import { ToiletIcon } from './icons';

/** Keeps the screen on while the card is displayed, where the browser allows it. */
function useScreenOn(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = (): void => {
      if (!active || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
      navigator.wakeLock.request('screen').then(
        (sentinel) => {
          if (active) lock = sentinel;
          else void sentinel.release();
        },
        () => undefined, // refused (battery saver…): the card still works
      );
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, []);
}

/**
 * Full-screen card to show to a stranger: neutral message, nothing personal. Fixed colors (not the
 * theme's) for maximum contrast; the screen stays on while it is displayed (`UrgentNeedCard`).
 */
export function UrgentCard({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useScreenOn();
  useEffect(() => close.current?.focus({ preventScroll: true }), []);

  return (
    <div class="urgent" role="dialog" aria-modal="true" aria-labelledby="urgent-title" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <span class="urgent-icon"><ToiletIcon size={96} /></span>
      <h1 id="urgent-title" class="urgent-title">{t('urgent_card_title')}</h1>
      <p class="urgent-text">{t('urgent_card_text')}</p>
      <button type="button" class="urgent-close" ref={close} onClick={onClose}>{t('close')}</button>
    </div>
  );
}

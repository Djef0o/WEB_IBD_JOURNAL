import './scanner.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Product } from '../domain/models';
import { t } from '../i18n';
import { Button } from '../ui/components';
import { TextField } from '../ui/forms';
import { createBarcodeReader, parseManualBarcode } from './detector';
import { lookupProduct } from './openFoodFacts';
import { ProductCard } from './ProductCard';

type Camera = 'starting' | 'live' | 'denied' | 'unavailable';
type Result =
  | { kind: 'waiting' }
  | { kind: 'scanning'; barcode: string }
  | { kind: 'found'; product: Product }
  | { kind: 'notFound'; barcode: string };

/** Pause between two frames analysed. */
const FRAME_INTERVAL_MS = 250;

export interface ScannerPanelProps {
  /** Pick the barcode (meal editor). Without it, the panel only shows the product (scan page). */
  onUse?(barcode: string): void;
}

/**
 * Camera preview (`getUserMedia`, back camera) with barcode reading, manual entry as an
 * alternative, then the Open Food Facts product. The camera is released when the panel unmounts.
 */
export function ScannerPanel({ onUse }: ScannerPanelProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>('starting');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result>({ kind: 'waiting' });
  const [manual, setManual] = useState('');
  const [manualAttempted, setManualAttempted] = useState(false);
  /** Code on screen or being looked up: the same code stays in frame, no new lookup per frame. */
  const current = useRef<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  const lookup = (barcode: string) => {
    if (current.current === barcode) return;
    current.current = barcode;
    aborter.current?.abort();
    const controller = new AbortController();
    aborter.current = controller;
    setResult({ kind: 'scanning', barcode });
    void lookupProduct(barcode, controller.signal).then((found) => {
      if (controller.signal.aborted) return;
      setResult(found.kind === 'found' ? { kind: 'found', product: found.product } : { kind: 'notFound', barcode });
    });
  };
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  useEffect(() => () => aborter.current?.abort(), []);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const release = () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (video.current) video.current.srcObject = null;
    };

    (async () => {
      setCamera('starting');
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
        return;
      }
      const element = video.current;
      if (stopped || !element) {
        release();
        return;
      }
      element.srcObject = stream;
      try {
        await element.play();
      } catch {
        /* autoplay refused: the stream still shows once the user interacts */
      }
      if (stopped) return;
      setCamera('live');

      let reader;
      try {
        reader = await createBarcodeReader();
      } catch {
        return; // no automatic reading: manual entry stays available
      }
      const tick = async () => {
        if (stopped) return;
        try {
          const code = await reader.read(element);
          if (code && !stopped) lookupRef.current(code);
        } catch {
          /* unreadable frame */
        }
        if (!stopped) timer = window.setTimeout(tick, FRAME_INTERVAL_MS);
      };
      void tick();
    })();

    return release;
  }, [attempt]);

  const submitManual = (event: Event) => {
    event.preventDefault();
    const barcode = parseManualBarcode(manual);
    if (!barcode) {
      setManualAttempted(true);
      return;
    }
    lookup(barcode);
  };

  const again = () => {
    current.current = null;
    setResult({ kind: 'waiting' });
  };

  return (
    <div class="scan">
      <div class="scan-camera">
        <video ref={video} muted playsInline autoPlay aria-label={t('scan_title')} />
        {camera === 'live' && <div class="scan-frame" aria-hidden="true" />}
        {camera === 'starting' && <div class="scan-message" role="status">{t('web_scan_starting')}</div>}
        {(camera === 'denied' || camera === 'unavailable') && (
          <div class="scan-message">
            <p role="alert">{camera === 'denied' ? t('web_scan_camera_denied') : t('web_scan_camera_unavailable')}</p>
            <Button variant="tonal" onClick={() => setAttempt((n) => n + 1)}>{t('web_scan_retry')}</Button>
          </div>
        )}
      </div>
      <p class="scan-hint">{t('scan_hint')}</p>

      <form class="scan-manual" onSubmit={submitManual} noValidate>
        <TextField
          label={t('web_scan_manual_label')}
          hint={t('web_scan_manual_hint')}
          value={manual}
          onInput={setManual}
          inputMode="numeric"
          autocomplete="off"
          error={parseManualBarcode(manual) ? null : t('web_scan_manual_invalid')}
          showError={manualAttempted}
        />
        <button type="submit" class="btn" data-variant="tonal">{t('web_scan_manual_submit')}</button>
      </form>

      <div class="scan-result" role="status" aria-live="polite">
        {result.kind === 'scanning' && <p>{t('scanning')}</p>}
        {result.kind === 'found' && (
          <>
            <h2>{t('product_found')}</h2>
            <ProductCard product={result.product} />
            <div class="scan-actions">
              {onUse ? (
                <Button onClick={() => onUse(result.product.barcode)}>{t('use_product')}</Button>
              ) : (
                <Button variant="tonal" onClick={again}>{t('web_scan_again')}</Button>
              )}
            </div>
          </>
        )}
        {result.kind === 'notFound' && (
          <>
            <p>{t('product_not_found')}</p>
            <p class="scan-barcode">{result.barcode}</p>
            <div class="scan-actions">
              {onUse ? (
                <Button variant="outlined" onClick={() => onUse(result.barcode)}>{t('use_barcode_anyway')}</Button>
              ) : (
                <Button variant="tonal" onClick={again}>{t('web_scan_again')}</Button>
              )}
            </div>
          </>
        )}
      </div>
      <p class="scan-privacy">{t('web_scan_privacy')}</p>
    </div>
  );
}

/*
 * Barcode reading of a camera frame: the browser's `BarcodeDetector` when it supports food
 * barcodes, otherwise ZXing (WebAssembly), loaded on demand. The wasm file is served from our
 * own origin (the default is a CDN, which the CSP forbids) and needs `'wasm-unsafe-eval'`.
 */

/** Food barcodes read by `BarcodeAnalyzer.kt`: EAN-13, EAN-8, UPC-A, UPC-E. */
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export interface BarcodeReader {
  readonly engine: 'native' | 'wasm';
  /** Text of the barcode visible in the current video frame, or null. */
  read(video: HTMLVideoElement): Promise<string | null>;
}

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface NativeDetectorConstructor {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

async function createNativeReader(): Promise<BarcodeReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const supported = await Detector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
    if (formats.length === 0) return null;
    const detector = new Detector({ formats });
    return {
      engine: 'native',
      async read(video) {
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      },
    };
  } catch {
    return null;
  }
}

/** Frames are downscaled: barcode decoding does not need more than this width. */
const WASM_FRAME_WIDTH = 800;

async function createWasmReader(): Promise<BarcodeReader> {
  const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
    fireImmediately: true,
  });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  return {
    engine: 'wasm',
    async read(video) {
      if (video.videoWidth === 0) return null;
      const scale = Math.min(1, WASM_FRAME_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const results = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), {
        formats: ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'],
        tryHarder: true,
        tryRotate: true,
        maxNumberOfSymbols: 1,
      });
      return results.find((r) => r.isValid)?.text ?? null;
    },
  };
}

export async function createBarcodeReader(): Promise<BarcodeReader> {
  return (await createNativeReader()) ?? createWasmReader();
}

/**
 * Barcode typed by hand: spaces and dashes are ignored; 8 to 14 digits (EAN-8 to GTIN-14).
 * Null if it is not one.
 */
export function parseManualBarcode(text: string): string | null {
  const digits = text.replace(/[\s-]/g, '');
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

import type { TextLine } from '../domain/labReportParser';
import workerSource from './pdfText.worker.ts?worker&url';
import type { ReadRequest, ReadResponse } from './pdfWorkerProtocol';

/** PDF without usable text: scanned or protected document (`NoTextLayerException`). */
export class NoTextLayerError extends Error {
  constructor() {
    super('No text layer');
    this.name = 'NoTextLayerError';
  }
}

export interface PdfReader {
  /** Text lines of the PDF, positioned in points. Throws `NoTextLayerError` if there is none. */
  read(file: Blob): Promise<TextLine[]>;
  /** Stops the worker; pending reads are rejected. */
  close(): void;
}

/**
 * `new Worker(url)` is a Trusted Types sink (`require-trusted-types-for 'script'`): the only
 * URL we ever pass is our own bundled worker, checked to be same-origin. The policy is created
 * once (a name can be registered only once under a restrictive `trusted-types` directive).
 */
let workerPolicy: TrustedTypePolicy | null = null;
function trustedWorkerUrl(url: URL): string | TrustedScriptURL {
  const types = (globalThis as { trustedTypes?: TrustedTypePolicyFactory }).trustedTypes;
  if (!types) return url.href;
  workerPolicy ??= types.createPolicy('ibdj-pdf-worker', {
    createScriptURL: (value: string) => {
      if (new URL(value, location.href).origin !== location.origin) throw new TypeError('Cross-origin worker');
      return value;
    },
  });
  return workerPolicy.createScriptURL(url.href);
}

/**
 * Reader backed by one Web Worker (pdf.js, loaded on demand: the chunk is only fetched when the
 * first document is read). One document at a time.
 */
export function createPdfReader(): PdfReader {
  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, { resolve: (lines: TextLine[]) => void; reject: (error: Error) => void }>();

  const failAll = (error: Error) => {
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  function start(): Worker {
    if (worker) return worker;
    const created = new Worker(trustedWorkerUrl(new URL(workerSource, location.href)) as string, { type: 'module' });
    created.onmessage = (event: MessageEvent<ReadResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok && response.lines.length > 0) entry.resolve(response.lines);
      else entry.reject(response.ok ? new NoTextLayerError() : new Error('PDF unreadable'));
    };
    created.onerror = () => failAll(new Error('PDF worker failed'));
    worker = created;
    return created;
  }

  return {
    async read(file) {
      const data = await file.arrayBuffer();
      const id = nextId++;
      const target = start();
      return new Promise<TextLine[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const request: ReadRequest = { id, data };
        target.postMessage(request, [data]);
      });
    },
    close() {
      worker?.terminate();
      worker = null;
      failAll(new Error('Cancelled'));
    },
  };
}

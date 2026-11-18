/*
 * Reads the text of a PDF with its position, in a Web Worker and without any network access.
 * pdf.js runs inside this worker (its own parser is loaded as a "fake worker" through
 * `globalThis.pdfjsWorker`), so no second worker file and no `eval` are needed.
 */
import { getDocument, Util } from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { TextLine } from '../domain/labReportParser';
import { pageLines, type PdfTextItem } from './pdfLines';
import { MAX_PAGES, type ReadRequest, type ReadResponse } from './pdfWorkerProtocol';

async function readLines(data: ArrayBuffer): Promise<TextLine[]> {
  const task = getDocument({ data: new Uint8Array(data), verbosity: 0 });
  const document = await task.promise;
  try {
    const lines: TextLine[] = [];
    const pages = Math.min(document.numPages, MAX_PAGES);
    for (let number = 1; number <= pages; number++) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue; // marked-content markers
        const run = item as TextItem;
        // Page space → top-left origin, in points.
        const m = Util.transform(viewport.transform, run.transform);
        items.push({
          str: run.str,
          x: m[4]!,
          baseline: m[5]!,
          width: run.width * viewport.scale,
          fontSize: Math.hypot(m[2]!, m[3]!),
        });
      }
      lines.push(...pageLines(items, number - 1));
      page.cleanup();
    }
    return lines;
  } finally {
    await task.destroy();
  }
}

self.onmessage = (event: MessageEvent<ReadRequest>) => {
  const { id, data } = event.data;
  readLines(data).then(
    (lines): ReadResponse => ({ id, ok: true, lines }),
    (): ReadResponse => ({ id, ok: false }),
  ).then((response) => self.postMessage(response));
};

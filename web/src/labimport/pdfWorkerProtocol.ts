import type { TextLine } from '../domain/labReportParser';

/** Results come first; beyond that, it is legal notices and comments (`LabReportReader.MAX_PAGES`). */
export const MAX_PAGES = 8;

export interface ReadRequest {
  id: number;
  data: ArrayBuffer;
}

export type ReadResponse =
  | { id: number; ok: true; lines: TextLine[] }
  | { id: number; ok: false };

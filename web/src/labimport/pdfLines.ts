import type { TextLine } from '../domain/labReportParser';

/**
 * Text run of a PDF page, in points with the origin at the top left (the convention of the
 * `TextLine`s of `LabReportReader.kt`). `baseline` is the y of the text baseline.
 */
export interface PdfTextItem {
  str: string;
  x: number;
  baseline: number;
  /** Advance width of the whole run. */
  width: number;
  fontSize: number;
}

/** Baselines less than 2 points apart: same line (`PositionedTextStripper.BASELINE_TOLERANCE`). */
const BASELINE_TOLERANCE = 2;
/** A gap above 0.3 character widths separates two words. */
const WORD_GAP = 0.3;
/** A gap above 2 character widths starts a new column chunk. */
const COLUMN_GAP = 2;
/** Height of a glyph box, as a fraction of the font size (cap height order of magnitude). */
const GLYPH_HEIGHT = 0.72;
/** Width of a space, as a fraction of the font size. */
const SPACE_WIDTH = 0.28;

interface Piece {
  text: string;
  left: number;
  right: number;
  baseline: number;
  top: number;
  fontSize: number;
}

/** Reference width of a character: half the font size, otherwise one point. */
const charWidth = (piece: Piece): number => (piece.fontSize * 0.5 > 0 ? piece.fontSize * 0.5 : 1);

/** Visible text of a run: blanks collapsed, the edges measured without their spaces. */
function toPiece(item: PdfTextItem): Piece | null {
  // Greek mu (U+03BC, as pdf.js returns it) → micro sign (U+00B5, the unit "µg/L" the parser knows).
  const collapsed = item.str.replace(/\u03BC/g, '\u00B5').replace(/\s+/g, ' ');
  const text = collapsed.trim();
  if (text === '') return null;
  const average = collapsed.length > 0 ? item.width / collapsed.length : 0;
  const space = Math.min(average, SPACE_WIDTH * item.fontSize);
  const leading = collapsed.startsWith(' ') ? space : 0;
  const trailing = collapsed.endsWith(' ') ? space : 0;
  return {
    text,
    left: item.x + leading,
    right: item.x + item.width - trailing,
    baseline: item.baseline,
    top: item.baseline - GLYPH_HEIGHT * item.fontSize,
    fontSize: item.fontSize,
  };
}

/**
 * Groups the text runs of a page into line chunks, like table columns: same baseline, and a
 * horizontal gap of more than two character widths starts a new chunk (label, result, unit,
 * references, previous value). Same rules as `PositionedTextStripper` (PDFBox), applied to
 * runs instead of single glyphs. `page` is 0-based.
 */
export function pageLines(items: readonly PdfTextItem[], page: number): TextLine[] {
  const pieces = items.map(toPiece).filter((piece): piece is Piece => piece !== null);
  pieces.sort((a, b) => a.baseline - b.baseline);
  // Rows: runs whose baseline is within the tolerance of the row's first one (fixed thresholds
  // would split a line straddling two).
  const rows: Piece[][] = [];
  for (const piece of pieces) {
    const row = rows[rows.length - 1];
    if (row && piece.baseline - row[0]!.baseline <= BASELINE_TOLERANCE) row.push(piece);
    else rows.push([piece]);
  }
  return rows.flatMap((row) => chunks(row.sort((a, b) => a.left - b.left), page));
}

function chunks(row: readonly Piece[], page: number): TextLine[] {
  const result: TextLine[] = [];
  let current: Piece[] = [];
  const flush = () => {
    if (current.length > 0) result.push(toLine(current, page));
    current = [];
  };
  for (const piece of row) {
    const previous = current[current.length - 1];
    if (previous && piece.left - previous.right > COLUMN_GAP * charWidth(previous)) flush();
    current.push(piece);
  }
  flush();
  return result;
}

function toLine(chunk: readonly Piece[], page: number): TextLine {
  let text = '';
  chunk.forEach((piece, index) => {
    if (index > 0) {
      const previous = chunk[index - 1]!;
      if (piece.left - previous.right > WORD_GAP * charWidth(previous)) text += ' ';
    }
    text += piece.text;
  });
  return {
    text,
    left: chunk[0]!.left,
    top: Math.min(...chunk.map((piece) => piece.top)),
    right: chunk[chunk.length - 1]!.right,
    bottom: Math.max(...chunk.map((piece) => piece.baseline)),
    page,
  };
}

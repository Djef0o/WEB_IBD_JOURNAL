/*
 * Pure logic of the lab results screen (`LabResultsUi.kt`): grouping, number entry, chart and
 * table models. No DOM, no translation.
 */
import { LAB_TESTS, labTestCategory, type LabCategory, type LabResult, type LabTest } from '../../domain/health';
import type { ReferenceRange } from '../../domain/labReference';
import { plusMonths, toEpochDays, type LocalDate } from '../../domain/time';

const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function parseNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!DECIMAL.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Accepts the comma as well as the dot, whatever the keyboard; null if not a positive number. */
export function parseLabValue(text: string): number | null {
  const value = parseNumber(text);
  return value !== null && value > 0 ? value : null;
}

/** Lab bound: zero allowed ("0 – 5"); null if not a positive or zero number. */
export function parseLabBound(text: string): number | null {
  const value = parseNumber(text);
  return value !== null && value >= 0 ? value : null;
}

/** Most recent first; on equal dates, the last entered. */
export function newestFirst(a: LabResult, b: LabResult): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
}

/** History per test, from most recent to oldest, in test order (`labHistories`). */
export function labHistories(results: readonly LabResult[]): Map<LabTest, LabResult[]> {
  const byTest = new Map<LabTest, LabResult[]>();
  for (const result of results) {
    const list = byTest.get(result.test);
    if (list) list.push(result);
    else byTest.set(result.test, [result]);
  }
  const sorted = new Map<LabTest, LabResult[]>();
  for (const test of LAB_TESTS) {
    const history = byTest.get(test);
    if (history) sorted.set(test, history.sort(newestFirst));
  }
  return sorted;
}

/**
 * Relative x-position (0..1) proportional to elapsed time; a single point is centered,
 * all-equal dates are spread out. `points` in chronological order.
 */
export function timeFraction(points: readonly LabResult[], index: number): number {
  if (points.length === 1) return 0.5;
  const first = toEpochDays(points[0]!.date);
  const span = toEpochDays(points[points.length - 1]!.date) - first;
  if (span === 0) return index / (points.length - 1);
  return (toEpochDays(points[index]!.date) - first) / span;
}

// --- Test list ---

/** Number of results plotted in each test's small chart. */
export const SPARKLINE_POINTS = 8;

export interface LabGroup {
  /** `null`: the "outside the lab's reference values" group. */
  category: LabCategory | null;
  entries: { test: LabTest; history: LabResult[] }[];
}

/**
 * Tests outside the lab's reference values first, then the others grouped by category,
 * in test order; an empty group is omitted.
 */
export function groupTests(histories: ReadonlyMap<LabTest, LabResult[]>, statusOf: (r: LabResult) => unknown): LabGroup[] {
  const outside: LabGroup = { category: null, entries: [] };
  const byCategory = new Map<LabCategory, LabGroup>();
  for (const [test, history] of histories) {
    const entry = { test, history };
    if (statusOf(history[0]!) !== null) {
      outside.entries.push(entry);
      continue;
    }
    const category = labTestCategory(test);
    const group = byCategory.get(category) ?? { category, entries: [] };
    group.entries.push(entry);
    byCategory.set(category, group);
  }
  const order = [...new Set(LAB_TESTS.map(labTestCategory))];
  const groups = [outside, ...order.map((category) => byCategory.get(category))];
  return groups.filter((group): group is LabGroup => group !== undefined && group.entries.length > 0);
}

// --- Panel table ---

export interface PanelTable {
  /** Collection dates, most recent first. */
  dates: LocalDate[];
  groups: { category: LabCategory; tests: LabTest[] }[];
  /** One result per test and per date: the last entered. */
  cell(test: LabTest, date: LocalDate): LabResult | undefined;
}

export function panelTable(histories: ReadonlyMap<LabTest, LabResult[]>): PanelTable {
  const dates = [...new Set([...histories.values()].flat().map((r) => r.date))].sort().reverse();
  const groupMap = new Map<LabCategory, LabTest[]>();
  const cells = new Map<LabTest, Map<LocalDate, LabResult>>();
  for (const [test, history] of histories) {
    const category = labTestCategory(test);
    const tests = groupMap.get(category);
    if (tests) tests.push(test);
    else groupMap.set(category, [test]);
    const byDate = new Map<LocalDate, LabResult>();
    for (const result of history) if (!byDate.has(result.date)) byDate.set(result.date, result); // history: last entered first
    cells.set(test, byDate);
  }
  const order = [...new Set(LAB_TESTS.map(labTestCategory))];
  return {
    dates,
    groups: order.flatMap((category) => {
      const tests = groupMap.get(category);
      return tests ? [{ category, tests }] : [];
    }),
    cell: (test, date) => cells.get(test)?.get(date),
  };
}

// --- Detail chart ---

/** Chart window; `months` null = whole history. */
export const LAB_PERIODS = [
  { id: '6m', months: 6 },
  { id: '1y', months: 12 },
  { id: 'all', months: null },
] as const;
export type LabPeriodId = (typeof LAB_PERIODS)[number]['id'];

/** Results of each window, in chronological order. `history` from most recent to oldest. */
export function resultsByPeriod(history: readonly LabResult[], today: LocalDate): Record<LabPeriodId, LabResult[]> {
  const chronological = [...history].reverse();
  const out = {} as Record<LabPeriodId, LabResult[]>;
  for (const period of LAB_PERIODS) {
    out[period.id] = period.months === null
      ? chronological
      : chronological.filter((r) => r.date >= plusMonths(today, -period.months));
  }
  return out;
}

export interface ChartPointModel {
  result: LabResult;
  x: number;
  y: number;
  /** Outside the lab's reference values. */
  outside: boolean;
  /** Threshold ("< 1"): drawn hollow. */
  hollow: boolean;
}

export interface ChartModel {
  min: number;
  max: number;
  points: ChartPointModel[];
  /** Band of the lab's reference values, y bounds; null without reference values. */
  band: { top: number; bottom: number } | null;
  yMax: number;
  yMin: number;
  /** SVG path of the line (empty for a single point). */
  path: string;
}

export interface ChartBox {
  /** Plot area, in pixels. */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Value chart, x-positions proportional to elapsed time, over the band of the lab's reference
 * values if any. The vertical axis spans values and bounds; without a lower bound (CRP), it
 * starts at zero. `points` in chronological order, non-empty.
 */
export function buildChart(
  points: readonly LabResult[],
  reference: ReferenceRange | null,
  box: ChartBox,
  isOutside: (r: LabResult) => boolean,
): ChartModel {
  const low = reference?.low ?? null;
  const high = reference?.high ?? null;
  const valuesMin = Math.min(...points.map((p) => p.value));
  const min = low !== null ? Math.min(valuesMin, low) : high !== null ? 0 : valuesMin;
  const max = Math.max(...points.map((p) => p.value), ...(low !== null ? [low] : []), ...(high !== null ? [high] : []));
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const x = (index: number) => box.left + width * timeFraction(points, index);
  const y = (value: number) => (max === min ? box.top + height / 2 : box.top + height * ((max - value) / (max - min)));
  const models = points.map((result, index) => ({
    result, x: x(index), y: y(result.value), outside: isOutside(result), hollow: result.qualifier !== 'EXACT',
  }));
  const band = low !== null || high !== null
    ? { top: high !== null ? y(high) : box.top, bottom: low !== null ? y(low) : box.bottom }
    : null;
  const round = (n: number) => Math.round(n * 100) / 100;
  const path = models.length > 1
    ? models.map((p, i) => `${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`).join(' ')
    : '';
  return { min, max, points: models, band, yMax: y(max), yMin: y(min), path };
}

/** Sparkline path in a `width × height` box with `pad` around; last point is returned as well. */
export function sparkline(
  points: readonly LabResult[], width: number, height: number, pad: number,
): { path: string; last: { x: number; y: number } } | null {
  if (points.length === 0) return null;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  const at = (i: number) => ({
    x: pad + w * timeFraction(points, i),
    y: max === min ? height / 2 : pad + h * ((max - points[i]!.value) / (max - min)),
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  const coords = points.map((_, i) => at(i));
  const path = points.length > 1 ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${round(c.x)} ${round(c.y)}`).join(' ') : '';
  return { path, last: coords[coords.length - 1]! };
}

import type { LabQualifier, LabTest } from './health';
import { localDate, type LocalDate } from './time';

/**
 * Line of text read from a PDF report, with its position on the page (points, origin at the
 * top left). Reports are tables: label, result, unit, reference values and
 * previous results are separate lines aligned horizontally.
 */
export interface TextLine {
  text: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  page: number;
}

export function textLine(
  text: string, left: number, top: number, right: number, bottom: number, page = 0,
): TextLine {
  return { text, left, top, right, bottom, page };
}

/**
 * Detected value, converted to the app's unit (`labTestUnit`). `qualifier`: result
 * given as a threshold ("<1,0"). `unitFound`: unit read on the report, null if absent
 * (the app's unit is then assumed). `referenceLow`/`referenceHigh`: laboratory reference
 * values, converted like the value; null if absent.
 */
export interface DetectedLabValue {
  test: LabTest;
  value: number;
  qualifier: LabQualifier;
  unitFound: string | null;
  sourceText: string;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface LabReportScan {
  sampleDate: LocalDate | null;
  values: DetectedLabValue[];
}

/** Kotlin `kotlin.math.round`: halves go to the even neighbor (not `Math.round`). */
function rint(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

const round3 = (x: number) => rint(x * 1000) / 1000;

/** Kotlin computes positions in 32-bit floats. */
const f32 = Math.fround;

/**
 * Finds the analyses of the lab test catalog on a laboratory report.
 *
 * Rules, established on real reports:
 * - an analysis is recognized only if its label **starts** a table line, which
 *   rules out comments ("… si la ferritine est normale …") and false friends
 *   ("Préalbumine", "Hémoglobine glyquée", "Créatinine urinaire");
 * - the result is the first number to the right of the label whose unit suits the analysis
 *   (the white-cell differential gives the % before the absolute value); reference values
 *   and previous results are printed after;
 * - the unit read is converted to the app's; an unknown unit discards the value
 *   rather than recording a wrong figure;
 * - the date used is the sampling date, not the issue date.
 *
 * The result is a suggestion: the user checks it before any save.
 */
export function parseLabReport(lines: TextLine[]): LabReportScan {
  const pages = new Map<number, TextLine[]>();
  for (const line of lines) {
    const page = pages.get(line.page);
    if (page) page.push(line); else pages.set(line.page, [line]);
  }
  const rows = [...pages.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, pageLines]) => pageRows(pageLines));
  const found = new Map<LabTest, DetectedLabValue>();
  for (const row of rows) {
    const label = normalize(row[0]!.text);
    let test: LabTest | null = null;
    let labelLength = 0;
    for (const matcher of LABELS) {
      const length = matcher.match(label);
      if (length !== null) {
        test = matcher.test;
        labelLength = length;
        break;
      }
    }
    if (test === null) continue;
    if (found.has(test)) continue; // first occurrence: later pages sometimes repeat the previous results
    const detected = detectValue(test, row, labelLength);
    if (detected) found.set(test, detected);
  }
  return { sampleDate: sampleDate(rows), values: [...found.values()] };
}

// --- Rows ---

const centerOf = (line: TextLine) => f32(f32(line.top + line.bottom) / 2);

/** Groups horizontally aligned lines, top to bottom then left to right. */
function pageRows(lines: TextLine[]): TextLine[][] {
  const rows: TextLine[][] = [];
  const byCenter = lines.map((line) => ({ line, center: centerOf(line) })).sort((a, b) => a.center - b.center);
  for (const { line, center } of byCenter) {
    const current = rows[rows.length - 1];
    if (current) {
      const reference = current[0]!;
      const tolerance = f32(f32(reference.bottom - reference.top) * f32(0.6));
      if (Math.abs(f32(center - centerOf(reference))) <= tolerance) {
        current.push(line);
        continue;
      }
    }
    rows.push([line]);
  }
  return rows.map((row) => row.sort((a, b) => a.left - b.left));
}

// --- Labels ---

class LabelMatcher {
  private readonly compactPrefixes: string[];

  constructor(
    readonly test: LabTest,
    prefixes: string[],
    private readonly excluded: string[] = [],
  ) {
    this.compactPrefixes = prefixes.map((p) => p.replaceAll(' ', ''));
  }

  /**
   * Length of the label recognized at the start of `normalizedLabel`, or null. Spaces are
   * ignored: OCR often glues words together ("Protéine Créactive" on a real report).
   */
  match(normalizedLabel: string): number | null {
    if (this.excluded.some((word) => normalizedLabel.includes(word))) return null;
    for (const prefix of this.compactPrefixes) {
      const end = endOfPrefix(normalizedLabel, prefix);
      if (end === null) continue;
      if (end === normalizedLabel.length || !/[\p{L}\p{N}]/u.test(normalizedLabel[end]!)) return end;
    }
    return null;
  }
}

/** Position following `compactPrefix` in `text`, skipping spaces, or null. */
function endOfPrefix(text: string, compactPrefix: string): number | null {
  let matched = 0;
  let index = 0;
  while (matched < compactPrefix.length) {
    if (index >= text.length) return null;
    const char = text[index++]!;
    if (char === ' ') continue;
    if (char !== compactPrefix[matched++]) return null;
  }
  return index;
}

/** Urine assays with the same name as blood assays ("Créatinine urinaire"). */
const URINE = ['urin'];

/**
 * Recognized labels, per analysis. Order matters: the first match wins
 * ("cholestérol HDL" before plain "cholestérol").
 */
const LABELS: LabelMatcher[] = [
  new LabelMatcher('CRP', ['proteine c reactive', 'proteine c-reactive', 'crp', 'c reactive protein', 'c-reactive protein']),
  new LabelMatcher('CALPROTECTIN', ['calprotectine', 'calprotectin']),

  new LabelMatcher('RED_BLOOD_CELLS', ['hematies', 'globules rouges', 'erythrocytes'], URINE),
  new LabelMatcher('HEMOGLOBIN', ['hemoglobine', 'hb'], ['glyq', 'a1c', 'corpusc']),
  new LabelMatcher('HEMATOCRIT', ['hematocrite']),
  new LabelMatcher('MCV', ['v.g.m', 'vgm', 'volume globulaire moyen']),
  new LabelMatcher('MCH', ['t.c.m.h', 'tcmh', 'teneur corpusculaire moyenne']),
  new LabelMatcher('MCHC', ['c.c.m.h', 'ccmh', 'concentration corpusculaire moyenne']),
  new LabelMatcher('WHITE_BLOOD_CELLS', ['leucocytes', 'globules blancs'], URINE),
  new LabelMatcher('NEUTROPHILS', ['poly. neutrophiles', 'polynucleaires neutrophiles', 'neutrophiles']),
  new LabelMatcher('LYMPHOCYTES', ['lymphocytes']),
  new LabelMatcher('MONOCYTES', ['monocytes']),
  new LabelMatcher('EOSINOPHILS', ['poly. eosinophiles', 'polynucleaires eosinophiles', 'eosinophiles']),
  new LabelMatcher('BASOPHILS', ['poly. basophiles', 'polynucleaires basophiles', 'basophiles']),
  new LabelMatcher('PLATELETS', ['plaquettes', 'numeration plaquettaire']),

  new LabelMatcher('FERRITIN', ['ferritine', 'ferritinemie']),
  new LabelMatcher('IRON', ['fer serique', 'sideremie', 'fer']),
  new LabelMatcher('TRANSFERRIN', ['transferrine'], ['saturation', 'coefficient']),
  new LabelMatcher('IRON_BINDING_CAPACITY', ['capacite totale de fixation', 'ctf']),
  new LabelMatcher('TRANSFERRIN_SATURATION', ['coefficient de saturation', 'saturation de la transferrine', 'cst']),

  new LabelMatcher('CREATININE', ['creatinine', 'creatininemie'], [...URINE, 'clairance']),
  new LabelMatcher('EGFR', ['debit de filtration', 'dfg']),
  new LabelMatcher('SODIUM', ['sodium', 'natremie'], URINE),
  new LabelMatcher('POTASSIUM', ['potassium', 'kaliemie'], URINE),
  new LabelMatcher('CHLORIDE', ['chlore', 'chlorure', 'chloremie'], URINE),
  new LabelMatcher('CALCIUM', ['calcium', 'calcemie'], [...URINE, 'ionis', 'corrig']),
  new LabelMatcher('URINE_PROTEIN', ['proteines totales urinaires', 'proteinurie']),

  new LabelMatcher('AST', ['transaminases tgo', 'transaminases asat', 'asat', 'sgot', 'tgo', 'aspartate aminotransferase']),
  new LabelMatcher('ALT', ['transaminases tgp', 'transaminases alat', 'alat', 'sgpt', 'tgp', 'alanine aminotransferase']),
  new LabelMatcher('GGT', ['gamma gt', 'gamma-gt', 'gamma glutamyltransferase', 'gamma-glutamyltransferase', 'ggt', 'g.g.t']),
  new LabelMatcher('ALKALINE_PHOSPHATASE', ['phosphatases alcalines', 'phosphatase alcaline', 'pal']),
  new LabelMatcher('BILIRUBIN_TOTAL', ['bilirubine totale']),
  new LabelMatcher('BILIRUBIN_DIRECT', ['bilirubine directe', 'bilirubine conjuguee']),
  new LabelMatcher('BILIRUBIN_INDIRECT', ['bilirubine indirecte', 'bilirubine libre', 'bilirubine non conjuguee']),

  new LabelMatcher('GLUCOSE', ['glycemie', 'glucose', 'glucosemie'], URINE),
  new LabelMatcher('CHOLESTEROL_HDL', ['cholesterol hdl', 'cholesterol-hdl', 'hdl cholesterol', 'hdl-cholesterol', 'hdl']),
  new LabelMatcher('CHOLESTEROL_LDL', ['cholesterol ldl', 'cholesterol-ldl', 'ldl cholesterol', 'ldl-cholesterol', 'ldl']),
  new LabelMatcher('CHOLESTEROL_TOTAL', ['cholesterol total', 'cholesterol']),
  new LabelMatcher('TRIGLYCERIDES', ['triglycerides']),

  new LabelMatcher('VITAMIN_D', ['vitamine d', '25 oh', '25-oh', '25(oh)', '25 hydroxy', '25-hydroxy']),
  new LabelMatcher('ALBUMIN', ['albumine', 'albuminemie'], ['urin', 'ratio']),

  new LabelMatcher('PROTHROMBIN_TIME', ['taux de prothrombine']),
  new LabelMatcher('PSA', ['psa total', 'psa', 'antigene prostatique']),
];

const ACCENTS: Readonly<Record<string, string>> = {
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  à: 'a', â: 'a', ä: 'a',
  î: 'i', ï: 'i', ô: 'o', ö: 'o',
  ù: 'u', û: 'u', ü: 'u', ç: 'c',
};

/** Lowercase without accents, simplified spaces: labels vary from one laboratory to another. */
function normalize(text: string): string {
  let out = '';
  for (const char of text.trim().toLowerCase()) out += ACCENTS[char] ?? char;
  return out.replace(/\s+/g, ' ');
}

// --- Values and units ---

/**
 * Number possibly preceded by a threshold ("<1,0", "> 300"), comma or dot decimal.
 * It must not stick to a letter: "D2+D3" or "25-OH" are not results, nor
 * be a piece of a number ("1" of "1,73m2").
 */
const NUMBER = /(?<![A-Za-zÀ-ÿ0-9.,])([<>≤≥]=?)?\s*(\d+(?:[.,]\d+)?)(?![A-Za-zÀ-ÿ0-9]|[.,]\d)/;

/** All non-overlapping matches (`Regex.findAll`). */
function findAll(re: RegExp, text: string): RegExpExecArray[] {
  return [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))] as RegExpExecArray[];
}

/** Number read on the row; `factor` null = no unit printed right after. */
interface Candidate {
  match: RegExpExecArray;
  number: number;
  unit: string | null;
  factor: number | null;
  afterUnit: string;
}

function detectValue(test: LabTest, row: TextLine[], labelLength: number): DetectedLabValue | null {
  // Text to the right of the label: the following columns, or the rest of the line if OCR
  // merged label and result ("Hémoglobine 16,1 g/dL").
  const afterLabel = row.length > 1
    ? row.slice(1).map((l) => l.text).join('  ')
    : row[0]!.text.trim().slice(labelLength);

  // The number chosen is the first followed by a unit valid for the analysis: the
  // white-cell differential prints the percentage before the absolute value ("46,6 % soit 2,84 Giga/L")
  // and OCR sometimes loses the "%".
  const candidates: Candidate[] = [];
  for (const match of findAll(NUMBER, afterLabel)) {
    const number = Number((match[2] ?? '').replace(',', '.'));
    if (Number.isNaN(number)) continue;
    const rest = afterLabel.slice(match.index + match[0].length);
    const unitMatch = LEADING_UNIT.exec(rest);
    const unitFound = unitMatch ? unitMatch[1]! : null;
    let factor: number | null = null;
    if (unitFound !== null) {
      factor = conversionFactor(test, unitFound);
      if (factor === null) continue;
    }
    const afterUnit = unitMatch ? rest.slice(unitMatch[0].length) : rest;
    candidates.push({ match, number, unit: unitFound, factor, afterUnit });
  }
  const chosen = candidates.find((c) => c.factor !== null) ?? unitlessResult(test, afterLabel, candidates);
  if (!chosen) return null;
  const factor = chosen.factor ?? 1.0;
  const value = round3(chosen.number * factor);
  const [min, max] = plausible(test);
  const inRange = (v: number) => v >= min && v <= max;
  if (!inRange(value)) return null;
  const parsed = referenceRange(chosen.afterUnit, factor);
  const reference = parsed && (parsed[0] === null || inRange(parsed[0])) && (parsed[1] === null || inRange(parsed[1]))
    ? parsed
    : null;
  const sign = (chosen.match[1] ?? '').slice(0, 1);
  return {
    test,
    value,
    qualifier: sign === '<' || sign === '≤' ? 'BELOW' : sign === '>' || sign === '≥' ? 'ABOVE' : 'EXACT',
    unitFound: chosen.unit,
    sourceText: row.map((l) => l.text).join('  '),
    referenceLow: reference ? reference[0] : null,
    referenceHigh: reference ? reference[1] : null,
  };
}

/**
 * Result whose unit OCR lost: only a number from the results column, hence
 * printed before the unit and before the references ("70-180", "> 60") when they are read,
 * and not a previous result ("105 Le 17.08.2024"). Otherwise nothing is suggested: a reference
 * or previous result mistaken for the result would be a wrong value.
 */
function unitlessResult(test: LabTest, text: string, candidates: Candidate[]): Candidate | undefined {
  const unitStart = findAll(ANY_UNIT, text).find((m) => conversionFactor(test, m[0]) !== null)?.index;
  const starts = [INTERVAL.exec(text)?.index, THRESHOLD.exec(text)?.index, unitStart]
    .filter((s): s is number => s !== undefined);
  const columnEnd = starts.length > 0 ? Math.min(...starts) : text.length;
  return candidates.find((candidate) => {
    // Position of the first digit: the match starts at the spaces preceding it.
    const digitStart = candidate.match.index + candidate.match[0].indexOf(candidate.match[2]!);
    return candidate.factor === null && digitStart < columnEnd && !PREVIOUS_RESULT.test(candidate.afterUnit);
  });
}

/** Previous result: value followed by the date of the previous panel. */
const PREVIOUS_RESULT = /^\s*le\s+\d/i;

/**
 * First reference printed after the result: interval "13,4 - 16,7" or threshold "< 5,0".
 * Previous results come next, without dash or sign: they are not mistaken for it.
 */
function referenceRange(text: string, factor: number): [number | null, number | null] | null {
  const interval = INTERVAL.exec(text);
  const threshold = THRESHOLD.exec(text);
  const number = (raw: string): number | null => {
    const parsed = Number(raw.replaceAll(' ', '').replace(',', '.'));
    return raw.trim() === '' || Number.isNaN(parsed) ? null : round3(parsed * factor);
  };
  if (interval && (!threshold || interval.index <= threshold.index)) {
    const low = number(interval[1]!);
    const high = number(interval[2]!);
    if (low === null || high === null) return null;
    return low < high ? [low, high] : null;
  }
  if (threshold) {
    const bound = number(threshold[2]!);
    if (bound === null) return null;
    return '<≤'.includes(threshold[1]!.charAt(0)) ? [null, bound] : [bound, null];
  }
  return null;
}

/** Number of a reference; OCR sometimes inserts a space after the comma ("0, 10"). */
const DECIMAL = String.raw`\d+(?:[.,] ?\d+)?`;
const INTERVAL = new RegExp(String.raw`(?<![A-Za-zÀ-ÿ0-9.,])(${DECIMAL})\s*(?:-|–|à|a)\s*(${DECIMAL})(?![0-9])`);
const THRESHOLD = new RegExp(String.raw`([<>≤≥]=?)\s*(${DECIMAL})(?![0-9])`);

/** Recognized units, longest first ("giga/l" before "g/l"). */
const UNITS =
  String.raw`(?:ml/mi?n/1[.,]73\s?m[2²]|giga/l|tera/l|10\^?9/l|10\^?12/l|mmol/l|[µu]mol/l|nmol/l|pmol/l|` +
  String.raw`meq/l|mg/dl|mg/l|[µu]g/dl|[µu]g/l|ng/ml|[µu]g/g|mg/kg|g/dl|g/l|ui/l|u/l|fl|[µu]m3|pg|t/l|l/l|` +
  String.raw`/mm3|/[µu]l|%)(?![a-z0-9µ])`;

/** Unit printed right after the result. */
const LEADING_UNIT = new RegExp(String.raw`^\s*(${UNITS})`, 'i');

/** Unit anywhere on the row, excluding a longer word ("pg" of "pgm"). */
const ANY_UNIT = new RegExp(String.raw`(?<![a-z])${UNITS}`, 'i');

const CELLS: Readonly<Record<string, number>> = { 'giga/l': 1.0, 'g/l': 1.0, '109/l': 1.0, '/mm3': 0.001, '/µl': 0.001 };

/** Factors to the app's unit, per unit, for each test. */
const FACTORS: Readonly<Record<LabTest, Readonly<Record<string, number>>>> = {
  CRP: { 'mg/l': 1.0, 'mg/dl': 10.0 },
  CALPROTECTIN: { 'µg/g': 1.0, 'mg/kg': 1.0 },
  RED_BLOOD_CELLS: { 'tera/l': 1.0, 't/l': 1.0, '1012/l': 1.0 },
  HEMOGLOBIN: { 'g/dl': 1.0, 'g/l': 0.1, 'mmol/l': 1.611 },
  HEMATOCRIT: { '%': 1.0, 'l/l': 100.0 },
  MCV: { fl: 1.0, 'µm3': 1.0 },
  MCH: { pg: 1.0 },
  MCHC: { 'g/dl': 1.0, 'g/l': 0.1, '%': 1.0 },
  WHITE_BLOOD_CELLS: CELLS,
  NEUTROPHILS: CELLS,
  LYMPHOCYTES: CELLS,
  MONOCYTES: CELLS,
  EOSINOPHILS: CELLS,
  BASOPHILS: CELLS,
  PLATELETS: CELLS,
  FERRITIN: { 'µg/l': 1.0, 'ng/ml': 1.0 },
  IRON: { 'µg/dl': 1.0, 'µmol/l': 5.585 },
  TRANSFERRIN: { 'g/l': 1.0, 'mg/dl': 0.01 },
  IRON_BINDING_CAPACITY: { 'µg/dl': 1.0, 'µmol/l': 5.585 },
  TRANSFERRIN_SATURATION: { '%': 1.0 },
  PROTHROMBIN_TIME: { '%': 1.0 },
  CREATININE: { 'µmol/l': 1.0, 'mg/l': 8.84, 'mg/dl': 88.4 },
  EGFR: { 'ml/mn/1,73m2': 1.0, 'ml/min/1,73m2': 1.0 },
  SODIUM: { 'mmol/l': 1.0, 'meq/l': 1.0 },
  POTASSIUM: { 'mmol/l': 1.0, 'meq/l': 1.0 },
  CHLORIDE: { 'mmol/l': 1.0, 'meq/l': 1.0 },
  CALCIUM: { 'mmol/l': 1.0, 'mg/l': 0.02495, 'mg/dl': 0.2495 },
  URINE_PROTEIN: { 'g/l': 1.0, 'mg/l': 0.001 },
  AST: { 'u/l': 1.0, 'ui/l': 1.0 },
  ALT: { 'u/l': 1.0, 'ui/l': 1.0 },
  GGT: { 'u/l': 1.0, 'ui/l': 1.0 },
  ALKALINE_PHOSPHATASE: { 'u/l': 1.0, 'ui/l': 1.0 },
  BILIRUBIN_TOTAL: { 'µmol/l': 1.0, 'mg/l': 1.71, 'mg/dl': 17.1 },
  BILIRUBIN_DIRECT: { 'µmol/l': 1.0, 'mg/l': 1.71, 'mg/dl': 17.1 },
  BILIRUBIN_INDIRECT: { 'µmol/l': 1.0, 'mg/l': 1.71, 'mg/dl': 17.1 },
  GLUCOSE: { 'g/l': 1.0, 'mmol/l': 0.18016, 'mg/dl': 0.01 },
  CHOLESTEROL_TOTAL: { 'g/l': 1.0, 'mmol/l': 0.3867, 'mg/dl': 0.01 },
  CHOLESTEROL_HDL: { 'g/l': 1.0, 'mmol/l': 0.3867, 'mg/dl': 0.01 },
  CHOLESTEROL_LDL: { 'g/l': 1.0, 'mmol/l': 0.3867, 'mg/dl': 0.01 },
  TRIGLYCERIDES: { 'g/l': 1.0, 'mmol/l': 0.8857, 'mg/dl': 0.01 },
  VITAMIN_D: { 'ng/ml': 1.0, 'µg/l': 1.0, 'nmol/l': 0.4006 },
  ALBUMIN: { 'g/l': 1.0, 'g/dl': 10.0 },
  PSA: { 'µg/l': 1.0, 'ng/ml': 1.0 },
};

/** Factor to the app's unit; null if the unit does not match the analysis. */
function conversionFactor(test: LabTest, unit: string): number | null {
  const u = unit.toLowerCase().replaceAll(' ', '').replaceAll('^', '').replaceAll('²', '2').replaceAll('.', ',')
    .replaceAll('ug', 'µg').replaceAll('umol', 'µmol').replaceAll('um3', 'µm3').replaceAll('/ul', '/µl');
  const factors = FACTORS[test];
  return Object.hasOwn(factors, u) ? factors[u]! : null;
}

/** Physiologically possible bounds: beyond them, the reading is wrong (neighboring column, OCR). */
const PLAUSIBLE: Readonly<Record<LabTest, readonly [number, number]>> = {
  CRP: [0.0, 1000.0],
  CALPROTECTIN: [0.0, 20000.0],
  RED_BLOOD_CELLS: [0.5, 10.0],
  HEMOGLOBIN: [2.0, 45.0],
  MCHC: [2.0, 45.0],
  HEMATOCRIT: [5.0, 80.0],
  MCV: [40.0, 150.0],
  MCH: [10.0, 50.0],
  WHITE_BLOOD_CELLS: [0.1, 500.0],
  NEUTROPHILS: [0.0, 300.0],
  LYMPHOCYTES: [0.0, 300.0],
  MONOCYTES: [0.0, 300.0],
  EOSINOPHILS: [0.0, 300.0],
  BASOPHILS: [0.0, 300.0],
  PLATELETS: [1.0, 3000.0],
  FERRITIN: [0.0, 20000.0],
  IRON: [1.0, 1000.0],
  IRON_BINDING_CAPACITY: [1.0, 1000.0],
  TRANSFERRIN: [0.1, 10.0],
  TRANSFERRIN_SATURATION: [0.0, 150.0],
  PROTHROMBIN_TIME: [0.0, 150.0],
  CREATININE: [5.0, 3000.0],
  EGFR: [1.0, 200.0],
  SODIUM: [50.0, 200.0],
  CHLORIDE: [50.0, 200.0],
  POTASSIUM: [1.0, 10.0],
  CALCIUM: [0.5, 5.0],
  URINE_PROTEIN: [0.0, 50.0],
  AST: [0.0, 20000.0],
  ALT: [0.0, 20000.0],
  GGT: [0.0, 20000.0],
  ALKALINE_PHOSPHATASE: [0.0, 20000.0],
  BILIRUBIN_TOTAL: [0.0, 1000.0],
  BILIRUBIN_DIRECT: [0.0, 1000.0],
  BILIRUBIN_INDIRECT: [0.0, 1000.0],
  GLUCOSE: [0.1, 10.0],
  CHOLESTEROL_TOTAL: [0.05, 20.0],
  CHOLESTEROL_HDL: [0.05, 20.0],
  CHOLESTEROL_LDL: [0.05, 20.0],
  TRIGLYCERIDES: [0.05, 50.0],
  VITAMIN_D: [0.0, 300.0],
  ALBUMIN: [5.0, 80.0],
  PSA: [0.0, 10000.0],
};

const plausible = (test: LabTest) => PLAUSIBLE[test];

// --- Sampling date ---

/** "19.05.2023", "05/12/22"; OCR sometimes reads a dot as a comma ("19,05.2023"). */
const DATE = String.raw`(\d{1,2})\s?[./,]\s?(\d{1,2})\s?[./,]\s?(\d{4}|\d{2})(?!\d)`;

/**
 * Sampling date, otherwise the date performed or recorded (the same day in practice):
 * a report whose "Prélevé le" line is unreadable keeps a plausible date.
 */
const SAMPLE_DATES = [
  new RegExp(String.raw`prelev\w*\s+(?:le|du)\s+${DATE}`),
  new RegExp(String.raw`(?:realises?|enregistre)\s+le\s+${DATE}`),
];

function sampleDate(rows: TextLine[][]): LocalDate | null {
  const texts = rows.map((row) => normalize(row.map((l) => l.text).join(' ')));
  for (const pattern of SAMPLE_DATES) {
    for (const text of texts) {
      const match = pattern.exec(text);
      if (!match) continue;
      const rawYear = match[3]!;
      const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
      try {
        return localDate(year, Number(match[2]), Number(match[1]));
      } catch {
        continue; // impossible date: try the next line
      }
    }
  }
  return null;
}

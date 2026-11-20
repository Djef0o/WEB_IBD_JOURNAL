import { EXTRA_SYMPTOMS } from './care';
import { LAB_TESTS, labTestUnit } from './health';
import { MEAL_TYPES, type BackupData } from './models';

/*
 * Port of CsvExport.kt: CSV files of the journal, for a spreadsheet or the doctor: file name to
 * content. RFC 4180: comma-separated, UTF-8, CRLF line ends, quotes doubled; dates in ISO
 * (2026-11-19), decimals with a point, yes/no as 1/0. Headers are in English whatever the app's
 * language.
 */

const flag = (value: boolean): string => (value ? '1' : '0');

/** Kotlin `Double.toString()`: a whole number keeps its ".0" (72 gives "72.0"). */
function decimal(value: number): string {
  return Number.isInteger(value) && Math.abs(value) < 1e7 ? value.toFixed(1) : String(value);
}

/**
 * Free text from the user. A cell starting with "=", "+", "-", "@" or a control character would be
 * run as a formula by spreadsheets: it is prefixed with an apostrophe.
 */
function text(value: string): string {
  return value !== '' && '=+-@\t\r'.includes(value[0]!) ? `'${value}` : value;
}

function cell(value: string): string {
  return /[,"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((row) => `${row.map(cell).join(',')}\r\n`).join('');
}

/** Comparison of strings by code unit (ISO dates, enum names), like Kotlin `compareTo` on ASCII. */
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

/** Chains comparators: first non-zero result. */
function by<T>(...keys: ((item: T) => string | number)[]): (a: T, b: T) => number {
  return (a, b) => {
    for (const key of keys) {
      const result = cmp(key(a), key(b));
      if (result !== 0) return result;
    }
    return 0;
  };
}

/** Answers of an activity score, total of the questionnaire (`ActivityScore.total`): missing answers count as 0. */
function scoreTotal(kind: 'HBI' | 'SCCAI', answers: readonly number[]): number {
  const answer = (i: number): number => Math.max(answers[i] ?? 0, 0);
  const bits = (n: number): number => n.toString(2).replaceAll('0', '').length;
  const plain = kind === 'HBI' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
  return plain.reduce((sum, i) => sum + answer(i), 0) + bits(answer(kind === 'HBI' ? 4 : 5));
}

export function toCsvFiles(data: BackupData): Map<string, string> {
  const files = new Map<string, string>();
  files.set('stools.csv', csv(
    ['date', 'bristol_type', 'blood', 'mucus', 'pain', 'fatigue', 'urgency', 'nocturnal', 'false_urge', 'comment'],
    [...data.stools].sort(by((s) => s.date, (s) => s.createdAt)).map((s) => [
      s.date, String(s.bristolType), String(s.bloodLevel), String(s.mucusLevel), String(s.painLevel),
      String(s.fatigueLevel), flag(s.urgency), flag(s.nocturnal), flag(s.falseUrge), text(s.comment),
    ]),
  ));
  files.set('extra_symptoms.csv', csv(
    ['date', 'joint_pain', 'skin', 'eyes', 'mouth_ulcers', 'fever'],
    [...(data.extraSymptoms ?? [])].sort(by((d) => d.date)).map((day) => [
      day.date, ...EXTRA_SYMPTOMS.map((symptom) => flag(day.symptoms.includes(symptom))),
    ]),
  ));
  files.set('meals.csv', csv(
    ['date', 'meal', 'description', 'product'],
    [...data.meals].sort(by((m) => m.date, (m) => MEAL_TYPES.indexOf(m.type))).map((m) => [
      m.date, m.type.toLowerCase(), text(m.description), text(m.product?.name ?? ''),
    ]),
  ));
  files.set('weights.csv', csv(
    ['date', 'kg'],
    [...(data.weights ?? [])].sort(by((w) => w.date, (w) => w.id)).map((w) => [w.date, decimal(w.kg)]),
  ));
  files.set('lab_results.csv', csv(
    ['date', 'test', 'value', 'unit', 'qualifier', 'reference_low', 'reference_high', 'note'],
    [...(data.labResults ?? [])]
      .sort(by((r) => r.date, (r) => LAB_TESTS.indexOf(r.test), (r) => r.id))
      .map((r) => [
        r.date, r.test.toLowerCase(), decimal(r.value), labTestUnit(r.test), r.qualifier.toLowerCase(),
        r.referenceLow === null ? '' : decimal(r.referenceLow),
        r.referenceHigh === null ? '' : decimal(r.referenceHigh), text(r.note),
      ]),
  ));
  files.set('flares.csv', csv(
    ['start', 'end', 'hospitalized', 'treatment', 'note'],
    [...(data.flares ?? [])].sort(by((f) => f.start)).map((f) => [
      f.start, f.end ?? '', flag(f.hospitalized), text(f.treatment), text(f.note),
    ]),
  ));
  files.set('activity_scores.csv', csv(
    ['date', 'score', 'total', 'answers'],
    [...(data.activityScores ?? [])].sort(by((s) => s.date, (s) => s.id)).map((s) => [
      s.date, s.kind.toLowerCase(), String(scoreTotal(s.kind, s.answers)), s.answers.join(' '),
    ]),
  ));
  files.set('wellbeing.csv', csv(
    ['date', 'sleep', 'stress', 'mood', 'period'],
    [...(data.wellbeing ?? [])].sort(by((d) => d.date)).map((d) => [
      d.date, d.sleep === null ? '' : String(d.sleep), d.stress === null ? '' : String(d.stress),
      d.mood === null ? '' : String(d.mood), flag(d.period),
    ]),
  ));
  return files;
}

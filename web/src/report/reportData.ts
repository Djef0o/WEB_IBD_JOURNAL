import { adherence, type Adherence } from '../domain/adherence';
import type {
  ActivityScore, Appointment, DoctorQuestion, ExtraSymptom, ExtraSymptomsDay, Flare, SteroidCourse, Vaccination,
  WellbeingDay,
} from '../domain/care';
import { EXTRA_SYMPTOMS } from '../domain/care';
import { steroidEnd } from '../domain/steroids';
import { wellbeingAverages, wellbeingLinks, type WellbeingAverages, type WellbeingLink } from '../domain/wellbeing';
import { analyze, startFrom, type AnalysisPeriod, type AnalysisSummary } from '../domain/analysis';
import {
  LAB_CATEGORIES, LAB_TESTS, labTestCategory, type DoseLog, type LabCategory, type LabResult, type LabTest,
} from '../domain/health';
import { labReference, labStatus, type LabStatus, type ReferenceRange } from '../domain/labReference';
import type { Meal, Stool } from '../domain/models';
import {
  nextOccurrence, type Checkup, type Medication, type Profile,
} from '../domain/profile';
import {
  dateOf, dateParts, minusDays, type LocalDate, type LocalDateTime,
} from '../domain/time';

/** Beyond this, bars would become unreadable on an A4 page: "All" is limited to 90 days. */
export const REPORT_CHART_MAX_DAYS = 90;

/** Number of lab panels (analysis dates) included in the report table. */
export const REPORT_LAB_PANELS = 4;

/** Treatment and adherence over the report period. */
export interface TreatmentReport {
  medication: Medication;
  adherence: Adherence;
}

/** Upcoming check-up, at its next due date. */
export interface UpcomingCheckup {
  checkup: Checkup;
  at: LocalDateTime;
}

/** Result of a lab table cell; `status` null within the laboratory's values or without them. */
export interface LabCell {
  result: LabResult;
  status: LabStatus | null;
}

/**
 * Lab table row: one cell per date of `LabPanels.dates` (null without a measurement that day);
 * `reference`: laboratory values of the row's most recent result, null without them.
 */
export interface LabPanelRow {
  test: LabTest;
  cells: (LabCell | null)[];
  reference: ReferenceRange | null;
}

/**
 * Latest lab panels, from most recent to oldest: only analyses measured at least once appear.
 * `notes`: results from these panels carrying a note, in table order.
 */
export interface LabPanels {
  dates: LocalDate[];
  rows: LabPanelRow[];
  notes: LabResult[];
}

/** Number of days with `symptom` over the report period, and the most recent one. */
export interface ExtraSymptomReport {
  symptom: ExtraSymptom;
  days: number;
  last: LocalDate;
}

/** Means over the period and the factors that came with bad days. */
export interface WellbeingReport {
  averages: WellbeingAverages;
  links: WellbeingLink[];
}

/** Appointments listed in the report: the next ones from now. */
export const REPORT_APPOINTMENTS = 3;

/** Most recent activity scores listed in the compact line of the report. */
export const ACTIVITY_LIST_MAX = 12;

/** Everything the report contains, already computed: the view only does the layout. */
export interface ReportData {
  profile: Profile;
  period: AnalysisPeriod;
  /** First day of the period (first day with an entry for "All"). */
  from: LocalDate;
  to: LocalDate;
  generatedAt: LocalDateTime;
  summary: AnalysisSummary;
  /** First day of the daily chart, which ends at `to`. */
  chartFrom: LocalDate;
  treatments: TreatmentReport[];
  /** Latest panels up to `to`, whatever the period: analyses are spaced out. */
  labPanels: LabPanels;
  /** Upcoming check-ups, from nearest to furthest. */
  upcomingCheckups: UpcomingCheckup[];
  /** Flares overlapping the period, oldest first. */
  flares: Flare[];
  /** Activity scores within the period, oldest first. */
  activityScores: ActivityScore[];
  /** Steroid courses overlapping the period, oldest first. */
  steroidCourses: SteroidCourse[];
  /** All vaccinations, most recent first. */
  vaccinations: Vaccination[];
  /** Extra-intestinal manifestations over the period, in `EXTRA_SYMPTOMS` order; only those noted. */
  extraSymptoms: ExtraSymptomReport[];
  /** Questions not yet asked, in the repository's order. */
  doctorQuestions: DoctorQuestion[];
  /** Next `REPORT_APPOINTMENTS` appointments from now, chronological. */
  appointments: Appointment[];
  /** Sleep, stress, mood and period over the period; null when none was noted. */
  wellbeing: WellbeingReport | null;
}

export interface ReportInput {
  period: AnalysisPeriod;
  now: LocalDateTime;
  profile: Profile;
  stools: Stool[];
  meals: Meal[];
  medications: Medication[];
  doseLogs: DoseLog[];
  labResults: LabResult[];
  checkups: Checkup[];
  flares?: Flare[];
  activityScores?: ActivityScore[];
  steroidCourses?: SteroidCourse[];
  vaccinations?: Vaccination[];
  extraSymptoms?: ExtraSymptomsDay[];
  doctorQuestions?: DoctorQuestion[];
  appointments?: Appointment[];
  wellbeing?: WellbeingDay[];
}

/** Builds the report for `period` ending on the day of `now`, from the raw data. */
export function reportData(input: ReportInput): ReportData {
  const { period, now, profile, stools, meals, medications, doseLogs, labResults, checkups } = input;
  const { flares = [], activityScores = [], steroidCourses = [], vaccinations = [] } = input;
  const { extraSymptoms = [], doctorQuestions = [], appointments = [], wellbeing = [] } = input;
  const today = dateOf(now);
  const summary = analyze(stools, meals, today, period);
  const from = minusDays(today, summary.periodDays - 1);
  const chartDays = Math.min(summary.periodDays, REPORT_CHART_MAX_DAYS);
  // Without a bound ("All"), adherence goes back to each treatment's first scheduled day.
  const periodStart = startFrom(period, today);
  return {
    profile,
    period,
    from,
    to: today,
    generatedAt: now,
    summary,
    chartFrom: minusDays(today, chartDays - 1),
    treatments: medications.map((medication) => ({
      medication,
      adherence: adherence(medication, doseLogs, periodStart ?? medication.schedule.startDate, now),
    })),
    labPanels: labPanels(labResults.filter((r) => r.date <= today)),
    upcomingCheckups: checkups
      .flatMap((checkup) => {
        const at = nextOccurrence(checkup.schedule, now);
        return at === null ? [] : [{ checkup, at }];
      })
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)),
    flares: flares
      .filter((f) => f.start <= today && (f.end ?? today) >= from)
      .sort((a, b) => compareText(a.start, b.start)),
    activityScores: activityScores
      .filter((s) => s.date >= from && s.date <= today)
      .sort((a, b) => compareText(a.date, b.date) || a.id - b.id),
    steroidCourses: steroidCourses
      .filter((c) => c.start <= today && steroidEnd(c) >= from)
      .sort((a, b) => compareText(a.start, b.start)),
    vaccinations: [...vaccinations].sort((a, b) => compareText(b.date, a.date)),
    extraSymptoms: extraSymptomReports(extraSymptoms.filter((d) => d.date >= from && d.date <= today)),
    doctorQuestions: doctorQuestions.filter((q) => !q.done),
    appointments: appointments
      .filter((a) => a.at >= now)
      .sort((a, b) => compareText(a.at, b.at))
      .slice(0, REPORT_APPOINTMENTS),
    wellbeing: wellbeingReport(wellbeing, stools, from, today),
  };
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function wellbeingReport(days: WellbeingDay[], stools: Stool[], from: LocalDate, to: LocalDate): WellbeingReport | null {
  const averages = wellbeingAverages(days, from, to);
  if (averages.entries === 0) return null;
  return { averages, links: wellbeingLinks(days.filter((d) => d.date >= from && d.date <= to), stools) };
}

/** One entry per manifestation noted at least one day, in `EXTRA_SYMPTOMS` order. */
export function extraSymptomReports(days: readonly ExtraSymptomsDay[]): ExtraSymptomReport[] {
  const reports: ExtraSymptomReport[] = [];
  for (const symptom of EXTRA_SYMPTOMS) {
    const matching = days.filter((d) => d.symptoms.includes(symptom));
    if (matching.length === 0) continue;
    const dates = new Set(matching.map((d) => d.date));
    reports.push({ symptom, days: dates.size, last: [...dates].sort().reverse()[0]! });
  }
  return reports;
}

/** Table of the last `REPORT_LAB_PANELS` analysis dates, rows in `LAB_TESTS` order. */
export function labPanels(results: LabResult[]): LabPanels {
  const dates = [...new Set(results.map((r) => r.date))].sort().reverse().slice(0, REPORT_LAB_PANELS);
  // Two entries of the same measurement on the same day: the last one saved wins (highest id).
  const byTestAndDate = new Map<string, LabResult>();
  for (const result of results) {
    if (!dates.includes(result.date)) continue;
    const key = `${result.test}|${result.date}`;
    const kept = byTestAndDate.get(key);
    if (kept === undefined || result.id > kept.id) byTestAndDate.set(key, result);
  }
  const rows: LabPanelRow[] = [];
  for (const test of LAB_TESTS) {
    const perDate = dates.map((date) => byTestAndDate.get(`${test}|${date}`) ?? null);
    const latest = perDate.find((r) => r !== null) ?? null;
    if (latest === null) continue;
    rows.push({
      test,
      cells: perDate.map((result) => (result === null ? null : { result, status: labStatus(result) })),
      reference: labReference(latest),
    });
  }
  const notes = dates.flatMap((date) =>
    rows.flatMap((row) => {
      const result = byTestAndDate.get(`${row.test}|${date}`);
      return result !== undefined && result.note.trim() !== '' ? [result] : [];
    }));
  return { dates, rows, notes };
}

/** Rows grouped by category, categories in `LAB_CATEGORIES` order. */
export function labRowsByCategory(rows: readonly LabPanelRow[]): { category: LabCategory; rows: LabPanelRow[] }[] {
  return LAB_CATEGORIES
    .map((category) => ({ category, rows: rows.filter((row) => labTestCategory(row.test) === category) }))
    .filter((group) => group.rows.length > 0);
}

/** Days with at least one stool entry, "no stool" days included. */
export function trackedDays(summary: AnalysisSummary): number {
  return new Set(summary.stools.map((s) => s.date)).size;
}

/** Days with at least one stool or meal entry. */
export function daysFollowed(summary: AnalysisSummary): number {
  return new Set([...summary.stools.map((s) => s.date), ...summary.meals.map((m) => m.date)]).size;
}

/** Real stools per tracked day, or null with no tracked day. */
export function stoolsPerTrackedDay(summary: AnalysisSummary, realStoolCount: number): number | null {
  const days = trackedDays(summary);
  return days === 0 ? null : realStoolCount / days;
}

/** Whole years between a birth date and `on` (`LocalDate.yearsUntil`). */
export function yearsUntil(birth: LocalDate, on: LocalDate): number {
  const a = dateParts(birth);
  const b = dateParts(on);
  let years = b.year - a.year;
  if (b.month < a.month || (b.month === a.month && b.day < a.day)) years--;
  return years;
}

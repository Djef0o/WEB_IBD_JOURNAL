import '../analysis/analysis.css';

import { type Adherence, takenRate } from '../../../domain/adherence';
import { ANALYSIS_PERIOD_DAYS, averageBristol, realStools } from '../../../domain/analysis';
import { LAB_TEST_INFO } from '../../../domain/health';
import type { ReminderSchedule } from '../../../domain/profile';
import { dateOf, dateTimeParts } from '../../../domain/time';
import { formatNumber, t, tp } from '../../../i18n';
import {
  REPEAT_EVERY_KEY, checkupTypeLabel, diagnosisLabel, labCategoryLabel, labTestLabel, sexLabel,
} from '../../../report/labels';
import { displayLabValue, displayReference } from '../../../report/labFormat';
import {
  daysFollowed, labRowsByCategory, stoolsPerTrackedDay, yearsUntil, type LabCell, type ReportData,
} from '../../../report/reportData';
import { DailyStoolChart } from '../../charts/DailyStoolChart';
import { barsBetween } from '../../charts/dailyStool';
import { formatDecimal, formatLocalDate, formatTime } from '../../format';
import { periodLabel, symptomLabel } from '../analysis/period';
import {
  AppointmentsSection, DoctorQuestionsSection, ExtraSymptomsSection, FlaresSection,
  SteroidsSection, VaccinationsSection, WellbeingSection,
} from './ReportCareSections';
import { Scroll } from './ReportScroll';

/*
 * The report document (content of ReportPdfBuilder.kt): header, summary, symptoms, daily chart,
 * treatments, lab results, upcoming tests. It only displays what was entered or counted, and
 * interprets nothing. Paper layout: styles/print.css.
 */
export function ReportView({ data }: { data: ReportData }) {
  const { profile, summary } = data;
  const name = [profile.firstName, profile.lastName].filter((part) => part.trim() !== '').join(' ');
  const identity = [
    profile.birthDate === null
      ? null
      : t('profile_born_on', [
        formatLocalDate(profile.birthDate),
        tp('profile_age', yearsUntil(profile.birthDate, data.to)),
      ]),
    profile.sex === null ? null : sexLabel(profile.sex),
  ].filter((part): part is string => part !== null).join(' · ');
  const generated = dateTimeParts(data.generatedAt);

  return (
    <article class="report-sheet" aria-labelledby="report-title">
      <header class="report-header">
        <p class="report-brand">{t('app_name')}</p>
        <h1 id="report-title">{t('report_title')}</h1>
        {name !== '' && <p class="report-patient">{t('report_patient', [name])}</p>}
        {identity !== '' && <p>{identity}</p>}
        {profile.diagnosis !== null && <p>{t('report_care_diagnosis', [diagnosisLabel(profile.diagnosis)])}</p>}
        <p>{t('report_period', [periodLabel(data.period), formatLocalDate(data.from), formatLocalDate(data.to)])}</p>
        <p class="report-note">
          {t('report_generated', [formatLocalDate(dateOf(data.generatedAt)), formatTime(generated.hour, generated.minute)])}
        </p>
      </header>

      <Summary data={data} />
      <Symptoms data={data} />
      {summary.stools.length > 0 && <ChartSection data={data} />}
      <ExtraSymptomsSection data={data} />
      <WellbeingSection data={data} />
      <Treatments data={data} />
      <FlaresSection data={data} />
      <SteroidsSection data={data} />
      <VaccinationsSection data={data} />
      <Labs data={data} />
      <Checkups data={data} />
      <AppointmentsSection data={data} />
      <DoctorQuestionsSection data={data} />

      <footer class="report-footer">{t('report_footer')}</footer>
    </article>
  );
}

function Summary({ data }: { data: ReportData }) {
  const { summary } = data;
  const real = realStools(summary).length;
  const perDay = stoolsPerTrackedDay(summary, real);
  const dash = (value: number | null) => (value === null ? '—' : formatDecimal(value));
  const tiles: [string, string][] = [
    [String(real), t('analysis_stools')],
    [dash(perDay), t('report_stools_per_day')],
    [dash(averageBristol(summary)), t('analysis_avg')],
    [dash(summary.liquidPerDay), t('analysis_liquid_per_day')],
    [String(daysFollowed(summary)), t('analysis_days')],
  ];
  return (
    <section class="report-section" aria-labelledby="report-summary">
      <h2 id="report-summary">{t('report_summary')}</h2>
      <dl class="report-tiles">
        {tiles.map(([value, label]) => (
          <div key={label} class="report-tile">
            <dt class="report-note">{label}</dt>
            <dd class="report-tile-value">{value}</dd>
          </div>
        ))}
      </dl>
      <p class="report-note">{t('report_summary_note')}</p>
    </section>
  );
}

function Symptoms({ data }: { data: ReportData }) {
  const { summary, period } = data;
  const days = ANALYSIS_PERIOD_DAYS[period];
  const compare = days !== null;
  return (
    <section class="report-section" aria-labelledby="report-symptoms">
      <h2 id="report-symptoms">{t('analysis_symptoms')}</h2>
      {summary.stools.length === 0 ? (
        <p>{t('report_no_data')}</p>
      ) : (
        <>
          <p class="report-note">{compare ? t('analysis_symptoms_compare', [days]) : t('analysis_symptoms_days')}</p>
          <Scroll label={t('analysis_symptoms')}>
            <table class="report-table">
              <thead>
                <tr>
                  <th scope="col">{t('report_col_symptom')}</th>
                  <th scope="col"><span class="visually-hidden">%</span></th>
                  <th scope="col" class="num">{t('report_col_days')}</th>
                  {compare && <th scope="col" class="num">{t('report_col_previous')}</th>}
                </tr>
              </thead>
              <tbody>
                {summary.symptomDays.map((row) => (
                  <tr key={row.symptom}>
                    <th scope="row">{symptomLabel(row.symptom)}</th>
                    <td class="bar-cell">
                      <progress class="symptom-bar" data-symptom={row.symptom} value={Math.min(row.days, summary.periodDays)} max={summary.periodDays} aria-hidden="true" />
                    </td>
                    <td class="num"><strong>{tp('analysis_symptom_days', row.days)}</strong></td>
                    {compare && (
                      <td class="num">
                        {row.previousDays === null ? '' : t('report_previous', [
                          tp('analysis_symptom_days', row.previousDays),
                          signed(row.days - row.previousDays),
                        ])}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </>
      )}
    </section>
  );
}

const signed = (delta: number): string => (delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : '=');

function ChartSection({ data }: { data: ReportData }) {
  const bars = barsBetween(data.summary.stoolHistory, data.chartFrom, data.to);
  return (
    <section class="report-section">
      <DailyStoolChart
        bars={bars}
        layout="fit"
        table={false}
        title={t('analysis_daily')}
        subtitle={tp('report_chart_range', bars.length, [bars.length, formatLocalDate(data.chartFrom), formatLocalDate(data.to)])}
      />
    </section>
  );
}

/** "Every day at 08:00, since March 3, 2026" or "Once, on March 3, 2026 at 08:00". */
function scheduleText(schedule: ReminderSchedule): string {
  const time = formatTime(schedule.hour, schedule.minute);
  const start = formatLocalDate(schedule.startDate);
  if (schedule.repeatUnit === 'ONCE') return t('report_schedule_once', [start, time]);
  const every = Math.max(schedule.repeatEvery, 1);
  return t('report_schedule', [tp(REPEAT_EVERY_KEY[schedule.repeatUnit], every), time, start]);
}

/** Nothing without a scheduled intake over the period; unanswered intakes are counted separately. */
function adherenceText(a: Adherence): string | null {
  if (a.expected === 0) return null;
  const answered = a.taken + a.missed;
  if (answered === 0) return t('report_adherence_none');
  return t('report_adherence', [
    formatNumber(takenRate(a) ?? 0, { style: 'percent' }),
    a.taken,
    a.expected,
    a.missed,
    a.expected - answered,
  ]);
}

function Treatments({ data }: { data: ReportData }) {
  return (
    <section class="report-section" aria-labelledby="report-treatments">
      <h2 id="report-treatments">{t('treatments_title')}</h2>
      {data.treatments.length === 0 ? (
        <p>{t('treatments_empty')}</p>
      ) : (
        <ul class="report-list" role="list">
          {data.treatments.map(({ medication, adherence }) => {
            const text = adherenceText(adherence);
            return (
              <li key={medication.id}>
                <strong>{[medication.name, medication.dosage].filter((p) => p.trim() !== '').join(' · ')}</strong>
                <span>{scheduleText(medication.schedule)}</span>
                {text !== null && <span>{text}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LabValue({ cell }: { cell: LabCell | null }) {
  if (cell === null) return <>–</>;
  const value = displayLabValue(cell.result, false);
  if (cell.status === null) return <>{value}</>;
  // Outside the laboratory's values: arrow + bold, readable in black and white.
  return (
    <strong>
      <span aria-hidden="true">{cell.status === 'BELOW' ? '↓ ' : '↑ '}</span>
      {value}
      <span class="visually-hidden"> ({cell.status === 'BELOW' ? t('lab_status_below') : t('lab_status_above')})</span>
    </strong>
  );
}

function Labs({ data }: { data: ReportData }) {
  const { dates, rows, notes } = data.labPanels;
  if (rows.length === 0) return null;
  const columns = dates.length + 2;
  return (
    <section class="report-section report-labs" aria-labelledby="report-labs">
      <h2 id="report-labs">{t('report_labs')}</h2>
      <p class="report-note">{t('report_labs_legend')}</p>
      <Scroll label={t('report_labs')}>
        <table class="report-table lab-table">
          <thead>
            <tr>
              <th scope="col">{t('report_col_test')}</th>
              {dates.map((date) => <th key={date} scope="col" class="num">{formatLocalDate(date, { dateStyle: 'medium' })}</th>)}
              <th scope="col">{t('report_col_reference')}</th>
            </tr>
          </thead>
          {labRowsByCategory(rows).map(({ category, rows: group }) => (
            <tbody key={category}>
              <tr class="category-row"><th colSpan={columns} scope="colgroup">{labCategoryLabel(category)}</th></tr>
              {group.map((row) => (
                <tr key={row.test}>
                  <th scope="row">{labTestLabel(row.test)} ({LAB_TEST_INFO[row.test].unit})</th>
                  {row.cells.map((cell, i) => (
                    <td key={dates[i]} class="num" data-outside={cell?.status != null ? '' : undefined}><LabValue cell={cell} /></td>
                  ))}
                  <td>{row.reference === null ? '–' : displayReference(row.reference)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Scroll>
      {notes.length > 0 && (
        <div class="report-lab-notes">
          <h3>{t('report_lab_notes')}</h3>
          <ul class="report-list" role="list">
            {notes.map((result) => (
              <li key={result.id}>
                {t('report_lab_note', [formatLocalDate(result.date), labTestLabel(result.test), result.note.trim()])}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Checkups({ data }: { data: ReportData }) {
  return (
    <section class="report-section" aria-labelledby="report-checkups">
      <h2 id="report-checkups">{t('report_checkups')}</h2>
      {data.upcomingCheckups.length === 0 ? (
        <p>{t('checkups_empty')}</p>
      ) : (
        <Scroll label={t('report_checkups')}>
          <table class="report-table">
            <thead>
              <tr>
                <th scope="col">{t('report_col_date')}</th>
                <th scope="col">{t('report_col_test')}</th>
                <th scope="col">{t('report_col_note')}</th>
              </tr>
            </thead>
            <tbody>
              {data.upcomingCheckups.map(({ checkup, at }) => {
                const p = dateTimeParts(at);
                return (
                  <tr key={checkup.id}>
                    <td>{t('report_checkup_at', [formatLocalDate(dateOf(at)), formatTime(p.hour, p.minute)])}</td>
                    <td>{checkupTypeLabel(checkup.type)}</td>
                    <td>{checkup.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Scroll>
      )}
    </section>
  );
}


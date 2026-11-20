import { scoreLevel, scoreTotal } from '../../../domain/activity';
import { steroidEnd, steroidTotalMg } from '../../../domain/steroids';
import { dateTimeParts } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import {
  activityLevelLabel, appointmentKindLabel, extraSymptomLabel, scoreKindLabel, vaccineLabel, wellbeingFactorLabel,
} from '../../../report/labels';
import { ACTIVITY_LIST_MAX, type ReportData } from '../../../report/reportData';
import { formatDecimal, formatLocalDate, formatTime } from '../../format';
import { Scroll } from './ReportScroll';

/*
 * Care and follow-up sections of the report (`ReportPdfBuilder`: extra symptoms, well-being, flares,
 * activity scores, steroids, vaccinations, appointments, questions). Each one is absent when it
 * has nothing to show. Recorded values only, no interpretation.
 */

const date = (value: string): string => formatLocalDate(value);

/** Manifestations noted over the period: days count and most recent day. */
export function ExtraSymptomsSection({ data }: { data: ReportData }) {
  if (data.extraSymptoms.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-extra">
      <h2 id="report-extra">{t('report_followup_extra_title')}</h2>
      <p class="report-note">{t('report_followup_extra_note')}</p>
      <ul class="report-list" role="list">
        {data.extraSymptoms.map((row) => (
          <li key={row.symptom}>
            {t('report_followup_extra_line', [extraSymptomLabel(row.symptom), tp('report_followup_days', row.days), date(row.last)])}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Means of sleep, stress and mood, days with a period, and the factors that came with bad days. */
export function WellbeingSection({ data }: { data: ReportData }) {
  const report = data.wellbeing;
  if (report === null) return null;
  const { averages } = report;
  const lines: string[] = [];
  const means = [
    averages.sleep === null ? null : t('report_wellbeing_sleep', [formatDecimal(averages.sleep)]),
    averages.stress === null ? null : t('report_wellbeing_stress', [formatDecimal(averages.stress)]),
    averages.mood === null ? null : t('report_wellbeing_mood', [formatDecimal(averages.mood)]),
  ].filter((line): line is string => line !== null);
  if (means.length > 0) lines.push(means.join(' · '));
  if (averages.periodDays > 0) lines.push(t('report_wellbeing_period', [tp('report_followup_days', averages.periodDays)]));
  for (const link of report.links) {
    lines.push(t('report_wellbeing_link', [
      wellbeingFactorLabel(link.factor), Math.round(link.badRate * link.days), link.days, Math.round(link.baseline * 100),
    ]));
  }
  if (lines.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-wellbeing">
      <h2 id="report-wellbeing">{t('report_wellbeing_title')}</h2>
      <p class="report-note">{t('report_wellbeing_note')}</p>
      <ul class="report-list" role="list">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}

/** Flares overlapping the period: dates, hospitalisation and treatment. */
export function FlaresSection({ data }: { data: ReportData }) {
  if (data.flares.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-flares">
      <h2 id="report-flares">{t('report_care_flares')}</h2>
      <ul class="report-list" role="list">
        {data.flares.map((flare) => {
          const range = t('report_care_flare_range', [
            date(flare.start), flare.end === null ? t('report_care_flare_ongoing') : date(flare.end),
          ]);
          return (
            <li key={flare.id}>
              <strong>{flare.hospitalized ? `${range} · ${t('report_care_flare_hospitalized')}` : range}</strong>
              {flare.treatment.trim() !== '' && <span>{t('report_care_flare_treatment', [flare.treatment.trim()])}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Latest score with its level, then the most recent entries of the period in a compact line. */
export function ActivityScoresSection({ data }: { data: ReportData }) {
  const scores = data.activityScores;
  const latest = scores[scores.length - 1];
  if (latest === undefined) return null;
  const level = scoreLevel(latest);
  const kind = scoreKindLabel(latest.kind);
  const latestText = level === null
    ? t('report_care_activity_latest', [kind, scoreTotal(latest), date(latest.date)])
    : t('report_care_activity_latest_level', [kind, scoreTotal(latest), date(latest.date), activityLevelLabel(level)]);
  const entries = scores.slice(-ACTIVITY_LIST_MAX)
    .map((s) => t('report_care_activity_entry', [date(s.date), scoreKindLabel(s.kind), scoreTotal(s)]))
    .join('; ');
  return (
    <section class="report-section" aria-labelledby="report-activity">
      <h2 id="report-activity">{t('report_care_activity')}</h2>
      <p class="report-note">{t('report_care_activity_note')}</p>
      <p><strong>{latestText}</strong></p>
      {scores.length > 1 && <p class="report-list-line">{entries}</p>}
    </section>
  );
}

/** Steroid courses overlapping the period, with their total dose. */
export function SteroidsSection({ data }: { data: ReportData }) {
  if (data.steroidCourses.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-steroids">
      <h2 id="report-steroids">{t('report_care_steroids')}</h2>
      <ul class="report-list" role="list">
        {data.steroidCourses.map((course) => {
          const total = steroidTotalMg(course);
          return (
            <li key={course.id}>
              {t('report_care_steroid_row', [
                course.drug.trim(), date(course.start), date(steroidEnd(course)),
                Number.isInteger(total) ? String(total) : formatDecimal(total),
              ])}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function VaccinationsSection({ data }: { data: ReportData }) {
  if (data.vaccinations.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-vaccinations">
      <h2 id="report-vaccinations">{t('report_care_vaccinations')}</h2>
      <Scroll label={t('report_care_vaccinations')}>
        <table class="report-table">
          <thead>
            <tr>
              <th scope="col">{t('report_care_col_vaccine')}</th>
              <th scope="col">{t('report_care_col_given')}</th>
              <th scope="col">{t('report_care_col_next_due')}</th>
            </tr>
          </thead>
          <tbody>
            {data.vaccinations.map((v) => (
              <tr key={v.id}>
                <th scope="row">{vaccineLabel(v.type)}</th>
                <td>{date(v.date)}</td>
                <td>{v.nextDue === null ? '–' : date(v.nextDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </section>
  );
}

/** Next appointments: kind, date and time, then place. */
export function AppointmentsSection({ data }: { data: ReportData }) {
  if (data.appointments.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-appointments">
      <h2 id="report-appointments">{t('report_followup_appointments')}</h2>
      <ul class="report-list" role="list">
        {data.appointments.map((a) => {
          const p = dateTimeParts(a.at);
          return (
            <li key={a.id}>
              <strong>
                {appointmentKindLabel(a.kind)} · {t('report_checkup_at', [date(a.at.slice(0, 10)), formatTime(p.hour, p.minute)])}
              </strong>
              {a.place.trim() !== '' && <span>{a.place.trim()}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Open questions as a bullet list. */
export function DoctorQuestionsSection({ data }: { data: ReportData }) {
  if (data.doctorQuestions.length === 0) return null;
  return (
    <section class="report-section" aria-labelledby="report-questions">
      <h2 id="report-questions">{t('report_followup_questions')}</h2>
      <ul class="report-list" role="list">
        {data.doctorQuestions.map((q) => <li key={q.id}>• {q.text.trim()}</li>)}
      </ul>
    </section>
  );
}

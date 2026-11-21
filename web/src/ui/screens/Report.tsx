import './report/report.css';
import '../../styles/print.css';
import { useMemo } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { getAllFlares } from '../../db/flares';
import { getAllSteroidCourses } from '../../db/steroids';
import { getAllVaccinations } from '../../db/vaccinations';
import { getAllAppointments, getAllDoctorQuestions, getAllExtraSymptoms } from '../../db/followup';
import { getAllWellbeing } from '../../db/wellbeing';
import { getAllCheckups } from '../../db/checkups';
import { getAllDoseLogs } from '../../db/doses';
import { getAllLabResults } from '../../db/labs';
import { getMealsBetween } from '../../db/meals';
import { getAllMedications } from '../../db/medications';
import { getProfile } from '../../db/profile';
import { getAllStools } from '../../db/stools';
import { startFrom } from '../../domain/analysis';
import { profile as emptyProfile } from '../../domain/profile';
import { dateOf, fromEpochDays, now } from '../../domain/time';
import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { reportData } from '../../report/reportData';
import { Button, EmptyState, SegmentedControl } from '../components';
import { analysisPeriod, periodOptions } from './analysis/period';
import { ReportView } from './report/ReportView';

/** Doctor report: same content as ReportData/ReportPdfBuilder, printed or saved as PDF by the browser. */
export default function Report(_props: ScreenProps) {
  const period = analysisPeriod.value;
  const data = useLiveQuery(
    [
      'stools', 'meals', 'products', 'medications', 'dose_logs', 'lab_results', 'checkups', 'profile',
      'flares', 'steroid_courses', 'vaccinations', 'extra_symptoms', 'doctor_questions',
      'appointments', 'wellbeing',
    ],
    async () => {
      const at = now();
      const mealsFrom = startFrom(period, dateOf(at)) ?? fromEpochDays(0);
      const [profile, stools, meals, medications, doseLogs, labResults, checkups] = await Promise.all([
        getProfile(), getAllStools(), getMealsBetween(mealsFrom, dateOf(at)), getAllMedications(),
        getAllDoseLogs(), getAllLabResults(), getAllCheckups(),
      ]);
      const [flares, steroidCourses, vaccinations, extraSymptoms, doctorQuestions, appointments, wellbeing] =
        await Promise.all([
          getAllFlares(), getAllSteroidCourses(), getAllVaccinations(),
          getAllExtraSymptoms(), getAllDoctorQuestions(), getAllAppointments(), getAllWellbeing(),
        ]);
      return reportData({
        period, now: at, profile: profile ?? emptyProfile(), stools, meals, medications, doseLogs, labResults, checkups,
        flares, steroidCourses, vaccinations, extraSymptoms, doctorQuestions, appointments, wellbeing,
      });
    },
    [period],
  );
  const empty = useMemo(
    () => data !== undefined && data.summary.stoolHistory.length === 0 && data.treatments.length === 0
      && data.labPanels.rows.length === 0 && data.upcomingCheckups.length === 0,
    [data],
  );

  return (
    <div class="report">
      <div class="report-toolbar">
        <Button variant="text" href="/analysis">{t('web_report_back')}</Button>
        <SegmentedControl
          label={t('web_period_label')}
          options={periodOptions()}
          value={period}
          onChange={(value) => { analysisPeriod.value = value; }}
        />
        <Button onClick={() => window.print()} disabled={data === undefined}>{t('web_print_report')}</Button>
        <p class="text-muted text-sm report-hint">{t('web_print_hint')} {t('web_report_note')}</p>
      </div>
      {data !== undefined && (empty
        ? <EmptyState level={1} title={t('report_title')} description={t('report_no_data')} />
        : <ReportView data={data} />)}
    </div>
  );
}

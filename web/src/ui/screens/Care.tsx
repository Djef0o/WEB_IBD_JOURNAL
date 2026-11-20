import '../care/care.css';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { getAllCheckups } from '../../db/checkups';
import { getAllDoseLogs } from '../../db/doses';
import { getAllExams } from '../../db/exams';
import { getAllLabResults } from '../../db/labs';
import { getAllMedications } from '../../db/medications';
import { adherence } from '../../domain/adherence';
import { anesthesiaMissing, examSteps } from '../../domain/examPlan';
import type { DoseLog } from '../../domain/health';
import type { Exam } from '../../domain/models';
import type { Checkup, Medication } from '../../domain/profile';
import { dateOf, localDateTimeAt, minusDays, type LocalDateTime } from '../../domain/time';
import { t, tp } from '../../i18n';
import { notificationPermission, requestNotificationPermission } from '../../reminders/notify';
import {
  CHECKUP_TYPE_LABEL, dateTimeLabel, EXAM_STEP_LABEL, EXAM_TYPE_LABEL, scheduleStatus, weekdayDayMonth,
} from '../../reminders/text';
import { useClock } from '../../reminders/useClock';
import type { ScreenProps } from '../../router';
import { Button, Card } from '../components';
import { formatLocalDate } from '../format';
import { CheckupEditor } from '../care/CheckupEditor';
import { ExamEditor } from '../care/ExamEditor';
import { ChevronIcon, ReminderIcon } from '../care/icons';
import { summarizeLabs } from '../care/labSummary';
import { MedicationEditor, refillStatus } from '../care/MedicationEditor';
import { TravelLink } from './travel/TravelLink';
import { ActivityScoresSection } from '../care/scores/ActivityScoresSection';
import { AppointmentsSection } from '../care/appointments/AppointmentsSection';
import { QuestionsSection } from '../care/questions/QuestionsSection';
import { getAllAppointments } from '../../db/followup';
import { stockStatus } from '../care/stockStatus';
import { FlaresSection } from '../care/flares/FlaresSection';
import { SteroidsSection } from '../care/steroids/SteroidsSection';
import { VaccinationsSection } from '../care/vaccinations/VaccinationsSection';

/** Adherence window shown under each treatment, today included. */
const ADHERENCE_DAYS = 30;

type Editing =
  | { kind: 'medication'; item: Medication | null }
  | { kind: 'checkup'; item: Checkup | null }
  | { kind: 'exam'; item: Exam | null };

/** "Adherence (30 days): 26/28 doses taken (93%)", or null while no dose has been answered. */
function adherenceStatus(medication: Medication, logs: readonly DoseLog[], now: LocalDateTime): string | null {
  const result = adherence(medication, [...logs], minusDays(dateOf(now), ADHERENCE_DAYS - 1), now);
  // Without any answer, "0 %" would suggest missed doses.
  if (result.expected === 0 || result.taken + result.missed === 0) return null;
  const percent = Math.round((result.taken * 100) / result.expected);
  return tp('treatment_adherence', result.expected, [result.taken, result.expected, percent]);
}

function Row({ title, lines, warning, muted, bell, onClick }: {
  title: string;
  lines: readonly string[];
  warning?: string | null;
  muted?: boolean;
  bell?: boolean | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" class="care-row" data-muted={muted ? '' : undefined} onClick={onClick}>
        <span class="care-row-text">
          <span class="care-row-title">{title}</span>
          {lines.length > 0 && <span class="care-row-detail text-muted text-sm">{lines.join('\n')}</span>}
          {warning && <span class="care-row-detail text-error text-sm">{warning}</span>}
        </span>
        {bell !== null && bell !== undefined && <ReminderIcon enabled={bell} />}
      </button>
    </li>
  );
}

function Section({ title, empty, addLabel, onAdd, isEmpty, children }: {
  title: string;
  empty: string;
  addLabel: string;
  onAdd: () => void;
  isEmpty: boolean;
  children: ComponentChildren;
}) {
  return (
    <Card title={title}>
      {isEmpty ? <p class="text-muted">{empty}</p> : <ul class="care-list">{children}</ul>}
      <div>
        <Button variant="tonal" onClick={onAdd}>{addLabel}</Button>
      </div>
    </Card>
  );
}

/** Soins : traitements, prises de sang et de selles, examens, accès aux résultats de labo. */
export default function Care(_props: ScreenProps) {
  const clock = useClock();
  const now = localDateTimeAt(clock);
  const [editing, setEditing] = useState<Editing | null>(null);
  const permission = notificationPermission.value;
  const appointments = useLiveQuery(['appointments'], getAllAppointments);

  const data = useLiveQuery(
    ['medications', 'checkups', 'exams', 'dose_logs', 'lab_results'],
    async () => ({
      medications: await getAllMedications(),
      checkups: await getAllCheckups(),
      exams: await getAllExams(),
      doseLogs: await getAllDoseLogs(),
      labResults: await getAllLabResults(),
    }),
  );

  const close = (): void => setEditing(null);
  const editor = editing && (
    editing.kind === 'medication' ? <MedicationEditor initial={editing.item} onClose={close} />
      : editing.kind === 'checkup' ? <CheckupEditor initial={editing.item} onClose={close} />
        : <ExamEditor initial={editing.item} onClose={close} />
  );

  if (!data) return <h1 class="page-title">{t('care_title')}</h1>;

  // Upcoming: nearest first; past ones after, from most recent to oldest.
  const upcomingExams = data.exams.filter((e) => e.at >= now).sort((a, b) => (a.at < b.at ? -1 : 1));
  const pastExams = data.exams.filter((e) => e.at < now).sort((a, b) => (a.at < b.at ? 1 : -1));
  const anyReminder = data.medications.some((m) => m.schedule.enabled || m.refillAlert)
    || data.checkups.some((c) => c.schedule.enabled)
    || upcomingExams.some((e) => e.remindersEnabled)
    || (appointments ?? []).some((a) => a.remindersEnabled && a.at >= now);
  const labs = summarizeLabs(data.labResults);

  return (
    <>
      <h1 class="page-title">{t('care_title')}</h1>
      {anyReminder && permission === 'default' && (
        <div class="callout care-permission" role="status">
          <p>{t('web_care_notif_needed')}</p>
          <p class="text-sm">{t('web_notif_desc')}</p>
          <div>
            <Button variant="tonal" onClick={() => void requestNotificationPermission()}>{t('web_notif_enable')}</Button>
          </div>
        </div>
      )}
      <div class="care-grid">
        <Section
          title={t('treatments_title')}
          empty={t('treatments_empty')}
          addLabel={t('treatment_add')}
          onAdd={() => setEditing({ kind: 'medication', item: null })}
          isEmpty={data.medications.length === 0}
        >
          {data.medications.map((medication) => (
            <Row
              key={medication.id}
              title={[medication.name, medication.dosage].filter((s) => s.trim() !== '').join(' · ')}
              lines={[
                scheduleStatus(medication.schedule, now),
                stockStatus(medication),
                refillStatus(medication, now),
                adherenceStatus(medication, data.doseLogs, now),
              ].filter((s): s is string => s !== null)}
              bell={medication.schedule.enabled}
              onClick={() => setEditing({ kind: 'medication', item: medication })}
            />
          ))}
        </Section>

        <Section
          title={t('checkups_title')}
          empty={t('checkups_empty')}
          addLabel={t('checkup_add')}
          onAdd={() => setEditing({ kind: 'checkup', item: null })}
          isEmpty={data.checkups.length === 0}
        >
          {data.checkups.map((checkup) => (
            <Row
              key={checkup.id}
              title={[CHECKUP_TYPE_LABEL[checkup.type](), checkup.note].filter((s) => s.trim() !== '').join(' · ')}
              lines={[scheduleStatus(checkup.schedule, now)]}
              bell={checkup.schedule.enabled}
              onClick={() => setEditing({ kind: 'checkup', item: checkup })}
            />
          ))}
        </Section>

        <Section
          title={t('exams_title')}
          empty={t('exams_empty')}
          addLabel={t('exam_add')}
          onAdd={() => setEditing({ kind: 'exam', item: null })}
          isEmpty={data.exams.length === 0}
        >
          {[...upcomingExams, ...pastExams].map((exam) => {
            const upcoming = exam.at >= now;
            const next = upcoming ? examSteps(exam).find((s) => s.at >= now && s.step !== 'EXAM') : undefined;
            const nextLine = next && t('exam_next_step', [
              EXAM_STEP_LABEL[next.step](),
              // The diet starts on a given day: the reminder time adds nothing.
              next.step === 'DIET' ? weekdayDayMonth(dateOf(next.at)) : dateTimeLabel(next.at),
            ]);
            return (
              <Row
                key={exam.id}
                title={`${EXAM_TYPE_LABEL[exam.type]()} · ${dateTimeLabel(exam.at)}`}
                lines={[exam.note.trim() === '' ? null : exam.note, nextLine].filter((s): s is string => Boolean(s))}
                warning={upcoming && anesthesiaMissing(exam) ? t('exam_anesthesia_missing') : null}
                muted={!upcoming}
                bell={upcoming ? exam.remindersEnabled : null}
                onClick={() => setEditing({ kind: 'exam', item: exam })}
              />
            );
          })}
        </Section>

        <QuestionsSection />
        <AppointmentsSection />
        <FlaresSection />

        <ActivityScoresSection />
        <VaccinationsSection />
        <SteroidsSection />
        <Card title={t('lab_results_title')}>
          <a class="care-lab-link" href="/care/labs">
            <span class="care-row-text">
              <span class="care-row-title">
                {labs.latest === null ? t('lab_results_empty') : t('lab_summary_latest', [formatLocalDate(labs.latest)])}
              </span>
              {labs.tests > 0 && <span class="text-muted text-sm">{tp('lab_summary_tests', labs.tests)}</span>}
              {labs.outside > 0 && <span class="text-error text-sm">{tp('lab_summary_outside', labs.outside)}</span>}
            </span>
            <ChevronIcon />
          </a>
        </Card>

        <TravelLink />

      </div>
      {editor}
    </>
  );
}

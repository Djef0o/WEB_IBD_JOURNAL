import './reminders.css';
import { useLiveQuery } from '../db';
import { getAllCheckups } from '../db/checkups';
import { getAllDoseLogs, logDose } from '../db/doses';
import { getAllExams } from '../db/exams';
import { getAllMedications } from '../db/medications';
import { doseScheduledAt } from '../domain/adherence';
import type { DoseStatus } from '../domain/health';
import { localDateTimeAt, dateOf } from '../domain/time';
import { t } from '../i18n';
import { Card } from '../ui/components';
import { checkupTitle, doseText, examStepText, examStepTitle, refillText, timeLabel } from './text';
import { todayTasks, type TodayTask } from './today';
import { useClock } from './useClock';

const STATUSES: readonly { status: DoseStatus; label: () => string }[] = [
  { status: 'TAKEN', label: () => t('dose_taken') },
  { status: 'MISSED', label: () => t('dose_missed') },
];

function DoseRow({ task }: { task: Extract<TodayTask, { type: 'dose' }> }) {
  const { due } = task;
  const scheduledAt = doseScheduledAt(due);
  return (
    <li class="today-item">
      <div class="today-text">
        <span class="today-time text-muted text-sm">{timeLabel(due.at)}</span>
        <span class="today-title">{doseText(due.medication)}</span>
      </div>
      <div class="today-actions" role="group" aria-label={due.medication.name}>
        {STATUSES.map(({ status, label }) => (
          <button
            key={status}
            type="button"
            class="chip"
            data-status={status}
            aria-pressed={due.status === status}
            // Tapping the active status again clears it (`TodayDosesViewModel.toggle`).
            onClick={() => void logDose(due.medication.id, scheduledAt, due.status === status ? null : status)}
          >
            {label()}
          </button>
        ))}
      </div>
    </li>
  );
}

function TaskText({ task }: { task: Exclude<TodayTask, { type: 'dose' }> }) {
  let title: string;
  let detail: string;
  switch (task.type) {
    case 'refill':
      title = t('refill_reminder_title');
      detail = refillText(task.medication, task.at);
      break;
    case 'checkup':
      title = checkupTitle(task.checkup);
      detail = t('checkup_reminder_text');
      break;
    case 'exam':
      title = examStepTitle(task.exam, task.step.step);
      detail = examStepText(task.exam, task.step.step, task.step.at);
      break;
  }
  return (
    <li class="today-item">
      <div class="today-text">
        <span class="today-time text-muted text-sm">{timeLabel(task.at)}</span>
        <span class="today-title">{title}</span>
        <span class="text-muted text-sm">{detail}</span>
      </div>
    </li>
  );
}

/**
 * « À faire aujourd'hui » : doses du jour à confirmer (pris / oublié), contrôles, alertes de
 * renouvellement et étapes d'examen du jour. Remplace les rappels en arrière-plan d'Android.
 * Rien à afficher : pas de carte.
 */
export default function TodayTasksCard() {
  const now = useClock();
  const today = dateOf(localDateTimeAt(now));
  const data = useLiveQuery(
    ['medications', 'checkups', 'exams', 'dose_logs'],
    async () => ({
      medications: await getAllMedications(),
      checkups: await getAllCheckups(),
      exams: await getAllExams(),
      doseLogs: await getAllDoseLogs(),
    }),
  );
  if (!data) return null;
  const tasks = todayTasks({ date: today, ...data });
  if (tasks.length === 0) return null;
  return (
    <Card title={t('web_today_title')}>
      <ul class="today-list">
        {tasks.map((task, i) =>
          task.type === 'dose'
            ? <DoseRow key={`dose:${task.due.medication.id}:${task.at}`} task={task} />
            : <TaskText key={`${task.type}:${task.at}:${i}`} task={task} />)}
      </ul>
    </Card>
  );
}

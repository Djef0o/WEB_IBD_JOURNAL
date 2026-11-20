import './reminders.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../db';
import { getAllDoseLogs, logDose } from '../db/doses';
import { getAllWeights, saveWeight } from '../db/weights';
import { doseScheduledAt } from '../domain/adherence';
import type { DoseStatus } from '../domain/health';
import { localDateTimeAt, dateOf } from '../domain/time';
import { parseWeightKg } from '../domain/weighIn';
import { t } from '../i18n';
import { Button, Card, showToast } from '../ui/components';
import { TextField } from '../ui/forms';
import { formatDecimal } from '../ui/format';
import { loadReminderData, REMINDER_STORES } from './data';
import {
  appointmentText, backupText, checkupTitle, doseText, examStepText, examStepTitle, lowStockContent, refillText,
  timeLabel, vaccineText,
} from './text';
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

/** Weigh-in: the weight is typed right in the card (Android types it in the notification). */
function WeighInRow({ task, date }: { task: Extract<TodayTask, { type: 'weighIn' }>; date: string }) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const kg = parseWeightKg(text);
  const save = (e: Event): void => {
    e.preventDefault();
    setSubmitted(true);
    if (kg === null) return;
    void saveWeight({ id: 0, date, kg }).then(() => showToast(t('weigh_in_recorded', [formatDecimal(kg)])));
  };
  return (
    <li class="today-item">
      <div class="today-text">
        <span class="today-time text-muted text-sm">{timeLabel(task.at)}</span>
        <span class="today-title">{t('weigh_in_title')}</span>
        <span class="text-muted text-sm">{t('weigh_in_text')}</span>
      </div>
      <form class="today-weigh-in" onSubmit={save} noValidate>
        <TextField
          label={t('weigh_in_input_hint')}
          value={text}
          onInput={setText}
          inputMode="decimal"
          autocomplete="off"
          required
          error={kg === null ? t('weigh_in_invalid') : null}
          showError={submitted}
        />
        <Button type="submit" variant="tonal">{t('weigh_in_action')}</Button>
      </form>
    </li>
  );
}

function TaskText({ task }: { task: Exclude<TodayTask, { type: 'dose' | 'weighIn' }> }) {
  let title: string;
  let detail: string;
  let href: string | null = null;
  switch (task.type) {
    case 'refill':
      title = t('refill_reminder_title');
      detail = refillText(task.medication, task.at);
      break;
    case 'lowStock': {
      const content = lowStockContent(task.medication);
      title = content?.title ?? task.medication.name;
      detail = content?.body ?? '';
      break;
    }
    case 'checkup':
      title = checkupTitle(task.checkup);
      detail = t('checkup_reminder_text');
      break;
    case 'exam':
      title = examStepTitle(task.exam, task.step.step);
      detail = examStepText(task.exam, task.step.step, task.step.at);
      break;
    case 'vaccine':
      title = t('vaccine_reminder_title');
      detail = vaccineText(task.vaccination.type, task.due);
      break;
    case 'appointment':
      title = t('appointment_reminder_title');
      detail = appointmentText(task.appointment);
      break;
    case 'backup':
      title = t('backup_reminder_title');
      detail = backupText(task.lastBackup);
      href = '/settings';
      break;
  }
  return (
    <li class="today-item">
      <div class="today-text">
        <span class="today-time text-muted text-sm">{timeLabel(task.at)}</span>
        <span class="today-title">{href === null ? title : <a href={href}>{title}</a>}</span>
        <span class="text-muted text-sm" style={{ whiteSpace: 'pre-line' }}>{detail}</span>
      </div>
    </li>
  );
}

/**
 * « À faire aujourd'hui » : doses du jour à confirmer (pris / oublié), contrôles, alertes de
 * renouvellement et de stock bas, étapes d'examen, rendez-vous, vaccins, pesée de la semaine et
 * sauvegarde en retard. Remplace les rappels en arrière-plan d'Android. Rien à afficher : pas de carte.
 */
export default function TodayTasksCard() {
  const now = useClock();
  const today = dateOf(localDateTimeAt(now));
  const data = useLiveQuery(
    [...REMINDER_STORES, 'dose_logs', 'weights'],
    async () => ({
      ...(await loadReminderData()),
      doseLogs: await getAllDoseLogs(),
      weights: await getAllWeights(),
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
            : task.type === 'weighIn'
              ? <WeighInRow key="weigh-in" task={task} date={today} />
              : <TaskText key={`${task.type}:${task.at}:${i}`} task={task} />)}
      </ul>
    </Card>
  );
}

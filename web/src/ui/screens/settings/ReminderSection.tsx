import './settings.css';
import { notificationSettings, updateNotificationSettings } from '../../../db/prefs';
import { dateOf, dateTimeParts, localDateTimeAt, minusDays, today } from '../../../domain/time';
import { t } from '../../../i18n';
import { notificationPermission, sendTestNotification } from '../../../reminders/notify';
import { Button, Card, Switch } from '../../components';
import { TextField } from '../../forms';
import { formatLocalDate, formatTime } from '../../format';
import { NotificationPermission } from './NotificationPermission';

const pad = (n: number): string => String(n).padStart(2, '0');

/** "Today at 19:00", "Yesterday at …" or "12 March at …" (`formatReminderMoment`). */
export function formatReminderMoment(epochMillis: number, now: string = today()): string {
  const moment = localDateTimeAt(epochMillis);
  const date = dateOf(moment);
  const { hour, minute } = dateTimeParts(moment);
  const time = formatTime(hour, minute);
  if (date === now) return t('today_at', [time]);
  if (date === minusDays(now, 1)) return t('yesterday_at', [time]);
  return t('date_at', [formatLocalDate(date, { day: 'numeric', month: 'long' }), time]);
}

/** Rappel du soir (heure) et notifications locales, affichées seulement pendant que l'app est ouverte. */
export function ReminderSection() {
  const settings = notificationSettings.value;
  const last = settings?.lastReminderAt ?? null;
  return (
    <Card title={t('web_notif_title')}>
      <p class="text-muted">{t('web_notif_desc')}</p>
      <Switch
        label={t('daily_reminder')}
        description={t('web_evening_reminder_desc')}
        checked={settings?.enabled ?? false}
        disabled={!settings}
        onChange={(enabled) => {
          if (settings) void updateNotificationSettings(enabled, settings.hour, settings.minute);
        }}
      />
      <TextField
        label={t('reminder_time')}
        type="time"
        value={settings ? `${pad(settings.hour)}:${pad(settings.minute)}` : ''}
        disabled={!settings}
        required
        onInput={(v) => {
          const m = /^(\d{2}):(\d{2})/.exec(v);
          if (settings && m) void updateNotificationSettings(settings.enabled, Number(m[1]), Number(m[2]));
        }}
      />
      <div>
        <p class="setting-title">{t('last_reminder')}</p>
        <p class="text-muted" role="status">
          {settings === undefined ? '' : last === null ? t('last_reminder_never') : formatReminderMoment(last)}
        </p>
      </div>
      <NotificationPermission />
      {notificationPermission.value === 'granted' && (
        <div class="setting-row">
          <div>
            <p class="setting-title">{t('test_notification')}</p>
            <p class="text-muted text-sm">{t('test_notification_desc')}</p>
          </div>
          <Button variant="outlined" onClick={() => void sendTestNotification()}>{t('test_notification')}</Button>
        </div>
      )}
    </Card>
  );
}

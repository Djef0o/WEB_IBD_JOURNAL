import './settings.css';
import { notificationSettings, updateNotificationSettings } from '../../../db/prefs';
import { t } from '../../../i18n';
import { Card, Switch } from '../../components';
import { TextField } from '../../forms';
import { NotificationPermission } from './NotificationPermission';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Rappel du soir (heure) et notifications locales, affichées seulement pendant que l'app est ouverte. */
export function ReminderSection() {
  const settings = notificationSettings.value;
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
      <NotificationPermission />
    </Card>
  );
}

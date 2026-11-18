import { notificationPermission, requestNotificationPermission } from '../../../reminders/notify';
import { t } from '../../../i18n';
import { Button } from '../../components';

/** L'autorisation n'est demandée qu'au clic, jamais au chargement de la page. */
export function NotificationPermission() {
  const state = notificationPermission.value;
  if (state === 'unsupported') return <p class="text-muted">{t('web_notif_unsupported')}</p>;
  if (state === 'granted') return <p role="status">{t('web_notif_enabled')}</p>;
  if (state === 'denied') return <p class="text-error" role="status">{t('web_notif_denied')}</p>;
  return (
    <div>
      <Button variant="tonal" onClick={() => void requestNotificationPermission()}>{t('web_notif_enable')}</Button>
    </div>
  );
}

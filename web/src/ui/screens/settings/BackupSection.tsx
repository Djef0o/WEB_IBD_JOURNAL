import './settings.css';
import { useState } from 'preact/hooks';
import { lastBackupAt } from '../../../db/prefs';
import { formatDate, t } from '../../../i18n';
import { ExportBackupDialog } from '../../backup/ExportBackupDialog';
import { ImportBackupButton } from '../../backup/ImportBackup';
import { Button, Card } from '../../components';

/**
 * Sauvegarde chiffrée : export `.ibdj` (mot de passe choisi), import avec confirmation.
 * Rappel d'exports réguliers : les données ne vivent que dans ce navigateur.
 */
export function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const last = lastBackupAt.value;
  const lastLabel =
    last === undefined
      ? ''
      : last === null
        ? t('web_backup_never')
        : t('web_backup_last_export', [formatDate(last, { dateStyle: 'medium', timeStyle: 'short' })]);

  return (
    <>
      <Card title={t('data_management')}>
        <div class="callout">
          <h3>{t('web_backup_reminder_title')}</h3>
          <p>{t('web_backup_reminder_text')}</p>
        </div>
        <p class="text-muted" role="status">{lastLabel}</p>
        <div class="stack-sm">
          <div class="setting-row">
            <div>
              <p class="setting-title">{t('export_data')}</p>
              <p class="text-muted text-sm">{t('backup_export_desc')}</p>
            </div>
            <Button variant="filled" onClick={() => setExporting(true)}>{t('web_backup_export_now')}</Button>
          </div>
          <div class="setting-row">
            <div>
              <p class="setting-title">{t('import_data')}</p>
              <p class="text-muted text-sm">{t('web_backup_import_desc')}</p>
            </div>
            <ImportBackupButton variant="outlined">{t('import_data')}</ImportBackupButton>
          </div>
        </div>
      </Card>
      <ExportBackupDialog open={exporting} onClose={() => setExporting(false)} />
    </>
  );
}

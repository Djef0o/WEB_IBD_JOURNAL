import './settings.css';
import { useEffect, useState } from 'preact/hooks';
import { backupSettingsSignal, ensureBackupSince, setBackupReminderEnabled } from '../../../db/prefs';
import { isBackupOverdue } from '../../../domain/backupReminders';
import { today } from '../../../domain/time';
import { t } from '../../../i18n';
import { ExportBackupDialog } from '../../backup/ExportBackupDialog';
import { ImportBackupButton } from '../../backup/ImportBackup';
import { Button, Card, Switch } from '../../components';
import { formatLocalDate } from '../../format';
import { CsvExportRow } from './CsvExportSection';

/**
 * Sauvegarde chiffrée : export `.ibdj` (mot de passe choisi), import avec confirmation, état de la
 * dernière sauvegarde (en rouge au bout d'un mois, `isBackupOverdue`) et rappel mensuel, export CSV.
 * Rappel d'exports réguliers : les données ne vivent que dans ce navigateur.
 */
export function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const settings = backupSettingsSignal.value;
  // Start of the reminder countdown while there is no backup: set once, at first use.
  useEffect(() => { void ensureBackupSince(today()); }, []);

  const last = settings?.lastBackup ?? null;
  const overdue = settings !== undefined && isBackupOverdue(last, today());

  return (
    <>
      <Card title={t('data_management')}>
        <div class="callout">
          <h3>{t('web_backup_reminder_title')}</h3>
          <p>{t('web_backup_reminder_text')}</p>
        </div>
        <div>
          <p class="setting-title">{t('backup_status_title')}</p>
          <p class={overdue ? 'text-error' : 'text-muted'} role="status">
            {settings === undefined
              ? ''
              : last === null
                ? t('backup_status_never')
                : t('backup_status_last', [formatLocalDate(last)])}
          </p>
        </div>
        <Switch
          label={t('backup_reminder_switch')}
          description={t('backup_reminder_desc')}
          checked={settings?.reminderEnabled ?? true}
          disabled={!settings}
          onChange={(enabled) => void setBackupReminderEnabled(enabled)}
        />
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
          <CsvExportRow />
        </div>
      </Card>
      <ExportBackupDialog open={exporting} onClose={() => setExporting(false)} />
    </>
  );
}

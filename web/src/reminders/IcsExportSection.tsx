import './reminders.css';
import { useState } from 'preact/hooks';
import { getAllCheckups } from '../db/checkups';
import { getAllExams } from '../db/exams';
import { getAllMedications } from '../db/medications';
import { localDateTimeAt, today } from '../domain/time';
import { t } from '../i18n';
import { Button, Card, Dialog, showToast } from '../ui/components';
import { downloadBlob } from '../ui/download';
import { buildCalendarFile } from './calendarExport';

/**
 * Export `.ics` des traitements, contrôles et étapes d'examen (remplace la synchro du
 * calendrier du téléphone). Avant le téléchargement : avertissement de confidentialité de
 * `CalendarSection.kt`, car les noms de traitements et d'examens entrent dans l'agenda.
 */
export function IcsExportSection() {
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function prepare(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const data = {
        medications: await getAllMedications(),
        checkups: await getAllCheckups(),
        exams: await getAllExams(),
      };
      const exportedAt = Date.now();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { text, count } = buildCalendarFile(data, localDateTimeAt(exportedAt), exportedAt, timeZone);
      if (count === 0) showToast(t('web_export_ics_empty'));
      else setPending(text);
    } finally {
      setBusy(false);
    }
  }

  function download(text: string): void {
    setPending(null);
    downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `ibd-journal-${today()}.ics`);
    showToast(t('web_export_ics_done'));
  }

  return (
    <Card title={t('web_export_ics')} headingLevel={2}>
      <p class="text-muted">{t('web_export_ics_desc')}</p>
      <div>
        <Button variant="tonal" onClick={() => void prepare()} aria-disabled={busy || undefined}>{t('web_export_ics')}</Button>
      </div>
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t('calendar_privacy_title')}
        closeLabel={t('close')}
        variant="center"
      >
        <div class="stack">
          <p>{t('web_ics_privacy_message')}</p>
          <div class="dialog-actions">
            <Button variant="text" onClick={() => setPending(null)}>{t('cancel')}</Button>
            <Button onClick={() => pending !== null && download(pending)}>{t('web_ics_privacy_confirm')}</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

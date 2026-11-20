import './settings.css';
import { useId, useState } from 'preact/hooks';
import { emergencySignal, getEmergencyInfo, saveEmergencyInfo } from '../../../db/emergency';
import { emergencyInfo, type EmergencyInfo } from '../../../domain/care';
import { emergencyInfoFilled } from '../../../domain/emergencySheet';
import { t } from '../../../i18n';
import { navigate } from '../../../router';
import { Button, Card, Dialog, Sheet, Switch } from '../../components';
import { TextField } from '../../forms';
import { EmergencySheet } from '../../emergency/EmergencySheet';
import { MedicalInfoIcon, ToiletIcon } from '../../emergency/icons';
import { useEmergencyData } from '../../emergency/useEmergencyData';

/** Textarea with a visible label and optional placeholder. */
function TextArea({ label, value, onInput, placeholder, rows }: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  rows: number;
}) {
  const id = useId();
  return (
    <div class="field">
      <label class="field-name" for={id}>{label}</label>
      <textarea
        id={id}
        class="input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        autocapitalize="sentences"
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </div>
  );
}

/** Telephone number field (the shared text field has no `tel` type). */
function PhoneField({ label, value, onInput }: { label: string; value: string; onInput: (value: string) => void }) {
  const id = useId();
  return (
    <div class="field">
      <label class="field-name" for={id}>{label}</label>
      <input id={id} class="input" type="tel" autocomplete="off" value={value} onInput={(e) => onInput(e.currentTarget.value)} />
    </div>
  );
}

/** Sheet to edit the emergency fields (`EmergencyEditorSheet`); the lock-screen option has its own switch. */
function EmergencyEditor({ info, onClose }: { info: EmergencyInfo; onClose: () => void }) {
  const [draft, setDraft] = useState(info);
  const [busy, setBusy] = useState(false);
  const patch = (changes: Partial<EmergencyInfo>): void => setDraft((d) => ({ ...d, ...changes }));

  async function submit(e: Event): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // Saved on top of the stored sheet: the lock-screen switch may have been flipped meanwhile.
    const stored = (await getEmergencyInfo()) ?? info;
    await saveEmergencyInfo({
      ...stored,
      allergies: draft.allergies.trim(),
      doctorName: draft.doctorName.trim(),
      doctorPhone: draft.doctorPhone.trim(),
      contactName: draft.contactName.trim(),
      contactPhone: draft.contactPhone.trim(),
      notes: draft.notes.trim(),
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('emergency_edit_title')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" onSubmit={(e) => void submit(e)}>
        <p class="text-muted">{t('emergency_edit_help')}</p>
        <TextArea label={t('emergency_allergies')} placeholder={t('emergency_allergies_hint')} rows={2} value={draft.allergies} onInput={(allergies) => patch({ allergies })} />
        <TextField label={t('emergency_doctor_name')} value={draft.doctorName} onInput={(doctorName) => patch({ doctorName })} autocapitalize="words" autocomplete="off" />
        <PhoneField label={t('emergency_doctor_phone')} value={draft.doctorPhone} onInput={(doctorPhone) => patch({ doctorPhone })} />
        <TextField label={t('emergency_contact_name')} value={draft.contactName} onInput={(contactName) => patch({ contactName })} autocapitalize="words" autocomplete="off" />
        <PhoneField label={t('emergency_contact_phone')} value={draft.contactPhone} onInput={(contactPhone) => patch({ contactPhone })} />
        <TextArea label={t('emergency_notes')} placeholder={t('emergency_notes_hint')} rows={3} value={draft.notes} onInput={(notes) => patch({ notes })} />
        <div class="dialog-actions">
          <span class="spacer" />
          <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" aria-disabled={busy || undefined}>{t('save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Emergency sheet fields, lock screen access and previews of the two emergency screens
 * (`EmergencySection`). Turning on the lock screen access asks for confirmation: the sheet then
 * needs no PIN.
 */
export function EmergencySection() {
  const stored = emergencySignal.value;
  const info = stored ?? emergencyInfo();
  const data = useEmergencyData();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sheet, setSheet] = useState(false);

  const setLockScreen = (showOnLockScreen: boolean): Promise<void> => saveEmergencyInfo({ ...info, showOnLockScreen });

  return (
    <>
      <Card title={t('emergency_title')}>
        <div class="setting-row">
          <div>
            <p class="setting-title">{t('emergency_info_row')}</p>
            <p class="text-muted">{t(emergencyInfoFilled(info) ? 'emergency_info_filled' : 'emergency_info_empty')}</p>
          </div>
          <Button variant="tonal" onClick={() => setEditing(true)} aria-disabled={stored === undefined || undefined}>{t('modify')}</Button>
        </div>
        <Switch
          label={t('emergency_lock_switch')}
          description={t('emergency_lock_warning')}
          checked={info.showOnLockScreen}
          disabled={stored === undefined}
          onChange={(on) => {
            if (on) setConfirming(true);
            else void setLockScreen(false);
          }}
        />
        <div class="setting-row">
          <div>
            <p class="setting-title">{t('emergency_preview_sheet')}</p>
          </div>
          <Button variant="outlined" icon={<MedicalInfoIcon size={20} />} onClick={() => setSheet(true)}>{t('emergency_open_sheet')}</Button>
        </div>
        <div class="setting-row">
          <div>
            <p class="setting-title">{t('emergency_preview_card')}</p>
            <p class="text-muted text-sm">{t('emergency_preview_card_sub')}</p>
          </div>
          <Button variant="outlined" icon={<ToiletIcon size={20} />} onClick={() => void navigate('/urgent')}>{t('emergency_open_card')}</Button>
        </div>
      </Card>
      {editing && <EmergencyEditor info={info} onClose={() => setEditing(false)} />}
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('emergency_lock_confirm_title')} closeLabel={t('close')} variant="center">
        <div class="stack">
          <p>{t('emergency_lock_confirm_text')}</p>
          <div class="dialog-actions">
            <span class="spacer" />
            <Button variant="text" onClick={() => setConfirming(false)}>{t('cancel')}</Button>
            <Button onClick={() => { setConfirming(false); void setLockScreen(true); }}>{t('emergency_lock_confirm')}</Button>
          </div>
        </div>
      </Dialog>
      {data && <EmergencySheet data={data} open={sheet} onClose={() => setSheet(false)} />}
    </>
  );
}

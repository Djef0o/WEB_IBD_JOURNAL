import './emergency.css';
import { useState } from 'preact/hooks';
import { navigate } from '../../router';
import { t } from '../../i18n';
import { Button, Dialog } from '../components';
import { EmergencySheet } from './EmergencySheet';
import { MedicalInfoIcon, ToiletIcon } from './icons';
import { useEmergencyData } from './useEmergencyData';

/** Home header entry point: asks for the urgent-need card or the emergency sheet (`EmergencyChooserDialog`). */
export function EmergencyButton() {
  const [choosing, setChoosing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const data = useEmergencyData();

  return (
    <>
      <button type="button" class="icon-btn emergency-btn" aria-label={t('emergency_chooser_title')} onClick={() => setChoosing(true)}>
        <MedicalInfoIcon />
      </button>
      <Dialog open={choosing} onClose={() => setChoosing(false)} title={t('emergency_chooser_title')} closeLabel={t('close')} variant="center">
        <div class="stack">
          <div class="emergency-choices">
            <Button icon={<ToiletIcon />} onClick={() => { setChoosing(false); void navigate('/urgent'); }}>
              {t('emergency_open_card')}
            </Button>
            <Button variant="tonal" icon={<MedicalInfoIcon />} onClick={() => { setChoosing(false); setSheet(true); }}>
              {t('emergency_open_sheet')}
            </Button>
          </div>
          <div class="dialog-actions">
            <span class="spacer" />
            <Button variant="text" onClick={() => setChoosing(false)}>{t('cancel')}</Button>
          </div>
        </div>
      </Dialog>
      {data && <EmergencySheet data={data} open={sheet} onClose={() => setSheet(false)} />}
    </>
  );
}

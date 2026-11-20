import './emergency.css';
import { useEffect, useState } from 'preact/hooks';
import { getLockScreenEmergency } from '../../db/emergencyLock';
import type { EmergencyData } from '../../domain/emergencySheet';
import { t } from '../../i18n';
import { Button } from '../components';
import { EmergencySheet } from './EmergencySheet';
import { UrgentCard } from './UrgentCard';

/**
 * Emergency entries of the PIN lock screen: the urgent-need card always, the emergency sheet only
 * when the user allowed it (it is read from the lock-screen copy, the journal stays locked).
 */
export function LockScreenEmergency() {
  const [data, setData] = useState<EmergencyData | null>(null);
  const [card, setCard] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let active = true;
    getLockScreenEmergency().then(
      (copy) => { if (active) setData(copy); },
      (error: unknown) => console.error(error),
    );
    return () => { active = false; };
  }, []);

  return (
    <>
      <div class="lock-actions">
        <Button variant="text" onClick={() => setCard(true)}>{t('emergency_open_card')}</Button>
        {data && <Button variant="text" onClick={() => setSheet(true)}>{t('emergency_open_sheet')}</Button>}
      </div>
      {card && <UrgentCard onClose={() => setCard(false)} />}
      {data && <EmergencySheet data={data} open={sheet} onClose={() => setSheet(false)} />}
    </>
  );
}

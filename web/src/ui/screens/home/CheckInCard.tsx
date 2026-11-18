import { getDailyCheckIn, notificationSettings, saveDailyCheckIn } from '../../../db/prefs';
import { useLiveQuery } from '../../../db';
import { getStool, saveStool } from '../../../db/stools';
import { t } from '../../../i18n';
import { toEpochDays, type LocalDate } from '../../../domain/time';
import { BristolPicker, Card, Scale0to5, showToast } from '../../components';
import { bristolLabel } from '../../stool/stoolText';
import {
  answerScale, applyScale, isCheckInDue, scaleAnswer, stoolForCheckIn, type CheckInScale,
} from './homeLogic';

/** Type de selle du bilan : une seule selle par jour de bilan, corrigée si on change d'avis. */
async function answerStool(date: LocalDate, bristolType: number): Promise<void> {
  const checkIn = await getDailyCheckIn(toEpochDays(date));
  const existing = checkIn.stoolId === null ? null : await getStool(checkIn.stoolId);
  const stoolId = await saveStool(stoolForCheckIn(existing, bristolType, checkIn, date));
  await saveDailyCheckIn({ ...checkIn, stoolId, bristolType });
  showToast(bristolType === 0 ? t('stool_recorded_type_0') : t('stool_recorded_format', [bristolType]));
}

/** Douleur ou fatigue : portée par la selle du bilan, ou mise en attente jusqu'à sa saisie. */
async function answerLevel(date: LocalDate, scale: CheckInScale, level: number): Promise<void> {
  const checkIn = await getDailyCheckIn(toEpochDays(date));
  const stool = checkIn.stoolId === null ? null : await getStool(checkIn.stoolId);
  if (stool) await saveStool(applyScale(stool, scale, level));
  await saveDailyCheckIn(answerScale(checkIn, scale, level));
  showToast(t(scale === 'PAIN' ? 'pain_recorded_format' : 'fatigue_recorded_format', [level]));
}

/**
 * Bilan du soir (remplace la notification interactive) : visible à partir de l'heure du rappel
 * tant que la selle, la douleur et la fatigue du jour ne sont pas toutes renseignées.
 */
export function CheckInCard({ date, minutesOfDay }: { date: LocalDate; minutesOfDay: number }) {
  const settings = notificationSettings.value;
  const epochDay = toEpochDays(date);
  const checkIn = useLiveQuery(['prefs'], () => getDailyCheckIn(epochDay), [epochDay]);
  if (!settings || !checkIn || !isCheckInDue(settings, minutesOfDay, checkIn)) return null;

  return (
    <Card title={t('web_checkin_title')} variant="outlined" class="home-card">
      <BristolPicker
        label={t('quick_stool_question')}
        value={checkIn.bristolType}
        onChange={(type) => void answerStool(date, type)}
        typeLabel={bristolLabel}
      />
      <Scale0to5
        label={t('checkin_pain_question')}
        value={scaleAnswer(checkIn, 'PAIN')}
        onChange={(level) => void answerLevel(date, 'PAIN', level)}
      />
      <p class="text-muted text-sm">{t('level_hint_pain')}</p>
      <Scale0to5
        label={t('checkin_fatigue_question')}
        value={scaleAnswer(checkIn, 'FATIGUE')}
        onChange={(level) => void answerLevel(date, 'FATIGUE', level)}
      />
      <p class="text-muted text-sm">{t('level_hint_fatigue')}</p>
    </Card>
  );
}

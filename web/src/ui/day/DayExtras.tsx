import './dayCards.css';
import { today, type LocalDate } from '../../domain/time';
import { ExtraSymptomsCard } from './ExtraSymptomsCard';
import { WellbeingCard } from './WellbeingCard';

/** Optional cards of a day (other symptoms, well-being): not offered for a day still to come (`DayScreen.kt`). */
export function DayExtras({ date }: { date: LocalDate }) {
  if (date > today()) return null;
  return (
    <div class="day-extras">
      <ExtraSymptomsCard date={date} />
      <WellbeingCard date={date} />
    </div>
  );
}

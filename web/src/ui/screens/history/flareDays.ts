import { useMemo } from 'preact/hooks';
import { flareDaysAmong } from '../../../domain/flares';
import { today, type LocalDate } from '../../../domain/time';
import { useFlares } from '../../care/flares/FlareMarks';
import { monthCells, type MonthRef } from './calendar';

/** Days of `month` covered by a flare (an ongoing one lasts through today), kept up to date. */
export function useFlareDaysOfMonth(month: MonthRef): ReadonlySet<LocalDate> {
  const flares = useFlares();
  const now = today();
  return useMemo(() => {
    const days = monthCells(month).flat().filter((d): d is LocalDate => d !== null);
    return flareDaysAmong(flares ?? [], days, now);
  }, [flares, month.year, month.month, now]);
}

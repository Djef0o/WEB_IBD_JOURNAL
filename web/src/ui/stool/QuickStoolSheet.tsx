import './stool.css';
import { useState } from 'preact/hooks';
import { saveStool } from '../../db/stools';
import { stool as newStool } from '../../domain/models';
import { fromEpochDays } from '../../domain/time';
import { t } from '../../i18n';
import { formatTime } from '../format';
import { weekdayDayMonth } from '../screens/history/labels';
import { BristolPicker, Button, Sheet, showToast } from '../components';
import { bristolLabel } from './stoolText';

export interface QuickStoolSheetProps {
  open: boolean;
  dateEpochDay: number;
  onClose: () => void;
  /** « Plus de détails » : ouvre la feuille complète avec le choix déjà fait. */
  onDetails: (bristolType: number, falseUrge: boolean) => void;
}

/** Saisie rapide : un type de Bristol 0–7 ou une fausse envie, un seul bouton (`QuickStoolSheet`). */
export function QuickStoolSheet({ open, dateEpochDay, onClose, onDetails }: QuickStoolSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={t('quick_stool_title')} closeLabel={t('close')}>
      {open && <QuickForm dateEpochDay={dateEpochDay} onClose={onClose} onDetails={onDetails} />}
    </Sheet>
  );
}

function QuickForm({ dateEpochDay, onClose, onDetails }: Omit<QuickStoolSheetProps, 'open'>) {
  const [type, setType] = useState(4);
  const [falseUrge, setFalseUrge] = useState(false);
  const now = new Date();

  const save = (e: Event) => {
    e.preventDefault();
    // Une fausse envie est enregistrée avec le type 0 : jamais comptée comme une selle.
    const bristolType = falseUrge ? 0 : type;
    void saveStool(newStool({ date: fromEpochDays(dateEpochDay), bristolType, falseUrge })).then(() => {
      showToast(falseUrge ? t('false_urge') : bristolType === 0 ? t('stool_recorded_type_0') : t('stool_recorded_format', [bristolType]));
    });
    onClose();
  };

  return (
    <form class="stack" onSubmit={save}>
      <p class="text-muted text-sm">
        {weekdayDayMonth(fromEpochDays(dateEpochDay))} · {formatTime(now.getHours(), now.getMinutes())}
      </p>
      <BristolPicker
        label={t('quick_stool_question')}
        value={falseUrge ? null : type}
        onChange={(v) => { setType(v); setFalseUrge(false); }}
        typeLabel={bristolLabel}
      />
      <button type="button" class="choice-tile" aria-pressed={falseUrge} onClick={() => setFalseUrge(!falseUrge)}>
        {t('false_urge')}
      </button>
      <div class="sheet-actions">
        <Button type="submit">{t('save')}</Button>
        <Button variant="text" onClick={() => onDetails(falseUrge ? 0 : type, falseUrge)}>{t('quick_stool_details')}</Button>
      </div>
    </form>
  );
}

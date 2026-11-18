import './stool.css';
import { useEffect, useId, useState } from 'preact/hooks';
import { deleteStool, getStool, saveStool } from '../../db/stools';
import { stool as newStool, type Stool } from '../../domain/models';
import { fromEpochDays, localDateTimeAt } from '../../domain/time';
import { t } from '../../i18n';
import { BristolIcon, BristolPicker, Button, Scale0to5, SegmentedControl, Sheet, showToast, Switch } from '../components';
import { formatLocalDate, formatTime } from '../format';
import { bristolLabel } from './stoolText';

export interface StoolSheetProps {
  open: boolean;
  dateEpochDay: number;
  /** Selle à modifier ; absent : nouvelle selle. */
  stoolId?: number;
  /** Nouvelle selle : choix déjà fait dans la saisie rapide. */
  initialBristol?: number;
  initialFalseUrge?: boolean;
  onClose: () => void;
}

/** Saisie détaillée d'une selle : Bristol, symptômes, urgence, nuit, commentaire (`StoolSheet`). */
export function StoolSheet({ open, dateEpochDay, stoolId, initialBristol, initialFalseUrge, onClose }: StoolSheetProps) {
  const falseUrgeTitle = initialFalseUrge === true;
  const title = stoolId !== undefined ? t('edit_stool') : falseUrgeTitle ? t('new_false_urge') : t('new_stool');
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={t('close')} lightDismiss={false}>
      {open && (
        <Loader
          dateEpochDay={dateEpochDay}
          stoolId={stoolId}
          initialBristol={initialBristol}
          initialFalseUrge={initialFalseUrge}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function Loader(props: Omit<StoolSheetProps, 'open'>) {
  // undefined : chargement ; null : selle introuvable (supprimée entre-temps) = nouvelle saisie.
  const [existing, setExisting] = useState<Stool | null | undefined>(props.stoolId === undefined ? null : undefined);
  useEffect(() => {
    if (props.stoolId === undefined) return;
    let live = true;
    void getStool(props.stoolId).then((s) => { if (live) setExisting(s); });
    return () => { live = false; };
  }, [props.stoolId]);
  if (existing === undefined) return null;
  return <StoolForm {...props} existing={existing} />;
}

type Kind = 'stool' | 'falseUrge';

function StoolForm({ dateEpochDay, existing, initialBristol, initialFalseUrge, onClose }: Omit<StoolSheetProps, 'open'> & { existing: Stool | null }) {
  const [bristol, setBristol] = useState(
    // Une fausse envie est enregistrée avec le type 0 : la repasser en selle repart du type 4.
    existing && !existing.falseUrge ? existing.bristolType : (initialBristol ?? 4),
  );
  const [blood, setBlood] = useState(existing?.bloodLevel ?? 0);
  const [mucus, setMucus] = useState(existing?.mucusLevel ?? 0);
  const [pain, setPain] = useState(existing?.painLevel ?? 0);
  const [fatigue, setFatigue] = useState(existing?.fatigueLevel ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [urgency, setUrgency] = useState(existing?.urgency ?? false);
  const [nocturnal, setNocturnal] = useState(existing?.nocturnal ?? false);
  const [falseUrge, setFalseUrge] = useState(existing?.falseUrge ?? initialFalseUrge ?? false);
  const [busy, setBusy] = useState(false);
  const commentId = useId();

  const createdAt = existing?.createdAt ?? Date.now();
  const moment = localDateTimeAt(createdAt);
  const date = fromEpochDays(dateEpochDay);
  const hour = Number(moment.slice(11, 13));
  const minute = Number(moment.slice(14, 16));

  const save = (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const fields = {
      date, bristolType: falseUrge ? 0 : bristol, bloodLevel: blood, mucusLevel: mucus, painLevel: pain,
      fatigueLevel: fatigue, comment, urgency, nocturnal, falseUrge,
    };
    const stool: Stool = existing ? { ...existing, ...fields } : newStool({ ...fields, createdAt });
    void saveStool(stool).then(() => {
      showToast(t('web_stool_saved'));
      onClose();
    });
  };

  const remove = () => {
    if (!existing || busy) return;
    setBusy(true);
    void deleteStool(existing.id).then(() => {
      onClose();
      showToast(t('web_stool_deleted'), {
        actionLabel: t('web_stool_undo'),
        // Même identifiant : l'annulation remet la selle exactement comme elle était.
        onAction: () => void saveStool(existing),
      });
    });
  };

  return (
    <form class="stack stool-form" onSubmit={save}>
      <div class="row">
        <p class="text-muted text-sm spacer">
          {formatLocalDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatTime(hour, minute)}
        </p>
        <BristolIcon type={falseUrge ? 0 : bristol} />
      </div>

      <SegmentedControl<Kind>
        label={t('stool_kind_stool')}
        value={falseUrge ? 'falseUrge' : 'stool'}
        onChange={(kind) => setFalseUrge(kind === 'falseUrge')}
        options={[
          { value: 'stool', label: t('stool_kind_stool') },
          { value: 'falseUrge', label: t('false_urge') },
        ]}
      />

      {falseUrge ? (
        <p class="text-muted text-sm">{t('false_urge_hint')}</p>
      ) : (
        <div class="stack-sm">
          <BristolPicker label={t('stool_type_question')} value={bristol} onChange={setBristol} typeLabel={bristolLabel} />
          <p class="stool-type-desc" aria-live="polite">{bristolLabel(bristol)}</p>
        </div>
      )}

      <div class="stack-sm">
        <div class="row-wrap stool-symptoms-head">
          <h3>{t('stool_symptoms')}</h3>
          <span class="text-muted text-sm">{t('level_hint_common')}</span>
        </div>
        <Scale0to5 label={t('blood_presence')} value={blood} onChange={setBlood} />
        <Scale0to5 label={t('mucus_presence')} value={mucus} onChange={setMucus} />
        <Scale0to5 label={t('pain')} value={pain} onChange={setPain} />
        <Scale0to5 label={t('fatigue')} value={fatigue} onChange={setFatigue} />
      </div>

      <div class="stack-sm">
        <Switch label={t('stool_urgency')} checked={urgency} onChange={setUrgency} />
        <Switch label={t('stool_nocturnal')} checked={nocturnal} onChange={setNocturnal} />
      </div>

      <div class="field">
        <label class="field-name" for={commentId}>{t('stool_comment_hint')}</label>
        <textarea
          id={commentId}
          name="comment"
          class="input"
          rows={3}
          value={comment}
          enterkeyhint="done"
          onInput={(e) => setComment(e.currentTarget.value)}
        />
      </div>

      <div class="sheet-actions sheet-actions-sticky">
        <Button type="submit" disabled={busy}>{t('save')}</Button>
        {existing && <Button variant="danger" disabled={busy} onClick={remove}>{t('delete')}</Button>}
      </div>
    </form>
  );
}

import './scores.css';
import { useMemo, useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { deleteActivityScore, getAllActivityScores, saveActivityScore } from '../../../db/activityScores';
import { profileSignal } from '../../../db/profile';
import { scoreTotal } from '../../../domain/activity';
import type { ActivityScore } from '../../../domain/care';
import { t } from '../../../i18n';
import { Button, Card, Sheet } from '../../components';
import { formatLocalDate } from '../../format';
import { ScoreChart } from './ScoreChart';
import { ScoreEditor } from './ScoreEditor';
import { headline, KIND_KEY, levelLabel } from './scoreLabels';

/** Most recent first; on equal dates, the last entered. */
function newestFirst(a: ActivityScore, b: ActivityScore): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id;
}

type Editing = { item: ActivityScore | null };

/** Care section: activity scores (card with latest total and curve, history, editor), as `ActivityScoreSection`. */
export function ActivityScoresSection() {
  const scores = useLiveQuery(['activity_scores'], getAllActivityScores);
  const diagnosis = profileSignal.value?.diagnosis ?? null;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [history, setHistory] = useState(false);

  if (!scores) return null;
  const close = (): void => setEditing(null);

  return (
    <Card title={t('score_title')}>
      {scores.length === 0 ? <p class="text-muted">{t('score_empty')}</p> : (
        <ScoreCard scores={scores} onOpenHistory={() => setHistory(true)} />
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('score_add')}</Button>
      </div>
      {/* The history hides during entry to avoid stacking two sheets, then comes back. */}
      {history && scores.length > 0 && editing === null && (
        <ScoreHistory
          scores={scores}
          onClose={() => setHistory(false)}
          onAdd={() => setEditing({ item: null })}
          onEdit={(item) => setEditing({ item })}
        />
      )}
      {editing && (
        <ScoreEditor
          initial={editing.item}
          diagnosis={diagnosis}
          onClose={close}
          onSave={async (score) => { await saveActivityScore(score); }}
          onDelete={async (score) => { await deleteActivityScore(score.id); }}
        />
      )}
    </Card>
  );
}

/** Latest total, its level, change since the previous entry of the same questionnaire and the curve. */
function ScoreCard({ scores, onOpenHistory }: { scores: readonly ActivityScore[]; onOpenHistory: () => void }) {
  const latest = scores[scores.length - 1]!;
  // Totals of different questionnaires are not comparable: change and curve stay within one.
  const sameKind = useMemo(() => scores.filter((s) => s.kind === latest.kind), [scores, latest.kind]);
  const previous = sameKind[sameKind.length - 2];
  const level = levelLabel(latest);
  const delta = previous ? scoreTotal(latest) - scoreTotal(previous) : 0;
  const date = (s: ActivityScore): string => formatLocalDate(s.date);
  return (
    <div class="score-card">
      <p class="score-headline">{headline(latest)}</p>
      {level !== null && <p class="score-level">{level}</p>}
      <p class="text-muted">{t('score_latest', [date(latest)])}</p>
      {previous && (
        <p class="text-muted">
          {delta === 0
            ? t('score_unchanged', [date(previous)])
            : t('score_change', [`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`, date(previous)])}
        </p>
      )}
      <ScoreChart scores={sameKind} description={t('score_chart_description', [t(KIND_KEY[latest.kind])])} />
      <p class="text-muted text-sm">{t('score_disclaimer')}</p>
      <div class="score-card-actions">
        <Button variant="text" onClick={onOpenHistory}>{t('score_history')}</Button>
      </div>
    </div>
  );
}

/** All entries, most recent first; a click opens the entry. */
function ScoreHistory({ scores, onClose, onAdd, onEdit }: {
  scores: readonly ActivityScore[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (score: ActivityScore) => void;
}) {
  const sorted = useMemo(() => [...scores].sort(newestFirst), [scores]);
  return (
    <Sheet open onClose={onClose} title={t('score_title')} closeLabel={t('close')}>
      <div class="stack">
        <ul class="score-history">
          {sorted.map((score) => (
            <li key={score.id}>
              <button type="button" class="score-history-row" onClick={() => onEdit(score)}>
                <span class="care-row-title">{headline(score)}</span>
                <span class="text-muted text-sm">
                  {[formatLocalDate(score.date, { dateStyle: 'medium' }), levelLabel(score)].filter((s) => s !== null).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div class="dialog-actions">
          <span class="spacer" />
          <Button variant="tonal" onClick={onAdd}>{t('add')}</Button>
        </div>
      </div>
    </Sheet>
  );
}

import { useEffect, useState } from 'preact/hooks';
import { getExtraSymptoms } from '../../../db/followup';
import { getStoolsBetween } from '../../../db/stools';
import { prefilledAnswers, questionCount, scoreTotal, suggestedScore } from '../../../domain/activity';
import { SCORE_KINDS, type ActivityScore, type Diagnosis, type ExtraSymptom, type ScoreKind } from '../../../domain/care';
import type { Stool } from '../../../domain/models';
import { today } from '../../../domain/time';
import { t } from '../../../i18n';
import { Button, SegmentedControl, Sheet } from '../../components';
import { TextField } from '../../forms';
import { KIND_FULL_KEY, KIND_KEY, levelLabel } from './scoreLabels';

/** Largest number of stools the counter accepts. */
const MAX_STOOLS = 99;

type Question =
  | { type: 'choice'; title: string; options: string }
  | { type: 'count'; title: string }
  | { type: 'flags'; title: string; items: readonly string[] };

const HBI_QUESTIONS: readonly Question[] = [
  { type: 'choice', title: 'score_q_wellbeing', options: 'wellbeing' },
  { type: 'choice', title: 'score_q_pain', options: 'pain' },
  { type: 'count', title: 'score_q_liquid_stools' },
  { type: 'choice', title: 'score_q_mass', options: 'mass' },
  {
    type: 'flags',
    title: 'score_q_complications',
    items: [
      'score_flag_arthralgia', 'score_flag_uveitis', 'score_flag_erythema_nodosum', 'score_flag_aphthous',
      'score_flag_pyoderma', 'score_flag_fissure', 'score_flag_fistula', 'score_flag_abscess',
    ],
  },
];

const SCCAI_QUESTIONS: readonly Question[] = [
  { type: 'choice', title: 'score_q_stools_day', options: 'stools_day' },
  { type: 'choice', title: 'score_q_stools_night', options: 'stools_night' },
  { type: 'choice', title: 'score_q_urgency', options: 'urgency' },
  { type: 'choice', title: 'score_q_blood', options: 'blood' },
  { type: 'choice', title: 'score_q_wellbeing', options: 'wellbeing' },
  {
    type: 'flags',
    title: 'score_q_extracolonic',
    items: ['score_flag_joint_pains', 'score_flag_pyoderma', 'score_flag_erythema_nodosum', 'score_flag_uveitis'],
  },
];

/** Number of answers of each choice question (the options live in `web_score_options_<name>_<i>`). */
const OPTION_COUNT: Record<string, number> = {
  wellbeing: 5, pain: 4, mass: 4, stools_day: 4, stools_night: 3, urgency: 4, blood: 4,
};

const QUESTIONS: Record<ScoreKind, readonly Question[]> = { HBI: HBI_QUESTIONS, SCCAI: SCCAI_QUESTIONS };

// Titles and flags are dynamic keys; the keys are listed here for the check script.
// i18n-keys: score_q_wellbeing score_q_pain score_q_liquid_stools score_q_mass score_q_complications
// i18n-keys: score_q_stools_day score_q_stools_night score_q_urgency score_q_blood score_q_extracolonic
// i18n-keys: score_flag_arthralgia score_flag_uveitis score_flag_erythema_nodosum score_flag_aphthous
// i18n-keys: score_flag_pyoderma score_flag_fissure score_flag_fistula score_flag_abscess score_flag_joint_pains
// i18n-keys: web_score_options_wellbeing_0 web_score_options_wellbeing_1 web_score_options_wellbeing_2
// i18n-keys: web_score_options_wellbeing_3 web_score_options_wellbeing_4
// i18n-keys: web_score_options_pain_0 web_score_options_pain_1 web_score_options_pain_2 web_score_options_pain_3
// i18n-keys: web_score_options_mass_0 web_score_options_mass_1 web_score_options_mass_2 web_score_options_mass_3
// i18n-keys: web_score_options_stools_day_0 web_score_options_stools_day_1 web_score_options_stools_day_2
// i18n-keys: web_score_options_stools_day_3
// i18n-keys: web_score_options_stools_night_0 web_score_options_stools_night_1 web_score_options_stools_night_2
// i18n-keys: web_score_options_urgency_0 web_score_options_urgency_1 web_score_options_urgency_2
// i18n-keys: web_score_options_urgency_3
// i18n-keys: web_score_options_blood_0 web_score_options_blood_1 web_score_options_blood_2 web_score_options_blood_3

function blankAnswers(kind: ScoreKind): number[] {
  return Array.from({ length: questionCount(kind) }, () => 0);
}

interface ScoreEditorProps {
  /** null: new entry. */
  initial: ActivityScore | null;
  diagnosis: Diagnosis | null;
  onClose: () => void;
  onSave: (score: ActivityScore) => Promise<void>;
  onDelete: (score: ActivityScore) => Promise<void>;
}

/**
 * Questionnaire entry (`ScoreEditorSheet`). New entry: today, the questionnaire suggested by the
 * diagnosis (HBI without one), answers pre-filled from the day's stools and noted symptoms until
 * the user answers. An existing entry keeps its answers.
 */
export function ScoreEditor({ initial, diagnosis, onClose, onSave, onDelete }: ScoreEditorProps) {
  const [kind, setKind] = useState<ScoreKind>(initial?.kind ?? suggestedScore(diagnosis) ?? 'HBI');
  const [date, setDate] = useState(initial?.date ?? today());
  const [answers, setAnswers] = useState<number[]>(() => {
    const k = initial?.kind ?? suggestedScore(diagnosis) ?? 'HBI';
    return Array.from({ length: questionCount(k) }, (_, i) => initial?.answers[i] ?? 0);
  });
  const [touched, setTouched] = useState(initial !== null);
  const [dayStools, setDayStools] = useState<Stool[] | null>(null);
  const [dayExtras, setDayExtras] = useState<ReadonlySet<ExtraSymptom>>(new Set());
  const [busy, setBusy] = useState(false);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today();

  // Day's data, for a new entry only; null until loaded.
  useEffect(() => {
    if (initial !== null || !validDate) return;
    let current = true;
    setDayStools(null);
    void Promise.all([getStoolsBetween(date, date), getExtraSymptoms(date)]).then(([stools, extras]) => {
      if (!current) return;
      setDayExtras(new Set(extras?.symptoms ?? []));
      setDayStools(stools);
    });
    return () => { current = false; };
  }, [initial, date, validDate]);

  useEffect(() => {
    if (!touched && dayStools !== null) setAnswers(prefilledAnswers(kind, dayStools, dayExtras));
  }, [kind, dayStools, dayExtras, touched]);

  const draft: ActivityScore = { id: initial?.id ?? 0, date, kind, answers };
  const level = levelLabel(draft);

  function answer(index: number, value: number): void {
    setAnswers(answers.map((v, i) => (i === index ? value : v)));
    setTouched(true);
  }

  function changeKind(next: ScoreKind): void {
    if (kind === next) return;
    setKind(next);
    setTouched(false);
    setAnswers(blankAnswers(next));
  }

  async function save(e: Event): Promise<void> {
    e.preventDefault();
    if (busy || !validDate) return;
    setBusy(true);
    await onSave(draft);
    onClose();
  }

  async function remove(): Promise<void> {
    if (!initial || busy) return;
    setBusy(true);
    await onDelete(initial);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t(initial ? 'score_edit' : 'score_add')} closeLabel={t('close')} lightDismiss={false}>
      <form class="stack" noValidate onSubmit={(e) => void save(e)}>
        {initial === null && (
          <SegmentedControl
            label={t('score_title')}
            options={SCORE_KINDS.map((k) => ({ value: k, label: t(KIND_KEY[k]) }))}
            value={kind}
            onChange={changeKind}
          />
        )}
        <p class="text-muted">{t(KIND_FULL_KEY[kind])}</p>
        <TextField
          label={t('score_date')}
          type="date"
          value={date}
          max={today()}
          onInput={setDate}
          error={validDate ? null : t('profile_not_set')}
          required
        />
        {initial === null && !touched && dayStools !== null && dayStools.length > 0 && (
          <p class="text-sm" role="status">{t('score_prefilled')}</p>
        )}

        {QUESTIONS[kind].map((question, index) => (
          <QuestionField
            key={`${kind}-${index}`}
            question={question}
            value={answers[index] ?? 0}
            onChange={(value) => answer(index, value)}
          />
        ))}

        <div class="score-total" aria-live="polite">
          <p class="score-total-value">{t('score_total', [scoreTotal(draft)])}</p>
          {level !== null && <p>{level}</p>}
          <p class="text-muted text-sm">{t('score_disclaimer')}</p>
        </div>

        <div class="dialog-actions">
          {initial && <Button variant="danger" onClick={() => void remove()} aria-disabled={busy || undefined}>{t('delete')}</Button>}
          <span class="spacer" />
          <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" aria-disabled={busy || !validDate || undefined}>{t('save')}</Button>
        </div>
      </form>
    </Sheet>
  );
}

function QuestionField({ question, value, onChange }: { question: Question; value: number; onChange: (value: number) => void }) {
  const title = t(question.title);
  if (question.type === 'choice') {
    return (
      <ChoiceAnswer title={title} name={question.options} count={OPTION_COUNT[question.options]!} value={value} onChange={onChange} />
    );
  }
  if (question.type === 'count') {
    return (
      <fieldset class="score-question">
        <legend>{title}</legend>
        <div class="stepper" role="group" aria-label={title}>
          <button type="button" class="icon-btn" aria-label={t('score_stools_less')} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <output class="stepper-value">{value}</output>
          <button type="button" class="icon-btn" aria-label={t('score_stools_more')} disabled={value >= MAX_STOOLS} onClick={() => onChange(Math.min(MAX_STOOLS, value + 1))}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M5 12h14M12 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset class="score-question">
      <legend>{title}</legend>
      {question.items.map((item, bit) => (
        <label key={item} class="score-flag">
          <input
            type="checkbox"
            checked={(value & (1 << bit)) !== 0}
            onChange={() => onChange(value ^ (1 << bit))}
          />
          <span>{t(item)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** One answer among the options; the index is the answer (points). Native radios: arrows move the choice. */
function ChoiceAnswer({ title, name, count, value, onChange }: {
  title: string;
  name: string;
  count: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const group = `score-${name}-${title}`;
  return (
    <fieldset class="score-question">
      <legend>{title}</legend>
      <div class="score-choices">
        {Array.from({ length: count }, (_, index) => (
          <label key={index} class="score-chip">
            <input type="radio" name={group} checked={value === index} onChange={() => onChange(index)} />
            <span>{t(`web_score_options_${name}_${index}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

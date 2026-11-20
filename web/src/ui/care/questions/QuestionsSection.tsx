import './questions.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { deleteDoctorQuestion, getAllDoctorQuestions, saveDoctorQuestion } from '../../../db/followup';
import type { DoctorQuestion } from '../../../domain/care';
import { t } from '../../../i18n';
import { Button, Card } from '../../components';
import { QuestionEditor } from './QuestionEditor';

/**
 * Care section: notes to raise at the next appointment (`QuestionsSection`). An answered question
 * is muted and struck through; open ones come first. Selecting the text opens the editor.
 */
export function QuestionsSection() {
  const questions = useLiveQuery(['doctor_questions'], getAllDoctorQuestions);
  const [editing, setEditing] = useState<{ item: DoctorQuestion | null } | null>(null);
  const done = questions?.filter((q) => q.done) ?? [];

  return (
    <Card title={t('question_title')}>
      {questions && questions.length === 0 && <p class="text-muted">{t('question_empty')}</p>}
      {questions && questions.length > 0 && (
        <ul class="care-list">
          {questions.map((question) => (
            <li key={question.id} class="question-item" data-done={question.done ? '' : undefined}>
              <label class="question-check">
                <input
                  type="checkbox"
                  checked={question.done}
                  aria-label={question.text}
                  onChange={(e) => void saveDoctorQuestion({ ...question, done: e.currentTarget.checked })}
                />
              </label>
              <button type="button" class="care-row" onClick={() => setEditing({ item: question })}>
                <span class="care-row-text">
                  <span class="care-row-title question-text">{question.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div class="question-actions">
          <Button variant="text" onClick={() => void Promise.all(done.map((q) => deleteDoctorQuestion(q.id)))}>
            {t('question_clear_done')}
          </Button>
        </div>
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('question_add')}</Button>
      </div>
      {editing && <QuestionEditor initial={editing.item} onClose={() => setEditing(null)} />}
    </Card>
  );
}

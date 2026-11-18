import { needsAnesthesia } from '../../domain/examPlan';
import { exam as newExam, type Exam, type ExamType } from '../../domain/models';
import { parseLocalDateTime, plusDays, type LocalDate, type LocalDateTime } from '../../domain/time';

/** Bound of the diet-days stepper. */
export const MAX_DIET_DAYS = 7;

/** New exam: in two weeks, in the morning. */
const NEW_EXAM_DAYS_AHEAD = 14;
const NEW_EXAM_TIME = '09:00';

/** Form state of an exam: date-times as `YYYY-MM-DDTHH:mm` strings, '' for "not scheduled yet". */
export interface ExamDraft {
  type: ExamType;
  at: string;
  note: string;
  dietDays: number;
  prepFirstAt: string;
  prepSecondAt: string;
  anesthesiaAt: string;
  remindersEnabled: boolean;
}

export function draftFromExam(exam: Exam): ExamDraft {
  return {
    type: exam.type,
    at: exam.at,
    note: exam.note,
    dietDays: exam.dietDays,
    prepFirstAt: exam.prepFirstAt ?? '',
    prepSecondAt: exam.prepSecondAt ?? '',
    anesthesiaAt: exam.anesthesiaAt ?? '',
    remindersEnabled: exam.remindersEnabled,
  };
}

export function newExamDraft(today: LocalDate): ExamDraft {
  return draftFromExam(newExam({ type: 'COLONOSCOPY', at: `${plusDays(today, NEW_EXAM_DAYS_AHEAD)}T${NEW_EXAM_TIME}` }));
}

export function isDateTime(text: string): boolean {
  try {
    parseLocalDateTime(text);
    return true;
  } catch {
    return false;
  }
}

/** Optional date-time: '' = none, otherwise valid or the draft is refused (`undefined`). */
function optional(text: string): LocalDateTime | null | undefined {
  if (text === '') return null;
  return isDateTime(text) ? text : undefined;
}

/**
 * The exam, or null if a date-time is invalid. The anesthesia consultation only exists for
 * a colonoscopy (`ExamEditorSheet`).
 */
export function examFromDraft(draft: ExamDraft, id: number): Exam | null {
  if (!isDateTime(draft.at)) return null;
  const prepFirstAt = optional(draft.prepFirstAt);
  const prepSecondAt = optional(draft.prepSecondAt);
  const anesthesia = optional(draft.anesthesiaAt);
  if (prepFirstAt === undefined || prepSecondAt === undefined || anesthesia === undefined) return null;
  return {
    id,
    type: draft.type,
    at: draft.at,
    note: draft.note.trim(),
    dietDays: Math.min(Math.max(draft.dietDays, 0), MAX_DIET_DAYS),
    prepFirstAt,
    prepSecondAt,
    anesthesiaAt: needsAnesthesia(draft.type) ? anesthesia : null,
    remindersEnabled: draft.remindersEnabled,
  };
}

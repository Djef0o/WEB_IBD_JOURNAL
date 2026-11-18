import { reminderSchedule, type ReminderSchedule, type RepeatUnit } from '../../domain/profile';
import { parseLocalDate, type LocalDate } from '../../domain/time';

/** Bound of the "every N" stepper (`MAX_REPEAT_EVERY` of the Android editor). */
export const MAX_REPEAT_EVERY = 99;

/** Form state of a reminder schedule: the strings the native inputs give. */
export interface ScheduleDraft {
  /** `YYYY-MM-DD` */
  startDate: string;
  /** `HH:mm` */
  time: string;
  unit: RepeatUnit;
  every: number;
  enabled: boolean;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function draftFromSchedule(schedule: ReminderSchedule): ScheduleDraft {
  return {
    startDate: schedule.startDate,
    time: `${pad(schedule.hour)}:${pad(schedule.minute)}`,
    unit: schedule.repeatUnit,
    every: schedule.repeatEvery,
    enabled: schedule.enabled,
  };
}

/** New schedule: starts `today` at 08:00, reminder on. */
export function newDraft(unit: RepeatUnit, today: LocalDate): ScheduleDraft {
  return draftFromSchedule(reminderSchedule({ startDate: today, repeatUnit: unit }));
}

function isDate(text: string): boolean {
  try {
    parseLocalDate(text);
    return true;
  } catch {
    return false;
  }
}

export interface DraftValidity {
  date: boolean;
  time: boolean;
}

export function validateDraft(draft: ScheduleDraft): DraftValidity {
  return { date: isDate(draft.startDate), time: /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time) };
}

/** The schedule, or null if the date or the time is missing or invalid. */
export function scheduleFromDraft(draft: ScheduleDraft): ReminderSchedule | null {
  const validity = validateDraft(draft);
  if (!validity.date || !validity.time) return null;
  const [hour, minute] = draft.time.split(':').map(Number) as [number, number];
  return {
    enabled: draft.enabled,
    startDate: draft.startDate,
    hour,
    minute,
    repeatEvery: draft.unit === 'ONCE' ? 1 : Math.min(Math.max(Math.trunc(draft.every), 1), MAX_REPEAT_EVERY),
    repeatUnit: draft.unit,
  };
}

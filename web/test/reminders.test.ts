import { describe, expect, it } from 'vitest';
import { exam } from '../src/domain/models';
import { checkup, medication, reminderSchedule } from '../src/domain/profile';
import { exportEvents } from '../src/reminders/calendarExport';
import { remindersBetween, remindersOn, type ReminderData } from '../src/reminders/schedule';
import { todayTasks } from '../src/reminders/today';
import { examFromDraft, newExamDraft } from '../src/ui/care/examDraft';
import { summarizeLabs } from '../src/ui/care/labSummary';
import { newDraft, scheduleFromDraft } from '../src/ui/care/scheduleDraft';
import { labResult } from '../src/domain/health';

const daily = medication({
  id: 1, name: 'Mesalazine', dosage: '2 g',
  schedule: reminderSchedule({ startDate: '2026-11-01', hour: 8, minute: 0 }),
});
const biweekly = medication({
  id: 2, name: 'Adalimumab', dosage: '40 mg', refillAlert: true,
  schedule: reminderSchedule({ startDate: '2026-11-04', hour: 9, minute: 30, repeatEvery: 2, repeatUnit: 'WEEK' }),
});
const silent = medication({
  id: 3, name: 'Iron', schedule: reminderSchedule({ startDate: '2026-11-01', enabled: false }),
});
const blood = checkup({
  id: 1, type: 'BLOOD_TEST', note: 'CRP',
  schedule: reminderSchedule({ startDate: '2026-11-18', hour: 7, minute: 15, repeatUnit: 'ONCE' }),
});
const colonoscopy = exam({
  id: 5, type: 'COLONOSCOPY', at: '2026-12-04T09:30', dietDays: 3,
  anesthesiaAt: '2026-11-20T10:15', prepFirstAt: '2026-12-03T19:00', prepSecondAt: '2026-12-04T04:30',
});

const data: ReminderData = { medications: [daily, biweekly, silent], checkups: [blood], exams: [colonoscopy] };

describe('remindersBetween', () => {
  it('lists doses, reorder alerts and checkups of a day in order, skipping disabled reminders', () => {
    const items = remindersOn(data, '2026-11-18');
    expect(items.map((i) => [i.at, i.key])).toEqual([
      ['2026-11-18T07:15', 'checkup:1'],
      ['2026-11-18T08:00', 'dose:1'],
      ['2026-11-18T09:30', 'dose:2'],
    ]);
  });

  it('puts the reorder alert seven days before a spaced-out dose', () => {
    // Doses on Nov 4, Nov 18, Dec 2: alert for Nov 18 falls on Nov 11, for Dec 2 on Nov 25.
    expect(remindersOn(data, '2026-11-11').map((i) => i.key)).toEqual(['dose:1', 'refill:2']);
    expect(remindersOn(data, '2026-11-25').filter((i) => i.kind === 'REFILL').map((i) => i.at)).toEqual(['2026-11-25T09:30']);
  });

  it('is exclusive of `after` and inclusive of `until`', () => {
    expect(remindersBetween(data, '2026-11-18T08:00', '2026-11-18T09:30').map((i) => i.key)).toEqual(['dose:2']);
    expect(remindersBetween(data, '2026-11-18T08:00', '2026-11-18T08:00')).toEqual([]);
  });

  it('notifies exam steps at their reminder time: appointments 2 h before, preparation on time', () => {
    const items = remindersBetween(data, '2026-11-19T00:00', '2026-12-05T00:00').filter((i) => i.key.startsWith('exam'));
    expect(items.map((i) => [i.key, i.at])).toEqual([
      ['exam_anesthesia:5', '2026-11-20T08:15'],
      ['exam_diet:5', '2026-12-01T08:00'],
      ['exam_prep_first:5', '2026-12-03T19:00'],
      ['exam_prep_second:5', '2026-12-04T04:30'],
      ['exam:5', '2026-12-04T07:30'],
    ]);
  });

  it('drops the exam steps when its reminders are off', () => {
    const off: ReminderData = { medications: [], checkups: [], exams: [{ ...colonoscopy, remindersEnabled: false }] };
    expect(remindersBetween(off, '2026-11-01T00:00', '2026-12-31T00:00')).toEqual([]);
  });

  it('keeps a monthly dose on the 31st without drift (April 30, then May 31)', () => {
    const monthly = medication({
      id: 9, name: 'M', schedule: reminderSchedule({ startDate: '2026-01-31', repeatUnit: 'MONTH' }),
    });
    const items = remindersBetween({ medications: [monthly], checkups: [], exams: [] }, '2026-03-31T09:00', '2026-06-01T00:00');
    expect(items.map((i) => i.at)).toEqual(['2026-04-30T08:00', '2026-05-31T08:00']);
  });
});

describe('todayTasks', () => {
  const logs = [{ id: 1, medicationId: 1, scheduledAt: new Date(2026, 10, 18, 8, 0).getTime(), status: 'TAKEN' as const, loggedAt: 0 }];

  it('lists doses with their answer, checkups and exam steps of the day, with or without notification', () => {
    const tasks = todayTasks({ date: '2026-11-18', ...data, doseLogs: logs });
    expect(tasks.map((t) => t.type)).toEqual(['checkup', 'dose', 'dose', 'dose']);
    const doses = tasks.filter((t) => t.type === 'dose');
    // Disabled reminders still show their dose (the Android card does too).
    expect(doses.map((t) => t.due.medication.id)).toEqual([1, 3, 2]);
    const mesalazine = doses.find((t) => t.due.medication.id === 1)!;
    expect(mesalazine.due.status).toBe('TAKEN');
  });

  it('shows the exam steps dated today at their own time', () => {
    const tasks = todayTasks({ date: '2026-12-04', ...data, doseLogs: [] });
    const steps = tasks.filter((t) => t.type === 'exam').map((t) => [t.at, t.type === 'exam' ? t.step.step : '']);
    expect(steps).toEqual([['2026-12-04T04:30', 'PREP_SECOND'], ['2026-12-04T09:30', 'EXAM']]);
  });

  it('includes the reorder alert of the day', () => {
    const tasks = todayTasks({ date: '2026-11-11', ...data, doseLogs: [] });
    expect(tasks.some((t) => t.type === 'refill' && t.medication.id === 2)).toBe(true);
  });

  it('is empty without anything to do', () => {
    expect(todayTasks({ date: '2027-06-01', medications: [], checkups: [], exams: [], doseLogs: [] })).toEqual([]);
  });
});

describe('exportEvents', () => {
  const texts = (now: string) => exportEvents(data, now);

  it('exports series for doses, the reorder series, checkups and every exam step', () => {
    const events = texts('2026-11-01T00:00');
    const keys = events.map((e) => e.key);
    expect(keys).toEqual(expect.arrayContaining([
      'dose:1', 'dose:2', 'refill:2', 'checkup:1',
      'exam_anesthesia:5', 'exam_diet:5', 'exam_prep_first:5', 'exam_prep_second:5', 'exam:5',
    ]));
    expect(keys).not.toContain('dose:3'); // reminder off
    const refill = events.find((e) => e.key === 'refill:2')!;
    expect(refill.start).toBe('2026-10-28T09:30');
    expect([refill.repeatUnit, refill.repeatEvery]).toEqual(['WEEK', 2]);
  });

  it('gives alarms 2 h ahead for appointments only', () => {
    const lead = Object.fromEntries(texts('2026-11-01T00:00').map((e) => [e.key, e.alarmMinutesBefore]));
    expect(lead['exam:5']).toBe(120);
    expect(lead['exam_anesthesia:5']).toBe(120);
    expect(lead['exam_prep_first:5']).toBe(0);
    expect(lead['dose:1']).toBe(0);
  });

  it('leaves out one-off events already past, keeps series', () => {
    const keys = texts('2026-12-10T00:00').map((e) => e.key);
    expect(keys).not.toContain('exam:5');
    expect(keys).not.toContain('checkup:1');
    expect(keys).toContain('dose:1');
  });
});

describe('editor drafts', () => {
  it('turns a valid schedule draft into a schedule and refuses invalid ones', () => {
    const draft = { ...newDraft('WEEK', '2026-11-18'), time: '07:45', every: 2 };
    expect(scheduleFromDraft(draft)).toEqual({
      enabled: true, startDate: '2026-11-18', hour: 7, minute: 45, repeatEvery: 2, repeatUnit: 'WEEK',
    });
    expect(scheduleFromDraft({ ...draft, startDate: '' })).toBeNull();
    expect(scheduleFromDraft({ ...draft, startDate: '2026-02-30' })).toBeNull();
    expect(scheduleFromDraft({ ...draft, time: '' })).toBeNull();
    expect(scheduleFromDraft({ ...draft, unit: 'ONCE', every: 5 })?.repeatEvery).toBe(1);
  });

  it('builds an exam from a draft; anesthesia only for a colonoscopy', () => {
    const draft = {
      ...newExamDraft('2026-11-18'), anesthesiaAt: '2026-11-20T10:15', prepFirstAt: '2026-12-03T19:00', note: ' Parc ',
    };
    const colon = examFromDraft(draft, 7)!;
    expect(colon).toMatchObject({ id: 7, type: 'COLONOSCOPY', at: '2026-12-02T09:00', note: 'Parc', anesthesiaAt: '2026-11-20T10:15', prepSecondAt: null });
    expect(examFromDraft({ ...draft, type: 'RECTOSIGMOIDOSCOPY' }, 7)!.anesthesiaAt).toBeNull();
    expect(examFromDraft({ ...draft, at: '' }, 7)).toBeNull();
    expect(examFromDraft({ ...draft, prepFirstAt: 'oops' }, 7)).toBeNull();
  });
});

describe('summarizeLabs', () => {
  it('counts tracked tests and those whose latest result is outside the lab values', () => {
    const summary = summarizeLabs([
      labResult({ id: 1, test: 'CRP', value: 18, date: '2026-10-01' }),
      labResult({ id: 2, test: 'CRP', value: 6.5, date: '2026-11-10', referenceHigh: 5 }),
      labResult({ id: 3, test: 'HEMOGLOBIN', value: 12.4, date: '2026-11-10', referenceLow: 12 }),
      labResult({ id: 4, test: 'FERRITIN', value: 9, date: '2026-09-10', referenceLow: 30 }),
    ]);
    expect(summary).toEqual({ latest: '2026-11-10', tests: 3, outside: 2 });
    expect(summarizeLabs([])).toEqual({ latest: null, tests: 0, outside: 0 });
  });
});

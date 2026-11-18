import { describe, expect, it } from 'vitest';
import { examEvents } from '../src/domain/calendarEvents';
import { anesthesiaMissing, examSteps, stepReminderAt } from '../src/domain/examPlan';
import { exam } from '../src/domain/models';
import { localDateTime } from '../src/domain/time';

describe('ExamPlanTest', () => {
  const colonoscopy = exam({ type: 'COLONOSCOPY', at: localDateTime(2026, 12, 4, 9, 30) });

  /** Preparation entered by the user, following their doctor's instructions. */
  const prepared = {
    ...colonoscopy,
    dietDays: 3,
    prepFirstAt: localDateTime(2026, 12, 3, 19, 0),
    prepSecondAt: localDateTime(2026, 12, 4, 4, 30),
  };

  it('aNewExamHasOnlyItsOwnStep', () => {
    // No preparation suggested by the app: only the exam is dated.
    expect(examSteps(colonoscopy).map((s) => s.step)).toEqual(['EXAM']);
  });

  it('stepsAreChronologicalWithAppointmentRemindersTwoHoursBefore', () => {
    const withAnesthesia = { ...prepared, anesthesiaAt: localDateTime(2026, 11, 20, 10, 15) };
    const steps = examSteps(withAnesthesia);
    expect(steps.map((s) => s.step)).toEqual(['ANESTHESIA', 'DIET', 'PREP_FIRST', 'PREP_SECOND', 'EXAM']);
    expect(steps.find((s) => s.step === 'DIET')!.at).toBe(localDateTime(2026, 12, 1, 8, 0));
    expect(stepReminderAt(steps[0]!)).toBe(localDateTime(2026, 11, 20, 8, 15));
    expect(stepReminderAt(steps[steps.length - 1]!)).toBe(localDateTime(2026, 12, 4, 7, 30));
    expect(stepReminderAt(steps.find((s) => s.step === 'PREP_FIRST')!)).toBe(localDateTime(2026, 12, 3, 19, 0));
  });

  it('anesthesiaConsultationToBookForColonoscopy', () => {
    expect(anesthesiaMissing(colonoscopy)).toBe(true);
    expect(anesthesiaMissing({ ...colonoscopy, type: 'RECTOSIGMOIDOSCOPY' })).toBe(false);
    expect(anesthesiaMissing({ ...colonoscopy, anesthesiaAt: localDateTime(2026, 12, 2, 9, 30) })).toBe(false);
  });

  it('calendarEventsFollowTheRemindersSwitch', () => {
    expect(examEvents(prepared).ANESTHESIA).toBeNull();
    expect(examEvents(prepared).EXAM?.start).toBe(localDateTime(2026, 12, 4, 9, 30));
    expect(Object.values(examEvents({ ...prepared, remindersEnabled: false })).every((e) => e === null)).toBe(true);
  });
});

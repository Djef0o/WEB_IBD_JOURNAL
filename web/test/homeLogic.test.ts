import { describe, expect, it } from 'vitest';
import { emptyCheckIn } from '../src/db/prefs';
import { meal, stool } from '../src/domain/models';
import { toEpochMillis } from '../src/domain/time';
import {
  answerScale, applyScale, averageBristol, feedEntries, isCalmDay, isCheckInDue, realStoolCount, stoolForCheckIn,
  weekStart,
} from '../src/ui/screens/home/homeLogic';

const day = '2026-11-18';
const at = (time: string) => toEpochMillis(`${day}T${time}`);

describe('home counts', () => {
  const stools = [
    stool({ date: day, bristolType: 6 }),
    stool({ date: day, bristolType: 4 }),
    stool({ date: day, bristolType: 0 }), // stool-free day
    stool({ date: day, bristolType: 0, falseUrge: true }),
  ];

  it('never counts stool-free days nor false urges', () => {
    expect(realStoolCount(stools)).toBe(2);
    expect(averageBristol(stools)).toBe(5);
    expect(averageBristol([stools[2]!, stools[3]!])).toBeNull();
    expect(averageBristol([])).toBeNull();
  });

  it('is calm only with entries and no blood, mucus or pain', () => {
    expect(isCalmDay([])).toBe(false);
    expect(isCalmDay(stools)).toBe(true);
    expect(isCalmDay([...stools, stool({ date: day, painLevel: 1 })])).toBe(false);
    expect(isCalmDay([stool({ date: day, bloodLevel: 2 })])).toBe(false);
  });

  it('week starts 6 days before today', () => {
    expect(weekStart('2026-11-18')).toBe('2026-11-12');
    expect(weekStart('2026-03-03')).toBe('2026-02-25');
  });
});

describe('feedEntries', () => {
  it('orders meals at fixed hours and stools by creation time', () => {
    const entries = feedEntries(
      [meal({ date: day, type: 'DINNER', description: 'd' }), meal({ date: day, type: 'BREAKFAST', description: 'b' })],
      [
        stool({ date: day, createdAt: at('13:10'), bristolType: 4 }),
        stool({ date: day, createdAt: at('07:30'), bristolType: 3 }),
        stool({ date: day, createdAt: at('21:00'), bristolType: 5 }),
      ],
    );
    expect(entries.map((e) => (e.kind === 'meal' ? e.meal.type : e.stool.bristolType))).toEqual([3, 'BREAKFAST', 4, 'DINNER', 5]);
  });
});

describe('check-in', () => {
  it('creates the stool with the answers already given, then corrects it in place', () => {
    const answered = answerScale(answerScale(emptyCheckIn(1), 'PAIN', 3), 'FATIGUE', 2);
    const created = stoolForCheckIn(null, 5, answered, day);
    expect(created).toMatchObject({ id: 0, date: day, bristolType: 5, painLevel: 3, fatigueLevel: 2, falseUrge: false });
    const saved = { ...created, id: 9 };
    expect(stoolForCheckIn(saved, 0, answered, day)).toEqual({ ...saved, bristolType: 0 });
  });

  it('applies pain and fatigue to the stool', () => {
    const s = stool({ date: day });
    expect(applyScale(s, 'PAIN', 4)).toMatchObject({ painLevel: 4, fatigueLevel: 0 });
    expect(applyScale(s, 'FATIGUE', 1)).toMatchObject({ painLevel: 0, fatigueLevel: 1 });
  });

  it('is due from the reminder time until the three answers are given', () => {
    const settings = { enabled: true, hour: 19, minute: 0, lastReminderAt: null };
    const open = emptyCheckIn(1);
    expect(isCheckInDue(settings, 18 * 60 + 59, open)).toBe(false);
    expect(isCheckInDue(settings, 19 * 60, open)).toBe(true);
    expect(isCheckInDue({ ...settings, enabled: false }, 20 * 60, open)).toBe(false);
    const partial = { ...open, bristolType: 4, painLevel: 0 };
    expect(isCheckInDue(settings, 20 * 60, partial)).toBe(true);
    expect(isCheckInDue(settings, 20 * 60, { ...partial, fatigueLevel: 1 })).toBe(false);
  });
});

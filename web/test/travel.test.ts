import { describe, expect, it } from 'vitest';
import { medication, reminderSchedule, type RepeatUnit } from '../src/domain/profile';
import { travelMissing, travelPlan, travelTotal, tripDays } from '../src/domain/travel';

const start = '2026-01-01';
const med = (name: string, unit: RepeatUnit, every = 1, stock: number | null = null) =>
  medication({ name, schedule: reminderSchedule({ startDate: start, repeatEvery: every, repeatUnit: unit }), stockDoses: stock });

const departure = '2026-12-01';
const back = '2026-12-10';

describe('travel plan', () => {
  it('counts every day of the trip plus the margin for a daily treatment', () => {
    const [line] = travelPlan([med('Azathioprine', 'DAY')], departure, back, 3);
    expect(line!.onTrip).toBe(10);
    expect(line!.margin).toBe(3);
    expect(travelTotal(line!)).toBe(13);
  });

  it('counts only its own days for a biweekly injection', () => {
    // Starts Thursday Jan 1, 2026 every 2 weeks: Dec 3 falls on the trip (336 days = 24 weeks).
    const [line] = travelPlan([med('Adalimumab', 'WEEK', 2)], departure, back, 3);
    expect(line!.onTrip).toBe(1);
    expect(line!.margin).toBe(0);
  });

  it('leaves out treatments with nothing to take and sorts the rest by name', () => {
    const plan = travelPlan([med('Zinc', 'DAY'), med('Adalimumab', 'MONTH', 12), med('budesonide', 'DAY')], departure, back);
    expect(plan.map((l) => l.medication.name)).toEqual(['budesonide', 'Zinc']);
  });

  it('compares with the counted stock only', () => {
    expect(travelMissing(travelPlan([med('A', 'DAY', 1, 5)], departure, back, 0)[0]!)).toBe(5);
    expect(travelMissing(travelPlan([med('A', 'DAY', 1, 50)], departure, back, 0)[0]!)).toBe(0);
    expect(travelMissing(travelPlan([med('A', 'DAY')], departure, back, 0)[0]!)).toBeNull();
  });

  it('counts one day and no intakes for a return before departure', () => {
    expect(tripDays(departure, '2026-11-20')).toBe(1);
    expect(tripDays(departure, back)).toBe(10);
    expect(travelPlan([med('A', 'DAY')], departure, '2026-11-20', 0)).toEqual([]);
  });
});

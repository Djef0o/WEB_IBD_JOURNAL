import { describe, expect, it } from 'vitest';
import { foodSymptomLinks } from '../src/domain/mealSymptoms';
import { meal, stool } from '../src/domain/models';
import { plusDays } from '../src/domain/time';

const day = (offset: number) => plusDays('2026-10-01', offset);
const lunch = (offset: number, description: string) => meal({ date: day(offset), type: 'LUNCH', description });

describe('foodSymptomLinks', () => {
  it('reports a food followed by bad days much more than usual', () => {
    const meals = [];
    const stools = [];
    for (let i = 0; i < 12; i++) {
      const milk = i < 4;
      meals.push(lunch(i * 3, milk ? 'Lait, riz' : 'Riz, poulet'));
      stools.push(stool({ date: day(i * 3), bristolType: milk ? 7 : 4 }));
    }
    const links = foodSymptomLinks(meals, stools);
    expect(links.map((l) => l.item)).toEqual(['lait']);
    expect(links[0]!.badRate).toBe(1);
    expect(links[0]!.baseline).toBe(4 / 12);
  });

  it('stays silent below the minimum occurrences', () => {
    const meals = [
      ...[0, 1, 2].map((i) => lunch(i * 3, 'Lait')),
      ...[3, 4, 5, 6, 7, 8].map((i) => lunch(i * 3, 'Riz')),
    ];
    const stools = Array.from({ length: 9 }, (_, i) => stool({ date: day(i * 3), bristolType: i < 3 ? 7 : 4 }));
    expect(foodSymptomLinks(meals, stools)).toEqual([]);
  });

  it('ignores days without logged stools', () => {
    expect(foodSymptomLinks(Array.from({ length: 10 }, (_, i) => lunch(i * 3, 'Lait')), [])).toEqual([]);
  });
});

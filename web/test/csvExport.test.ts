import { describe, expect, it } from 'vitest';
import { toCsvFiles } from '../src/domain/csvExport';
import { labResult } from '../src/domain/health';
import { stool, type BackupData, type Weight } from '../src/domain/models';

const day = '2026-11-18';

function exportOf(extra: Partial<BackupData> = {}): Map<string, string> {
  return toCsvFiles({ meals: [], stools: [], ...extra });
}

describe('toCsvFiles', () => {
  it('writes every file Android writes, in order', () => {
    expect([...exportOf().keys()]).toEqual([
      'stools.csv', 'extra_symptoms.csv', 'meals.csv', 'weights.csv', 'lab_results.csv', 'flares.csv',
      'activity_scores.csv', 'wellbeing.csv',
    ]);
  });

  it('gives stools a header and one line per entry in date order', () => {
    const files = exportOf({
      stools: [
        stool({ date: '2026-11-19', bristolType: 6, bloodLevel: 2, urgency: true }),
        stool({ date: day, bristolType: 4, comment: 'ok' }),
      ],
    });
    expect(files.get('stools.csv')).toBe(
      'date,bristol_type,blood,mucus,pain,fatigue,urgency,nocturnal,false_urge,comment\r\n' +
        '2026-11-18,4,0,0,0,0,0,0,0,ok\r\n' +
        '2026-11-19,6,2,0,0,0,1,0,0,\r\n',
    );
  });

  it('quotes commas, quotes and line breaks', () => {
    const csv = exportOf({ stools: [stool({ date: day, comment: 'pain, "sharp"\nat night' })] }).get('stools.csv')!;
    expect(csv).toContain(',"pain, ""sharp""\nat night"\r\n');
  });

  it('defuses text that spreadsheets would run as a formula', () => {
    const csv = exportOf({ stools: [stool({ date: day, comment: '=HYPERLINK("x")' })] }).get('stools.csv')!;
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain(',=HYPERLINK');
  });

  it('keeps units and flags of symptoms, weights and lab results', () => {
    const weights: Weight[] = [{ id: 1, date: day, kg: 71.8 }];
    const files = exportOf({
      extraSymptoms: [{ date: day, symptoms: ['JOINTS', 'FEVER'] }],
      weights,
      labResults: [labResult({ test: 'CRP', value: 12.5, date: day, qualifier: 'BELOW', referenceHigh: 5 })],
    });
    expect(files.get('extra_symptoms.csv')).toBe('date,joint_pain,skin,eyes,mouth_ulcers,fever\r\n2026-11-18,1,0,0,0,1\r\n');
    expect(files.get('weights.csv')).toBe('date,kg\r\n2026-11-18,71.8\r\n');
    expect(files.get('lab_results.csv')).toBe(
      'date,test,value,unit,qualifier,reference_low,reference_high,note\r\n2026-11-18,crp,12.5,mg/L,below,,5.0,\r\n',
    );
  });

  it('prints whole decimals like Kotlin (72 gives 72.0)', () => {
    expect(exportOf({ weights: [{ id: 1, date: day, kg: 72 }] }).get('weights.csv')).toBe('date,kg\r\n2026-11-18,72.0\r\n');
  });

  it('exports flares, scores, wellbeing and meals', () => {
    const files = exportOf({
      meals: [
        { id: 2, date: day, type: 'LUNCH', description: 'rice', photoUri: null, product: null },
        {
          id: 1, date: day, type: 'BREAKFAST', description: '', photoUri: null,
          product: { barcode: '1', name: 'Jam', brand: null, nutriscore: null, imageUrl: null, ingredients: null },
        },
      ],
      flares: [{ id: 1, start: day, end: null, treatment: 'pred', hospitalized: true, note: '' }],
      activityScores: [{ id: 1, date: day, kind: 'HBI', answers: [1, 2, 3, 0, 5] }],
      wellbeing: [{ date: day, sleep: 4, stress: null, mood: 2, period: true }],
    });
    expect(files.get('meals.csv')).toBe('date,meal,description,product\r\n2026-11-18,breakfast,,Jam\r\n2026-11-18,lunch,rice,\r\n');
    expect(files.get('flares.csv')).toBe('start,end,hospitalized,treatment,note\r\n2026-11-18,,1,pred,\r\n');
    // HBI: 1+2+3+0 plus two bits set in 5 (0b101).
    expect(files.get('activity_scores.csv')).toBe('date,score,total,answers\r\n2026-11-18,hbi,8,1 2 3 0 5\r\n');
    expect(files.get('wellbeing.csv')).toBe('date,sleep,stress,mood,period\r\n2026-11-18,4,,2,1\r\n');
  });

  it('gives header-only files for missing sections of old backups', () => {
    expect(exportOf().get('weights.csv')).toBe('date,kg\r\n');
  });
});

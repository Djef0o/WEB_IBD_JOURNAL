import { encodeBackupData } from '../src/domain/backupData';
import { encrypt } from '../src/backup/crypto';
import type { BackupData } from '../src/domain/models';

export const BACKUP_PASSWORD = 'correct horse battery';

/** Today's date (Europe/Paris, the timezone the tests run in) shifted by `days`, as YYYY-MM-DD. */
export function dayOffset(days: number): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date()).split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

/** Fictional journal around "today": stools over six weeks, meals, a treatment, labs, an exam. All invented. */
export function seedData(): BackupData {
  const stools: BackupData['stools'] = [];
  for (let i = 0; i < 40; i++) {
    stools.push({
      id: i + 1, date: dayOffset(-i), bristolType: [4, 6, 5, 7, 3, 6, 2][i % 7]!, bloodLevel: i % 5 === 0 ? 2 : 0,
      mucusLevel: i % 4 === 0 ? 1 : 0, painLevel: i % 6, fatigueLevel: i % 4, comment: i % 8 === 0 ? 'Note de test' : '',
      createdAt: Date.now() - i * 86_400_000, urgency: i % 3 === 0, nocturnal: i % 9 === 0, falseUrge: i % 11 === 10,
    });
  }
  return {
    meals: [
      { id: 1, date: dayOffset(0), type: 'BREAKFAST', description: 'Pain grillé, café', photoUri: null, product: null },
      { id: 2, date: dayOffset(0), type: 'LUNCH', description: 'Riz et poulet', photoUri: null, product: null },
      { id: 3, date: dayOffset(-1), type: 'DINNER', description: 'Soupe de légumes', photoUri: null, product: null },
    ],
    stools,
    profile: { firstName: 'Camille', lastName: 'Martin', birthDate: '1990-05-17', sex: 'FEMALE' },
    medications: [
      {
        id: 7, name: 'Adalimumab', dosage: '40 mg',
        schedule: { enabled: true, startDate: dayOffset(-30), hour: 8, minute: 30, repeatEvery: 2, repeatUnit: 'WEEK' },
        refillAlert: true, stockEndDate: dayOffset(20),
      },
    ],
    checkups: [
      {
        id: 3, type: 'BLOOD_TEST', note: 'À jeun',
        schedule: { enabled: true, startDate: dayOffset(10), hour: 7, minute: 15, repeatEvery: 3, repeatUnit: 'MONTH' },
      },
    ],
    labResults: [
      { id: 31, test: 'CRP', value: 5, date: dayOffset(-30), note: '', qualifier: 'BELOW', referenceLow: null, referenceHigh: 5 },
      { id: 32, test: 'CRP', value: 12, date: dayOffset(-5), note: '', qualifier: 'EXACT', referenceLow: null, referenceHigh: 5 },
      { id: 33, test: 'CALPROTECTIN', value: 123.5, date: dayOffset(-5), note: 'labo A', qualifier: 'EXACT', referenceLow: null, referenceHigh: 50 },
      { id: 34, test: 'HEMOGLOBIN', value: 12.8, date: dayOffset(-5), note: '', qualifier: 'EXACT', referenceLow: 12, referenceHigh: 16 },
    ],
    doseLogs: [{ id: 41, medicationId: 7, scheduledAt: Date.now() - 14 * 86_400_000, status: 'TAKEN', loggedAt: Date.now() - 14 * 86_400_000 }],
    exams: [
      {
        id: 5, type: 'COLONOSCOPY', at: `${dayOffset(30)}T09:30`, note: 'Sous anesthésie', dietDays: 3,
        prepFirstAt: `${dayOffset(29)}T18:00`, prepSecondAt: `${dayOffset(30)}T05:00`, anesthesiaAt: `${dayOffset(15)}T14:00`,
        remindersEnabled: true,
      },
    ],
  };
}

/** Encrypted `.ibdj` file (same format as the app's export) holding `seedData()`. */
export async function seedBackupFile(password = BACKUP_PASSWORD): Promise<Buffer> {
  const plain = new TextEncoder().encode(encodeBackupData(seedData()));
  return Buffer.from(await encrypt(plain, password));
}

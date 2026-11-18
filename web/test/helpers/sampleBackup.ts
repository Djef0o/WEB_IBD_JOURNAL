import type { BackupData } from '../../src/domain/models';

/** Fictional data covering every section of a backup (explicit ids, as on a real device). */
export function sampleBackup(): BackupData {
  return {
    meals: [
      {
        id: 11, date: '2026-03-01', type: 'BREAKFAST', description: 'Pain grillé, café',
        photoUri: null, product: null,
      },
      {
        id: 12, date: '2026-03-01', type: 'LUNCH', description: 'Riz et poulet',
        photoUri: null,
        product: { barcode: '3017620422003', name: 'Pâte à tartiner', brand: null, nutriscore: null, imageUrl: null, ingredients: null },
      },
    ],
    stools: [
      {
        id: 21, date: '2026-03-01', bristolType: 6, bloodLevel: 1, mucusLevel: 2, painLevel: 3, fatigueLevel: 4,
        comment: 'Matin ☀', createdAt: 1_772_352_000_000, urgency: true, nocturnal: false, falseUrge: false,
      },
      {
        id: 22, date: '2026-03-02', bristolType: 0, bloodLevel: 0, mucusLevel: 1, painLevel: 0, fatigueLevel: 0,
        comment: '', createdAt: 1_772_438_400_000, urgency: false, nocturnal: true, falseUrge: true,
      },
    ],
    profile: { firstName: 'Camille', lastName: 'Martin', birthDate: '1990-05-17', sex: 'FEMALE' },
    medications: [
      {
        id: 7, name: 'Adalimumab', dosage: '40 mg',
        schedule: { enabled: true, startDate: '2026-03-01', hour: 8, minute: 30, repeatEvery: 2, repeatUnit: 'WEEK' },
        refillAlert: true, stockEndDate: '2026-06-01',
      },
    ],
    checkups: [
      {
        id: 3, type: 'BLOOD_TEST', note: 'À jeun',
        schedule: { enabled: false, startDate: '2026-04-10', hour: 7, minute: 15, repeatEvery: 3, repeatUnit: 'MONTH' },
      },
    ],
    labResults: [
      { id: 31, test: 'CRP', value: 5, date: '2026-03-01', note: '', qualifier: 'BELOW', referenceLow: null, referenceHigh: 5 },
      { id: 32, test: 'CALPROTECTIN', value: 123.5, date: '2026-03-01', note: 'labo A', qualifier: 'EXACT', referenceLow: null, referenceHigh: 50 },
    ],
    doseLogs: [
      { id: 41, medicationId: 7, scheduledAt: 1_772_353_800_000, status: 'TAKEN', loggedAt: 1_772_354_000_000 },
      { id: 42, medicationId: 7, scheduledAt: 1_773_563_400_000, status: 'MISSED', loggedAt: 1_773_570_000_000 },
    ],
    exams: [
      {
        id: 5, type: 'COLONOSCOPY', at: '2026-05-12T09:30', note: 'Sous anesthésie', dietDays: 3,
        prepFirstAt: '2026-05-11T18:00', prepSecondAt: '2026-05-12T05:00', anesthesiaAt: '2026-04-20T14:00',
        remindersEnabled: true,
      },
    ],
  };
}

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
    profile: { firstName: 'Camille', lastName: 'Martin', birthDate: '1990-05-17', sex: 'FEMALE', diagnosis: null },
    medications: [
      {
        id: 7, name: 'Adalimumab', dosage: '40 mg',
        schedule: { enabled: true, startDate: '2026-03-01', hour: 8, minute: 30, repeatEvery: 2, repeatUnit: 'WEEK' },
        refillAlert: true, stockDoses: null, lowStockDoses: 7, stockEndDate: '2026-06-01',
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

/** `sampleBackup()` plus the sections added by the later Android versions, every field set. */
export function fullSampleBackup(): BackupData {
  const base = sampleBackup();
  return {
    ...base,
    profile: { ...base.profile!, diagnosis: 'CROHN' },
    medications: base.medications!.map((m) => ({ ...m, stockDoses: 12, lowStockDoses: 5 })),
    weights: [{ id: 61, date: '2026-03-01', kg: 68.4 }],
    flares: [
      { id: 71, start: '2026-02-10', end: '2026-02-24', treatment: 'prednisone 40 mg', hospitalized: true, note: 'Poussée sévère' },
      { id: 72, start: '2026-03-02', end: null, treatment: '', hospitalized: false, note: '' },
    ],
    activityScores: [
      { id: 81, date: '2026-03-01', kind: 'HBI', answers: [1, 2, 0, 3, 0, 0, 0, 1] },
    ],
    vaccinations: [
      { id: 91, type: 'INFLUENZA', date: '2025-10-15', nextDue: '2026-10-15', note: 'Pharmacie', reminderEnabled: true },
    ],
    steroidCourses: [
      { id: 101, drug: 'prednisone', start: '2026-02-10', steps: [{ doseMg: 40, days: 7 }, { doseMg: 30, days: 7 }, { doseMg: 12.5, days: 3 }], note: '' },
    ],
    emergencyInfo: {
      allergies: 'Pénicilline', doctorName: 'Dr Durand', doctorPhone: '0102030405', contactName: 'Alex',
      contactPhone: '0607080910', notes: 'Stomie : non', showOnLockScreen: true,
    },
    extraSymptoms: [{ date: '2026-03-01', symptoms: ['JOINTS', 'FEVER'] }],
    doctorQuestions: [
      { id: 111, text: 'Dose de vitamine D ?', done: false, createdAt: 1_772_352_000_000 },
      { id: 112, text: 'Vaccin zona', done: true, createdAt: 1_772_352_100_000 },
    ],
    appointments: [
      { id: 121, kind: 'GASTROENTEROLOGIST', at: '2026-04-02T10:15', place: 'CHU', note: 'Apporter les analyses', remindersEnabled: true },
    ],
    wellbeing: [
      { date: '2026-03-01', sleep: 2, stress: 4, mood: null, period: true },
    ],
  };
}

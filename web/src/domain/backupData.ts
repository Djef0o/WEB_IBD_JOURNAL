import {
  APPOINTMENT_KINDS, DIAGNOSES, EXTRA_SYMPTOMS, SCORE_KINDS, VACCINE_TYPES, WELLBEING_MAX, WELLBEING_MIN,
  type ActivityScore, type Appointment, type DoctorQuestion, type EmergencyInfo, type ExtraSymptom,
  type ExtraSymptomsDay, type Flare, type SteroidCourse, type Vaccination, type WellbeingDay,
} from './care';
import { DOSE_STATUSES, LAB_QUALIFIERS, LAB_TESTS, type DoseLog, type LabResult } from './health';
import {
  EXAM_TYPES, MEAL_TYPES, nowEpochMillis,
  type BackupData, type Exam, type Meal, type Product, type Stool, type Weight,
} from './models';
import {
  CHECKUP_TYPES, DEFAULT_LOW_STOCK_DOSES, REPEAT_UNITS, SEXES,
  type Checkup, type Medication, type Profile, type ReminderSchedule,
} from './profile';
import { parseLocalDate, parseLocalDateTime } from './time';

/*
 * JSON (de)serialization of BackupData, compatible with the Android app
 * (kotlinx.serialization, `ignoreUnknownKeys`): unknown keys are ignored, missing keys take
 * the Kotlin default, enums are names, dates are ISO strings. A malformed section throws.
 */

type Obj = Record<string, unknown>;

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path}: object expected`);
  }
  return value as Obj;
}

function list<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
  if (!Array.isArray(value)) throw new TypeError(`${path}: array expected`);
  return value.map((item, i) => read(item, `${path}[${i}]`));
}

/** Optional section: missing or null stays null (kotlinx `null` default). */
function optionalList<T>(
  value: unknown, path: string, read: (item: unknown, path: string) => T,
): T[] | null {
  return value === undefined || value === null ? null : list(value, path, read);
}

function num(o: Obj, key: string, path: string, fallback?: number): number {
  const v = o[key];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${path}.${key}: number expected`);
  return v;
}

function nullableNum(o: Obj, key: string, path: string): number | null {
  const v = o[key];
  return v === undefined || v === null ? null : num(o, key, path);
}

function text(o: Obj, key: string, path: string, fallback?: string): string {
  const v = o[key];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'string') throw new TypeError(`${path}.${key}: string expected`);
  return v;
}

function nullableText(o: Obj, key: string, path: string): string | null {
  const v = o[key];
  return v === undefined || v === null ? null : text(o, key, path);
}

function bool(o: Obj, key: string, path: string, fallback: boolean): boolean {
  const v = o[key];
  if (v === undefined) return fallback;
  if (typeof v !== 'boolean') throw new TypeError(`${path}.${key}: boolean expected`);
  return v;
}

function oneOf<T extends string>(o: Obj, key: string, path: string, values: readonly T[], fallback?: T): T {
  const v = o[key];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
    throw new TypeError(`${path}.${key}: one of ${values.join(', ')} expected`);
  }
  return v as T;
}

function date(o: Obj, key: string, path: string): string {
  return parseLocalDate(text(o, key, path));
}

function nullableDate(o: Obj, key: string, path: string): string | null {
  return o[key] === undefined || o[key] === null ? null : date(o, key, path);
}

function nullableDateTime(o: Obj, key: string, path: string): string | null {
  return o[key] === undefined || o[key] === null ? null : parseLocalDateTime(text(o, key, path));
}

function readProduct(value: unknown, path: string): Product {
  const o = obj(value, path);
  return {
    barcode: text(o, 'barcode', path),
    name: nullableText(o, 'name', path),
    brand: nullableText(o, 'brand', path),
    nutriscore: nullableText(o, 'nutriscore', path),
    imageUrl: nullableText(o, 'imageUrl', path),
    ingredients: nullableText(o, 'ingredients', path),
  };
}

function readMeal(value: unknown, path: string): Meal {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    date: date(o, 'date', path),
    type: oneOf(o, 'type', path, MEAL_TYPES),
    description: text(o, 'description', path),
    photoUri: nullableText(o, 'photoUri', path),
    product: o.product === undefined || o.product === null ? null : readProduct(o.product, `${path}.product`),
  };
}

function readStool(value: unknown, path: string): Stool {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    date: date(o, 'date', path),
    bristolType: num(o, 'bristolType', path, 4),
    bloodLevel: num(o, 'bloodLevel', path, 0),
    mucusLevel: num(o, 'mucusLevel', path, 0),
    painLevel: num(o, 'painLevel', path, 0),
    fatigueLevel: num(o, 'fatigueLevel', path, 0),
    comment: text(o, 'comment', path, ''),
    createdAt: num(o, 'createdAt', path, nowEpochMillis()),
    urgency: bool(o, 'urgency', path, false),
    nocturnal: bool(o, 'nocturnal', path, false),
    falseUrge: bool(o, 'falseUrge', path, false),
  };
}

function readProfile(value: unknown, path: string): Profile {
  const o = obj(value, path);
  return {
    firstName: text(o, 'firstName', path, ''),
    lastName: text(o, 'lastName', path, ''),
    birthDate: nullableDate(o, 'birthDate', path),
    sex: o.sex === undefined || o.sex === null ? null : oneOf(o, 'sex', path, SEXES),
    diagnosis: o.diagnosis === undefined || o.diagnosis === null ? null : oneOf(o, 'diagnosis', path, DIAGNOSES),
  };
}

function readSchedule(value: unknown, path: string): ReminderSchedule {
  const o = obj(value, path);
  return {
    enabled: bool(o, 'enabled', path, true),
    startDate: date(o, 'startDate', path),
    hour: num(o, 'hour', path, 8),
    minute: num(o, 'minute', path, 0),
    repeatEvery: num(o, 'repeatEvery', path, 1),
    repeatUnit: oneOf(o, 'repeatUnit', path, REPEAT_UNITS, 'DAY'),
  };
}

function readMedication(value: unknown, path: string): Medication {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    name: text(o, 'name', path),
    dosage: text(o, 'dosage', path, ''),
    schedule: readSchedule(o.schedule, `${path}.schedule`),
    refillAlert: bool(o, 'refillAlert', path, false),
    stockDoses: nullableNum(o, 'stockDoses', path),
    lowStockDoses: num(o, 'lowStockDoses', path, DEFAULT_LOW_STOCK_DOSES),
    stockEndDate: nullableDate(o, 'stockEndDate', path),
  };
}

function readCheckup(value: unknown, path: string): Checkup {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    type: oneOf(o, 'type', path, CHECKUP_TYPES),
    note: text(o, 'note', path, ''),
    schedule: readSchedule(o.schedule, `${path}.schedule`),
  };
}

function readLabResult(value: unknown, path: string): LabResult {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    test: oneOf(o, 'test', path, LAB_TESTS),
    value: num(o, 'value', path),
    date: date(o, 'date', path),
    note: text(o, 'note', path, ''),
    qualifier: oneOf(o, 'qualifier', path, LAB_QUALIFIERS, 'EXACT'),
    referenceLow: nullableNum(o, 'referenceLow', path),
    referenceHigh: nullableNum(o, 'referenceHigh', path),
  };
}

function readDoseLog(value: unknown, path: string): DoseLog {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    medicationId: num(o, 'medicationId', path),
    scheduledAt: num(o, 'scheduledAt', path),
    status: oneOf(o, 'status', path, DOSE_STATUSES),
    loggedAt: num(o, 'loggedAt', path, nowEpochMillis()),
  };
}

function readExam(value: unknown, path: string): Exam {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    type: oneOf(o, 'type', path, EXAM_TYPES),
    at: parseLocalDateTime(text(o, 'at', path)),
    note: text(o, 'note', path, ''),
    dietDays: num(o, 'dietDays', path, 0),
    prepFirstAt: nullableDateTime(o, 'prepFirstAt', path),
    prepSecondAt: nullableDateTime(o, 'prepSecondAt', path),
    anesthesiaAt: nullableDateTime(o, 'anesthesiaAt', path),
    remindersEnabled: bool(o, 'remindersEnabled', path, true),
  };
}

function readWeight(value: unknown, path: string): Weight {
  const o = obj(value, path);
  const kg = num(o, 'kg', path);
  if (kg <= 0) throw new TypeError(`${path}.kg: positive number expected`);
  return { id: num(o, 'id', path, 0), date: date(o, 'date', path), kg };
}

function readFlare(value: unknown, path: string): Flare {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    start: date(o, 'start', path),
    end: nullableDate(o, 'end', path),
    treatment: text(o, 'treatment', path, ''),
    hospitalized: bool(o, 'hospitalized', path, false),
    note: text(o, 'note', path, ''),
  };
}

function readActivityScore(value: unknown, path: string): ActivityScore {
  const o = obj(value, path);
  const answers = list(o.answers, `${path}.answers`, (item, itemPath) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) throw new TypeError(`${itemPath}: number expected`);
    return item;
  });
  return {
    id: num(o, 'id', path, 0),
    date: date(o, 'date', path),
    kind: oneOf(o, 'kind', path, SCORE_KINDS),
    answers,
  };
}

function readVaccination(value: unknown, path: string): Vaccination {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    type: oneOf(o, 'type', path, VACCINE_TYPES),
    date: date(o, 'date', path),
    nextDue: nullableDate(o, 'nextDue', path),
    note: text(o, 'note', path, ''),
    reminderEnabled: bool(o, 'reminderEnabled', path, false),
  };
}

function readSteroidCourse(value: unknown, path: string): SteroidCourse {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    drug: text(o, 'drug', path),
    start: date(o, 'start', path),
    steps: list(o.steps, `${path}.steps`, (item, itemPath) => {
      const step = obj(item, itemPath);
      return { doseMg: num(step, 'doseMg', itemPath), days: num(step, 'days', itemPath) };
    }),
    note: text(o, 'note', path, ''),
  };
}

function readEmergencyInfo(value: unknown, path: string): EmergencyInfo {
  const o = obj(value, path);
  return {
    allergies: text(o, 'allergies', path, ''),
    doctorName: text(o, 'doctorName', path, ''),
    doctorPhone: text(o, 'doctorPhone', path, ''),
    contactName: text(o, 'contactName', path, ''),
    contactPhone: text(o, 'contactPhone', path, ''),
    notes: text(o, 'notes', path, ''),
    showOnLockScreen: bool(o, 'showOnLockScreen', path, false),
  };
}

function readExtraSymptomsDay(value: unknown, path: string): ExtraSymptomsDay {
  const o = obj(value, path);
  const known = new Set(list(o.symptoms, `${path}.symptoms`, (item, itemPath) => {
    if (typeof item !== 'string' || !(EXTRA_SYMPTOMS as readonly string[]).includes(item)) {
      throw new TypeError(`${itemPath}: one of ${EXTRA_SYMPTOMS.join(', ')} expected`);
    }
    return item as ExtraSymptom;
  }));
  return { date: date(o, 'date', path), symptoms: EXTRA_SYMPTOMS.filter((symptom) => known.has(symptom)) };
}

function readDoctorQuestion(value: unknown, path: string): DoctorQuestion {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    text: text(o, 'text', path),
    done: bool(o, 'done', path, false),
    createdAt: num(o, 'createdAt', path, nowEpochMillis()),
  };
}

function readAppointment(value: unknown, path: string): Appointment {
  const o = obj(value, path);
  return {
    id: num(o, 'id', path, 0),
    kind: oneOf(o, 'kind', path, APPOINTMENT_KINDS),
    at: parseLocalDateTime(text(o, 'at', path)),
    place: text(o, 'place', path, ''),
    note: text(o, 'note', path, ''),
    remindersEnabled: bool(o, 'remindersEnabled', path, true),
  };
}

/** A 1 to 5 scale value, or null when not noted. */
function scale(o: Obj, key: string, path: string): number | null {
  const v = nullableNum(o, key, path);
  if (v !== null && (!Number.isInteger(v) || v < WELLBEING_MIN || v > WELLBEING_MAX)) {
    throw new TypeError(`${path}.${key}: integer from ${WELLBEING_MIN} to ${WELLBEING_MAX} expected`);
  }
  return v;
}

function readWellbeingDay(value: unknown, path: string): WellbeingDay {
  const o = obj(value, path);
  return {
    date: date(o, 'date', path),
    sleep: scale(o, 'sleep', path),
    stress: scale(o, 'stress', path),
    mood: scale(o, 'mood', path),
    period: bool(o, 'period', path, false),
  };
}

/**
 * Decodes the JSON clear text of a backup (`BackupData`). Sections absent from earlier
 * backups come back as `null`, meaning "leave the current data untouched".
 */
export function decodeBackupData(json: string): BackupData {
  const root = obj(JSON.parse(json), 'backup');
  return {
    meals: list(root.meals, 'meals', readMeal),
    stools: list(root.stools, 'stools', readStool),
    profile: root.profile === undefined || root.profile === null ? null : readProfile(root.profile, 'profile'),
    medications: optionalList(root.medications, 'medications', readMedication),
    checkups: optionalList(root.checkups, 'checkups', readCheckup),
    labResults: optionalList(root.labResults, 'labResults', readLabResult),
    doseLogs: optionalList(root.doseLogs, 'doseLogs', readDoseLog),
    exams: optionalList(root.exams, 'exams', readExam),
    weights: optionalList(root.weights, 'weights', readWeight),
    flares: optionalList(root.flares, 'flares', readFlare),
    activityScores: optionalList(root.activityScores, 'activityScores', readActivityScore),
    vaccinations: optionalList(root.vaccinations, 'vaccinations', readVaccination),
    steroidCourses: optionalList(root.steroidCourses, 'steroidCourses', readSteroidCourse),
    emergencyInfo: root.emergencyInfo === undefined || root.emergencyInfo === null
      ? null
      : readEmergencyInfo(root.emergencyInfo, 'emergencyInfo'),
    extraSymptoms: optionalList(root.extraSymptoms, 'extraSymptoms', readExtraSymptomsDay),
    doctorQuestions: optionalList(root.doctorQuestions, 'doctorQuestions', readDoctorQuestion),
    appointments: optionalList(root.appointments, 'appointments', readAppointment),
    wellbeing: optionalList(root.wellbeing, 'wellbeing', readWellbeingDay),
  };
}

/** JSON clear text of a backup, all fields written (readable by the Android app). */
export function encodeBackupData(backup: BackupData): string {
  return JSON.stringify(backup);
}

import type { DoseLog, DoseStatus, LabQualifier, LabResult, LabTest } from './health';
import {
  nowEpochMillis, type Exam, type ExamType, type Meal, type MealType, type Product, type Stool,
} from './models';
import type { Checkup, CheckupType, Medication, Profile, ReminderSchedule, RepeatUnit, Sex } from './profile';
import { fromEpochDays, toEpochDays } from './time';

/*
 * Stored (persisted) shapes: same columns as the Room entities of the Android app
 * (`Entities.kt`, `ExamStore.kt`). Dates are `dateEpochDay` numbers, enums are names;
 * these shapes are the contract of the IndexedDB stores.
 */

export interface MealEntity {
  id: number;
  dateEpochDay: number;
  mealType: MealType;
  description: string;
  photoPath: string | null;
  productBarcode: string | null;
  productName: string | null;
  createdAt: number;
}

export interface StoolEntity {
  id: number;
  dateEpochDay: number;
  bristolType: number;
  bloodLevel: number;
  mucusLevel: number;
  painLevel: number;
  fatigueLevel: number;
  comment: string;
  createdAt: number;
  urgency: boolean;
  nocturnal: boolean;
  falseUrge: boolean;
}

/** Open Food Facts product cache, by barcode. */
export interface ProductEntity {
  barcode: string;
  name: string | null;
  brand: string | null;
  nutriscore: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  fetchedAt: number;
}

/** Lab results: `qualifier` null = EXACT (only thresholds are stored). */
export interface LabResultEntity {
  id: number;
  test: LabTest;
  value: number;
  dateEpochDay: number;
  note: string;
  qualifier: LabQualifier | null;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface DoseLogEntity {
  id: number;
  medicationId: number;
  scheduledAt: number;
  status: DoseStatus;
  loggedAt: number;
}

/** A single row (id = {@link PROFILE_SINGLE_ID}): the app only handles one profile. */
export interface ProfileEntity {
  id: number;
  firstName: string;
  lastName: string;
  birthDateEpochDay: number | null;
  sex: Sex | null;
}

export const PROFILE_SINGLE_ID = 1;

/** Scheduling columns shared by treatments and checkups (Room `@Embedded`: flattened columns). */
export interface ScheduleColumns {
  reminderEnabled: boolean;
  startDateEpochDay: number;
  hour: number;
  minute: number;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
}

export interface MedicationEntity extends ScheduleColumns {
  id: number;
  name: string;
  dosage: string;
  createdAt: number;
  refillAlert: boolean;
  stockEndEpochDay: number | null;
}

export interface CheckupEntity extends ScheduleColumns {
  id: number;
  type: CheckupType;
  note: string;
  createdAt: number;
}

/**
 * Exams. Local dates and times in ISO format ("2026-12-04T09:30"): they stay those of the
 * appointment even if the time zone changes, and sort like text.
 */
export interface ExamEntity {
  id: number;
  type: ExamType;
  at: string;
  note: string;
  dietDays: number;
  prepFirstAt: string | null;
  prepSecondAt: string | null;
  anesthesiaAt: string | null;
  remindersEnabled: boolean;
}

// --- Mappers entity <-> domain model ---

export function mealFromEntity(entity: MealEntity, product: ProductEntity | null = null): Meal {
  return {
    id: entity.id,
    date: fromEpochDays(entity.dateEpochDay),
    type: entity.mealType,
    description: entity.description,
    photoUri: entity.photoPath,
    // The meal only stores barcode and name; the rest comes from the `products` cache.
    product: product
      ? productFromEntity(product)
      : entity.productBarcode === null
        ? null
        : { barcode: entity.productBarcode, name: entity.productName, brand: null, nutriscore: null, imageUrl: null, ingredients: null },
  };
}

export function mealToEntity(meal: Meal, createdAt: number = nowEpochMillis()): MealEntity {
  return {
    id: meal.id,
    dateEpochDay: toEpochDays(meal.date),
    mealType: meal.type,
    description: meal.description,
    photoPath: meal.photoUri,
    productBarcode: meal.product?.barcode ?? null,
    productName: meal.product?.name ?? null,
    createdAt,
  };
}

export function stoolFromEntity(entity: StoolEntity): Stool {
  const { dateEpochDay, ...rest } = entity;
  return { ...rest, date: fromEpochDays(dateEpochDay) };
}

export function stoolToEntity(stool: Stool): StoolEntity {
  const { date, ...rest } = stool;
  return { ...rest, dateEpochDay: toEpochDays(date) };
}

export function labResultFromEntity(entity: LabResultEntity): LabResult {
  return {
    id: entity.id,
    test: entity.test,
    value: entity.value,
    date: fromEpochDays(entity.dateEpochDay),
    note: entity.note,
    qualifier: entity.qualifier ?? 'EXACT',
    referenceLow: entity.referenceLow,
    referenceHigh: entity.referenceHigh,
  };
}

export function labResultToEntity(result: LabResult): LabResultEntity {
  return {
    id: result.id,
    test: result.test,
    value: result.value,
    dateEpochDay: toEpochDays(result.date),
    note: result.note,
    qualifier: result.qualifier === 'EXACT' ? null : result.qualifier,
    referenceLow: result.referenceLow,
    referenceHigh: result.referenceHigh,
  };
}

export function doseLogFromEntity(entity: DoseLogEntity): DoseLog {
  return { ...entity };
}

export function doseLogToEntity(log: DoseLog): DoseLogEntity {
  return { ...log };
}

export function productFromEntity(entity: ProductEntity): Product {
  const { fetchedAt: _fetchedAt, ...product } = entity;
  return product;
}

export function productToEntity(product: Product, fetchedAt: number = nowEpochMillis()): ProductEntity {
  return { ...product, fetchedAt };
}

export function profileFromEntity(entity: ProfileEntity): Profile {
  return {
    firstName: entity.firstName,
    lastName: entity.lastName,
    birthDate: entity.birthDateEpochDay === null ? null : fromEpochDays(entity.birthDateEpochDay),
    sex: entity.sex,
  };
}

export function profileToEntity(profile: Profile): ProfileEntity {
  return {
    id: PROFILE_SINGLE_ID,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDateEpochDay: profile.birthDate === null ? null : toEpochDays(profile.birthDate),
    sex: profile.sex,
  };
}

export function scheduleFromColumns(columns: ScheduleColumns): ReminderSchedule {
  return {
    enabled: columns.reminderEnabled,
    startDate: fromEpochDays(columns.startDateEpochDay),
    hour: columns.hour,
    minute: columns.minute,
    repeatEvery: columns.repeatEvery,
    repeatUnit: columns.repeatUnit,
  };
}

export function scheduleToColumns(schedule: ReminderSchedule): ScheduleColumns {
  return {
    reminderEnabled: schedule.enabled,
    startDateEpochDay: toEpochDays(schedule.startDate),
    hour: schedule.hour,
    minute: schedule.minute,
    repeatEvery: schedule.repeatEvery,
    repeatUnit: schedule.repeatUnit,
  };
}

export function medicationFromEntity(entity: MedicationEntity): Medication {
  return {
    id: entity.id,
    name: entity.name,
    dosage: entity.dosage,
    schedule: scheduleFromColumns(entity),
    refillAlert: entity.refillAlert,
    stockEndDate: entity.stockEndEpochDay === null ? null : fromEpochDays(entity.stockEndEpochDay),
  };
}

export function medicationToEntity(med: Medication, createdAt: number = nowEpochMillis()): MedicationEntity {
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    ...scheduleToColumns(med.schedule),
    createdAt,
    refillAlert: med.refillAlert,
    stockEndEpochDay: med.stockEndDate === null ? null : toEpochDays(med.stockEndDate),
  };
}

export function checkupFromEntity(entity: CheckupEntity): Checkup {
  return { id: entity.id, type: entity.type, note: entity.note, schedule: scheduleFromColumns(entity) };
}

export function checkupToEntity(checkup: Checkup, createdAt: number = nowEpochMillis()): CheckupEntity {
  return {
    id: checkup.id,
    type: checkup.type,
    note: checkup.note,
    ...scheduleToColumns(checkup.schedule),
    createdAt,
  };
}

export function examFromEntity(entity: ExamEntity): Exam {
  return { ...entity };
}

export function examToEntity(exam: Exam): ExamEntity {
  return { ...exam };
}

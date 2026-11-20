import { getAllCheckups } from '../db/checkups';
import { getAllExams } from '../db/exams';
import { getAllAppointments } from '../db/followup';
import { getAllMedications } from '../db/medications';
import { getBackupSettings, getWeighInSettings } from '../db/prefs';
import { getAllVaccinations } from '../db/vaccinations';
import type { ReminderData } from './schedule';

/** Stores `loadReminderData` reads, for `useLiveQuery` / `watchQuery`. */
export const REMINDER_STORES = ['medications', 'checkups', 'exams', 'vaccinations', 'appointments', 'prefs'] as const;

/** Everything that can remind the user of something, read in one go (`ReminderSource.read`). */
export async function loadReminderData(): Promise<ReminderData> {
  const [medications, checkups, exams, vaccinations, appointments, backup, weighIn] = await Promise.all([
    getAllMedications(), getAllCheckups(), getAllExams(), getAllVaccinations(), getAllAppointments(),
    getBackupSettings(), getWeighInSettings(),
  ]);
  return { medications, checkups, exams, vaccinations, appointments, backup, weighIn };
}

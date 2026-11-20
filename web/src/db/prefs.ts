import { DEFAULT_WEIGH_IN_DAY } from '../domain/weighIn';
import { dateOf, fromEpochDays, localDateTimeAt, toEpochDays, type LocalDate } from '../domain/time';
import { computed, type ReadonlySignal } from '@preact/signals';
import { isLang, type Lang } from '../i18n';
import { THEME_MODES, THEME_PALETTES, type ThemeMode, type ThemePalette } from '../ui/theme';
import { transaction } from './connection';
import { liveSignal } from './live';

/*
 * Application preferences, the equivalent of `AppPrefs.kt` (DataStore): one entry per
 * preference in the `prefs` store, under the same names as on Android. A missing or invalid
 * value gives the default, never an error. Android-only settings (phone calendar sync,
 * notification channel) have no web counterpart; `lang` and `last_backup_at` are web
 * additions. Preferences are not part of the backup.
 */

const KEYS = {
  onboardingDone: 'onboarding_done',
  notifEnabled: 'notif_enabled',
  notifHour: 'notif_hour',
  notifMinute: 'notif_minute',
  lastReminderAt: 'last_reminder_at',
  themeMode: 'theme_mode',
  themePalette: 'theme_palette',
  lang: 'lang',
  lastBackupAt: 'last_backup_at',
  checkinDay: 'checkin_day',
  checkinStoolId: 'checkin_stool_id',
  checkinBristol: 'checkin_bristol',
  checkinFatigue: 'checkin_fatigue',
  checkinPain: 'checkin_pain',
  backupReminder: 'backup_reminder',
  backupSinceDay: 'backup_since_day',
  weighInReminder: 'weigh_in_reminder',
  weighInDay: 'weigh_in_day',
} as const;

/** Evening reminder (`NotificationSettings`). */
export interface NotificationSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  /** Timestamp of the last reminder actually shown (diagnostics). */
  lastReminderAt: number | null;
}

export interface Appearance {
  mode: ThemeMode;
  palette: ThemePalette;
}

/** Every preference with its default (`AppPrefs` flows, in one object). */
export interface Prefs {
  /** true if the user has already seen the welcome screen. */
  onboardingDone: boolean;
  notifications: NotificationSettings;
  /** Unknown value (old version, removed palette): falls back to the default. */
  appearance: Appearance;
  /** Language chosen by the user; null = follow `navigator.languages`. */
  lang: Lang | null;
  /** Timestamp of the last encrypted export, to remind the user to make one; null = never. */
  lastBackupAt: number | null;
}

/**
 * Answers to the evening check-in for the day `epochDay`: the recorded stool (`stoolId`,
 * `bristolType`), pain and fatigue (`DailyCheckIn`). The check-in stays open as long as
 * one of the three answers is missing.
 */
export interface DailyCheckIn {
  epochDay: number;
  stoolId: number | null;
  bristolType: number | null;
  fatigueLevel: number | null;
  painLevel: number | null;
}

/** Nothing answered yet for that day. */
export function emptyCheckIn(epochDay: number): DailyCheckIn {
  return { epochDay, stoolId: null, bristolType: null, fatigueLevel: null, painLevel: null };
}

export function isCheckInComplete(checkIn: DailyCheckIn): boolean {
  return checkIn.bristolType !== null && checkIn.painLevel !== null && checkIn.fatigueLevel !== null;
}

type Raw = ReadonlyMap<string, unknown>;

function readBoolean(raw: Raw, key: string, fallback: boolean): boolean {
  const value = raw.get(key);
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(raw: Raw, key: string): number | null {
  const value = raw.get(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOneOf<T extends string>(raw: Raw, key: string, allowed: readonly T[]): T | null {
  const value = raw.get(key);
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parsePrefs(raw: Raw): Prefs {
  const lang = raw.get(KEYS.lang);
  return {
    onboardingDone: readBoolean(raw, KEYS.onboardingDone, false),
    notifications: {
      enabled: readBoolean(raw, KEYS.notifEnabled, true),
      hour: readNumber(raw, KEYS.notifHour) ?? 19,
      minute: readNumber(raw, KEYS.notifMinute) ?? 0,
      lastReminderAt: readNumber(raw, KEYS.lastReminderAt),
    },
    appearance: {
      mode: readOneOf(raw, KEYS.themeMode, THEME_MODES) ?? 'SYSTEM',
      palette: readOneOf(raw, KEYS.themePalette, THEME_PALETTES) ?? 'SAGE',
    },
    lang: isLang(lang) ? lang : null,
    lastBackupAt: readNumber(raw, KEYS.lastBackupAt),
  };
}

async function readRaw(): Promise<Map<string, unknown>> {
  return transaction(['prefs'], 'readonly', async (tx) => {
    const store = tx.objectStore('prefs');
    const [keys, values] = await Promise.all([store.getAllKeys(), store.getAll()]);
    return new Map(keys.map((key, i) => [key, values[i]]));
  });
}

/** Changes preferences in one transaction; an `undefined` value removes the preference. */
function writeRaw(changes: Readonly<Record<string, unknown>>): Promise<void> {
  return transaction(['prefs'], 'readwrite', async (tx) => {
    const store = tx.objectStore('prefs');
    await Promise.all(
      Object.entries(changes).map(([key, value]) => (value === undefined ? store.delete(key) : store.put(value, key))),
    );
  });
}

/** All the preferences (one-shot read; for display, prefer the signals below). */
export async function getPrefs(): Promise<Prefs> {
  return parsePrefs(await readRaw());
}

/** `undefined` until the first read of the database ends. */
export const prefsSignal: ReadonlySignal<Prefs | undefined> = liveSignal(['prefs'], getPrefs);

export const onboardingDone: ReadonlySignal<boolean | undefined> = computed(() => prefsSignal.value?.onboardingDone);
export const notificationSettings: ReadonlySignal<NotificationSettings | undefined> = computed(
  () => prefsSignal.value?.notifications,
);
export const appearance: ReadonlySignal<Appearance | undefined> = computed(() => prefsSignal.value?.appearance);
export const langPref: ReadonlySignal<Lang | null | undefined> = computed(() => prefsSignal.value?.lang);
export const lastBackupAt: ReadonlySignal<number | null | undefined> = computed(() => prefsSignal.value?.lastBackupAt);

export function markOnboardingDone(): Promise<void> {
  return writeRaw({ [KEYS.onboardingDone]: true });
}

export function updateNotificationSettings(enabled: boolean, hour: number, minute: number): Promise<void> {
  return writeRaw({ [KEYS.notifEnabled]: enabled, [KEYS.notifHour]: hour, [KEYS.notifMinute]: minute });
}

/** Records that a reminder was just shown (diagnostics in settings). */
export function markReminderShown(at: number = Date.now()): Promise<void> {
  return writeRaw({ [KEYS.lastReminderAt]: at });
}

export function setThemeModePref(mode: ThemeMode): Promise<void> {
  return writeRaw({ [KEYS.themeMode]: mode });
}

export function setThemePalettePref(palette: ThemePalette): Promise<void> {
  return writeRaw({ [KEYS.themePalette]: palette });
}

/** `null`: follow the browser's languages again. */
export function setLangPref(lang: Lang | null): Promise<void> {
  return writeRaw({ [KEYS.lang]: lang ?? undefined });
}

/** Records that an export was just made. */
export function markBackupDone(at: number = Date.now()): Promise<void> {
  return writeRaw({ [KEYS.lastBackupAt]: at });
}

/** Encrypted-backup status and reminder (`BackupSettings`); dates are local calendar days. */
export interface BackupSettings {
  reminderEnabled: boolean;
  lastBackup: LocalDate | null;
  /** Start of the reminder countdown while there is no backup (set once, at first use). */
  since: LocalDate | null;
}

/** Weekly weigh-in reminder (`WeighInSettings`); `day`: ISO day of the week, 1 = Monday … 7 = Sunday. */
export interface WeighInSettings {
  enabled: boolean;
  day: number;
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const raw = await readRaw();
  const last = readNumber(raw, KEYS.lastBackupAt);
  const since = readNumber(raw, KEYS.backupSinceDay);
  return {
    reminderEnabled: readBoolean(raw, KEYS.backupReminder, true),
    lastBackup: last === null ? null : dateOf(localDateTimeAt(last)),
    since: since === null ? null : fromEpochDays(since),
  };
}

export async function getWeighInSettings(): Promise<WeighInSettings> {
  const raw = await readRaw();
  const day = readNumber(raw, KEYS.weighInDay);
  return {
    enabled: readBoolean(raw, KEYS.weighInReminder, false),
    day: day !== null && Number.isInteger(day) && day >= 1 && day <= 7 ? day : DEFAULT_WEIGH_IN_DAY,
  };
}

/** `undefined` until the first read. */
export const backupSettingsSignal: ReadonlySignal<BackupSettings | undefined> = liveSignal(['prefs'], getBackupSettings);
export const weighInSignal: ReadonlySignal<WeighInSettings | undefined> = liveSignal(['prefs'], getWeighInSettings);

export function setBackupReminderEnabled(enabled: boolean): Promise<void> {
  return writeRaw({ [KEYS.backupReminder]: enabled });
}

/** Day the reminder countdown started when no backup exists yet: set once, at first use. */
export async function ensureBackupSince(today: LocalDate): Promise<LocalDate> {
  const saved = readNumber(await readRaw(), KEYS.backupSinceDay);
  if (saved !== null) return fromEpochDays(saved);
  await writeRaw({ [KEYS.backupSinceDay]: toEpochDays(today) });
  return today;
}

export function setWeighIn(enabled: boolean, day: number): Promise<void> {
  return writeRaw({ [KEYS.weighInReminder]: enabled, [KEYS.weighInDay]: day });
}

/**
 * Today's answers to the evening check-in. An answer from another day is ignored: each day
 * starts from scratch.
 */
export async function getDailyCheckIn(epochDay: number): Promise<DailyCheckIn> {
  const raw = await readRaw();
  if (readNumber(raw, KEYS.checkinDay) !== epochDay) return emptyCheckIn(epochDay);
  return {
    epochDay,
    stoolId: readNumber(raw, KEYS.checkinStoolId),
    bristolType: readNumber(raw, KEYS.checkinBristol),
    fatigueLevel: readNumber(raw, KEYS.checkinFatigue),
    painLevel: readNumber(raw, KEYS.checkinPain),
  };
}

export function saveDailyCheckIn(checkIn: DailyCheckIn): Promise<void> {
  return writeRaw({
    [KEYS.checkinDay]: checkIn.epochDay,
    [KEYS.checkinStoolId]: checkIn.stoolId ?? undefined,
    [KEYS.checkinBristol]: checkIn.bristolType ?? undefined,
    [KEYS.checkinFatigue]: checkIn.fatigueLevel ?? undefined,
    [KEYS.checkinPain]: checkIn.painLevel ?? undefined,
  });
}

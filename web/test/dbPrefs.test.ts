import { beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import { transaction } from '../src/db/connection';
import {
  appearance, emptyCheckIn, getDailyCheckIn, getPrefs, isCheckInComplete, langPref, lastBackupAt, markBackupDone,
  markOnboardingDone, markReminderShown, notificationSettings, onboardingDone, prefsSignal, saveDailyCheckIn, setLangPref,
  setThemeModePref, setThemePalettePref, updateNotificationSettings,
} from '../src/db/prefs';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

const writeRawPref = (key: string, value: unknown) =>
  transaction(['prefs'], 'readwrite', async (tx) => {
    await tx.objectStore('prefs').put(value, key);
  });

describe('prefs', () => {
  it('has the AppPrefs defaults on an empty database', async () => {
    expect(await getPrefs()).toEqual({
      onboardingDone: false,
      notifications: { enabled: true, hour: 19, minute: 0, lastReminderAt: null },
      appearance: { mode: 'SYSTEM', palette: 'SAGE' },
      lang: null,
      lastBackupAt: null,
    });
  });

  it('stores each preference under its Android name', async () => {
    await markOnboardingDone();
    await updateNotificationSettings(false, 21, 45);
    await markReminderShown(1234);
    await setThemeModePref('AMOLED');
    await setThemePalettePref('ROSE_PINE');
    await setLangPref('fr');
    await markBackupDone(5678);
    const stored = await transaction(['prefs'], 'readonly', async (tx) => {
      const store = tx.objectStore('prefs');
      return Object.fromEntries((await store.getAllKeys()).map((key, i) => [key, i])) as Record<string, number>;
    });
    expect(Object.keys(stored).sort()).toEqual([
      'lang', 'last_backup_at', 'last_reminder_at', 'notif_enabled', 'notif_hour', 'notif_minute',
      'onboarding_done', 'theme_mode', 'theme_palette',
    ]);
    expect(await getPrefs()).toEqual({
      onboardingDone: true,
      notifications: { enabled: false, hour: 21, minute: 45, lastReminderAt: 1234 },
      appearance: { mode: 'AMOLED', palette: 'ROSE_PINE' },
      lang: 'fr',
      lastBackupAt: 5678,
    });
  });

  it('falls back to the default for an unknown appearance or language', async () => {
    await writeRawPref('theme_mode', 'NEON');
    await writeRawPref('theme_palette', 'removed-palette');
    await writeRawPref('lang', 'tlh');
    await writeRawPref('notif_hour', 'late');
    const prefs = await getPrefs();
    expect(prefs.appearance).toEqual({ mode: 'SYSTEM', palette: 'SAGE' });
    expect(prefs.lang).toBeNull();
    expect(prefs.notifications.hour).toBe(19);
  });

  it('clears the language preference with null', async () => {
    await setLangPref('de');
    expect((await getPrefs()).lang).toBe('de');
    await setLangPref(null);
    expect((await getPrefs()).lang).toBeNull();
  });

  it('exposes reactive signals, undefined until loaded', async () => {
    const seen: unknown[] = [];
    const stop = effect(() => {
      seen.push([onboardingDone.value, notificationSettings.value?.hour, appearance.value?.mode, langPref.value, lastBackupAt.value]);
    });
    expect(seen[0]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    await expect.poll(() => onboardingDone.value).toBe(false);
    expect(prefsSignal.value?.notifications.hour).toBe(19);
    await markOnboardingDone();
    await setThemeModePref('DARK');
    await setLangPref('it');
    await updateNotificationSettings(true, 7, 0);
    await markBackupDone(99);
    await expect.poll(() => lastBackupAt.value).toBe(99);
    expect(onboardingDone.value).toBe(true);
    expect(appearance.value).toEqual({ mode: 'DARK', palette: 'SAGE' });
    expect(langPref.value).toBe('it');
    expect(notificationSettings.value).toMatchObject({ hour: 7, minute: 0 });
    stop();
  });
});

describe('daily check-in', () => {
  it('is empty until something is saved, and incomplete until all three answers are there', async () => {
    expect(await getDailyCheckIn(20_000)).toEqual(emptyCheckIn(20_000));
    expect(isCheckInComplete(emptyCheckIn(20_000))).toBe(false);

    await saveDailyCheckIn({ ...emptyCheckIn(20_000), stoolId: 7, bristolType: 4 });
    const partial = await getDailyCheckIn(20_000);
    expect(partial).toEqual({ epochDay: 20_000, stoolId: 7, bristolType: 4, fatigueLevel: null, painLevel: null });
    expect(isCheckInComplete(partial)).toBe(false);

    await saveDailyCheckIn({ ...partial, painLevel: 0, fatigueLevel: 2 });
    const complete = await getDailyCheckIn(20_000);
    expect(complete).toEqual({ epochDay: 20_000, stoolId: 7, bristolType: 4, fatigueLevel: 2, painLevel: 0 });
    expect(isCheckInComplete(complete)).toBe(true);
  });

  it('ignores the answers of another day: each day starts from scratch', async () => {
    await saveDailyCheckIn({ epochDay: 20_000, stoolId: 7, bristolType: 4, fatigueLevel: 2, painLevel: 1 });
    expect(await getDailyCheckIn(20_001)).toEqual(emptyCheckIn(20_001));
    expect(await getDailyCheckIn(20_000)).toMatchObject({ bristolType: 4 });
  });

  it('removes the answers that become null', async () => {
    await saveDailyCheckIn({ epochDay: 20_000, stoolId: 7, bristolType: 4, fatigueLevel: 2, painLevel: 1 });
    await saveDailyCheckIn({ epochDay: 20_000, stoolId: null, bristolType: null, fatigueLevel: 2, painLevel: null });
    expect(await getDailyCheckIn(20_000)).toEqual({
      epochDay: 20_000, stoolId: null, bristolType: null, fatigueLevel: 2, painLevel: null,
    });
  });
});

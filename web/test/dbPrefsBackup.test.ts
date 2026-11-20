import { beforeEach, describe, expect, it } from 'vitest';
import { transaction } from '../src/db/connection';
import {
  ensureBackupSince, getBackupSettings, getPrefs, getWeighInSettings, markBackupDone, setBackupReminderEnabled,
  setWeighIn,
} from '../src/db/prefs';
import { dateOf, localDateTimeAt } from '../src/domain/time';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('backup and weigh-in prefs', () => {
  it('has the AppPrefs defaults', async () => {
    expect(await getBackupSettings()).toEqual({ reminderEnabled: true, lastBackup: null, since: null });
    expect(await getWeighInSettings()).toEqual({ enabled: false, day: 7 });
  });

  it('keeps the backup day, the reminder switch and the countdown start', async () => {
    const at = Date.now();
    await markBackupDone(at);
    await setBackupReminderEnabled(false);
    expect(await ensureBackupSince('2026-11-01')).toBe('2026-11-01');
    // Set once: a later call returns the first day.
    expect(await ensureBackupSince('2026-12-01')).toBe('2026-11-01');
    expect(await getBackupSettings()).toEqual({
      reminderEnabled: false, lastBackup: dateOf(localDateTimeAt(at)), since: '2026-11-01',
    });
    expect((await getPrefs()).lastBackupAt).toBe(at);
  });

  it('stores the weigh-in switch and weekday, and ignores an invalid weekday', async () => {
    await setWeighIn(true, 3);
    expect(await getWeighInSettings()).toEqual({ enabled: true, day: 3 });
    await transaction(['prefs'], 'readwrite', async (tx) => { await tx.objectStore('prefs').put(9, 'weigh_in_day'); });
    expect((await getWeighInSettings()).day).toBe(7);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../src/db/connection';
import { getAllStools, getStoolsBetween, saveStool } from '../src/db/stools';
import { getAllWeights, saveWeight } from '../src/db/weights';
import { getAllLabResults } from '../src/db/labs';
import { logDose, getAllDoseLogs } from '../src/db/doses';
import { getDailyCheckIn, saveDailyCheckIn } from '../src/db/prefs';
import { getPhoto, importPhoto } from '../src/db/photos';
import { stool } from '../src/domain/models';
import { setDataKey, setVaultPresent } from '../src/security/session';
import {
  TooManyAttemptsError, WrongPinError, loadVault, setupVault, unlockWithPin, vaultStatus,
} from '../src/security/vault';
import { freshDb } from './helpers/freshDb';

beforeEach(async () => {
  await freshDb();
  setDataKey(null);
  setVaultPresent(false);
  vaultStatus.value = 'loading';
});

/** What a thief reading the IndexedDB files would see. */
async function rawDump(): Promise<string> {
  const db = await getDb();
  const names = [...db.objectStoreNames];
  const out: unknown[] = [];
  for (const name of names) out.push(await db.getAll(name));
  return JSON.stringify(out, (_k, v) => (v instanceof Uint8Array ? `bytes:${v.length}` : v));
}

/** Simulates closing and reopening the app. */
async function relaunch(): Promise<void> {
  setDataKey(null);
  setVaultPresent(false);
  await loadVault();
}

describe('PIN vault', () => {
  it('encrypts existing clear-text data when the PIN is set, and keeps it readable', async () => {
    await saveStool(stool({ date: '2026-03-01', bristolType: 6, comment: 'SECRET-NOTE' }));
    await saveWeight({ id: 0, date: '2026-03-01', kg: 71.5 });
    await saveDailyCheckIn({ epochDay: 20000, stoolId: null, bristolType: 3, fatigueLevel: 2, painLevel: 1 });
    const photoPath = await importPhoto(new Blob(['PHOTO-BYTES'], { type: 'image/png' }));
    expect(await rawDump()).toContain('SECRET-NOTE');

    await loadVault();
    expect(vaultStatus.value).toBe('none');
    await setupVault('123456');
    expect(vaultStatus.value).toBe('unlocked');

    const dump = await rawDump();
    expect(dump).not.toContain('SECRET-NOTE');
    expect(dump).not.toContain('2026-03-01');
    expect(dump).not.toContain('71.5');
    expect((await getAllStools())[0]).toMatchObject({ comment: 'SECRET-NOTE', bristolType: 6, date: '2026-03-01' });
    expect((await getAllWeights())[0]).toMatchObject({ kg: 71.5 });
    expect((await getDailyCheckIn(20000)).bristolType).toBe(3);
    expect(await (await getPhoto(photoPath))!.text()).toBe('PHOTO-BYTES');
    expect((await getPhoto(photoPath))!.type).toBe('image/png');
  });

  it('answers index queries on encrypted records and keeps one dose log per occurrence', async () => {
    await loadVault();
    await setupVault('123456');
    await saveStool(stool({ date: '2026-03-05' }));
    await saveStool(stool({ date: '2026-03-01' }));
    await saveStool(stool({ date: '2026-04-01' }));
    expect((await getStoolsBetween('2026-03-01', '2026-03-31')).map((s) => s.date)).toEqual(['2026-03-01', '2026-03-05']);

    await logDose(1, 1000, 'TAKEN');
    await logDose(1, 1000, 'MISSED');
    await logDose(1, 2000, 'TAKEN');
    const logs = await getAllDoseLogs();
    expect(logs.map((l) => [l.scheduledAt, l.status])).toEqual([[1000, 'MISSED'], [2000, 'TAKEN']]);
    expect(await getAllLabResults()).toEqual([]);
  });

  it('is locked after a relaunch until the right PIN is given', async () => {
    await loadVault();
    await setupVault('123456');
    await saveStool(stool({ date: '2026-03-01', comment: 'SECRET-NOTE' }));

    await relaunch();
    expect(vaultStatus.value).toBe('locked');
    await expect(getAllStools()).rejects.toMatchObject({ name: 'LockedError' });
    await expect(saveStool(stool({ date: '2026-03-02' }))).rejects.toMatchObject({ name: 'LockedError' });
    await expect(unlockWithPin('000000')).rejects.toBeInstanceOf(WrongPinError);
    await unlockWithPin('123456');
    expect(vaultStatus.value).toBe('unlocked');
    expect((await getAllStools())[0]!.comment).toBe('SECRET-NOTE');
  });

  it('delays further tries after repeated wrong PINs', async () => {
    await loadVault();
    await setupVault('123456');
    await relaunch();
    for (let i = 0; i < 5; i++) await expect(unlockWithPin('999999')).rejects.toBeInstanceOf(WrongPinError);
    await expect(unlockWithPin('123456')).rejects.toBeInstanceOf(TooManyAttemptsError);
  });
});

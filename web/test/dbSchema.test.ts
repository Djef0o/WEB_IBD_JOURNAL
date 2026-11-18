import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effect } from '@preact/signals';
import { closeDb, getDb, stripAutoId, transaction } from '../src/db/connection';
import { storeVersion } from '../src/db/changes';
import { requestPersistentStorage } from '../src/db/persist';
import { DB_NAME, DB_VERSION, STORE_NAMES } from '../src/db/schema';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('schema', () => {
  it('creates database ibd-journal with the 9 Room stores, prefs, photos and weights', async () => {
    const db = await getDb();
    expect(db.name).toBe(DB_NAME);
    expect(DB_NAME).toBe('ibd-journal');
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual([...STORE_NAMES].sort());
    for (const room of ['meals', 'stools', 'products', 'lab_results', 'dose_logs', 'profile', 'medications', 'checkups', 'exams'] as const) {
      expect(db.objectStoreNames.contains(room)).toBe(true);
    }
  });

  it('declares the Room keys and indexes', async () => {
    const db = await getDb();
    const tx = db.transaction([...STORE_NAMES], 'readonly');
    const keyed = (name: (typeof STORE_NAMES)[number]) => {
      const store = tx.objectStore(name);
      return { keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: [...store.indexNames] };
    };
    for (const name of ['meals', 'stools', 'lab_results', 'dose_logs', 'medications', 'checkups', 'exams'] as const) {
      expect(keyed(name)).toMatchObject({ keyPath: 'id', autoIncrement: true });
    }
    expect(keyed('meals').indexes).toEqual(['dateEpochDay']);
    expect(keyed('stools').indexes).toEqual(['dateEpochDay']);
    expect(keyed('weights')).toMatchObject({ keyPath: 'id', autoIncrement: true, indexes: ['dateEpochDay'] });
    expect(keyed('lab_results').indexes).toEqual(['test_dateEpochDay']);
    expect(tx.objectStore('lab_results').index('test_dateEpochDay').keyPath).toEqual(['test', 'dateEpochDay']);
    expect(keyed('products')).toMatchObject({ keyPath: 'barcode', autoIncrement: false });
    expect(keyed('profile')).toMatchObject({ keyPath: 'id', autoIncrement: false });
    const doseIndex = tx.objectStore('dose_logs').index('medicationId_scheduledAt');
    expect(doseIndex.keyPath).toEqual(['medicationId', 'scheduledAt']);
    expect(doseIndex.unique).toBe(true);
    expect(keyed('prefs').keyPath).toBeNull();
    expect(keyed('photos').keyPath).toBeNull();
    await tx.done;
  });

  it('shares one connection and reopens after closeDb', async () => {
    const first = await getDb();
    expect(await getDb()).toBe(first);
    await closeDb();
    const second = await getDb();
    expect(second).not.toBe(first);
    expect(second.name).toBe(DB_NAME);
  });
});

describe('stripAutoId', () => {
  it('drops id 0 only', () => {
    expect(stripAutoId({ id: 0, a: 1 })).toEqual({ a: 1 });
    expect('id' in stripAutoId({ id: 0, a: 1 })).toBe(false);
    const kept = { id: 7, a: 1 };
    expect(stripAutoId(kept)).toBe(kept);
  });
});

describe('transaction', () => {
  it('assigns increasing keys to id 0 rows and never reuses a deleted key', async () => {
    const put = (id: number) =>
      transaction(['exams'], 'readwrite', (tx) =>
        tx.objectStore('exams').put(stripAutoId({
          id, type: 'COLONOSCOPY', at: '2030-01-01T08:00', note: '', dietDays: 0,
          prepFirstAt: null, prepSecondAt: null, anesthesiaAt: null, remindersEnabled: true,
        })),
      );
    expect(await put(0)).toBe(1);
    expect(await put(0)).toBe(2);
    await transaction(['exams'], 'readwrite', (tx) => tx.objectStore('exams').delete(2));
    expect(await put(0)).toBe(3);
    expect(await put(10)).toBe(10); // explicit ids are kept
    expect(await put(0)).toBe(11);
  });

  it('bumps the changed stores after a committed write, and only them', async () => {
    const seen: Record<string, number> = {};
    const stop = effect(() => {
      for (const name of ['meals', 'stools', 'photos'] as const) seen[name] = storeVersion(name).value;
    });
    const before = { ...seen };
    await transaction(['meals', 'photos'], 'readwrite', async () => undefined, ['meals']);
    expect(seen.meals).toBe(before.meals! + 1);
    expect(seen.photos).toBe(before.photos);
    expect(seen.stools).toBe(before.stools);
    await transaction(['stools'], 'readwrite', async () => undefined);
    expect(seen.stools).toBe(before.stools! + 1);
    stop();
  });

  it('does not bump after a read-only transaction', async () => {
    const before = storeVersion('stools').value;
    await transaction(['stools'], 'readonly', (tx) => tx.objectStore('stools').getAll());
    expect(storeVersion('stools').value).toBe(before);
  });

  it('aborts everything and does not bump when the callback throws', async () => {
    const before = storeVersion('exams').value;
    await expect(
      transaction(['exams', 'checkups'], 'readwrite', async (tx) => {
        await tx.objectStore('exams').put({
          id: 0, type: 'COLONOSCOPY', at: '2030-01-01T08:00', note: '', dietDays: 0,
          prepFirstAt: null, prepSecondAt: null, anesthesiaAt: null, remindersEnabled: true,
        } as never);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await transaction(['exams'], 'readonly', (tx) => tx.objectStore('exams').count())).toBe(0);
    expect(storeVersion('exams').value).toBe(before);
  });

  it('aborts when a request fails (unique index violation)', async () => {
    const log = (id: number, scheduledAt: number) => ({
      id, medicationId: 1, scheduledAt, status: 'TAKEN' as const, loggedAt: 0,
    });
    await expect(
      transaction(['dose_logs'], 'readwrite', async (tx) => {
        const store = tx.objectStore('dose_logs');
        await store.add(stripAutoId(log(0, 100)));
        await store.add(stripAutoId(log(0, 100)));
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await transaction(['dose_logs'], 'readonly', (tx) => tx.objectStore('dose_logs').count())).toBe(0);
  });
});

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the browser and reports the answer', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(false), persist } });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('does not ask again when the storage is already persistent', async () => {
    const persist = vi.fn();
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(true), persist } });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false when refused', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) } });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false when the API is missing', async () => {
    vi.stubGlobal('navigator', {});
    expect(await requestPersistentStorage()).toBe(false);
  });
});

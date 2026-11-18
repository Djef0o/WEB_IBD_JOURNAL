import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  backupFileName, exportBackup, importBackup, InvalidBackupError, restore, snapshot, WrongPasswordError,
} from '../src/backup';
import { encrypt } from '../src/backup/crypto';
import { closeDb, getDb } from '../src/db/connection';
import { decodeBackupData } from '../src/domain/backupData';
import type { BackupData } from '../src/domain/models';
import { sampleBackup } from './helpers/sampleBackup';

const enc = new TextEncoder();

async function wipe(): Promise<void> {
  const db = await getDb();
  const stores = ['meals', 'stools', 'profile', 'medications', 'checkups', 'lab_results', 'dose_logs', 'exams', 'products', 'prefs'] as const;
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(stores.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}

/** Sorted by id: Room has no guaranteed order for `getAll` either. */
const byId = <T extends { id: number }>(rows: readonly T[] | null | undefined): T[] =>
  [...(rows ?? [])].sort((a, b) => a.id - b.id);

function normalized(b: BackupData): BackupData {
  return {
    ...b,
    meals: byId(b.meals),
    stools: byId(b.stools),
    medications: byId(b.medications),
    checkups: byId(b.checkups),
    labResults: byId(b.labResults),
    doseLogs: byId(b.doseLogs),
    exams: byId(b.exams),
  };
}

beforeEach(async () => {
  await wipe();
});

describe('snapshot / restore', () => {
  it('restores a full backup and snapshots it back identically (ids kept)', async () => {
    const data = sampleBackup();
    await restore(data);
    expect(normalized(await snapshot())).toEqual(normalized(data));
    const db = await getDb();
    expect((await db.getAll('medications')).map((m) => m.id)).toEqual([7]);
    expect((await db.getAll('dose_logs')).map((d) => d.medicationId)).toEqual([7, 7]);
  });

  it('snapshot of an empty database has empty sections and a null profile', async () => {
    expect(await snapshot()).toEqual({
      meals: [], stools: [], profile: null, medications: [], checkups: [], labResults: [], doseLogs: [], exams: [],
    });
  });

  it('replaces meals and stools but keeps the sections absent from the backup', async () => {
    await restore(sampleBackup());
    const older: BackupData = {
      meals: [{ id: 99, date: '2026-04-01', type: 'DINNER', description: 'Soupe', photoUri: null, product: null }],
      stools: [],
    };
    await restore(older);
    const after = await snapshot();
    expect(after.meals.map((m) => m.id)).toEqual([99]);
    expect(after.stools).toEqual([]);
    const expected = sampleBackup();
    expect(after.profile).toEqual(expected.profile);
    expect(byId(after.medications)).toEqual(expected.medications);
    expect(byId(after.checkups)).toEqual(expected.checkups);
    expect(byId(after.labResults)).toEqual(expected.labResults);
    expect(byId(after.doseLogs)).toEqual(expected.doseLogs);
    expect(byId(after.exams)).toEqual(expected.exams);
  });

  it('an empty (non-null) section clears the store', async () => {
    await restore(sampleBackup());
    await restore({ meals: [], stools: [], medications: [], doseLogs: null });
    const after = await snapshot();
    expect(after.medications).toEqual([]);
    expect(after.doseLogs).toHaveLength(2);
  });

  it('a row with id 0 gets a new key; explicit ids are kept and the generator moves past them', async () => {
    await restore({
      meals: [],
      stools: [
        { ...sampleBackup().stools[0]!, id: 50 },
        { ...sampleBackup().stools[0]!, id: 0 },
      ],
    });
    const ids = (await snapshot()).stools.map((s) => s.id).sort((a, b) => a - b);
    expect(ids[0]).toBe(50);
    expect(ids[1]).toBeGreaterThan(50);
  });

  it('is atomic: a conflict (duplicate dose) aborts everything, nothing is modified', async () => {
    await restore(sampleBackup());
    const before = normalized(await snapshot());
    const bad = sampleBackup();
    bad.meals = [];
    bad.stools = [];
    bad.medications = [];
    // Same (medicationId, scheduledAt) twice: violates the unique index, after meals/stools/medications were rewritten.
    bad.doseLogs = [
      { id: 1, medicationId: 7, scheduledAt: 1000, status: 'TAKEN', loggedAt: 1 },
      { id: 2, medicationId: 7, scheduledAt: 1000, status: 'MISSED', loggedAt: 2 },
    ];
    await expect(restore(bad)).rejects.toBeDefined();
    expect(normalized(await snapshot())).toEqual(before);
  });
});

describe('exportBackup / importBackup', () => {
  it('round trip through the encrypted file', async () => {
    await restore(sampleBackup());
    const blob = await exportBackup('pw');
    expect(blob.type).toBe('application/octet-stream');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('IBDJENC1');
    await wipe();
    await importBackup(bytes, 'pw');
    expect(normalized(await snapshot())).toEqual(normalized(sampleBackup()));
    // ArrayBuffer input is accepted too.
    await wipe();
    await importBackup(bytes.slice().buffer, 'pw');
    expect(normalized(await snapshot())).toEqual(normalized(sampleBackup()));
  }, 30_000);

  it('wrong password leaves the data untouched', async () => {
    await restore(sampleBackup());
    const bytes = new Uint8Array(await (await exportBackup('good')).arrayBuffer());
    await restore({ meals: [], stools: [] });
    await expect(importBackup(bytes, 'bad')).rejects.toBeInstanceOf(WrongPasswordError);
    expect((await snapshot()).meals).toEqual([]);
  }, 30_000);

  it('rejects a non-backup file and unreadable content without touching the data', async () => {
    await restore(sampleBackup());
    await expect(importBackup(enc.encode('{"meals":[],"stools":[]}'), 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    const garbage = await encrypt(enc.encode('not json'), 'p', { iterations: 1 });
    await expect(importBackup(garbage, 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    const wrongShape = await encrypt(enc.encode('{"meals":"x","stools":[]}'), 'p', { iterations: 1 });
    await expect(importBackup(wrongShape, 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    expect(normalized(await snapshot())).toEqual(normalized(sampleBackup()));
  });

  it('imports a file produced by the Android crypto (Java oracle) into the database', async () => {
    const vector = JSON.parse(readFileSync(new URL('./fixtures/android-vector.json', import.meta.url), 'utf8')) as {
      password: string; fileBase64: string;
    };
    await importBackup(new Uint8Array(Buffer.from(vector.fileBase64, 'base64')), vector.password);
    const expected = decodeBackupData(readFileSync(new URL('./fixtures/android-sample.json', import.meta.url), 'utf8'));
    expect(normalized(await snapshot())).toEqual(normalized(expected));
    expect(normalized(await snapshot())).toEqual(normalized(sampleBackup()));
  }, 30_000);

  it('names the file after the local date', () => {
    expect(backupFileName(new Date(2026, 2, 5))).toBe('ibd-journal-2026-03-05.ibdj');
  });
});

describe('connection', () => {
  it('can be closed and reopened with the data persisted', async () => {
    await restore(sampleBackup());
    await closeDb();
    expect(normalized(await snapshot())).toEqual(normalized(sampleBackup()));
  });
});

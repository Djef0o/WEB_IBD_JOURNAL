import { beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb } from '../src/db/connection';
import { deleteWeight, getAllWeights, saveWeight } from '../src/db/weights';
import { snapshot, restore } from '../src/backup/backup';
import { decodeBackupData, encodeBackupData } from '../src/domain/backupData';
import { buildWeightChart, parseKg } from '../src/ui/weight/weightChart';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('weights store', () => {
  it('keeps one weight per day, in chronological order', async () => {
    await saveWeight({ id: 0, date: '2026-03-02', kg: 70 });
    await saveWeight({ id: 0, date: '2026-03-01', kg: 71.2 });
    await saveWeight({ id: 0, date: '2026-03-02', kg: 69.8 });
    const all = await getAllWeights();
    expect(all.map((w) => [w.date, w.kg])).toEqual([['2026-03-01', 71.2], ['2026-03-02', 69.8]]);
    await deleteWeight(all[0]!.id);
    expect(await getAllWeights()).toHaveLength(1);
  });

  it('upgrades a version 1 database without losing data', async () => {
    const { openDB } = await import('idb');
    const old = await openDB('ibd-journal', 1, {
      upgrade(db) {
        db.createObjectStore('stools', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('prefs');
      },
    });
    await old.put('prefs', true, 'onboarding_done');
    old.close();
    const db = await getDb();
    expect(db.objectStoreNames.contains('weights')).toBe(true);
    expect(await db.get('prefs', 'onboarding_done')).toBe(true);
    await closeDb();
  });

  it('round-trips through the backup, and old backups leave weights untouched', async () => {
    await saveWeight({ id: 0, date: '2026-03-01', kg: 71.2 });
    const backup = decodeBackupData(encodeBackupData(await snapshot()));
    expect(backup.weights).toEqual([expect.objectContaining({ date: '2026-03-01', kg: 71.2 })]);
    await restore({ ...backup, weights: null });
    expect(await getAllWeights()).toHaveLength(1);
    await restore({ ...backup, weights: [] });
    expect(await getAllWeights()).toHaveLength(0);
  });
});

describe('weight input and chart', () => {
  it('parses comma or dot decimals and rejects implausible values', () => {
    expect(parseKg('68,4')).toBe(68.4);
    expect(parseKg(' 70 ')).toBe(70);
    for (const bad of ['', 'abc', '5', '401', '68.456', '-70']) expect(parseKg(bad)).toBeNull();
  });

  it('places points by date inside the box', () => {
    const m = buildWeightChart(
      [{ id: 1, date: '2026-03-01', kg: 70 }, { id: 2, date: '2026-03-03', kg: 72 }, { id: 3, date: '2026-03-11', kg: 71 }],
      { left: 0, right: 100, top: 0, bottom: 100 },
    );
    expect(m.points.map((p) => p.x)).toEqual([0, 20, 100]);
    expect(m.min).toBeLessThan(70);
    expect(m.max).toBeGreaterThan(72);
    expect(m.points[1]!.y).toBeLessThan(m.points[0]!.y);
  });
});

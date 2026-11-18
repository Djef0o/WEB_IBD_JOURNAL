import { beforeEach, describe, expect, it } from 'vitest';
import { transaction } from '../src/db/connection';
import {
  deleteAllMeals, deleteMeal, getAllMealEntities, getMealsBetween, getMealsInMonth, insertMealEntities, saveMeal,
} from '../src/db/meals';
import { deletePhoto, getPhoto, importPhoto } from '../src/db/photos';
import { getProduct, saveProduct } from '../src/db/products';
import {
  deleteAllStools, deleteStool, getAllStoolEntities, getAllStools, getStool, getStoolsBetween, getStoolsInMonth,
  insertStoolEntities, saveStool,
} from '../src/db/stools';
import { monthBounds } from '../src/db/range';
import { mealToEntity, stoolToEntity } from '../src/domain/entities';
import { meal, stool, type Meal } from '../src/domain/models';
import { toEpochDays } from '../src/domain/time';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

const ids = (list: { id: number }[]) => list.map((item) => item.id);

describe('meals', () => {
  it('saves with new ids, edits in place and keeps the creation time', async () => {
    const a = await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: 'rice' }));
    const b = await saveMeal(meal({ date: '2026-11-10', type: 'DINNER', description: 'soup' }));
    expect([a, b]).toEqual([1, 2]);

    // Known creation time, to prove that the edit keeps it.
    await transaction(['meals'], 'readwrite', async (tx) => {
      const store = tx.objectStore('meals');
      await store.put({ ...(await store.get(a))!, createdAt: 123 });
    });
    const [first] = await getMealsBetween('2026-11-10', '2026-11-10');
    const edited = await saveMeal({ ...first!, description: 'rice and chicken' });
    expect(edited).toBe(a);

    const list = await getMealsBetween('2026-11-10', '2026-11-10');
    expect(list.map((m) => m.description)).toEqual(['rice and chicken', 'soup']);
    const entities = await transaction(['meals'], 'readonly', (tx) => getAllMealEntities(tx));
    expect(entities.find((e) => e.id === a)?.createdAt).toBe(123);
  });

  it('orders by day then breakfast, lunch, dinner, and reads a range with both bounds', async () => {
    const save = (date: string, type: Meal['type']) => saveMeal(meal({ date, type, description: `${date} ${type}` }));
    await save('2026-11-11', 'DINNER');
    await save('2026-11-10', 'LUNCH');
    await save('2026-11-11', 'BREAKFAST');
    await save('2026-11-10', 'DINNER');
    await save('2026-11-09', 'BREAKFAST'); // before the range
    await save('2026-11-12', 'BREAKFAST'); // after the range
    await save('2026-11-10', 'BREAKFAST');
    await save('2026-11-11', 'LUNCH');

    const list = await getMealsBetween('2026-11-10', '2026-11-11');
    expect(list.map((m) => m.description)).toEqual([
      '2026-11-10 BREAKFAST', '2026-11-10 LUNCH', '2026-11-10 DINNER',
      '2026-11-11 BREAKFAST', '2026-11-11 LUNCH', '2026-11-11 DINNER',
    ]);
    expect(await getMealsBetween('2026-11-11', '2026-11-10')).toEqual([]);
  });

  it('puts the same-type meals of a day in insertion order', async () => {
    const first = await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: 'first' }));
    const second = await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: 'second' }));
    expect(ids(await getMealsBetween('2026-11-10', '2026-11-10'))).toEqual([first, second]);
  });

  it('reads a month', async () => {
    await saveMeal(meal({ date: '2028-01-31', type: 'LUNCH', description: 'jan' }));
    await saveMeal(meal({ date: '2028-02-01', type: 'LUNCH', description: 'feb 1' }));
    await saveMeal(meal({ date: '2028-02-29', type: 'LUNCH', description: 'feb 29' }));
    await saveMeal(meal({ date: '2028-03-01', type: 'LUNCH', description: 'mar' }));
    expect((await getMealsInMonth(2028, 2)).map((m) => m.description)).toEqual(['feb 1', 'feb 29']);
    expect(monthBounds(2027, 2)).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthBounds(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('joins the product sheet from the cache, or keeps barcode and name only', async () => {
    await saveProduct({
      barcode: '3017620422003', name: 'Spread', brand: 'Brand', nutriscore: 'e', imageUrl: 'https://img', ingredients: 'sugar',
    });
    const cached = { barcode: '3017620422003', name: 'Spread', brand: null, nutriscore: null, imageUrl: null, ingredients: null };
    const unknown = { barcode: '1', name: 'Mystery', brand: null, nutriscore: null, imageUrl: null, ingredients: null };
    await saveMeal(meal({ date: '2026-11-10', type: 'BREAKFAST', description: '', product: cached }));
    await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: '', product: unknown }));
    await saveMeal(meal({ date: '2026-11-10', type: 'DINNER', description: '' }));

    const [withCache, withoutCache, noProduct] = await getMealsBetween('2026-11-10', '2026-11-10');
    expect(withCache!.product).toEqual({
      barcode: '3017620422003', name: 'Spread', brand: 'Brand', nutriscore: 'e', imageUrl: 'https://img', ingredients: 'sugar',
    });
    expect(withoutCache!.product).toEqual(unknown);
    expect(noProduct!.product).toBeNull();
  });

  it('deletes the meal and its photo', async () => {
    const path = await importPhoto(new Blob(['jpeg'], { type: 'image/jpeg' }));
    const kept = await importPhoto(new Blob(['png'], { type: 'image/png' }));
    const id = await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: '', photoUri: path }));
    await saveMeal(meal({ date: '2026-11-10', type: 'DINNER', description: '', photoUri: kept }));
    await deleteMeal(id);
    expect(await getPhoto(path)).toBeNull();
    expect(await getPhoto(kept)).not.toBeNull();
    expect((await getMealsBetween('2026-11-10', '2026-11-10')).map((m) => m.type)).toEqual(['DINNER']);
    await deleteMeal(999); // unknown id: nothing happens
  });

  it('supports bulk replace in one transaction (backup access)', async () => {
    await saveMeal(meal({ date: '2026-11-10', type: 'LUNCH', description: 'old' }));
    await transaction(['meals'], 'readwrite', async (tx) => {
      await deleteAllMeals(tx);
      await insertMealEntities(tx, [
        mealToEntity(meal({ id: 42, date: '2026-01-01', type: 'DINNER', description: 'kept id' }), 1),
        mealToEntity(meal({ id: 0, date: '2026-01-02', type: 'DINNER', description: 'new id' }), 2),
      ]);
    });
    const all = await transaction(['meals'], 'readonly', (tx) => getAllMealEntities(tx));
    expect(all.map((e) => [e.id, e.description, e.createdAt])).toEqual([
      [42, 'kept id', 1], [43, 'new id', 2],
    ]);
    await expect(
      transaction(['meals'], 'readwrite', (tx) =>
        insertMealEntities(tx, [mealToEntity(meal({ id: 42, date: '2026-01-01', type: 'DINNER', description: '' }))]),
      ),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
  });
});

describe('stools', () => {
  it('saves, reads, edits and deletes', async () => {
    const id = await saveStool(stool({ date: '2026-11-10', bristolType: 6, bloodLevel: 2, urgency: true, comment: 'x' }));
    expect(id).toBe(1);
    const read = (await getStool(id))!;
    expect(read).toMatchObject({ id, date: '2026-11-10', bristolType: 6, bloodLevel: 2, urgency: true, nocturnal: false, falseUrge: false, comment: 'x' });

    await saveStool({ ...read, painLevel: 4, falseUrge: true });
    expect(await getStool(id)).toMatchObject({ painLevel: 4, falseUrge: true, createdAt: read.createdAt });
    expect(await getAllStools()).toHaveLength(1);

    await deleteStool(id);
    expect(await getStool(id)).toBeNull();
    expect(await getAllStools()).toEqual([]);
  });

  it('never reuses the id of a deleted stool', async () => {
    const a = await saveStool(stool({ date: '2026-11-10' }));
    await deleteStool(a);
    expect(await saveStool(stool({ date: '2026-11-10' }))).toBe(a + 1);
  });

  it('orders by day then creation time, ties by insertion order', async () => {
    const at = (date: string, createdAt: number) => saveStool(stool({ date, createdAt }));
    const c = await at('2026-11-11', 10);
    const b = await at('2026-11-10', 300);
    const a = await at('2026-11-10', 100);
    const d = await at('2026-11-10', 300);
    const e = await at('2026-11-12', 1);
    const f = await at('2026-11-09', 1);

    expect(ids(await getStoolsBetween('2026-11-10', '2026-11-11'))).toEqual([a, b, d, c]);
    expect(ids(await getAllStools())).toEqual([f, a, b, d, c, e]);
    expect(await getStoolsBetween('2026-11-11', '2026-11-10')).toEqual([]);
  });

  it('reads a month', async () => {
    await saveStool(stool({ date: '2026-10-31' }));
    await saveStool(stool({ date: '2026-11-01' }));
    await saveStool(stool({ date: '2026-11-30' }));
    await saveStool(stool({ date: '2026-12-01' }));
    expect((await getStoolsInMonth(2026, 11)).map((s) => s.date)).toEqual(['2026-11-01', '2026-11-30']);
  });

  it('keeps stool-free days and false urges (type 0) in the results', async () => {
    await saveStool(stool({ date: '2026-11-10', bristolType: 0 }));
    await saveStool(stool({ date: '2026-11-10', bristolType: 0, falseUrge: true }));
    await saveStool(stool({ date: '2026-11-10', bristolType: 4 }));
    expect(await getStoolsBetween('2026-11-10', '2026-11-10')).toHaveLength(3);
  });

  it('supports bulk replace in one transaction (backup access)', async () => {
    await saveStool(stool({ date: '2026-11-10' }));
    await transaction(['stools'], 'readwrite', async (tx) => {
      await deleteAllStools(tx);
      await insertStoolEntities(tx, [stoolToEntity(stool({ id: 5, date: '2026-01-01', createdAt: 9 }))]);
    });
    const all = await transaction(['stools'], 'readonly', (tx) => getAllStoolEntities(tx));
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 5, dateEpochDay: toEpochDays('2026-01-01'), createdAt: 9 });
  });
});

describe('products', () => {
  it('caches and replaces by barcode', async () => {
    expect(await getProduct('42')).toBeNull();
    const product = { barcode: '42', name: 'A', brand: 'B', nutriscore: 'a', imageUrl: null, ingredients: null };
    await saveProduct(product);
    expect(await getProduct('42')).toEqual(product);
    await saveProduct({ ...product, name: 'A2' });
    expect((await getProduct('42'))?.name).toBe('A2');
  });
});

describe('photos', () => {
  it('stores a Blob under a relative path and deletes it', async () => {
    const path = await importPhoto(new Blob(['hello'], { type: 'image/webp' }));
    expect(path).toMatch(/^photos\/[0-9a-f-]{36}\.webp$/);
    const stored = await getPhoto(path);
    expect(stored).not.toBeNull();
    expect(stored!.type).toBe('image/webp');
    expect(await stored!.text()).toBe('hello');

    expect(await importPhoto(new Blob(['x'], { type: 'image/jpeg' }))).toMatch(/\.jpg$/);
    await deletePhoto(path);
    expect(await getPhoto(path)).toBeNull();
    await deletePhoto(path); // unknown path: ignored
  });
});

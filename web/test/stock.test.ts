import { beforeEach, describe, expect, it } from 'vitest';
import { getAllDoseLogs, logDose } from '../src/db/doses';
import { getMedication, saveMedication } from '../src/db/medications';
import { crossedLowStock, stockDelta } from '../src/domain/stock';
import { isLowStock, medication, reminderSchedule, type Medication } from '../src/domain/profile';
import { freshDb } from './helpers/freshDb';

const med = (stock: number | null, low = 7): Medication =>
  medication({ name: 'Azathioprine', schedule: reminderSchedule({ startDate: '2026-01-01' }), stockDoses: stock, lowStockDoses: low });

describe('stock logic', () => {
  it('only a confirmed taken dose uses up stock', () => {
    expect(stockDelta(null, 'TAKEN')).toBe(-1);
    expect(stockDelta('MISSED', 'TAKEN')).toBe(-1);
    expect(stockDelta(null, 'MISSED')).toBe(0);
    expect(stockDelta('TAKEN', 'TAKEN')).toBe(0);
    expect(stockDelta(null, null)).toBe(0);
  });

  it('undoing or changing a taken dose gives it back', () => {
    expect(stockDelta('TAKEN', null)).toBe(1);
    expect(stockDelta('TAKEN', 'MISSED')).toBe(1);
  });

  it('low stock is reached at the threshold and never without a count', () => {
    expect(isLowStock(med(7))).toBe(true);
    expect(isLowStock(med(0))).toBe(true);
    expect(isLowStock(med(8))).toBe(false);
    expect(isLowStock(med(null))).toBe(false);
    expect(isLowStock(med(2, 2))).toBe(true);
  });

  it('the alert fires only when the stock falls across the threshold', () => {
    expect(crossedLowStock(med(8), med(7))).toBe(true);
    expect(crossedLowStock(med(7), med(6))).toBe(false);
    expect(crossedLowStock(med(9), med(8))).toBe(false);
    expect(crossedLowStock(null, med(3))).toBe(false);
    expect(crossedLowStock(med(null), med(3))).toBe(false);
    expect(crossedLowStock(med(3), med(30))).toBe(false);
  });
});

describe('logDose stock counting', () => {
  beforeEach(freshDb);

  const stockOf = async (id: number) => (await getMedication(id))!.stockDoses;

  it('counts down when taken and back up on undo or change to missed', async () => {
    const id = await saveMedication(med(5));
    await logDose(id, 1000, 'TAKEN');
    expect(await stockOf(id)).toBe(4);
    await logDose(id, 1000, 'TAKEN');
    expect(await stockOf(id)).toBe(4);
    await logDose(id, 1000, 'MISSED');
    expect(await stockOf(id)).toBe(5);
    await logDose(id, 1000, 'TAKEN');
    await logDose(id, 1000, null);
    expect(await stockOf(id)).toBe(5);
    expect(await getAllDoseLogs()).toEqual([]);
    await logDose(id, 2000, 'MISSED');
    expect(await stockOf(id)).toBe(5);
  });

  it('never goes below 0 and ignores treatments without a count', async () => {
    const empty = await saveMedication(med(0));
    await logDose(empty, 1, 'TAKEN');
    expect(await stockOf(empty)).toBe(0);
    const uncounted = await saveMedication(med(null));
    await logDose(uncounted, 1, 'TAKEN');
    expect(await stockOf(uncounted)).toBeNull();
    expect((await getAllDoseLogs()).length).toBe(2);
  });

  it('works for a treatment that no longer exists', async () => {
    await logDose(999, 1, 'TAKEN');
    expect((await getAllDoseLogs()).length).toBe(1);
  });
});

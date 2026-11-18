import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effect } from '@preact/signals';
import { bumpStores, storeVersion, subscribe } from '../src/db/changes';
import { logDose } from '../src/db/doses';
import { liveSignal, watchQuery } from '../src/db/live';
import { deleteMedication, saveMedication } from '../src/db/medications';
import { getProfile, profileSignal, saveProfile } from '../src/db/profile';
import { getAllStools, saveStool } from '../src/db/stools';
import { stool } from '../src/domain/models';
import { medication, profile, reminderSchedule } from '../src/domain/profile';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('change signals', () => {
  it('each repository write bumps its own store', async () => {
    const before = storeVersion('stools').value;
    await saveStool(stool({ date: '2026-11-10' }));
    expect(storeVersion('stools').value).toBe(before + 1);
    const mealsBefore = storeVersion('meals').value;
    await saveStool(stool({ date: '2026-11-11' }));
    expect(storeVersion('meals').value).toBe(mealsBefore);
  });

  it('deleting a treatment bumps medications and dose_logs', async () => {
    const id = await saveMedication(medication({ name: 'm', schedule: reminderSchedule({ startDate: '2026-11-10' }) }));
    const meds = storeVersion('medications').value;
    const logs = storeVersion('dose_logs').value;
    await deleteMedication(id);
    expect(storeVersion('medications').value).toBe(meds + 1);
    expect(storeVersion('dose_logs').value).toBe(logs + 1);
  });

  it('subscribe calls the listener after writes, not at subscription time, until stopped', async () => {
    const listener = vi.fn();
    const stop = subscribe(['dose_logs', 'stools'], listener);
    expect(listener).not.toHaveBeenCalled();
    await logDose(1, 1000, 'TAKEN');
    expect(listener).toHaveBeenCalledTimes(1);
    await saveStool(stool({ date: '2026-11-10' }));
    expect(listener).toHaveBeenCalledTimes(2);
    await saveProfile(profile({ firstName: 'x' })); // other store
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    await logDose(1, 2000, 'TAKEN');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('announces a batch of stores as one change', () => {
    const runs: number[] = [];
    const stop = effect(() => {
      runs.push(storeVersion('meals').value + storeVersion('products').value);
    });
    bumpStores(['meals', 'products']);
    expect(runs).toHaveLength(2); // first run + one re-run for both stores
    stop();
  });
});

describe('watchQuery', () => {
  it('runs the query at once and again after each write on its stores', async () => {
    const results: number[] = [];
    const query = vi.fn(async () => (await getAllStools()).length);
    const stop = watchQuery(['stools'], query, (n) => results.push(n));
    await vi.waitFor(() => expect(results).toEqual([0]));
    await saveStool(stool({ date: '2026-11-10' }));
    await vi.waitFor(() => expect(results).toEqual([0, 1]));
    await saveStool(stool({ date: '2026-11-11' }));
    await vi.waitFor(() => expect(results).toEqual([0, 1, 2]));

    stop();
    await saveStool(stool({ date: '2026-11-12' }));
    // The query is started synchronously by the change notification: no call, no new result.
    expect(query).toHaveBeenCalledTimes(3);
    expect(results).toEqual([0, 1, 2]);
  });

  it('drops the result of an outdated run', async () => {
    const results: string[] = [];
    let release = () => {};
    // The first run is held back until after the second one has answered.
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const query = vi.fn(async () => {
      const mine = ++calls;
      if (mine === 1) await gate;
      return `run ${mine}`;
    });
    const stop = watchQuery(['stools'], query, (value) => results.push(value));
    bumpStores(['stools']);
    await vi.waitFor(() => expect(results).toEqual(['run 2']));
    release();
    await gate;
    await Promise.resolve(); // let the held-back run settle
    await Promise.resolve();
    expect(query).toHaveBeenCalledTimes(2);
    expect(results).toEqual(['run 2']);
    stop();
  });

  it('reports a failing query to onError', async () => {
    const onError = vi.fn();
    const stop = watchQuery(['stools'], () => Promise.reject(new Error('read failed')), () => undefined, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('read failed')));
    stop();
  });

  it('reports a query that throws synchronously to onError', async () => {
    const onError = vi.fn();
    const stop = watchQuery(
      ['stools'],
      () => {
        throw new Error('sync failure');
      },
      () => undefined,
      onError,
    );
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(new Error('sync failure')));
    stop();
  });
});

describe('liveSignal and profileSignal', () => {
  it('stays unread until watched, then follows the database until unwatched', async () => {
    const query = vi.fn(getAllStools);
    const live = liveSignal(['stools'], query);
    expect(query).not.toHaveBeenCalled();
    expect(live.peek()).toBeUndefined();

    const seen: (number | undefined)[] = [];
    const stop = effect(() => {
      seen.push(live.value?.length);
    });
    await vi.waitFor(() => expect(live.peek()).toEqual([]));
    await saveStool(stool({ date: '2026-11-10' }));
    await vi.waitFor(() => expect(seen.at(-1)).toBe(1));

    stop();
    await saveStool(stool({ date: '2026-11-11' }));
    expect(query).toHaveBeenCalledTimes(2); // no refresh once unwatched
    expect(seen.at(-1)).toBe(1);
  });

  it('profileSignal goes undefined → null → saved profile', async () => {
    const seen: unknown[] = [];
    const stop = effect(() => {
      seen.push(profileSignal.value);
    });
    expect(seen[0]).toBeUndefined();
    await vi.waitFor(() => expect(profileSignal.peek()).toBeNull());
    await saveProfile(profile({ firstName: 'Ada', birthDate: '1990-05-17' }));
    await vi.waitFor(() => expect(profileSignal.peek()).toMatchObject({ firstName: 'Ada', birthDate: '1990-05-17' }));
    expect(await getProfile()).toMatchObject({ firstName: 'Ada' });
    stop();
  });
});

describe('other tabs', () => {
  let other: BroadcastChannel;
  beforeEach(() => {
    other = new BroadcastChannel('ibd-journal-changes');
  });
  afterEach(() => {
    other.close();
  });

  it('a write announced by another tab refreshes the live queries here', async () => {
    const before = storeVersion('exams').value;
    other.postMessage({ stores: ['exams'] });
    await vi.waitFor(() => expect(storeVersion('exams').value).toBe(before + 1));
  });

  it('ignores malformed messages and unknown stores', async () => {
    const before = storeVersion('exams').value;
    other.postMessage('nonsense');
    other.postMessage({ stores: 'exams' });
    other.postMessage({ stores: ['nope'] });
    other.postMessage({ stores: ['exams'] });
    await vi.waitFor(() => expect(storeVersion('exams').value).toBe(before + 1));
  });

  it('announces local writes to other tabs', async () => {
    const messages: unknown[] = [];
    other.onmessage = (event: MessageEvent<unknown>) => messages.push(event.data);
    await saveStool(stool({ date: '2026-11-10' }));
    await vi.waitFor(() => expect(messages).toEqual([{ stores: ['stools'] }]));
  });
});

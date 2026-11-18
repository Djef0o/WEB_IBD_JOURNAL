import { batch, effect, signal, untracked, type ReadonlySignal, type Signal } from '@preact/signals';
import { STORE_NAMES, type StoreName } from './schema';

/*
 * Change notification, the equivalent of the Room `Flow`s: one counter signal per store,
 * incremented after each committed write (see `transaction` in `connection.ts`). A screen
 * re-reads its data when the counters of the stores it depends on change (`useLiveQuery`,
 * `watchQuery`, `liveSignal` in `live.ts`).
 *
 * Writes made by another tab of the app are announced by a BroadcastChannel, so that every
 * open tab stays up to date.
 */

const versions = Object.fromEntries(
  STORE_NAMES.map((name) => [name, signal(0)]),
) as Record<StoreName, Signal<number>>;

/** Counter of the writes seen on a store (starts at 0 on each page load). */
export function storeVersion(name: StoreName): ReadonlySignal<number> {
  return versions[name];
}

function isStoreName(value: unknown): value is StoreName {
  return typeof value === 'string' && (STORE_NAMES as readonly string[]).includes(value);
}

function bumpLocal(names: readonly StoreName[]): void {
  batch(() => {
    for (const name of names) versions[name].value += 1;
  });
}

const CHANNEL_NAME = 'ibd-journal-changes';
const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
if (channel) {
  // A pending channel must not keep a Node process alive (tests); browsers have no `unref`.
  if ('unref' in channel && typeof channel.unref === 'function') channel.unref();
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== 'object' || data === null || !('stores' in data) || !Array.isArray(data.stores)) return;
    bumpLocal(data.stores.filter(isStoreName));
  };
}

/** Announces committed writes on `names`: re-runs the live queries here and in other tabs. */
export function bumpStores(names: readonly StoreName[]): void {
  if (names.length === 0) return;
  bumpLocal(names);
  channel?.postMessage({ stores: names });
}

/**
 * Calls `listener` after each write on one of `stores` (not at subscription time).
 * Returns the function that stops the subscription.
 */
export function subscribe(stores: readonly StoreName[], listener: () => void): () => void {
  let first = true;
  return effect(() => {
    for (const name of stores) void versions[name].value;
    if (first) {
      first = false;
      return;
    }
    untracked(listener);
  });
}

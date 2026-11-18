import { effect, signal, untracked, type ReadonlySignal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { storeVersion } from './changes';
import type { StoreName } from './schema';

/*
 * Live queries, the equivalent of Room `Flow`s: a query function (any async read of the
 * repositories) is run once, then again after each write on the stores it depends on.
 * Declare every store the query reads (`['meals', 'products']` for meals with their product).
 */

function rethrowAsync(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

/**
 * Runs `query` now and after each write on `stores`, passing each result to `onResult`.
 * Results of an outdated run are dropped. Without `onError`, a failing query throws an
 * uncaught error. Returns the function that stops the watch.
 */
export function watchQuery<T>(
  stores: readonly StoreName[],
  query: () => Promise<T>,
  onResult: (value: T) => void,
  onError: (error: unknown) => void = rethrowAsync,
): () => void {
  let run = 0;
  let active = true;
  const dispose = effect(() => {
    for (const name of stores) void storeVersion(name).value; // the dependencies
    const current = ++run;
    untracked(() => {
      let pending: Promise<T>;
      try {
        pending = query();
      } catch (error) {
        pending = Promise.reject(error);
      }
      pending.then(
        (value) => {
          if (active && current === run) onResult(value);
        },
        (error: unknown) => {
          if (active && current === run) onError(error);
        },
      );
    });
  });
  return () => {
    active = false;
    dispose();
  };
}

/**
 * Signal kept up to date with `query` while it has at least one subscriber (a component
 * or an effect reading `.value`). `undefined` until the first result, so queries must return
 * `null` (not `undefined`) for "nothing". Read the value inside a component or an effect;
 * for a one-shot read, call the repository function.
 */
export function liveSignal<T>(
  stores: readonly StoreName[],
  query: () => Promise<T>,
): ReadonlySignal<T | undefined> {
  let stop: (() => void) | null = null;
  const live = signal<T | undefined>(undefined, {
    watched() {
      stop = watchQuery(stores, query, (value) => {
        live.value = value;
      });
    },
    unwatched() {
      stop?.();
      stop = null;
    },
  });
  return live;
}

type Settled<T> = { deps: readonly unknown[]; value: T } | { error: unknown } | null;

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
}

/**
 * Preact hook: result of `query`, refreshed after each write on `stores`.
 *
 * - Returns `undefined` while loading (first run, or after `deps` changed); queries must
 *   return `null` (not `undefined`) for "nothing".
 * - `deps`: values the query closes over (month, filter...); the query is re-run when they
 *   change, like `useEffect` dependencies. Keep their number constant.
 * - A failing query throws during rendering (error boundary).
 */
export function useLiveQuery<T>(
  stores: readonly StoreName[],
  query: () => Promise<T>,
  deps: readonly unknown[] = [],
): T | undefined {
  const [settled, setSettled] = useState<Settled<T>>(null);
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const storesKey = stores.join(',');

  useEffect(
    () =>
      watchQuery(
        storesKey.split(',') as StoreName[],
        () => latestQuery.current(),
        (value) => setSettled({ deps, value }),
        (error) => setSettled({ error }),
      ),
    [storesKey, ...deps],
  );

  if (settled === null) return undefined;
  if ('error' in settled) throw settled.error;
  return sameDeps(settled.deps, deps) ? settled.value : undefined;
}

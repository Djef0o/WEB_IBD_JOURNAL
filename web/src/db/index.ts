/*
 * Data layer: IndexedDB database `ibd-journal`, one repository module per Room DAO group.
 *
 *   import { getMealsBetween, saveMeal } from '../db/meals';
 *   const meals = useLiveQuery(['meals', 'products'], () => getMealsBetween(from, to), [from, to]);
 */
export { getDb, closeDb, transaction, type Tx, type ReadTx } from './connection';
export { DB_NAME, DB_VERSION, STORE_NAMES, type IbdDb, type IbdSchema, type StoreName } from './schema';
export { storeVersion, subscribe } from './changes';
export { useLiveQuery, watchQuery, liveSignal } from './live';
export { monthBounds } from './range';
export { requestPersistentStorage } from './persist';

export * as meals from './meals';
export * as stools from './stools';
export * as labs from './labs';
export * as doses from './doses';
export * as profile from './profile';
export * as medications from './medications';
export * as checkups from './checkups';
export * as exams from './exams';
export * as products from './products';
export * as photos from './photos';
export * as prefs from './prefs';

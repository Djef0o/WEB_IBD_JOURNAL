import { productFromEntity, productToEntity } from '../domain/entities';
import type { Product } from '../domain/models';
import { transaction } from './connection';

/** Open Food Facts product cache, by barcode (`ProductDao`); entries never expire, like on Android. */

export function getProduct(barcode: string): Promise<Product | null> {
  return transaction(['products'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('products').get(barcode);
    return entity ? productFromEntity(entity) : null;
  });
}

/** Adds the product to the cache or replaces its entry. */
export function saveProduct(product: Product): Promise<void> {
  return transaction(['products'], 'readwrite', async (tx) => {
    await tx.objectStore('products').put(productToEntity(product));
  });
}

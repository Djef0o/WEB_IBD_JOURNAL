import { products } from '../db';
import type { Product, ProductLookup } from '../domain/models';

export type { ProductLookup };

/** Open Food Facts API (v2); CORS is allowed, only the barcode leaves the device. */
const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product/';
const PRODUCT_FIELDS = 'product_name,brands,nutriscore_grade,image_front_url,ingredients_text_fr';

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string | null;
    brands?: string | null;
    nutriscore_grade?: string | null;
    image_front_url?: string | null;
    ingredients_text_fr?: string | null;
  } | null;
}

/** Product of an API response; null if the database does not know it (or without a name). */
export function productFromResponse(barcode: string, response: OffResponse): Product | null {
  const off = response.product;
  if (response.status !== 1 || !off || !off.product_name || off.product_name.trim() === '') return null;
  return {
    barcode,
    name: off.product_name,
    brand: off.brands ?? null,
    nutriscore: off.nutriscore_grade ?? null,
    imageUrl: off.image_front_url ?? null,
    ingredients: off.ingredients_text_fr ?? null,
  };
}

/**
 * Looks up a product by barcode: local cache first, then the API; a product found is cached.
 * A network failure is "not found", like on Android.
 */
export async function lookupProduct(barcode: string, signal?: AbortSignal): Promise<ProductLookup> {
  const cached = await products.getProduct(barcode);
  if (cached) return { kind: 'found', product: cached };
  try {
    const url = `${ENDPOINT}${encodeURIComponent(barcode)}.json?fields=${PRODUCT_FIELDS}`;
    const reply = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!reply.ok) return { kind: 'notFound', barcode };
    const product = productFromResponse(barcode, (await reply.json()) as OffResponse);
    if (!product) return { kind: 'notFound', barcode };
    await products.saveProduct(product);
    return { kind: 'found', product };
  } catch {
    return { kind: 'notFound', barcode };
  }
}

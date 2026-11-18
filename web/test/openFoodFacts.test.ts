import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseManualBarcode } from '../src/scanner/detector';
import { lookupProduct, productFromResponse } from '../src/scanner/openFoodFacts';
import { getProduct } from '../src/db/products';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const nutella = {
  status: 1,
  product: { product_name: 'Nutella', brands: 'Ferrero', nutriscore_grade: 'e', image_front_url: 'https://images.openfoodfacts.org/x.jpg', ingredients_text_fr: 'sucre' },
};

describe('productFromResponse', () => {
  it('maps the API fields', () => {
    expect(productFromResponse('3017620422003', nutella)).toEqual({
      barcode: '3017620422003', name: 'Nutella', brand: 'Ferrero', nutriscore: 'e',
      imageUrl: 'https://images.openfoodfacts.org/x.jpg', ingredients: 'sucre',
    });
  });
  it('rejects unknown products and products without a name', () => {
    expect(productFromResponse('1', { status: 0 })).toBeNull();
    expect(productFromResponse('1', { status: 1, product: { product_name: '  ' } })).toBeNull();
    expect(productFromResponse('1', { status: 1, product: null })).toBeNull();
  });
});

describe('lookupProduct', () => {
  it('fetches, then answers from the cache without a second request', async () => {
    const fetchMock = vi.fn(async (_url: string) => reply(nutella));
    vi.stubGlobal('fetch', fetchMock);
    const first = await lookupProduct('3017620422003');
    expect(first).toMatchObject({ kind: 'found', product: { name: 'Nutella' } });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://world.openfoodfacts.org/api/v2/product/3017620422003.json');
    expect((await getProduct('3017620422003'))?.brand).toBe('Ferrero');
    const second = await lookupProduct('3017620422003');
    expect(second.kind).toBe('found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache an unknown product, and treats a network failure as not found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ status: 0 })));
    expect(await lookupProduct('111')).toEqual({ kind: 'notFound', barcode: '111' });
    expect(await getProduct('111')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await lookupProduct('222')).toEqual({ kind: 'notFound', barcode: '222' });
    vi.stubGlobal('fetch', vi.fn(async () => reply({}, false)));
    expect(await lookupProduct('333')).toEqual({ kind: 'notFound', barcode: '333' });
  });
});

describe('parseManualBarcode', () => {
  it('accepts 8 to 14 digits, ignoring spaces and dashes', () => {
    expect(parseManualBarcode('3017 6204 22003')).toBe('3017620422003');
    expect(parseManualBarcode('96385074')).toBe('96385074');
    expect(parseManualBarcode('1234567')).toBeNull();
    expect(parseManualBarcode('123456789012345')).toBeNull();
    expect(parseManualBarcode('30176204x2003')).toBeNull();
  });
});

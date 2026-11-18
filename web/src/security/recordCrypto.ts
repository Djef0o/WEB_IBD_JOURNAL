import { gcm } from '@noble/ciphers/aes.js';

/*
 * Synchronous AES-256-GCM for the records of the database. It must be synchronous: an
 * IndexedDB transaction commits as soon as the code awaits something that is not an
 * IndexedDB request, and WebCrypto only offers promises.
 *
 * Layout: 12-byte random IV, then ciphertext followed by the 16-byte tag. The store name is
 * the associated data, so a record cannot be moved to another store unnoticed.
 */

const IV_BYTES = 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encryptBytes(key: Uint8Array, plain: Uint8Array, context: string): Uint8Array<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = gcm(key, iv, encoder.encode(context)).encrypt(plain);
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv, 0);
  out.set(sealed, IV_BYTES);
  return out;
}

/** Throws if the key is wrong or the data was modified. */
export function decryptBytes(key: Uint8Array, data: Uint8Array, context: string): Uint8Array<ArrayBuffer> {
  const iv = data.subarray(0, IV_BYTES);
  return Uint8Array.from(gcm(key, iv, encoder.encode(context)).decrypt(data.subarray(IV_BYTES)));
}

export function encryptJson(key: Uint8Array, value: unknown, context: string): Uint8Array<ArrayBuffer> {
  return encryptBytes(key, encoder.encode(JSON.stringify(value)), context);
}

export function decryptJson(key: Uint8Array, data: Uint8Array, context: string): unknown {
  return JSON.parse(decoder.decode(decryptBytes(key, data, context)));
}

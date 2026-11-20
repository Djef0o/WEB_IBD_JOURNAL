import { ecb } from '@noble/ciphers/aes.js';

/*
 * ZIP archive with WinZip-AES encryption (AE-2, AES-256), the format `zip4j` writes on Android
 * and that 7-Zip, Keka, `unzip`-with-AES and most archivers open with the password.
 *
 * Per entry: compression method 99 (extra field 0x9901 holds the real method), then
 *   salt (16) | password verifier (2) | AES-CTR(data) | HMAC-SHA1(ciphertext)[0..10].
 * Keys: PBKDF2-HMAC-SHA1(password UTF-8, salt, 1000) gives 66 bytes = AES key (32) | HMAC key (32)
 * | verifier (2). AES-CTR counts the 128-bit block counter little-endian from 1 (not the usual
 * big-endian CTR, hence the keystream below). AE-2: the CRC-32 field is 0.
 * Entries are deflated (`CompressionStream`) when the browser has it, stored otherwise.
 */

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const VERIFIER_LENGTH = 2;
const MAC_LENGTH = 10;
const ITERATIONS = 1000;
const METHOD_AES = 99;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

type Bytes = Uint8Array<ArrayBuffer>;

const encoder = new TextEncoder();

async function deflateRaw(data: Uint8Array): Promise<Bytes | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([data as Bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function deriveKeys(password: string, salt: Bytes): Promise<{ encKey: Bytes; macKey: Bytes; verifier: Bytes }> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-1', salt, iterations: ITERATIONS },
    base,
    (2 * KEY_LENGTH + VERIFIER_LENGTH) * 8,
  );
  const all = new Uint8Array(bits);
  return {
    encKey: all.slice(0, KEY_LENGTH),
    macKey: all.slice(KEY_LENGTH, 2 * KEY_LENGTH),
    verifier: all.slice(2 * KEY_LENGTH),
  };
}

/** AES-CTR as WinZip defines it: counter block = 128-bit little-endian integer, first block 1. */
export function aesCtrLittleEndian(key: Uint8Array, data: Uint8Array): Bytes {
  const blocks = Math.ceil(data.length / 16);
  const counters = new Uint8Array(blocks * 16);
  for (let block = 0; block < blocks; block++) {
    let n = block + 1;
    for (let i = 0; n > 0 && i < 8; i++) {
      counters[block * 16 + i] = n % 256;
      n = Math.floor(n / 256);
    }
  }
  const keystream = ecb(key, { disablePadding: true }).encrypt(counters);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i]! ^ keystream[i]!;
  return out;
}

async function hmacSha1(key: Bytes, data: Uint8Array): Promise<Bytes> {
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, data as Bytes));
}

interface Entry {
  name: Bytes;
  method: number;
  uncompressedSize: number;
  payload: Bytes;
}

async function encryptEntry(file: ZipFile, password: string): Promise<Entry> {
  const deflated = await deflateRaw(file.data);
  const useDeflate = deflated !== null && deflated.length < file.data.length;
  const body = useDeflate ? deflated : file.data;
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const { encKey, macKey, verifier } = await deriveKeys(password, salt);
  const cipher = aesCtrLittleEndian(encKey, body);
  const mac = (await hmacSha1(macKey, cipher)).subarray(0, MAC_LENGTH);
  const payload = new Uint8Array(SALT_LENGTH + VERIFIER_LENGTH + cipher.length + MAC_LENGTH);
  payload.set(salt, 0);
  payload.set(verifier, SALT_LENGTH);
  payload.set(cipher, SALT_LENGTH + VERIFIER_LENGTH);
  payload.set(mac, SALT_LENGTH + VERIFIER_LENGTH + cipher.length);
  return {
    name: encoder.encode(file.name),
    method: useDeflate ? METHOD_DEFLATE : METHOD_STORE,
    uncompressedSize: file.data.length,
    payload,
  };
}

/** Extra field 0x9901: AE-2, vendor "AE", strength 3 (AES-256), real compression method. */
function aesExtra(method: number): Bytes {
  const extra = new Uint8Array(11);
  const view = new DataView(extra.buffer);
  view.setUint16(0, 0x9901, true);
  view.setUint16(2, 7, true);
  view.setUint16(4, 2, true);
  extra[6] = 0x41; // 'A'
  extra[7] = 0x45; // 'E'
  extra[8] = 3;
  view.setUint16(9, method, true);
  return extra;
}

/** MS-DOS time and date of `at`. */
function dosDateTime(at: Date): { time: number; date: number } {
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((Math.max(at.getFullYear(), 1980) - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

const VERSION = 51; // 5.1: AES encryption
const FLAGS = 0x0801; // encrypted + UTF-8 names

/** Archive with every file encrypted with `password`. */
export async function zipAes(files: readonly ZipFile[], password: string, at: Date = new Date()): Promise<Blob> {
  if (password === '') throw new RangeError('A password is required');
  const { time, date } = dosDateTime(at);
  const parts: Bytes[] = [];
  const central: Bytes[] = [];
  let offset = 0;

  for (const file of files) {
    const entry = await encryptEntry(file, password);
    const extra = aesExtra(entry.method);

    const local = new Uint8Array(30 + entry.name.length + extra.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, VERSION, true);
    lv.setUint16(6, FLAGS, true);
    lv.setUint16(8, METHOD_AES, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, 0, true); // CRC-32: 0 with AE-2
    lv.setUint32(18, entry.payload.length, true);
    lv.setUint32(22, entry.uncompressedSize, true);
    lv.setUint16(26, entry.name.length, true);
    lv.setUint16(28, extra.length, true);
    local.set(entry.name, 30);
    local.set(extra, 30 + entry.name.length);

    const header = new Uint8Array(46 + entry.name.length + extra.length);
    const cv = new DataView(header.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, VERSION, true);
    cv.setUint16(6, VERSION, true);
    cv.setUint16(8, FLAGS, true);
    cv.setUint16(10, METHOD_AES, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, 0, true);
    cv.setUint32(20, entry.payload.length, true);
    cv.setUint32(24, entry.uncompressedSize, true);
    cv.setUint16(28, entry.name.length, true);
    cv.setUint16(30, extra.length, true);
    cv.setUint32(42, offset, true);
    header.set(entry.name, 46);
    header.set(extra, 46 + entry.name.length);

    parts.push(local, entry.payload);
    central.push(header);
    offset += local.length + entry.payload.length;
  }

  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

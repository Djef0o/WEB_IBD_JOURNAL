import { createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  decrypt, encrypt, InvalidBackupError, isEncryptedBackup, ITERATIONS, WrongPasswordError,
} from '../src/backup/crypto';

const enc = new TextEncoder();
const dec = new TextDecoder();
const FAST = 1_000;
const SALT = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
const IV = Uint8Array.from({ length: 12 }, (_, i) => 100 + i);

/** Separate implementation (node:crypto) of the format documented in BackupCrypto.kt. */
function oracleEncrypt(plain: Uint8Array, password: string, iterations: number, salt: Uint8Array, iv: Uint8Array): Uint8Array {
  const header = Buffer.alloc(40);
  header.write('IBDJENC1', 0, 'ascii');
  header.writeInt32BE(iterations, 8);
  Buffer.from(salt).copy(header, 12);
  Buffer.from(iv).copy(header, 28);
  const key = pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(header);
  return Buffer.concat([header, cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}

function oracleDecrypt(file: Uint8Array, password: string): Uint8Array {
  const buf = Buffer.from(file);
  const iterations = buf.readInt32BE(8);
  const key = pbkdf2Sync(Buffer.from(password, 'utf8'), buf.subarray(12, 28), iterations, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(28, 40), { authTagLength: 16 });
  decipher.setAAD(buf.subarray(0, 40));
  decipher.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([decipher.update(buf.subarray(40, buf.length - 16)), decipher.final()]);
}

describe('backup crypto: round trip and failures', () => {
  it('encrypts then decrypts, with the documented layout', async () => {
    const plain = enc.encode('{"meals":[],"stools":[]} é🔐');
    const file = await encrypt(plain, 'secret', { iterations: FAST });
    expect(dec.decode(file.subarray(0, 8))).toBe('IBDJENC1');
    expect(new DataView(file.buffer).getInt32(8, false)).toBe(FAST);
    expect(file.length).toBe(40 + plain.length + 16);
    expect(isEncryptedBackup(file)).toBe(true);
    expect(await decrypt(file, 'secret')).toEqual(plain);
  });

  it('uses a fresh salt and IV each time', async () => {
    const a = await encrypt(enc.encode('x'), 'p', { iterations: 1 });
    const b = await encrypt(enc.encode('x'), 'p', { iterations: 1 });
    expect(a.subarray(12, 40)).not.toEqual(b.subarray(12, 40));
  });

  it('defaults to 600 000 iterations', async () => {
    expect(ITERATIONS).toBe(600_000);
    const file = await encrypt(enc.encode('x'), 'p');
    expect(new DataView(file.buffer).getInt32(8, false)).toBe(600_000);
    expect(await decrypt(file, 'p')).toEqual(enc.encode('x'));
  });

  it('round-trips an empty payload', async () => {
    const file = await encrypt(new Uint8Array(0), 'p', { iterations: 1 });
    expect(file.length).toBe(56);
    expect((await decrypt(file, 'p')).length).toBe(0);
  });

  it('wrong password → WrongPasswordError', async () => {
    const file = await encrypt(enc.encode('data'), 'good', { iterations: FAST });
    await expect(decrypt(file, 'bad')).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(decrypt(file, '')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('bad signature or truncated header → InvalidBackupError', async () => {
    const file = await encrypt(enc.encode('data'), 'p', { iterations: 1 });
    const badMagic = file.slice();
    badMagic[0] = 0x58;
    await expect(decrypt(badMagic, 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    await expect(decrypt(enc.encode('{"meals":[],"stools":[]}'), 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    for (const length of [0, 3, 7, 8, 11, 12, 27, 39]) {
      await expect(decrypt(file.subarray(0, length), 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    }
  });

  it('invalid iteration count in the header → InvalidBackupError', async () => {
    const file = await encrypt(enc.encode('data'), 'p', { iterations: 1 });
    for (const value of [0, -1, 10_000_001, 0x7fffffff, -0x80000000]) {
      const forged = file.slice();
      new DataView(forged.buffer).setInt32(8, value, false);
      await expect(decrypt(forged, 'p')).rejects.toBeInstanceOf(InvalidBackupError);
    }
  });

  it('accepts the iteration ceiling (10 000 000) without rejecting the header', async () => {
    const file = await encrypt(enc.encode('data'), 'p', { iterations: 1 });
    const forged = file.slice();
    new DataView(forged.buffer).setInt32(8, 10_000_000, false);
    // The count differs from the one used to encrypt: the header check passes, then GCM fails.
    await expect(decrypt(forged, 'p')).rejects.toBeInstanceOf(WrongPasswordError);
  }, 60_000);

  it('detects any modification of the 40-byte header (AAD)', async () => {
    const file = await encrypt(enc.encode('data'), 'p', { iterations: 5 });
    for (let i = 8; i < 40; i++) {
      const forged = file.slice();
      forged[i] = (forged[i] ?? 0) ^ 1;
      // Iteration bytes: an absurd count is rejected up front; any other change fails the GCM tag.
      const expected = i >= 8 && i < 12 && (forged[8] ?? 0) !== 0 ? InvalidBackupError : WrongPasswordError;
      await expect(decrypt(forged, 'p'), `header byte ${i}`).rejects.toBeInstanceOf(expected);
    }
  });

  it('detects a modified or truncated body', async () => {
    const file = await encrypt(enc.encode('some longer payload'), 'p', { iterations: FAST });
    const flipped = file.slice();
    flipped[45] = (flipped[45] ?? 0) ^ 0x80;
    await expect(decrypt(flipped, 'p')).rejects.toBeInstanceOf(WrongPasswordError);
    const tagFlipped = file.slice();
    tagFlipped[file.length - 1] = (tagFlipped[file.length - 1] ?? 0) ^ 1;
    await expect(decrypt(tagFlipped, 'p')).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(decrypt(file.subarray(0, file.length - 1), 'p')).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(decrypt(file.subarray(0, 40), 'p')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('decrypts from a subarray view (non-zero byteOffset)', async () => {
    const file = await encrypt(enc.encode('view'), 'p', { iterations: 1 });
    const padded = new Uint8Array(file.length + 10);
    padded.set(file, 5);
    expect(dec.decode(await decrypt(padded.subarray(5, 5 + file.length), 'p'))).toBe('view');
  });

  it('isEncryptedBackup only checks the signature', () => {
    expect(isEncryptedBackup(enc.encode('IBDJENC1'))).toBe(true);
    expect(isEncryptedBackup(enc.encode('IBDJENC'))).toBe(false);
    expect(isEncryptedBackup(enc.encode('IBDJENC2....'))).toBe(false);
    expect(isEncryptedBackup(new Uint8Array(0))).toBe(false);
  });
});

describe('backup crypto: independent oracles', () => {
  const plain = enc.encode(JSON.stringify({ meals: [], stools: [], note: 'é🔐' }));
  const password = 'mot de passe é🔐 №1';

  it('produces exactly the bytes of a node:crypto implementation (fixed salt/IV)', async () => {
    const ours = await encrypt(plain, password, { iterations: FAST, salt: SALT, iv: IV });
    expect(Buffer.from(ours).equals(Buffer.from(oracleEncrypt(plain, password, FAST, SALT, IV)))).toBe(true);
  });

  it('decrypts a file produced by the node:crypto oracle, and vice versa', async () => {
    const file = oracleEncrypt(plain, password, FAST, SALT, IV);
    expect(await decrypt(file, password)).toEqual(plain);
    const ours = await encrypt(plain, password, { iterations: FAST });
    expect(Buffer.from(oracleDecrypt(ours, password)).equals(Buffer.from(plain))).toBe(true);
  });

  it('decrypts a file produced by javax.crypto (Java port of BackupCrypto.kt, 600 000 iterations)', async () => {
    const vector = JSON.parse(readFileSync(new URL('./fixtures/android-vector.json', import.meta.url), 'utf8')) as {
      password: string; iterations: number; fileBase64: string;
    };
    expect(vector.password).toBe('mot de passe é🔐 №1');
    expect(vector.iterations).toBe(ITERATIONS);
    const file = new Uint8Array(Buffer.from(vector.fileBase64, 'base64'));
    const expected = readFileSync(new URL('./fixtures/android-sample.json', import.meta.url));
    const result = await decrypt(file, vector.password);
    expect(Buffer.from(result).equals(expected)).toBe(true);
    // And our own output for the same inputs is byte-identical to Java's.
    const header = file.subarray(0, 40);
    const again = await encrypt(result, vector.password, { salt: header.slice(12, 28), iv: header.slice(28, 40) });
    expect(Buffer.from(again).equals(Buffer.from(file))).toBe(true);
    await expect(decrypt(file, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError);
  }, 60_000);
});

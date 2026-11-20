import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { aesCtrLittleEndian, zipAes } from '../src/export/zipAes';

const encoder = new TextEncoder();
const files = [
  { name: 'stools.csv', data: encoder.encode('date,bristol_type\r\n' + '2026-11-18,4\r\n'.repeat(200)) },
  { name: 'weights.csv', data: encoder.encode('date,kg\r\n') },
  { name: 'é.csv', data: encoder.encode('x'.repeat(33)) },
];

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** Independent decryptor written from the WinZip AES specification (node crypto, no shared code). */
function decryptEntries(zip: Uint8Array, password: string): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out = new Map<string, Uint8Array>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    expect(method).toBe(99);
    const name = new TextDecoder().decode(zip.subarray(offset + 30, offset + 30 + nameLength));
    const extra = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + extraLength);
    const ev = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
    expect(ev.getUint16(0, true)).toBe(0x9901);
    expect(extra[8]).toBe(3);
    const real = ev.getUint16(9, true);
    const start = offset + 30 + nameLength + extraLength;
    const payload = zip.subarray(start, start + size);
    const salt = payload.subarray(0, 16);
    const derived = pbkdf2Sync(password, salt, 1000, 66, 'sha1');
    expect([...payload.subarray(16, 18)]).toEqual([...derived.subarray(64, 66)]);
    const cipher = payload.subarray(18, payload.length - 10);
    const mac = createHmac('sha1', derived.subarray(32, 64)).update(cipher).digest().subarray(0, 10);
    expect([...payload.subarray(payload.length - 10)]).toEqual([...mac]);
    const plain = aesCtrLittleEndian(derived.subarray(0, 32), cipher);
    out.set(name, real === 8 ? inflateRawSync(plain) : plain);
    offset = start + size;
  }
  return out;
}

describe('zipAes', () => {
  it('writes entries a WinZip-AES decryptor reads back', async () => {
    const zip = await bytesOf(await zipAes(files, 'correct horse'));
    const entries = decryptEntries(zip, 'correct horse');
    expect([...entries.keys()]).toEqual(['stools.csv', 'weights.csv', 'é.csv']);
    for (const file of files) expect([...entries.get(file.name)!]).toEqual([...file.data]);
  });

  it('refuses an empty password', async () => {
    await expect(zipAes(files, '')).rejects.toThrow();
  });

  const sevenZip = ['7z', '7za', '7zr'].find((bin) => spawnSync(bin, ['--help'], { stdio: 'ignore' }).status === 0);
  it.skipIf(!sevenZip)('is opened by 7-Zip with the password, and refused with another', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zipaes-'));
    try {
      writeFileSync(join(dir, 'a.zip'), await bytesOf(await zipAes(files, 'pässword-123')));
      execFileSync(sevenZip!, ['t', '-ppässword-123', join(dir, 'a.zip')], { stdio: 'pipe' });
      execFileSync(sevenZip!, ['x', '-ppässword-123', `-o${dir}`, join(dir, 'a.zip')], { stdio: 'pipe' });
      expect(readFileSync(join(dir, 'stools.csv'))).toEqual(Buffer.from(files[0]!.data));
      expect(readFileSync(join(dir, 'weights.csv'))).toEqual(Buffer.from(files[1]!.data));
      expect(readFileSync(join(dir, 'é.csv'), 'utf8')).toBe('x'.repeat(33));
      expect(() => execFileSync(sevenZip!, ['t', '-pwrong', join(dir, 'a.zip')], { stdio: 'pipe' })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

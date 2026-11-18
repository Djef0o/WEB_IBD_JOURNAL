/**
 * Échoue si une clé utilisée via t('…') / tp('…') dans web/src n'existe pas dans en.json.
 * Les clés dynamiques (t(`x_${n}`), t(variable)) ne sont pas vérifiables : utiliser t('clé') littéral,
 * ou déclarer les clés dynamiques par un commentaire `// i18n-keys: clé_a clé_b`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const en = JSON.parse(readFileSync(join(src, 'i18n/en.json'), 'utf8')) as Record<string, unknown>;

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f) && !/\.d\.ts$/.test(f)) out.push(p);
  }
  return out;
}

const callRe = /(?<![\w.])tp?\(\s*(['"])([A-Za-z0-9_]+)\1/g;
const declRe = /i18n-keys:\s*([A-Za-z0-9_ ]+)/g;
const missing: string[] = [];

for (const file of walk(src)) {
  if (file.includes(`${join('src', 'i18n')}`)) continue;
  const text = readFileSync(file, 'utf8');
  const keys: { key: string; index: number }[] = [];
  for (const m of text.matchAll(callRe)) keys.push({ key: m[2]!, index: m.index! });
  for (const m of text.matchAll(declRe)) for (const k of m[1]!.trim().split(/\s+/)) keys.push({ key: k, index: m.index! });
  for (const { key, index } of keys) {
    if (key in en) continue;
    const line = text.slice(0, index).split('\n').length;
    missing.push(`${relative(root, file)}:${line}  clé inconnue « ${key} »`);
  }
}

if (missing.length > 0) {
  console.error(`[i18n:check-keys] ${missing.length} clé(s) absente(s) de en.json :\n${missing.join('\n')}`);
  process.exit(1);
}
console.log('[i18n:check-keys] OK');

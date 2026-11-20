/**
 * Convertit les ressources Android (web/i18n-source/values{,-fr,...}/strings*.xml) en
 * web/src/i18n/<lang>.json, puis fusionne web/src/i18n/web-extra.<lang>.json.
 *
 * Format de sortie : { clé: "texte {1} {2}" | { one: "...", other: "..." } }
 *  - %1$s, %2$d, %.1f, %d → {1}, {2}… (les %d/%s sans position sont numérotés dans l'ordre)
 *  - %% → %
 *  - <plurals> → objet { zero|one|two|few|many|other }
 */
import { XMLParser } from 'fast-xml-parser';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const resDir = resolve(root, 'i18n-source');
const outDir = resolve(root, 'src/i18n');

export const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt'] as const;

/**
 * Chaînes propres à Android, sans équivalent web : permissions système, canaux et actions
 * de notification, synchro du calendrier du téléphone, partage de PDF, économie de batterie.
 * Les équivalents web sont dans web-extra.<lang>.json (préfixe `web_`).
 */
export const EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  // Permissions
  'camera_permission_needed',
  'grant_permission',
  'notification_permission_warning',
  'notification_permission_grant',
  'exact_alarm_warning',
  'exact_alarm_grant',
  'battery_title',
  'battery_warning',
  'battery_grant',
  'battery_exempt',
  // Notifications Android (canaux, actions, planification en arrière-plan)
  'exam_reminder_channel',
  'medication_reminder_channel',
  'checkup_reminder_channel',
  'onboarding_notifications_title',
  'onboarding_notifications_text',
  'onboarding_notifications_allow',
  'onboarding_notifications_granted',
  // Calendrier du téléphone (remplacé par l'export .ics)
  'calendar_section_title',
  'calendar_sync',
  'calendar_sync_desc',
  'calendar_target',
  'calendar_none',
  'calendar_permission_lost',
  // Partage du PDF (remplacé par l'impression du navigateur)
  'report_share_title',
  'report_no_share_app',
]);

type Plural = Record<string, string>;
export type Entry = string | Plural;
export type Dict = Record<string, Entry>;

interface RawNode {
  [tag: string]: unknown;
  ':@'?: Record<string, string>;
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  cdataPropName: false, // le contenu CDATA est fusionné au texte
});

/** Texte brut d'un nœud (xliff:g, <b>… : on garde le contenu, on ignore les balises). */
function textOf(nodes: unknown): string {
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const n of nodes as RawNode[]) {
    for (const [k, v] of Object.entries(n)) {
      if (k === ':@') continue;
      out += k === '#text' ? String(v) : textOf(v);
    }
  }
  return out;
}

/** Règles Android : guillemets, espaces réduits, échappements, % → placeholders. */
export function decodeAndroid(raw: string): string {
  let s = raw;
  // Android : une chaîne entièrement entre guillemets garde ses espaces ; sinon réduction.
  const quoted = /^\s*"([\s\S]*)"\s*$/.exec(s);
  if (quoted && !/(^|[^\\])"/.test(quoted[1] ?? '')) {
    s = quoted[1] ?? '';
  } else {
    s = s.replace(/\s+/g, ' ').trim();
  }
  s = s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, c: string) => {
    if (c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    return c; // \' \" \@ \? \\
  });
  return s;
}

/** %1$s %2$d %.1f %d → {n} ; %% → %. */
export function convertPlaceholders(s: string): string {
  let seq = 0;
  return s.replace(/%(?:(\d+)\$)?([-#+ 0,(]*\d*(?:\.\d+)?)([a-zA-Z%])/g, (_m, pos: string | undefined, _flags: string, conv: string) => {
    if (conv === '%') return '%';
    if (conv === 'n') return '\n';
    return `{${pos ?? ++seq}}`;
  });
}

function attr(n: RawNode, name: string): string | undefined {
  return n[':@']?.[name];
}

function parseFile(path: string, out: Dict): void {
  const doc = parser.parse(readFileSync(path, 'utf8')) as RawNode[];
  const resources = doc.find((n) => 'resources' in n)?.['resources'] as RawNode[] | undefined;
  if (!resources) return;
  for (const n of resources) {
    const name = attr(n, 'name');
    if (n['string'] && name) {
      if (attr(n, 'translatable') === 'false') continue;
      out[name] = decodeAndroid(textOf(n['string']));
    } else if (n['plurals'] && name) {
      const forms: Plural = {};
      for (const item of n['plurals'] as RawNode[]) {
        const q = attr(item, 'quantity');
        if (item['item'] && q) forms[q] = decodeAndroid(textOf(item['item']));
      }
      out[name] = forms;
    }
  }
}

function resolveRefs(dict: Dict, fallback: Dict): void {
  const ref = (s: string, depth = 0): string =>
    depth > 5
      ? s
      : s.replace(/^@string\/(\w+)$/, (m, k: string) => {
          const v = dict[k] ?? fallback[k];
          return typeof v === 'string' ? ref(v, depth + 1) : m;
        });
  for (const [k, v] of Object.entries(dict)) {
    if (typeof v === 'string') dict[k] = ref(v);
    else for (const q of Object.keys(v)) v[q] = ref(v[q] ?? '');
  }
}

function finalize(dict: Dict): Dict {
  const out: Dict = {};
  for (const k of Object.keys(dict).sort()) {
    if (EXCLUDED_KEYS.has(k)) continue;
    const v = dict[k]!;
    out[k] =
      typeof v === 'string'
        ? convertPlaceholders(v)
        : Object.fromEntries(Object.entries(v).map(([q, s]) => [q, convertPlaceholders(s)]));
  }
  return out;
}

function localeDir(lang: string): string {
  return join(resDir, lang === 'en' ? 'values' : `values-${lang}`);
}

function loadAndroid(lang: string): Dict {
  const dir = localeDir(lang);
  const dict: Dict = {};
  for (const f of readdirSync(dir).filter((f) => /^strings.*\.xml$/.test(f)).sort()) parseFile(join(dir, f), dict);
  return dict;
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  const raw: Record<string, Dict> = {};
  for (const lang of LANGS) raw[lang] = loadAndroid(lang);
  for (const lang of LANGS) resolveRefs(raw[lang]!, raw['en']!);

  let problems = 0;
  for (const lang of LANGS) {
    const dict = finalize(raw[lang]!);
    const extraPath = join(outDir, `web-extra.${lang}.json`);
    if (existsSync(extraPath)) {
      // `web-extra.<lang>.json` plus one `web-extra-<feature>.<lang>.json` per feature (no shared file to merge).
      const featureFiles = readdirSync(outDir)
        .filter((f) => f.startsWith('web-extra-') && f.endsWith(`.${lang}.json`))
        .sort();
      for (const file of [extraPath, ...featureFiles.map((f) => join(outDir, f))]) {
        const extra = JSON.parse(readFileSync(file, 'utf8')) as Dict;
        for (const [k, v] of Object.entries(extra)) {
          if (k in dict) {
            console.error(`[i18n] ${lang}: la clé web "${k}" (${file}) existe déjà`);
            problems++;
          }
          dict[k] = v;
        }
      }
    } else {
      console.error(`[i18n] fichier manquant : ${extraPath}`);
      problems++;
    }
    const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    writeFileSync(join(outDir, `${lang}.json`), JSON.stringify(sorted, null, 2) + '\n');
    console.log(`[i18n] ${lang}.json : ${Object.keys(sorted).length} clés`);
  }
  if (problems > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

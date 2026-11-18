import { signal } from '@preact/signals';

export const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt'] as const;
export type Lang = (typeof LANGS)[number];
export const STORAGE_KEY = 'ibdj.lang';

type Plural = Partial<Record<Intl.LDMLPluralRule, string>>;
export type Entry = string | Plural;
export type Dict = Record<string, Entry>;
export type Params = Record<string | number, string | number> | readonly (string | number)[];

/** Un chunk par langue (code-splitting) ; `en` sert de repli. */
const loaders: Record<Lang, () => Promise<{ default: unknown }>> = {
  en: () => import('./en.json'),
  fr: () => import('./fr.json'),
  de: () => import('./de.json'),
  es: () => import('./es.json'),
  it: () => import('./it.json'),
  pt: () => import('./pt.json'),
};

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

/** Première langue supportée parmi une liste de tags BCP 47 (`fr-CA` → `fr`), sinon `en`. */
export function matchLang(languages: readonly string[]): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

function readStored(): Lang | null {
  try {
    const v = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Préférence enregistrée, sinon `navigator.languages`, sinon `en`. */
export function detectLang(): Lang {
  return readStored() ?? matchLang(globalThis.navigator?.languages ?? []);
}

export const lang = signal<Lang>(detectLang());
/** Dictionnaires chargés ; un signal pour que `t()` relance le rendu quand un chunk arrive. */
const dicts = signal<Partial<Record<Lang, Dict>>>({});

function applyHtmlLang(l: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}
applyHtmlLang(lang.value);

async function load(l: Lang): Promise<void> {
  if (dicts.peek()[l]) return;
  const mod = await loaders[l]();
  dicts.value = { ...dicts.peek(), [l]: mod.default as Dict };
}

/** Charge `en` + la langue courante. À attendre avant le premier rendu. */
export async function initI18n(): Promise<void> {
  await Promise.all([load('en'), load(lang.value)]);
}

/** Change de langue (charge le dictionnaire d'abord). `null` : retour à la détection automatique. */
export async function setLang(next: Lang | null): Promise<void> {
  const target = next ?? matchLang(globalThis.navigator?.languages ?? []);
  await load(target);
  try {
    if (next) globalThis.localStorage?.setItem(STORAGE_KEY, next);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : la langue reste valable pour la session */
  }
  lang.value = target;
  applyHtmlLang(target);
}

function lookup(key: string): Entry | undefined {
  const all = dicts.value;
  return all[lang.value]?.[key] ?? all.en?.[key];
}

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = Array.isArray(params) ? (params as readonly (string | number)[])[Number(name) - 1] : (params as Record<string, string | number>)[name];
    return v === undefined ? m : String(v);
  });
}

/** Chaîne traduite ; paramètres `{1}`, `{2}`… (tableau positionnel ou objet). Clé inconnue : la clé elle-même. */
export function t(key: string, params?: Params): string {
  const e = lookup(key);
  return typeof e === 'string' ? interpolate(e, params) : key;
}

const pluralRulesCache = new Map<Lang, Intl.PluralRules>();

/**
 * Pluriel (`<plurals>` Android) selon `Intl.PluralRules` de la langue courante.
 * `{1}` vaut `count` sauf si `params` le redéfinit ; `{count}` est toujours disponible.
 */
export function tp(key: string, count: number, params?: Params): string {
  const e = lookup(key);
  if (e === undefined) return key;
  if (typeof e === 'string') return interpolate(e, withCount(count, params));
  let rules = pluralRulesCache.get(lang.value);
  if (!rules) pluralRulesCache.set(lang.value, (rules = new Intl.PluralRules(lang.value)));
  const form = e[rules.select(count)] ?? e.other ?? key;
  return interpolate(form, withCount(count, params));
}

function withCount(count: number, params?: Params): Record<string | number, string | number> {
  const base: Record<string | number, string | number> = { 1: count, count };
  if (!params) return base;
  if (Array.isArray(params)) {
    (params as readonly (string | number)[]).forEach((v, i) => (base[i + 1] = v));
    return base;
  }
  return { ...base, ...(params as Record<string | number, string | number>) };
}

type Formattable = { toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): string };

/** Date (Date, epoch ms ou objet Temporal) formatée dans la langue courante. */
export function formatDate(value: Date | number | Formattable, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (typeof value === 'number' || value instanceof Date) return new Intl.DateTimeFormat(lang.value, options).format(value);
  return value.toLocaleString(lang.value, options);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang.value, options).format(value);
}

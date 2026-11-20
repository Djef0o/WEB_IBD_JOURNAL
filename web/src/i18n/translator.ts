import type { Dict, Entry, Lang, Params } from './index';

/*
 * Translator for a language other than the one of the interface (travel documents: written in the
 * language of the destination, whatever the app's language). Same rules as `t`/`tp`; `en` fills gaps.
 */

const loaders: Record<Lang, () => Promise<{ default: unknown }>> = {
  en: () => import('./en.json'),
  fr: () => import('./fr.json'),
  de: () => import('./de.json'),
  es: () => import('./es.json'),
  it: () => import('./it.json'),
  pt: () => import('./pt.json'),
};

export interface Translator {
  lang: Lang;
  t(key: string, params?: Params): string;
  tp(key: string, count: number, params?: Params): string;
}

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => {
    const v = Array.isArray(params)
      ? (params as readonly (string | number)[])[Number(name) - 1]
      : (params as Record<string, string | number>)[name];
    return v === undefined ? m : String(v);
  });
}

const cache = new Map<Lang, Promise<Translator>>();

/** Translator of `lang` (dictionaries load once). */
export function loadTranslator(lang: Lang): Promise<Translator> {
  let cached = cache.get(lang);
  if (!cached) {
    cached = Promise.all([loaders.en(), loaders[lang]()]).then(([en, target]) => {
      const dicts = [target.default as Dict, en.default as Dict];
      const lookup = (key: string): Entry | undefined => {
        for (const dict of dicts) if (dict[key] !== undefined) return dict[key];
        return undefined;
      };
      const rules = new Intl.PluralRules(lang);
      return {
        lang,
        t(key, params) {
          const entry = lookup(key);
          return typeof entry === 'string' ? interpolate(entry, params) : key;
        },
        tp(key, count, params) {
          const entry = lookup(key);
          if (entry === undefined) return key;
          const merged: Record<string | number, string | number> = { 1: count, count };
          if (Array.isArray(params)) (params as readonly (string | number)[]).forEach((v, i) => (merged[i + 1] = v));
          else Object.assign(merged, params);
          const form = typeof entry === 'string' ? entry : (entry[rules.select(count)] ?? entry.other ?? key);
          return interpolate(form, merged);
        },
      };
    });
    cache.set(lang, cached);
  }
  return cached;
}

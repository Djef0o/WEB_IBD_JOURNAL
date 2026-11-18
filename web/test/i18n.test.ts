// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { LANGS, formatNumber, initI18n, matchLang, setLang, t, tp, type Lang } from '../src/i18n';

type Dict = Record<string, string | Record<string, string>>;
const read = (l: string): Dict => JSON.parse(readFileSync(resolve(__dirname, `../src/i18n/${l}.json`), 'utf8')) as Dict;
const en = read('en');

describe('dictionnaires', () => {
  for (const l of LANGS.filter((x) => x !== 'en')) {
    it(`${l} contient toutes les clés de en, avec les mêmes placeholders`, () => {
      const d = read(l);
      const missing = Object.keys(en).filter((k) => !(k in d));
      expect(missing).toEqual([]);
      const extra = Object.keys(d).filter((k) => !(k in en));
      expect(extra).toEqual([]);
      const ph = (s: string) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort().join();
      const bad: string[] = [];
      for (const [k, v] of Object.entries(en)) {
        if (typeof v !== 'string') continue;
        const o = d[k];
        if (typeof o !== 'string' || ph(o) !== ph(v)) bad.push(k);
      }
      expect(bad).toEqual([]);
    });
  }

  it('aucune syntaxe Android ne subsiste', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(read(l))) {
        const forms = typeof v === 'string' ? [v] : Object.values(v);
        for (const s of forms) expect(s, `${l}.${k}`).not.toMatch(/%\d?\$?[sd]|\\'|@string\/|<xliff/);
      }
    }
  });

  it('les chaînes propres à Android sont exclues', () => {
    expect(en).not.toHaveProperty('exact_alarm_warning');
    expect(en).not.toHaveProperty('calendar_sync');
    expect(en).toHaveProperty('web_export_ics');
  });
});

describe('t / tp', () => {
  beforeAll(async () => {
    await setLang('en');
    await initI18n();
  });

  it('interpole des paramètres positionnels et nommés', async () => {
    expect(t('stool_recorded_format', [4])).toBe('Type 4 stool logged!');
    expect(t('stool_recorded_format', { 1: 7 })).toBe('Type 7 stool logged!');
    expect(t('web_backup_last_export', ['today'])).toBe('Last export: today');
  });

  it("renvoie la clé si elle est inconnue", () => {
    expect(t('does_not_exist')).toBe('does_not_exist');
  });

  it('apostrophes et pourcentages décodés', () => {
    expect(t('onboarding_text')).toContain("Crohn's");
    expect(tp('treatment_adherence', 3, [2, 3, 67])).toContain('(67%)');
  });

  it('pluriels en', () => {
    expect(tp('profile_age', 1)).toBe('1 year old');
    expect(tp('profile_age', 40)).toBe('40 years old');
  });

  it('pluriels fr : 0 et 1 → one, 2 → other', async () => {
    await setLang('fr');
    expect(tp('profile_age', 0)).toBe('0 an');
    expect(tp('profile_age', 1)).toBe('1 an');
    expect(tp('profile_age', 2)).toBe('2 ans');
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('ibdj.lang')).toBe('fr');
    await setLang('en');
  });

  it('paramètres explicites prioritaires sur le compte', () => {
    expect(tp('treatment_adherence', 1, [1, 1, 100])).toBe('Adherence (30 days): 1/1 dose taken (100%)');
  });

  it('change de langue', async () => {
    await setLang('de');
    expect(t('save')).toBe(read('de')['save']);
    await setLang('en');
    expect(t('save')).toBe('Save');
  });

  it('formatNumber suit la langue', async () => {
    await setLang('fr');
    expect(formatNumber(1234.5)).toMatch(/^1\s234,5$/u);
    await setLang('en');
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });
});

describe('détection', () => {
  it('matchLang', () => {
    expect(matchLang(['fr-CA', 'en'])).toBe('fr');
    expect(matchLang(['ja', 'pt-BR'])).toBe<Lang>('pt');
    expect(matchLang(['ja'])).toBe('en');
    expect(matchLang([])).toBe('en');
  });
});

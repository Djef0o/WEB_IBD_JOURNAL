import { setLangPref } from '../../../db/prefs';
import { LANGS, STORAGE_KEY, isLang, lang, setLang, t, type Lang } from '../../../i18n';
import { Card } from '../../components';
import { SelectField } from '../../forms';

type Choice = Lang | 'auto';

/** Choix explicite enregistré (`setLang` l'écrit avant de changer le signal `lang` : le relire ici suffit). */
function stored(): Choice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Nom de la langue dans cette langue même (« Deutsch », « Español ») : reconnaissable par tous. */
function autonym(tag: Lang): string {
  const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag) ?? tag;
  return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
}

/** Langue de l'interface : automatique (langues du navigateur) ou fixée. Prise en compte immédiatement. */
export function LanguageSection() {
  void lang.value; // relance le rendu quand la langue change
  const options = [
    { value: 'auto' as Choice, label: t('web_language_auto') },
    ...LANGS.map((l) => ({ value: l as Choice, label: autonym(l) })),
  ];
  return (
    <Card title={t('settings_language')}>
      <SelectField
        label={t('settings_language')}
        hideLabel
        value={stored()}
        options={options}
        onChange={(v) => {
          const next = v === 'auto' ? null : v;
          void setLang(next);
          void setLangPref(next);
        }}
      />
    </Card>
  );
}

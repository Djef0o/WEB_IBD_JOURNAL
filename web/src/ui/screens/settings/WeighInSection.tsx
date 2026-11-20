import './settings.css';
import { setWeighIn, weighInSignal } from '../../../db/prefs';
import { DEFAULT_WEIGH_IN_DAY } from '../../../domain/weighIn';
import { lang, t } from '../../../i18n';
import { Card, Switch } from '../../components';
import { SelectField } from '../../forms';

/** 2024-01-01 was a Monday: ISO day `n` falls on January `n`. */
function dayName(isoDay: number): string {
  const name = new Intl.DateTimeFormat(lang.value, { weekday: 'long' }).format(new Date(2024, 0, isoDay));
  return name.charAt(0).toLocaleUpperCase(lang.value) + name.slice(1);
}

/** Weekly weigh-in reminder: a switch, and the weekday once on (`WeighInSection` of SettingsScreen.kt). */
export function WeighInSection() {
  const settings = weighInSignal.value;
  const day = settings?.day ?? DEFAULT_WEIGH_IN_DAY;
  return (
    <Card title={t('weigh_in_title')}>
      <Switch
        label={t('weigh_in_switch')}
        description={t('weigh_in_switch_desc')}
        checked={settings?.enabled ?? false}
        disabled={!settings}
        onChange={(enabled) => void setWeighIn(enabled, day)}
      />
      {settings?.enabled && (
        <SelectField
          label={t('weigh_in_day')}
          value={String(day)}
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: dayName(n) }))}
          onChange={(value) => void setWeighIn(true, Number(value))}
        />
      )}
    </Card>
  );
}

// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n, setLang } from '../src/i18n';
import { formatCountdown } from '../src/ui/format';
import { formatReminderMoment } from '../src/ui/screens/settings/ReminderSection';

beforeAll(async () => {
  await setLang('en');
  await initI18n();
});

describe('last reminder moment', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 19, 0).getTime();

  it('says today, yesterday, or the date, like the Android settings', () => {
    expect(formatReminderMoment(at(2026, 3, 10), '2026-03-10')).toMatch(/^Today at /);
    expect(formatReminderMoment(at(2026, 3, 9), '2026-03-10')).toMatch(/^Yesterday at /);
    expect(formatReminderMoment(at(2026, 3, 1), '2026-03-10')).toMatch(/^March 1 at |^1 March at /);
  });
});

describe('lock countdown', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatCountdown(30)).toBe('0:30');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(3600)).toBe('60:00');
  });
});

import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { Button, EmptyState } from '../components';

export default function NotFound(_props: ScreenProps) {
  return (
    <EmptyState level={1} title={t('web_not_found_title')} description={t('web_not_found_text')}>
      <Button href="/">{t('nav_home')}</Button>
    </EmptyState>
  );
}

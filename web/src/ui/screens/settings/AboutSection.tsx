import './settings.css';
import { LICENSE_ID, SOURCE_URL } from '../../../config';
import { t } from '../../../i18n';
import { Button, Card } from '../../components';

/** Où vivent les données et ce qui sort du navigateur (équivalent de la section Confidentialité du README). */
export function PrivacySection() {
  return (
    <Card title={t('web_privacy_title')}>
      <p>{t('web_privacy_text')}</p>
    </Card>
  );
}

/** Avertissement médical et code source (AGPL-3.0 : le code servi doit être accessible). */
export function AboutSection() {
  return (
    <Card title={t('web_about_title')}>
      <div class="stack-sm">
        <h3>{t('web_medical_title')}</h3>
        <p>{t('web_medical_text')}</p>
      </div>
      <div class="stack-sm">
        <h3>{t('web_source_code')}</h3>
        <p class="text-muted">{t('web_source_code_desc')}</p>
        <div>
          <Button variant="outlined" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
            {t('web_source_code')} ({LICENSE_ID})
          </Button>
        </div>
      </div>
    </Card>
  );
}

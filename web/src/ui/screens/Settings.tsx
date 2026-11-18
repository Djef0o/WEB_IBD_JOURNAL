import { IcsExportSection } from '../../reminders/IcsExportSection';
import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { AboutSection, PrivacySection } from './settings/AboutSection';
import { AppearanceSection } from './settings/AppearanceSection';
import { BackupSection } from './settings/BackupSection';
import { InstallSection } from './settings/InstallSection';
import { LanguageSection } from './settings/LanguageSection';
import { ProfileSection } from './settings/ProfileSection';
import { ReminderSection } from './settings/ReminderSection';
import { SecuritySection } from './settings/SecuritySection';
import './settings/settings.css';

export default function Settings(_props: ScreenProps) {
  return (
    <>
      <h1 class="page-title">{t('settings')}</h1>
      <div class="settings-grid">
        <ProfileSection />
        <AppearanceSection />
        <LanguageSection />
        <ReminderSection />
        <SecuritySection />
        <BackupSection />
        <IcsExportSection />
        <InstallSection />
        <PrivacySection />
        <AboutSection />
      </div>
    </>
  );
}

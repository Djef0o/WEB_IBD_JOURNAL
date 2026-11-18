import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { ScannerPanel } from '../../scanner/ScannerPanel';

/** Scanner page: reads a barcode and shows the Open Food Facts product (nothing is saved). */
export default function Scan(_props: ScreenProps) {
  return (
    <div class="stack">
      <h1 class="page-title">{t('scan_title')}</h1>
      <ScannerPanel />
    </div>
  );
}

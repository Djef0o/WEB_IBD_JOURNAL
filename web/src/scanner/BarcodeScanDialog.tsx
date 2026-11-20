import type { Product } from '../domain/models';
import { t } from '../i18n';
import { Sheet } from '../ui/components';
import { ScannerPanel } from './ScannerPanel';

export interface BarcodeScanDialogProps {
  open: boolean;
  /** The user picked the scanned product, or the typed barcode alone when it is unknown. */
  onResult(product: Product): void;
  onClose(): void;
}

/**
 * Scanner in a modal sheet: shown above the meal editor, which is itself a dialog. The camera
 * only runs while the sheet is open (its content is unmounted on close). A tap outside does
 * not close it, so the meal draft is never lost by accident.
 */
export function BarcodeScanDialog({ open, onResult, onClose }: BarcodeScanDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={t('scan_title')} closeLabel={t('scan_close')} lightDismiss={false}>
      <ScannerPanel onUse={onResult} />
    </Sheet>
  );
}

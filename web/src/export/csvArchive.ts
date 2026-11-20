import { toCsvFiles } from '../domain/csvExport';
import type { BackupData } from '../domain/models';
import type { LocalDate } from '../domain/time';
import { zipAes } from './zipAes';

/** The CSV files of the journal in a password-protected AES-256 ZIP (`CsvExportManager.kt`). */
export async function exportCsvArchive(data: BackupData, password: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const files = [...toCsvFiles(data)].map(([name, content]) => ({ name, data: encoder.encode(content) }));
  return zipAes(files, password);
}

/** Default file name of the archive, as on Android (`ibd-journal-data-<date>.zip`). */
export function csvArchiveName(today: LocalDate): string {
  return `ibd-journal-data-${today}.zip`;
}

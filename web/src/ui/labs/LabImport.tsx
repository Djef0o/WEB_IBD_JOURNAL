import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { saveLabResult } from '../../db/labs';
import { labTestUnit, type LabResult } from '../../domain/health';
import { parseLabReport, type LabReportScan } from '../../domain/labReportParser';
import { toEpochDays, today, type LocalDate } from '../../domain/time';
import { createPdfReader } from '../../labimport/reader';
import {
  buildReviews, changeDate, duplicateOf, selection, updateDraft,
  type DocumentReview, type ImportedDocument,
} from '../../labimport/review';
import { t } from '../../i18n';
import { Button, Dialog, showToast } from '../components';
import { TextField } from '../forms';
import { focusFirstInvalid } from '../forms/focus';
import { displayRange, formatLabValue, labTestLabel, qualifierLabel, QUALIFIER_SYMBOL } from './labFormat';
import { parseLabValue } from './labValues';

interface Props {
  files: File[];
  /** Results already saved (duplicates are detected against them). */
  existing: readonly LabResult[];
  onClose(): void;
}

type Phase =
  | { kind: 'reading'; done: number }
  | { kind: 'review'; reviews: DocumentReview[] };

const EMPTY_SCAN: LabReportScan = { sampleDate: null, values: [] };

/**
 * Reading of the PDF reports in a worker, then mandatory review: nothing is saved without
 * validation.
 */
export function LabImport({ files, existing, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'reading', done: 0 });
  const existingRef = useRef(existing);
  existingRef.current = existing;

  useEffect(() => {
    let cancelled = false;
    const reader = createPdfReader();
    (async () => {
      const documents: ImportedDocument[] = [];
      for (let index = 0; index < files.length; index++) {
        if (cancelled) return;
        setPhase({ kind: 'reading', done: index });
        const file = files[index]!;
        try {
          const scan = parseLabReport(await reader.read(file));
          documents.push({ name: file.name || null, scan, failed: false });
        } catch {
          if (cancelled) return;
          documents.push({ name: file.name || null, scan: EMPTY_SCAN, failed: true });
        }
      }
      if (cancelled) return;
      reader.close();
      setPhase({ kind: 'review', reviews: buildReviews(documents, existingRef.current, today(), (v) => formatLabValue(v, false)) });
    })();
    return () => {
      cancelled = true;
      reader.close();
    };
  }, [files]);

  if (phase.kind === 'reading') {
    return <ReadingDialog done={phase.done} total={files.length} onCancel={onClose} />;
  }
  return <ReviewDialog initial={phase.reviews} existing={existing} onClose={onClose} />;
}

function ReadingDialog({ done, total, onCancel }: { done: number; total: number; onCancel(): void }) {
  const current = Math.min(done + 1, total);
  const label = t('lab_import_reading_progress', [current, total]);
  return (
    <Dialog open onClose={onCancel} title={label} closeLabel={t('cancel')} variant="center" lightDismiss={false}>
      <div class="stack-sm" role="status">
        <progress class="lab-import-progress" max={total} value={done} aria-label={label} />
        <p class="text-muted text-sm">{t('web_lab_import_privacy')}</p>
        <div class="dialog-actions">
          <Button variant="text" onClick={onCancel}>{t('cancel')}</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReviewDialog({ initial, existing, onClose }: { initial: DocumentReview[]; existing: readonly LabResult[]; onClose(): void }) {
  const [reviews, setReviews] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const chosen = useMemo(() => selection(reviews), [reviews]);
  const nothingFound = reviews.every((review) => review.drafts.length === 0);

  const save = async (event: Event) => {
    event.preventDefault();
    if (chosen.count === 0) return;
    if (!chosen.allValid) {
      setAttempted(true);
      focusFirstInvalid(event.currentTarget as HTMLFormElement);
      return;
    }
    await Promise.all(chosen.results.map((result) => saveLabResult(result)));
    showToast(t('web_lab_import_saved', [chosen.count]));
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={t('lab_import_title')} closeLabel={t('close')} lightDismiss={false}>
      <form class="lab-import" onSubmit={save} noValidate>
        <p class="text-muted">{nothingFound ? t('lab_import_all_nothing') : t('lab_import_check_reports')}</p>
        {reviews.map((review, index) => (
          <DocumentSection
            key={index}
            review={review}
            index={index}
            reviews={reviews}
            existing={existing}
            attempted={attempted}
            onDate={(date) => setReviews((current) => changeDate(current, index, date, existing))}
            onDraft={(position, change) => setReviews((current) => updateDraft(current, index, position, change))}
          />
        ))}
        <div class="lab-import-actions">
          {nothingFound ? (
            <>
              <span class="spacer" />
              <Button variant="text" onClick={onClose}>{t('close')}</Button>
            </>
          ) : (
            <>
              <Button variant="text" onClick={onClose}>{t('cancel')}</Button>
              <span class="spacer" />
              <button type="submit" class="btn" data-variant="filled" disabled={chosen.count === 0}>
                {t('lab_import_save', [chosen.count])}
              </button>
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
}

interface SectionProps {
  review: DocumentReview;
  index: number;
  reviews: readonly DocumentReview[];
  existing: readonly LabResult[];
  attempted: boolean;
  onDate(date: LocalDate): void;
  onDraft(position: number, change: { selected?: boolean; valueText?: string }): void;
}

/** File name then collection date, or the reason why nothing is proposed. */
function DocumentSection({ review, index, reviews, existing, attempted, onDate, onDraft }: SectionProps) {
  const { document } = review;
  const title = document.name ?? t('lab_import_document_untitled', [index + 1]);
  const dateOk = review.date !== '' && toEpochDays(review.date) <= toEpochDays(today());
  return (
    <section class="lab-doc">
      <h3>{title}</h3>
      {document.failed ? (
        <p class="text-error">{t('lab_import_document_failed')}</p>
      ) : review.drafts.length === 0 ? (
        <p class="text-muted">{t('lab_import_document_nothing')}</p>
      ) : (
        <>
          <TextField
            label={t('lab_result_date')}
            type="date"
            value={review.date}
            max={today()}
            required
            onInput={(date) => date && onDate(date)}
            error={dateOk ? null : t('web_lab_date_invalid')}
            showError
          />
          {document.scan.sampleDate === null && <p class="text-error text-sm">{t('lab_import_no_date')}</p>}
          <ul class="lab-drafts">
            {review.drafts.map((draft, position) => {
              const duplicate = duplicateOf(reviews, index, draft.detected.test, existing);
              const { test, qualifier, referenceLow, referenceHigh } = draft.detected;
              const unit = labTestUnit(test);
              const valueInvalid = draft.selected && parseLabValue(draft.valueText) === null;
              return (
                <li class="lab-draft" key={position}>
                  <label class="lab-check">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(e) => onDraft(position, { selected: e.currentTarget.checked })}
                    />
                    <span>{labTestLabel(test)}</span>
                  </label>
                  {duplicate && (
                    <p class="text-sm">
                      {duplicate === 'SAVED' ? t('lab_import_already_saved') : t('lab_import_duplicate_in_import')}
                    </p>
                  )}
                  <TextField
                    label={`${t('lab_result_value')} (${unit})`}
                    hint={qualifier === 'EXACT' ? undefined : `${QUALIFIER_SYMBOL[qualifier]} ${qualifierLabel(qualifier)}`}
                    value={draft.valueText}
                    onInput={(valueText) => onDraft(position, { valueText })}
                    inputMode="decimal"
                    autocomplete="off"
                    error={valueInvalid ? t('lab_result_value_invalid') : null}
                    showError={attempted}
                  />
                  {(referenceLow !== null || referenceHigh !== null) && (
                    <p class="text-sm">{t('lab_reference', [`${displayRange({ low: referenceLow, high: referenceHigh })} ${unit}`])}</p>
                  )}
                  {/* Line read from the report: enough to check at a glance. */}
                  <p class="lab-draft-source">{draft.detected.sourceText}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

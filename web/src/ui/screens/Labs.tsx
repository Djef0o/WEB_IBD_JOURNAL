import '../labs/labs.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLiveQuery } from '../../db';
import { deleteLabResult, getAllLabResults, saveLabResult } from '../../db/labs';
import type { LabResult, LabTest } from '../../domain/health';
import { t } from '../../i18n';
import type { ScreenProps } from '../../router';
import { Button, EmptyState, SegmentedControl, showToast } from '../components';
import { LabDetailSheet } from '../labs/LabDetailSheet';
import { LabEditorSheet, type LabEditing } from '../labs/LabEditorSheet';
import { LabImport } from '../labs/LabImport';
import { LabPanelTable } from '../labs/LabPanelTable';
import { LabTestList } from '../labs/LabTestList';
import { labHistories } from '../labs/labValues';

type View = 'byTest' | 'byDate';

/** Care sub-screen: all lab results (by test or by panel), manual entry and report import. */
export default function Labs(_props: ScreenProps) {
  const results = useLiveQuery(['lab_results'], getAllLabResults);
  const histories = useMemo(() => labHistories(results ?? []), [results]);
  const [view, setView] = useState<View>('byTest');
  const [detail, setDetail] = useState<LabTest | null>(null);
  const [editing, setEditing] = useState<LabEditing | null>(null);
  const [importFiles, setImportFiles] = useState<File[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The last result of a test deleted: its detail has nothing left to show.
  useEffect(() => {
    if (results !== undefined && detail !== null && !histories.has(detail)) setDetail(null);
  }, [histories, detail, results]);

  const firstTest: LabTest = histories.keys().next().value ?? 'CRP';
  const detailHistory = detail ? histories.get(detail) : undefined;

  const remove = async (result: LabResult) => {
    await deleteLabResult(result.id);
    showToast(t('web_lab_deleted'), {
      actionLabel: t('web_undo'),
      onAction: () => void saveLabResult(result),
    });
  };

  return (
    <div class="stack">
      <div>
        <a href="/care">{t('care_title')}</a>
        <h1 class="page-title">{t('lab_results_title')}</h1>
      </div>
      <div class="lab-toolbar">
        <Button onClick={() => setEditing({ result: null, test: firstTest })}>{t('lab_result_add')}</Button>
        <Button variant="outlined" onClick={() => fileInput.current?.click()}>{t('lab_import_reports_button')}</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = '';
            if (files.length > 0) setImportFiles(files);
          }}
        />
      </div>
      {results === undefined ? null : histories.size === 0 ? (
        <EmptyState title={t('lab_results_empty')} />
      ) : (
        <>
          <div class="lab-view">
            <SegmentedControl
              label={t('lab_results_title')}
              value={view}
              onChange={setView}
              options={[
                { value: 'byTest', label: t('lab_view_by_test') },
                { value: 'byDate', label: t('lab_view_by_date') },
              ]}
            />
          </div>
          {view === 'byTest' ? (
            <LabTestList histories={histories} onOpenTest={setDetail} />
          ) : (
            <LabPanelTable histories={histories} onEditResult={(result) => setEditing({ result, test: result.test })} />
          )}
        </>
      )}

      {/* The detail hides during entry to avoid stacking two sheets, then comes back. */}
      {detail && detailHistory && (
        <LabDetailSheet
          open={editing === null}
          test={detail}
          history={detailHistory}
          onClose={() => setDetail(null)}
          onAdd={() => setEditing({ result: null, test: detail })}
          onEdit={(result) => setEditing({ result, test: result.test })}
        />
      )}
      <LabEditorSheet
        editing={editing}
        onSave={(result) => void saveLabResult(result)}
        onDelete={(result) => void remove(result)}
        onClose={() => setEditing(null)}
      />
      {importFiles && <LabImport files={importFiles} existing={results ?? []} onClose={() => setImportFiles(null)} />}
    </div>
  );
}

import './vaccinations.css';
import { useId, useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { getAllVaccinations } from '../../../db/vaccinations';
import type { Vaccination, VaccineType } from '../../../domain/care';
import { isVaccineOverdue, vaccineGroups } from '../../../domain/vaccinations';
import { today as todayDate } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { useClock } from '../../../reminders/useClock';
import { Button, Card } from '../../components';
import { formatLocalDate } from '../../format';
import { ReminderIcon } from '../icons';
import { VaccinationEditor } from './VaccinationEditor';
import { VACCINE_TYPE_LABEL } from './vaccineLabels';

const common = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

function InfoIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 11v6M12 7.500v.5" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg {...common} aria-hidden="true" focusable="false">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Latest dose of a vaccine, its next due date (flagged once overdue) and, expanded, every dose (`VaccineGroup`). `doses`: newest first. */
function VaccineGroup({ type, doses, expanded, onToggle, onEdit }: {
  type: VaccineType;
  doses: readonly Vaccination[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: (dose: Vaccination) => void;
}) {
  const listId = useId();
  const latest = doses[0]!;
  const overdue = isVaccineOverdue(latest, todayDate());
  const name = VACCINE_TYPE_LABEL[type]();
  return (
    <li>
      <div class="vaccine-group">
        <button type="button" class="care-row" onClick={() => onEdit(latest)}>
          <span class="care-row-text">
            <span class="care-row-title">{name}</span>
            <span class="care-row-detail text-muted text-sm">{t('vaccine_last', [formatLocalDate(latest.date)])}</span>
            {latest.nextDue !== null && (
              <span class={`care-row-detail text-sm ${overdue ? 'text-error' : 'text-muted'}`}>
                {t(overdue ? 'vaccine_overdue' : 'vaccine_next', [formatLocalDate(latest.nextDue)])}
              </span>
            )}
            {latest.note.trim() !== '' && <span class="care-row-detail text-muted text-sm">{latest.note}</span>}
          </span>
          {(latest.reminderEnabled || doses.length >= 2) && (
            <span class="vaccine-trailing">
              {latest.reminderEnabled && <ReminderIcon enabled />}
              {doses.length >= 2 && <span class="vaccine-count">{tp('vaccine_doses', doses.length)}</span>}
            </span>
          )}
        </button>
        {doses.length >= 2 && (
          <button
            type="button"
            class="icon-btn vaccine-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={`${t(expanded ? 'vaccine_hide_doses' : 'vaccine_show_doses')}: ${name}`}
            onClick={onToggle}
          >
            <ExpandIcon />
          </button>
        )}
      </div>
      {expanded && (
        <ul class="care-list vaccine-doses" id={listId}>
          {doses.map((dose) => (
            <li key={dose.id}>
              <button type="button" class="care-row" onClick={() => onEdit(dose)}>
                <span class="care-row-text">
                  <span class="care-row-title">{formatLocalDate(dose.date)}</span>
                  {dose.note.trim() !== '' && <span class="care-row-detail text-muted text-sm">{dose.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Care section: one row per vaccine with its latest dose and next due date, expandable to every
 * dose, plus the editor sheet (`VaccinationsSection`).
 */
export function VaccinationsSection() {
  const vaccinations = useLiveQuery(['vaccinations'], getAllVaccinations);
  const [editing, setEditing] = useState<{ item: Vaccination | null } | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<VaccineType>>(new Set());
  // Overdue follows the day.
  useClock();
  const groups = vaccinations ? vaccineGroups(vaccinations) : [];

  const toggle = (type: VaccineType): void =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(type)) next.add(type);
      return next;
    });

  return (
    <Card title={t('vaccine_title')}>
      <p class="vaccine-notice">
        <InfoIcon />
        <span>{t('vaccine_live_notice')}</span>
      </p>
      {vaccinations && vaccinations.length === 0 && <p class="text-muted">{t('vaccine_empty')}</p>}
      {groups.length > 0 && (
        <ul class="care-list">
          {groups.map((doses) => {
            const type = doses[0]!.type;
            return (
              <VaccineGroup
                key={type}
                type={type}
                doses={doses}
                expanded={expanded.has(type)}
                onToggle={() => toggle(type)}
                onEdit={(dose) => setEditing({ item: dose })}
              />
            );
          })}
        </ul>
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('vaccine_add')}</Button>
      </div>
      {editing && <VaccinationEditor initial={editing.item} onClose={() => setEditing(null)} />}
    </Card>
  );
}

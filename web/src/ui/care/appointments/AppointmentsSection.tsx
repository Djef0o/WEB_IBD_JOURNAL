import './appointments.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { getAllAppointments } from '../../../db/followup';
import type { Appointment } from '../../../domain/care';
import { dateOf, dateTimeParts, localDateTimeAt } from '../../../domain/time';
import { t } from '../../../i18n';
import { dateTimeLabel } from '../../../reminders/text';
import { useClock } from '../../../reminders/useClock';
import { Button, Card } from '../../components';
import { formatLocalDate, formatTime } from '../../format';
import { ReminderIcon } from '../icons';
import { AppointmentEditor } from './AppointmentEditor';
import { APPOINTMENT_KIND_LABEL } from './appointmentLabels';

function byAt(a: Appointment, b: Appointment): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
}

/** Kind, date and time, place and note; a bell when reminders are on. A past appointment is muted. */
function AppointmentRow({ appointment, upcoming, onClick }: { appointment: Appointment; upcoming: boolean; onClick: () => void }) {
  const { hour, minute } = dateTimeParts(appointment.at);
  // The year only matters for appointments already behind us.
  const when = upcoming
    ? dateTimeLabel(appointment.at)
    : t('date_at', [formatLocalDate(dateOf(appointment.at), { day: 'numeric', month: 'long', year: 'numeric' }), formatTime(hour, minute)]);
  const lines = [appointment.place, appointment.note].filter((s) => s.trim() !== '');
  return (
    <li>
      <button type="button" class="care-row" data-muted={upcoming ? undefined : ''} onClick={onClick}>
        <span class="care-row-text">
          <span class="care-row-title">{APPOINTMENT_KIND_LABEL[appointment.kind]()}</span>
          <span class="care-row-detail text-sm">{when}</span>
          {lines.length > 0 && <span class="care-row-detail text-muted text-sm">{lines.join('\n')}</span>}
        </span>
        {upcoming && appointment.remindersEnabled && <ReminderIcon enabled />}
      </button>
    </li>
  );
}

/**
 * Care section: upcoming appointments (soonest first), then a collapsed group of past ones (most
 * recent first), plus the editor sheet (`AppointmentsSection`).
 */
export function AppointmentsSection() {
  const appointments = useLiveQuery(['appointments'], getAllAppointments);
  const now = localDateTimeAt(useClock());
  const [editing, setEditing] = useState<{ item: Appointment | null } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const upcoming = appointments?.filter((a) => a.at >= now).sort(byAt) ?? [];
  const past = appointments?.filter((a) => a.at < now).sort((a, b) => byAt(b, a)) ?? [];

  return (
    <Card title={t('appointmentui_title')}>
      {appointments && appointments.length === 0 && <p class="text-muted">{t('appointmentui_empty')}</p>}
      {(upcoming.length > 0 || past.length > 0) && (
        <ul class="care-list">
          {upcoming.map((a) => <AppointmentRow key={a.id} appointment={a} upcoming onClick={() => setEditing({ item: a })} />)}
          {past.length > 0 && (
            <li>
              <button
                type="button"
                class="appointment-past-toggle"
                aria-expanded={showPast}
                aria-label={`${t('appointmentui_past', [past.length])}: ${t(showPast ? 'appointmentui_hide_past' : 'appointmentui_show_past')}`}
                onClick={() => setShowPast(!showPast)}
              >
                <span>{t('appointmentui_past', [past.length])}</span>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </li>
          )}
          {showPast && past.map((a) => <AppointmentRow key={a.id} appointment={a} upcoming={false} onClick={() => setEditing({ item: a })} />)}
        </ul>
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('appointmentui_add')}</Button>
      </div>
      {editing && <AppointmentEditor initial={editing.item} onClose={() => setEditing(null)} />}
    </Card>
  );
}

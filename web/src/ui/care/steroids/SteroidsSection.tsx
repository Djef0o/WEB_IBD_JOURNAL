import './steroids.css';
import { useState } from 'preact/hooks';
import { useLiveQuery } from '../../../db';
import { getAllSteroidCourses } from '../../../db/steroids';
import type { SteroidCourse } from '../../../domain/care';
import {
  partitionSteroidCourses, steroidCumulativeMgThrough, steroidDoseOn, steroidEnd, steroidTotalDays, steroidTotalMg,
} from '../../../domain/steroids';
import { today as todayDate, type LocalDate } from '../../../domain/time';
import { t, tp } from '../../../i18n';
import { useClock } from '../../../reminders/useClock';
import { Button, Card } from '../../components';
import { formatLocalDate } from '../../format';
import { SteroidEditor } from './SteroidEditor';
import { formatMg } from './steroidFormat';

/** Course under way: today's dose, cumulative dose, planned end and total (`ActiveSteroidCard`). */
function ActiveCourse({ course, today, onClick }: { course: SteroidCourse; today: LocalDate; onClick: () => void }) {
  const days = steroidTotalDays(course);
  return (
    <li>
      <button type="button" class="steroid-active" onClick={onClick}>
        <span class="steroid-active-drug">{course.drug}</span>
        <span class="steroid-active-dose">{t('steroid_today_dose', [formatMg(steroidDoseOn(course, today) ?? 0)])}</span>
        <span class="text-sm">{t('steroid_cumulative', [formatMg(steroidCumulativeMgThrough(course, today))])}</span>
        <span class="text-sm">{t('steroid_planned_end', [formatLocalDate(steroidEnd(course))])}</span>
        <span class="text-sm">{tp('steroid_planned_total', days, [formatMg(steroidTotalMg(course)), days])}</span>
        {course.note.trim() !== '' && <span class="text-sm care-row-detail">{course.note}</span>}
      </button>
    </li>
  );
}

/** Finished or not yet started course: period and total dose (`SteroidRow`). */
function CourseRow({ course, upcoming, onClick }: { course: SteroidCourse; upcoming: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" class="care-row" onClick={onClick}>
        <span class="care-row-text">
          <span class="care-row-title">{course.drug}</span>
          <span class="care-row-detail text-muted text-sm">
            {t('steroid_row_summary', [
              formatLocalDate(course.start),
              formatLocalDate(steroidEnd(course)),
              formatMg(steroidTotalMg(course)),
            ])}
          </span>
          {upcoming && <span class="steroid-upcoming text-sm">{t('steroid_not_started')}</span>}
          {course.note.trim() !== '' && <span class="care-row-detail text-muted text-sm">{course.note}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * Care section: the course under way today as a card, then the other courses, plus the editor
 * sheet (`SteroidSection`).
 */
export function SteroidsSection() {
  const courses = useLiveQuery(['steroid_courses'], getAllSteroidCourses);
  const [editing, setEditing] = useState<{ item: SteroidCourse | null } | null>(null);
  // The clock re-renders the card when the day changes: today's dose follows.
  useClock();
  const today = todayDate();
  const { active, others } = partitionSteroidCourses(courses ?? [], today);

  return (
    <Card title={t('steroid_title')}>
      {courses && courses.length === 0 && <p class="text-muted">{t('steroid_empty')}</p>}
      {(active.length > 0 || others.length > 0) && (
        <ul class="care-list">
          {active.map((course) => (
            <ActiveCourse key={course.id} course={course} today={today} onClick={() => setEditing({ item: course })} />
          ))}
          {others.map((course) => (
            <CourseRow key={course.id} course={course} upcoming={course.start > today} onClick={() => setEditing({ item: course })} />
          ))}
        </ul>
      )}
      <div>
        <Button variant="tonal" onClick={() => setEditing({ item: null })}>{t('steroid_add')}</Button>
      </div>
      {editing && <SteroidEditor initial={editing.item} onClose={() => setEditing(null)} />}
    </Card>
  );
}

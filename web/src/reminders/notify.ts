import { signal } from '@preact/signals';
import { getAllCheckups } from '../db/checkups';
import { getAllExams } from '../db/exams';
import { getAllMedications } from '../db/medications';
import { getDailyCheckIn, getPrefs, isCheckInComplete, markReminderShown } from '../db/prefs';
import { watchQuery } from '../db/live';
import { atTime, dateOf, fromEpochDays, localDateTimeAt, toEpochDays, type LocalDate } from '../domain/time';
import { t } from '../i18n';
import { remindersBetween, type ReminderData } from './schedule';
import { reminderContent } from './text';

/*
 * Notifications while the app is open (tab or installed PWA). The web has no reliable
 * background alarm and no Web Push by design (an agenda must not go through a server): once
 * the app is closed, reminders only come from the `.ics` calendar export.
 *
 * Permission is requested on an explicit click (`requestNotificationPermission`), never on load.
 */

export type NotificationState = NotificationPermission | 'unsupported';

const supported = typeof Notification !== 'undefined';

/** Current permission; shared by Care and Settings. */
export const notificationPermission = signal<NotificationState>(supported ? Notification.permission : 'unsupported');

/** Asks the browser for permission. To be called from a click handler only. */
export async function requestNotificationPermission(): Promise<void> {
  if (!supported) return;
  notificationPermission.value = await Notification.requestPermission();
}

/** A reminder missed by more than this (sleeping laptop, frozen tab) is dropped: the day card shows it. */
const LATE_LIMIT_MS = 2 * 60 * 60 * 1000;
/** Reminders fall on whole minutes: checks run just after each minute change (and when the tab becomes visible again). */
const MINUTE_MS = 60_000;

/** App icon (PNG, precached by the service worker) shown with every notification. */
const NOTIFICATION_ICON = '/icons/app-192.png';

/** Shows a notification; through the service worker when there is one (the only way on Android). */
async function show(title: string, body: string, tag: string): Promise<void> {
  if (notificationPermission.peek() !== 'granted') return;
  const options: NotificationOptions = { body, tag, icon: NOTIFICATION_ICON };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      await markReminderShown().catch(() => undefined);
      return;
    }
  } catch {
    /* no usable service worker: fall back to the page API */
  }
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    await markReminderShown().catch(() => undefined);
  } catch {
    /* constructor refused (some mobile browsers): nothing more to try */
  }
}

interface Snapshot extends ReminderData {
  evening: { enabled: boolean; hour: number; minute: number };
}

async function load(): Promise<Snapshot> {
  const [medications, checkups, exams, prefs] = await Promise.all([
    getAllMedications(), getAllCheckups(), getAllExams(), getPrefs(),
  ]);
  return { medications, checkups, exams, evening: prefs.notifications };
}

/** Days (inclusive) touched by the window (after, until]. */
function daysOf(afterMs: number, untilMs: number): LocalDate[] {
  const first = toEpochDays(dateOf(localDateTimeAt(afterMs)));
  const last = toEpochDays(dateOf(localDateTimeAt(untilMs)));
  return Array.from({ length: last - first + 1 }, (_, i) => fromEpochDays(first + i));
}

/** Notifies what fell due in (afterMs, untilMs]. */
async function fire(snapshot: Snapshot, afterMs: number, untilMs: number): Promise<void> {
  const after = localDateTimeAt(afterMs);
  const until = localDateTimeAt(untilMs);
  for (const item of remindersBetween(snapshot, after, until)) {
    const { title, body } = reminderContent(item);
    await show(title, body, `${item.key}:${item.at}`);
  }
  const { evening } = snapshot;
  if (!evening.enabled) return;
  for (const day of daysOf(afterMs, untilMs)) {
    const at = atTime(day, evening.hour, evening.minute);
    if (at <= after || at > until) continue;
    // The evening notification only matters while the check-in is incomplete.
    if (isCheckInComplete(await getDailyCheckIn(toEpochDays(day)))) continue;
    await show(t('daily_reminder'), t('daily_reminder_desc'), `evening:${day}`);
  }
}

/**
 * Starts the notifier: reads the agenda, keeps it up to date with the database and fires
 * reminders as their time comes while the page lives. Returns the function that stops it.
 */
export function startReminderNotifier(): () => void {
  let snapshot: Snapshot | null = null;
  let last = Date.now();
  let timer: number | undefined;
  let stopped = false;

  const tick = async (): Promise<void> => {
    window.clearTimeout(timer);
    const now = Date.now();
    if (snapshot && notificationPermission.peek() === 'granted') {
      try {
        await fire(snapshot, Math.max(last, now - LATE_LIMIT_MS), now);
      } catch (error) {
        console.error(error);
      }
    }
    last = now;
    if (!stopped) timer = window.setTimeout(() => void tick(), MINUTE_MS - (Date.now() % MINUTE_MS) + 250);
  };

  const stopWatching = watchQuery(['medications', 'checkups', 'exams', 'prefs'], load, (value) => {
    snapshot = value;
  });
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  timer = window.setTimeout(() => void tick(), MINUTE_MS - (Date.now() % MINUTE_MS) + 250);

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
    stopWatching();
  };
}

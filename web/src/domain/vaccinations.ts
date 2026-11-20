import type { Vaccination } from './care';
import type { LocalDate } from './time';

/** Doses of a vaccine, most recent first; on equal dates, the last entered (`newestVaccinationFirst`). */
function newestFirst(a: Vaccination, b: Vaccination): number {
  return (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.id - a.id;
}

/**
 * One group per vaccine type, the vaccine with the most recent dose first; the doses of a
 * group most recent first, so `group[0]` is the latest dose (`VaccinationsSection`).
 */
export function vaccineGroups(vaccinations: readonly Vaccination[]): Vaccination[][] {
  const byType = new Map<string, Vaccination[]>();
  for (const v of vaccinations) {
    const doses = byType.get(v.type);
    if (doses) doses.push(v);
    else byType.set(v.type, [v]);
  }
  return [...byType.values()]
    .map((doses) => doses.sort(newestFirst))
    .sort((a, b) => (a[0]!.date < b[0]!.date ? 1 : a[0]!.date > b[0]!.date ? -1 : 0));
}

/** True once the next dose is overdue: planned before `today`. */
export function isVaccineOverdue(latest: Vaccination, today: LocalDate): boolean {
  return latest.nextDue !== null && latest.nextDue < today;
}

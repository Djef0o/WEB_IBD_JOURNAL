import { occurrencesBetween } from './adherence';
import type { Medication } from './profile';
import { daysUntil, plusDays, type LocalDate } from './time';

/*
 * Port of Travel.kt: medication to take along for a trip, with a safety margin.
 */

/** Extra days of treatment to take along, in case of delay: the default of the travel list. */
export const DEFAULT_TRAVEL_MARGIN_DAYS = 3;

/** Longest safety margin offered, in days (`MAX_TRAVEL_MARGIN_DAYS` of the travel screen). */
export const MAX_TRAVEL_MARGIN_DAYS = 30;

/**
 * What to take along for one treatment: `onTrip` scheduled intakes from departure to return (both
 * days included), `margin` more for the safety days after return. `total` and `missing`
 * (intakes not covered by the counted stock, null when the stock is not counted) are derived.
 */
export interface TravelLine {
  medication: Medication;
  onTrip: number;
  margin: number;
}

export function travelTotal(line: TravelLine): number {
  return line.onTrip + line.margin;
}

export function travelMissing(line: TravelLine): number | null {
  const stock = line.medication.stockDoses;
  return stock === null ? null : Math.max(travelTotal(line) - stock, 0);
}

/** Days of the trip, departure and return days included; at least 1. */
export function tripDays(departure: LocalDate, returnDate: LocalDate): number {
  return Math.max(daysUntil(departure, returnDate) + 1, 1);
}

/**
 * Intakes to take for every treatment that has some over the trip and the margin, by name. Intakes
 * follow each treatment's schedule, whether or not its reminder is on.
 */
export function travelPlan(
  medications: readonly Medication[],
  departure: LocalDate,
  returnDate: LocalDate,
  marginDays: number = DEFAULT_TRAVEL_MARGIN_DAYS,
): TravelLine[] {
  const marginStart = plusDays(returnDate, 1);
  const marginEnd = plusDays(returnDate, Math.max(marginDays, 0));
  return medications
    .map((medication): TravelLine => ({
      medication,
      onTrip: occurrencesBetween(medication.schedule, departure, returnDate).length,
      margin: occurrencesBetween(medication.schedule, marginStart, marginEnd).length,
    }))
    .filter((line) => travelTotal(line) > 0)
    .sort((a, b) => {
      const x = a.medication.name.toLowerCase();
      const y = b.medication.name.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
}

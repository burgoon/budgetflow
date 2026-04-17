import {
  addDays,
  addMonths,
  getDay,
  getDaysInMonth,
  getMonth,
  getYear,
  isAfter,
  isBefore,
  setDate,
  startOfDay,
} from "date-fns";
import { Recurrence } from "../types";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Generate the dates on which a recurrence fires inside a window.
 * All returned dates are normalized to startOfDay so downstream aggregation
 * by calendar day is trivial.
 *
 * - `startDate`: first eligible date for the schedule itself (not the window)
 * - `endDate`: optional last eligible date for the schedule
 * - `window`: projection window — occurrences outside this range are excluded
 */
export function occurrencesIn(
  recurrence: Recurrence,
  startDate: Date,
  endDate: Date | null,
  window: DateRange,
): Date[] {
  const lower = maxDate(startOfDay(startDate), startOfDay(window.start));
  const upper = minDate(startOfDay(endDate ?? window.end), startOfDay(window.end));
  if (isAfter(lower, upper)) return [];

  switch (recurrence.kind) {
    case "oneTime": {
      const day = startOfDay(startDate);
      return !isBefore(day, lower) && !isAfter(day, upper) ? [day] : [];
    }
    case "daily":
      return dailyOccurrences(lower, upper);
    case "weekly":
      return weeklyOccurrences(recurrence.weekday, lower, upper);
    case "semiMonthly":
      return semiMonthlyOccurrences(lower, upper);
    case "monthly":
      return monthlyOccurrences(recurrence.day, lower, upper);
    case "quarterly":
      return quarterlyOccurrences(recurrence.month, recurrence.day, lower, upper);
    case "annually":
      return annualOccurrences(recurrence.month, recurrence.day, lower, upper);
  }
}

function dailyOccurrences(lower: Date, upper: Date): Date[] {
  const result: Date[] = [];
  let current = lower;
  while (!isAfter(current, upper)) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
}

function weeklyOccurrences(weekday: number, lower: Date, upper: Date): Date[] {
  const result: Date[] = [];
  const currentWeekday = getDay(lower);
  const offset = (weekday - currentWeekday + 7) % 7;
  let current = addDays(lower, offset);
  while (!isAfter(current, upper)) {
    result.push(current);
    current = addDays(current, 7);
  }
  return result;
}

function semiMonthlyOccurrences(lower: Date, upper: Date): Date[] {
  const result: Date[] = [];
  let monthPointer = startOfDay(new Date(getYear(lower), getMonth(lower), 1));
  while (!isAfter(monthPointer, upper)) {
    for (const day of [1, 15]) {
      const candidate = setDate(monthPointer, day);
      if (!isBefore(candidate, lower) && !isAfter(candidate, upper)) {
        result.push(startOfDay(candidate));
      }
    }
    monthPointer = addMonths(monthPointer, 1);
  }
  return result;
}

function monthlyOccurrences(day: number, lower: Date, upper: Date): Date[] {
  const result: Date[] = [];
  let monthPointer = startOfDay(new Date(getYear(lower), getMonth(lower), 1));
  while (!isAfter(monthPointer, upper)) {
    const clamped = Math.min(day, getDaysInMonth(monthPointer));
    const candidate = setDate(monthPointer, clamped);
    if (!isBefore(candidate, lower) && !isAfter(candidate, upper)) {
      result.push(startOfDay(candidate));
    }
    monthPointer = addMonths(monthPointer, 1);
  }
  return result;
}

/**
 * Fires on `day` of `month`, then every 3 months. e.g. month=1, day=15 fires
 * Jan 15, Apr 15, Jul 15, Oct 15. The day clamps to month length so a quarterly
 * day=31 lands on the last day of any short month.
 */
function quarterlyOccurrences(
  month: number,
  day: number,
  lower: Date,
  upper: Date,
): Date[] {
  const result: Date[] = [];
  const startYear = getYear(lower);
  const endYear = getYear(upper);
  for (let year = startYear; year <= endYear; year++) {
    for (let offset = 0; offset < 12; offset += 3) {
      const m = ((month - 1 + offset) % 12) + 1;
      const monthStart = new Date(year, m - 1, 1);
      const clamped = Math.min(day, getDaysInMonth(monthStart));
      const candidate = new Date(year, m - 1, clamped);
      if (!isBefore(candidate, lower) && !isAfter(candidate, upper)) {
        result.push(startOfDay(candidate));
      }
    }
  }
  return result;
}

function annualOccurrences(month: number, day: number, lower: Date, upper: Date): Date[] {
  const result: Date[] = [];
  const startYear = getYear(lower);
  const endYear = getYear(upper);
  for (let year = startYear; year <= endYear; year++) {
    const monthStart = new Date(year, month - 1, 1);
    const clamped = Math.min(day, getDaysInMonth(monthStart));
    const candidate = new Date(year, month - 1, clamped);
    if (!isBefore(candidate, lower) && !isAfter(candidate, upper)) {
      result.push(startOfDay(candidate));
    }
  }
  return result;
}

function maxDate(a: Date, b: Date): Date {
  return isAfter(a, b) ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return isBefore(a, b) ? a : b;
}

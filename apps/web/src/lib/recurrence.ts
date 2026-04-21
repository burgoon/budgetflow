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
function quarterlyOccurrences(month: number, day: number, lower: Date, upper: Date): Date[] {
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

/**
 * The most recent firing of a recurrence on or before `today`. Used to seed
 * a sensible startDate when creating a new cash flow — otherwise a "monthly
 * on the 18th" added on the 20th has its first firing next month, silently
 * skipping the past one the user expected to see.
 *
 * For oneTime / daily, the concept doesn't really apply — return today.
 */
export function mostRecentFiring(recurrence: Recurrence, today: Date = new Date()): Date {
  const t = startOfDay(today);
  switch (recurrence.kind) {
    case "oneTime":
    case "daily":
      return t;
    case "weekly": {
      const offset = (getDay(t) - recurrence.weekday + 7) % 7;
      return addDays(t, -offset);
    }
    case "semiMonthly": {
      const day = t.getDate();
      if (day >= 15) return setDate(t, 15);
      return setDate(t, 1);
    }
    case "monthly": {
      const inThisMonth = setDate(t, Math.min(recurrence.day, getDaysInMonth(t)));
      if (!isAfter(inThisMonth, t)) return inThisMonth;
      const lastMonth = addMonths(t, -1);
      return setDate(lastMonth, Math.min(recurrence.day, getDaysInMonth(lastMonth)));
    }
    case "quarterly": {
      const anchorMonth = recurrence.month - 1;
      for (let back = 0; back < 12; back++) {
        const m = addMonths(t, -back);
        const monthIdx = m.getMonth();
        if ((monthIdx - anchorMonth + 12) % 3 !== 0) continue;
        const monthStart = new Date(m.getFullYear(), monthIdx, 1);
        const day = Math.min(recurrence.day, getDaysInMonth(monthStart));
        const fireDate = startOfDay(new Date(m.getFullYear(), monthIdx, day));
        if (!isAfter(fireDate, t)) return fireDate;
      }
      return t;
    }
    case "annually": {
      const monthIdx = recurrence.month - 1;
      const thisYearStart = new Date(t.getFullYear(), monthIdx, 1);
      const thisYearDay = Math.min(recurrence.day, getDaysInMonth(thisYearStart));
      const thisYear = startOfDay(new Date(t.getFullYear(), monthIdx, thisYearDay));
      if (!isAfter(thisYear, t)) return thisYear;
      const prevYearStart = new Date(t.getFullYear() - 1, monthIdx, 1);
      const prevYearDay = Math.min(recurrence.day, getDaysInMonth(prevYearStart));
      return startOfDay(new Date(t.getFullYear() - 1, monthIdx, prevYearDay));
    }
  }
}

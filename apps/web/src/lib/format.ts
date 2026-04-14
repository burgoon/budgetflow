const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const currencySigned = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "always",
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatCurrencySigned(value: number): string {
  return currencySigned.format(value);
}

import type { DateFormat } from "../types";

/** Format a Date into a string per the user's chosen format. */
export function formatDate(date: Date, format: DateFormat): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
  }
}

/**
 * Parse a user-typed date string according to the chosen format.
 * Accepts `/`, `-`, `.`, or whitespace as separators and 2-digit years (→ 2000s).
 * Returns null on any invalid input so callers can show validation feedback.
 */
export function parseDateString(input: string, format: DateFormat): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[/\-.\s]+/).filter(Boolean);
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  let year: number;
  let month: number;
  let day: number;
  switch (format) {
    case "MM/DD/YYYY":
      [month, day, year] = nums as [number, number, number];
      break;
    case "DD/MM/YYYY":
      [day, month, year] = nums as [number, number, number];
      break;
    case "YYYY-MM-DD":
      [year, month, day] = nums as [number, number, number];
      break;
  }
  if (year < 100) year += 2000;
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Convert a yyyy-mm-dd input value into a Date anchored at local midnight.
 * `new Date("2026-04-01")` would parse as UTC, which shifts in negative
 * timezones. We parse the parts manually to keep day semantics.
 */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

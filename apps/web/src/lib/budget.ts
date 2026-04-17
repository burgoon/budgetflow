import type { Transaction } from "../types";
import { parseDateInput } from "./format";
import { tagKey } from "./tags";

export interface BudgetActual {
  /** Normalized tag key (lowercased). */
  tag: string;
  /** Display-friendly tag name (original casing). */
  displayTag: string;
  /** Monthly target from profile.budgetTargets (0 if no target set). */
  target: number;
  /** Sum of expense transactions tagged with this key in the period. */
  spent: number;
  /** Number of transactions that contributed. */
  count: number;
}

/**
 * Compute actual spending per tag for a given month, comparing against the
 * profile's budget targets. Tags that appear in transactions but don't have
 * a target are included with `target: 0` so the dashboard can still show
 * them. Tags that have a target but zero transactions are also included
 * so the user sees "$0 of $600."
 */
export function computeBudgetActuals(
  transactions: Transaction[],
  budgetTargets: Record<string, number>,
  year: number,
  month: number,
): BudgetActual[] {
  // Filter to expense transactions in the target month.
  const monthTxns = transactions.filter((t) => {
    if (t.direction !== "expense") return false;
    const d = parseDateInput(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const map = new Map<string, BudgetActual>();

  // Seed with all budget targets so they show even at $0 spent.
  for (const [key, target] of Object.entries(budgetTargets)) {
    map.set(key, { tag: key, displayTag: key, target, spent: 0, count: 0 });
  }

  // Accumulate actual spending.
  for (const txn of monthTxns) {
    if (!txn.tags) continue;
    for (const rawTag of txn.tags) {
      const key = tagKey(rawTag);
      let entry = map.get(key);
      if (!entry) {
        entry = { tag: key, displayTag: rawTag, target: 0, spent: 0, count: 0 };
        map.set(key, entry);
      }
      entry.spent += txn.amount;
      entry.count += 1;
      // Preserve the nicest casing we see.
      if (entry.displayTag === key) entry.displayTag = rawTag;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.displayTag.localeCompare(b.displayTag, undefined, { sensitivity: "base" }),
  );
}

/**
 * How far through the month are we? Returns 0..1. Useful for "on pace"
 * indicators: if you've spent 60% of your budget by the 50% mark, you're
 * slightly ahead.
 */
export function monthProgress(year: number, month: number): number {
  const now = new Date();
  if (now.getFullYear() !== year || now.getMonth() !== month) {
    // Past or future month — show as 100% or 0%.
    const target = new Date(year, month, 1);
    return now > target ? 1 : 0;
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(now.getDate() / daysInMonth, 1);
}

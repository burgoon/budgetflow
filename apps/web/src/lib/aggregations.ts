import type { CashFlow, Recurrence } from "../types";
import { RECURRENCE_KIND_ORDER } from "../types";

/**
 * Convert a single cash flow's amount to its monthly-equivalent magnitude.
 * Lets us compare costs that fire on different cadences (a daily $5 coffee
 * vs. a quarterly $300 insurance bill — both become a per-month figure).
 *
 * One-time cash flows return 0; they don't have a meaningful monthly
 * equivalent and are excluded from the aggregate sections.
 */
export function monthlyEquivalent(cashFlow: CashFlow): number {
  return monthlyEquivalentFor(cashFlow.recurrence, cashFlow.amount);
}

export function monthlyEquivalentFor(recurrence: Recurrence, amount: number): number {
  switch (recurrence.kind) {
    case "oneTime":
      return 0;
    case "daily":
      // Average month length, not strictly accurate but close enough for budgeting.
      return amount * 30;
    case "weekly":
      return amount * (52 / 12);
    case "semiMonthly":
      return amount * 2;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    case "annually":
      return amount / 12;
  }
}

export interface RecurrenceGroup {
  kind: Recurrence["kind"];
  count: number;
  monthlyEquivalentTotal: number;
  /** Sum of `amount` as the user enters it — useful for "monthly" groups
   *  where the user thinks in literal monthly dollars. */
  rawAmountTotal: number;
}

export function groupByRecurrence(cashFlows: CashFlow[]): RecurrenceGroup[] {
  const groups = new Map<Recurrence["kind"], RecurrenceGroup>();
  for (const cf of cashFlows) {
    const kind = cf.recurrence.kind;
    let group = groups.get(kind);
    if (!group) {
      group = { kind, count: 0, monthlyEquivalentTotal: 0, rawAmountTotal: 0 };
      groups.set(kind, group);
    }
    group.count += 1;
    group.monthlyEquivalentTotal += monthlyEquivalent(cf);
    group.rawAmountTotal += cf.amount;
  }
  // Stable display order matches the recurrence picker.
  return RECURRENCE_KIND_ORDER.flatMap((kind) => {
    const group = groups.get(kind);
    return group ? [group] : [];
  });
}

export interface TagGroup {
  /** Display name — preserves original casing from the first occurrence. */
  tag: string;
  count: number;
  monthlyEquivalentTotal: number;
}

/**
 * Group cash flows by tag. Tags are normalized to lowercase for comparison
 * (so "Home" and "home" are the same group) but the display label keeps the
 * original casing of the first occurrence we see. Items with no tags are
 * skipped — the aggregate is opt-in.
 */
export function groupByTag(cashFlows: CashFlow[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const cf of cashFlows) {
    if (!cf.tags || cf.tags.length === 0) continue;
    const monthly = monthlyEquivalent(cf);
    for (const rawTag of cf.tags) {
      const tag = rawTag.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      let group = groups.get(key);
      if (!group) {
        group = { tag, count: 0, monthlyEquivalentTotal: 0 };
        groups.set(key, group);
      }
      group.count += 1;
      group.monthlyEquivalentTotal += monthly;
    }
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" }),
  );
}

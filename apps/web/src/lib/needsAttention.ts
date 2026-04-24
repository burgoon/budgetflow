import { addDays, startOfDay } from "date-fns";
import type { Account, CashFlow } from "../types";
import { eventsByDay, type DailyEvent } from "./projection";
import { parseDateInput } from "./format";

export interface NeedsAttentionItem {
  event: DailyEvent;
  /** The day the chip would render on — scheduled date for un-overridden
   *  events, actualDate for moved-but-not-paid events. */
  date: Date;
}

/**
 * Past scheduled occurrences that haven't reached a terminal decision yet.
 * "confirmed" and "canceled" overrides are settled; everything else (no
 * override, or "moved" without a follow-up confirmation) still needs attention.
 *
 * The window starts at the earliest account's `startingBalanceDate` because
 * older events are already baked into the running balance during replay —
 * surfacing them here would be duplicative and noisy.
 */
export function findNeedsAttention(
  accounts: Account[],
  cashFlows: CashFlow[],
  today: Date = new Date(),
): NeedsAttentionItem[] {
  if (accounts.length === 0) return [];
  const dayToday = startOfDay(today);

  let earliest = parseDateInput(accounts[0]!.startingBalanceDate);
  for (let i = 1; i < accounts.length; i++) {
    const d = parseDateInput(accounts[i]!.startingBalanceDate);
    if (d.getTime() < earliest.getTime()) earliest = d;
  }
  if (earliest.getTime() >= dayToday.getTime()) return [];

  const yesterday = addDays(dayToday, -1);
  // Inbox is for scheduled occurrences awaiting a decision — manual
  // transactions are already settled, so pass `[]` for transactions.
  const map = eventsByDay(cashFlows, [], { start: earliest, end: yesterday });

  const items: NeedsAttentionItem[] = [];
  for (const [ts, list] of map) {
    if (ts >= dayToday.getTime()) continue;
    for (const event of list) {
      const status = event.override?.status;
      if (status === "confirmed" || status === "canceled") continue;
      items.push({ event, date: new Date(ts) });
    }
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  return items;
}

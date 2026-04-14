import { addDays, isBefore, startOfDay } from "date-fns";
import {
  Account,
  AccountKind,
  CashFlow,
  CashFlowDirection,
  OccurrenceOverride,
} from "../types";
import { occurrencesIn } from "./recurrence";
import { parseDateInput, toDateInputValue } from "./format";

export interface BalancePoint {
  date: Date;
  balance: number;
}

export interface AccountSeries {
  accountId: string;
  accountName: string;
  kind: AccountKind;
  points: BalancePoint[];
}

/**
 * Project the balance of every account in the profile from `startDate` to
 * `endDate`. The resulting series uses step semantics: between two points the
 * balance is constant, then jumps on the next event day.
 *
 * Note: this assumes `account.startingBalance` is current as of `startDate`.
 * A future iteration can replay historical cash flows from
 * `startingBalanceDate` forward to `startDate`; for v1 we trust the user
 * to keep the starting balance fresh.
 */
export function projectAccounts(
  accounts: Account[],
  cashFlows: CashFlow[],
  startDate: Date,
  endDate: Date,
): AccountSeries[] {
  const dayStart = startOfDay(startDate);
  const dayEnd = startOfDay(endDate);
  if (isBefore(dayEnd, dayStart)) return [];

  return accounts.map((account) => projectAccount(account, cashFlows, dayStart, dayEnd));
}

function projectAccount(
  account: Account,
  cashFlows: CashFlow[],
  dayStart: Date,
  dayEnd: Date,
): AccountSeries {
  let balance = account.startingBalance;
  const points: BalancePoint[] = [{ date: dayStart, balance }];

  const events = cashFlows
    .filter((cf) => cf.accountId === account.id)
    .flatMap((cf) => {
      // yyyy-mm-dd strings parse as UTC with new Date(); parseDateInput keeps
      // them anchored to local midnight so day semantics line up.
      const start = parseDateInput(cf.startDate);
      const end = cf.endDate ? parseDateInput(cf.endDate) : null;
      const dates = occurrencesIn(cf.recurrence, start, end, {
        start: dayStart,
        end: dayEnd,
      });
      // Checking/savings: expenses subtract from the balance, income adds.
      // Credit cards: the stored balance is "amount owed", so expenses INCREASE
      // it (debt grows) and income (payments / refunds) DECREASES it. Net
      // worth is reconciled separately in netWorthAt by sign-flipping credit.
      const baseSigned = cf.amount * (cf.direction === "income" ? 1 : -1);
      const signed = account.kind === "credit" ? -baseSigned : baseSigned;

      const overrides = overridesByDate(cf);
      const result: { date: Date; delta: number }[] = [];
      for (const date of dates) {
        const override = overrides.get(toDateInputValue(date));
        if (!override) {
          result.push({ date, delta: signed });
          continue;
        }
        if (override.status === "moved" && override.actualDate) {
          const actual = parseDateInput(override.actualDate);
          // Only fire if the relocated date still falls inside the window.
          if (actual.getTime() >= dayStart.getTime() && actual.getTime() <= dayEnd.getTime()) {
            result.push({ date: actual, delta: signed });
          }
        }
        // "paid" and "canceled" are no-ops for balance math.
      }
      return result;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let index = 0;
  while (index < events.length) {
    const dayTs = events[index]!.date.getTime();
    let delta = 0;
    while (index < events.length && events[index]!.date.getTime() === dayTs) {
      delta += events[index]!.delta;
      index++;
    }
    balance += delta;
    points.push({ date: new Date(dayTs), balance });
  }

  const last = points[points.length - 1]!;
  if (isBefore(last.date, dayEnd)) {
    points.push({ date: dayEnd, balance });
  }

  return {
    accountId: account.id,
    accountName: account.name,
    kind: account.kind,
    points,
  };
}

/**
 * Balance of a single account at a UNIX ms timestamp. Points before the
 * first series entry (e.g. querying the day before the projection starts)
 * resolve to the series' starting balance.
 */
export function balanceAtTimestamp(series: AccountSeries, ts: number): number {
  let balance = series.points[0]?.balance ?? 0;
  for (const point of series.points) {
    if (point.date.getTime() <= ts) {
      balance = point.balance;
    } else {
      break;
    }
  }
  return balance;
}

/**
 * Net worth (sum of account balances, credit balances subtracted) at a UNIX ms.
 */
export function netWorthAt(series: AccountSeries[], ts: number): number {
  return series.reduce((sum, s) => {
    const balance = balanceAtTimestamp(s, ts);
    return sum + (s.kind === "credit" ? -balance : balance);
  }, 0);
}

/**
 * Convenience: net worth on a given Date.
 */
export function totalBalance(series: AccountSeries[], on: Date): number {
  return netWorthAt(series, on.getTime());
}

export interface DailyEvent {
  /** ID of the originating cash flow (not unique per occurrence). */
  id: string;
  name: string;
  amount: number;
  direction: CashFlowDirection;
  accountId: string | null;
  /** yyyy-mm-dd — the recurrence-derived scheduled date. Used as the key to
   *  match against `cashFlow.overrides`, so the UI knows which occurrence to
   *  toggle when a chip is tapped. */
  scheduledDate: string;
  /** The override that applies to this occurrence, if any. null = firing
   *  as scheduled. */
  override: OccurrenceOverride | null;
}

/** Index a cash flow's overrides by their scheduledDate for O(1) lookup. */
function overridesByDate(cashFlow: CashFlow): Map<string, OccurrenceOverride> {
  const map = new Map<string, OccurrenceOverride>();
  for (const override of cashFlow.overrides ?? []) {
    map.set(override.scheduledDate, override);
  }
  return map;
}

export interface DailyAccountBalance {
  accountId: string;
  accountName: string;
  kind: AccountKind;
  balance: number;
}

export interface DailyProjectionRow {
  date: Date;
  dayTs: number;
  starting: number;
  ending: number;
  accountEnds: DailyAccountBalance[];
  activity: DailyEvent[];
}

/**
 * Build a day-by-day projection table. Each row has net-worth start/end,
 * per-account end-of-day balances, and any cash-flow events that fired.
 * Shared by the UI table and the CSV exporter so they never drift.
 */
export function dailyProjection(
  series: AccountSeries[],
  events: Map<number, DailyEvent[]> | undefined,
  days: number,
  from: Date = new Date(),
): DailyProjectionRow[] {
  if (series.length === 0) return [];
  const today = startOfDay(from);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const dayTs = date.getTime();
    const entryTs = dayTs - 1;
    return {
      date,
      dayTs,
      starting: netWorthAt(series, entryTs),
      ending: netWorthAt(series, dayTs),
      accountEnds: series.map((s) => ({
        accountId: s.accountId,
        accountName: s.accountName,
        kind: s.kind,
        balance: balanceAtTimestamp(s, dayTs),
      })),
      activity: events?.get(dayTs) ?? [],
    };
  });
}

/**
 * Build a map keyed by startOfDay timestamp of every cash flow occurrence
 * inside the window. Used to render per-day "what fired today" chips in
 * the day-by-day table.
 *
 * Overrides are included:
 *   - "paid" / "canceled" occurrences appear on their scheduled date with
 *     their override attached — the chip renders struck-through and the
 *     engine ignores them for balance math.
 *   - "moved" occurrences appear on their actual date (and only if the
 *     actual date is inside the window); the scheduled date no longer
 *     shows the chip.
 */
export function eventsByDay(
  cashFlows: CashFlow[],
  window: { start: Date; end: Date },
): Map<number, DailyEvent[]> {
  const map = new Map<number, DailyEvent[]>();
  const windowStartTs = startOfDay(window.start).getTime();
  const windowEndTs = startOfDay(window.end).getTime();

  for (const cashFlow of cashFlows) {
    const start = parseDateInput(cashFlow.startDate);
    const end = cashFlow.endDate ? parseDateInput(cashFlow.endDate) : null;
    const dates = occurrencesIn(cashFlow.recurrence, start, end, window);
    const overrides = overridesByDate(cashFlow);

    for (const date of dates) {
      const scheduledDate = toDateInputValue(date);
      const override = overrides.get(scheduledDate) ?? null;

      let displayTs: number;
      if (override?.status === "moved" && override.actualDate) {
        const actualTs = parseDateInput(override.actualDate).getTime();
        if (actualTs < windowStartTs || actualTs > windowEndTs) {
          // Relocated outside the window — don't render anywhere.
          continue;
        }
        displayTs = actualTs;
      } else {
        displayTs = date.getTime();
      }

      let bucket = map.get(displayTs);
      if (!bucket) {
        bucket = [];
        map.set(displayTs, bucket);
      }
      bucket.push({
        id: cashFlow.id,
        name: cashFlow.name,
        amount: cashFlow.amount,
        direction: cashFlow.direction,
        accountId: cashFlow.accountId,
        scheduledDate,
        override,
      });
    }
  }
  return map;
}

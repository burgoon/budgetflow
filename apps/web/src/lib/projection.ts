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
    .filter((cf) => cashFlowTouchesAccount(cf, account.id))
    .flatMap((cf) => {
      const start = parseDateInput(cf.startDate);
      const end = cf.endDate ? parseDateInput(cf.endDate) : null;
      const dates = occurrencesIn(cf.recurrence, start, end, {
        start: dayStart,
        end: dayEnd,
      });

      // Compute the signed delta this cash flow produces on THIS account.
      //
      // Income / expense: straightforward sign with credit-flip.
      //
      // Transfers: the same cash flow touches two accounts. When we're the
      // SOURCE (fromAccountId) we lose money; when we're the DESTINATION
      // (toAccountId) we gain it. The credit-flip still applies so a
      // transfer TO a credit card correctly reduces the owed balance.
      const signed = transferSignedDelta(cf, account);

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
  /** The account this targets (income / expense). null when unassigned. */
  accountId: string | null;
  /** Source account for transfers. */
  fromAccountId?: string | null;
  /** Destination account for transfers. */
  toAccountId?: string | null;
  /** yyyy-mm-dd — the recurrence-derived scheduled date. Used as the key to
   *  match against `cashFlow.overrides`, so the UI knows which occurrence to
   *  toggle when a chip is tapped. */
  scheduledDate: string;
  /** The override that applies to this occurrence, if any. null = firing
   *  as scheduled. */
  override: OccurrenceOverride | null;
}

/** Does this cash flow affect the given account at all? */
function cashFlowTouchesAccount(cf: CashFlow, accountId: string): boolean {
  if (cf.direction === "transfer") {
    return cf.fromAccountId === accountId || cf.toAccountId === accountId;
  }
  return cf.accountId === accountId;
}

/**
 * Compute the signed delta this cash flow produces on a specific account.
 *
 * - Income / expense: base sign with credit-flip.
 * - Transfer SOURCE (fromAccountId): money leaves → expense-like sign.
 * - Transfer DEST (toAccountId): money arrives → income-like sign.
 *
 * The credit-flip ensures a transfer TO a credit card correctly reduces
 * the owed balance, and a transfer FROM a credit card (cash advance)
 * correctly increases it.
 */
function transferSignedDelta(cf: CashFlow, account: Account): number {
  let baseSigned: number;
  if (cf.direction === "transfer") {
    if (cf.fromAccountId === account.id) {
      baseSigned = -cf.amount; // money leaves — expense-like
    } else {
      baseSigned = cf.amount; // money arrives — income-like
    }
  } else {
    baseSigned = cf.amount * (cf.direction === "income" ? 1 : -1);
  }
  return account.kind === "credit" ? -baseSigned : baseSigned;
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
  /** Sum of income amounts that fired today (positive magnitude). Excludes
   *  paid/canceled overrides — only events that actually move balances. */
  incomeTotal: number;
  /** Sum of expense amounts that fired today (positive magnitude). */
  expenseTotal: number;
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
    const activity = events?.get(dayTs) ?? [];
    let incomeTotal = 0;
    let expenseTotal = 0;
    for (const event of activity) {
      // Paid / canceled overrides don't contribute to balance math, so they
      // shouldn't contribute to the day's income/expense totals either.
      // Transfers are net-zero — they move money between accounts without
      // creating or destroying it, so they don't count here.
      if (event.override?.status === "paid" || event.override?.status === "canceled") {
        continue;
      }
      if (event.direction === "transfer") continue;
      if (event.direction === "income") incomeTotal += event.amount;
      else expenseTotal += event.amount;
    }
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
      activity,
      incomeTotal,
      expenseTotal,
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
        fromAccountId: cashFlow.fromAccountId,
        toAccountId: cashFlow.toAccountId,
        scheduledDate,
        override,
      });
    }
  }
  return map;
}

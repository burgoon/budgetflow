import { addDays, isBefore, startOfDay } from "date-fns";
import { Account, AccountKind, CashFlow, CashFlowDirection } from "../types";
import { occurrencesIn } from "./recurrence";
import { parseDateInput } from "./format";

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
      return dates.map((date) => ({ date, delta: signed }));
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
  id: string;
  name: string;
  amount: number;
  direction: CashFlowDirection;
  accountId: string | null;
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
 * inside the window. Used to render per-day "what fired today" chips next
 * to the balance columns.
 */
export function eventsByDay(
  cashFlows: CashFlow[],
  window: { start: Date; end: Date },
): Map<number, DailyEvent[]> {
  const map = new Map<number, DailyEvent[]>();
  for (const cashFlow of cashFlows) {
    const start = parseDateInput(cashFlow.startDate);
    const end = cashFlow.endDate ? parseDateInput(cashFlow.endDate) : null;
    const dates = occurrencesIn(cashFlow.recurrence, start, end, window);
    for (const date of dates) {
      const key = date.getTime();
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push({
        id: cashFlow.id,
        name: cashFlow.name,
        amount: cashFlow.amount,
        direction: cashFlow.direction,
        accountId: cashFlow.accountId,
      });
    }
  }
  return map;
}

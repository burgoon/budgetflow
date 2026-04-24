import { addDays, isBefore, startOfDay } from "date-fns";
import {
  Account,
  AccountKind,
  CashFlow,
  CashFlowDirection,
  OccurrenceOverride,
  Transaction,
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
 * Each account's projection starts from `account.startingBalanceDate` (not
 * `startDate`). If the balance date is older than `startDate`, the engine
 * "replays" every scheduled event between the two dates so the balance at
 * `startDate` already reflects what's happened since the user last updated.
 * Overrides are honored during replay so confirmed amounts use the actual
 * value, canceled events are skipped, and moved events fire on the new date.
 *
 * Manual `Transaction` records (those without a `cashFlowId` linking them
 * back to a scheduled cashflow) are treated as one-off past events on their
 * `date`. Confirm-generated transactions ARE linked to a cashflow override
 * the engine already counts, so they're excluded to avoid double-counting.
 */
export function projectAccounts(
  accounts: Account[],
  cashFlows: CashFlow[],
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
): AccountSeries[] {
  const dayStart = startOfDay(startDate);
  const dayEnd = startOfDay(endDate);
  if (isBefore(dayEnd, dayStart)) return [];

  return accounts.map((account) =>
    projectAccount(account, cashFlows, transactions, dayStart, dayEnd),
  );
}

function projectAccount(
  account: Account,
  cashFlows: CashFlow[],
  transactions: Transaction[],
  dayStart: Date,
  dayEnd: Date,
): AccountSeries {
  let balance = account.startingBalance;

  // Widen the event window backward to the balance date so events that
  // fired between the last balance update and today are replayed.
  const balanceDate = startOfDay(parseDateInput(account.startingBalanceDate));
  const replayFrom = isBefore(balanceDate, dayStart) ? balanceDate : dayStart;

  const txnEvents = transactions
    .filter((t) => !t.cashFlowId && t.accountId === account.id)
    .map((t) => ({ date: parseDateInput(t.date), delta: signedDeltaForTransaction(t, account) }))
    .filter(
      (e) => e.date.getTime() >= replayFrom.getTime() && e.date.getTime() <= dayEnd.getTime(),
    );

  const events = cashFlows
    .filter((cf) => cashFlowTouchesAccount(cf, account.id))
    .flatMap((cf) => {
      const start = parseDateInput(cf.startDate);
      const end = cf.endDate ? parseDateInput(cf.endDate) : null;
      const dates = occurrencesIn(cf.recurrence, start, end, {
        start: replayFrom,
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
      const signed = signedDeltaFor(cf, account, cf.amount);

      const overrides = overridesByDate(cf);
      const result: { date: Date; delta: number }[] = [];
      for (const date of dates) {
        const override = overrides.get(toDateInputValue(date));
        if (!override) {
          result.push({ date, delta: signed });
          continue;
        }
        if (override.status === "confirmed") {
          // Engine counts it normally; if actualAmount differs, recompute
          // the signed delta with the real amount.
          const delta =
            override.actualAmount !== undefined
              ? signedDeltaFor(cf, account, override.actualAmount)
              : signed;
          result.push({ date, delta });
          continue;
        }
        if (override.status === "moved" && override.actualDate) {
          const actual = parseDateInput(override.actualDate);
          if (actual.getTime() >= replayFrom.getTime() && actual.getTime() <= dayEnd.getTime()) {
            result.push({ date: actual, delta: signed });
          }
        }
        // "canceled" is a no-op for balance math.
      }
      return result;
    })
    .concat(txnEvents)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Phase 1: replay past events (balanceDate → dayStart). These update the
  // running balance but don't produce visible points — the chart and table
  // only render from dayStart onward.
  const dayStartTs = dayStart.getTime();
  let index = 0;
  while (index < events.length && events[index]!.date.getTime() < dayStartTs) {
    const dayTs = events[index]!.date.getTime();
    let delta = 0;
    while (index < events.length && events[index]!.date.getTime() === dayTs) {
      delta += events[index]!.delta;
      index++;
    }
    balance += delta;
  }

  // First visible point — balance now reflects the replay.
  const points: BalancePoint[] = [{ date: dayStart, balance }];

  // Phase 2: future events (dayStart → dayEnd). Same logic as before.
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
  /** Discriminator:
   *   - "scheduled" — a cashflow occurrence (tappable, opens override menu).
   *   - "transaction" — a manually-logged Transaction with no `cashFlowId`
   *     link, rendered as a static chip. */
  kind: "scheduled" | "transaction";
  /** For "scheduled" events: the originating cash flow id (not unique per
   *  occurrence). For "transaction" events: the Transaction's id. */
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
  /** yyyy-mm-dd — the recurrence-derived scheduled date (for "scheduled")
   *  or the Transaction's date (for "transaction"). Used as the key to match
   *  against `cashFlow.overrides` for scheduled events. */
  scheduledDate: string;
  /** The override that applies to this occurrence, if any. null = firing
   *  as scheduled. Always null for transaction events. */
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
 * Compute the signed delta this cash flow produces on a specific account
 * for an arbitrary amount (defaults to the cash flow's scheduled amount).
 *
 * - Income / expense: base sign with credit-flip.
 * - Transfer SOURCE (fromAccountId): money leaves → expense-like sign.
 * - Transfer DEST (toAccountId): money arrives → income-like sign.
 *
 * The credit-flip ensures a transfer TO a credit card correctly reduces
 * the owed balance, and a transfer FROM a credit card (cash advance)
 * correctly increases it. Passing a per-occurrence actual amount lets
 * confirmed overrides post the real number instead of the schedule.
 */
/**
 * Signed delta a manual Transaction produces on its account. Mirrors
 * `signedDeltaFor` for the income/expense cases with the credit-flip.
 * Transfer transactions are treated as expenses on their `accountId` — the
 * Transaction type doesn't carry from/to so the other side can't be modeled.
 */
function signedDeltaForTransaction(t: Transaction, account: Account): number {
  const baseSigned = t.direction === "income" ? t.amount : -t.amount;
  return account.kind === "credit" ? -baseSigned : baseSigned;
}

function signedDeltaFor(cf: CashFlow, account: Account, amount: number): number {
  let baseSigned: number;
  if (cf.direction === "transfer") {
    if (cf.fromAccountId === account.id) {
      baseSigned = -amount; // money leaves — expense-like
    } else {
      baseSigned = amount; // money arrives — income-like
    }
  } else {
    baseSigned = amount * (cf.direction === "income" ? 1 : -1);
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
   *  canceled overrides and transfers — only events that actually move
   *  balances on this account-list. Confirmed events count, using
   *  `actualAmount` if set. */
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
      // Canceled overrides don't contribute to balance math, so they
      // shouldn't contribute to the day's income/expense totals either.
      // Transfers are net-zero — they move money between accounts without
      // creating or destroying it, so they don't count here.
      if (event.override?.status === "canceled") continue;
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
 * the Forecast → Table view.
 *
 * Overrides are included:
 *   - "confirmed" — appears on its scheduled date with the override attached.
 *     The chip's amount is `actualAmount` when present, otherwise `cf.amount`.
 *     The engine counts this in balance math.
 *   - "canceled" — appears on its scheduled date with the override attached.
 *     The chip renders struck-through; the engine skips it for balance math.
 *   - "moved" — appears on its `actualDate` (and only if the actual date is
 *     inside the window); the scheduled date no longer shows the chip.
 */
export function eventsByDay(
  cashFlows: CashFlow[],
  transactions: Transaction[],
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
      // For confirmed-with-actualAmount, the chip shows the real amount
      // so the table, CSV, and modal all reflect what posted, not what
      // was scheduled.
      const displayAmount =
        override?.status === "confirmed" && override.actualAmount !== undefined
          ? override.actualAmount
          : cashFlow.amount;

      bucket.push({
        kind: "scheduled",
        id: cashFlow.id,
        name: cashFlow.name,
        amount: displayAmount,
        direction: cashFlow.direction,
        accountId: cashFlow.accountId,
        fromAccountId: cashFlow.fromAccountId,
        toAccountId: cashFlow.toAccountId,
        scheduledDate,
        override,
      });
    }
  }

  // Manual transactions (no cashFlowId link) appear as their own chips on
  // their `date`. Confirm-generated transactions have a cashFlowId and are
  // already represented by the underlying scheduled occurrence's chip.
  for (const t of transactions) {
    if (t.cashFlowId) continue;
    const ts = parseDateInput(t.date).getTime();
    if (ts < windowStartTs || ts > windowEndTs) continue;
    let bucket = map.get(ts);
    if (!bucket) {
      bucket = [];
      map.set(ts, bucket);
    }
    bucket.push({
      kind: "transaction",
      id: t.id,
      name: t.name,
      amount: t.amount,
      direction: t.direction,
      accountId: t.accountId,
      scheduledDate: t.date,
      override: null,
    });
  }
  return map;
}

import type { Account, CashFlow } from "../types";
import { projectAccounts } from "./projection";

/**
 * Given an account's stored starting balance and the scheduled cash flows
 * since that date, compute what the engine expects the balance to be today.
 * The caller compares this with the user's entered "actual" balance to
 * detect untracked spending or income.
 *
 * Delegates to `projectAccounts` so override semantics (confirmed with
 * `actualAmount`, canceled, moved) match exactly what the Forecast shows —
 * otherwise the Reconcile modal's "expected" diverges from the projection
 * as the user works through the inbox.
 */
export function computeExpectedBalance(account: Account, cashFlows: CashFlow[]): number {
  const today = new Date();
  const series = projectAccounts([account], cashFlows, today, today);
  const points = series[0]?.points;
  return points?.[points.length - 1]?.balance ?? account.startingBalance;
}

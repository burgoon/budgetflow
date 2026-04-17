import type { Account, CashFlow } from "../types";
import { parseDateInput, toDateInputValue } from "./format";
import { occurrencesIn } from "./recurrence";

/**
 * Given an account's stored starting balance and the scheduled cash flows
 * since that date, compute what the engine expects the balance to be today.
 * The caller compares this with the user's entered "actual" balance to
 * detect untracked spending or income.
 */
export function computeExpectedBalance(account: Account, cashFlows: CashFlow[]): number {
  const today = new Date();
  const todayStr = toDateInputValue(today);
  if (account.startingBalanceDate === todayStr) return account.startingBalance;

  const balanceDate = parseDateInput(account.startingBalanceDate);
  if (balanceDate >= today) return account.startingBalance;

  let delta = 0;
  for (const cf of cashFlows) {
    if (cf.direction === "transfer") {
      const isFrom = cf.fromAccountId === account.id;
      const isTo = cf.toAccountId === account.id;
      if (!isFrom && !isTo) continue;
      const start = parseDateInput(cf.startDate);
      const end = cf.endDate ? parseDateInput(cf.endDate) : null;
      const dates = occurrencesIn(cf.recurrence, start, end, {
        start: balanceDate,
        end: today,
      });
      const sign = isFrom ? -1 : 1;
      const creditFlip = account.kind === "credit" ? -1 : 1;
      delta += dates.length * cf.amount * sign * creditFlip;
    } else if (cf.accountId === account.id) {
      const start = parseDateInput(cf.startDate);
      const end = cf.endDate ? parseDateInput(cf.endDate) : null;
      const dates = occurrencesIn(cf.recurrence, start, end, {
        start: balanceDate,
        end: today,
      });
      const baseSigned = cf.direction === "income" ? cf.amount : -cf.amount;
      const creditFlip = account.kind === "credit" ? -1 : 1;
      delta += dates.length * baseSigned * creditFlip;
    }
  }

  return account.startingBalance + delta;
}

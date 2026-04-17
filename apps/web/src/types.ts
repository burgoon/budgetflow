export type AccountKind = "checking" | "savings" | "credit";
export type CashFlowDirection = "income" | "expense" | "transfer";
export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

export const DATE_FORMATS: DateFormat[] = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
export const DEFAULT_DATE_FORMAT: DateFormat = "MM/DD/YYYY";

/**
 * All recurrence variants supported by BudgetFlow.
 * Weekdays follow the JS Date.getDay convention: 0=Sunday, 6=Saturday.
 * Months are 1-indexed (1=January) — the engine handles the Date constructor offset.
 *
 * `quarterly` fires on `day` of `month`, then every 3 months. e.g. month=1,
 * day=15 → Jan 15, Apr 15, Jul 15, Oct 15.
 */
export type Recurrence =
  | { kind: "oneTime" }
  | { kind: "daily" }
  | { kind: "weekly"; weekday: number }
  | { kind: "semiMonthly" }
  | { kind: "monthly"; day: number }
  | { kind: "quarterly"; month: number; day: number }
  | { kind: "annually"; month: number; day: number };

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  /** Preferred date display/entry format. Falls back to DEFAULT_DATE_FORMAT when missing. */
  dateFormat?: DateFormat;
}

export interface Account {
  id: string;
  profileId: string;
  name: string;
  kind: AccountKind;
  /**
   * Current balance as of `startingBalanceDate`. For credit accounts, store as a
   * positive number representing the amount owed; it is subtracted from net worth
   * by the projection engine.
   */
  startingBalance: number;
  startingBalanceDate: string;
  /** Free-form labels shared across accounts and cash flows. Stored as-typed;
   *  filtering / grouping compares case-insensitively. */
  tags?: string[];
}

/** Per-occurrence action on a scheduled cash flow. Lets the user override what
 *  a specific firing does without editing the underlying recurrence. */
export type OccurrenceOverrideStatus = "paid" | "canceled" | "moved";

export interface OccurrenceOverride {
  /** yyyy-mm-dd — the originally scheduled date this override applies to. */
  scheduledDate: string;
  status: OccurrenceOverrideStatus;
  /** yyyy-mm-dd — only populated when status === "moved". The date it
   *  actually posted (or is expected to). */
  actualDate?: string;
}

export interface CashFlow {
  id: string;
  profileId: string;
  accountId: string | null;
  name: string;
  /** Always stored positive; direction determines the sign at projection time. */
  amount: number;
  direction: CashFlowDirection;
  startDate: string;
  endDate: string | null;
  recurrence: Recurrence;
  /** Per-occurrence overrides. Absent = every firing uses the recurrence
   *  schedule as-is. Keyed inside the array by scheduledDate. */
  overrides?: OccurrenceOverride[];
  /** Free-form labels shared with accounts. Stored as-typed; filtering /
   *  grouping compares case-insensitively. */
  tags?: string[];
  /** Source account for transfers. null / absent for income and expense. */
  fromAccountId?: string | null;
  /** Destination account for transfers. null / absent for income and expense. */
  toAccountId?: string | null;
}

export interface AppData {
  version: 1;
  profiles: Profile[];
  accounts: Account[];
  cashFlows: CashFlow[];
  activeProfileId: string | null;
}

export const EMPTY_APP_DATA: AppData = {
  version: 1,
  profiles: [],
  accounts: [],
  cashFlows: [],
  activeProfileId: null,
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
};

export const RECURRENCE_KIND_LABEL: Record<Recurrence["kind"], string> = {
  oneTime: "One time",
  daily: "Daily",
  weekly: "Weekly",
  semiMonthly: "1st & 15th",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

/** Recurrence kinds in display order — used by aggregate sections + pickers. */
export const RECURRENCE_KIND_ORDER: Recurrence["kind"][] = [
  "oneTime",
  "daily",
  "weekly",
  "semiMonthly",
  "monthly",
  "quarterly",
  "annually",
];

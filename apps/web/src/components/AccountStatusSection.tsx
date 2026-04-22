import { useMemo, useState } from "react";
import { Banknote, Building2, CreditCard, RefreshCw } from "lucide-react";
import type { Account, AccountKind, Profile } from "../types";
import { ACCOUNT_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency, parseDateInput } from "../lib/format";
import { ReconcileModal } from "./ReconcileModal";

const KIND_ICON: Record<AccountKind, typeof Building2> = {
  checking: Building2,
  savings: Banknote,
  credit: CreditCard,
};

function daysAgo(dateStr: string): number {
  const date = parseDateInput(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function agoLabel(days: number): string {
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

/**
 * Dashboard summary of all accounts in a profile. Shows current balance,
 * freshness (color-coded "updated X days ago"), and a per-row Reconcile
 * button. The full add/edit/delete flow lives on the Setup tab.
 */
export function AccountStatusSection({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const [reconciling, setReconciling] = useState<Account | null>(null);

  const accounts = useMemo(
    () =>
      data.accounts
        .filter((a) => a.profileId === profile.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.accounts, profile.id],
  );

  if (accounts.length === 0) return null;

  return (
    <section className="page__section">
      <h3 className="page__subtitle">Accounts</h3>
      <ul className="card-list">
        {accounts.map((account) => {
          const Icon = KIND_ICON[account.kind];
          const days = daysAgo(account.startingBalanceDate);
          const isStale = days > 1;
          return (
            <li key={account.id}>
              <div className="card-row card-row--static">
                <span className="card-row__icon">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="card-row__body">
                  <span className="card-row__title">{account.name}</span>
                  <span className="card-row__subtitle">
                    {ACCOUNT_KIND_LABEL[account.kind]}
                    {" · "}
                    <span className={isStale ? "stale-label" : ""}>{agoLabel(days)}</span>
                  </span>
                </span>
                <span className="card-row__trail">
                  <span
                    className={`card-row__value mono ${account.startingBalance < 0 ? "negative" : ""}`}
                  >
                    {formatCurrency(account.startingBalance)}
                  </span>
                  <button
                    type="button"
                    className="reconcile-btn"
                    onClick={() => setReconciling(account)}
                    title="Reconcile this account"
                  >
                    <RefreshCw size={12} aria-hidden /> Reconcile
                  </button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {reconciling && (
        <ReconcileModal
          profile={profile}
          account={reconciling}
          onClose={() => setReconciling(null)}
        />
      )}
    </section>
  );
}

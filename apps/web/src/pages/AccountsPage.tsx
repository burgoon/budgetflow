import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, Building2, CreditCard, Plus } from "lucide-react";
import type { Account, AccountKind, Profile } from "../types";
import { ACCOUNT_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency, parseDateInput } from "../lib/format";
import { AccountEditor } from "../components/AccountEditor";

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

export function AccountsPage({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  const accounts = useMemo(
    () =>
      data.accounts
        .filter((account) => account.profileId === profile.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.accounts, profile.id],
  );

  const staleCount = useMemo(
    () => accounts.filter((a) => daysAgo(a.startingBalanceDate) > 1).length,
    [accounts],
  );

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Accounts</h2>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden /> New account
        </button>
      </div>

      {staleCount > 0 && (
        <div className="stale-banner">
          <AlertTriangle size={16} aria-hidden />
          <span>
            {staleCount === 1
              ? "1 account balance hasn't been updated recently."
              : `${staleCount} account balances haven't been updated recently.`}{" "}
            Projections replay scheduled events automatically, but updating your
            actual balances keeps things accurate.
          </span>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state">
          <Building2 size={40} aria-hidden />
          <h3>No accounts yet</h3>
          <p>Add a checking, savings, or credit card account to get started.</p>
        </div>
      ) : (
        <ul className="card-list">
          {accounts.map((account) => {
            const Icon = KIND_ICON[account.kind];
            const days = daysAgo(account.startingBalanceDate);
            const isStale = days > 1;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  className="card-row"
                  onClick={() => setEditing(account)}
                >
                  <span className="card-row__icon">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="card-row__body">
                    <span className="card-row__title">{account.name}</span>
                    <span className="card-row__subtitle">
                      {ACCOUNT_KIND_LABEL[account.kind]}
                      {" · "}
                      <span className={isStale ? "stale-label" : ""}>
                        {agoLabel(days)}
                      </span>
                    </span>
                    {account.tags && account.tags.length > 0 && (
                      <span className="card-row__tags">
                        {account.tags.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span
                    className={`card-row__value mono ${account.startingBalance < 0 ? "negative" : ""}`}
                  >
                    {formatCurrency(account.startingBalance)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <AccountEditor profile={profile} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <AccountEditor
          profile={profile}
          account={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Banknote, Building2, CreditCard, Plus } from "lucide-react";
import type { Account, AccountKind, Profile } from "../types";
import { ACCOUNT_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { AccountEditor } from "../components/AccountEditor";

const KIND_ICON: Record<AccountKind, typeof Building2> = {
  checking: Building2,
  savings: Banknote,
  credit: CreditCard,
};

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
                    </span>
                  </span>
                  <span className="card-row__value mono">
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

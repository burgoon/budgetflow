import { useMemo, useState } from "react";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { CashFlow, CashFlowDirection, Profile } from "../types";
import { RECURRENCE_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { CashFlowEditor } from "../components/CashFlowEditor";

interface Props {
  profile: Profile;
  direction: CashFlowDirection;
}

export function CashFlowsPage({ profile, direction }: Props) {
  const { data } = useApp();
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [creating, setCreating] = useState(false);

  const items = useMemo(
    () =>
      data.cashFlows
        .filter((cf) => cf.profileId === profile.id && cf.direction === direction)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.cashFlows, profile.id, direction],
  );

  const accountsById = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account])),
    [data.accounts],
  );

  const pageTitle = direction === "income" ? "Income" : "Expenses";
  const Icon = direction === "income" ? TrendingUp : TrendingDown;

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">{pageTitle}</h2>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden /> New {direction === "income" ? "income" : "expense"}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Icon size={40} aria-hidden />
          <h3>No {pageTitle.toLowerCase()} yet</h3>
          <p>
            Add recurring or one-time {pageTitle.toLowerCase()} to factor into your projection.
          </p>
        </div>
      ) : (
        <ul className="card-list">
          {items.map((cashFlow) => {
            const account = cashFlow.accountId ? accountsById.get(cashFlow.accountId) : null;
            const amountClass =
              direction === "income" ? "card-row__value mono positive" : "card-row__value mono negative";
            return (
              <li key={cashFlow.id}>
                <button
                  type="button"
                  className="card-row"
                  onClick={() => setEditing(cashFlow)}
                >
                  <span className="card-row__body">
                    <span className="card-row__title">{cashFlow.name}</span>
                    <span className="card-row__subtitle">
                      {RECURRENCE_KIND_LABEL[cashFlow.recurrence.kind]}
                      {" · "}
                      {account?.name ?? "No account"}
                    </span>
                  </span>
                  <span className={amountClass}>
                    {direction === "expense" ? "−" : "+"}
                    {formatCurrency(cashFlow.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <CashFlowEditor
          profile={profile}
          direction={direction}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <CashFlowEditor
          profile={profile}
          direction={direction}
          cashFlow={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

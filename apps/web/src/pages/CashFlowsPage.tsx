import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Repeat, Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { CashFlow, CashFlowDirection, Profile } from "../types";
import { RECURRENCE_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { collectAllTags, matchesTagFilter } from "../lib/tags";
import { groupByRecurrence, groupByTag } from "../lib/aggregations";
import { computeBudgetActuals } from "../lib/budget";
import { CashFlowEditor } from "../components/CashFlowEditor";
import { TagFilterBar } from "../components/TagFilterBar";

const DIRECTIONS: { value: CashFlowDirection; label: string }[] = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

export function CashFlowsPage({ profile }: { profile: Profile }) {
  const { data, activeProfile } = useApp();
  const budgetTargets = activeProfile?.budgetTargets ?? {};
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTagKeys, setActiveTagKeys] = useState<Set<string>>(() => new Set());
  const [direction, setDirection] = useState<CashFlowDirection>("income");

  const allItems = useMemo(
    () =>
      data.cashFlows
        .filter((cf) => cf.profileId === profile.id && cf.direction === direction)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.cashFlows, profile.id, direction],
  );

  const items = useMemo(
    () => allItems.filter((cf) => matchesTagFilter(cf.tags, activeTagKeys)),
    [allItems, activeTagKeys],
  );

  const accountsById = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account])),
    [data.accounts],
  );

  const profileAccounts = useMemo(
    () => data.accounts.filter((a) => a.profileId === profile.id),
    [data.accounts, profile.id],
  );

  const tagsInUse = useMemo(
    () => collectAllTags(profileAccounts, allItems),
    [profileAccounts, allItems],
  );

  // By recurrence reflects the active tag filter so the totals match the
  // visible list. By tag still uses the full set so it remains a complete
  // tag breakdown of all items in the active direction.
  const recurrenceGroups = useMemo(() => groupByRecurrence(items), [items]);
  const tagGroups = useMemo(() => groupByTag(allItems), [allItems]);

  const now = new Date();
  const budgetActuals = useMemo(() => {
    if (direction !== "expense") return [];
    const profileTxns = data.transactions.filter((t) => t.profileId === profile.id);
    return computeBudgetActuals(profileTxns, budgetTargets, now.getFullYear(), now.getMonth());
  }, [data.transactions, budgetTargets, profile.id, direction, now.getFullYear(), now.getMonth()]);

  function toggleTag(key: string) {
    setActiveTagKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isTransferView = direction === "transfer";
  const isIncome = direction === "income";
  const Icon = isTransferView ? ArrowRightLeft : isIncome ? TrendingUp : TrendingDown;
  const directionLabel = isTransferView ? "transfer" : isIncome ? "income" : "expense";
  const sectionLabel = isTransferView ? "transfers" : isIncome ? "income" : "expenses";
  const sign = isTransferView ? "" : isIncome ? "+" : "−";

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Cash flows</h2>
        <div className="page__header-actions">
          <div className="segmented segmented--compact" role="radiogroup" aria-label="Direction">
            {DIRECTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`segmented__option ${direction === opt.value ? "segmented__option--active" : ""}`}
                onClick={() => setDirection(opt.value)}
                aria-checked={direction === opt.value}
                role="radio"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} aria-hidden /> New {directionLabel}
          </button>
        </div>
      </div>

      {tagsInUse.length > 0 && (
        <TagFilterBar
          available={tagsInUse}
          active={activeTagKeys}
          onToggle={toggleTag}
          onClear={() => setActiveTagKeys(new Set())}
        />
      )}

      {allItems.length === 0 ? (
        <div className="empty-state">
          <Icon size={40} aria-hidden />
          <h3>No {sectionLabel} yet</h3>
          <p>Add recurring or one-time {sectionLabel} to factor into your projection.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Tag size={40} aria-hidden />
          <h3>No matches</h3>
          <p>No {directionLabel} items match the active tag filter.</p>
        </div>
      ) : (
        <ul className="card-list">
          {items.map((cashFlow) => {
            const account = cashFlow.accountId ? accountsById.get(cashFlow.accountId) : null;
            const amountClass =
              direction === "income"
                ? "card-row__value mono positive"
                : "card-row__value mono negative";
            return (
              <li key={cashFlow.id}>
                <button type="button" className="card-row" onClick={() => setEditing(cashFlow)}>
                  <span className="card-row__body">
                    <span className="card-row__title">{cashFlow.name}</span>
                    <span className="card-row__subtitle">
                      {RECURRENCE_KIND_LABEL[cashFlow.recurrence.kind]}
                      {" · "}
                      {isTransferView
                        ? transferLabel(cashFlow, accountsById)
                        : (account?.name ?? "No account")}
                    </span>
                    {cashFlow.tags && cashFlow.tags.length > 0 && (
                      <span className="card-row__tags">
                        {cashFlow.tags.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={amountClass}>
                    {sign}
                    {formatCurrency(cashFlow.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!isTransferView && recurrenceGroups.length > 0 && (
        <section className="page__section">
          <h3 className="page__subtitle">
            <Repeat size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> By recurrence
          </h3>
          <ul className="card-list">
            {recurrenceGroups.map((group) => (
              <li key={group.kind}>
                <div className="card-row card-row--static">
                  <span className="card-row__body">
                    <span className="card-row__title">{RECURRENCE_KIND_LABEL[group.kind]}</span>
                    <span className="card-row__subtitle">
                      {group.count} item{group.count === 1 ? "" : "s"}
                      {group.kind !== "oneTime" && (
                        <>
                          {" · "}
                          {sign}
                          {formatCurrency(group.monthlyEquivalentTotal)}/mo equivalent
                        </>
                      )}
                    </span>
                  </span>
                  <span
                    className={`card-row__value mono ${direction === "income" ? "positive" : "negative"}`}
                  >
                    {sign}
                    {formatCurrency(group.rawAmountTotal)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isTransferView && direction === "expense" && budgetActuals.length > 0 && (
        <section className="page__section">
          <h3 className="page__subtitle">
            <Tag size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Budget this month
          </h3>
          <ul className="card-list">
            {budgetActuals.map((ba) => {
              const pct = ba.target > 0 ? (ba.spent / ba.target) * 100 : null;
              const budgetTone =
                pct === null
                  ? ""
                  : pct <= 80
                    ? "budget-bar--ok"
                    : pct <= 100
                      ? "budget-bar--warn"
                      : "budget-bar--over";
              return (
                <li key={ba.tag}>
                  <div className="card-row card-row--static">
                    <span className="card-row__body">
                      <span className="card-row__title">{ba.displayTag}</span>
                      <span className="card-row__subtitle">
                        {ba.count} transaction{ba.count === 1 ? "" : "s"}
                        {ba.target > 0 && (
                          <>
                            {" · "}
                            {formatCurrency(ba.spent)} of {formatCurrency(ba.target)}
                          </>
                        )}
                      </span>
                      {ba.target > 0 && pct != null && (
                        <div className={`budget-bar ${budgetTone}`}>
                          <div
                            className="budget-bar__fill"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </span>
                    <span className="card-row__trail">
                      <span className="card-row__value mono negative">
                        −{formatCurrency(ba.spent)}
                      </span>
                      {ba.target > 0 && pct != null && (
                        <span className="card-row__pct">{Math.round(pct)}%</span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isTransferView &&
        (direction === "income" || budgetActuals.length === 0) &&
        tagGroups.length > 0 && (
          <section className="page__section">
            <h3 className="page__subtitle">
              <Tag size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> By tag (scheduled)
            </h3>
            <ul className="card-list">
              {tagGroups.map((group) => (
                <li key={group.tag}>
                  <div className="card-row card-row--static">
                    <span className="card-row__body">
                      <span className="card-row__title">{group.tag}</span>
                      <span className="card-row__subtitle">
                        {group.count} item{group.count === 1 ? "" : "s"} · monthly equivalent
                      </span>
                    </span>
                    <span
                      className={`card-row__value mono ${direction === "income" ? "positive" : "negative"}`}
                    >
                      {sign}
                      {formatCurrency(group.monthlyEquivalentTotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
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
          direction={editing.direction}
          cashFlow={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function transferLabel(cashFlow: CashFlow, accountsById: Map<string, { name: string }>): string {
  const from = cashFlow.fromAccountId ? accountsById.get(cashFlow.fromAccountId)?.name : null;
  const to = cashFlow.toAccountId ? accountsById.get(cashFlow.toAccountId)?.name : null;
  if (from && to) return `${from} → ${to}`;
  if (from) return `${from} → ?`;
  if (to) return `? → ${to}`;
  return "No accounts";
}

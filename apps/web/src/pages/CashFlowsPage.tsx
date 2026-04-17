import { useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Repeat, Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { CashFlow, CashFlowDirection, Profile } from "../types";
import { RECURRENCE_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { tagKey } from "../lib/tags";
import { collectAllTags, matchesTagFilter } from "../lib/tags";
import { groupByRecurrence, groupByTag } from "../lib/aggregations";
import { CashFlowEditor } from "../components/CashFlowEditor";
import { TagFilterBar } from "../components/TagFilterBar";

interface Props {
  profile: Profile;
  direction: CashFlowDirection;
}

export function CashFlowsPage({ profile, direction }: Props) {
  const { data, activeProfile } = useApp();
  const budgetTargets = activeProfile?.budgetTargets ?? {};
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTagKeys, setActiveTagKeys] = useState<Set<string>>(() => new Set());
  // Sub-view toggle for the Expenses tab — shows transfers alongside expenses.
  const [subView, setSubView] = useState<"items" | "transfers">("items");
  const showTransferToggle = direction === "expense";

  /** The actual direction used for filtering and creating: "transfer" when
   *  the user is on the Transfers sub-view, otherwise the page's direction. */
  const effectiveDirection: CashFlowDirection =
    showTransferToggle && subView === "transfers" ? "transfer" : direction;

  const allItems = useMemo(
    () =>
      data.cashFlows
        .filter((cf) => cf.profileId === profile.id && cf.direction === effectiveDirection)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.cashFlows, profile.id, effectiveDirection],
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

  // Suggestions / filter pills draw from this direction's items only — keeps
  // the filter bar focused. Suggestions in the editor pull from everything.
  const tagsInUse = useMemo(
    () => collectAllTags(profileAccounts, allItems),
    [profileAccounts, allItems],
  );

  // Aggregates always reflect the FULL list, not the filtered view — they're
  // about the underlying budget, not what's currently visible.
  const recurrenceGroups = useMemo(() => groupByRecurrence(allItems), [allItems]);
  const tagGroups = useMemo(() => groupByTag(allItems), [allItems]);

  function toggleTag(key: string) {
    setActiveTagKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isTransferView = effectiveDirection === "transfer";
  const pageTitle = direction === "income" ? "Income" : "Expenses";
  const Icon = isTransferView ? ArrowRightLeft : direction === "income" ? TrendingUp : TrendingDown;
  const directionLabel = isTransferView ? "transfer" : direction === "income" ? "income" : "expense";
  const sign = isTransferView ? "" : direction === "income" ? "+" : "−";

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">{pageTitle}</h2>
        <div className="page__header-actions">
          {showTransferToggle && (
            <div className="segmented segmented--compact">
              <button
                type="button"
                className={`segmented__option ${subView === "items" ? "segmented__option--active" : ""}`}
                onClick={() => setSubView("items")}
              >
                Expenses
              </button>
              <button
                type="button"
                className={`segmented__option ${subView === "transfers" ? "segmented__option--active" : ""}`}
                onClick={() => setSubView("transfers")}
              >
                Transfers
              </button>
            </div>
          )}
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
          <h3>No {pageTitle.toLowerCase()} yet</h3>
          <p>
            Add recurring or one-time {pageTitle.toLowerCase()} to factor into your projection.
          </p>
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
                      {isTransferView
                        ? transferLabel(cashFlow, accountsById)
                        : account?.name ?? "No account"}
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

      {/* Aggregate sections: skipped for transfers (they're net-zero so
          monthly-equivalent sums aren't meaningful). */}
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
                    <span className="card-row__title">
                      {RECURRENCE_KIND_LABEL[group.kind]}
                    </span>
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

      {!isTransferView && tagGroups.length > 0 && (
        <section className="page__section">
          <h3 className="page__subtitle">
            <Tag size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> By tag
          </h3>
          <ul className="card-list">
            {tagGroups.map((group) => {
              const key = tagKey(group.tag);
              const target = direction === "expense" ? budgetTargets[key] : undefined;
              const spent = group.monthlyEquivalentTotal;
              const pct = target ? (spent / target) * 100 : null;
              const budgetTone =
                pct === null
                  ? ""
                  : pct <= 80
                    ? "budget-bar--ok"
                    : pct <= 100
                      ? "budget-bar--warn"
                      : "budget-bar--over";
              return (
                <li key={group.tag}>
                  <div className="card-row card-row--static">
                    <span className="card-row__body">
                      <span className="card-row__title">{group.tag}</span>
                      <span className="card-row__subtitle">
                        {group.count} item{group.count === 1 ? "" : "s"}
                        {target != null && (
                          <>
                            {" · "}
                            {formatCurrency(spent)} of {formatCurrency(target)}/mo
                          </>
                        )}
                        {target == null && " · monthly equivalent"}
                      </span>
                      {target != null && pct != null && (
                        <div className={`budget-bar ${budgetTone}`}>
                          <div
                            className="budget-bar__fill"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </span>
                    <span
                      className={`card-row__value mono ${direction === "income" ? "positive" : "negative"}`}
                    >
                      {sign}
                      {formatCurrency(spent)}
                      {target != null && (
                        <span className="card-row__pct">
                          {Math.round(pct!)}%
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {creating && (
        <CashFlowEditor
          profile={profile}
          direction={effectiveDirection}
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

function transferLabel(
  cashFlow: CashFlow,
  accountsById: Map<string, { name: string }>,
): string {
  const from = cashFlow.fromAccountId ? accountsById.get(cashFlow.fromAccountId)?.name : null;
  const to = cashFlow.toAccountId ? accountsById.get(cashFlow.toAccountId)?.name : null;
  if (from && to) return `${from} → ${to}`;
  if (from) return `${from} → ?`;
  if (to) return `? → ${to}`;
  return "No accounts";
}

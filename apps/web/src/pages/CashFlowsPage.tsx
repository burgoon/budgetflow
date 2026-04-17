import { useMemo, useState } from "react";
import { Plus, Repeat, Tag, TrendingDown, TrendingUp } from "lucide-react";
import type { CashFlow, CashFlowDirection, Profile } from "../types";
import { RECURRENCE_KIND_LABEL } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { collectAllTags, matchesTagFilter } from "../lib/tags";
import { groupByRecurrence, groupByTag } from "../lib/aggregations";
import { CashFlowEditor } from "../components/CashFlowEditor";
import { TagFilterBar } from "../components/TagFilterBar";

interface Props {
  profile: Profile;
  direction: CashFlowDirection;
}

export function CashFlowsPage({ profile, direction }: Props) {
  const { data } = useApp();
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTagKeys, setActiveTagKeys] = useState<Set<string>>(() => new Set());

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

  const pageTitle = direction === "income" ? "Income" : "Expenses";
  const Icon = direction === "income" ? TrendingUp : TrendingDown;
  const directionLabel = direction === "income" ? "income" : "expense";
  const sign = direction === "income" ? "+" : "−";

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">{pageTitle}</h2>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden /> New {directionLabel}
        </button>
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
                      {account?.name ?? "No account"}
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

      {/* Aggregate sections: only show when there's something to aggregate.
          By recurrence groups everything; by tag is opt-in and skipped when
          no items have tags. */}
      {recurrenceGroups.length > 0 && (
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

      {tagGroups.length > 0 && (
        <section className="page__section">
          <h3 className="page__subtitle">
            <Tag size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> By tag
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
          direction={direction}
          cashFlow={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

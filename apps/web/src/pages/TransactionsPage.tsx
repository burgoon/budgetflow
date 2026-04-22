import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import type { Profile, Transaction } from "../types";
import { useApp, useDateFormat } from "../state";
import { formatCurrency, formatDate, parseDateInput } from "../lib/format";
import { collectAllTags, matchesTagFilter } from "../lib/tags";
import { TransactionEditor } from "../components/TransactionEditor";
import { TagFilterBar } from "../components/TagFilterBar";

export function TransactionsPage({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const dateFormat = useDateFormat();

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeTagKeys, setActiveTagKeys] = useState<Set<string>>(() => new Set());

  // Month navigation: [year, monthIndex]
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  function navigateMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const allProfileTxns = useMemo(
    () => data.transactions.filter((t) => t.profileId === profile.id),
    [data.transactions, profile.id],
  );

  // Transactions in the viewed month.
  const monthTxns = useMemo(
    () =>
      allProfileTxns
        .filter((t) => {
          const d = parseDateInput(t.date);
          return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
        })
        .sort((a, b) => b.date.localeCompare(a.date)), // newest first
    [allProfileTxns, viewYear, viewMonth],
  );

  const filtered = useMemo(
    () => monthTxns.filter((t) => matchesTagFilter(t.tags, activeTagKeys)),
    [monthTxns, activeTagKeys],
  );

  const tagsInUse = useMemo(() => {
    const accts = data.accounts.filter((a) => a.profileId === profile.id);
    return collectAllTags(accts, allProfileTxns);
  }, [data.accounts, allProfileTxns, profile.id]);

  const accountsById = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  // Totals reflect the active tag filter so they match the visible list.
  // With no filter, `filtered` === `monthTxns` content-wise.
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.direction === "income") income += t.amount;
      else if (t.direction === "expense") expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [filtered]);

  function toggleTag(key: string) {
    setActiveTagKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Ledger</h2>
        <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden /> New transaction
        </button>
      </div>

      {/* Month selector */}
      <div className="month-nav">
        <button
          type="button"
          className="icon-button"
          onClick={() => navigateMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span className="month-nav__label">{monthLabel}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => navigateMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight size={18} aria-hidden />
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

      {filtered.length === 0 ? (
        <div className="empty-state">
          <List size={40} aria-hidden />
          <h3>No transactions</h3>
          <p>
            {monthTxns.length > 0
              ? "No transactions match the active tag filter."
              : "No transactions logged for this month yet."}
          </p>
        </div>
      ) : (
        <ul className="card-list">
          {filtered.map((txn) => {
            const account = accountsById.get(txn.accountId);
            const isIncome = txn.direction === "income";
            const sign = isIncome ? "+" : txn.direction === "expense" ? "−" : "";
            const amountClass = isIncome
              ? "positive"
              : txn.direction === "expense"
                ? "negative"
                : "";
            return (
              <li key={txn.id}>
                <button type="button" className="card-row" onClick={() => setEditing(txn)}>
                  <span className="card-row__body">
                    <span className="card-row__title">{txn.name}</span>
                    <span className="card-row__subtitle">
                      {formatDate(parseDateInput(txn.date), dateFormat)}
                      {" · "}
                      {account?.name ?? "Unknown account"}
                    </span>
                    {txn.tags && txn.tags.length > 0 && (
                      <span className="card-row__tags">
                        {txn.tags.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={`card-row__value mono ${amountClass}`}>
                    {sign}
                    {formatCurrency(txn.amount)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Totals (respect active tag filter) */}
      {filtered.length > 0 && (
        <section className="page__section">
          <h3 className="page__subtitle">Month totals</h3>
          <div className="month-totals">
            <div className="month-totals__item">
              <span className="month-totals__label">Income</span>
              <span className="month-totals__value mono positive">
                +{formatCurrency(totals.income)}
              </span>
            </div>
            <div className="month-totals__item">
              <span className="month-totals__label">Expenses</span>
              <span className="month-totals__value mono negative">
                −{formatCurrency(totals.expense)}
              </span>
            </div>
            <div className="month-totals__item">
              <span className="month-totals__label">Net</span>
              <span
                className={`month-totals__value mono ${totals.net >= 0 ? "positive" : "negative"}`}
              >
                {totals.net >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(totals.net))}
              </span>
            </div>
          </div>
        </section>
      )}

      {creating && <TransactionEditor profile={profile} onClose={() => setCreating(false)} />}
      {editing && (
        <TransactionEditor
          profile={profile}
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

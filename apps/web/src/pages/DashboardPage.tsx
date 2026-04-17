import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import type { Profile } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { computeBudgetActuals, monthProgress } from "../lib/budget";

export function DashboardPage({ profile }: { profile: Profile }) {
  const { data, activeProfile } = useApp();
  const budgetTargets = activeProfile?.budgetTargets ?? {};

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

  const profileTxns = useMemo(
    () => data.transactions.filter((t) => t.profileId === profile.id),
    [data.transactions, profile.id],
  );

  const actuals = useMemo(
    () => computeBudgetActuals(profileTxns, budgetTargets, viewYear, viewMonth),
    [profileTxns, budgetTargets, viewYear, viewMonth],
  );

  const paceProgress = monthProgress(viewYear, viewMonth);
  const paceLabel = `${Math.round(paceProgress * 100)}% through the month`;

  // Overall totals for the month.
  const totals = useMemo(() => {
    let totalSpent = 0;
    let totalBudget = 0;
    for (const a of actuals) {
      totalSpent += a.spent;
      if (a.target > 0) totalBudget += a.target;
    }
    return { totalSpent, totalBudget };
  }, [actuals]);

  const hasTargets = Object.keys(budgetTargets).length > 0;

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Dashboard</h2>
      </div>

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

      {!hasTargets ? (
        <div className="empty-state">
          <LayoutDashboard size={40} aria-hidden />
          <h3>No budget targets set</h3>
          <p>
            Edit your profile to add monthly expense targets per tag, then log transactions in the
            Ledger. The dashboard shows actual vs. planned.
          </p>
        </div>
      ) : (
        <>
          {/* Overall summary card */}
          <section className="summary-card">
            <span className="summary-card__label">{paceLabel}</span>
            <span
              className={`summary-card__value mono ${
                totals.totalBudget > 0 && totals.totalSpent > totals.totalBudget ? "negative" : ""
              }`}
            >
              {formatCurrency(totals.totalSpent)}{" "}
              <span className="summary-card__of">of {formatCurrency(totals.totalBudget)}</span>
            </span>
            {totals.totalBudget > 0 && (
              <div className="budget-bar budget-bar--large">
                <div
                  className="budget-bar__fill"
                  style={{
                    width: `${Math.min((totals.totalSpent / totals.totalBudget) * 100, 100)}%`,
                    background:
                      totals.totalSpent / totals.totalBudget <= 0.8
                        ? "var(--success)"
                        : totals.totalSpent / totals.totalBudget <= 1
                          ? "#ff9f0a"
                          : "var(--danger)",
                  }}
                />
                {/* Pace marker */}
                <div
                  className="budget-bar__pace"
                  style={{ left: `${paceProgress * 100}%` }}
                  title={paceLabel}
                />
              </div>
            )}
          </section>

          {/* Per-tag breakdown */}
          <section className="page__section">
            <h3 className="page__subtitle">By category</h3>
            <ul className="card-list">
              {actuals.map((ba) => {
                const pct = ba.target > 0 ? (ba.spent / ba.target) * 100 : null;
                const onPace = pct !== null && paceProgress > 0 ? pct / 100 <= paceProgress : true;
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
                              {pct !== null && !onPace && " · ahead of pace"}
                            </>
                          )}
                          {ba.target === 0 && " · no target set"}
                        </span>
                        {ba.target > 0 && pct != null && (
                          <div className={`budget-bar ${budgetTone}`}>
                            <div
                              className="budget-bar__fill"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                            <div
                              className="budget-bar__pace"
                              style={{ left: `${paceProgress * 100}%` }}
                            />
                          </div>
                        )}
                      </span>
                      <span className="card-row__trail">
                        <span className="card-row__value mono negative">
                          {formatCurrency(ba.spent)}
                        </span>
                        {ba.target > 0 && (
                          <span
                            className={`card-row__delta mono ${
                              ba.spent <= ba.target ? "positive" : "negative"
                            }`}
                          >
                            {ba.spent <= ba.target
                              ? `${formatCurrency(ba.target - ba.spent)} left`
                              : `${formatCurrency(ba.spent - ba.target)} over`}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

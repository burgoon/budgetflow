import { useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import type { Profile } from "../types";
import { useApp } from "../state";
import { ForecastChart } from "../components/ForecastChart";
import { ForecastTable } from "../components/ForecastTable";

type View = "chart" | "table";

const VIEWS: { value: View; label: string }[] = [
  { value: "chart", label: "Chart" },
  { value: "table", label: "Table" },
];

/**
 * Unified forward-looking surface. The chart side shows balances over a
 * configurable horizon with toggleable per-account series; the table side
 * shows the next 365 days row-by-row with tappable activity chips. Both
 * read from the same projection engine.
 */
export function ForecastPage({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const [view, setView] = useState<View>("chart");

  const profileAccounts = useMemo(
    () => data.accounts.filter((a) => a.profileId === profile.id),
    [data.accounts, profile.id],
  );
  const hasAccounts = profileAccounts.length > 0;

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Forecast</h2>
        {hasAccounts && (
          <div
            className="segmented segmented--compact"
            role="radiogroup"
            aria-label="Forecast view"
          >
            {VIEWS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`segmented__option ${view === opt.value ? "segmented__option--active" : ""}`}
                onClick={() => setView(opt.value)}
                aria-checked={view === opt.value}
                role="radio"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!hasAccounts ? (
        <div className="empty-state">
          <LineChart size={40} aria-hidden />
          <h3>Nothing to forecast</h3>
          <p>Add at least one account to see your projection.</p>
        </div>
      ) : view === "chart" ? (
        <ForecastChart profile={profile} profileAccounts={profileAccounts} />
      ) : (
        <ForecastTable profile={profile} profileAccounts={profileAccounts} />
      )}
    </div>
  );
}

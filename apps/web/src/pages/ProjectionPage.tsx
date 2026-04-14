import { useMemo, useState } from "react";
import { addMonths, addYears } from "date-fns";
import { Banknote, Building2, CreditCard, LineChart } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccountKind, Profile } from "../types";
import { ACCOUNT_KIND_LABEL } from "../types";
import { useApp, useDateFormat } from "../state";
import {
  balanceAtTimestamp,
  projectAccounts,
  totalBalance,
  type AccountSeries,
} from "../lib/projection";
import { formatCurrency, formatCurrencySigned, formatDate } from "../lib/format";

type Horizon = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y";

const HORIZONS: Horizon[] = ["1M", "3M", "6M", "1Y", "2Y", "5Y"];

function horizonEndDate(horizon: Horizon): Date {
  const now = new Date();
  switch (horizon) {
    case "1M":
      return addMonths(now, 1);
    case "3M":
      return addMonths(now, 3);
    case "6M":
      return addMonths(now, 6);
    case "1Y":
      return addYears(now, 1);
    case "2Y":
      return addYears(now, 2);
    case "5Y":
      return addYears(now, 5);
  }
}

const KIND_ICON: Record<AccountKind, typeof Building2> = {
  checking: Building2,
  savings: Banknote,
  credit: CreditCard,
};

const SERIES_COLORS = [
  "#0a84ff",
  "#30d158",
  "#ff9f0a",
  "#bf5af2",
  "#ff375f",
  "#64d2ff",
  "#ffd60a",
];

const COMBINED_KEY = "__combined__";
const COMBINED_LABEL = "Net worth";
const COMBINED_COLOR = "#6b7280";

const COMPACT_CURRENCY = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

export function ProjectionPage({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const dateFormat = useDateFormat();
  const [horizon, setHorizon] = useState<Horizon>("6M");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const profileAccounts = useMemo(
    () => data.accounts.filter((account) => account.profileId === profile.id),
    [data.accounts, profile.id],
  );
  const profileCashFlows = useMemo(
    () => data.cashFlows.filter((cashFlow) => cashFlow.profileId === profile.id),
    [data.cashFlows, profile.id],
  );

  const chartSeries = useMemo<AccountSeries[]>(() => {
    const today = new Date();
    return projectAccounts(profileAccounts, profileCashFlows, today, horizonEndDate(horizon));
  }, [profileAccounts, profileCashFlows, horizon]);

  const endDate = horizonEndDate(horizon);
  const total = totalBalance(chartSeries, endDate);

  const accountColors = useMemo(() => {
    const map = new Map<string, string>();
    chartSeries.forEach((series, index) => {
      map.set(series.accountId, SERIES_COLORS[index % SERIES_COLORS.length]!);
    });
    return map;
  }, [chartSeries]);

  const chartData = useMemo(() => {
    const timestamps = Array.from(
      new Set(chartSeries.flatMap((s) => s.points.map((p) => p.date.getTime()))),
    ).sort((a, b) => a - b);
    return timestamps.map((ts) => {
      const row: Record<string, number | string> = {
        ts,
        label: formatDate(new Date(ts), dateFormat),
      };
      let combined = 0;
      for (const series of chartSeries) {
        const balance = balanceAtTimestamp(series, ts);
        row[accountDataKey(series.accountId)] = balance;
        combined += series.kind === "credit" ? -balance : balance;
      }
      row[COMBINED_KEY] = combined;
      return row;
    });
  }, [chartSeries, dateFormat]);

  function toggleKey(key: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const hasAccounts = profileAccounts.length > 0;

  return (
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Projection</h2>
        <div className="segmented segmented--compact">
          {HORIZONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented__option ${horizon === option ? "segmented__option--active" : ""}`}
              onClick={() => setHorizon(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {!hasAccounts ? (
        <div className="empty-state">
          <LineChart size={40} aria-hidden />
          <h3>Nothing to project</h3>
          <p>Add at least one account to see a projection.</p>
        </div>
      ) : (
        <>
          <section className="summary-card">
            <span className="summary-card__label">
              Projected net worth on {formatDate(endDate, dateFormat)}
            </span>
            <span className={`summary-card__value mono ${total >= 0 ? "" : "negative"}`}>
              {formatCurrency(total)}
            </span>
          </section>

          <section className="chart-card">
            <div className="series-toggles" role="group" aria-label="Chart series">
              <SeriesToggle
                label={COMBINED_LABEL}
                color={COMBINED_COLOR}
                active={!hiddenKeys.has(COMBINED_KEY)}
                dashed
                onToggle={() => toggleKey(COMBINED_KEY)}
              />
              {chartSeries.map((series) => {
                const key = accountDataKey(series.accountId);
                return (
                  <SeriesToggle
                    key={series.accountId}
                    label={series.accountName}
                    color={accountColors.get(series.accountId) ?? SERIES_COLORS[0]!}
                    active={!hiddenKeys.has(key)}
                    onToggle={() => toggleKey(key)}
                  />
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <RechartsLineChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  stroke="var(--border)"
                />
                <YAxis
                  tickFormatter={(value: number) => COMPACT_CURRENCY.format(value)}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                  stroke="var(--border)"
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                  }}
                />
                <Line
                  dataKey={COMBINED_KEY}
                  name={COMBINED_LABEL}
                  stroke={COMBINED_COLOR}
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  type="stepAfter"
                  dot={false}
                  isAnimationActive={false}
                  hide={hiddenKeys.has(COMBINED_KEY)}
                />
                {chartSeries.map((series) => {
                  const key = accountDataKey(series.accountId);
                  return (
                    <Line
                      key={series.accountId}
                      dataKey={key}
                      name={series.accountName}
                      stroke={accountColors.get(series.accountId) ?? SERIES_COLORS[0]!}
                      strokeWidth={2}
                      type="stepAfter"
                      dot={false}
                      isAnimationActive={false}
                      hide={hiddenKeys.has(key)}
                    />
                  );
                })}
              </RechartsLineChart>
            </ResponsiveContainer>
          </section>

          <section className="page__section">
            <h3 className="page__subtitle">Account balances</h3>
            <ul className="card-list">
              {chartSeries.map((series) => {
                const Icon = KIND_ICON[series.kind];
                const start = series.points[0]?.balance ?? 0;
                const end = series.points[series.points.length - 1]?.balance ?? 0;
                const delta = end - start;
                const color = accountColors.get(series.accountId) ?? SERIES_COLORS[0]!;
                return (
                  <li key={series.accountId}>
                    <div className="card-row card-row--static">
                      <span
                        className="card-row__icon"
                        style={{ color, background: `${color}1a` }}
                      >
                        <Icon size={20} aria-hidden />
                      </span>
                      <span className="card-row__body">
                        <span className="card-row__title">{series.accountName}</span>
                        <span className="card-row__subtitle">
                          {ACCOUNT_KIND_LABEL[series.kind]}
                        </span>
                      </span>
                      <span className="card-row__trail">
                        <span className="card-row__value mono">{formatCurrency(end)}</span>
                        <span
                          className={`card-row__delta mono ${delta >= 0 ? "positive" : "negative"}`}
                        >
                          {formatCurrencySigned(delta)}
                        </span>
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

function accountDataKey(accountId: string): string {
  return `acct:${accountId}`;
}

interface SeriesToggleProps {
  label: string;
  color: string;
  active: boolean;
  dashed?: boolean;
  onToggle: () => void;
}

function SeriesToggle({ label, color, active, dashed, onToggle }: SeriesToggleProps) {
  return (
    <button
      type="button"
      className={`series-toggle ${active ? "" : "series-toggle--inactive"}`}
      onClick={onToggle}
      aria-pressed={active}
    >
      <span
        className={`series-toggle__swatch ${dashed ? "series-toggle__swatch--dashed" : ""}`}
        style={
          dashed
            ? { borderColor: color, background: "transparent" }
            : { background: color, borderColor: color }
        }
        aria-hidden
      />
      <span>{label}</span>
    </button>
  );
}

import { useMemo } from "react";
import { startOfDay } from "date-fns";
import type { DailyEvent, DailyProjectionRow } from "../lib/projection";
import type { DateFormat } from "../types";
import { formatCurrency, formatDate, parseDateInput } from "../lib/format";
import { useDateFormat } from "../state";

export type TableView = "accounts" | "aggregate";

function overrideTooltip(event: DailyEvent, amountLabel: string, dateFormat: DateFormat): string {
  const override = event.override;
  if (!override) return amountLabel;
  const scheduled = formatDate(parseDateInput(event.scheduledDate), dateFormat);
  if (override.status === "confirmed") {
    return override.actualAmount !== undefined
      ? `${amountLabel} · Confirmed (scheduled ${scheduled}, actual differs)`
      : `${amountLabel} · Confirmed`;
  }
  if (override.status === "canceled") {
    return `${amountLabel} · Canceled (scheduled ${scheduled})`;
  }
  if (override.status === "moved" && override.actualDate) {
    return `${amountLabel} · Moved from ${scheduled}`;
  }
  return amountLabel;
}

/** Adds a `negative` class when the value is below zero so red coloring kicks in. */
function balanceClass(value: number): string {
  return `mono ${value < 0 ? "negative" : ""}`.trim();
}

interface Props {
  rows: DailyProjectionRow[];
  /** "accounts" shows one column per account; "aggregate" collapses to a
   *  single Income + Expenses pair. Defaults to "accounts" for back-compat. */
  view?: TableView;
  /** When provided, each activity chip becomes a button and invokes this on
   *  tap. Used to open the per-occurrence override menu. */
  onEventClick?: (event: DailyEvent) => void;
}

export function DailyProjectionTable({ rows, view = "accounts", onEventClick }: Props) {
  const dateFormat = useDateFormat();
  const todayTs = useMemo(() => startOfDay(new Date()).getTime(), []);

  if (rows.length === 0) return null;
  const accountColumns = rows[0]!.accountEnds;
  const isAggregate = view === "aggregate";

  return (
    <div className="projection-table-wrapper">
      <table className="projection-table">
        <thead>
          <tr>
            <th className="projection-table__date-col">Date</th>
            <th className="projection-table__activity-col">Activity</th>
            <th>Start</th>
            {isAggregate ? (
              <>
                <th>Income</th>
                <th>Expenses</th>
              </>
            ) : (
              accountColumns.map((column) => <th key={column.accountId}>{column.accountName}</th>)
            )}
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isToday = row.dayTs === todayTs;
            const changed = row.starting !== row.ending;
            const className = [
              isToday ? "projection-table__row--today" : "",
              changed ? "projection-table__row--changed" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={row.dayTs} className={className}>
                <td className="projection-table__date-col">
                  <span className="projection-table__date-primary">
                    {formatDate(row.date, dateFormat)}
                  </span>
                  <span className="projection-table__date-secondary">
                    {row.date.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                </td>
                <td className="projection-table__activity-col">
                  {row.activity.length === 0 ? (
                    <span className="projection-table__activity-empty">—</span>
                  ) : (
                    <div className="projection-table__chips">
                      {row.activity.map((event, index) => {
                        const overrideClass = event.override
                          ? ` chip--${event.override.status}`
                          : "";
                        const txnClass = event.kind === "transaction" ? " chip--txn" : "";
                        const amountPrefix = event.direction === "income" ? "+" : "−";
                        const amountLabel = `${amountPrefix}${formatCurrency(event.amount)}`;
                        const tooltip =
                          event.kind === "transaction"
                            ? `${amountLabel} · Logged transaction`
                            : overrideTooltip(event, amountLabel, dateFormat);
                        const key = `${event.kind}:${event.id}:${event.scheduledDate}:${index}`;
                        const chipClass = `chip chip--${event.direction}${overrideClass}${txnClass}`;
                        // Manual transactions can't be tapped through the
                        // override modal — they don't have a cashflow
                        // behind them. Render as a static chip.
                        if (onEventClick && event.kind === "scheduled") {
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`${chipClass} chip--interactive`}
                              title={tooltip}
                              onClick={() => onEventClick(event)}
                            >
                              {event.name}
                            </button>
                          );
                        }
                        return (
                          <span key={key} className={chipClass} title={tooltip}>
                            {event.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className={balanceClass(row.starting)}>{formatCurrency(row.starting)}</td>
                {isAggregate ? (
                  <>
                    <td className={`mono ${row.incomeTotal > 0 ? "positive" : "muted"}`}>
                      {row.incomeTotal > 0 ? `+${formatCurrency(row.incomeTotal)}` : "—"}
                    </td>
                    <td className={`mono ${row.expenseTotal > 0 ? "negative" : "muted"}`}>
                      {row.expenseTotal > 0 ? `−${formatCurrency(row.expenseTotal)}` : "—"}
                    </td>
                  </>
                ) : (
                  row.accountEnds.map((entry) => (
                    <td key={entry.accountId} className={balanceClass(entry.balance)}>
                      {formatCurrency(entry.balance)}
                    </td>
                  ))
                )}
                <td className={`${balanceClass(row.ending)} projection-table__end`}>
                  {formatCurrency(row.ending)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

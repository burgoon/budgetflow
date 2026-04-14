import { useMemo } from "react";
import { startOfDay } from "date-fns";
import type { DailyEvent, DailyProjectionRow } from "../lib/projection";
import type { DateFormat } from "../types";
import { formatCurrency, formatDate, parseDateInput } from "../lib/format";
import { useDateFormat } from "../state";

function overrideTooltip(
  event: DailyEvent,
  amountLabel: string,
  dateFormat: DateFormat,
): string {
  const override = event.override;
  if (!override) return amountLabel;
  const scheduled = formatDate(parseDateInput(event.scheduledDate), dateFormat);
  if (override.status === "paid") {
    return `${amountLabel} · Paid (scheduled ${scheduled})`;
  }
  if (override.status === "canceled") {
    return `${amountLabel} · Canceled (scheduled ${scheduled})`;
  }
  if (override.status === "moved" && override.actualDate) {
    return `${amountLabel} · Moved from ${scheduled}`;
  }
  return amountLabel;
}

interface Props {
  rows: DailyProjectionRow[];
  /** When provided, each activity chip becomes a button and invokes this on
   *  tap. Used to open the per-occurrence override menu. */
  onEventClick?: (event: DailyEvent) => void;
}

export function DailyProjectionTable({ rows, onEventClick }: Props) {
  const dateFormat = useDateFormat();
  const todayTs = useMemo(() => startOfDay(new Date()).getTime(), []);

  if (rows.length === 0) return null;
  const accountColumns = rows[0]!.accountEnds;

  return (
    <div className="projection-table-wrapper">
      <table className="projection-table">
        <thead>
          <tr>
            <th className="projection-table__date-col">Date</th>
            <th className="projection-table__activity-col">Activity</th>
            <th>Start</th>
            {accountColumns.map((column) => (
              <th key={column.accountId}>{column.accountName}</th>
            ))}
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
                        const amountPrefix = event.direction === "income" ? "+" : "−";
                        const amountLabel = `${amountPrefix}${formatCurrency(event.amount)}`;
                        const tooltip = overrideTooltip(event, amountLabel, dateFormat);
                        // Key by event.id + scheduledDate + index so multiple
                        // occurrences of the same cash flow on one day (e.g.
                        // moved + already-scheduled-same-day) are distinct.
                        const key = `${event.id}:${event.scheduledDate}:${index}`;
                        const className = `chip chip--${event.direction}${overrideClass}`;
                        if (onEventClick) {
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`${className} chip--interactive`}
                              title={tooltip}
                              onClick={() => onEventClick(event)}
                            >
                              {event.name}
                            </button>
                          );
                        }
                        return (
                          <span key={key} className={className} title={tooltip}>
                            {event.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="mono">{formatCurrency(row.starting)}</td>
                {row.accountEnds.map((entry) => (
                  <td key={entry.accountId} className="mono">
                    {formatCurrency(entry.balance)}
                  </td>
                ))}
                <td className="mono projection-table__end">{formatCurrency(row.ending)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

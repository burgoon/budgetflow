import { useMemo } from "react";
import { startOfDay } from "date-fns";
import type { DailyProjectionRow } from "../lib/projection";
import { formatCurrency, formatDate } from "../lib/format";
import { useDateFormat } from "../state";

interface Props {
  rows: DailyProjectionRow[];
}

export function DailyProjectionTable({ rows }: Props) {
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
                      {row.activity.map((event) => (
                        <span
                          key={event.id}
                          className={`chip chip--${event.direction}`}
                          title={`${event.direction === "income" ? "+" : "−"}${formatCurrency(event.amount)}`}
                        >
                          {event.name}
                        </span>
                      ))}
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

import { useMemo, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { Download } from "lucide-react";
import type { Account, Profile } from "../types";
import { useApp, useDateFormat } from "../state";
import {
  dailyProjection,
  eventsByDay,
  projectAccounts,
  type AccountSeries,
  type DailyEvent,
  type DailyProjectionRow,
} from "../lib/projection";
import { downloadCsv, toCsv } from "../lib/csv";
import { toDateInputValue } from "../lib/format";
import { DailyProjectionTable, type TableView } from "./DailyProjectionTable";
import { OccurrenceActionsModal } from "./OccurrenceActionsModal";

const PROJECTION_DAYS = 365;

interface Props {
  profile: Profile;
  profileAccounts: Account[];
}

export function ForecastTable({ profile, profileAccounts }: Props) {
  const { data } = useApp();
  const dateFormat = useDateFormat();
  const [selectedEvent, setSelectedEvent] = useState<DailyEvent | null>(null);
  const [view, setView] = useState<TableView>("accounts");

  const profileCashFlows = useMemo(
    () => data.cashFlows.filter((cashFlow) => cashFlow.profileId === profile.id),
    [data.cashFlows, profile.id],
  );
  const profileTransactions = useMemo(
    () => data.transactions.filter((t) => t.profileId === profile.id),
    [data.transactions, profile.id],
  );

  const series = useMemo<AccountSeries[]>(() => {
    const today = startOfDay(new Date());
    return projectAccounts(
      profileAccounts,
      profileCashFlows,
      profileTransactions,
      today,
      addDays(today, PROJECTION_DAYS - 1),
    );
  }, [profileAccounts, profileCashFlows, profileTransactions]);

  const events = useMemo<Map<number, DailyEvent[]>>(() => {
    const today = startOfDay(new Date());
    return eventsByDay(profileCashFlows, profileTransactions, {
      start: today,
      end: addDays(today, PROJECTION_DAYS - 1),
    });
  }, [profileCashFlows, profileTransactions]);

  const rows = useMemo<DailyProjectionRow[]>(
    () => dailyProjection(series, events, PROJECTION_DAYS),
    [series, events],
  );

  function handleExport() {
    if (rows.length === 0) return;
    const headerMid =
      view === "aggregate"
        ? ["Income", "Expenses"]
        : rows[0]!.accountEnds.map((a) => a.accountName);
    const header: Array<string | number> = [
      "Date",
      "Day",
      "Activity",
      "Starting balance",
      ...headerMid,
      "Ending balance",
    ];
    const body = rows.map((row) => {
      const activity = row.activity.map(formatEventForCsv).join("; ");
      const middle =
        view === "aggregate"
          ? [Number(row.incomeTotal.toFixed(2)), Number(row.expenseTotal.toFixed(2))]
          : row.accountEnds.map((entry) => Number(entry.balance.toFixed(2)));
      return [
        toDateInputValue(row.date),
        row.date.toLocaleDateString("en-US", { weekday: "long" }),
        activity,
        Number(row.starting.toFixed(2)),
        ...middle,
        Number(row.ending.toFixed(2)),
      ];
    });
    const csv = toCsv([header, ...body]);
    const filename = `budgetflow-forecast-${toDateInputValue(new Date())}.csv`;
    downloadCsv(filename, csv);
  }

  /**
   * Serialize a single activity chip for CSV. Mirrors the table's visual
   * treatment: active events show as name + signed amount; overridden
   * events get a bracketed status tag so confirmed / canceled / moved are
   * distinguishable in a spreadsheet.
   */
  function formatEventForCsv(event: DailyEvent): string {
    const sign = event.direction === "income" ? "+" : "-";
    const base = `${event.name} (${sign}${event.amount.toFixed(2)})`;
    if (event.kind === "transaction") return `${base} [logged]`;
    const override = event.override;
    if (!override) return base;
    switch (override.status) {
      case "confirmed":
        return override.actualAmount !== undefined
          ? `${base} [confirmed, actual differs from scheduled]`
          : `${base} [confirmed]`;
      case "canceled":
        return `${base} [canceled]`;
      case "moved":
        return `${base} [moved from ${event.scheduledDate}]`;
      default:
        return base;
    }
  }

  const canExport = rows.length > 0;

  return (
    <>
      <div className="forecast-toolbar">
        <div className="segmented segmented--compact" role="radiogroup" aria-label="Table view">
          <button
            type="button"
            className={`segmented__option ${view === "accounts" ? "segmented__option--active" : ""}`}
            onClick={() => setView("accounts")}
            aria-checked={view === "accounts"}
            role="radio"
          >
            Per account
          </button>
          <button
            type="button"
            className={`segmented__option ${view === "aggregate" ? "segmented__option--active" : ""}`}
            onClick={() => setView("aggregate")}
            aria-checked={view === "aggregate"}
            role="radio"
          >
            Aggregate
          </button>
        </div>
        {canExport && (
          <button type="button" className="button" onClick={handleExport}>
            <Download size={16} aria-hidden /> Export CSV
          </button>
        )}
      </div>

      <DailyProjectionTable rows={rows} view={view} onEventClick={setSelectedEvent} />

      {selectedEvent && (
        <OccurrenceActionsModal
          event={selectedEvent}
          dateFormat={dateFormat}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}

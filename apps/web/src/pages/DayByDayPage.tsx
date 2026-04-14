import { useMemo, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { CalendarDays, Download } from "lucide-react";
import type { Profile } from "../types";
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
import { DailyProjectionTable } from "../components/DailyProjectionTable";
import { OccurrenceActionsModal } from "../components/OccurrenceActionsModal";

const PROJECTION_DAYS = 365;

export function DayByDayPage({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const dateFormat = useDateFormat();
  const [selectedEvent, setSelectedEvent] = useState<DailyEvent | null>(null);

  const profileAccounts = useMemo(
    () => data.accounts.filter((account) => account.profileId === profile.id),
    [data.accounts, profile.id],
  );
  const profileCashFlows = useMemo(
    () => data.cashFlows.filter((cashFlow) => cashFlow.profileId === profile.id),
    [data.cashFlows, profile.id],
  );

  const series = useMemo<AccountSeries[]>(() => {
    const today = startOfDay(new Date());
    return projectAccounts(profileAccounts, profileCashFlows, today, addDays(today, PROJECTION_DAYS - 1));
  }, [profileAccounts, profileCashFlows]);

  const events = useMemo<Map<number, DailyEvent[]>>(() => {
    const today = startOfDay(new Date());
    return eventsByDay(profileCashFlows, { start: today, end: addDays(today, PROJECTION_DAYS - 1) });
  }, [profileCashFlows]);

  const rows = useMemo<DailyProjectionRow[]>(
    () => dailyProjection(series, events, PROJECTION_DAYS),
    [series, events],
  );

  function handleExport() {
    if (rows.length === 0) return;
    const accountHeaders = rows[0]!.accountEnds.map((a) => a.accountName);
    const header: Array<string | number> = [
      "Date",
      "Day",
      "Activity",
      "Starting balance",
      ...accountHeaders,
      "Ending balance",
    ];
    const body = rows.map((row) => {
      const activity = row.activity.map(formatEventForCsv).join("; ");
      return [
        toDateInputValue(row.date),
        row.date.toLocaleDateString("en-US", { weekday: "long" }),
        activity,
        Number(row.starting.toFixed(2)),
        ...row.accountEnds.map((entry) => Number(entry.balance.toFixed(2))),
        Number(row.ending.toFixed(2)),
      ];
    });
    const csv = toCsv([header, ...body]);
    const filename = `budgetflow-day-by-day-${toDateInputValue(new Date())}.csv`;
    downloadCsv(filename, csv);
  }

  /**
   * Serialize a single activity chip for CSV. Mirrors the table's visual
   * treatment: active events show as name + signed amount; overridden
   * events get a bracketed status tag so paid / canceled / moved are
   * distinguishable in a spreadsheet.
   */
  function formatEventForCsv(event: DailyEvent): string {
    const sign = event.direction === "income" ? "+" : "-";
    const base = `${event.name} (${sign}${event.amount.toFixed(2)})`;
    const override = event.override;
    if (!override) return base;
    switch (override.status) {
      case "paid":
        return `${base} [paid]`;
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
    <div className="page">
      <div className="page__header">
        <h2 className="page__title">Day-by-day</h2>
        {canExport && (
          <button type="button" className="button" onClick={handleExport}>
            <Download size={16} aria-hidden /> Export CSV
          </button>
        )}
      </div>

      {profileAccounts.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={40} aria-hidden />
          <h3>Nothing to project</h3>
          <p>Add at least one account to see a day-by-day breakdown.</p>
        </div>
      ) : (
        <DailyProjectionTable rows={rows} onEventClick={setSelectedEvent} />
      )}

      {selectedEvent && (
        <OccurrenceActionsModal
          event={selectedEvent}
          dateFormat={dateFormat}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

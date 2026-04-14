import { useState } from "react";
import { ArrowRightLeft, Ban, Check, Undo2 } from "lucide-react";
import type {
  CashFlow,
  DateFormat,
  OccurrenceOverride,
  OccurrenceOverrideStatus,
} from "../types";
import { useApp } from "../state";
import { formatCurrency, formatDate, parseDateInput } from "../lib/format";
import type { DailyEvent } from "../lib/projection";
import { Modal } from "./Modal";
import { DateInput } from "./DateInput";

interface Props {
  event: DailyEvent;
  dateFormat: DateFormat;
  onClose: () => void;
}

type Mode = "actions" | "move";

export function OccurrenceActionsModal({ event, dateFormat, onClose }: Props) {
  const { data, updateCashFlow } = useApp();
  const cashFlow = data.cashFlows.find((cf) => cf.id === event.id);

  const [mode, setMode] = useState<Mode>("actions");
  const initialMoveTo =
    event.override?.status === "moved" && event.override.actualDate
      ? event.override.actualDate
      : event.scheduledDate;
  const [moveTo, setMoveTo] = useState(initialMoveTo);

  if (!cashFlow) {
    // Cash flow was deleted while the modal was open — just bail.
    return null;
  }

  function applyOverride(next: OccurrenceOverride | null) {
    if (!cashFlow) return;
    const kept = (cashFlow.overrides ?? []).filter(
      (o) => o.scheduledDate !== event.scheduledDate,
    );
    const updated = next ? [...kept, next] : kept;
    updateCashFlow(cashFlow.id, {
      overrides: updated.length > 0 ? updated : undefined,
    });
    onClose();
  }

  function markAs(status: OccurrenceOverrideStatus) {
    applyOverride({ scheduledDate: event.scheduledDate, status });
  }

  function applyMove() {
    applyOverride({
      scheduledDate: event.scheduledDate,
      status: "moved",
      actualDate: moveTo,
    });
  }

  const scheduledDate = parseDateInput(event.scheduledDate);
  const currentStatus = event.override?.status;
  const movedTo =
    event.override?.status === "moved" && event.override.actualDate
      ? parseDateInput(event.override.actualDate)
      : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={event.name}
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="occurrence-actions">
        <OccurrenceSummary
          event={event}
          cashFlow={cashFlow}
          scheduledDate={scheduledDate}
          movedTo={movedTo}
          currentStatus={currentStatus}
          dateFormat={dateFormat}
        />

        {mode === "actions" ? (
          <div className="occurrence-actions__list">
            <ActionRow
              icon={<Check size={18} aria-hidden />}
              label="Mark as paid"
              hint="Engine skips this. Use when the charge already posted and you've updated your balance."
              active={currentStatus === "paid"}
              tone="success"
              onClick={() => markAs("paid")}
            />
            <ActionRow
              icon={<ArrowRightLeft size={18} aria-hidden />}
              label="Move to another date…"
              hint="Keeps the amount but fires on a different day (earlier or later than scheduled)."
              active={currentStatus === "moved"}
              tone="info"
              onClick={() => setMode("move")}
            />
            <ActionRow
              icon={<Ban size={18} aria-hidden />}
              label="Cancel this occurrence"
              hint="Engine skips this. Use when a scheduled charge didn't happen and won't."
              active={currentStatus === "canceled"}
              tone="danger"
              onClick={() => markAs("canceled")}
            />
            {event.override && (
              <ActionRow
                icon={<Undo2 size={18} aria-hidden />}
                label="Reset to schedule"
                hint="Remove the override — fire on the original scheduled date."
                tone="neutral"
                onClick={() => applyOverride(null)}
              />
            )}
          </div>
        ) : (
          <div className="occurrence-move">
            <label className="field">
              <span className="field__label">New date</span>
              <DateInput value={moveTo} onChange={setMoveTo} format={dateFormat} />
            </label>
            <div className="occurrence-move__actions">
              <button
                type="button"
                className="button"
                onClick={() => setMode("actions")}
              >
                Back
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={applyMove}
                disabled={!moveTo}
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface SummaryProps {
  event: DailyEvent;
  cashFlow: CashFlow;
  scheduledDate: Date;
  movedTo: Date | null;
  currentStatus: OccurrenceOverrideStatus | undefined;
  dateFormat: DateFormat;
}

function OccurrenceSummary({
  event,
  scheduledDate,
  movedTo,
  currentStatus,
  dateFormat,
}: SummaryProps) {
  const sign = event.direction === "income" ? "+" : "−";
  const amountClass = event.direction === "income" ? "positive" : "negative";
  return (
    <div className="occurrence-actions__summary">
      <div className="occurrence-actions__amount">
        <span className={`mono ${amountClass}`}>
          {sign}
          {formatCurrency(event.amount)}
        </span>
        <span className="occurrence-actions__dir">{event.direction}</span>
      </div>
      <dl className="occurrence-actions__meta">
        <div>
          <dt>Scheduled</dt>
          <dd>{formatDate(scheduledDate, dateFormat)}</dd>
        </div>
        {currentStatus && (
          <div>
            <dt>Status</dt>
            <dd>
              {currentStatus === "paid" && "Paid / processed"}
              {currentStatus === "canceled" && "Canceled"}
              {currentStatus === "moved" &&
                (movedTo ? `Moved to ${formatDate(movedTo, dateFormat)}` : "Moved")}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  tone: "success" | "danger" | "info" | "neutral";
  onClick: () => void;
}

function ActionRow({ icon, label, hint, active, tone, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      className={`occurrence-action occurrence-action--${tone} ${
        active ? "occurrence-action--active" : ""
      }`}
      onClick={onClick}
    >
      <span className="occurrence-action__icon">{icon}</span>
      <span className="occurrence-action__body">
        <span className="occurrence-action__label">
          {label}
          {active && <span className="occurrence-action__badge">Active</span>}
        </span>
        {hint && <span className="occurrence-action__hint">{hint}</span>}
      </span>
    </button>
  );
}

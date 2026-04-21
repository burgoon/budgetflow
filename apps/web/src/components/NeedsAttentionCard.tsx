import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { Profile } from "../types";
import { useApp, useDateFormat } from "../state";
import { findNeedsAttention } from "../lib/needsAttention";
import { formatCurrency, formatDate } from "../lib/format";
import type { DailyEvent } from "../lib/projection";
import { OccurrenceActionsModal } from "./OccurrenceActionsModal";

export function NeedsAttentionCard({ profile }: { profile: Profile }) {
  const { data } = useApp();
  const dateFormat = useDateFormat();
  const [selected, setSelected] = useState<DailyEvent | null>(null);

  const items = useMemo(() => {
    const profileAccounts = data.accounts.filter((a) => a.profileId === profile.id);
    const profileCashFlows = data.cashFlows.filter((c) => c.profileId === profile.id);
    return findNeedsAttention(profileAccounts, profileCashFlows);
  }, [data.accounts, data.cashFlows, profile.id]);

  if (items.length === 0) return null;

  return (
    <section className="needs-attention">
      <header className="needs-attention__header">
        <span className="needs-attention__icon" aria-hidden>
          <AlertCircle size={18} />
        </span>
        <h3 className="needs-attention__title">
          {items.length} item{items.length === 1 ? "" : "s"} need attention
        </h3>
      </header>
      <p className="needs-attention__hint">
        Each one was scheduled to post but hasn't been confirmed yet. Tap to mark paid, move to the
        actual date, or cancel — your projection updates from there.
      </p>
      <ul className="needs-attention__list">
        {items.map((item) => {
          const sign = item.event.direction === "income" ? "+" : "−";
          const amountClass = item.event.direction === "income" ? "positive" : "negative";
          const moved = item.event.override?.status === "moved";
          return (
            <li key={`${item.event.id}-${item.event.scheduledDate}`}>
              <button
                type="button"
                className="needs-attention__item"
                onClick={() => setSelected(item.event)}
              >
                <span className="needs-attention__date">{formatDate(item.date, dateFormat)}</span>
                <span className="needs-attention__name">
                  {item.event.name}
                  {moved && <span className="needs-attention__badge">moved</span>}
                </span>
                <span className={`needs-attention__amount mono ${amountClass}`}>
                  {sign}
                  {formatCurrency(item.event.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <OccurrenceActionsModal
          event={selected}
          dateFormat={dateFormat}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { Account, Profile } from "../types";
import { useApp, useDateFormat } from "../state";
import { formatCurrency, formatDate, parseDateInput, toDateInputValue } from "../lib/format";
import { computeExpectedBalance } from "../lib/reconciliation";
import { findNeedsAttention } from "../lib/needsAttention";
import type { DailyEvent } from "../lib/projection";
import { Modal } from "./Modal";
import { TransactionEditor } from "./TransactionEditor";

interface Props {
  profile: Profile;
  account: Account;
  onClose: () => void;
}

function eventTouchesAccount(event: DailyEvent, accountId: string): boolean {
  if (event.direction === "transfer") {
    return event.fromAccountId === accountId || event.toAccountId === accountId;
  }
  return event.accountId === accountId;
}

/**
 * Safety-net reconciliation flow. The primary correction path is the
 * inbox (Confirm / Move / Cancel each past scheduled occurrence). If the
 * bank balance still doesn't match after working that, this modal posts
 * the residual delta as a single correction transaction and snaps the
 * account's starting balance + date to today.
 */
export function ReconcileModal({ profile, account, onClose }: Props) {
  const { data, updateAccount } = useApp();
  const dateFormat = useDateFormat();

  const profileAccounts = useMemo(
    () => data.accounts.filter((a) => a.profileId === profile.id),
    [data.accounts, profile.id],
  );
  const profileCashFlows = useMemo(
    () => data.cashFlows.filter((c) => c.profileId === profile.id),
    [data.cashFlows, profile.id],
  );

  const expected = useMemo(
    () => computeExpectedBalance(account, profileCashFlows),
    [account, profileCashFlows],
  );

  // Inbox items that touch this specific account. If non-zero, reconciling
  // now would absorb their unaccounted-for activity into a single mystery
  // delta — better to handle them individually first.
  const pendingForAccount = useMemo(() => {
    return findNeedsAttention(profileAccounts, profileCashFlows).filter((item) =>
      eventTouchesAccount(item.event, account.id),
    );
  }, [profileAccounts, profileCashFlows, account.id]);

  const [actualInput, setActualInput] = useState<string>(String(expected));
  const [logTransaction, setLogTransaction] = useState(true);
  const [step, setStep] = useState<"enter" | "done">("enter");

  const isCredit = account.kind === "credit";
  const actual = Number(actualInput) || 0;
  const delta = actual - expected;
  const hasDelta = Math.abs(delta) >= 0.01;
  const today = toDateInputValue(new Date());
  // Credit accounts store balance as amount owed, so a higher actual means
  // more debt (untracked expense), not income.
  const isUntrackedIncome = isCredit ? delta < 0 : delta > 0;
  const deltaHint = isCredit
    ? delta > 0
      ? "You owe more than expected — untracked charge?"
      : "You owe less than expected — payment or refund?"
    : delta > 0
      ? "You have more than expected — untracked income or refund?"
      : "You have less than expected — an expense you didn't schedule?";

  function handleApply() {
    // Update the account balance to the user's actual + set date to today.
    updateAccount(account.id, {
      startingBalance: actual,
      startingBalanceDate: today,
    });

    if (hasDelta && logTransaction) {
      // Open the transaction editor pre-filled with the delta.
      setStep("done");
    } else {
      onClose();
    }
  }

  if (step === "done" && hasDelta) {
    return (
      <TransactionEditor
        profile={profile}
        defaults={{
          name: isUntrackedIncome ? "Untracked income" : "Untracked expense",
          amount: Math.abs(delta),
          direction: isUntrackedIncome ? "income" : "expense",
          accountId: account.id,
          date: today,
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reconcile ${account.name}`}
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={handleApply}>
            {hasDelta && logTransaction ? "Update & log" : "Update balance"}
          </button>
        </div>
      }
    >
      <div className="form">
        {pendingForAccount.length > 0 && (
          <div className="reconcile-warning">
            <span className="reconcile-warning__icon" aria-hidden>
              <AlertCircle size={18} />
            </span>
            <div>
              <p className="reconcile-warning__title">
                {pendingForAccount.length} item{pendingForAccount.length === 1 ? "" : "s"} still
                need attention
              </p>
              <p className="reconcile-warning__body">
                Confirm, move, or cancel them in the inbox first — otherwise their unaccounted
                activity gets absorbed into one mystery correction here.
              </p>
            </div>
          </div>
        )}

        <div className="export-summary">
          <p className="export-summary__lead">
            Last updated{" "}
            <strong>{formatDate(parseDateInput(account.startingBalanceDate), dateFormat)}</strong>{" "}
            at <strong>{formatCurrency(account.startingBalance)}</strong>.
          </p>
          <p className="export-summary__lead">
            Based on scheduled events plus any inbox decisions, we expect the balance today to be{" "}
            <strong className="mono">{formatCurrency(expected)}</strong>.
          </p>
        </div>

        <label className="field">
          <span className="field__label">Actual balance right now</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="input"
            value={actualInput}
            onChange={(e) => setActualInput(e.target.value)}
            autoFocus
          />
          <span className="field__hint">Open your bank, enter the real current balance.</span>
        </label>

        {hasDelta && (
          <div className="reconcile-delta">
            <p className={`reconcile-delta__value mono ${delta > 0 ? "positive" : "negative"}`}>
              {delta > 0 ? "+" : "−"}
              {formatCurrency(Math.abs(delta))} unaccounted
            </p>
            <p className="reconcile-delta__hint">{deltaHint}</p>
            <label className="field field--row">
              <input
                type="checkbox"
                checked={logTransaction}
                onChange={(e) => setLogTransaction(e.target.checked)}
              />
              <span className="field__label">
                Log {formatCurrency(Math.abs(delta))} as a correction transaction
              </span>
            </label>
            <span className="field__hint">
              Recommended — gives you a named record of what you absorbed instead of a silent
              balance jump.
            </span>
          </div>
        )}

        {!hasDelta && (
          <p className="field__hint">Matches expected! Updating the balance date to today.</p>
        )}
      </div>
    </Modal>
  );
}

import { useMemo, useState } from "react";
import type { Account, Profile } from "../types";
import { useApp, useDateFormat } from "../state";
import { formatCurrency, formatDate, parseDateInput, toDateInputValue } from "../lib/format";
import { computeExpectedBalance } from "../lib/reconciliation";
import { Modal } from "./Modal";
import { TransactionEditor } from "./TransactionEditor";

interface Props {
  profile: Profile;
  account: Account;
  onClose: () => void;
}

/**
 * Reconciliation flow:
 * 1. Show expected balance (engine replay) vs. last known.
 * 2. User enters their real current balance.
 * 3. If delta != 0: offer to log the difference as a transaction.
 * 4. Update the account's startingBalance + date to today.
 */
export function ReconcileModal({ profile, account, onClose }: Props) {
  const { data, updateAccount } = useApp();
  const dateFormat = useDateFormat();

  const profileCashFlows = useMemo(
    () => data.cashFlows.filter((c) => c.profileId === profile.id),
    [data.cashFlows, profile.id],
  );

  const expected = useMemo(
    () => computeExpectedBalance(account, profileCashFlows),
    [account, profileCashFlows],
  );

  const [actualInput, setActualInput] = useState<string>(String(expected));
  const [logTransaction, setLogTransaction] = useState(false);
  const [step, setStep] = useState<"enter" | "done">("enter");

  const actual = Number(actualInput) || 0;
  const delta = actual - expected;
  const hasDelta = Math.abs(delta) >= 0.01;
  const today = toDateInputValue(new Date());

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
          name: delta > 0 ? "Untracked income" : "Untracked expense",
          amount: Math.abs(delta),
          direction: delta > 0 ? "income" : "expense",
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
        <div className="export-summary">
          <p className="export-summary__lead">
            Last updated{" "}
            <strong>{formatDate(parseDateInput(account.startingBalanceDate), dateFormat)}</strong>{" "}
            at <strong>{formatCurrency(account.startingBalance)}</strong>.
          </p>
          <p className="export-summary__lead">
            Based on scheduled events, we expect the balance today to be{" "}
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
          <span className="field__hint">Check your bank account and enter the real number.</span>
        </label>

        {hasDelta && (
          <div className="reconcile-delta">
            <p className={`reconcile-delta__value mono ${delta > 0 ? "positive" : "negative"}`}>
              {delta > 0 ? "+" : "−"}
              {formatCurrency(Math.abs(delta))} unaccounted
            </p>
            <p className="reconcile-delta__hint">
              {delta > 0
                ? "You have more than expected — untracked income or refund?"
                : "You have less than expected — an expense you didn't schedule?"}
            </p>
            <label className="field field--row">
              <input
                type="checkbox"
                checked={logTransaction}
                onChange={(e) => setLogTransaction(e.target.checked)}
              />
              <span className="field__label">
                Log {formatCurrency(Math.abs(delta))} as a transaction
              </span>
            </label>
          </div>
        )}

        {!hasDelta && (
          <p className="field__hint">Matches expected! Updating the balance date to today.</p>
        )}
      </div>
    </Modal>
  );
}

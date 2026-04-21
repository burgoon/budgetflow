import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Profile } from "../types";
import { useApp } from "../state";
import { Modal } from "./Modal";

interface Props {
  profile: Profile;
  onClose: () => void;
}

/**
 * Wipes per-occurrence decisions and/or transaction ledger for a profile,
 * keeping accounts, cash flow definitions, profile config, and tags intact.
 * Useful for clearing test data or starting a clean tracking period without
 * losing the setup work.
 */
export function ResetHistoryModal({ profile, onClose }: Props) {
  const { data, resetProfileHistory } = useApp();

  const [clearOverrides, setClearOverrides] = useState(true);
  const [clearTransactions, setClearTransactions] = useState(true);
  const [resetBalanceDates, setResetBalanceDates] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const counts = useMemo(() => {
    const overrideCount = data.cashFlows
      .filter((c) => c.profileId === profile.id)
      .reduce((sum, c) => sum + (c.overrides?.length ?? 0), 0);
    const transactionCount = data.transactions.filter((t) => t.profileId === profile.id).length;
    const accountCount = data.accounts.filter((a) => a.profileId === profile.id).length;
    return { overrideCount, transactionCount, accountCount };
  }, [data, profile.id]);

  const anySelected = clearOverrides || clearTransactions || resetBalanceDates;
  const confirmed = confirmText.trim().toLowerCase() === "reset";

  function handleReset() {
    if (!anySelected || !confirmed) return;
    resetProfileHistory(profile.id, {
      overrides: clearOverrides,
      transactions: clearTransactions,
      resetBalanceDates,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reset projection history"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={handleReset}
            disabled={!anySelected || !confirmed}
          >
            Reset history
          </button>
        </div>
      }
    >
      <div className="form">
        <div className="reconcile-warning">
          <span className="reconcile-warning__icon" aria-hidden>
            <AlertTriangle size={18} />
          </span>
          <div>
            <p className="reconcile-warning__title">This is permanent</p>
            <p className="reconcile-warning__body">
              Your accounts, income, expense, and transfer definitions for{" "}
              <strong>{profile.name}</strong> are kept. Anything you check below for this profile
              will be erased and cannot be recovered without restoring from an export.
            </p>
          </div>
        </div>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={clearOverrides}
            onChange={(e) => setClearOverrides(e.target.checked)}
          />
          <span className="field__label">
            Per-occurrence decisions ({counts.overrideCount} stored)
          </span>
        </label>
        <span className="field__hint">
          Removes every Confirm / Move / Cancel applied to scheduled occurrences. Inbox repopulates
          with everything that's fired in the past.
        </span>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={clearTransactions}
            onChange={(e) => setClearTransactions(e.target.checked)}
          />
          <span className="field__label">Transactions ({counts.transactionCount} stored)</span>
        </label>
        <span className="field__hint">
          Empties the ledger. Removes both auto-logged transactions from confirms and any you
          entered manually.
        </span>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={resetBalanceDates}
            onChange={(e) => setResetBalanceDates(e.target.checked)}
          />
          <span className="field__label">
            Reset {counts.accountCount} account balance date{counts.accountCount === 1 ? "" : "s"}{" "}
            to today
          </span>
        </label>
        <span className="field__hint">
          Optional. Keeps the dollar amounts but moves "as of" forward to today, so the engine stops
          replaying past events. Use when starting a fresh tracking period.
        </span>

        <label className="field">
          <span className="field__label">Type "reset" to confirm</span>
          <input
            type="text"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>
    </Modal>
  );
}

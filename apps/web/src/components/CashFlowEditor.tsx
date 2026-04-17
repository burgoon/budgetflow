import { useMemo, useState } from "react";
import type { CashFlow, CashFlowDirection, Profile, Recurrence } from "../types";
import { useApp, useDateFormat } from "../state";
import { toDateInputValue } from "../lib/format";
import { collectAllTags } from "../lib/tags";
import { Modal } from "./Modal";
import { RecurrencePicker } from "./RecurrencePicker";
import { DateInput } from "./DateInput";
import { TagsInput } from "./TagsInput";

interface Props {
  profile: Profile;
  direction: CashFlowDirection;
  cashFlow?: CashFlow;
  onClose: () => void;
}

export function CashFlowEditor({ profile, direction, cashFlow, onClose }: Props) {
  const { data, createCashFlow, updateCashFlow, deleteCashFlow } = useApp();
  const dateFormat = useDateFormat();

  const accounts = useMemo(
    () =>
      data.accounts
        .filter((account) => account.profileId === profile.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.accounts, profile.id],
  );

  const [name, setName] = useState(cashFlow?.name ?? "");
  const [amount, setAmount] = useState<string>(cashFlow ? String(cashFlow.amount) : "0");
  const [accountId, setAccountId] = useState<string>(
    cashFlow?.accountId ?? accounts[0]?.id ?? "",
  );
  const [startDate, setStartDate] = useState<string>(
    cashFlow?.startDate ?? toDateInputValue(new Date()),
  );
  const [hasEndDate, setHasEndDate] = useState<boolean>(Boolean(cashFlow?.endDate));
  const [endDate, setEndDate] = useState<string>(
    cashFlow?.endDate ?? toDateInputValue(new Date()),
  );
  const [recurrence, setRecurrence] = useState<Recurrence>(
    cashFlow?.recurrence ?? { kind: "monthly", day: 1 },
  );
  const [tags, setTags] = useState<string[]>(cashFlow?.tags ?? []);

  const tagSuggestions = useMemo(() => {
    const profileAccounts = data.accounts.filter((a) => a.profileId === profile.id);
    const profileCashFlows = data.cashFlows.filter((c) => c.profileId === profile.id);
    return collectAllTags(profileAccounts, profileCashFlows);
  }, [data, profile.id]);

  const canSave = name.trim().length > 0;
  const label = direction === "income" ? "Income" : "Expense";

  function handleSave() {
    const parsedAmount = Number(amount) || 0;
    const payload = {
      profileId: profile.id,
      accountId: accountId || null,
      name: name.trim(),
      amount: parsedAmount,
      direction,
      startDate,
      endDate: hasEndDate ? endDate : null,
      recurrence,
      tags: tags.length > 0 ? tags : undefined,
    };
    if (cashFlow) {
      updateCashFlow(cashFlow.id, payload);
    } else {
      createCashFlow(payload);
    }
    onClose();
  }

  function handleDelete() {
    if (!cashFlow) return;
    if (confirm(`Delete "${cashFlow.name}"?`)) {
      deleteCashFlow(cashFlow.id);
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={cashFlow ? `Edit ${label}` : `New ${label}`}
      footer={
        <div className="modal__actions">
          {cashFlow && (
            <button type="button" className="button button--danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      }
    >
      <div className="form">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Amount</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="input"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Account</span>
          {accounts.length === 0 ? (
            <span className="field__hint">Create an account first.</span>
          ) : (
            <select
              className="input"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">None</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <div className="field">
          <span className="field__label">Starts</span>
          <DateInput value={startDate} onChange={setStartDate} format={dateFormat} />
        </div>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={hasEndDate}
            onChange={(event) => setHasEndDate(event.target.checked)}
          />
          <span className="field__label">Has end date</span>
        </label>

        {hasEndDate && (
          <div className="field">
            <span className="field__label">Ends</span>
            <DateInput
              value={endDate}
              onChange={setEndDate}
              format={dateFormat}
              min={startDate}
            />
          </div>
        )}

        <div className="field">
          <span className="field__label">Repeats</span>
          <RecurrencePicker value={recurrence} onChange={setRecurrence} />
        </div>

        <div className="field">
          <span className="field__label">Tags</span>
          <TagsInput
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            placeholder="e.g., home, vehicle, subscription"
          />
        </div>
      </div>
    </Modal>
  );
}

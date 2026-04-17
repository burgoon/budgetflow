import { useMemo, useState } from "react";
import type { CashFlowDirection, Profile, Transaction } from "../types";
import { useApp, useDateFormat } from "../state";
import { toDateInputValue } from "../lib/format";
import { collectAllTags } from "../lib/tags";
import { Modal } from "./Modal";
import { DateInput } from "./DateInput";
import { TagsInput } from "./TagsInput";

interface Props {
  profile: Profile;
  transaction?: Transaction;
  /** Pre-fill fields when creating from reconciliation or mark-as-paid. */
  defaults?: Partial<
    Pick<
      Transaction,
      | "name"
      | "amount"
      | "direction"
      | "accountId"
      | "date"
      | "tags"
      | "cashFlowId"
      | "scheduledDate"
    >
  >;
  onClose: () => void;
}

const DIRECTIONS: Array<{ value: CashFlowDirection; label: string }> = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

export function TransactionEditor({ profile, transaction, defaults, onClose }: Props) {
  const { data, createTransaction, updateTransaction, deleteTransaction } = useApp();
  const dateFormat = useDateFormat();

  const accounts = useMemo(
    () =>
      data.accounts
        .filter((a) => a.profileId === profile.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.accounts, profile.id],
  );

  const tagSuggestions = useMemo(() => {
    const pa = data.accounts.filter((a) => a.profileId === profile.id);
    const pc = data.cashFlows.filter((c) => c.profileId === profile.id);
    return collectAllTags(pa, pc);
  }, [data, profile.id]);

  const [name, setName] = useState(transaction?.name ?? defaults?.name ?? "");
  const [amount, setAmount] = useState<string>(
    transaction
      ? String(transaction.amount)
      : defaults?.amount != null
        ? String(defaults.amount)
        : "",
  );
  const [direction, setDirection] = useState<CashFlowDirection>(
    transaction?.direction ?? defaults?.direction ?? "expense",
  );
  const [accountId, setAccountId] = useState<string>(
    transaction?.accountId ?? defaults?.accountId ?? accounts[0]?.id ?? "",
  );
  const [date, setDate] = useState<string>(
    transaction?.date ?? defaults?.date ?? toDateInputValue(new Date()),
  );
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? defaults?.tags ?? []);
  const [notes, setNotes] = useState(transaction?.notes ?? "");

  const canSave = name.trim().length > 0 && accountId.length > 0;

  function handleSave() {
    const parsedAmount = Math.abs(Number(amount) || 0);
    if (transaction) {
      updateTransaction(transaction.id, {
        name: name.trim(),
        amount: parsedAmount,
        direction,
        accountId,
        date,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      createTransaction({
        profileId: profile.id,
        name: name.trim(),
        amount: parsedAmount,
        direction,
        accountId,
        date,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
        cashFlowId: defaults?.cashFlowId,
        scheduledDate: defaults?.scheduledDate,
      });
    }
    onClose();
  }

  function handleDelete() {
    if (!transaction) return;
    if (confirm(`Delete transaction "${transaction.name}"?`)) {
      deleteTransaction(transaction.id);
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={transaction ? "Edit transaction" : "New transaction"}
      footer={
        <div className="modal__actions">
          {transaction && (
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
            onChange={(e) => setName(e.target.value)}
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
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field__label">Type</span>
          <div className="segmented">
            {DIRECTIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={`segmented__option ${direction === d.value ? "segmented__option--active" : ""}`}
                onClick={() => setDirection(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Account</span>
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.length === 0 && <option value="">No accounts</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span className="field__label">Date</span>
          <DateInput value={date} onChange={setDate} format={dateFormat} />
        </div>

        <div className="field">
          <span className="field__label">Tags</span>
          <TagsInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </div>

        <label className="field">
          <span className="field__label">Notes</span>
          <input
            type="text"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>
    </Modal>
  );
}

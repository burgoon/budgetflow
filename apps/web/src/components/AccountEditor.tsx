import { useMemo, useState } from "react";
import type { Account, AccountKind, Profile } from "../types";
import { ACCOUNT_KIND_LABEL } from "../types";
import { useApp, useDateFormat } from "../state";
import { toDateInputValue } from "../lib/format";
import { collectAllTags } from "../lib/tags";
import { Modal } from "./Modal";
import { DateInput } from "./DateInput";
import { TagsInput } from "./TagsInput";

interface AccountEditorProps {
  profile: Profile;
  account?: Account;
  onClose: () => void;
}

const KINDS: AccountKind[] = ["checking", "savings", "credit"];

export function AccountEditor({ profile, account, onClose }: AccountEditorProps) {
  const { data, createAccount, updateAccount, deleteAccount } = useApp();
  const dateFormat = useDateFormat();
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "checking");
  const [startingBalance, setStartingBalance] = useState<string>(
    account ? String(account.startingBalance) : "0",
  );
  const [startingBalanceDate, setStartingBalanceDate] = useState<string>(
    account?.startingBalanceDate ?? toDateInputValue(new Date()),
  );
  const [tags, setTags] = useState<string[]>(account?.tags ?? []);

  const tagSuggestions = useMemo(() => {
    const profileAccounts = data.accounts.filter((a) => a.profileId === profile.id);
    const profileCashFlows = data.cashFlows.filter((c) => c.profileId === profile.id);
    return collectAllTags(profileAccounts, profileCashFlows);
  }, [data, profile.id]);

  const canSave = name.trim().length > 0;

  function handleSave() {
    const parsedBalance = Number(startingBalance) || 0;
    const cleanTags = tags.length > 0 ? tags : undefined;
    if (account) {
      updateAccount(account.id, {
        name: name.trim(),
        kind,
        startingBalance: parsedBalance,
        startingBalanceDate,
        tags: cleanTags,
      });
    } else {
      createAccount({
        profileId: profile.id,
        name: name.trim(),
        kind,
        startingBalance: parsedBalance,
        startingBalanceDate,
        tags: cleanTags,
      });
    }
    onClose();
  }

  function handleDelete() {
    if (!account) return;
    if (confirm(`Delete account "${account.name}"? Attached income/expenses will be unassigned.`)) {
      deleteAccount(account.id);
      onClose();
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      footer={
        <div className="modal__actions">
          {account && (
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

        <div className="field">
          <span className="field__label">Type</span>
          <div className="segmented">
            {KINDS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented__option ${kind === option ? "segmented__option--active" : ""}`}
                onClick={() => setKind(option)}
              >
                {ACCOUNT_KIND_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Starting balance</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="input"
            value={startingBalance}
            onChange={(event) => setStartingBalance(event.target.value)}
          />
          <span className="field__hint">
            {kind === "credit"
              ? "Enter the current amount owed as a positive number."
              : "Enter the current available balance."}
          </span>
        </label>

        <div className="field">
          <span className="field__label">As of</span>
          <DateInput
            value={startingBalanceDate}
            onChange={setStartingBalanceDate}
            format={dateFormat}
          />
        </div>

        <div className="field">
          <span className="field__label">Tags</span>
          <TagsInput
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            placeholder="e.g., joint, savings goal"
          />
          <span className="field__hint">
            Free-form labels shared with income and expenses. Use to filter and
            group on the Income/Expenses tabs.
          </span>
        </div>
      </div>
    </Modal>
  );
}

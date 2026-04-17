import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DateFormat, Profile } from "../types";
import { DATE_FORMATS, DEFAULT_DATE_FORMAT } from "../types";
import { useApp } from "../state";
import { formatDate, formatCurrency } from "../lib/format";
import { collectAllTags, tagKey } from "../lib/tags";
import { Modal } from "./Modal";

interface Props {
  profile: Profile;
  onClose: () => void;
}

export function ProfileEditor({ profile, onClose }: Props) {
  const { data, updateProfile } = useApp();
  const [name, setName] = useState(profile.name);
  const [dateFormat, setDateFormat] = useState<DateFormat>(
    profile.dateFormat ?? DEFAULT_DATE_FORMAT,
  );
  const [targets, setTargets] = useState<Record<string, number>>(
    profile.budgetTargets ?? {},
  );
  const [newTag, setNewTag] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const canSave = name.trim().length > 0;
  const sampleDate = new Date();

  const existingTags = useMemo(() => {
    const accounts = data.accounts.filter((a) => a.profileId === profile.id);
    const cashFlows = data.cashFlows.filter((c) => c.profileId === profile.id);
    return collectAllTags(accounts, cashFlows);
  }, [data, profile.id]);

  // Tags that already have targets — don't suggest them again.
  const suggestable = useMemo(
    () => existingTags.filter((tag) => !(tagKey(tag) in targets)),
    [existingTags, targets],
  );

  function addTarget() {
    const tag = newTag.trim();
    const amount = Number(newAmount);
    if (!tag || !Number.isFinite(amount) || amount <= 0) return;
    setTargets((prev) => ({ ...prev, [tagKey(tag)]: amount }));
    setNewTag("");
    setNewAmount("");
  }

  function removeTarget(key: string) {
    setTargets((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSave() {
    updateProfile(profile.id, {
      name: name.trim(),
      dateFormat,
      budgetTargets: Object.keys(targets).length > 0 ? targets : undefined,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile"
      footer={
        <div className="modal__actions">
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
          <span className="field__label">Date format</span>
          <select
            className="input"
            value={dateFormat}
            onChange={(event) => setDateFormat(event.target.value as DateFormat)}
          >
            {DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {formatDate(sampleDate, format)} ({format})
              </option>
            ))}
          </select>
          <span className="field__hint">
            Applies to date pickers and every date shown across the app.
          </span>
        </label>

        <div className="field">
          <span className="field__label">Monthly expense budgets</span>
          <span className="field__hint">
            Set a monthly spending target for a tag. The Expenses page shows a
            progress bar comparing your actual monthly-equivalent to this target.
          </span>

          {Object.keys(targets).length > 0 && (
            <ul className="budget-targets__list">
              {Object.entries(targets)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, amount]) => (
                  <li key={key} className="budget-targets__row">
                    <span className="budget-targets__tag">{key}</span>
                    <span className="budget-targets__amount mono">
                      {formatCurrency(amount)}/mo
                    </span>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => removeTarget(key)}
                      aria-label={`Remove budget for ${key}`}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          )}

          <div className="budget-targets__add">
            {suggestable.length > 0 ? (
              <select
                className="input"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
              >
                <option value="">Pick a tag…</option>
                {suggestable.map((tag) => (
                  <option key={tagKey(tag)} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="input"
                placeholder="Tag name"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
              />
            )}
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input"
              placeholder="$/mo"
              value={newAmount}
              onChange={(event) => setNewAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addTarget();
              }}
            />
            <button
              type="button"
              className="button button--primary"
              onClick={addTarget}
              disabled={!newTag.trim() || !newAmount || Number(newAmount) <= 0}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

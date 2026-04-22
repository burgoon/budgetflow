import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Profile } from "../types";
import { useApp } from "../state";
import { formatCurrency } from "../lib/format";
import { collectAllTags, tagKey } from "../lib/tags";
import { Modal } from "./Modal";

interface Props {
  profile: Profile;
  onClose: () => void;
}

/**
 * Standalone editor for `profile.budgetTargets`. Extracted from ProfileEditor
 * so the Dashboard can invoke it inline — budget targets belong next to
 * budget tracking, not buried in profile-level settings.
 */
export function BudgetTargetsModal({ profile, onClose }: Props) {
  const { data, updateProfile } = useApp();

  const [targets, setTargets] = useState<Record<string, number>>(profile.budgetTargets ?? {});
  const [newTag, setNewTag] = useState("");
  const [newAmount, setNewAmount] = useState("");

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
      budgetTargets: Object.keys(targets).length > 0 ? targets : undefined,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Monthly budget targets"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={handleSave}>
            Save
          </button>
        </div>
      }
    >
      <div className="form">
        <span className="field__hint">
          Set a monthly spending target for a tag. The Dashboard shows actuals vs. each target with
          green / yellow / red progress bars as you confirm transactions.
        </span>

        {Object.keys(targets).length > 0 && (
          <ul className="budget-targets__list">
            {Object.entries(targets)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, amount]) => (
                <li key={key} className="budget-targets__row">
                  <span className="budget-targets__tag">{key}</span>
                  <span className="budget-targets__amount mono">{formatCurrency(amount)}/mo</span>
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
    </Modal>
  );
}

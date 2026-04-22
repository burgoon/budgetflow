import { useState } from "react";
import { RefreshCw, Upload, UserRoundPlus } from "lucide-react";
import { useApp } from "../state";
import type { MobileAction } from "./MoreMenuSheet";

interface Props {
  /** Fires when the user picks Sync or Import — App resolves it to the
   *  same modal as the More sheet so the bootstrap flow doesn't depend on
   *  having a profile first. */
  onAction?: (action: MobileAction) => void;
}

export function EmptyProfileView({ onAction }: Props) {
  const { createProfile } = useApp();
  const [name, setName] = useState("Me");

  return (
    <div className="empty-profile">
      <div className="empty-profile__card">
        <UserRoundPlus size={56} className="empty-profile__icon" aria-hidden />
        <h1 className="empty-profile__title">Welcome to BudgetFlow</h1>
        <p className="empty-profile__subtitle">
          Create a profile to start tracking accounts, income, and expenses.
        </p>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Profile name"
        />
        <button
          type="button"
          className="button button--primary button--large"
          onClick={() => {
            const trimmed = name.trim();
            if (trimmed) createProfile(trimmed);
          }}
          disabled={!name.trim()}
        >
          Create profile
        </button>

        {onAction && (
          <div className="empty-profile__alt">
            <span className="empty-profile__alt-text">
              Already have BudgetFlow on another device?
            </span>
            <div className="empty-profile__alt-actions">
              <button type="button" className="button" onClick={() => onAction("sync")}>
                <RefreshCw size={16} aria-hidden /> Sync from another device
              </button>
              <button type="button" className="button" onClick={() => onAction("import")}>
                <Upload size={16} aria-hidden /> Import from file or link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

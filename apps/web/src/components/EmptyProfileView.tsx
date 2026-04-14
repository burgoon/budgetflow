import { useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { useApp } from "../state";

export function EmptyProfileView() {
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
      </div>
    </div>
  );
}

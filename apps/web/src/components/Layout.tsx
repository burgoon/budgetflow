import type { ReactNode } from "react";
import { CalendarDays, LineChart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Tab } from "../App";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface LayoutProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

const TABS: Array<{ id: Tab; label: string; Icon: typeof Wallet }> = [
  { id: "accounts", label: "Accounts", Icon: Wallet },
  { id: "income", label: "Income", Icon: TrendingUp },
  { id: "expenses", label: "Expenses", Icon: TrendingDown },
  { id: "projection", label: "Projection", Icon: LineChart },
  { id: "day-by-day", label: "Day-by-day", Icon: CalendarDays },
];

export function Layout({ tab, onTabChange, children }: LayoutProps) {
  return (
    <div className="layout">
      <header className="layout__header">
        <div className="layout__header-row">
          <h1 className="layout__title">BudgetFlow</h1>
          <div className="layout__header-actions">
            <ThemeSwitcher />
            <ProfileSwitcher />
          </div>
        </div>
        <nav className="layout__tabs" aria-label="Primary">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`layout__tab ${tab === id ? "layout__tab--active" : ""}`}
              onClick={() => onTabChange(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={16} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="layout__main">{children}</main>
    </div>
  );
}

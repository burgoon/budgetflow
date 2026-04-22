import { useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  LayoutDashboard,
  LineChart,
  List,
  MoreHorizontal,
  Wallet,
} from "lucide-react";
import type { Tab } from "../App";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { MoreMenuSheet, type MobileAction } from "./MoreMenuSheet";

interface LayoutProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  /** Fired when the user picks an action from the mobile More sheet that
   *  needs its own modal (edit profile, manage, export, import, share).
   *  The modals themselves are rendered by App so they survive the More
   *  sheet unmounting. */
  onMobileAction?: (action: MobileAction) => void;
  children: ReactNode;
}

const TABS: Array<{ id: Tab; label: string; Icon: typeof Wallet }> = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "forecast", label: "Forecast", Icon: LineChart },
  { id: "accounts", label: "Accounts", Icon: Wallet },
  { id: "cashflows", label: "Cash flows", Icon: ArrowUpDown },
  { id: "ledger", label: "Ledger", Icon: List },
];

export function Layout({ tab, onTabChange, onMobileAction, children }: LayoutProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  function handleMobileAction(action: MobileAction) {
    setMoreOpen(false);
    onMobileAction?.(action);
  }

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
          {/* Mobile-only: opens the settings sheet (theme, profile, data).
              Hidden on desktop via CSS, where the same controls live in the
              header. */}
          <button
            type="button"
            className="layout__tab layout__tab--more"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={16} aria-hidden />
            <span>More</span>
          </button>
        </nav>
      </header>
      <main className="layout__main">{children}</main>
      {moreOpen && (
        <MoreMenuSheet onClose={() => setMoreOpen(false)} onAction={handleMobileAction} />
      )}
    </div>
  );
}

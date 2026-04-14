import { useState } from "react";
import { AppProvider, useApp } from "./state";
import { Layout } from "./components/Layout";
import { EmptyProfileView } from "./components/EmptyProfileView";
import { AccountsPage } from "./pages/AccountsPage";
import { CashFlowsPage } from "./pages/CashFlowsPage";
import { ProjectionPage } from "./pages/ProjectionPage";
import { DayByDayPage } from "./pages/DayByDayPage";

export type Tab = "accounts" | "income" | "expenses" | "projection" | "day-by-day";

export function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

function AppInner() {
  const { activeProfile } = useApp();
  const [tab, setTab] = useState<Tab>("accounts");

  if (!activeProfile) {
    return <EmptyProfileView />;
  }

  return (
    <Layout tab={tab} onTabChange={setTab}>
      {tab === "accounts" && <AccountsPage profile={activeProfile} />}
      {tab === "income" && <CashFlowsPage profile={activeProfile} direction="income" />}
      {tab === "expenses" && <CashFlowsPage profile={activeProfile} direction="expense" />}
      {tab === "projection" && <ProjectionPage profile={activeProfile} />}
      {tab === "day-by-day" && <DayByDayPage profile={activeProfile} />}
    </Layout>
  );
}

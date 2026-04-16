import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state";
import { ThemeProvider } from "./themeContext";
import { Layout } from "./components/Layout";
import { EmptyProfileView } from "./components/EmptyProfileView";
import { ImportModal } from "./components/ImportModal";
import { AccountsPage } from "./pages/AccountsPage";
import { CashFlowsPage } from "./pages/CashFlowsPage";
import { ProjectionPage } from "./pages/ProjectionPage";
import { DayByDayPage } from "./pages/DayByDayPage";
import { clearShareFromHash, readShareFromHash } from "./lib/share";

export type Tab = "accounts" | "income" | "expenses" | "projection" | "day-by-day";

export function App() {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </AppProvider>
  );
}

function AppInner() {
  const { activeProfile } = useApp();
  const [tab, setTab] = useState<Tab>("accounts");
  // If the page was opened with a `#share=…` fragment, hold the encoded blob
  // here and strip it from the URL so a reload doesn't re-trigger the prompt.
  const [pendingShare, setPendingShare] = useState<string | null>(() => readShareFromHash());

  useEffect(() => {
    if (pendingShare) clearShareFromHash();
  }, [pendingShare]);

  function dismissShare() {
    setPendingShare(null);
  }

  // First-run users (no profile yet) can still receive a share link — render
  // the welcome screen behind the import modal so they can land somewhere
  // reasonable after they cancel.
  if (!activeProfile) {
    return (
      <>
        <EmptyProfileView />
        {pendingShare && (
          <ImportModal initialShare={pendingShare} onClose={dismissShare} />
        )}
      </>
    );
  }

  return (
    <>
      <Layout tab={tab} onTabChange={setTab}>
        {tab === "accounts" && <AccountsPage profile={activeProfile} />}
        {tab === "income" && <CashFlowsPage profile={activeProfile} direction="income" />}
        {tab === "expenses" && (
          <CashFlowsPage profile={activeProfile} direction="expense" />
        )}
        {tab === "projection" && <ProjectionPage profile={activeProfile} />}
        {tab === "day-by-day" && <DayByDayPage profile={activeProfile} />}
      </Layout>
      {pendingShare && (
        <ImportModal initialShare={pendingShare} onClose={dismissShare} />
      )}
    </>
  );
}

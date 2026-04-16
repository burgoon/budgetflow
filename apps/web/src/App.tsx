import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state";
import { ThemeProvider } from "./themeContext";
import { Layout } from "./components/Layout";
import type { MobileAction } from "./components/MoreMenuSheet";
import { EmptyProfileView } from "./components/EmptyProfileView";
import { ImportModal } from "./components/ImportModal";
import { ExportModal } from "./components/ExportModal";
import { ShareModal } from "./components/ShareModal";
import { ProfileEditor } from "./components/ProfileEditor";
import { ProfileManagerView } from "./components/ProfileManagerView";
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
  const [pendingShare, setPendingShare] = useState<string | null>(() => readShareFromHash());
  // Mobile More sheet fires actions that need their own modal. We render
  // those modals here (App level) so they survive the More sheet unmounting.
  const [mobileModal, setMobileModal] = useState<MobileAction | null>(null);

  useEffect(() => {
    if (pendingShare) clearShareFromHash();
  }, [pendingShare]);

  function dismissShare() {
    setPendingShare(null);
  }

  function closeMobileModal() {
    setMobileModal(null);
  }

  const mobileModals = (
    <>
      {mobileModal === "editor" && activeProfile && (
        <ProfileEditor profile={activeProfile} onClose={closeMobileModal} />
      )}
      {mobileModal === "manager" && (
        <ProfileManagerView onClose={closeMobileModal} />
      )}
      {mobileModal === "export" && <ExportModal onClose={closeMobileModal} />}
      {mobileModal === "import" && <ImportModal onClose={closeMobileModal} />}
      {mobileModal === "share" && <ShareModal onClose={closeMobileModal} />}
    </>
  );

  if (!activeProfile) {
    return (
      <>
        <EmptyProfileView />
        {pendingShare && (
          <ImportModal initialShare={pendingShare} onClose={dismissShare} />
        )}
        {mobileModals}
      </>
    );
  }

  return (
    <>
      <Layout tab={tab} onTabChange={setTab} onMobileAction={setMobileModal}>
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
      {mobileModals}
    </>
  );
}

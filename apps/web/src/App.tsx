import { useCallback, useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "./state";
import { ThemeProvider } from "./themeContext";
import { Layout } from "./components/Layout";
import type { MobileAction } from "./components/MoreMenuSheet";
import { EmptyProfileView } from "./components/EmptyProfileView";
import { ImportModal } from "./components/ImportModal";
import { ExportModal } from "./components/ExportModal";
import { ShareModal } from "./components/ShareModal";
import { SyncSetup } from "./components/SyncSetup";
import { ProfileEditor } from "./components/ProfileEditor";
import { ProfileManagerView } from "./components/ProfileManagerView";
import { ResetHistoryModal } from "./components/ResetHistoryModal";
import { AccountsPage } from "./pages/AccountsPage";
import { CashFlowsPage } from "./pages/CashFlowsPage";
import { ForecastPage } from "./pages/ForecastPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HelpScreen } from "./components/HelpScreen";
import { clearShareFromHash, readShareFromHash } from "./lib/share";
import { loadSyncConfig, pollSync, pushSync, saveSyncConfig, type SyncConfig } from "./lib/sync";

export type Tab = "dashboard" | "forecast" | "accounts" | "cashflows" | "ledger";

const SYNC_INTERVAL_MS = 60_000;
const PUSH_DEBOUNCE_MS = 3_000;

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
  const { data, activeProfile, replaceAllData } = useApp();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pendingShare, setPendingShare] = useState<string | null>(() => readShareFromHash());
  const [mobileModal, setMobileModal] = useState<MobileAction | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(() => loadSyncConfig());

  // ---- Sync engine ----

  // Counter to detect pull-triggered data changes and suppress the
  // resulting push (avoids infinite pull→push→pull loops).
  const pullCounter = useRef(0);
  const lastPushCounter = useRef(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull: check for remote updates. Called on mount, visibility change, and interval.
  const pull = useCallback(async () => {
    if (!syncConfig) return;
    try {
      const remoteData = await pollSync(syncConfig);
      if (remoteData) {
        pullCounter.current++;
        replaceAllData(remoteData);
        // Update lastSyncedAt
        const updated: SyncConfig = {
          ...syncConfig,
          lastSyncedAt: new Date().toISOString(),
        };
        saveSyncConfig(updated);
        setSyncConfig(updated);
      }
    } catch {
      // Silent — retry next interval.
    }
  }, [syncConfig, replaceAllData]);

  // Immediate pull on mount + when sync config changes.
  useEffect(() => {
    if (syncConfig) void pull();
  }, [syncConfig?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull on visibility change (tab/PWA comes to foreground).
  useEffect(() => {
    if (!syncConfig) return;
    function handleVisibility() {
      if (document.visibilityState === "visible") void pull();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncConfig, pull]);

  // Periodic poll.
  useEffect(() => {
    if (!syncConfig) return;
    const id = setInterval(() => void pull(), SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncConfig, pull]);

  // Push: debounced, skips pull-triggered changes.
  useEffect(() => {
    if (!syncConfig) return;
    if (pullCounter.current !== lastPushCounter.current) {
      // This data change was from a pull — don't push it back.
      lastPushCounter.current = pullCounter.current;
      return;
    }
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const updatedAt = await pushSync(data, syncConfig);
          const updated: SyncConfig = { ...syncConfig, lastSyncedAt: updatedAt };
          saveSyncConfig(updated);
          setSyncConfig(updated);
        } catch {
          // Silent — retry next change.
        }
      })();
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [data, syncConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- URL share detection ----

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
      {mobileModal === "manager" && <ProfileManagerView onClose={closeMobileModal} />}
      {mobileModal === "export" && <ExportModal onClose={closeMobileModal} />}
      {mobileModal === "import" && <ImportModal onClose={closeMobileModal} />}
      {mobileModal === "share" && <ShareModal onClose={closeMobileModal} />}
      {mobileModal === "sync" && (
        <SyncSetup
          syncConfig={syncConfig}
          onSyncConfigChange={setSyncConfig}
          onClose={closeMobileModal}
        />
      )}
      {mobileModal === "help" && <HelpScreen onClose={closeMobileModal} />}
      {mobileModal === "reset" && activeProfile && (
        <ResetHistoryModal profile={activeProfile} onClose={closeMobileModal} />
      )}
    </>
  );

  if (!activeProfile) {
    return (
      <>
        <EmptyProfileView />
        {pendingShare && <ImportModal initialShare={pendingShare} onClose={dismissShare} />}
        {mobileModals}
      </>
    );
  }

  return (
    <>
      <Layout tab={tab} onTabChange={setTab} onMobileAction={setMobileModal}>
        {tab === "dashboard" && <DashboardPage profile={activeProfile} />}
        {tab === "forecast" && <ForecastPage profile={activeProfile} />}
        {tab === "accounts" && <AccountsPage profile={activeProfile} />}
        {tab === "cashflows" && <CashFlowsPage profile={activeProfile} />}
        {tab === "ledger" && <TransactionsPage profile={activeProfile} />}
      </Layout>
      {pendingShare && <ImportModal initialShare={pendingShare} onClose={dismissShare} />}
      {mobileModals}
    </>
  );
}

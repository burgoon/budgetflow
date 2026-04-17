import { useEffect, useState } from "react";
import { Check, Copy, Link2Off, RefreshCw, ShieldCheck } from "lucide-react";
import type { AppData } from "../types";
import { useApp } from "../state";
import {
  createSync,
  getServerConfig,
  joinSync,
  loadSyncConfig,
  saveSyncConfig,
  type SyncConfig,
} from "../lib/sync";
import { Modal } from "./Modal";

interface Props {
  syncConfig: SyncConfig | null;
  onSyncConfigChange: (config: SyncConfig | null) => void;
  onClose: () => void;
}

type Mode = "menu" | "create" | "join" | "active";

export function SyncSetup({ syncConfig, onSyncConfigChange, onClose }: Props) {
  const { data, replaceAllData } = useApp();
  const [mode, setMode] = useState<Mode>(syncConfig ? "active" : "menu");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getServerConfig().then((config) => setServerAvailable(config !== null));
  }, []);

  async function handleCreate() {
    if (passphrase.length < 8 || passphrase !== confirmPassphrase) return;
    setBusy(true);
    setError(null);
    try {
      const { config, code } = await createSync(data, passphrase);
      saveSyncConfig(config);
      onSyncConfigChange(config);
      setCreatedCode(code);
      setMode("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim() || passphrase.length < 8) return;
    setBusy(true);
    setError(null);
    try {
      const { config, data: remoteData } = await joinSync(joinCode, passphrase);
      const ok = window.confirm(
        "Replace your local data with the synced version?\n\n" +
          `The server has ${remoteData.profiles.length} profile(s), ` +
          `${remoteData.accounts.length} account(s), and ` +
          `${remoteData.cashFlows.length} cash flow(s).`,
      );
      if (!ok) {
        setBusy(false);
        return;
      }
      replaceAllData(remoteData);
      saveSyncConfig(config);
      onSyncConfigChange(config);
      setMode("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    if (!window.confirm("Disconnect sync? Your local data stays — only sync is turned off.")) {
      return;
    }
    saveSyncConfig(null);
    onSyncConfigChange(null);
    setMode("menu");
    setCreatedCode(null);
  }

  async function handleCopyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  }

  const passOk = passphrase.length >= 8 && passphrase === confirmPassphrase;

  return (
    <Modal
      open
      onClose={onClose}
      title="Sync"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            {mode === "active" ? "Done" : "Cancel"}
          </button>
        </div>
      }
    >
      <div className="form">
        {serverAvailable === false && (
          <div className="form__error">
            Sync is not configured on this server. Deploy with{" "}
            <code>-c enableSync=true</code> to enable it.
          </div>
        )}

        {serverAvailable === null && (
          <p className="field__hint">Checking server…</p>
        )}

        {serverAvailable && mode === "menu" && (
          <>
            <p className="field__hint">
              Keep two devices in sync. Data is encrypted with your passphrase
              before it leaves the browser — the server stores only an opaque blob.
            </p>
            <div className="sync-menu">
              <button
                type="button"
                className="occurrence-action occurrence-action--info"
                onClick={() => setMode("create")}
              >
                <span className="occurrence-action__icon">
                  <RefreshCw size={18} aria-hidden />
                </span>
                <span className="occurrence-action__body">
                  <span className="occurrence-action__label">Create sync</span>
                  <span className="occurrence-action__hint">
                    Generate a code + passphrase. Push your data to the server.
                    Enter the code on your other device.
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="occurrence-action occurrence-action--success"
                onClick={() => setMode("join")}
              >
                <span className="occurrence-action__icon">
                  <ShieldCheck size={18} aria-hidden />
                </span>
                <span className="occurrence-action__body">
                  <span className="occurrence-action__label">Join sync</span>
                  <span className="occurrence-action__hint">
                    Enter a code + passphrase from your other device.
                    Replaces your local data with the synced version.
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {serverAvailable && mode === "create" && (
          <>
            <label className="field">
              <span className="field__label">Passphrase</span>
              <input
                type="password"
                className="input"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <span className="field__hint">
                At least 8 characters. You'll enter this on your other device.
              </span>
            </label>
            <label className="field">
              <span className="field__label">Confirm passphrase</span>
              <input
                type="password"
                className="input"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                autoComplete="new-password"
              />
              {passphrase.length > 0 && passphrase.length < 8 && (
                <span className="field__hint field__hint--danger">At least 8 characters.</span>
              )}
              {passphrase.length >= 8 && confirmPassphrase.length > 0 && passphrase !== confirmPassphrase && (
                <span className="field__hint field__hint--danger">Passphrases don't match.</span>
              )}
            </label>
            <button
              type="button"
              className="button button--primary"
              onClick={handleCreate}
              disabled={!passOk || busy}
            >
              {busy ? "Pushing…" : "Create sync"}
            </button>
          </>
        )}

        {serverAvailable && mode === "join" && (
          <>
            <label className="field">
              <span className="field__label">Sync code</span>
              <input
                type="text"
                className="input mono"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
                placeholder="e.g., abc12345"
                autoComplete="off"
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">Passphrase</span>
              <input
                type="password"
                className="input"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="button button--primary"
              onClick={handleJoin}
              disabled={!joinCode.trim() || passphrase.length < 8 || busy}
            >
              {busy ? "Connecting…" : "Join sync"}
            </button>
          </>
        )}

        {serverAvailable && mode === "active" && syncConfig && (
          <>
            <div className="export-summary">
              <p className="export-summary__lead">
                <RefreshCw size={14} aria-hidden style={{ verticalAlign: "-2px" }} />{" "}
                Sync is active. Changes push automatically and pull every 60 seconds.
              </p>
            </div>
            <div className="sync-active">
              <div className="sync-active__row">
                <span className="field__label">Code</span>
                <span className="mono">{createdCode ?? syncConfig.code}</span>
                <button
                  type="button"
                  className="button"
                  onClick={() => handleCopyCode(createdCode ?? syncConfig.code)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {syncConfig.lastSyncedAt && (
                <div className="sync-active__row">
                  <span className="field__label">Last synced</span>
                  <span>{new Date(syncConfig.lastSyncedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="button button--danger"
              onClick={handleDisconnect}
            >
              <Link2Off size={16} aria-hidden /> Disconnect sync
            </button>
          </>
        )}

        {error && <div className="form__error">{error}</div>}
      </div>
    </Modal>
  );
}

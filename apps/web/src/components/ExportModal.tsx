import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { useApp } from "../state";
import {
  buildExportFilename,
  downloadJson,
  exportToJson,
  summarize,
} from "../lib/dataExport";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

export function ExportModal({ onClose }: Props) {
  const { data } = useApp();
  const stats = summarize(data);

  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passphraseMismatch =
    encrypt && passphrase.length > 0 && passphrase !== confirmPassphrase;
  const passphraseTooShort = encrypt && passphrase.length > 0 && passphrase.length < 8;
  const canDownload =
    !busy &&
    (!encrypt || (passphrase.length >= 8 && passphrase === confirmPassphrase));

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const text = await exportToJson(data, encrypt ? passphrase : undefined);
      downloadJson(buildExportFilename(new Date(), encrypt), text);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Export data"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleDownload}
            disabled={!canDownload}
          >
            <Download size={16} aria-hidden /> {busy ? "Preparing…" : "Download"}
          </button>
        </div>
      }
    >
      <div className="form">
        <div className="export-summary">
          <p className="export-summary__lead">
            Downloads everything in this browser as a single JSON file.
          </p>
          <ul className="export-summary__stats">
            <li>
              <strong>{stats.profiles}</strong> profile{stats.profiles === 1 ? "" : "s"}
            </li>
            <li>
              <strong>{stats.accounts}</strong> account{stats.accounts === 1 ? "" : "s"}
            </li>
            <li>
              <strong>{stats.cashFlows}</strong> cash flow{stats.cashFlows === 1 ? "" : "s"}
            </li>
          </ul>
        </div>

        <label className="field field--row">
          <input
            type="checkbox"
            checked={encrypt}
            onChange={(event) => setEncrypt(event.target.checked)}
          />
          <span className="field__label">
            <ShieldCheck size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Encrypt
            with a passphrase
          </span>
        </label>
        {!encrypt && (
          <p className="field__hint">
            Recommended if you'll send the file through email, cloud storage, or any
            channel that isn't end-to-end encrypted (iMessage, Signal, AirDrop are fine).
          </p>
        )}

        {encrypt && (
          <>
            <label className="field">
              <span className="field__label">Passphrase</span>
              <input
                type="password"
                className="input"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <span className="field__hint">
                At least 8 characters. You'll need this exact passphrase to import the
                file later — there's no recovery.
              </span>
            </label>
            <label className="field">
              <span className="field__label">Confirm passphrase</span>
              <input
                type="password"
                className="input"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                autoComplete="new-password"
              />
              {passphraseTooShort && (
                <span className="field__hint field__hint--danger">
                  Passphrase must be at least 8 characters.
                </span>
              )}
              {passphraseMismatch && !passphraseTooShort && (
                <span className="field__hint field__hint--danger">
                  Passphrases don't match.
                </span>
              )}
            </label>
          </>
        )}

        {error && <div className="form__error">{error}</div>}
      </div>
    </Modal>
  );
}

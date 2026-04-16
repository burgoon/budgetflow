import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FilePlus, FileUp, Link as LinkIcon, Lock, Upload } from "lucide-react";
import type { AppData } from "../types";
import { useApp } from "../state";
import {
  importFromInspect,
  inspectExport,
  PassphraseRequiredError,
  summarize,
  WrongPassphraseError,
  type InspectResult,
} from "../lib/dataExport";
import { decodeShare, inspectShare } from "../lib/share";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
  /** When set, the modal skips the file picker and opens straight into the
   *  share-decode flow. The string is the base64url-encoded blob from the URL
   *  fragment (without the `#share=` prefix). */
  initialShare?: string;
}

type Step = "pick" | "passphrase" | "choose";
type Source =
  | { kind: "file"; envelope: InspectResult["envelope"]; exportedAt: string }
  | { kind: "share"; encoded: string };

export function ImportModal({ onClose, initialShare }: Props) {
  const { replaceAllData, mergeImportedData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(initialShare ? "passphrase" : "pick");
  const [filename, setFilename] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [decoded, setDecoded] = useState<AppData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When opened from a share link, immediately inspect the blob — if it's
  // unencrypted we can jump straight to the choose step; otherwise we sit on
  // the passphrase step waiting for the recipient to type theirs.
  useEffect(() => {
    if (!initialShare) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const info = inspectShare(initialShare);
        if (cancelled) return;
        setSource({ kind: "share", encoded: initialShare });
        if (info.isEncrypted) {
          setStep("passphrase");
        } else {
          const data = await decodeShare(initialShare);
          if (cancelled) return;
          setDecoded(data);
          setStep("choose");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialShare]);

  async function handleFilePicked(file: File) {
    setError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const result = inspectExport(text);
      setFilename(file.name);
      setSource({ kind: "file", envelope: result.envelope, exportedAt: result.exportedAt });
      if (result.isEncrypted) {
        setStep("passphrase");
      } else {
        const data = await importFromInspect(result.envelope);
        setDecoded(data);
        setStep("choose");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    if (!source) return;
    setError(null);
    setBusy(true);
    try {
      const data =
        source.kind === "file"
          ? await importFromInspect(source.envelope, passphrase)
          : await decodeShare(source.encoded, passphrase);
      setDecoded(data);
      setStep("choose");
    } catch (err) {
      if (err instanceof PassphraseRequiredError) {
        setError("Encrypted — enter the passphrase used when this was created.");
      } else if (err instanceof WrongPassphraseError) {
        setError("Wrong passphrase, or the data is corrupted.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleReplace() {
    if (!decoded) return;
    const ok = window.confirm(
      "Replace ALL data?\n\nEverything currently in this browser — profiles, accounts, " +
        "cash flows, overrides — will be removed and replaced with the imported data. " +
        "This cannot be undone.",
    );
    if (!ok) return;
    replaceAllData(decoded);
    onClose();
  }

  function handleMerge() {
    if (!decoded) return;
    mergeImportedData(decoded);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initialShare ? "Import shared data" : "Import data"}
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {step === "passphrase" && (
            <button
              type="button"
              className="button button--primary"
              onClick={handleUnlock}
              disabled={busy || passphrase.length === 0}
            >
              <Lock size={16} aria-hidden /> {busy ? "Unlocking…" : "Unlock"}
            </button>
          )}
        </div>
      }
    >
      <div className="form">
        {step === "pick" && (
          <>
            <p className="field__hint">
              Pick a BudgetFlow export file (<code>.json</code>) to load. You'll choose
              what to do with it on the next step.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFilePicked(file);
                // Reset so picking the same file again still triggers onChange
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="button button--primary button--large"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <FileUp size={16} aria-hidden /> {busy ? "Reading…" : "Choose file…"}
            </button>
            {filename && <div className="field__hint">Selected: {filename}</div>}
          </>
        )}

        {step === "passphrase" && source && (
          <>
            <div className="export-summary">
              <p className="export-summary__lead">
                {source.kind === "file" ? (
                  <>
                    <Lock size={14} aria-hidden style={{ verticalAlign: "-2px" }} />{" "}
                    Encrypted export from{" "}
                    <strong>{new Date(source.exportedAt).toLocaleString()}</strong>
                  </>
                ) : (
                  <>
                    <LinkIcon size={14} aria-hidden style={{ verticalAlign: "-2px" }} />{" "}
                    This share link is encrypted — enter the passphrase the sender used.
                  </>
                )}
              </p>
            </div>
            <label className="field">
              <span className="field__label">Passphrase</span>
              <input
                type="password"
                className="input"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleUnlock();
                }}
                autoComplete="off"
                autoFocus
              />
            </label>
          </>
        )}

        {step === "choose" && decoded && source && (
          <>
            <div className="export-summary">
              <p className="export-summary__lead">
                {source.kind === "file" ? (
                  <>
                    Loaded export from{" "}
                    <strong>{new Date(source.exportedAt).toLocaleString()}</strong>:
                  </>
                ) : (
                  <>Loaded shared data:</>
                )}
              </p>
              <ul className="export-summary__stats">
                <li>
                  <strong>{summarize(decoded).profiles}</strong> profile
                  {summarize(decoded).profiles === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{summarize(decoded).accounts}</strong> account
                  {summarize(decoded).accounts === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{summarize(decoded).cashFlows}</strong> cash flow
                  {summarize(decoded).cashFlows === 1 ? "" : "s"}
                </li>
              </ul>
            </div>

            <div className="import-actions">
              <button
                type="button"
                className="occurrence-action occurrence-action--info"
                onClick={handleMerge}
              >
                <span className="occurrence-action__icon">
                  <FilePlus size={18} aria-hidden />
                </span>
                <span className="occurrence-action__body">
                  <span className="occurrence-action__label">
                    Add as new profile(s)
                  </span>
                  <span className="occurrence-action__hint">
                    Keep your existing data and add the imported profiles alongside it.
                    All imported IDs are renamed so nothing collides.
                  </span>
                </span>
              </button>

              <button
                type="button"
                className="occurrence-action occurrence-action--danger"
                onClick={handleReplace}
              >
                <span className="occurrence-action__icon">
                  <AlertTriangle size={18} aria-hidden />
                </span>
                <span className="occurrence-action__body">
                  <span className="occurrence-action__label">Replace ALL data</span>
                  <span className="occurrence-action__hint">
                    Wipes everything currently in this browser and replaces it with the
                    imported data. You'll be asked to confirm.
                  </span>
                </span>
              </button>
            </div>
          </>
        )}

        {error && <div className="form__error">{error}</div>}
      </div>
    </Modal>
  );
}

// Export here so other components can grab the trigger icon without an extra import
export const ImportButtonIcon = Upload;

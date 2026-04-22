import { useEffect, useState } from "react";
import { Check, Copy, Link as LinkIcon, Share2, ShieldCheck } from "lucide-react";
import { useApp } from "../state";
import { encodeShare } from "../lib/share";
import { summarize } from "../lib/dataExport";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

export function ShareModal({ onClose }: Props) {
  const { data } = useApp();
  const stats = summarize(data);

  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-generate the unencrypted link on open so there's something to copy
  // immediately. When the user toggles encryption on, we drop the URL until
  // they fill in (and confirm) a passphrase.
  useEffect(() => {
    if (encrypt) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const result = await encodeShare(data);
        if (!cancelled) setShareUrl(result.url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, encrypt]);

  // When the user toggles encryption, blank the URL until they generate one
  // with a passphrase.
  useEffect(() => {
    if (encrypt) {
      setShareUrl(null);
    }
  }, [encrypt]);

  const passphraseTooShort = encrypt && passphrase.length > 0 && passphrase.length < 8;
  const passphraseMismatch = encrypt && passphrase.length > 0 && passphrase !== confirmPassphrase;
  const canGenerateEncrypted =
    encrypt && passphrase.length >= 8 && passphrase === confirmPassphrase;

  async function handleGenerate() {
    if (!canGenerateEncrypted) return;
    setBusy(true);
    setError(null);
    try {
      const result = await encodeShare(data, passphrase);
      setShareUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't copy to clipboard.");
    }
  }

  async function handleNativeShare() {
    if (!shareUrl || !navigator.share) return;
    try {
      await navigator.share({ title: "BudgetFlow data", url: shareUrl });
    } catch {
      // User canceled, or the platform refused — ignore.
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;
  const sizeNote = shareUrl ? sizeHint(shareUrl.length) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Share via link"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="form">
        <div className="export-summary">
          <p className="export-summary__lead">
            <LinkIcon size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Anyone who opens
            this link will be offered the chance to import this data into their own browser. The
            data lives entirely in the link — no server stores it.
          </p>
          <ul className="export-summary__stats">
            <li>
              <strong>{stats.profiles}</strong> profile{stats.profiles === 1 ? "" : "s"}
            </li>
            <li>
              <strong>{stats.accounts}</strong> account
              {stats.accounts === 1 ? "" : "s"}
            </li>
            <li>
              <strong>{stats.cashFlows}</strong> cash flow
              {stats.cashFlows === 1 ? "" : "s"}
            </li>
            <li>
              <strong>{stats.transactions}</strong> transaction
              {stats.transactions === 1 ? "" : "s"}
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
            <ShieldCheck size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Require a
            passphrase to import
          </span>
        </label>
        {!encrypt && (
          <p className="field__hint">
            Without a passphrase, anyone with the link can import. URL fragments (`#…`) are never
            sent to the server, but they show up in browser history, link previews, and screen
            sharing.
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
                Share the passphrase out-of-band — don't put it in the same message as the link. At
                least 8 characters.
              </span>
            </label>
            <label className="field">
              <span className="field__label">Confirm passphrase</span>
              <input
                type="password"
                className="input"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canGenerateEncrypted) {
                    void handleGenerate();
                  }
                }}
                autoComplete="new-password"
              />
              {passphraseTooShort && (
                <span className="field__hint field__hint--danger">
                  Passphrase must be at least 8 characters.
                </span>
              )}
              {passphraseMismatch && !passphraseTooShort && (
                <span className="field__hint field__hint--danger">Passphrases don't match.</span>
              )}
            </label>
            {!shareUrl && (
              <button
                type="button"
                className="button button--primary"
                onClick={handleGenerate}
                disabled={!canGenerateEncrypted || busy}
              >
                {busy ? "Generating…" : "Generate encrypted link"}
              </button>
            )}
          </>
        )}

        {shareUrl && (
          <div className="share-url">
            <label className="field">
              <span className="field__label">Share link</span>
              <textarea
                className="input share-url__textarea"
                value={shareUrl}
                readOnly
                rows={3}
                onFocus={(event) => event.target.select()}
              />
              {sizeNote && <span className={`field__hint ${sizeNote.tone}`}>{sizeNote.text}</span>}
            </label>
            <div className="share-url__actions">
              <button type="button" className="button button--primary" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check size={16} aria-hidden /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} aria-hidden /> Copy link
                  </>
                )}
              </button>
              {canNativeShare && (
                <button type="button" className="button" onClick={handleNativeShare}>
                  <Share2 size={16} aria-hidden /> Share…
                </button>
              )}
            </div>
          </div>
        )}

        {error && <div className="form__error">{error}</div>}
      </div>
    </Modal>
  );
}

interface SizeHint {
  text: string;
  tone: "" | "field__hint--danger";
}

function sizeHint(length: number): SizeHint {
  if (length < 2000) {
    return {
      text: `Link length: ${length} chars — fits anywhere (iMessage, Slack, email, SMS via short-link).`,
      tone: "",
    };
  }
  if (length < 4000) {
    return {
      text: `Link length: ${length} chars — works in iMessage, Slack, email. Too long for SMS.`,
      tone: "",
    };
  }
  if (length < 8000) {
    return {
      text: `Link length: ${length} chars — works in iMessage and email; some chat apps may truncate.`,
      tone: "",
    };
  }
  return {
    text: `Link length: ${length} chars — quite long. Consider exporting to a file instead.`,
    tone: "field__hint--danger",
  };
}

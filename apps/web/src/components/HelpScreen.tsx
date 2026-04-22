import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

export function HelpScreen({ onClose }: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Help"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="help-content">
        <section className="help-section">
          <h3>Daily workflow</h3>
          <ol>
            <li>
              Open the app each morning. Go to <strong>Accounts</strong>.
            </li>
            <li>
              If any account shows <em>"Updated X days ago"</em> in amber, tap it and update the
              balance to your real bank balance. Or tap <strong>Reconcile</strong> to compare
              expected vs. actual — the app will offer to log any unaccounted difference as a
              transaction.
            </li>
            <li>
              Check <strong>Projection</strong> to see your future balance chart, or{" "}
              <strong>Day-by-day</strong> for a table of the next 365 days.
            </li>
            <li>
              If a scheduled payment posts early (or late), tap the chip in the Day-by-day table →{" "}
              <strong>Mark as paid</strong>. This prevents double-counting AND automatically creates
              a transaction in the Ledger for budget tracking.
            </li>
          </ol>
        </section>

        <section className="help-section">
          <h3>Setting up accounts</h3>
          <p>
            Go to <strong>Accounts → New account</strong>. Enter your current balance and the date
            it's accurate as of. Add tags like "joint" or "savings goal" for filtering. The app
            supports checking, savings, and credit card accounts. For credit cards, enter the{" "}
            <strong>amount owed</strong> as a positive number — the engine handles the sign flip.
          </p>
        </section>

        <section className="help-section">
          <h3>Income, expenses, and transfers</h3>
          <p>
            <strong>Income</strong> and <strong>Expenses</strong> are recurring or one-time cash
            flows tied to an account. Set the cadence (daily, weekly, 1st &amp; 15th, monthly,
            quarterly, annually) and the amount. Tags help with filtering and budget tracking.
          </p>
          <p>
            <strong>Transfers</strong> move money between two accounts (e.g., checking → credit card
            payment). Find them in the Expenses tab under the <strong>Expenses | Transfers</strong>{" "}
            toggle. Transfers don't affect net worth — the projection chart stays flat for them.
          </p>
        </section>

        <section className="help-section">
          <h3>Per-occurrence overrides</h3>
          <p>
            Tap any chip on the <strong>Day-by-day</strong> table to open an action menu:
          </p>
          <ul>
            <li>
              <strong>Mark as paid</strong> — skips the scheduled occurrence (already in your
              balance) and auto-logs a transaction.
            </li>
            <li>
              <strong>Move to another date</strong> — shifts it to the actual post date.
            </li>
            <li>
              <strong>Cancel</strong> — removes the occurrence entirely (it didn't happen).
            </li>
            <li>
              <strong>Reset</strong> — undoes any override.
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Budget tracking</h3>
          <ol>
            <li>Add tags to your expenses (e.g., "groceries", "home", "vehicle").</li>
            <li>
              On the <strong>Dashboard</strong>, tap <strong>Budget targets…</strong> and set a
              monthly dollar target for each tag you want to track.
            </li>
            <li>
              Log actual spending as transactions in the <strong>Ledger</strong> — or confirm
              scheduled items from the Needs Attention inbox and they auto-log.
            </li>
            <li>
              View progress on the <strong>Dashboard</strong> — shows actual-vs-target per category
              with progress bars and pace markers (are you spending faster or slower than the month
              is progressing?).
            </li>
          </ol>
        </section>

        <section className="help-section">
          <h3>Reconciliation</h3>
          <p>
            When an account balance is stale (more than a day old), a <strong>Reconcile</strong>{" "}
            button appears on the account row. Tap it to:
          </p>
          <ol>
            <li>See what the engine expects (based on scheduled events).</li>
            <li>Enter your actual bank balance.</li>
            <li>
              If there's a difference, optionally log it as an "untracked expense" or "untracked
              income" transaction — so your budget dashboard reflects reality.
            </li>
          </ol>
        </section>

        <section className="help-section">
          <h3>Data portability</h3>
          <ul>
            <li>
              <strong>Export</strong> — downloads a JSON file (optionally encrypted with a
              passphrase).
            </li>
            <li>
              <strong>Import</strong> — loads a file or share link. Choose to replace all data or
              merge as new profiles.
            </li>
            <li>
              <strong>Share via link</strong> — generates a compressed, optionally encrypted URL.
              Recipient opens it and gets the import dialog.
            </li>
            <li>
              <strong>Sync</strong> — keeps two devices in step. Create a sync code + passphrase on
              one device, enter it on the other. Changes push/pull every 60 seconds. Requires the
              sync backend (deploy with <code>-c enableSync=true</code>).
            </li>
          </ul>
        </section>

        <section className="help-section">
          <h3>Date format</h3>
          <p>
            Each profile has its own date format (MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD). Change it
            in <strong>Edit profile</strong>. Affects date pickers, table displays, and all date
            labels across the app.
          </p>
        </section>

        <section className="help-section">
          <h3>Theme</h3>
          <p>
            Light, Dark, or Auto (follows your device). On desktop: cycle button in the header. On
            mobile: More → Appearance.
          </p>
        </section>
      </div>
    </Modal>
  );
}

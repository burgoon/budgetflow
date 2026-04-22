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
          <h3>First-time setup</h3>
          <ol>
            <li>
              <strong>Profile</strong> is created automatically on first launch. Edit name and date
              format from the profile dropdown.
            </li>
            <li>
              <strong>Accounts</strong> tab → New account. Enter the current balance and the date
              it's accurate as of. For credit cards, enter the amount <strong>owed</strong> as a
              positive number — the engine handles the sign flip.
            </li>
            <li>
              <strong>Cash flows</strong> tab → New {`{income|expense|transfer}`}. Set name, amount,
              account, and recurrence (daily, weekly, 1st &amp; 15th, monthly, quarterly, annually,
              or one-time). Tags help with filtering and budget tracking.
            </li>
            <li>
              Optional: <strong>Dashboard → Budget targets</strong> to set monthly dollar targets
              per tag. Actuals show as progress bars on the Dashboard.
            </li>
          </ol>
        </section>

        <section className="help-section">
          <h3>Daily workflow</h3>
          <p>Open the app to the Dashboard. Top to bottom:</p>
          <ol>
            <li>
              <strong>Needs Attention</strong> — past scheduled items with no decision yet. Tap each
              one and pick:
              <ul>
                <li>
                  <strong>Confirm</strong> — happened as scheduled. Engine counts it; a Transaction
                  is auto-logged.
                </li>
                <li>
                  <strong>Different amount</strong> — same date but the actual amount differed.
                  Engine uses your real number.
                </li>
                <li>
                  <strong>Another date</strong> — posted on a different day than scheduled.
                </li>
                <li>
                  <strong>Cancel</strong> — didn't happen and won't.
                </li>
              </ul>
            </li>
            <li>
              <strong>Accounts</strong> section — when an account shows "Updated X days ago" in
              amber, tap <strong>Reconcile</strong>. See projected vs. actual balance; absorb any
              residual difference as a correction transaction.
            </li>
            <li>
              <strong>Log transaction</strong> button (top right) — for one-off spending that isn't
              on your recurring schedule (a coffee, a parking meter).
            </li>
          </ol>
          <p>
            Once you've worked through the Dashboard, your projection accurately reflects what's
            happened, and your budget actuals reflect reality.
          </p>
        </section>

        <section className="help-section">
          <h3>Per-occurrence decisions</h3>
          <p>
            You can also reach future occurrences from <strong>Forecast → Table</strong> — tap any
            chip to open the same action menu. <strong>Reset to schedule</strong> appears once
            something has been overridden, and removes the override.
          </p>
          <p>
            Confirmed occurrences get a thin green border on chips so you can see at a glance which
            past chips are settled.
          </p>
        </section>

        <section className="help-section">
          <h3>Reconciliation</h3>
          <p>
            Reconcile is the safety net — work the inbox first so the projection is already
            accurate, then reconcile to absorb any residual delta.
          </p>
          <ol>
            <li>
              From the Dashboard's Accounts section (or the Accounts tab), tap{" "}
              <strong>Reconcile</strong> on the account.
            </li>
            <li>
              The modal shows what the engine expects given scheduled events + inbox decisions.
            </li>
            <li>Enter your actual current bank balance.</li>
            <li>
              If there's a delta, log it as a correction transaction (default on) — your budget
              dashboard then reflects the absorbed amount with a name you choose.
            </li>
          </ol>
          <p>
            On credit cards, "more owed than expected" is logged as an expense (untracked charge),
            not income. The modal warns when the account still has unhandled inbox items so you
            don't accidentally absorb known activity into one mystery delta.
          </p>
        </section>

        <section className="help-section">
          <h3>Budget tracking</h3>
          <ol>
            <li>Add tags to your expenses (e.g., "groceries", "home", "vehicle").</li>
            <li>
              On the Dashboard, tap <strong>Budget targets</strong> and set a monthly dollar target
              for each tag.
            </li>
            <li>
              Confirm scheduled items in the inbox (auto-logs transactions) and use{" "}
              <strong>Log transaction</strong> for one-off spending. Both feed the Dashboard's
              actual-vs-target view.
            </li>
            <li>
              Progress bars color green / yellow / red based on percent-of-target, with a pace
              marker showing how far you are through the month.
            </li>
          </ol>
        </section>

        <section className="help-section">
          <h3>Transfers</h3>
          <p>
            Transfers move money between two accounts (e.g., checking → credit card payment). They
            live on <strong>Cash flows → Transfers</strong>. Net worth stays flat for them — the
            projection chart doesn't move because nothing enters or leaves your total.
          </p>
        </section>
      </div>
    </Modal>
  );
}

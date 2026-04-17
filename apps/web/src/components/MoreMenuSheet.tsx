import {
  Check,
  Download,
  HelpCircle,
  Link as LinkIcon,
  Pencil,
  RefreshCw,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useApp } from "../state";
import { Modal } from "./Modal";
import { ThemeSegmented } from "./ThemeSegmented";

export type MobileAction = "editor" | "manager" | "export" | "import" | "share" | "sync" | "help";

interface Props {
  onClose: () => void;
  /** Fires when the user picks an action that needs its own modal. The parent
   *  component is responsible for rendering that modal — we can't do it here
   *  because the More sheet unmounts when it closes, which would kill the
   *  child modal before it opens. */
  onAction: (action: MobileAction) => void;
}

export function MoreMenuSheet({ onClose, onAction }: Props) {
  const { data, activeProfile, setActiveProfile } = useApp();

  function fire(action: MobileAction) {
    onAction(action);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Settings"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Done
          </button>
        </div>
      }
    >
      <div className="more-menu">
        <section className="more-menu__section">
          <h3 className="more-menu__heading">Profile</h3>
          <div className="more-menu__profiles">
            {data.profiles.length === 0 && <div className="more-menu__empty">No profiles yet</div>}
            {data.profiles.map((profile) => {
              const isActive = profile.id === activeProfile?.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  className={`more-menu__profile ${isActive ? "more-menu__profile--active" : ""}`}
                  onClick={() => {
                    setActiveProfile(profile.id);
                    onClose();
                  }}
                >
                  <UserRound size={16} aria-hidden />
                  <span>{profile.name}</span>
                  {isActive && <Check size={16} aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="more-menu__actions">
            {activeProfile && (
              <button type="button" className="button" onClick={() => fire("editor")}>
                <Pencil size={16} aria-hidden /> Edit active profile…
              </button>
            )}
            <button type="button" className="button" onClick={() => fire("manager")}>
              <UsersRound size={16} aria-hidden /> Manage profiles…
            </button>
          </div>
        </section>

        <section className="more-menu__section">
          <h3 className="more-menu__heading">Appearance</h3>
          <ThemeSegmented />
        </section>

        <section className="more-menu__section">
          <h3 className="more-menu__heading">Data</h3>
          <div className="more-menu__actions">
            <button type="button" className="button" onClick={() => fire("export")}>
              <Download size={16} aria-hidden /> Export data…
            </button>
            <button type="button" className="button" onClick={() => fire("import")}>
              <Upload size={16} aria-hidden /> Import data…
            </button>
            <button type="button" className="button" onClick={() => fire("share")}>
              <LinkIcon size={16} aria-hidden /> Share via link…
            </button>
            <button type="button" className="button" onClick={() => fire("sync")}>
              <RefreshCw size={16} aria-hidden /> Sync devices…
            </button>
            <button type="button" className="button" onClick={() => fire("help")}>
              <HelpCircle size={16} aria-hidden /> Help
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}

import { useState } from "react";
import {
  Check,
  Download,
  Link as LinkIcon,
  Pencil,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useApp } from "../state";
import { Modal } from "./Modal";
import { ThemeSegmented } from "./ThemeSegmented";
import { ProfileEditor } from "./ProfileEditor";
import { ProfileManagerView } from "./ProfileManagerView";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { ShareModal } from "./ShareModal";

interface Props {
  onClose: () => void;
}

/**
 * The mobile "More" sheet — replaces the header actions on small screens.
 * Surfaces everything the desktop header dropdowns expose: profile switching,
 * profile edit, theme, export, and import.
 */
export function MoreMenuSheet({ onClose }: Props) {
  const { data, activeProfile, setActiveProfile } = useApp();

  const [editorOpen, setEditorOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Helper that closes the More sheet first, then opens a child modal.
  // Keeps the modal stack flat — no modal-on-modal layering bugs.
  function openChild(opener: (open: true) => void) {
    onClose();
    // Defer one tick so the parent dialog has a chance to close cleanly
    // before the child mounts.
    requestAnimationFrame(() => opener(true));
  }

  return (
    <>
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
              {data.profiles.length === 0 && (
                <div className="more-menu__empty">No profiles yet</div>
              )}
              {data.profiles.map((profile) => {
                const isActive = profile.id === activeProfile?.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    className={`more-menu__profile ${
                      isActive ? "more-menu__profile--active" : ""
                    }`}
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
                <button
                  type="button"
                  className="button"
                  onClick={() => openChild(setEditorOpen)}
                >
                  <Pencil size={16} aria-hidden /> Edit active profile…
                </button>
              )}
              <button
                type="button"
                className="button"
                onClick={() => openChild(setManagerOpen)}
              >
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
              <button
                type="button"
                className="button"
                onClick={() => openChild(setExportOpen)}
              >
                <Download size={16} aria-hidden /> Export data…
              </button>
              <button
                type="button"
                className="button"
                onClick={() => openChild(setImportOpen)}
              >
                <Upload size={16} aria-hidden /> Import data…
              </button>
              <button
                type="button"
                className="button"
                onClick={() => openChild(setShareOpen)}
              >
                <LinkIcon size={16} aria-hidden /> Share via link…
              </button>
            </div>
          </section>
        </div>
      </Modal>

      {editorOpen && activeProfile && (
        <ProfileEditor profile={activeProfile} onClose={() => setEditorOpen(false)} />
      )}
      {managerOpen && <ProfileManagerView onClose={() => setManagerOpen(false)} />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
    </>
  );
}

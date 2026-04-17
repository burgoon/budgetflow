import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  HelpCircle,
  Link as LinkIcon,
  Pencil,
  RefreshCw,
  Upload,
  UserRound,
} from "lucide-react";
import { useApp } from "../state";
import { loadSyncConfig, type SyncConfig } from "../lib/sync";
import { ProfileEditor } from "./ProfileEditor";
import { ProfileManagerView } from "./ProfileManagerView";
import { ExportModal } from "./ExportModal";
import { ImportModal } from "./ImportModal";
import { ShareModal } from "./ShareModal";
import { SyncSetup } from "./SyncSetup";
import { HelpScreen } from "./HelpScreen";

export function ProfileSwitcher() {
  const { data, activeProfile, setActiveProfile } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      <div className="profile-switcher" ref={menuRef}>
        <button
          type="button"
          className="profile-switcher__trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <UserRound size={16} aria-hidden />
          <span>{activeProfile?.name ?? "No profile"}</span>
          <ChevronDown size={14} aria-hidden />
        </button>
        {menuOpen && (
          <div className="profile-switcher__menu" role="menu">
            {data.profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="profile-switcher__item"
                role="menuitem"
                onClick={() => {
                  setActiveProfile(profile.id);
                  setMenuOpen(false);
                }}
              >
                <span>{profile.name}</span>
                {profile.id === activeProfile?.id && <Check size={14} aria-hidden />}
              </button>
            ))}
            <div className="profile-switcher__divider" />
            {activeProfile && (
              <button
                type="button"
                className="profile-switcher__item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setEditorOpen(true);
                }}
              >
                <span>Edit active profile…</span>
                <Pencil size={14} aria-hidden />
              </button>
            )}
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setManagerOpen(true);
              }}
            >
              Manage profiles…
            </button>
            <div className="profile-switcher__divider" />
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setExportOpen(true);
              }}
            >
              <span>Export data…</span>
              <Download size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setImportOpen(true);
              }}
            >
              <span>Import data…</span>
              <Upload size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setShareOpen(true);
              }}
            >
              <span>Share via link…</span>
              <LinkIcon size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setSyncOpen(true);
              }}
            >
              <span>Sync devices…</span>
              <RefreshCw size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="profile-switcher__item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setHelpOpen(true);
              }}
            >
              <span>Help</span>
              <HelpCircle size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {syncOpen && (
        <SyncSetup
          syncConfig={syncConfig}
          onSyncConfigChange={setSyncConfig}
          onClose={() => setSyncOpen(false)}
        />
      )}
      {editorOpen && activeProfile && (
        <ProfileEditor profile={activeProfile} onClose={() => setEditorOpen(false)} />
      )}
      {managerOpen && <ProfileManagerView onClose={() => setManagerOpen(false)} />}
      {helpOpen && <HelpScreen onClose={() => setHelpOpen(false)} />}
    </>
  );
}

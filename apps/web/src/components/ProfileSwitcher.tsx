import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useApp } from "../state";
import { Modal } from "./Modal";
import { ProfileEditor } from "./ProfileEditor";

export function ProfileSwitcher() {
  const { data, activeProfile, setActiveProfile, createProfile, deleteProfile } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newName, setNewName] = useState("");
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

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createProfile(trimmed);
    setNewName("");
  }

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
          </div>
        )}
      </div>

      {editorOpen && activeProfile && (
        <ProfileEditor profile={activeProfile} onClose={() => setEditorOpen(false)} />
      )}

      <Modal open={managerOpen} onClose={() => setManagerOpen(false)} title="Profiles">
        <div className="profile-manager">
          <ul className="profile-manager__list">
            {data.profiles.length === 0 && (
              <li className="profile-manager__empty">No profiles yet</li>
            )}
            {data.profiles.map((profile) => (
              <li key={profile.id} className="profile-manager__row">
                <button
                  type="button"
                  className="profile-manager__name"
                  onClick={() => setActiveProfile(profile.id)}
                >
                  {profile.id === activeProfile?.id && (
                    <Check size={16} className="profile-manager__check" aria-hidden />
                  )}
                  <span>{profile.name}</span>
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() => {
                    if (confirm(`Delete profile "${profile.name}"? All their data will be removed.`)) {
                      deleteProfile(profile.id);
                    }
                  }}
                  aria-label={`Delete ${profile.name}`}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="profile-manager__add">
            <input
              type="text"
              className="input"
              placeholder="New profile name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAdd();
              }}
            />
            <button
              type="button"
              className="button button--primary"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              <Plus size={16} aria-hidden /> Add
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

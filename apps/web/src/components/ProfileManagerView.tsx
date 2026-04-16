import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useApp } from "../state";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

/** Modal for adding, removing, and switching between profiles. Used by both
 *  the desktop ProfileSwitcher dropdown and the mobile More sheet. */
export function ProfileManagerView({ onClose }: Props) {
  const { data, activeProfile, setActiveProfile, createProfile, deleteProfile } = useApp();
  const [newName, setNewName] = useState("");

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createProfile(trimmed);
    setNewName("");
  }

  return (
    <Modal open onClose={onClose} title="Profiles">
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
                  if (
                    confirm(
                      `Delete profile "${profile.name}"? All their data will be removed.`,
                    )
                  ) {
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
  );
}

import { useState } from "react";
import type { DateFormat, Profile } from "../types";
import { DATE_FORMATS, DEFAULT_DATE_FORMAT } from "../types";
import { useApp } from "../state";
import { formatDate } from "../lib/format";
import { Modal } from "./Modal";

interface Props {
  profile: Profile;
  onClose: () => void;
}

export function ProfileEditor({ profile, onClose }: Props) {
  const { updateProfile } = useApp();
  const [name, setName] = useState(profile.name);
  const [dateFormat, setDateFormat] = useState<DateFormat>(
    profile.dateFormat ?? DEFAULT_DATE_FORMAT,
  );

  const canSave = name.trim().length > 0;
  const sampleDate = new Date();

  function handleSave() {
    updateProfile(profile.id, {
      name: name.trim(),
      dateFormat,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit profile"
      footer={
        <div className="modal__actions">
          <div className="modal__actions-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      }
    >
      <div className="form">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field__label">Date format</span>
          <select
            className="input"
            value={dateFormat}
            onChange={(event) => setDateFormat(event.target.value as DateFormat)}
          >
            {DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {formatDate(sampleDate, format)} ({format})
              </option>
            ))}
          </select>
          <span className="field__hint">
            Applies to date pickers and every date shown across the app.
          </span>
        </label>
      </div>
    </Modal>
  );
}

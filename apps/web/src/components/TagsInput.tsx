import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { addTag, removeTag, tagKey } from "../lib/tags";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Existing tags from elsewhere in the app — shown as quick-pick suggestions
   *  below the input so the user can keep their tag vocabulary consistent. */
  suggestions?: string[];
  placeholder?: string;
  id?: string;
}

/** Chip-style tag input. Type + Enter (or comma) to add; click × on a chip
 *  to remove. Suggestions for unused tags appear as muted pills below. */
export function TagsInput({ value, onChange, suggestions, placeholder, id }: Props) {
  const [draft, setDraft] = useState("");

  const usedKeys = useMemo(() => new Set(value.map(tagKey)), [value]);
  const availableSuggestions = useMemo(
    () => (suggestions ?? []).filter((tag) => !usedKeys.has(tagKey(tag))),
    [suggestions, usedKeys],
  );

  function commitDraft() {
    if (!draft.trim()) return;
    // Allow comma-separated bulk add: "home, vehicle, gas".
    const parts = draft.split(",").map((s) => s.trim()).filter(Boolean);
    let next = value;
    for (const part of parts) {
      next = addTag(next, part);
    }
    onChange(next);
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      // Quick-remove the last chip when backspacing into an empty input.
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tags-input">
      <div className="tags-input__row">
        {value.map((tag) => (
          <span key={tagKey(tag)} className="tags-input__chip">
            <span>{tag}</span>
            <button
              type="button"
              className="tags-input__remove"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(removeTag(value, tag))}
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="tags-input__field"
          value={draft}
          placeholder={value.length === 0 ? (placeholder ?? "Add a tag…") : ""}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
        />
      </div>
      {availableSuggestions.length > 0 && (
        <div className="tags-input__suggestions">
          {availableSuggestions.map((tag) => (
            <button
              key={tagKey(tag)}
              type="button"
              className="tags-input__suggestion"
              onClick={() => onChange(addTag(value, tag))}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

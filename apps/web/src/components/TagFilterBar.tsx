import { tagKey } from "../lib/tags";

interface Props {
  /** All tags currently in use across the entities being filtered. */
  available: string[];
  /** Set of normalized tag keys (lowercased + trimmed) currently active. */
  active: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
}

/** Horizontal row of clickable tag pills for OR-style filtering. */
export function TagFilterBar({ available, active, onToggle, onClear }: Props) {
  if (available.length === 0) return null;
  return (
    <div className="tag-filter">
      {available.map((tag) => {
        const key = tagKey(tag);
        const isOn = active.has(key);
        return (
          <button
            key={key}
            type="button"
            className={`tag-filter__chip ${isOn ? "tag-filter__chip--active" : ""}`}
            onClick={() => onToggle(key)}
            aria-pressed={isOn}
          >
            {tag}
          </button>
        );
      })}
      {active.size > 0 && (
        <button type="button" className="tag-filter__clear" onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  );
}

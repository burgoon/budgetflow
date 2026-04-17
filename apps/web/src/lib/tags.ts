import type { Account, CashFlow } from "../types";

/**
 * Normalize a tag for comparison: trimmed and lowercased. Storage keeps the
 * original casing the user typed; comparison / dedup uses this key.
 */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Add a tag to a list, preserving casing of the first occurrence and
 * deduping case-insensitively. Returns a new array; empty / duplicate
 * inputs are no-ops.
 */
export function addTag(tags: string[], tag: string): string[] {
  const trimmed = tag.trim();
  if (!trimmed) return tags;
  const key = tagKey(trimmed);
  if (tags.some((t) => tagKey(t) === key)) return tags;
  return [...tags, trimmed];
}

export function removeTag(tags: string[], tag: string): string[] {
  const key = tagKey(tag);
  return tags.filter((t) => tagKey(t) !== key);
}

/**
 * Collect every distinct tag across the supplied accounts and cash flows.
 * Result is sorted alphabetically (case-insensitive) and preserves the
 * casing of the first occurrence found.
 */
export function collectAllTags(
  accounts: Account[],
  cashFlows: CashFlow[],
): string[] {
  const seen = new Map<string, string>();
  function ingest(tags: string[] | undefined) {
    if (!tags) return;
    for (const raw of tags) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = tagKey(trimmed);
      if (!seen.has(key)) seen.set(key, trimmed);
    }
  }
  for (const account of accounts) ingest(account.tags);
  for (const cashFlow of cashFlows) ingest(cashFlow.tags);
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

/**
 * Does the entity match the given filter set?
 *   - Empty filter set → matches everything (no filter active).
 *   - Non-empty → entity must have at least one tag in the filter (OR).
 */
export function matchesTagFilter(
  entityTags: string[] | undefined,
  filter: ReadonlySet<string>,
): boolean {
  if (filter.size === 0) return true;
  if (!entityTags || entityTags.length === 0) return false;
  return entityTags.some((tag) => filter.has(tagKey(tag)));
}

import { AppData, EMPTY_APP_DATA } from "./types";

const STORAGE_KEY = "budgetflow:data:v1";

/**
 * Patch any missing fields that were added after the initial schema.
 * Called on every load, import, sync pull, and replaceAllData so the
 * app never sees a partial AppData shape.
 */
export function migrateAppData(data: AppData): AppData {
  if (!Array.isArray(data.transactions)) {
    data.transactions = [];
  }
  return data;
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_APP_DATA);
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 1) return structuredClone(EMPTY_APP_DATA);
    return migrateAppData(parsed);
  } catch (err) {
    console.warn("Failed to load BudgetFlow data from localStorage", err);
    return structuredClone(EMPTY_APP_DATA);
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to persist BudgetFlow data to localStorage", err);
  }
}

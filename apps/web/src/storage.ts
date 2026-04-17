import { AppData, EMPTY_APP_DATA } from "./types";

const STORAGE_KEY = "budgetflow:data:v1";

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_APP_DATA);
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 1) return structuredClone(EMPTY_APP_DATA);
    // Migration: older data may lack the transactions array.
    if (!Array.isArray(parsed.transactions)) {
      parsed.transactions = [];
    }
    return parsed;
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

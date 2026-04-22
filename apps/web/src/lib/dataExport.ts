import type { AppData } from "../types";

/**
 * Export / import format. The wire format is a versioned envelope so we can
 * evolve the schema without breaking older files. AES-GCM encryption is
 * built on the Web Crypto API — no third-party crypto library.
 */

const FORMAT = "budgetflow-export";
const FORMAT_VERSION = 1;
const PBKDF2_ITERATIONS = 200_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;

interface PlainEnvelope {
  format: typeof FORMAT;
  version: typeof FORMAT_VERSION;
  encrypted: false;
  exportedAt: string;
  data: AppData;
}

interface EncryptedEnvelope {
  format: typeof FORMAT;
  version: typeof FORMAT_VERSION;
  encrypted: true;
  exportedAt: string;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

type Envelope = PlainEnvelope | EncryptedEnvelope;

export class PassphraseRequiredError extends Error {
  constructor() {
    super("This export is encrypted. Provide a passphrase.");
    this.name = "PassphraseRequiredError";
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Wrong passphrase, or the file is corrupted.");
    this.name = "WrongPassphraseError";
  }
}

export class InvalidExportError extends Error {
  constructor(message = "This file isn't a BudgetFlow export.") {
    super(message);
    this.name = "InvalidExportError";
  }
}

export interface ImportSummary {
  profiles: number;
  accounts: number;
  cashFlows: number;
  transactions: number;
}

export function summarize(data: AppData): ImportSummary {
  return {
    profiles: data.profiles.length,
    accounts: data.accounts.length,
    cashFlows: data.cashFlows.length,
    transactions: data.transactions?.length ?? 0,
  };
}

export async function exportToJson(data: AppData, passphrase?: string): Promise<string> {
  const exportedAt = new Date().toISOString();
  if (!passphrase) {
    const env: PlainEnvelope = {
      format: FORMAT,
      version: FORMAT_VERSION,
      encrypted: false,
      exportedAt,
      data,
    };
    return JSON.stringify(env, null, 2);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const env: EncryptedEnvelope = {
    format: FORMAT,
    version: FORMAT_VERSION,
    encrypted: true,
    exportedAt,
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(env, null, 2);
}

export interface InspectResult {
  envelope: Envelope;
  isEncrypted: boolean;
  exportedAt: string;
}

/**
 * First step of import: parse + identify the file. Doesn't decrypt — that's
 * what `importFromJson` does once the passphrase (if any) is in hand.
 */
export function inspectExport(jsonText: string): InspectResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new InvalidExportError("Could not parse the file as JSON.");
  }
  if (!isEnvelope(parsed)) {
    throw new InvalidExportError();
  }
  return {
    envelope: parsed,
    isEncrypted: parsed.encrypted,
    exportedAt: parsed.exportedAt,
  };
}

export async function importFromInspect(envelope: Envelope, passphrase?: string): Promise<AppData> {
  if (!envelope.encrypted) {
    if (!isAppData(envelope.data)) {
      throw new InvalidExportError("Export contains malformed data.");
    }
    return envelope.data;
  }
  if (!passphrase) {
    throw new PassphraseRequiredError();
  }
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveKey(passphrase, salt, envelope.iterations);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new WrongPassphraseError();
  }
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(plainBuf));
  } catch {
    throw new InvalidExportError("Decrypted data isn't valid JSON.");
  }
  if (!isAppData(data)) {
    throw new InvalidExportError("Decrypted data is malformed.");
  }
  return data;
}

/**
 * Convenience for the simple case: parse + decrypt in one call. Throws
 * `PassphraseRequiredError` if the file is encrypted and no passphrase
 * was supplied — caller should catch that, prompt, and retry.
 */
export async function importFromJson(jsonText: string, passphrase?: string): Promise<AppData> {
  const { envelope } = inspectExport(jsonText);
  return importFromInspect(envelope, passphrase);
}

/**
 * Re-key every profile / account / cash flow ID so a merge can't collide
 * with anything in the existing data. Inter-record references are
 * rewritten through the same maps so relationships survive the rename.
 */
export function remapImportIds(imported: AppData): AppData {
  const profileMap = new Map<string, string>();
  const accountMap = new Map<string, string>();
  const cashFlowMap = new Map<string, string>();
  for (const profile of imported.profiles) {
    profileMap.set(profile.id, crypto.randomUUID());
  }
  for (const account of imported.accounts) {
    accountMap.set(account.id, crypto.randomUUID());
  }
  for (const cashFlow of imported.cashFlows) {
    cashFlowMap.set(cashFlow.id, crypto.randomUUID());
  }
  return {
    version: 1,
    profiles: imported.profiles.map((p) => ({ ...p, id: profileMap.get(p.id)! })),
    accounts: imported.accounts.map((a) => ({
      ...a,
      id: accountMap.get(a.id)!,
      profileId: profileMap.get(a.profileId) ?? a.profileId,
    })),
    cashFlows: imported.cashFlows.map((c) => ({
      ...c,
      id: cashFlowMap.get(c.id)!,
      profileId: profileMap.get(c.profileId) ?? c.profileId,
      accountId: c.accountId ? (accountMap.get(c.accountId) ?? c.accountId) : null,
      fromAccountId: c.fromAccountId
        ? (accountMap.get(c.fromAccountId) ?? c.fromAccountId)
        : c.fromAccountId,
      toAccountId: c.toAccountId ? (accountMap.get(c.toAccountId) ?? c.toAccountId) : c.toAccountId,
    })),
    transactions: (imported.transactions ?? []).map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      profileId: profileMap.get(t.profileId) ?? t.profileId,
      accountId: accountMap.get(t.accountId) ?? t.accountId,
      cashFlowId: t.cashFlowId ? (cashFlowMap.get(t.cashFlowId) ?? t.cashFlowId) : undefined,
    })),
    activeProfileId: null,
  };
}

export function mergeAppData(existing: AppData, imported: AppData): AppData {
  const remapped = remapImportIds(imported);
  return {
    version: 1,
    profiles: [...existing.profiles, ...remapped.profiles],
    accounts: [...existing.accounts, ...remapped.accounts],
    cashFlows: [...existing.cashFlows, ...remapped.cashFlows],
    transactions: [...existing.transactions, ...remapped.transactions],
    activeProfileId: existing.activeProfileId ?? remapped.profiles[0]?.id ?? null,
  };
}

// ---------------------------------------------------------------- helpers

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function isEnvelope(obj: unknown): obj is Envelope {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (o.format !== FORMAT || o.version !== FORMAT_VERSION) return false;
  if (typeof o.encrypted !== "boolean") return false;
  if (typeof o.exportedAt !== "string") return false;
  if (o.encrypted) {
    return (
      typeof o.iterations === "number" &&
      typeof o.salt === "string" &&
      typeof o.iv === "string" &&
      typeof o.ciphertext === "string"
    );
  }
  return o.data !== undefined;
}

function isAppData(obj: unknown): obj is AppData {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  // `transactions` was added after the initial schema, so accept missing
  // (migrateAppData patches it to []) but reject a wrong type.
  return (
    o.version === 1 &&
    Array.isArray(o.profiles) &&
    Array.isArray(o.accounts) &&
    Array.isArray(o.cashFlows) &&
    (o.transactions === undefined || Array.isArray(o.transactions))
  );
}

export function buildExportFilename(date: Date = new Date(), encrypted = false): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return encrypted
    ? `budgetflow-export-${y}-${m}-${d}.encrypted.json`
    : `budgetflow-export-${y}-${m}-${d}.json`;
}

export function downloadJson(filename: string, jsonText: string): void {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

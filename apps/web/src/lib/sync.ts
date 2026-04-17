import type { AppData } from "../types";

/**
 * Client-side sync engine. Encrypts AppData → pushes to the sync API;
 * polls for remote updates → decrypts and returns them. All crypto happens
 * in the browser — the server stores an opaque blob.
 *
 * Flow:
 *   1. User creates or joins a sync via `createSync` / `joinSync`.
 *   2. `SyncConfig` is saved to localStorage.
 *   3. `pollSync` runs on a 60-second interval + on mount + on visibility.
 *   4. `pushSync` runs debounced after every local data change.
 */

const SYNC_STORAGE_KEY = "budgetflow:sync:v1";
const CONFIG_URL = "/config.json";

export interface SyncConfig {
  code: string;
  /** SHA-256(passphrase + code) hex — sent as x-write-token header. */
  writeToken: string;
  /** Base64-encoded raw 256-bit AES key derived via PBKDF2. Stored so the
   *  user doesn't need to re-enter the passphrase on every visit. */
  keyBase64: string;
  /** ISO timestamp of the last blob we received from the server. */
  lastSyncedAt: string | null;
}

interface ServerConfig {
  syncApiUrl: string;
  syncApiKey: string;
}

let serverConfigCache: ServerConfig | null | undefined;

export async function getServerConfig(): Promise<ServerConfig | null> {
  if (serverConfigCache !== undefined) return serverConfigCache;
  try {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) {
      serverConfigCache = null;
      return null;
    }
    const json = (await res.json()) as Record<string, unknown>;
    if (typeof json.syncApiUrl !== "string" || typeof json.syncApiKey !== "string") {
      serverConfigCache = null;
      return null;
    }
    serverConfigCache = {
      syncApiUrl: json.syncApiUrl,
      syncApiKey: json.syncApiKey,
    };
    return serverConfigCache;
  } catch {
    serverConfigCache = null;
    return null;
  }
}

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncConfig;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  if (config) {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(SYNC_STORAGE_KEY);
  }
}

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function deriveKey(passphrase: string, code: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  // Deterministic salt derived from code + passphrase — both devices
  // compute the same key without exchanging a random salt.
  const saltData = await crypto.subtle.digest("SHA-256", enc.encode(`budgetflow-sync:${code}:${passphrase}`));
  const salt = new Uint8Array(saltData).slice(0, 16);
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 200_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can export the raw bytes for storage
    ["encrypt", "decrypt"],
  );
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

async function importKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64);
  return crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function generateWriteToken(passphrase: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(passphrase + code);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function encryptData(data: AppData, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);
  const json = new TextEncoder().encode(JSON.stringify(data));
  // Compress then encrypt
  const compressed = await deflate(json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    compressed as BufferSource,
  );
  // Pack: iv (12 bytes) + ciphertext
  const packed = new Uint8Array(12 + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), 12);
  return bytesToBase64(packed);
}

async function decryptData(blob: string, keyBase64: string): Promise<AppData> {
  const key = await importKey(keyBase64);
  const packed = base64ToBytes(blob);
  if (packed.length < 13) throw new Error("Sync blob is too short");
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  let plainBuf: ArrayBuffer;
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupted data.");
  }
  const decompressed = await inflate(new Uint8Array(plainBuf));
  return JSON.parse(new TextDecoder().decode(decompressed)) as AppData;
}

/**
 * Set up a new sync slot. Generates a code, derives key + write token,
 * encrypts the current data, and PUTs it to the server. Returns the
 * SyncConfig for the caller to save.
 */
export async function createSync(
  data: AppData,
  passphrase: string,
): Promise<{ config: SyncConfig; code: string }> {
  const server = await getServerConfig();
  if (!server) throw new Error("Sync is not configured on this server.");

  const code = generateCode();
  const key = await deriveKey(passphrase, code);
  const keyBase64 = await exportKey(key);
  const writeToken = await generateWriteToken(passphrase, code);
  const blob = await encryptData(data, keyBase64);

  const res = await fetch(`${server.syncApiUrl}/sync/${code}`, {
    method: "PUT",
    headers: {
      "content-type": "text/plain",
      "x-api-key": server.syncApiKey,
      "x-write-token": writeToken,
    },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error?: string }).error ?? `Server error ${res.status}`);
  }

  const { updatedAt } = (await res.json()) as { updatedAt: string };
  const config: SyncConfig = { code, writeToken, keyBase64, lastSyncedAt: updatedAt };
  return { config, code };
}

/**
 * Join an existing sync slot. GETs the blob, decrypts, and returns the data
 * so the caller can decide whether to replace or merge.
 */
export async function joinSync(
  code: string,
  passphrase: string,
): Promise<{ config: SyncConfig; data: AppData }> {
  const server = await getServerConfig();
  if (!server) throw new Error("Sync is not configured on this server.");

  const normalizedCode = code.toLowerCase();
  const key = await deriveKey(passphrase, normalizedCode);
  const keyBase64 = await exportKey(key);
  const writeToken = await generateWriteToken(passphrase, normalizedCode);

  const res = await fetch(`${server.syncApiUrl}/sync/${normalizedCode}`, {
    method: "GET",
    headers: { "x-api-key": server.syncApiKey },
  });
  if (res.status === 404) throw new Error("Sync code not found.");
  if (!res.ok) throw new Error(`Server error ${res.status}`);

  const json = (await res.json()) as { data: string; updatedAt: string };
  const data = await decryptData(json.data, keyBase64);
  const config: SyncConfig = {
    code: normalizedCode,
    writeToken,
    keyBase64,
    lastSyncedAt: json.updatedAt,
  };
  return { config, data };
}

/**
 * Push the current data to the server. Called after local changes.
 * Returns the new updatedAt timestamp.
 */
export async function pushSync(data: AppData, config: SyncConfig): Promise<string> {
  const server = await getServerConfig();
  if (!server) throw new Error("Sync not configured.");

  const blob = await encryptData(data, config.keyBase64);
  const res = await fetch(`${server.syncApiUrl}/sync/${config.code}`, {
    method: "PUT",
    headers: {
      "content-type": "text/plain",
      "x-api-key": server.syncApiKey,
      "x-write-token": config.writeToken,
    },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Push failed (${res.status})`);
  }
  const { updatedAt } = (await res.json()) as { updatedAt: string };
  return updatedAt;
}

/**
 * Check the server for a newer version. If `updatedAt` is newer than
 * `config.lastSyncedAt`, decrypt and return the data. Otherwise null.
 */
export async function pollSync(config: SyncConfig): Promise<AppData | null> {
  const server = await getServerConfig();
  if (!server) return null;

  const res = await fetch(`${server.syncApiUrl}/sync/${config.code}`, {
    method: "GET",
    headers: { "x-api-key": server.syncApiKey },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;

  const json = (await res.json()) as { data: string; updatedAt: string };
  if (json.updatedAt === config.lastSyncedAt) return null; // No change

  return decryptData(json.data, config.keyBase64);
}

// ---- Compression (same as share.ts) ----

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- Base64 ----

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

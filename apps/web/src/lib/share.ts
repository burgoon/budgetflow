import type { AppData } from "../types";
import {
  InvalidExportError,
  PassphraseRequiredError,
  WrongPassphraseError,
} from "./dataExport";

/**
 * Compact share format for putting an entire AppData blob into a URL fragment.
 *
 * Wire format (binary, then base64url):
 *
 *   [version: 1 byte][flags: 1 byte] (header)
 *   [salt: 16 bytes][iv: 12 bytes]   (only when ENCRYPTED flag is set)
 *   [payload: n bytes]               (deflate-compressed JSON, optionally
 *                                     encrypted)
 *
 * Why binary instead of JSON: a JSON envelope adds ~100 bytes of field-name
 * overhead and forces double base64 (the AES-GCM ciphertext has to be base64'd
 * to embed in JSON, then the whole thing base64url'd for the URL). The packed
 * binary form is the most compact you can get without giving up forward
 * compatibility.
 */

const SHARE_VERSION = 1;
const FLAG_ENCRYPTED = 0x01;
const FLAG_COMPRESSED = 0x02;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 200_000;
const KEY_BITS = 256;

export class InvalidShareError extends InvalidExportError {
  constructor(message = "This share link isn't a valid BudgetFlow link.") {
    super(message);
    this.name = "InvalidShareError";
  }
}

export interface ShareInspectResult {
  isEncrypted: boolean;
  /** Total size of the encoded blob (excluding the URL prefix). */
  size: number;
}

/**
 * Cheap pre-flight for an incoming share. Confirms the header is sane and
 * tells the caller whether to prompt for a passphrase before attempting
 * the (more expensive) decode.
 */
export function inspectShare(encoded: string): ShareInspectResult {
  let buf: Uint8Array;
  try {
    buf = base64UrlToBytes(encoded);
  } catch {
    throw new InvalidShareError("Share link couldn't be decoded.");
  }
  if (buf.length < 2) throw new InvalidShareError();
  const version = buf[0];
  if (version !== SHARE_VERSION) {
    throw new InvalidShareError(
      `Unknown share-link version (${version}). Update BudgetFlow and try again.`,
    );
  }
  const flags = buf[1]!;
  return { isEncrypted: (flags & FLAG_ENCRYPTED) !== 0, size: encoded.length };
}

export interface EncodeShareResult {
  /** The base64url-encoded payload (without the URL prefix). */
  encoded: string;
  /** Full URL ready to share — `<origin><path>#share=<encoded>`. */
  url: string;
  /** Length of the URL string, for "fits in iMessage / SMS" UX hints. */
  urlLength: number;
}

export async function encodeShare(
  data: AppData,
  passphrase?: string,
): Promise<EncodeShareResult> {
  // Step 1: serialize and compress.
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data));
  const compressed = await deflate(jsonBytes);

  // Step 2: optionally encrypt the compressed bytes.
  let payload: Uint8Array;
  let salt: Uint8Array | null = null;
  let iv: Uint8Array | null = null;
  let encrypted = false;
  if (passphrase) {
    salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key = await deriveKey(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      compressed as BufferSource,
    );
    payload = new Uint8Array(ciphertext);
    encrypted = true;
  } else {
    payload = compressed;
  }

  // Step 3: pack version + flags + (optional crypto material) + payload.
  let flags = FLAG_COMPRESSED;
  if (encrypted) flags |= FLAG_ENCRYPTED;
  const headerSize = 2 + (encrypted ? SALT_BYTES + IV_BYTES : 0);
  const buf = new Uint8Array(headerSize + payload.length);
  buf[0] = SHARE_VERSION;
  buf[1] = flags;
  let offset = 2;
  if (encrypted) {
    buf.set(salt!, offset);
    offset += SALT_BYTES;
    buf.set(iv!, offset);
    offset += IV_BYTES;
  }
  buf.set(payload, offset);

  const encoded = bytesToBase64Url(buf);
  const url = buildShareUrl(encoded);
  return { encoded, url, urlLength: url.length };
}

export async function decodeShare(encoded: string, passphrase?: string): Promise<AppData> {
  let buf: Uint8Array;
  try {
    buf = base64UrlToBytes(encoded);
  } catch {
    throw new InvalidShareError("Share link couldn't be decoded.");
  }
  if (buf.length < 2) throw new InvalidShareError();
  const version = buf[0];
  if (version !== SHARE_VERSION) {
    throw new InvalidShareError(
      `Unknown share-link version (${version}). Update BudgetFlow and try again.`,
    );
  }
  const flags = buf[1]!;
  const encrypted = (flags & FLAG_ENCRYPTED) !== 0;
  const compressed = (flags & FLAG_COMPRESSED) !== 0;

  let payload: Uint8Array;
  if (encrypted) {
    if (!passphrase) throw new PassphraseRequiredError();
    const minLen = 2 + SALT_BYTES + IV_BYTES;
    if (buf.length < minLen) throw new InvalidShareError();
    const salt = buf.slice(2, 2 + SALT_BYTES);
    const iv = buf.slice(2 + SALT_BYTES, 2 + SALT_BYTES + IV_BYTES);
    const ciphertext = buf.slice(minLen);
    const key = await deriveKey(passphrase, salt);
    let plain: ArrayBuffer;
    try {
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        ciphertext as BufferSource,
      );
    } catch {
      throw new WrongPassphraseError();
    }
    payload = new Uint8Array(plain);
  } else {
    payload = buf.slice(2);
  }

  const jsonBytes = compressed ? await inflate(payload) : payload;
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    throw new InvalidShareError("Decoded share isn't valid JSON.");
  }
  if (!isAppData(data)) {
    throw new InvalidShareError("Decoded share contains malformed data.");
  }
  return data;
}

/**
 * Extract a share blob from the current URL, if any. Returns null when there
 * is none. Always called from a useEffect on mount; safe to call repeatedly.
 */
export function readShareFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;
  const match = /^#share=(.+)$/.exec(hash);
  return match ? match[1]! : null;
}

/**
 * Strip the `#share=…` from the URL after consuming it so a reload doesn't
 * keep re-prompting to import the same data.
 */
export function clearShareFromHash(): void {
  if (!window.location.hash.startsWith("#share=")) return;
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

function buildShareUrl(encoded: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#share=${encoded}`;
}

// ---------------------------------------------------------------- helpers

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function isAppData(obj: unknown): obj is AppData {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    o.version === 1 &&
    Array.isArray(o.profiles) &&
    Array.isArray(o.accounts) &&
    Array.isArray(o.cashFlows)
  );
}

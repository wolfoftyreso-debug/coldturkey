import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadConfig } from '../config.js';

/**
 * Field-level encryption for the free text people write.
 *
 * The threat this closes is not a live attacker with a valid session — row
 * level security handles that. It is the copy of the data that leaves the
 * database: a backup restored on a laptop, a replica on a decommissioned
 * disk, a snapshot in an object store, an operator running a SELECT. Row
 * level security protects none of those, and everything it fails to protect
 * here is somebody's craving log, their relapse notes, and their coach
 * transcript.
 *
 * Design, and the reasoning for each choice:
 *
 * **AES-256-GCM, not pgcrypto.** Encrypting inside the database with a key the
 * database can read protects against nothing, because anyone who can read the
 * ciphertext can read the key. The key here lives in the application's secret
 * store and never enters Postgres.
 *
 * **Additional authenticated data binds every value to its row.** The AAD is
 * `tenant/table/column/rowOwner`. Without it, an attacker with write access to
 * one column could move a ciphertext from their own row into somebody else's —
 * or from a `note` into a `why_statement` — and the decryption would succeed.
 * Confidentiality alone is not enough when the attacker can shuffle records.
 *
 * **Versioned keys.** The stored format names the key that encrypted it, so a
 * rotation re-encrypts lazily rather than requiring downtime and a migration
 * that rewrites every row at once.
 *
 * **What is deliberately NOT encrypted:** anything a query filters, sorts or
 * joins on. Encrypting an indexed column silently turns lookups into full
 * scans or breaks them outright. Nothing currently queried is encrypted here —
 * checked, not assumed — and adding a WHERE clause on one of these columns has
 * to be a deliberate decision, not a surprise in production.
 */

const MAGIC = 'c1';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export interface FieldRef {
  tenantId: string;
  table: string;
  column: string;
  /** The user the row belongs to. Part of the AAD, so rows cannot be swapped. */
  ownerId: string;
}

interface KeyRing {
  active: string;
  keys: Map<string, Buffer>;
}

let ring: KeyRing | null = null;

/**
 * Parse `id:base64,id2:base64` into a keyring.
 *
 * Keys are 32 bytes. A short key is refused rather than padded — silently
 * accepting a weak key is how a deployment ends up with encryption that looks
 * present and is not.
 */
function loadKeyRing(): KeyRing | null {
  const config = loadConfig();
  const raw = config.FIELD_ENCRYPTION_KEYS?.trim();
  if (!raw) return null;

  const keys = new Map<string, Buffer>();
  for (const entry of raw.split(',')) {
    const [id, material] = entry.split(':');
    if (!id || !material) {
      throw new Error('FIELD_ENCRYPTION_KEYS must be a comma-separated list of id:base64key');
    }
    const key = Buffer.from(material.trim(), 'base64');
    if (key.length !== 32) {
      throw new Error(`FIELD_ENCRYPTION_KEYS: key "${id.trim()}" is ${key.length} bytes, need 32`);
    }
    keys.set(id.trim(), key);
  }

  const active = config.FIELD_ENCRYPTION_ACTIVE_KEY?.trim() || [...keys.keys()][0];
  if (!active || !keys.has(active)) {
    throw new Error('FIELD_ENCRYPTION_ACTIVE_KEY does not name a key in FIELD_ENCRYPTION_KEYS');
  }
  return { active, keys };
}

function keyring(): KeyRing | null {
  if (ring === null) ring = loadKeyRing();
  return ring;
}

/** Test seam — the keyring is module state. */
export function resetKeyRing(): void {
  ring = null;
}

export function encryptionEnabled(): boolean {
  return keyring() !== null;
}

/**
 * Build the keyring now, so an unusable key fails the boot rather than every
 * write.
 *
 * Called from `server.ts` before anything is served. The ring is otherwise
 * built lazily on the first encrypted field, which means a bad key — measured:
 * 29 bytes where 32 are required — produces a process that starts cleanly,
 * passes every probe, and returns 500 the first time somebody tries to save a
 * craving note, a why statement or a message to the coach. A healthy pod
 * serving a product that cannot store anything.
 *
 * Throwing here turns that into a failed rollout, which is where it belongs.
 * Whether a deployment may run with no keys at all is a different question, and
 * one the production configuration guard already answers.
 */
export function assertKeyRingUsable(): void {
  // Throws when the value is present but malformed; returns null when there is
  // simply nothing configured.
  keyring();
}

function aad(ref: FieldRef): Buffer {
  return Buffer.from(`${ref.tenantId}/${ref.table}/${ref.column}/${ref.ownerId}`, 'utf8');
}

/**
 * Encrypt a value. Returns the input unchanged when no keyring is configured,
 * so a deployment without keys still works — and `encryptionEnabled()` plus
 * the production boot guard are what stop that being a silent downgrade.
 */
export function encryptField(value: string | null | undefined, ref: FieldRef): string | null {
  if (value === null || value === undefined) return null;
  const rings = keyring();
  if (!rings) return value;

  const key = rings.keys.get(rings.active);
  if (!key) throw new Error('active field encryption key is missing');

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad(ref));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    MAGIC,
    rings.active,
    nonce.toString('base64url'),
    Buffer.concat([ciphertext, tag]).toString('base64url'),
  ].join('.');
}

/**
 * Decrypt a value.
 *
 * Plaintext passes through untouched, which is what makes this deployable
 * against an existing database: rows written before encryption was switched on
 * keep working, and get encrypted the next time they are written.
 *
 * A value that looks encrypted but fails to authenticate throws. That is
 * deliberate — returning the ciphertext or an empty string would show somebody
 * a blank craving log instead of telling an operator the data is damaged or
 * the wrong key is loaded.
 */
export function decryptField(stored: string | null | undefined, ref: FieldRef): string | null {
  if (stored === null || stored === undefined) return null;
  if (!stored.startsWith(`${MAGIC}.`)) return stored;

  const parts = stored.split('.');
  if (parts.length !== 4) throw new Error('malformed encrypted field');
  const [, keyId, nonceB64, payloadB64] = parts as [string, string, string, string];

  const rings = keyring();
  if (!rings) {
    throw new Error(
      'encrypted data found but FIELD_ENCRYPTION_KEYS is not configured — refusing to guess',
    );
  }
  const key = rings.keys.get(keyId);
  if (!key) throw new Error(`no key "${keyId}" in the keyring; it may have been rotated out`);

  const nonce = Buffer.from(nonceB64, 'base64url');
  const payload = Buffer.from(payloadB64, 'base64url');
  if (nonce.length !== NONCE_BYTES || payload.length < TAG_BYTES) {
    throw new Error('malformed encrypted field');
  }

  const ciphertext = payload.subarray(0, payload.length - TAG_BYTES);
  const tag = payload.subarray(payload.length - TAG_BYTES);

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad(ref));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** True when a stored value is in the encrypted envelope. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(`${MAGIC}.`);
}

/**
 * Constant-time equality for two ciphertexts, for the rare caller comparing
 * stored values without decrypting.
 */
export function sameCiphertext(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

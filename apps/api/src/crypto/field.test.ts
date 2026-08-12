import { describe, expect, it, beforeAll } from 'vitest';
import { resetConfig } from '../config.js';
import {
  assertKeyRingUsable,
  decryptField,
  encryptField,
  encryptionEnabled,
  isEncrypted,
  resetKeyRing,
} from './field.js';

/** Config is read once and cached, which is right in production and needs a
 *  seam here: changing the environment alone would not reach the keyring. */
function reload(): void {
  resetConfig();
  resetKeyRing();
}

/**
 * Unit tests for the envelope itself. The end-to-end proof — that what lands
 * in Postgres is ciphertext — lives in app.test.ts, because that is the only
 * place it can be checked against a real database.
 */
const REF = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  table: 'coach_messages',
  column: 'content',
  ownerId: '22222222-2222-2222-2222-222222222222',
};

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEYS = `k1:${Buffer.alloc(32, 7).toString('base64')},k2:${Buffer.alloc(32, 9).toString('base64')}`;
  process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'k1';
  reload();
});

describe('field encryption', () => {
  it('round-trips a value', () => {
    const sealed = encryptField('jag drack igår och skäms', REF);
    expect(sealed).not.toContain('drack');
    expect(isEncrypted(sealed)).toBe(true);
    expect(decryptField(sealed, REF)).toBe('jag drack igår och skäms');
  });

  it('produces a different ciphertext every time', () => {
    // A deterministic ciphertext would leak that two people wrote the same
    // thing, and on a small set of common phrases that is most of the content.
    const a = encryptField('samma text', REF);
    const b = encryptField('samma text', REF);
    expect(a).not.toBe(b);
    expect(decryptField(a, REF)).toBe(decryptField(b, REF));
  });

  it('refuses a ciphertext moved to another user', () => {
    // The attack this blocks: someone with write access to one column copies a
    // ciphertext from their own row into somebody else's, or from a note into
    // a why statement. Without the AAD binding both would decrypt cleanly.
    const sealed = encryptField('mitt varför', REF)!;
    expect(() => decryptField(sealed, { ...REF, ownerId: 'someone-else' })).toThrow();
    expect(() => decryptField(sealed, { ...REF, tenantId: 'another-tenant' })).toThrow();
    expect(() => decryptField(sealed, { ...REF, column: 'why_statement' })).toThrow();
    expect(() => decryptField(sealed, { ...REF, table: 'cravings' })).toThrow();
  });

  it('detects a tampered ciphertext rather than returning wrong plaintext', () => {
    const sealed = encryptField('tio dagar nu', REF)!;
    const parts = sealed.split('.');
    const payload = Buffer.from(parts[3]!, 'base64url');
    payload[0] = payload[0]! ^ 0xff;
    parts[3] = payload.toString('base64url');
    expect(() => decryptField(parts.join('.'), REF)).toThrow();
  });

  it('leaves plaintext written before encryption was switched on alone', () => {
    // What makes this deployable against an existing database.
    expect(decryptField('an old unencrypted note', REF)).toBe('an old unencrypted note');
    expect(isEncrypted('an old unencrypted note')).toBe(false);
  });

  it('decrypts with a retired key while encrypting with the active one', () => {
    process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'k2';
    reload();
    const withK2 = encryptField('efter rotation', REF)!;
    expect(withK2.split('.')[1]).toBe('k2');

    process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'k1';
    reload();
    // Rotation must not strand data written by the previous key.
    expect(decryptField(withK2, REF)).toBe('efter rotation');
  });

  it('refuses a key that is not 32 bytes rather than padding it', () => {
    process.env.FIELD_ENCRYPTION_KEYS = `short:${Buffer.alloc(16, 1).toString('base64')}`;
    process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'short';
    reload();
    expect(() => encryptField('x', REF)).toThrow(/32/);

    process.env.FIELD_ENCRYPTION_KEYS = `k1:${Buffer.alloc(32, 7).toString('base64')}`;
    process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'k1';
    reload();
  });

  it('passes null through', () => {
    expect(encryptField(null, REF)).toBeNull();
    expect(decryptField(null, REF)).toBeNull();
  });
});

describe('a bad key stops the boot, not every write', () => {
  // Measured before this guard existed: a 29-byte key let the API start
  // cleanly, pass its probes, and return 500 on the first attempt to save
  // anything a person had written.
  it('refuses a key that is the wrong length', () => {
    process.env.FIELD_ENCRYPTION_KEYS = 'short:ZTJlLWtleS1lMmUta2V5LWUyZS1rZXktZTJlLWs=';
    resetConfig();
    resetKeyRing();
    expect(() => assertKeyRingUsable()).toThrow(/29 bytes, need 32/);
  });

  it('refuses an active key id that names nothing', () => {
    process.env.FIELD_ENCRYPTION_KEYS = 'a:ZTJlLWtleS1mb3ItdGVzdHMtb25seS0zMi1ieXRlcyE=';
    process.env.FIELD_ENCRYPTION_ACTIVE_KEY = 'b';
    resetConfig();
    resetKeyRing();
    expect(() => assertKeyRingUsable()).toThrow(/does not name a key/);
  });

  it('accepts a well-formed keyring', () => {
    process.env.FIELD_ENCRYPTION_KEYS = 'a:ZTJlLWtleS1mb3ItdGVzdHMtb25seS0zMi1ieXRlcyE=';
    delete process.env.FIELD_ENCRYPTION_ACTIVE_KEY;
    resetConfig();
    resetKeyRing();
    expect(() => assertKeyRingUsable()).not.toThrow();
    expect(encryptionEnabled()).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  currentCode,
  generateRecoveryCodes,
  generateSecret,
  normaliseRecoveryCode,
  otpauthUri,
  verifyCode,
} from './totp.js';

describe('TOTP', () => {
  it('matches the RFC 6238 test vector', () => {
    // The RFC's SHA-1 key is the ASCII "12345678901234567890". Checking
    // against the published vector is the only way to know this implementation
    // agrees with the authenticator app somebody will actually use — a
    // home-grown TOTP that is self-consistent and wrong is worse than none,
    // because it locks people out of their own accounts.
    const secret = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
    // T = 59s → counter 1, the first vector in the RFC's table.
    expect(currentCode(secret, 59_000)).toBe('287082');
    expect(currentCode(secret, 1_111_111_109_000)).toBe('081804');
    expect(currentCode(secret, 1_234_567_890_000)).toBe('005924');
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 127, 128, 255, 42, 17]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('accepts the current code and rejects a wrong one', () => {
    const secret = generateSecret();
    expect(verifyCode(secret, currentCode(secret))).toBe(true);
    expect(verifyCode(secret, '000000')).toBe(false);
  });

  it('tolerates one step of clock drift and no more', () => {
    const secret = generateSecret();
    const now = 1_700_000_000_000;
    expect(verifyCode(secret, currentCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyCode(secret, currentCode(secret, now + 30_000), now)).toBe(true);
    // Two steps out is a code that has been valid for over a minute. Every
    // extra step widens the window an intercepted code stays usable in.
    expect(verifyCode(secret, currentCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyCode(secret, currentCode(secret, now + 90_000), now)).toBe(false);
  });

  it('rejects anything that is not six digits', () => {
    const secret = generateSecret();
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56']) {
      expect(verifyCode(secret, bad), `accepted ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('builds an otpauth URI an authenticator can read', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'someone@cleat.app');
    expect(uri).toMatch(/^otpauth:\/\/totp\/Cleat%3Asomeone%40cleat\.app\?/);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });

  it('generates distinct recovery codes that normalise consistently', () => {
    const codes = generateRecoveryCodes(20);
    expect(new Set(codes).size).toBe(20);
    // Typed back with different case, spacing or separators, a code must
    // still match — somebody reading one off paper at 2am should not be
    // defeated by a hyphen.
    const canonical = normaliseRecoveryCode('AbCd-1234-EfGh-5678');
    expect(canonical).toBe('abcd1234efgh5678');
    for (const variant of ['abcd1234efgh5678', 'ABCD 1234 EFGH 5678', 'abcd_1234_efgh_5678']) {
      expect(normaliseRecoveryCode(variant)).toBe(canonical);
    }
    expect(normaliseRecoveryCode(codes[0]!)).toHaveLength(16);
  });

  it('generates a secret long enough to be worth having', () => {
    // 20 bytes is the RFC 4226 recommendation; a short secret is brute
    // forceable offline once a backup leaks.
    expect(base32Decode(generateSecret())).toHaveLength(20);
  });
});

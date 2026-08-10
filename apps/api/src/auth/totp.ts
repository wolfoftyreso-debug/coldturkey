import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords, RFC 6238.
 *
 * Written rather than pulled in for the same reason as the SMTP client: this
 * is roughly forty lines of HMAC and base32, and a dependency here would be
 * one more package trusted inside a process that holds recovery data and
 * signing keys.
 *
 * Why it matters for this product specifically: an account here is not a
 * shopping history. Somebody who takes it over can read a relapse log and a
 * coach transcript — the material for blackmail, a custody dispute, or an
 * employer. A password plus an email address is thin protection for that, and
 * email is exactly what an abusive partner with access to the household
 * account already has.
 */

const DIGITS = 6;
const STEP_SECONDS = 30;
/**
 * How many steps either side of now are accepted.
 *
 * One step, not three. Every extra step widens the window an intercepted code
 * stays valid in, and phone clocks are rarely more than a few seconds out.
 */
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(): string {
  // 20 bytes is the RFC 4226 recommendation and what authenticator apps expect.
  return base32Encode(randomBytes(20));
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  // SHA-1 is correct here and not a weakness: HOTP uses it as an HMAC, where
  // collision resistance is not the property relied on, and every
  // authenticator app implements exactly this.
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentCode(secret: string, now = Date.now()): string {
  return codeForStep(secret, Math.floor(now / 1000 / STEP_SECONDS));
}

/**
 * Verify a code, in constant time across the accepted window.
 *
 * Comparing with `===` and returning early would leak, through timing, which
 * step matched — narrow, but free to avoid.
 */
export function verifyCode(secret: string, submitted: string, now = Date.now()): boolean {
  const candidate = submitted.replace(/\D/g, '');
  if (candidate.length !== DIGITS) return false;

  const step = Math.floor(now / 1000 / STEP_SECONDS);
  let matched = false;
  for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset += 1) {
    const expected = Buffer.from(codeForStep(secret, step + offset), 'utf8');
    const actual = Buffer.from(candidate, 'utf8');
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) matched = true;
  }
  return matched;
}

/**
 * The URI an authenticator app scans. The secret is in it, so this string is
 * as sensitive as the secret itself: shown once, never logged, never stored.
 */
export function otpauthUri(secret: string, account: string, issuer = 'Cleat'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Recovery codes, for the phone that ends up in a river.
 *
 * Without them, losing the device means losing the account — and losing an
 * account here means losing the record of the hardest thing somebody has done.
 * That is a worse outcome than the one 2FA is protecting against, so recovery
 * codes are not optional.
 */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(10)).slice(0, 16).toLowerCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  });
}

export function normaliseRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

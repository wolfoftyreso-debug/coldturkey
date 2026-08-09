import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Client } from 'pg';
import { translate, type Locale } from '@cleat/i18n';
import { loadConfig } from '../config.js';
import { mailer } from '../mail/smtp.js';

/**
 * Password reset and email verification.
 *
 * The rule that shapes everything here: only hashes are stored. A leaked
 * database must not yield working reset links, for the same reason it must not
 * yield working refresh tokens. The plaintext exists once, in the mail, and
 * nowhere else — not in the database, not in a log, not in an error message.
 */

export type TokenPurpose = 'password_reset' | 'email_verification';

/**
 * A reset link is a bearer credential for somebody's recovery history. 32
 * random bytes is 256 bits; base64url keeps it URL-safe without escaping.
 */
function mintToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Short enough that a link left in an inbox stops working, long enough to
 * survive a slow relay and somebody checking mail after work. Verification
 * gets longer because nothing is locked while it is pending.
 */
const TTL_MINUTES: Record<TokenPurpose, number> = {
  password_reset: 60,
  email_verification: 60 * 24 * 7,
};

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Issue a token, invalidating any outstanding one for the same purpose.
 *
 * Invalidating first matters: without it, every request leaves another live
 * link, and someone who requests a reset five times has five working keys
 * scattered across their mailbox.
 */
export async function issueToken(
  client: Client,
  input: { tenantId: string; userId: string; purpose: TokenPurpose; ip?: string | null },
): Promise<IssuedToken> {
  const { token, hash } = mintToken();
  const minutes = TTL_MINUTES[input.purpose];

  await client.query(
    `UPDATE account_tokens
        SET consumed_at = now()
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [input.userId, input.purpose],
  );

  const { rows } = await client.query<{ expires_at: Date }>(
    `INSERT INTO account_tokens (tenant_id, user_id, purpose, token_hash, expires_at, requested_ip)
     VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval, $6)
     RETURNING expires_at`,
    [input.tenantId, input.userId, input.purpose, hash, String(minutes), input.ip ?? null],
  );

  const expiresAt = rows[0]?.expires_at;
  if (!expiresAt) throw new Error('Failed to issue account token');
  return { token, expiresAt };
}

export interface ConsumedToken {
  userId: string;
}

/**
 * Verify and consume a token in one step.
 *
 * The UPDATE ... RETURNING is deliberate: checking then updating leaves a
 * window where two requests both see an unconsumed row and both succeed, and
 * "single use" that is only usually single use is not a property worth
 * claiming. The database decides, once.
 */
export async function consumeToken(
  client: Client,
  purpose: TokenPurpose,
  token: string,
): Promise<ConsumedToken | null> {
  if (!token || token.length > 512) return null;
  const hash = hashToken(token);

  const { rows } = await client.query<{ user_id: string }>(
    `UPDATE account_tokens
        SET consumed_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING user_id`,
    [hash, purpose],
  );

  const row = rows[0];
  return row ? { userId: row.user_id } : null;
}

/**
 * Constant-time comparison for the rare caller that needs to compare two
 * tokens directly. `timingSafeEqual` throws on length mismatch, which is
 * itself a leak, so lengths are equalised through the hash first.
 */
export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(hashToken(a), 'hex');
  const right = Buffer.from(hashToken(b), 'hex');
  return timingSafeEqual(left, right);
}

function link(path: string, token: string): string {
  const base = loadConfig().PUBLIC_WEB_URL.replace(/\/+$/, '');
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetMail(
  to: string,
  locale: Locale,
  token: string,
): Promise<void> {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  await mailer().send({
    to,
    subject: t('mail.reset.subject'),
    text: [
      t('mail.reset.body'),
      link('/reset', token),
      t('mail.reset.expiry', { hours: TTL_MINUTES.password_reset / 60 }),
      t('mail.reset.ignore'),
      t('mail.signature'),
    ].join('\n\n'),
  });
}

export async function sendVerificationMail(
  to: string,
  locale: Locale,
  token: string,
): Promise<void> {
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  await mailer().send({
    to,
    subject: t('mail.verify.subject'),
    text: [t('mail.verify.body'), link('/verify', token), t('mail.signature')].join('\n\n'),
  });
}

/**
 * Housekeeping. Consumed and expired rows are kept for a while so that "this
 * link was already used" stays answerable and an audit shows the reset
 * happened, then dropped.
 */
export async function purgeExpiredTokens(client: Client): Promise<number> {
  const { rowCount } = await client.query(
    `DELETE FROM account_tokens WHERE expires_at < now() - interval '30 days'`,
  );
  return rowCount ?? 0;
}

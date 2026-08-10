import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { withTenant } from '../db/pool.js';
import { writeAudit } from '../db/repository.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { authenticate, currentUser } from '../plugins/auth.js';
import { verifyPassword } from '../auth/password.js';
import { decryptField, encryptField } from '../crypto/field.js';
import {
  generateRecoveryCodes,
  generateSecret,
  normaliseRecoveryCode,
  otpauthUri,
  verifyCode,
} from '../auth/totp.js';

/**
 * Two-factor enrolment and management.
 *
 * The login half lives in `auth.ts`, because that is where the password is
 * checked and where the challenge has to be issued.
 *
 * Enrolment is a two-step deliberately: a secret is generated and shown, and
 * nothing is switched on until the person proves they can produce a code from
 * it. Enabling on the first request would lock people out of their own
 * accounts whenever a QR code failed to scan.
 */

const hashCode = (code: string): string =>
  createHash('sha256').update(normaliseRecoveryCode(code)).digest('hex');

export async function twoFactorRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  /**
   * Begin enrolment. Returns the secret and the otpauth URI once; neither is
   * ever returned again, and the secret is stored encrypted.
   */
  app.post('/v1/auth/totp/setup', async (request) => {
    const user = currentUser(request);
    if (user.totp_enabled_at) {
      throw badRequest('totp_already_enabled', 'Two-factor is already switched on');
    }

    const secret = generateSecret();
    await withTenant(user.tenant_id, async (client) => {
      await client.query('UPDATE users SET totp_secret = $1, totp_enabled_at = NULL WHERE id = $2', [
        encryptField(secret, {
          tenantId: user.tenant_id,
          table: 'users',
          column: 'totp_secret',
          ownerId: user.id,
        }),
        user.id,
      ]);
    });

    return { secret, uri: otpauthUri(secret, user.email) };
  });

  /**
   * Finish enrolment by proving a code, and receive the recovery codes.
   *
   * The recovery codes are returned exactly once. Without them a lost phone
   * means a lost account, and losing an account here means losing the record
   * of the hardest thing somebody has done — a worse outcome than the one 2FA
   * is protecting against.
   */
  app.post('/v1/auth/totp/enable', async (request) => {
    const user = currentUser(request);
    const body = z.object({ code: z.string().min(6).max(10) }).parse(request.body);

    if (user.totp_enabled_at) {
      throw badRequest('totp_already_enabled', 'Two-factor is already switched on');
    }
    const secret = decryptField(user.totp_secret ?? null, {
      tenantId: user.tenant_id,
      table: 'users',
      column: 'totp_secret',
      ownerId: user.id,
    });
    if (!secret) throw badRequest('totp_not_started', 'Start enrolment first');
    if (!verifyCode(secret, body.code)) throw badRequest('totp_invalid', 'That code did not match');

    const codes = generateRecoveryCodes();
    await withTenant(user.tenant_id, async (client) => {
      await client.query('UPDATE users SET totp_enabled_at = now() WHERE id = $1', [user.id]);
      // Replace any codes from a previous enrolment rather than adding to them.
      await client.query('DELETE FROM totp_recovery_codes WHERE user_id = $1', [user.id]);
      for (const code of codes) {
        await client.query(
          `INSERT INTO totp_recovery_codes (tenant_id, user_id, code_hash) VALUES ($1, $2, $3)`,
          [user.tenant_id, user.id, hashCode(code)],
        );
      }
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'auth.totp_enabled',
      });
    });

    return { enabled: true, recoveryCodes: codes };
  });

  /**
   * Switch it off. Requires the password, not just a session.
   *
   * Otherwise a borrowed access token could remove the second factor and then
   * use the account freely — which would make 2FA protection that any attacker
   * who already got in can simply take off.
   */
  app.post('/v1/auth/totp/disable', async (request) => {
    const user = currentUser(request);
    const body = z.object({ password: z.string().min(1) }).parse(request.body);

    const ok = await withTenant(user.tenant_id, async (client) => {
      const { rows } = await client.query<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.id],
      );
      const stored = rows[0]?.password_hash;
      return stored ? verifyPassword(body.password, stored) : false;
    });
    if (!ok) throw unauthorized('Invalid credentials');

    await withTenant(user.tenant_id, async (client) => {
      await client.query(
        'UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL WHERE id = $1',
        [user.id],
      );
      await client.query('DELETE FROM totp_recovery_codes WHERE user_id = $1', [user.id]);
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'auth.totp_disabled',
      });
    });

    return { enabled: false };
  });

  /** Status, and how many recovery codes are left to use. */
  app.get('/v1/auth/totp', async (request) => {
    const user = currentUser(request);
    const remaining = await withTenant(user.tenant_id, async (client) => {
      const { rows } = await client.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM totp_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
        [user.id],
      );
      return Number(rows[0]?.count ?? '0');
    });
    return {
      enabled: Boolean(user.totp_enabled_at),
      enabledAt: user.totp_enabled_at ?? null,
      recoveryCodesRemaining: remaining,
    };
  });
}

/** Shared with the login path in `auth.ts`. */
export { hashCode as hashRecoveryCode };

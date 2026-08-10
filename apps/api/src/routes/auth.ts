import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from '../auth/password.js';
import {
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../auth/tokens.js';
import { loadConfig } from '../config.js';
import { withTenant } from '../db/pool.js';
import { createUser, findUserByEmail, findUserById, writeAudit } from '../db/repository.js';
import { ensureDefaultTenant, findTenantBySlug, tenantSlugFromRequest } from '../db/tenants.js';
import { badRequest, conflict, forbidden, tooManyRequests, unauthorized } from '../lib/errors.js';
import {
  consumeToken,
  issueToken,
  sendPasswordResetMail,
  sendVerificationMail,
} from '../auth/recovery.js';
import {
  FAILURES_PER_ACCOUNT,
  FAILURES_PER_IP,
  RESETS_PER_ACCOUNT,
  accountKey,
  clearFailures,
  ipKey,
  isLockedOut,
  recordFailure,
  resetKey,
} from '../auth/lockout.js';
import { authenticate, currentUser } from '../plugins/auth.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string(),
  displayName: z.string().max(80).optional(),
  locale: z.enum(['sv', 'en']).optional(),
  country: z.string().length(2).optional(),
  timezone: z.string().max(64).optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const config = loadConfig();

  app.post(
    '/v1/auth/register',
    {
      // Bounded separately from the global ceiling, which would allow 300 a
      // minute from one address. See SIGNUP_LIMIT_MAX for why this is
      // deliberately generous rather than tight.
      config: {
        rateLimit: { max: config.SIGNUP_LIMIT_MAX, timeWindow: config.SIGNUP_LIMIT_WINDOW },
      },
    },
    async (request, reply) => {
    const body = registerBody.parse(request.body);

    const problem = passwordProblem(body.password);
    if (problem) throw badRequest('weak_password', problem);

    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );

    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);
    if (!tenant) throw badRequest('unknown_tenant', 'Unknown tenant');

    // Organisations decide who joins them. Only the shared consumer tenant is
    // open to self-signup, and only when the deployment allows it at all.
    const publicSignup =
      tenant.slug === config.DEFAULT_TENANT_SLUG
        ? config.ALLOW_PUBLIC_SIGNUP
        : tenant.settings?.publicSignup === true;
    if (!publicSignup) throw forbidden('This tenant does not allow self sign-up');

    const passwordHash = await hashPassword(body.password);

    const result = await withTenant(tenant.id, async (client) => {
      const existing = await findUserByEmail(client, body.email);
      if (existing) throw conflict('email_taken', 'An account with that email already exists');

      const user = await createUser(client, {
        tenantId: tenant.id,
        email: body.email,
        passwordHash,
        displayName: body.displayName ?? '',
        locale: body.locale,
        country: body.country,
        timezone: body.timezone,
      });

      const refresh = createRefreshToken();
      await client.query(
        `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)`,
        [tenant.id, user.id, refresh.hash, String(config.REFRESH_TOKEN_TTL_DAYS)],
      );
      await writeAudit(client, {
        tenantId: tenant.id,
        userId: user.id,
        action: 'auth.register',
      });

      // Issued inside the same transaction as the user, so an account can
      // never exist without one.
      const verification = await issueToken(client, {
        tenantId: tenant.id,
        userId: user.id,
        purpose: 'email_verification',
        ip: request.ip,
      });

      return { user, refreshToken: refresh.token, verification };
    });

    // Sent after the commit, and a failure here does not fail the request.
    // Registration succeeding while the mail fails is recoverable — the person
    // can ask for it again — whereas rolling the registration back because a
    // relay hiccuped loses the account they just made.
    try {
      await sendVerificationMail(
        result.user.email,
        result.user.locale as 'sv' | 'en',
        result.verification.token,
      );
    } catch (error) {
      request.log.error({ err: error }, 'verification mail failed');
    }

    const accessToken = await signAccessToken({
      sub: result.user.id,
      tid: tenant.id,
      role: result.user.role,
      ver: result.user.token_version,
    });

    return reply.code(201).send({
      accessToken,
      refreshToken: result.refreshToken,
      user: publicUser(result.user),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    });
    },
  );

  app.post('/v1/auth/login', async (request, reply) => {
    const body = loginBody.parse(request.body);

    const byIp = ipKey(request.ip);
    const byAccount = accountKey(body.email);
    if (
      (await isLockedOut(byIp, FAILURES_PER_IP)) ||
      (await isLockedOut(byAccount, FAILURES_PER_ACCOUNT))
    ) {
      // Deliberately the same message as a wrong password: telling an attacker
      // they found a real account worth locking is free information.
      throw tooManyRequests('Invalid credentials');
    }
    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );
    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);
    if (!tenant) throw unauthorized('Invalid credentials');

    const result = await withTenant(tenant.id, async (client) => {
      const user = await findUserByEmail(client, body.email);
      // Verify against a real hash when the account does not exist, so the
      // work is the same either way. The previous placeholder was malformed,
      // so verification failed to parse and returned early — measured at 57ms
      // faster than a wrong password, which is an account oracle with extra
      // steps.
      const stored = user?.password_hash ?? DUMMY_PASSWORD_HASH;
      const ok = await verifyPassword(body.password, stored);
      if (!user || !ok) return null;

      const refresh = createRefreshToken();
      await client.query(
        `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)`,
        [tenant.id, user.id, refresh.hash, String(config.REFRESH_TOKEN_TTL_DAYS)],
      );
      await client.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]);
      return { user, refreshToken: refresh.token };
    });

    if (!result) {
      await recordFailure(byIp);
      await recordFailure(byAccount);
      throw unauthorized('Invalid credentials');
    }

    await clearFailures([byIp, byAccount]);

    const accessToken = await signAccessToken({
      sub: result.user.id,
      tid: tenant.id,
      role: result.user.role,
      ver: result.user.token_version,
    });

    return reply.send({
      accessToken,
      refreshToken: result.refreshToken,
      user: publicUser(result.user),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    });
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const body = refreshBody.parse(request.body);
    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );
    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);
    if (!tenant) throw unauthorized('Invalid refresh token');

    const hash = hashRefreshToken(body.refreshToken);

    const result = await withTenant(tenant.id, async (client) => {
      const { rows } = await client.query<{ user_id: string }>(
        `SELECT user_id FROM refresh_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
        [hash],
      );
      const row = rows[0];
      if (!row) {
        // Not live. If this hash was ever issued, the token has been consumed
        // already and is now being replayed — proof that two parties hold it.
        // Rotation alone only meant the loser of that race got a 401 and
        // signed in again, while the winner kept a working session. End every
        // session for the account instead: an inconvenience for the real
        // person, and the end of the thief's access.
        const { rows: seen } = await client.query<{ user_id: string }>(
          'SELECT user_id FROM refresh_tokens WHERE token_hash = $1',
          [hash],
        );
        const owner = seen[0]?.user_id;
        if (owner) {
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = now()
              WHERE user_id = $1 AND revoked_at IS NULL`,
            [owner],
          );
          await client.query(
            'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
            [owner],
          );
          await writeAudit(client, {
            tenantId: tenant.id,
            userId: owner,
            action: 'auth.refresh_token_reuse_detected',
          });
        }
        return null;
      }

      // Rotate on every use: a stolen refresh token is good for one request, and
      // replaying it trips the branch above.
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [
        hash,
      ]);
      const next = createRefreshToken();
      await client.query(
        `INSERT INTO refresh_tokens (tenant_id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)`,
        [tenant.id, row.user_id, next.hash, String(config.REFRESH_TOKEN_TTL_DAYS)],
      );

      const user = await findUserById(client, row.user_id);
      if (!user) return null;
      return { user, refreshToken: next.token };
    });

    if (!result) throw unauthorized('Invalid refresh token');

    const accessToken = await signAccessToken({
      sub: result.user.id,
      tid: tenant.id,
      role: result.user.role,
      ver: result.user.token_version,
    });

    return reply.send({
      accessToken,
      refreshToken: result.refreshToken,
      user: publicUser(result.user),
    });
  });

  const forgotBody = z.object({ email: z.string().email() });
  const resetBody = z.object({
    token: z.string().min(1),
    password: z.string().min(1),
  });

  /**
   * Request a password reset.
   *
   * Always answers 202, whether or not the address belongs to an account.
   * Anything else turns this endpoint into a membership oracle: "is this
   * person in a recovery app" is exactly the question an employer, an insurer
   * or an abusive partner would like answered, and it is not a question this
   * product will answer for anyone.
   *
   * The rate limits are the same two counters the login path uses, because
   * without them the oracle comes back as a timing difference.
   */
  app.post('/v1/auth/forgot-password', async (request, reply) => {
    const body = forgotBody.parse(request.body);
    const email = body.email.trim().toLowerCase();

    const byIp = ipKey(request.ip);
    const byAccount = resetKey(email);
    if (
      (await isLockedOut(byIp, FAILURES_PER_IP)) ||
      (await isLockedOut(byAccount, RESETS_PER_ACCOUNT))
    ) {
      // Still 202. A throttled request that answered differently would be the
      // membership oracle this endpoint exists to avoid.
      return reply.code(202).send({ status: 'accepted' });
    }
    await recordFailure(byIp);
    await recordFailure(byAccount);

    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );
    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);

    if (tenant) {
      await withTenant(tenant.id, async (client) => {
        const user = await findUserByEmail(client, email);
        if (!user) return;
        const { token } = await issueToken(client, {
          tenantId: tenant.id,
          userId: user.id,
          purpose: 'password_reset',
          ip: request.ip,
        });
        await writeAudit(client, {
          tenantId: tenant.id,
          userId: user.id,
          action: 'auth.password_reset_requested',
        });
        // Awaited so a relay outage surfaces as a 5xx in the logs rather than
        // an unhandled rejection, but the reply is the same either way.
        try {
          await sendPasswordResetMail(user.email, user.locale as 'sv' | 'en', token);
        } catch (error) {
          request.log.error({ err: error }, 'password reset mail failed');
        }
      });
    }

    return reply.code(202).send({ status: 'accepted' });
  });

  /**
   * Complete a password reset.
   *
   * Consuming the token also revokes every refresh token for the account. A
   * reset is what somebody does when they believe another person is in their
   * account, and leaving that person's sessions alive would make the reset
   * cosmetic.
   */
  app.post('/v1/auth/reset-password', async (request, reply) => {
    const body = resetBody.parse(request.body);
    const problem = passwordProblem(body.password);
    if (problem) throw badRequest('weak_password', problem);

    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );
    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);
    if (!tenant) throw badRequest('invalid_token', 'This link is no longer valid');

    const resetEmail = await withTenant(tenant.id, async (client) => {
      const consumed = await consumeToken(client, 'password_reset', body.token);
      if (!consumed) return null;

      const hash = await hashPassword(body.password);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        hash,
        consumed.userId,
      ]);
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now()
          WHERE user_id = $1 AND revoked_at IS NULL`,
        [consumed.userId],
      );
      await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [
        consumed.userId,
      ]);
      await writeAudit(client, {
        tenantId: tenant.id,
        userId: consumed.userId,
        action: 'auth.password_reset_completed',
      });

      const user = await findUserById(client, consumed.userId);
      return user?.email ?? '';
    });

    if (resetEmail === null) throw badRequest('invalid_token', 'This link is no longer valid');

    // Clear the login lockout as well. The person just proved control of the
    // mailbox, and leaving them locked out immediately after a successful
    // reset is the product fighting itself — especially since the lockout is
    // what sent many of them here.
    if (resetEmail) await clearFailures([accountKey(resetEmail), resetKey(resetEmail)]);
    return reply.send({ status: 'ok' });
  });

  /** Confirm an email address. Idempotent — a second click is not an error. */
  app.post('/v1/auth/verify-email', async (request, reply) => {
    const body = z.object({ token: z.string().min(1) }).parse(request.body);
    const slug = tenantSlugFromRequest(
      request.headers['x-tenant'] as string | undefined,
      request.headers.host,
    );
    const tenant =
      slug === config.DEFAULT_TENANT_SLUG
        ? await ensureDefaultTenant()
        : await findTenantBySlug(slug);
    if (!tenant) throw badRequest('invalid_token', 'This link is no longer valid');

    const done = await withTenant(tenant.id, async (client) => {
      const consumed = await consumeToken(client, 'email_verification', body.token);
      if (!consumed) return false;
      await client.query(
        'UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1',
        [consumed.userId],
      );
      await writeAudit(client, {
        tenantId: tenant.id,
        userId: consumed.userId,
        action: 'auth.email_verified',
      });
      return true;
    });

    if (!done) throw badRequest('invalid_token', 'This link is no longer valid');
    return reply.send({ status: 'ok' });
  });

  app.post('/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const user = currentUser(request);
    await withTenant(user.tenant_id, async (client) => {
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [user.id],
      );
      // And the access token. Revoking only the refresh token left the bearer
      // working for its full fifteen minutes — on a shared machine, fifteen
      // minutes of somebody's recovery record after they thought they had
      // left.
      await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [
        user.id,
      ]);
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'auth.logout',
      });
    });
    return reply.code(204).send();
  });
}

export function publicUser(user: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  locale: string;
  country: string;
  timezone: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    locale: user.locale,
    country: user.country,
    timezone: user.timezone,
  };
}

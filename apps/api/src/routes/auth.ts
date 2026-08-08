import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, passwordProblem, verifyPassword } from '../auth/password.js';
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
import { authenticate, currentUser } from '../plugins/auth.js';

/**
 * Credential-stuffing brake.
 *
 * The global limit is 300/minute because opening the craving screen repeatedly
 * is the product working as intended. Applying that same number to the login
 * endpoint means 300 password guesses a minute against an account holding
 * somebody's relapse history.
 *
 * Two counters, because one attacker hammering a single account and one
 * spraying many look nothing alike. The per-account limit is tight. The per-IP
 * limit is deliberately far looser, because mobile carriers put thousands of
 * real people behind one address via CGNAT — a tight per-IP number does not
 * stop an attacker with a botnet and does lock out everyone on a phone
 * network. That asymmetry is the whole design.
 *
 * Only failures count. An earlier version incremented on every attempt, which
 * meant ordinary successful logins consumed the quota and the shared-IP case
 * locked out immediately.
 *
 * Both counters are in memory, which is the honest limit here: with more than
 * one replica each pod counts separately, so the effective ceiling multiplies
 * by replica count. A shared store is the follow-up; a stricter imperfect
 * number today still beats 300.
 */
const FAILURES_PER_IP = 100;
const FAILURES_PER_ACCOUNT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface Attempt {
  failures: number;
  resetAt: number;
}

const loginFailures = new Map<string, Attempt>();

function isLockedOut(key: string, limit: number, now: number): boolean {
  const existing = loginFailures.get(key);
  if (!existing || existing.resetAt <= now) return false;
  return existing.failures >= limit;
}

function recordFailure(key: string, now: number): void {
  const existing = loginFailures.get(key);
  if (!existing || existing.resetAt <= now) {
    loginFailures.set(key, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  existing.failures += 1;
}

/** Clear on success, so someone who mistypes twice and then gets it right is not punished. */
function clearFailures(keys: string[]): void {
  for (const key of keys) loginFailures.delete(key);
}

/**
 * Drop expired entries so the map cannot grow without bound on an endpoint
 * anyone can reach unauthenticated — otherwise the brake becomes the leak.
 */
function sweepFailures(now: number): void {
  if (loginFailures.size < 10_000) return;
  for (const [key, attempt] of loginFailures) {
    if (attempt.resetAt <= now) loginFailures.delete(key);
  }
}

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

  app.post('/v1/auth/register', async (request, reply) => {
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

      return { user, refreshToken: refresh.token };
    });

    const accessToken = await signAccessToken({
      sub: result.user.id,
      tid: tenant.id,
      role: result.user.role,
    });

    return reply.code(201).send({
      accessToken,
      refreshToken: result.refreshToken,
      user: publicUser(result.user),
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = loginBody.parse(request.body);

    const now = Date.now();
    sweepFailures(now);
    const ipKey = `ip:${request.ip}`;
    const accountKey = `account:${body.email.trim().toLowerCase()}`;
    if (
      isLockedOut(ipKey, FAILURES_PER_IP, now) ||
      isLockedOut(accountKey, FAILURES_PER_ACCOUNT, now)
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
      // Hash a throwaway password when the account does not exist so that a
      // missing account and a wrong password take about the same time.
      const stored = user?.password_hash ?? 'scrypt$AAAA$AAAA';
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
      recordFailure(ipKey, now);
      recordFailure(accountKey, now);
      throw unauthorized('Invalid credentials');
    }

    clearFailures([ipKey, accountKey]);

    const accessToken = await signAccessToken({
      sub: result.user.id,
      tid: tenant.id,
      role: result.user.role,
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
      if (!row) return null;

      // Rotate on every use: a stolen refresh token is good for one request, and
      // the legitimate client's next refresh reveals that the theft happened.
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
    });

    return reply.send({
      accessToken,
      refreshToken: result.refreshToken,
      user: publicUser(result.user),
    });
  });

  app.post('/v1/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    const user = currentUser(request);
    await withTenant(user.tenant_id, async (client) => {
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [user.id],
      );
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

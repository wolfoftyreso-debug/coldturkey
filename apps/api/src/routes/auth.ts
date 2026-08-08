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
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.js';
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

    if (!result) throw unauthorized('Invalid credentials');

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

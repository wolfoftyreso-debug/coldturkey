import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../auth/tokens.js';
import { withTenant } from '../db/pool.js';
import { findUserById, type UserRow } from '../db/repository.js';
import { unauthorized } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Populated by `authenticate`. Absent on public routes. */
    currentUser?: UserRow;
  }
}

function bearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw unauthorized();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw unauthorized();
  return token;
}

/**
 * Authenticate a request and attach the user.
 *
 * The tenant comes from the signed token, never from a header. A client that
 * changes `X-Tenant` after logging in still reads and writes inside its own
 * tenant, because that is the value fed to `app.tenant_id` and therefore to
 * every row-level security policy.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const claims = await verifyAccessToken(bearerToken(request));

  const user = await withTenant(claims.tid, async (client) => findUserById(client, claims.sub));
  if (!user) throw unauthorized('Account not found');

  request.currentUser = user;
}

/** Read the authenticated user, or fail loudly if a route forgot the hook. */
export function currentUser(request: FastifyRequest): UserRow {
  if (!request.currentUser) throw unauthorized();
  return request.currentUser;
}

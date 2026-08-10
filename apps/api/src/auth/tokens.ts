import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { loadConfig } from '../config.js';
import { unauthorized } from '../lib/errors.js';

export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  /** Tenant id — the value that becomes `app.tenant_id` for the request. */
  tid: string;
  role: 'member' | 'admin' | 'owner';
  /**
   * The account's session generation. A stateless JWT cannot be recalled, so
   * signing out, resetting a password, or detecting a stolen refresh token
   * bumps this column and every token issued before the bump stops verifying.
   */
  ver: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(loadConfig().JWT_SECRET);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const config = loadConfig();
  return new SignJWT({ tid: claims.tid, role: claims.role, ver: claims.ver })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('cleat')
    .setAudience('cleat-app')
    .setExpirationTime(config.ACCESS_TOKEN_TTL)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'cleat',
      audience: 'cleat-app',
    });
    if (typeof payload.sub !== 'string' || typeof payload.tid !== 'string') {
      throw unauthorized('Malformed token');
    }
    const role = payload.role;
    return {
      sub: payload.sub,
      tid: payload.tid,
      role: role === 'admin' || role === 'owner' ? role : 'member',
      // Tokens minted before this claim existed verify as generation 0, which
      // is the default on the column — so an upgrade does not sign everybody
      // out at the moment of deploy.
      ver: typeof payload.ver === 'number' ? payload.ver : 0,
    };
  } catch {
    // Never leak why: expired, wrong signature and malformed all look the same
    // to an attacker probing the endpoint.
    throw unauthorized('Invalid or expired token');
  }
}

/**
 * Refresh tokens are opaque random strings. Only their SHA-256 hash is stored,
 * so a leaked database backup does not hand out live sessions.
 */
export function createRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

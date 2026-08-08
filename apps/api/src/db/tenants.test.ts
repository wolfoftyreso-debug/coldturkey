import { beforeAll, describe, expect, it } from 'vitest';
import { tenantSlugFromRequest } from './tenants.js';

/**
 * Tenant resolution from the request.
 *
 * These exist because of a real bug: an IPv4 Host header was being parsed as a
 * subdomain, so `127.0.0.1:8080` resolved to the tenant `127` and every request
 * to a bare address failed with `unknown_tenant`. Unit tests using Fastify's
 * `inject` never caught it — the default injected host is `localhost`, which
 * happens to take the safe path. It only surfaced when the container was run for
 * real and something talked to it by address.
 */
beforeAll(() => {
  process.env.DATABASE_URL ??= 'postgres://localhost:5432/unused';
  process.env.JWT_SECRET ??= 'unit-test-secret-that-is-long-enough-here';
});

describe('tenantSlugFromRequest', () => {
  it('prefers an explicit header over anything in the host', () => {
    expect(tenantSlugFromRequest('Clinic-North', 'other.nivora.example')).toBe(
      'clinic-north',
    );
  });

  it('ignores a blank header', () => {
    expect(tenantSlugFromRequest('   ', 'clinic.nivora.example')).toBe('clinic');
  });

  it('reads an organisation subdomain', () => {
    expect(tenantSlugFromRequest(undefined, 'clinic.nivora.example')).toBe('clinic');
    expect(tenantSlugFromRequest(undefined, 'CLINIC.nivora.example:443')).toBe('clinic');
  });

  describe('falls back to the default tenant', () => {
    const cases: [string, string | undefined][] = [
      ['no host at all', undefined],
      ['empty host', ''],
      ['localhost', 'localhost'],
      ['localhost with a port', 'localhost:3000'],
      ['a bare domain', 'nivora.example'],
      ['the www subdomain', 'www.nivora.example'],
      ['the api subdomain', 'api.nivora.example'],
      ['the app subdomain', 'app.nivora.example'],
      // The regression: four dot-separated parts that are not a subdomain.
      ['an IPv4 address', '127.0.0.1'],
      ['an IPv4 address with a port', '127.0.0.1:8080'],
      ['a private IPv4 address', '10.42.0.15:8080'],
      ['a bracketed IPv6 address', '[::1]:8080'],
      ['a bare IPv6 address', '::1'],
      ['a Kubernetes service name', 'nivora-api'],
    ];

    for (const [name, host] of cases) {
      it(name, () => {
        expect(tenantSlugFromRequest(undefined, host)).toBe('public');
      });
    }
  });

  it('still resolves a real subdomain that merely looks numeric-adjacent', () => {
    expect(tenantSlugFromRequest(undefined, 'clinic2.nivora.example')).toBe('clinic2');
  });
});

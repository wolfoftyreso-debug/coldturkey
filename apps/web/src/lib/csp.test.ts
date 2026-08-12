import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain JS, shared with next.config.mjs which cannot import TS.
import { buildCsp, connectSrc } from '../../csp.mjs';

/**
 * The bug these tests exist for.
 *
 * `connect-src` was written as `'self' ${process.env.NEXT_PUBLIC_API_URL ?? ''}`
 * and evaluated in the *running server*. The Kubernetes web Deployment set no
 * such variable, so in production the policy collapsed to `connect-src 'self'`
 * while the client bundle — built with the variable set — called an absolute
 * cross-origin URL. Every API call was refused by the browser.
 *
 * Nothing server-side could see it: the pod was healthy, the readiness probe on
 * /login passed, no request reached the API, no error was logged. The only
 * symptom was that signing in did nothing. It was found by driving a real
 * browser through a real signup, not by reading the manifests.
 */

function directive(csp: string, name: string): string {
  const found = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} in ${csp}`);
  return found.slice(name.length + 1).trim();
}

/** What the browser will actually do with a request, given the policy. */
function permitsRequestTo(csp: string, url: string, pageOrigin: string): boolean {
  const sources = directive(csp, 'connect-src').split(/\s+/);
  const target = new URL(url, pageOrigin);
  if (sources.includes("'self'") && target.origin === new URL(pageOrigin).origin) return true;
  return sources.some((source) => {
    if (source.startsWith("'")) return false;
    try {
      return new URL(source).origin === target.origin;
    } catch {
      return false;
    }
  });
}

describe('connect-src permits the API the client was built to call', () => {
  it('allows same-origin calls when no API URL is configured', () => {
    // Production: API_BASE is '' and the client requests '/v1/auth/login'.
    const csp = buildCsp(undefined);
    expect(directive(csp, 'connect-src')).toBe("'self'");
    expect(permitsRequestTo(csp, '/v1/auth/login', 'https://app.cleat.example')).toBe(true);
  });

  it('allows the cross-origin API when one is configured', () => {
    const csp = buildCsp('http://localhost:8080');
    expect(permitsRequestTo(csp, 'http://localhost:8080/v1/auth/login', 'http://localhost:3000')).toBe(
      true,
    );
  });

  it('refuses a cross-origin API that was not configured — the shipped bug', () => {
    // The build inlined http://localhost:8080; the server was started without
    // it. This is the exact combination that broke, and it must stay broken in
    // the test so the pairing is never quietly loosened.
    const csp = buildCsp(undefined);
    expect(permitsRequestTo(csp, 'http://localhost:8080/v1/auth/login', 'http://localhost:3000')).toBe(
      false,
    );
  });

  it('strips a path down to an origin, which is all a CSP source may be', () => {
    expect(connectSrc('https://api.cleat.example/v1/')).toBe("'self' https://api.cleat.example");
  });

  it('keeps a non-default port, since that is part of the origin', () => {
    expect(connectSrc('http://localhost:8080')).toBe("'self' http://localhost:8080");
  });

  it('refuses to build a policy from a value that is not a URL', () => {
    // Booting with a broken policy would produce a server that passes every
    // probe and serves an app in which nothing works.
    expect(() => buildCsp('api.cleat.example')).toThrow(/not a valid URL/);
  });

  it('treats blank and whitespace as same-origin rather than as an error', () => {
    expect(() => buildCsp('   ')).not.toThrow();
    expect(directive(buildCsp('   '), 'connect-src')).toBe("'self'");
  });
});

describe('the rest of the policy stays closed', () => {
  const csp = buildCsp(undefined);

  it.each([
    ['default-src', "'self'"],
    ['frame-ancestors', "'none'"],
    ['base-uri', "'none'"],
    ['object-src', "'none'"],
    ['form-action', "'self'"],
  ])('%s is %s', (name, expected) => {
    expect(directive(csp, name)).toBe(expected);
  });

  it('never allows an off-origin script source', () => {
    expect(directive(csp, 'script-src')).toBe("'self' 'unsafe-inline'");
  });
});

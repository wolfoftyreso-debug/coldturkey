/**
 * The Content-Security-Policy, in one place, so the header and the code that
 * has to live under it cannot drift apart.
 *
 * This is plain JavaScript rather than TypeScript because `next.config.mjs` is
 * loaded by Node directly, before any compiler runs. `src/lib/csp.test.ts`
 * imports the same functions, so the policy the browser receives is the policy
 * under test.
 */

/**
 * Build the `connect-src` value that permits `apiBase`.
 *
 * Empty means the API is same-origin, which is what production runs and what
 * lets one built image serve any hostname.
 */
export function connectSrc(apiBase) {
  const origin = (apiBase ?? '').trim();
  if (!origin) return "'self'";
  try {
    // Only an origin belongs in a CSP source list; a trailing path is ignored
    // by some browsers and rejected by others.
    return `'self' ${new URL(origin).origin}`;
  } catch {
    // An unparseable value must not silently widen the policy, and must not
    // silently narrow it either — `buildCsp` refuses to start instead.
    return "'self'";
  }
}

/**
 * Assemble the full policy.
 *
 * Throws when `NEXT_PUBLIC_API_URL` is set to something that is not a URL.
 * Failing to boot is the correct outcome: the alternative is a server that
 * starts, looks healthy to every probe, and serves an app in which the browser
 * refuses every single API call. That failure is invisible server-side — no
 * log, no 5xx, no failing readiness check — which is precisely why it has to
 * be caught here.
 */
export function buildCsp(apiBase) {
  const configured = (apiBase ?? '').trim();
  if (configured) {
    try {
      new URL(configured);
    } catch {
      throw new Error(
        `NEXT_PUBLIC_API_URL is not a valid URL: ${JSON.stringify(configured)}. ` +
          'Leave it unset when the API is served on the same origin.',
      );
    }
  }

  return [
    "default-src 'self'",
    // 'unsafe-inline' on script-src stays, and this is a measured decision
    // rather than an unfinished one.
    //
    // Nonces were implemented and tested: middleware issuing a per-request
    // nonce with 'strict-dynamic', scoped to the routes that render user
    // content. Under it the app was completely dead — zero scripts carried the
    // nonce, every chunk was refused, and the login page did nothing. Next only
    // stamps nonces when a page renders dynamically, and every page here is a
    // statically prerendered client component. `export const dynamic =
    // 'force-dynamic'` does not change that for a client component with no
    // server data.
    //
    // Making it work means restructuring twelve pages away from static
    // rendering. The threat it would close is an XSS, and this codebase has no
    // dangerouslySetInnerHTML, no innerHTML, no eval and no Function() — React
    // escapes everything, which is asserted by the security audit. Against a
    // compromised dependency, 'strict-dynamic' would not help either: a
    // poisoned chunk is loaded by the nonced bootstrap and inherits its trust.
    //
    // So the cost is high, the benefit is thin, and the honest record is that
    // it was tried rather than skipped.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // The value that matters most here: a stored XSS in a craving note cannot
    // exfiltrate to an attacker's host, because the browser will not open the
    // connection.
    `connect-src ${connectSrc(configured)}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

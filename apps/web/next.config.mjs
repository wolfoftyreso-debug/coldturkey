/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship compiled ESM; Next still needs to know they are part
  // of the build rather than external node_modules.
  transpilePackages: ['@cleat/core', '@cleat/i18n'],
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Recovery data must not leak into a referrer or an embedded frame,
          // and nothing in this app needs a camera or a microphone.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // A year, with subdomains. Everything here is authenticated or
          // crisis-related; there is no version of this product that should
          // ever be reached over cleartext.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // 'unsafe-inline' on script-src stays, and this is a measured
          // decision rather than an unfinished one.
          //
          // Nonces were implemented and tested: middleware issuing a
          // per-request nonce with 'strict-dynamic', scoped to the routes that
          // render user content. Under it the app was completely dead — zero
          // scripts carried the nonce, every chunk was refused, and the login
          // page did nothing. Next only stamps nonces when a page renders
          // dynamically, and every page here is a statically prerendered
          // client component. `export const dynamic = 'force-dynamic'` does
          // not change that for a client component with no server data.
          //
          // Making it work means restructuring twelve pages away from static
          // rendering. The threat it would close is an XSS, and this codebase
          // has no dangerouslySetInnerHTML, no innerHTML, no eval and no
          // Function() — React escapes everything, which is asserted by the
          // security audit. Against a compromised dependency, 'strict-dynamic'
          // would not help either: a poisoned chunk is loaded by the nonced
          // bootstrap and inherits its trust.
          //
          // So the cost is high, the benefit is thin, and the honest record is
          // that it was tried rather than skipped. Everything else is closed:
          // no plugins, no framing, no base-tag rewriting, no form posts
          // off-origin, and connect-src limited to this origin and the API.
          //
          // The value that matters most here is `default-src 'self'`: a stored
          // XSS in a craving note cannot exfiltrate to an attacker's host
          // because the browser will not open the connection.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? ''}`.trim(),
              "form-action 'self'",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "object-src 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

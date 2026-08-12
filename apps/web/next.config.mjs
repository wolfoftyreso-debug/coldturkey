import { buildCsp } from './csp.mjs';

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
          // The policy itself lives in `csp.mjs`, because it has to be built
          // from exactly the same rule the client code is compiled against and
          // the same rule the tests assert. See the note in `src/lib/apiBase.ts`
          // for why this header, alone among the ones here, has a build-time
          // twin that it must agree with.
          //
          // Note that this runs in the *server* process: `next start` reads the
          // environment it is launched with, not the one the build saw.
          {
            key: 'Content-Security-Policy',
            value: buildCsp(process.env.NEXT_PUBLIC_API_URL),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

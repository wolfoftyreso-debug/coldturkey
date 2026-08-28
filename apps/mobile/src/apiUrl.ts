/**
 * Where the mobile client sends its requests, decided at build time.
 *
 * Extracted from the Expo config so it can be tested. It decides whether a
 * release binary ships at all, and "we read it carefully" is not a standard
 * for a decision whose failure mode is an app on the store that cannot reach
 * its server.
 */
export interface ResolveInput {
  /** EXPO_PUBLIC_API_URL, verbatim. */
  apiUrl: string | undefined;
  /** EAS_BUILD_PROFILE, NODE_ENV, or 'development'. */
  profile: string;
}

export function isReleaseProfile(profile: string): boolean {
  return profile === 'production' || profile === 'preview';
}

export function resolveApiUrl({ apiUrl, profile }: ResolveInput): string {
  const release = isReleaseProfile(profile);
  const value = apiUrl?.trim();

  if (!value) {
    if (release) {
      throw new Error(
        `EXPO_PUBLIC_API_URL is required for a "${profile}" build.\n` +
          'Without it the binary would ship pointing at http://localhost:8080, which on a ' +
          'phone means the phone itself — every request fails, and the failure only shows ' +
          "up after the build is in somebody's hands.",
      );
    }
    // Local development against `pnpm --filter @cleat/api dev`. Simulators
    // reach the host on localhost; a physical device on the same wifi needs
    // EXPO_PUBLIC_API_URL set to the machine's LAN address.
    return 'http://localhost:8080';
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL is not a URL: ${value}`);
  }

  // Cleartext to anything but a local development host is blocked by iOS App
  // Transport Security and by Android's default network config — and would be
  // a session token for somebody's addiction history travelling in the open.
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && !release)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be https for a "${profile}" build (got ${parsed.protocol}//).`,
    );
  }

  // A trailing slash here becomes `//v1/...` in every request path.
  return value.replace(/\/+$/, '');
}

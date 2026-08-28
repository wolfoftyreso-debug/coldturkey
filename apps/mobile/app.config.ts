import type { ExpoConfig } from 'expo/config';
import { resolveApiUrl } from './src/apiUrl.ts';

/**
 * Expo config, evaluated at build time.
 *
 * This was `app.json`, with `extra.apiUrl` set to `http://localhost:8080`.
 * Building a release from that produces an app on somebody's phone that tries
 * to reach a server on the phone itself — over cleartext, which iOS App
 * Transport Security and Android's default network security config both
 * refuse outright. The build succeeds, the store accepts it, and every screen
 * fails with a network error the moment a real person opens it.
 *
 * So the URL comes from the environment, and a production build without one
 * does not produce a broken app — it does not produce an app. That is the
 * same argument the API makes when it refuses to boot without an encryption
 * key: a build that fails is a bug report, and a binary that silently talks to
 * nowhere is not.
 */

/** Set by EAS on cloud builds; `development` locally. */
const profile = process.env.EAS_BUILD_PROFILE ?? process.env.NODE_ENV ?? 'development';

const config: ExpoConfig = {
  name: 'Cleat',
  slug: 'cleat',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cleat',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0b0d0f',
  splash: {
    backgroundColor: '#0b0d0f',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.cleat.client',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.cleat.client',
    adaptiveIcon: {
      backgroundColor: '#0b0d0f',
    },
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    apiUrl: resolveApiUrl({ apiUrl: process.env.EXPO_PUBLIC_API_URL, profile }),
    tenant: process.env.EXPO_PUBLIC_TENANT?.trim() || 'public',
  },
};

export default config;

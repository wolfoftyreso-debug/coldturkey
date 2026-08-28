import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './apiUrl.js';

/**
 * The build-time decision that used to be a hardcoded string.
 *
 * `app.json` shipped `extra.apiUrl = "http://localhost:8080"`. A release built
 * from that is an app on somebody's phone trying to reach a server on the
 * phone itself, over cleartext that both platforms refuse. Nothing fails until
 * a real person opens it.
 */
describe('resolveApiUrl', () => {
  it('refuses to build a release with no API URL', () => {
    expect(() => resolveApiUrl({ apiUrl: undefined, profile: 'production' })).toThrow(
      /EXPO_PUBLIC_API_URL is required/,
    );
    expect(() => resolveApiUrl({ apiUrl: '   ', profile: 'preview' })).toThrow(
      /EXPO_PUBLIC_API_URL is required/,
    );
  });

  it('still lets a developer run against a local API', () => {
    expect(resolveApiUrl({ apiUrl: undefined, profile: 'development' })).toBe(
      'http://localhost:8080',
    );
    expect(resolveApiUrl({ apiUrl: 'http://localhost:8080', profile: 'development' })).toBe(
      'http://localhost:8080',
    );
  });

  it('refuses cleartext in a release, localhost included', () => {
    expect(() => resolveApiUrl({ apiUrl: 'http://api.cleat.se', profile: 'production' })).toThrow(
      /must be https/,
    );
    // Especially localhost: that is the exact binary this whole change exists
    // to stop shipping.
    expect(() => resolveApiUrl({ apiUrl: 'http://localhost:8080', profile: 'production' })).toThrow(
      /must be https/,
    );
  });

  it('accepts a real production URL', () => {
    expect(resolveApiUrl({ apiUrl: 'https://api.cleat.se', profile: 'production' })).toBe(
      'https://api.cleat.se',
    );
  });

  it('strips a trailing slash that would double every request path', () => {
    expect(resolveApiUrl({ apiUrl: 'https://api.cleat.se/', profile: 'production' })).toBe(
      'https://api.cleat.se',
    );
    expect(resolveApiUrl({ apiUrl: 'https://api.cleat.se///', profile: 'preview' })).toBe(
      'https://api.cleat.se',
    );
  });

  it('rejects something that is not a URL at all', () => {
    expect(() => resolveApiUrl({ apiUrl: 'api.cleat.se', profile: 'production' })).toThrow(
      /is not a URL/,
    );
  });
});

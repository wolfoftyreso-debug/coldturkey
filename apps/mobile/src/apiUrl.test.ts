import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * The screen that was missing.
 *
 * Mobile could edit a why statement and nothing else: no way to create a quit
 * plan, which meant no streak, no milestones and no reclaimed time. The whole
 * product, waiting on a screen that did not exist — and mobile is where
 * somebody who found us by searching "sluta röka" on a phone would live.
 *
 * Read as text rather than rendered, because rendering React Native in a Node
 * test runner buys a large dependency and proves less than the bundle step
 * that already runs in CI.
 */
describe('the mobile plan screen can start a plan', () => {
  const screen = readFileSync(join(import.meta.dirname, '../app/plan.tsx'), 'utf8');

  it('posts a quit plan', () => {
    expect(screen).toContain("'/v1/quit'");
    expect(screen).toContain('baselineUnitsPerDay');
    expect(screen).toContain('unitCostMinor');
  });

  it('offers the form only while there is no plan yet', () => {
    // Otherwise somebody with three months behind them meets a form asking
    // what they used to drink.
    expect(screen).toContain('data?.quit ? null : (');
  });

  it('prices by the pack where the substance says so, without naming nicotine', () => {
    expect(screen).toContain('substanceProfile(option).costBasis.unitsPerPurchase');
    expect(screen).toContain("t('onboarding.purchaseCost', { purchase: purchaseLabel })");
    expect(screen).not.toContain("substance === 'nicotine'");
  });

  it('shows the detox warning the API returns rather than deciding for itself', () => {
    // For alcohol and benzodiazepines this is the difference between a hard
    // week and a seizure. The client must not be the thing that judges it.
    expect(screen).toContain('response.detoxWarning.required');
    expect(screen).toContain('styles.cardWarning');
  });

  it('computes the per-unit price in minor units, so nothing rounds oddly', () => {
    expect(screen).toContain('Math.round((Number(purchaseCost) * 100 || 0) / size)');
    expect(screen).toContain('Math.max(1, Number(purchaseSize) || 1)');
  });
});

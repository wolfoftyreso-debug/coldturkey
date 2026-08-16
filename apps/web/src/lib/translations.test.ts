import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, sv } from '@cleat/i18n';
import {
  BOUNDARY_SITUATIONS,
  supporterResources,
  SUPPORTER_EMERGENCY_SIGNS,
  SUPPORTER_PATTERNS,
  SUPPORTER_SCALE,
  SUPPORTER_STATEMENTS,
  SUPPORTER_TOPICS,
} from '@cleat/core';

/**
 * Every translation key the two clients ask for must exist.
 *
 * `translate` returns the key itself when it does not know it, which is the
 * right runtime behaviour — a screen with `craving.step.safety` written across
 * it is still usable, and throwing at somebody mid-craving would not be — but it
 * means a typo ships silently and is only ever found by a person reading the
 * literal key on the screen at the worst moment of their week.
 *
 * The scan covers both clients from here because they share one catalogue: a
 * key added for the web and mistyped on the phone is exactly the failure this
 * is for. Only literal keys are checked; anything composed at runtime is
 * invisible to a regular expression, which is why the resource labels below are
 * asserted structurally instead.
 */

const repoRoot = join(import.meta.dirname, '../../../..');

const SOURCE_ROOTS = ['apps/web/src', 'apps/mobile/app', 'apps/mobile/src'];

/** `t('some.key')` and `translate(locale, 'some.key')`, nothing dynamic. */
const CALLS = [/\bt\(\s*'([a-zA-Z0-9_.]+)'/g, /translate\([^,]+,\s*'([a-zA-Z0-9_.]+)'/g];

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) found.push(path);
  }
  return found;
}

function requestedKeys(): { key: string; file: string }[] {
  const requests: { key: string; file: string }[] = [];
  for (const root of SOURCE_ROOTS) {
    for (const file of sourceFiles(join(repoRoot, root))) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of CALLS) {
        for (const match of source.matchAll(pattern)) {
          requests.push({ key: match[1]!, file: file.slice(repoRoot.length + 1) });
        }
      }
    }
  }
  return requests;
}

describe('translation keys the clients ask for', () => {
  const requests = requestedKeys();

  it('finds keys to check at all — a scan that matches nothing proves nothing', () => {
    expect(requests.length).toBeGreaterThan(200);
  });

  it('has every requested key in the catalogue', () => {
    const known = new Set(Object.keys(sv));
    const missing = requests
      .filter((request) => !known.has(request.key))
      .map((request) => `${request.file}: ${request.key}`);
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('Cleat Nära', () => {
  /**
   * Every label on the supporter surface is built by appending a table entry to
   * a key prefix, so none of them is visible to the scan above. A missing one
   * renders as `near.pattern.hypervigilance` on a page somebody opened because
   * they are frightened, which is the worst possible moment to be shown the
   * inside of the software.
   */
  const required: string[] = [
    ...SUPPORTER_TOPICS.flatMap((topic) => [`near.topic.${topic}`, `near.topic.${topic}.body`]),
    ...SUPPORTER_PATTERNS.flatMap((pattern) => [
      `near.pattern.${pattern}`,
      `near.pattern.${pattern}.body`,
      `near.pattern.${pattern}.step`,
    ]),
    ...SUPPORTER_STATEMENTS.map((statement) => `near.statement.${statement.id}`),
    ...SUPPORTER_EMERGENCY_SIGNS.map((sign) => `near.sign.${sign}`),
    ...BOUNDARY_SITUATIONS.flatMap((situation) => [
      `near.boundary.${situation}`,
      `near.boundary.${situation}.say`,
    ]),
    ...SUPPORTER_SCALE.map((value) => `near.scale.${value}`),
    // Every country's list, not just the default one: a resource added for one
    // country and never translated is invisible until somebody in that country
    // opens the page.
    ...['SE', 'US', 'GB', 'ZZ'].flatMap((country) =>
      supporterResources(country).map((resource) => resource.key),
    ),
  ];

  it('has more than a handful of keys to check', () => {
    expect(required.length).toBeGreaterThan(50);
  });

  it('has every one of them in both languages', () => {
    for (const key of required) {
      expect(sv, `sv is missing ${key}`).toHaveProperty(key);
      expect(en, `en is missing ${key}`).toHaveProperty(key);
    }
  });
});

describe('emergency resources', () => {
  /**
   * Every resource in the crisis lists needs both a name and a line saying when
   * to ring it. The crisis screens build the second key by appending `.when` to
   * the first, so a missing one is invisible to the scan above and shows up as
   * the literal string `resource.se.mind.when` on the one screen in this product
   * that has to work.
   */
  const resourceKeys = Object.keys(sv).filter(
    (key) => key.startsWith('resource.') && !key.endsWith('.when'),
  );

  it('covers a resource list at all', () => {
    expect(resourceKeys.length).toBeGreaterThanOrEqual(10);
  });

  it('gives every resource a "when to call this" line in both languages', () => {
    for (const key of resourceKeys) {
      expect(sv, `sv is missing ${key}.when`).toHaveProperty(`${key}.when`);
      expect(en, `en is missing ${key}.when`).toHaveProperty(`${key}.when`);
    }
  });
});

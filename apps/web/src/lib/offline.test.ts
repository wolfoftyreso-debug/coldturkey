import { describe, expect, it } from 'vitest';
import { translate } from '@cleat/i18n';
import { offlineEmergency } from './offline';

/**
 * The emergency answer must not depend on a network.
 *
 * "Yes, somebody is in immediate danger" was a request and nothing else: if it
 * failed, the person got a heading that says "help you can call now" over an
 * empty box, or nothing at all. These tests pin the fallback, because it is the
 * one path in this product where being unavailable is not an inconvenience.
 */
describe('the offline emergency answer', () => {
  it('gives Swedish numbers to a Swedish account, with 112 among them', () => {
    const answer = offlineEmergency('sv', 'SE', null);
    const numbers = answer.safety.resources.map((resource) => resource.contact);
    expect(numbers).toContain('112');
    expect(numbers).toContain('90101');
  });

  it('gives the right numbers to accounts elsewhere', () => {
    expect(offlineEmergency('en', 'US', null).safety.resources.map((r) => r.contact)).toContain(
      '988',
    );
    expect(offlineEmergency('en', 'GB', null).safety.resources.map((r) => r.contact)).toContain(
      '116 123',
    );
  });

  it('still answers when the country is unknown', () => {
    const answer = offlineEmergency('sv', undefined, null);
    expect(answer.safety.resources.length).toBeGreaterThan(0);
    expect(answer.safety.resources[0]?.label).not.toBe('');
  });

  it('labels every number in the reader’s language', () => {
    for (const resource of offlineEmergency('sv', 'SE', null).safety.resources) {
      // A label equal to its own key means the catalogue is missing it, which
      // on this screen shows up as `resource.se.mind` where a name should be.
      expect(resource.label).not.toBe(resource.key);
    }
  });

  it('says the same three things the server would, in the same order', () => {
    const answer = offlineEmergency('sv', 'SE', null);
    expect(answer.reply).toBe(
      [
        translate('sv', 'safety.emergency'),
        translate('sv', 'safety.notAlone'),
        translate('sv', 'safety.stayHere'),
      ].join('\n\n'),
    );
    expect(answer.safety.level).toBe('emergency');
    expect(answer.source).toBe('local');
  });

  it('prefers the numbers cached for this account over the bundled table', () => {
    const answer = offlineEmergency('sv', 'SE', {
      savedAt: new Date().toISOString(),
      whyStatement: null,
      supportContacts: [],
      resources: [{ key: 'resource.local.one', contact: '0700000000', label: 'Cached line' }],
      locale: 'sv',
    });
    expect(answer.safety.resources).toEqual([
      { key: 'resource.local.one', contact: '0700000000', label: 'Cached line' },
    ]);
  });
});

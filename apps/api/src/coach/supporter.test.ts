import { describe, expect, it } from 'vitest';
import { translate } from '@cleat/i18n';
import type { RecoverySnapshot } from '@cleat/core';
import { localCoach, type CoachRequest } from './service.js';
import { buildSupporterContext, identityFor, SUPPORTER_IDENTITY } from './prompt.js';

/**
 * Cleat Nära — the conversation with somebody who is *not* the person using.
 *
 * The risk this file exists for is the app losing track of who it is talking
 * to. Everything else in the coach is addressed to a person with an addiction,
 * and every one of those sentences is wrong, and some are cruel, when the
 * reader is the exhausted partner instead.
 */

const emptySnapshot: RecoverySnapshot = {
  profile: { country: 'SE', timezone: 'Europe/Stockholm', whyStatement: null },
  quit: null,
  relapses: [],
  checkIns: [],
  cravings: [],
  supportContacts: [],
};

function request(message: string, overrides: Partial<CoachRequest> = {}): CoachRequest {
  return {
    snapshot: emptySnapshot,
    displayName: 'Alex',
    locale: 'sv',
    message,
    mode: 'supporter',
    history: [],
    now: new Date('2026-03-01T20:00:00Z'),
    ...overrides,
  };
}

describe('the identity the model is given', () => {
  it('is the supporter prompt for supporter mode and the recovery one otherwise', () => {
    expect(identityFor('supporter')).toBe(SUPPORTER_IDENTITY);
    for (const mode of ['acute', 'relapse', 'general', 'deep'] as const) {
      expect(identityFor(mode)).not.toBe(SUPPORTER_IDENTITY);
    }
  });

  it('tells the model it knows nothing about the person being described', () => {
    // The single most important property of this surface: it is not a window
    // into somebody else's account, and the model must not behave as if it is.
    expect(SUPPORTER_IDENTITY).toContain('ingen koppling till den andra personens konto');
  });

  it('forbids the three things that would do real damage here', () => {
    expect(SUPPORTER_IDENTITY).toContain('lämna relationen eller att stanna kvar');
    expect(SUPPORTER_IDENTITY).toContain('lägga skulden på användaren');
    expect(SUPPORTER_IDENTITY).toContain('lova att den andra personen kommer att bli frisk');
  });

  it('keeps the rules the whole product runs on', () => {
    expect(SUPPORTER_IDENTITY).toContain('tolvstegsprogram');
    expect(SUPPORTER_IDENTITY).toContain('läkare');
    expect(SUPPORTER_IDENTITY).toContain('coacha bort en medicinsk nödsituation');
  });
});

describe('the context sent with a supporter message', () => {
  it('carries no facts about anybody', () => {
    const context = buildSupporterContext({
      locale: 'sv',
      displayName: 'Alex',
      safetyLevel: 'none',
      safetyCategories: [],
    });
    expect(context).toContain('närstående, inte den som använder');
    expect(context).not.toMatch(/dag i rad|streak|varför|substans/i);
  });

  it('passes on a raised safety level, since the relative may be the one in danger', () => {
    const context = buildSupporterContext({
      locale: 'sv',
      displayName: 'Alex',
      safetyLevel: 'urgent',
      safetyCategories: ['self_harm'],
    });
    expect(context).toContain('urgent');
    expect(context).toContain('self_harm');
  });
});

describe('the local coach in supporter mode', () => {
  it('answers about the reader rather than handing them the craving protocol', () => {
    const reply = localCoach(request('Jag orkar inte längre.'), 'none', []);
    expect(reply).toContain(translate('sv', 'near.talkGreeting'));
    expect(reply).toContain(translate('sv', 'near.talkNotAboutThem'));
    expect(reply).not.toContain(translate('sv', 'mantra.tenMinutes'));
  });

  it('does not turn the negotiation detector on the person quoting it', () => {
    // A partner reporting what they were told trips the same patterns as
    // somebody negotiating with themselves. Answering "that sounds like a
    // negotiation" to the partner is the app talking to the wrong person.
    const quoted = 'Han säger att han bara ska ta en gång till, sen slutar han på måndag.';
    const reply = localCoach(request(quoted), 'none', ['just_once', 'starting_monday']);
    expect(reply).not.toContain(translate('sv', 'negotiation.detected'));
    expect(reply).toContain(translate('sv', 'near.talkGreeting'));
  });

  it('still leads with the direct question when the relative sounds final', () => {
    // The triage runs on their message too. A relative saying goodbye is
    // answered as a person in danger, not as a supporter with a question.
    const reply = localCoach(request('Tack för allt.'), 'none', [], true);
    expect(reply.startsWith(translate('sv', 'safety.askDirectly'))).toBe(true);
  });

  it('leads with the urgent safety wording when the level is urgent', () => {
    const reply = localCoach(request('Jag vill inte finnas kvar.'), 'urgent', []);
    expect(reply.startsWith(translate('sv', 'safety.urgent'))).toBe(true);
  });
});

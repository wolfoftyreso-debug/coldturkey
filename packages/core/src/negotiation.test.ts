import { describe, expect, it } from 'vitest';
import { counterKey, detectNegotiation } from './negotiation.js';

describe('detectNegotiation', () => {
  it('catches the classic "just once"', () => {
    const result = detectNegotiation('det är väl okej med bara en gång?');
    expect(result.detected).toBe(true);
    expect(result.matches.map((m) => m.type)).toContain('just_once');
  });

  it('catches stacked arguments in one message', () => {
    const result = detectNegotiation(
      'jag har varit duktig hela veckan och jag förtjänar det, jag kan kontrollera det nu',
    );
    const types = result.matches.map((m) => m.type);
    expect(types).toContain('earned_it');
    expect(types).toContain('deserve_it');
    expect(types).toContain('in_control_now');
  });

  it('catches the postponement pattern', () => {
    expect(detectNegotiation('jag börjar på måndag istället').matches[0]?.type).toBe(
      'start_monday',
    );
  });

  it('catches the functional-need pattern in English', () => {
    expect(detectNegotiation('I need it to sleep, honestly').matches[0]?.type).toBe(
      'need_it_to_sleep',
    );
  });

  it('quotes the matched fragment back', () => {
    const result = detectNegotiation('ärligt talat, sista gången bara');
    expect(result.matches[0]?.excerpt).toBe('sista gangen');
  });

  it('stays quiet on a message with no rationalisation', () => {
    const result = detectNegotiation('idag var jobbigt men jag ringde min bror istället');
    expect(result.detected).toBe(false);
    expect(result.promptKey).toBe('negotiation.none');
  });

  it('handles empty input', () => {
    expect(detectNegotiation('').detected).toBe(false);
  });

  it('builds a counter key per type', () => {
    expect(counterKey('just_once')).toBe('negotiation.counter.just_once');
  });
});

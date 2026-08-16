import { describe, expect, it } from 'vitest';
import {
  reflectOnSupport,
  supporterResources,
  SUPPORTER_PATTERNS,
  SUPPORTER_STATEMENTS,
  type SupporterAnswer,
} from './supporter.js';

const answerAll = (value: SupporterAnswer): Record<string, SupporterAnswer> =>
  Object.fromEntries(SUPPORTER_STATEMENTS.map((s) => [s.id, value]));

describe('the relative self-check', () => {
  it('covers every pattern with more than one statement', () => {
    for (const pattern of SUPPORTER_PATTERNS) {
      const statements = SUPPORTER_STATEMENTS.filter((s) => s.pattern === pattern);
      expect(statements.length, `${pattern} needs more than one statement`).toBeGreaterThan(1);
    }
  });

  it('says nothing at all when almost nothing was answered', () => {
    // The failure mode this guards against is a page that reflects a whole
    // pattern back at somebody from three taps. Recognising yourself in
    // something an app invented is worse than being told nothing.
    const result = reflectOnSupport({ count_what_is_left: 3, check_their_things: 3 });
    expect(result.tooLittle).toBe(true);
    expect(result.answered).toBe(2);
  });

  it('reflects nothing back when the answers are all "never"', () => {
    const result = reflectOnSupport(answerAll(0));
    expect(result.tooLittle).toBe(false);
    expect(result.loudest).toEqual([]);
    expect(result.patterns.every((p) => p.level === 'quiet')).toBe(true);
  });

  it('names every pattern when the answers are all "almost always"', () => {
    const result = reflectOnSupport(answerAll(3));
    expect(result.loudest).toHaveLength(SUPPORTER_PATTERNS.length);
    expect(result.patterns.every((p) => p.weight === 1)).toBe(true);
  });

  it('names only the pattern that is actually loud', () => {
    const answers: Record<string, SupporterAnswer> = { ...answerAll(0) };
    answers.said_last_time_again = 3;
    answers.agree_to_avoid_a_fight = 3;

    const result = reflectOnSupport(answers);
    expect(result.loudest).toEqual(['boundaries']);
  });

  it('orders the loud patterns strongest first', () => {
    const answers: Record<string, SupporterAnswer> = { ...answerAll(0) };
    answers.said_last_time_again = 2;
    answers.agree_to_avoid_a_fight = 2;
    answers.think_it_is_my_fault = 3;
    answers.search_for_what_i_missed = 3;

    expect(reflectOnSupport(answers).loudest).toEqual(['blame', 'boundaries']);
  });

  it('scores a pattern on what was answered, not on what was skipped', () => {
    // Half the statements answered "almost always" must not be diluted to
    // "present" by the ones left blank — a skipped question is not a "never".
    const answers: Record<string, SupporterAnswer> = { ...answerAll(1) };
    delete answers.check_their_things;
    answers.count_what_is_left = 3;

    const control = reflectOnSupport(answers).patterns.find((p) => p.pattern === 'control');
    expect(control?.answered).toBe(1);
    expect(control?.weight).toBe(1);
    expect(control?.level).toBe('loud');
  });

  it('is a pure reflection — the same answers always give the same result', () => {
    const answers = answerAll(2);
    expect(reflectOnSupport(answers)).toEqual(reflectOnSupport(answers));
  });
});

describe('where a relative can turn', () => {
  it('gives country-specific lines, including ones staffed for relatives', () => {
    const swedish = supporterResources('SE');
    expect(swedish.some((r) => r.forRelatives)).toBe(true);
    expect(swedish.map((r) => r.contact)).toContain('020-84 44 48');
  });

  it('is case-insensitive about the country', () => {
    expect(supporterResources('se')).toEqual(supporterResources('SE'));
  });

  it('falls back rather than offering a number that answers somewhere else', () => {
    expect(supporterResources('ZZ')).toEqual(supporterResources());
    expect(supporterResources().length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildProtectionPlan,
  RELAPSE_AUTOPSY_QUESTIONS,
  RELAPSE_SAFETY_QUESTIONS,
} from './relapse.js';
import { mantraOfTheDay, mantrasForRelapse, MANTRAS } from './mantras.js';

describe('relapse flow ordering', () => {
  it('asks about safety before it asks about causes', () => {
    expect(RELAPSE_SAFETY_QUESTIONS[0]).toBe('relapse.safety.are_you_safe');
    expect(RELAPSE_SAFETY_QUESTIONS).toHaveLength(4);
  });

  it('walks the full ten-step autopsy', () => {
    expect(RELAPSE_AUTOPSY_QUESTIONS).toHaveLength(10);
    expect(RELAPSE_AUTOPSY_QUESTIONS[0]?.field).toBe('whatHappened');
    expect(RELAPSE_AUTOPSY_QUESTIONS.at(-1)?.field).toBe('whatChangesNow');
  });
});

describe('buildProtectionPlan', () => {
  it('reuses the person’s own words as warning signs', () => {
    const plan = buildProtectionPlan({
      firstTrigger: 'Bråk med chefen',
      thought: 'Jag förtjänar en öl',
      feeling: 'Ilska',
      whatCouldHaveBrokenTheChain: 'Ringt Jonas på vägen hem',
      whatChangesNow: 'Åker inte förbi Systembolaget',
    });
    expect(plan.warningSigns).toContain('Bråk med chefen');
    expect(plan.countermeasures).toContain('Ringt Jonas på vägen hem');
    expect(plan.needsWork).toBe(false);
  });

  it('always includes the delay tool', () => {
    expect(buildProtectionPlan({}).toolIds).toContain('delay_10_minutes');
  });

  it('adds social tools when other people were part of the chain', () => {
    const plan = buildProtectionPlan({ peoplePresent: 'Gamla polare från jobbet' });
    expect(plan.toolIds).toContain('leave_the_situation');
    expect(plan.toolIds).toContain('call_someone');
  });

  it('adds the negotiation tool when a rationalising thought was named', () => {
    expect(buildProtectionPlan({ thought: 'bara en gång' }).toolIds).toContain(
      'name_the_negotiation',
    );
  });

  it('flags a thin plan so the coach knows to help fill it in', () => {
    expect(buildProtectionPlan({}).needsWork).toBe(true);
    expect(buildProtectionPlan({ firstTrigger: 'Stress' }).needsWork).toBe(true);
  });

  it('ignores blank answers', () => {
    const plan = buildProtectionPlan({ firstTrigger: '   ', whatChangesNow: '' });
    expect(plan.warningSigns).toHaveLength(0);
    expect(plan.needsWork).toBe(true);
  });

  it('does not repeat tools', () => {
    const plan = buildProtectionPlan({
      peoplePresent: 'Kompisar',
      firstTrigger: 'Fest',
      thought: 'en till',
    });
    expect(new Set(plan.toolIds).size).toBe(plan.toolIds.length);
  });
});

describe('mantras', () => {
  it('leads with "a relapse is information" after a slip', () => {
    expect(mantrasForRelapse()[0]).toBe('mantra.relapse_is_information');
    expect(mantrasForRelapse()).toContain('mantra.shame_feeds_the_cycle');
  });

  it('picks the same mantra all day and across devices', () => {
    const morning = mantraOfTheDay(new Date(Date.UTC(2026, 2, 20, 6, 0, 0)));
    const evening = mantraOfTheDay(new Date(Date.UTC(2026, 2, 20, 22, 0, 0)));
    expect(morning).toBe(evening);
    expect(MANTRAS).toContain(morning);
  });

  it('changes from one day to the next', () => {
    const a = mantraOfTheDay(new Date(Date.UTC(2026, 2, 20, 12, 0, 0)));
    const b = mantraOfTheDay(new Date(Date.UTC(2026, 2, 21, 12, 0, 0)));
    expect(a).not.toBe(b);
  });
});

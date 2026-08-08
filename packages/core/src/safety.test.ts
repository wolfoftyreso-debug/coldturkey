import { describe, expect, it } from 'vitest';
import { detoxWarning, emergencyResources, triage } from './safety.js';
import { normalizeForMatching } from './text.js';

describe('normalizeForMatching', () => {
  it('folds Swedish diacritics so both spellings hit the same rule', () => {
    expect(normalizeForMatching('Vill DÖ')).toBe(' vill do ');
    expect(normalizeForMatching('vill do')).toBe(' vill do ');
  });

  it('collapses punctuation to single spaces', () => {
    expect(normalizeForMatching('ta  livet,, av mig!!!')).toBe(' ta livet av mig ');
  });
});

describe('triage — emergencies', () => {
  it('flags Swedish suicidal statements and bypasses the coach', () => {
    const result = triage({ text: 'jag orkar inte mer, jag vill ta livet av mig' });
    expect(result.level).toBe('emergency');
    expect(result.categories).toContain('suicide');
    expect(result.bypassCoach).toBe(true);
  });

  it('flags the same statement written without diacritics', () => {
    expect(triage({ text: 'jag vill do' }).level).toBe('emergency');
  });

  it('flags English suicidal statements', () => {
    const result = triage({ text: 'I want to kill myself tonight' });
    expect(result.level).toBe('emergency');
    expect(result.categories).toContain('suicide');
  });

  it('flags an overdose in progress', () => {
    const result = triage({ text: 'jag har tagit for mycket, tog hela burken' });
    expect(result.level).toBe('emergency');
    expect(result.categories).toContain('overdose');
  });

  it('flags someone else being unresponsive', () => {
    const result = triage({ text: 'min kompis andas inte och vaknar inte' });
    expect(result.level).toBe('emergency');
    expect(result.categories).toContain('unresponsive_person');
  });

  it('flags seizures as a medical emergency, not a withdrawal symptom to coach', () => {
    const result = triage({ text: 'jag fick kramper i morse' });
    expect(result.level).toBe('emergency');
    expect(result.categories).toContain('withdrawal_medical');
    expect(result.bypassCoach).toBe(true);
  });

  it('treats an explicit yes to "are you in danger" as an emergency regardless of text', () => {
    const result = triage({ text: 'allt är lugnt', immediateDanger: true });
    expect(result.level).toBe('emergency');
    expect(result.bypassCoach).toBe(true);
  });
});

describe('triage — urgent but not an ambulance', () => {
  it('flags psychosis symptoms without bypassing the coach', () => {
    const result = triage({ text: 'jag hor roster hela tiden' });
    expect(result.level).toBe('urgent');
    expect(result.categories).toContain('psychosis');
    expect(result.bypassCoach).toBe(false);
  });

  it('flags being unable to stay safe', () => {
    expect(triage({ text: 'jag litar inte pa mig sjalv just nu' }).level).toBe('urgent');
  });
});

describe('triage — substance-driven withdrawal risk', () => {
  it('escalates alcohol inside the acute window even with a calm message', () => {
    const result = triage({
      text: 'går bra idag faktiskt',
      substance: 'alcohol',
      hoursSinceLastUse: 14,
    });
    expect(result.level).toBe('urgent');
    expect(result.categories).toContain('withdrawal_medical');
  });

  it('escalates benzodiazepines the same way', () => {
    const result = triage({ text: 'dag två', substance: 'benzodiazepines', hoursSinceLastUse: 40 });
    expect(result.level).toBe('urgent');
  });

  it('does not escalate once past the acute window', () => {
    const result = triage({ text: 'känns bra', substance: 'alcohol', hoursSinceLastUse: 500 });
    expect(result.level).toBe('none');
  });

  it('does not escalate for substances without a dangerous withdrawal', () => {
    const result = triage({ text: 'dag ett utan snus', substance: 'nicotine', hoursSinceLastUse: 6 });
    expect(result.level).toBe('none');
  });
});

describe('triage — ordinary messages', () => {
  it('stays silent on a hard but safe day', () => {
    const result = triage({ text: 'det har varit en jobbig dag men jag klarade det' });
    expect(result.level).toBe('none');
    expect(result.resources).toHaveLength(0);
    expect(result.bypassCoach).toBe(false);
  });

  it('handles empty input', () => {
    expect(triage({}).level).toBe('none');
  });
});

describe('emergencyResources', () => {
  it('returns Swedish numbers for SE', () => {
    const contacts = emergencyResources('SE').map((r) => r.contact);
    expect(contacts).toContain('112');
    expect(contacts).toContain('90101');
  });

  it('is case-insensitive on the country code', () => {
    expect(emergencyResources('se')).toEqual(emergencyResources('SE'));
  });

  it('falls back to a generic set for unknown countries', () => {
    expect(emergencyResources('ZZ')[0]?.key).toBe('resource.generic.emergency');
    expect(emergencyResources()[0]?.key).toBe('resource.generic.emergency');
  });
});

describe('detoxWarning', () => {
  it('requires a medical warning for alcohol, benzodiazepines and sedatives', () => {
    expect(detoxWarning('alcohol').required).toBe(true);
    expect(detoxWarning('benzodiazepines').required).toBe(true);
    expect(detoxWarning('sedatives').required).toBe(true);
  });

  it('does not require one for nicotine or gambling', () => {
    expect(detoxWarning('nicotine').required).toBe(false);
    expect(detoxWarning('gambling').required).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { triage, type SafetyLevel } from './safety.js';

/**
 * The safety corpus.
 *
 * This file exists because the rules were once written in the vocabulary a
 * developer imagines rather than the vocabulary a person types. Measured
 * against realistic messages, the first version caught three of thirty-five
 * emergencies. Everything passed. Nobody had written down what the rules were
 * supposed to catch, so nothing could tell us they did not.
 *
 * So the corpus is the specification. Two properties matter and they pull in
 * opposite directions:
 *
 * 1. **Nothing serious is missed.** The cost of a miss is somebody in danger
 *    being handed a breathing exercise.
 * 2. **Nothing ordinary raises an alarm.** The cost of a false alarm is a
 *    person learning that this app panics, and then not writing the true thing
 *    the night it matters. A net that cries wolf is not a safer net.
 *
 * Add real sentences here whenever a gap is found. Do not soften an expectation
 * to make the file green.
 */

const RANK: Record<SafetyLevel, number> = { none: 0, elevated: 1, urgent: 2, emergency: 3 };

function atLeast(text: string, minimum: SafetyLevel) {
  const result = triage({ text });
  expect(
    RANK[result.level],
    `"${text}" triaged as ${result.level}, expected at least ${minimum}`,
  ).toBeGreaterThanOrEqual(RANK[minimum]);
  return result;
}

/**
 * Stated intent, or a medical emergency already under way. These are the only
 * messages that stop the coach and say: call the emergency number.
 */
const EMERGENCY = [
  // suicide, stated
  'jag tänker ta livet av mig',
  'jag vill ta mitt liv',
  'jag har tänkt avsluta allt',
  'jag vill dö',
  'jag har självmordstankar',
  'i want to kill myself',
  'i am going to end it all',
  'i want to die',
  // self-harm
  'jag har skurit mig igen',
  'jag skar mig i natt',
  'jag vill göra illa mig själv',
  'i cut last night',
  'i have been cutting myself',
  // overdose
  'jag tog hela förpackningen',
  'jag har svalt en massa tabletter',
  'jag käkade typ tjugo stycken',
  'jag har blandat sprit och tabletter',
  'i swallowed a load of pills',
  'i mixed booze and benzos',
  'i took too many',
  // someone else is unresponsive
  'min kompis andas konstigt och vaknar inte',
  'han är helt borta och går inte att väcka',
  'hon svarar inte när jag ruskar henne',
  'my mate is out cold and breathing weird',
  'he wont wake up',
  // the person is having a medical emergency
  'jag får inte tillräckligt med luft',
  'det gör ont i bröstet och strålar ut i armen',
  'jag kräktes upp något som såg ut som kaffesump',
  'jag blöder och det slutar inte',
  'i cannot catch my breath',
  // Plan, date or means. An external review probed these and the rules caught
  // none of them — the strongest predictor in suicidology, rated no risk.
  'jag har sparat tabletter',
  'jag har bestämt ett datum',
  'jag har ett rep i garaget',
  'jag vet precis hur jag ska göra',
  'jag har allt jag behöver nu',
  'jag har skrivit ett avskedsbrev',
  'i have been saving pills',
  'i picked a date',
  // seizure and delirium — the reason abrupt alcohol withdrawal can kill
  'jag fick ett krampanfall igår',
  'jag krampade i morse',
  'jag ser saker som inte finns och skakar okontrollerat',
  'i had a fit this morning',
];

/**
 * Passive ideation, psychosis, risk to others, and "I cannot be alone tonight".
 * Real signals, all of them — answered with the crisis line and a conversation
 * that keeps going, not with an ambulance.
 */
const URGENT = [
  // passive ideation: wanting to be gone, without a stated plan
  'jag pallar inte längre',
  'jag orkar inte längre',
  'jag vill bara försvinna',
  'jag vill somna och inte vakna',
  'det vore bättre för alla om jag inte fanns',
  'jag har inget kvar att leva för',
  'jag klarar inte det här längre, jag vill bort',
  'det finns ingen mening med att leva',
  'i just want it to stop forever',
  'i want to disappear',
  'everyone would be better off without me',
  'i have nothing left to live for',
  'i cannot go on',
  // Passive, with none of the classic trigger words. Also from the review.
  'orkar inte vara här',
  'snart blir det tyst',
  'jag ska logga ut permanent',
  'vill inte vara med längre',
  'jag är färdig med allt',
  'det vore bättre om jag inte vaknade',
  // psychosis
  'det känns som att någon förföljer mig',
  'jag hör någon prata som inte är där',
  'i keep hearing someone talking who is not there',
  // risk to someone else
  'jag är rädd att jag gör något dumt mot honom',
  'jag vill slå sönder honom',
  'im scared i will hurt her',
  // cannot stay safe
  'jag vågar inte vara ensam ikväll',
  'jag litar inte på mig själv just nu',
  'i cannot be on my own tonight',
];

/** Withdrawal, described the way people describe it rather than clinically. */
const ELEVATED = [
  'jag skakar',
  'jag är jätteskakig',
  'jag svettas och mår illa och har inte tagit något på ett dygn',
  'händerna darrar',
  'my hands wont stop shaking',
  'i am getting cold sweats',
];

/**
 * Ordinary recovery talk, including the parts that borrow dark vocabulary.
 * Every one of these must pass in silence.
 */
const BENIGN = [
  'jag hade en bra dag idag',
  'jag var på gymmet och kände mig stark',
  'tio dagar nu, känns overkligt',
  'jag sa nej på festen igår',
  'jag vill sluta röka innan sommaren',
  'jag ringde min syster istället',
  'sömnen börjar bli bättre',
  'jag suger efter en öl',
  'suget kom på tisdag som vanligt',
  'jag tänker på sprit hela tiden',
  'det var nära att jag drack igår',
  'jag orkar inte träna idag',
  'jag orkar inte laga mat, blir pizza',
  'jag är helt slut efter jobbet',
  'jag höll på att dö av skratt',
  'jag dog nästan av skratt igår',
  'det var mördande tråkigt',
  'jag är less på allt det här',
  'jag vill bara sova',
  'jag drack igår och mår skit över det',
  'jag tog ett bloss, sen slutade jag',
  'jag halkade dit på lördagen',
  'i had a good day today',
  'i went for a run instead',
  'work was stressful but i got through it',
  'i am exhausted after that shift',
  'i nearly died laughing',
  // Progress on cutting down. This once triaged as a self-harm emergency,
  // which is the exact opposite of the response the moment called for.
  'i cut down to five a day',
  'i am dying for a coffee',
];

describe('safety corpus', () => {
  describe('emergencies are never missed', () => {
    for (const text of EMERGENCY) {
      it(`"${text.slice(0, 44)}"`, () => {
        const result = atLeast(text, 'emergency');
        // An emergency must also stop the language model getting a turn at it.
        expect(result.bypassCoach).toBe(true);
        expect(result.resources.length).toBeGreaterThan(0);
      });
    }
  });

  describe('urgent signals are handled, not escalated to an ambulance', () => {
    for (const text of URGENT) {
      it(`"${text.slice(0, 44)}"`, () => {
        const result = atLeast(text, 'urgent');
        expect(result.resources.length).toBeGreaterThan(0);
      });
    }
  });

  describe('withdrawal described in plain language is flagged', () => {
    for (const text of ELEVATED) {
      it(`"${text.slice(0, 44)}"`, () => {
        atLeast(text, 'elevated');
      });
    }
  });

  describe('ordinary recovery talk passes in silence', () => {
    for (const text of BENIGN) {
      it(`"${text.slice(0, 44)}"`, () => {
        const result = triage({ text });
        expect(result.level, `"${text}" raised ${result.level}`).toBe('none');
        expect(result.resources).toEqual([]);
      });
    }
  });

  describe('passive ideation is separated from stated intent', () => {
    it('does not send someone who is exhausted to the emergency number', () => {
      const result = triage({ text: 'jag orkar inte längre' });
      expect(result.categories).toContain('suicidal_ideation');
      expect(result.level).toBe('urgent');
      expect(result.bypassCoach).toBe(false);
    });

    it('does send someone who states an intent', () => {
      const result = triage({ text: 'jag tänker ta livet av mig' });
      expect(result.categories).toContain('suicide');
      expect(result.level).toBe('emergency');
      expect(result.bypassCoach).toBe(true);
    });
  });
});

describe('the first number offered fits the level', () => {
  it('leads with the emergency number in an emergency', () => {
    const result = triage({ text: 'jag tänker ta livet av mig', country: 'SE' });
    expect(result.resources[0]?.contact).toBe('112');
  });

  it('leads with the crisis line for passive ideation', () => {
    const result = triage({ text: 'jag orkar inte längre', country: 'SE' });
    expect(result.resources[0]?.contact).toBe('90101');
    // 112 is still offered — it is just no longer the headline.
    expect(result.resources.map((r) => r.contact)).toContain('112');
  });
});

/**
 * Known false alarms.
 *
 * These are ordinary sentences that the rules do fire on. They are pinned here
 * rather than quietly left out of BENIGN, because a corpus that omits its own
 * failures reports a precision it does not have — the same shape of mistake as
 * the original green suite that caught three emergencies in thirty-five.
 *
 * Each one is a deliberate trade: the phrasing it fires on is shared with real
 * distress, and tightening the rule to exclude it would lose the real case too.
 * If a rule change makes one of these fall silent without losing recall, delete
 * the line — this list shrinking is progress.
 */
const KNOWN_FALSE_ALARMS: { text: string; level: SafetyLevel; because: string }[] = [
  {
    text: 'jag skakar av ilska efter det där mötet',
    level: 'elevated',
    because: 'shares "skakar" with the alcohol withdrawal presentation',
  },
  {
    text: 'jag vill försvinna från jobbet ett tag',
    level: 'urgent',
    because: 'shares "vill försvinna" with the commonest Swedish phrasing of passive ideation',
  },
  {
    text: 'i want to disappear on holiday somewhere warm',
    level: 'urgent',
    because: 'the English equivalent of the same overlap',
  },
];

describe('known false alarms are tracked, not hidden', () => {
  for (const { text, level, because } of KNOWN_FALSE_ALARMS) {
    it(`"${text.slice(0, 40)}" — ${because}`, () => {
      const result = triage({ text });
      expect(result.level).toBe(level);
      // The cost has to stay bounded: a false alarm may add a handoff line or
      // show the crisis numbers, but it must never stop the coach and tell
      // somebody having a normal day to call an ambulance.
      expect(result.bypassCoach).toBe(false);
    });
  }

  it('costs no more than three sentences in the benign set', () => {
    expect(KNOWN_FALSE_ALARMS.length).toBeLessThanOrEqual(3);
  });
});

/**
 * Ambiguous finality: a goodbye about as often as it is a full stop on an
 * ordinary sentence. No word list can separate them, so the rules do not try.
 * The level is left alone and the coach is told to ask a direct question —
 * which is what a person who noticed would do, and which costs one sentence
 * when the answer is that they finished a project.
 */
const ASK_DIRECTLY = [
  'jag är klar',
  'det är över nu',
  'hejdå på riktigt',
  'tack för allt, ni har varit snälla',
  'säg till mamma att jag älskar henne',
  'jag har skrivit ett brev till er',
  'det här är sista gången jag skriver',
  'ta hand om hunden',
  'im done',
  'done with everything',
  'life is over',
  // Bare fragments. The same words with something mundane attached — "orkar
  // inte laga mat" — must stay silent, which is what the length gate is for.
  'orkar inte',
  'jag pallar inte',
];

describe('ambiguous finality is asked about, not alarmed at', () => {
  for (const text of ASK_DIRECTLY) {
    it(`"${text.slice(0, 44)}"`, () => {
      const result = triage({ text });
      expect(result.askDirectly, `"${text}" did not prompt a direct question`).toBe(true);
      expect(result.bypassCoach).toBe(false);
    });
  }

  it('leaves ordinary exhaustion with an object alone', () => {
    for (const text of [
      'jag orkar inte träna idag',
      'jag orkar inte laga mat, blir pizza',
      'chefen är omöjlig, jag pallar inte honom',
    ]) {
      expect(triage({ text }).askDirectly, `"${text}" prompted a question it should not`).toBe(
        false,
      );
    }
  });

  it('does not ask during an emergency — the fixed response is already right', () => {
    expect(triage({ text: 'jag är klar, jag tänker ta livet av mig' }).askDirectly).toBe(false);
  });

  it('never treats a recovery plan as a suicide plan', () => {
    // "Jag har en plan" in a recovery app means a recovery plan. Firing the
    // emergency script at someone describing their own progress is the failure
    // that matters most on this side of the line.
    expect(triage({ text: 'jag har en plan för veckan' }).level).toBe('none');
    expect(triage({ text: 'jag har köpt tabletter mot huvudvärk' }).level).toBe('none');
  });
});

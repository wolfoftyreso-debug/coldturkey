import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CRAVING_FEELINGS, CRAVING_LOCATIONS } from '@cleat/core';
import { api, type CoachResponse, type CravingPlan } from '../src/api';
import { offlineCravingPlan, offlineEmergency } from '../src/offline';
import { useSession } from '../src/session';
import { styles } from '../src/theme';

/**
 * Read from the domain package rather than copied.
 *
 * Both clients kept their own hand-typed copy, which meant three places to
 * change and two to forget. The API validates against these same arrays, so a
 * client that drifted would offer a chip the server refuses.
 */
const FEELINGS = CRAVING_FEELINGS;
const LOCATIONS = CRAVING_LOCATIONS;

const INTENSITIES = [2, 4, 6, 8, 10] as const;

type Step = 'safety' | 'feeling' | 'location' | 'intensity' | 'plan' | 'emergency';

/**
 * The craving engine on a phone.
 *
 * One question per screen, everything a tap. Nobody is typing free text at the
 * peak of a craving, and the safety question comes first so that its "yes"
 * branch leaves this flow entirely.
 */
export default function CravingScreen() {
  const { t, locale, user } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>('safety');
  const [feeling, setFeeling] = useState<string>('craving');
  const [location, setLocation] = useState<string>('home');
  const [intensity, setIntensity] = useState(8);
  const [plan, setPlan] = useState<(CravingPlan & { offline?: boolean }) | null>(null);
  const [emergency, setEmergency] = useState<CoachResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [logNote, setLogNote] = useState<string | null>(null);

  async function logOutcome(outcome: 'resisted' | 'used') {
    setLogNote(null);
    try {
      await api.post('/v1/cravings', { intensity, feeling, location, outcome });
    } catch {
      // The web client queues this; there is nowhere on the phone to keep it
      // that is both durable and appropriate for recovery data, so the honest
      // thing is to say the log did not save rather than to imply it did.
      setLogNote(t('offline.notLogged'));
    }
  }

  async function declareDanger() {
    setBusy(true);
    try {
      setEmergency(
        await api.post<CoachResponse>('/v1/coach/message', {
          message: t('craving.step.safety'),
          mode: 'acute',
          immediateDanger: true,
        }),
      );
    } catch {
      // The screen used to move on to the emergency step regardless and show
      // "help you can call now" above an empty box, because the numbers only
      // ever arrived with the response. They are compiled into this app; there
      // is nothing here that needs a server.
      setEmergency(offlineEmergency(locale, user?.country));
    } finally {
      setStep('emergency');
      setBusy(false);
    }
  }

  async function buildPlan() {
    setBusy(true);
    try {
      setPlan(await api.post<CravingPlan>('/v1/craving/plan', { feeling, location, intensity }));
    } catch {
      // No signal. Without this the button did nothing at all: the request
      // rejected with nobody listening and the person was left on the intensity
      // question at the peak of a craving.
      setPlan(offlineCravingPlan(locale, intensity));
    } finally {
      setStep('plan');
      setBusy(false);
    }
  }

  function Chips({
    options,
    selected,
    onPick,
    prefix,
  }: {
    options: readonly string[];
    selected: string;
    onPick: (value: string) => void;
    prefix: string;
  }) {
    return (
      <View style={styles.row}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, selected === option ? styles.chipSelected : null]}
            onPress={() => onPick(option)}
          >
            <Text
              style={[styles.chipText, selected === option ? styles.chipTextSelected : null]}
            >
              {t(`${prefix}.${option}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (step === 'emergency') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.lede}>{emergency?.reply ?? t('safety.emergency')}</Text>
        </View>
        <Text style={styles.h2}>{t('safety.resourcesTitle').toUpperCase()}</Text>
        <View style={styles.card}>
          {(emergency?.safety.resources ?? []).map((resource) => (
            <TouchableOpacity
              key={resource.key}
              onPress={() =>
                resource.contact
                  ? void Linking.openURL(`tel:${resource.contact.replace(/\s/g, '')}`)
                  : undefined
              }
            >
              <Text style={styles.h3}>{resource.label}</Text>
              <Text style={styles.body}>{resource.contact}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.muted}>{t('safety.notAlone')}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('craving.title')}</Text>

      {step === 'safety' ? (
        <>
          <Text style={styles.lede}>{t('craving.step.safety')}</Text>
          <TouchableOpacity
            style={[styles.button, styles.actionDanger]}
            onPress={() => void declareDanger()}
            disabled={busy}
          >
            <Text style={[styles.buttonText, styles.actionTextDanger]}>
              {t('craving.step.safety.yes')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => setStep('feeling')}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {t('craving.step.safety.no')}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'feeling' ? (
        <>
          <Text style={styles.lede}>{t('craving.step.feeling')}</Text>
          <Chips
            options={FEELINGS}
            selected={feeling}
            prefix="feeling"
            onPick={(value) => {
              setFeeling(value);
              setStep('location');
            }}
          />
        </>
      ) : null}

      {step === 'location' ? (
        <>
          <Text style={styles.lede}>{t('craving.step.location')}</Text>
          <Chips
            options={LOCATIONS}
            selected={location}
            prefix="location"
            onPick={(value) => {
              setLocation(value);
              setStep('intensity');
            }}
          />
        </>
      ) : null}

      {step === 'intensity' ? (
        <>
          <Text style={styles.lede}>{t('craving.step.intensity')}</Text>
          <View style={styles.row}>
            {INTENSITIES.map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, intensity === value ? styles.chipSelected : null]}
                onPress={() => setIntensity(value)}
              >
                <Text
                  style={[styles.chipText, intensity === value ? styles.chipTextSelected : null]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => void buildPlan()}
            disabled={busy}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {t('craving.step.coach')}
            </Text>
          </TouchableOpacity>
        </>
      ) : null}

      {step === 'plan' && plan ? (
        <>
          {plan.leaveFirst ? (
            <View style={[styles.card, styles.cardAccent]}>
              <Text style={styles.lede}>{t('craving.leaveFirst')}</Text>
            </View>
          ) : null}

          <View style={[styles.card, styles.cardAccent]}>
            <Text style={styles.lede}>{t('craving.delay', { minutes: plan.delayMinutes })}</Text>
          </View>

          {plan.offline ? <Text style={styles.muted}>{t('offline.planSource')}</Text> : null}

          {plan.callFirst ? (
            <View style={styles.card}>
              <Text style={styles.h3}>{t('craving.callFirst', { name: plan.callFirst.name })}</Text>
              {plan.callFirst.phone ? (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={() =>
                    void Linking.openURL(`tel:${plan.callFirst!.phone!.replace(/\s/g, '')}`)
                  }
                >
                  <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                    {t('action.call')} {plan.callFirst.name}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.h2}>{t('toolbox.title').toUpperCase()}</Text>
          <View style={styles.row}>
            {plan.tools.map((tool) => (
              <View style={styles.chip} key={tool.id}>
                <Text style={styles.chipText}>{tool.label}</Text>
              </View>
            ))}
          </View>

          {plan.whyStatement ? (
            <>
              <Text style={styles.h2}>{t('why.title').toUpperCase()}</Text>
              <View style={styles.card}>
                <Text style={styles.lede}>{plan.whyStatement}</Text>
              </View>
            </>
          ) : null}

          <Text style={styles.h2}>{t('protocol.title').toUpperCase()}</Text>
          <View style={styles.card}>
            {plan.protocol.map((line, index) => (
              <View style={styles.step} key={line}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={[styles.body, { flex: 1 }]}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>{t('surf.title').toUpperCase()}</Text>
          <View style={styles.card}>
            {plan.urgeSurfing.map((line) => (
              <Text style={styles.body} key={line}>
                {line}
              </Text>
            ))}
          </View>

          <Text style={styles.h2}>{t('craving.howDidItGo').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, { flex: 1 }]}
              onPress={() => void logOutcome('resisted')}
            >
              <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                {t('craving.outcome.resisted')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { flex: 1 }]}
              onPress={() => void logOutcome('used')}
            >
              <Text style={styles.buttonText}>{t('craving.outcome.used')}</Text>
            </TouchableOpacity>
          </View>
          {/* Never a scolding, and never silence either. Both buttons are a
              report about the hardest part of somebody's day; the app owes them
              an answer about whether it landed. */}
          {logNote ? <Text style={styles.muted}>{logNote}</Text> : null}

          <Text style={[styles.lede, { marginTop: 18 }]}>{plan.followUp}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/coach')}>
            <Text style={styles.buttonText}>{t('quick.talk')}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </ScrollView>
  );
}

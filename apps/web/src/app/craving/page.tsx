'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loading, Shell } from '../../components/Shell';
import { api, type CoachResponse, type CravingPlan } from '../../lib/api';
import {
  loadOfflineKit,
  offlineCravingPlan,
  offlineEmergency,
  queueCraving,
} from '../../lib/offline';
import { useRequireAuth } from '../../lib/session';

const FEELINGS = [
  'craving',
  'panic',
  'loneliness',
  'anger',
  'stress',
  'boredom',
  'grief',
  'pain',
  'social_pressure',
  'other',
] as const;

const LOCATIONS = [
  'home',
  'work',
  'party',
  'with_users',
  'alone',
  'in_transit',
  'other',
] as const;

type Step = 'safety' | 'feeling' | 'location' | 'intensity' | 'plan' | 'emergency';

/**
 * The craving engine.
 *
 * One question per screen, large targets, no typing required to get help. The
 * safety question comes first and its "yes" branch leaves the flow entirely —
 * nothing further down this page is appropriate for someone in danger.
 */
export default function CravingPage() {
  const { user, loading, t, locale } = useRequireAuth();
  const [step, setStep] = useState<Step>('safety');
  const [feeling, setFeeling] = useState<string>('craving');
  const [location, setLocation] = useState<string>('home');
  const [intensity, setIntensity] = useState(7);
  const [plan, setPlan] = useState<(CravingPlan & { offline?: boolean }) | null>(null);
  const [emergency, setEmergency] = useState<CoachResponse | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !user) return <Loading />;

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
      // The one press in this product that must never depend on a network.
      // Before this, a failed request left the person on the safety question
      // with nothing having happened — having just told the app that somebody
      // is in immediate danger. The numbers are bundled; there is nothing to
      // wait for.
      setEmergency(offlineEmergency(locale, user?.country, loadOfflineKit()) as CoachResponse);
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
      // No network. This is the case the whole offline kit exists for: the
      // protocol, the tools and the person's own why are on the device, so the
      // screen still does its job instead of apologising.
      setPlan(offlineCravingPlan(locale, intensity, loadOfflineKit()) as never);
    } finally {
      setStep('plan');
      setBusy(false);
    }
  }

  async function logOutcome(outcome: 'resisted' | 'used') {
    try {
      await api.post('/v1/cravings', { intensity, feeling, location, outcome });
    } catch {
      // Queue it rather than lose it. The pattern engine is only as good as the
      // logs, and the hardest cravings are exactly the ones logged offline.
      queueCraving({
        intensity,
        feeling,
        location,
        outcome,
        occurredAt: new Date().toISOString(),
      });
    }
  }

  if (step === 'emergency') {
    return (
      <Shell title={t('safety.emergencyTitle')}>
        <div className="card warning">
          <p className="lede">{emergency?.reply ?? t('safety.emergency')}</p>
        </div>
        <h2>{t('safety.resourcesTitle')}</h2>
        <div className="card">
          {(emergency?.safety.resources ?? []).map((resource) => (
            <div className="resource" key={resource.key}>
              <span>{resource.label}</span>
              {resource.contact ? (
                <a className="num" href={`tel:${resource.contact.replace(/\s/g, '')}`}>
                  {resource.contact}
                </a>
              ) : null}
            </div>
          ))}
        </div>
        <p className="muted">{t('safety.notAlone')}</p>
      </Shell>
    );
  }

  return (
    <Shell title={t('craving.title')}>
      {step === 'safety' ? (
        <>
          <p className="lede">{t('craving.step.safety')}</p>
          {/* Full width and stacked, not two small chips side by side.
              This is the screen somebody opens at their worst, possibly with
              unsteady hands, and these two buttons are the only things on it —
              so they should be the largest targets in the product rather than
              the smallest. "Yes" stays first: it is the answer that matters
              most, and it must never be the harder one to hit. */}
          <div className="choice-stack">
            <button
              className="btn danger wide tall"
              onClick={() => void declareDanger()}
              disabled={busy}
            >
              {t('craving.step.safety.yes')}
            </button>
            <button className="btn primary wide tall" onClick={() => setStep('feeling')}>
              {t('craving.step.safety.no')}
            </button>
          </div>
        </>
      ) : null}

      {step === 'feeling' ? (
        <>
          <p className="lede">{t('craving.step.feeling')}</p>
          <div className="chips">
            {FEELINGS.map((option) => (
              <button
                key={option}
                className="chip"
                data-selected={feeling === option}
                onClick={() => {
                  setFeeling(option);
                  setStep('location');
                }}
              >
                {t(`feeling.${option}`)}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 'location' ? (
        <>
          <p className="lede">{t('craving.step.location')}</p>
          <div className="chips">
            {LOCATIONS.map((option) => (
              <button
                key={option}
                className="chip"
                data-selected={location === option}
                onClick={() => {
                  setLocation(option);
                  setStep('intensity');
                }}
              >
                {t(`location.${option}`)}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 'intensity' ? (
        <>
          <p className="lede">{t('craving.step.intensity')}</p>
          <div className="card">
            <div className="slider-row">
              <input
                type="range"
                min={0}
                max={10}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
              />
              <span className="slider-value">{intensity}</span>
            </div>
          </div>
          <button className="btn primary wide" onClick={() => void buildPlan()} disabled={busy}>
            {t('craving.step.coach')}
          </button>
        </>
      ) : null}

      {step === 'plan' && plan ? (
        <>
          {plan.leaveFirst ? (
            <div className="card accent">
              <p className="lede">{t('craving.leaveFirst')}</p>
            </div>
          ) : null}

          <div className="card accent">
            <p className="lede">{t('craving.delay', { minutes: plan.delayMinutes })}</p>
          </div>

          {plan.offline ? <p className="muted">{t('offline.planSource')}</p> : null}

          {plan.callFirst ? (
            <div className="card">
              <h3>{t('craving.callFirst', { name: plan.callFirst.name })}</h3>
              {plan.callFirst.phone ? (
                <a
                  className="btn primary wide"
                  href={`tel:${plan.callFirst.phone.replace(/\s/g, '')}`}
                >
                  {t('action.call')} {plan.callFirst.name}
                </a>
              ) : null}
            </div>
          ) : null}

          <h2>{t('toolbox.title')}</h2>
          <div className="chips">
            {plan.tools.map((tool) => (
              <span className="chip" key={tool.id}>
                {tool.label}
              </span>
            ))}
          </div>

          {plan.whyStatement ? (
            <>
              <h2>{t('why.title')}</h2>
              <div className="card">
                <p className="lede">{plan.whyStatement}</p>
              </div>
            </>
          ) : null}

          <h2>{t('protocol.title')}</h2>
          <ol className="steps">
            {plan.protocol.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>

          <h2>{t('surf.title')}</h2>
          <div className="card">
            {plan.urgeSurfing.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <h2>{t('craving.howDidItGo')}</h2>
          <div className="btn-row">
            <button className="btn primary" onClick={() => void logOutcome('resisted')}>
              {t('craving.outcome.resisted')}
            </button>
            <button className="btn" onClick={() => void logOutcome('used')}>
              {t('craving.outcome.used')}
            </button>
          </div>

          <div className="spacer" />
          <p className="lede">{plan.followUp}</p>
          <Link className="btn wide" href="/coach">
            {t('quick.talk')}
          </Link>
        </>
      ) : null}
    </Shell>
  );
}

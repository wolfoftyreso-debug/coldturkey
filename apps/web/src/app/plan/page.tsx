'use client';

import { useEffect, useState } from 'react';
import { Loading, Shell } from '../../components/Shell';
import { api, type Dashboard } from '../../lib/api';
import { useRequireAuth } from '../../lib/session';
import { useAction } from '../../lib/action';

const SUBSTANCES = [
  'alcohol',
  'nicotine',
  'cannabis',
  'opioids',
  'stimulants',
  'benzodiazepines',
  'sedatives',
  'polysubstance',
  'gambling',
  'other_behaviour',
] as const;

export default function PlanPage() {
  const { user, loading, t } = useRequireAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [why, setWhy] = useState('');
  const [future, setFuture] = useState<Record<string, string>>({});
  const [contactName, setContactName] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [substance, setSubstance] = useState<string>('alcohol');
  const [unitsPerDay, setUnitsPerDay] = useState(6);
  const [unitCost, setUnitCost] = useState(30);
  const [detoxMessage, setDetoxMessage] = useState<string | null>(null);
  const { busy, error, run } = useAction(t);

  async function reload() {
    const dashboard = await api.get<Dashboard>('/v1/dashboard');
    setData(dashboard);
    setWhy(dashboard.profile.whyStatement ?? '');
    setFuture(dashboard.profile.futureSelf ?? {});
  }

  useEffect(() => {
    if (!user) return;
    void reload().catch(() => undefined);
  }, [user]);

  if (loading || !user) return <Loading />;

  async function saveProfile() {
    await api.put('/v1/me/profile', { whyStatement: why, futureSelf: future });
    await reload();
  }

  async function createPlan() {
    const response = await api.post<{
      detoxWarning: { required: boolean; message?: string };
    }>('/v1/quit', {
      substance,
      baselineUnitsPerDay: unitsPerDay,
      // The API stores money in minor units so nothing ever rounds oddly.
      unitCostMinor: Math.round(unitCost * 100),
      currency: 'SEK',
    });
    setDetoxMessage(response.detoxWarning.required ? response.detoxWarning.message ?? null : null);
    await reload();
  }

  async function addContact() {
    if (!contactName.trim()) return;
    await api.post('/v1/support', {
      name: contactName,
      relation: contactRelation,
      phone: contactPhone || null,
      isPrimary: (data?.supportContacts.length ?? 0) === 0,
    });
    // Only cleared once the write has actually landed. Clearing first loses
    // what they typed if the request then fails.
    setContactName('');
    setContactRelation('');
    setContactPhone('');
    await reload();
  }

  return (
    <Shell title={t('nav.plan')}>
      {error ? <div className="error-banner">{error}</div> : null}
      {!data?.quit ? (
        <>
          <h2>{t('onboarding.pickSubstance')}</h2>
          <div className="chips">
            {SUBSTANCES.map((option) => (
              <button
                key={option}
                className="chip"
                data-selected={substance === option}
                onClick={() => setSubstance(option)}
              >
                {t(`substance.${option}`)}
              </button>
            ))}
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor="units">{t('onboarding.unitsPerDay')}</label>
              <input
                id="units"
                type="number"
                min={0}
                value={unitsPerDay}
                onChange={(event) => setUnitsPerDay(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="cost">{t('onboarding.cost').replace('{unit}', '')}</label>
              <input
                id="cost"
                type="number"
                min={0}
                value={unitCost}
                onChange={(event) => setUnitCost(Number(event.target.value))}
              />
            </div>
            <button className="btn primary wide" onClick={run(createPlan)} disabled={busy}>
              {t('onboarding.done')}
            </button>
          </div>

          {detoxMessage ? (
            <div className="card warning">
              <p className="lede">{detoxMessage}</p>
            </div>
          ) : null}
        </>
      ) : null}

      <h2 id="why">{t('why.title')}</h2>
      <div className="card">
        <p className="muted">{t('why.questions.cost')}</p>
        <p className="muted">{t('why.questions.who')}</p>
        <p className="muted">{t('why.questions.year')}</p>
        <div className="field" style={{ marginTop: 12 }}>
          <textarea
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            placeholder={t('why.prompt')}
          />
        </div>
        <button className="btn primary wide" onClick={run(saveProfile)} disabled={busy}>
          {t('action.save')}
        </button>
      </div>

      <h2>{t('future.title')}</h2>
      <div className="card">
        {(
          [
            ['days30', 'future.30'],
            ['days90', 'future.90'],
            ['year1', 'future.1y'],
            ['year5', 'future.5y'],
          ] as const
        ).map(([field, label]) => (
          <div className="field" key={field}>
            <label htmlFor={field}>{t(label)}</label>
            <input
              id={field}
              value={future[field] ?? ''}
              onChange={(event) =>
                setFuture((current) => ({ ...current, [field]: event.target.value }))
              }
            />
          </div>
        ))}
        <button className="btn primary wide" onClick={run(saveProfile)} disabled={busy}>
          {t('action.save')}
        </button>
      </div>

      <h2 id="support">{t('support.title')}</h2>
      {data?.supportContacts.length ? (
        <div className="card">
          {data.supportContacts.map((contact) => (
            <div className="resource" key={contact.id}>
              <span>
                {contact.name}
                {contact.relation ? ` · ${contact.relation}` : ''}
                {contact.isPrimary ? (
                  <span className="pill" data-tone="accent" style={{ marginLeft: 8 }}>
                    1
                  </span>
                ) : null}
              </span>
              {contact.phone ? (
                <a className="num" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                  {t('action.call')}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{t('support.empty')}</p>
      )}

      <div className="card">
        <div className="field">
          <label htmlFor="cname">{t('support.name')}</label>
          <input
            id="cname"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="crel">{t('support.relation')}</label>
          <input
            id="crel"
            value={contactRelation}
            onChange={(event) => setContactRelation(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cphone">{t('support.phone')}</label>
          <input
            id="cphone"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </div>
        <button className="btn wide" onClick={run(addContact)} disabled={busy}>
          {t('support.add')}
        </button>
      </div>

      <p className="muted">{t('support.noRequirement')}</p>
      <div className="spacer" />
      <p className="muted">{t('about.objective')}</p>
    </Shell>
  );
}

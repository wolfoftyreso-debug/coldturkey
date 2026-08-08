import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  assessPhase,
  availableDomains,
  buildCravingPlan,
  buildProtectionPlan,
  computeIndicators,
  computeMilestones,
  computeReclaimed,
  computeStreak,
  CRAVING_FEELINGS,
  CRAVING_LOCATIONS,
  detoxWarning,
  emergencyResources,
  LIFE_DOMAINS,
  findInsights,
  mantraOfTheDay,
  nextDayMilestone,
  rebuildProgress,
  RELAPSE_AUTOPSY_QUESTIONS,
  RELAPSE_SAFETY_QUESTIONS,
  substanceProfile,
  suggestedDelayMinutes,
  suggestNextDomain,
  TEN_MINUTE_PROTOCOL,
  TOOLBOX,
  URGE_SURFING_SCRIPT,
  type DomainProgress,
  type LifeDomainId,
} from '@cleat/core';
import { localizeInsightParams, translate, type Locale } from '@cleat/i18n';
import { withTenant } from '../db/pool.js';
import {
  createCraving,
  createQuit,
  createSupportContact,
  deleteSupportContact,
  getActiveQuit,
  createTrigger,
  deleteTrigger,
  listCoachMessages,
  listLifeDomains,
  listTriggers,
  loadSnapshot,
  recordRelapse,
  updateCravingOutcome,
  updateProfile,
  upsertCheckIn,
  upsertLifeDomain,
  writeAudit,
} from '../db/repository.js';
import { badRequest, notFound } from '../lib/errors.js';
import { authenticate, currentUser } from '../plugins/auth.js';
import { publicUser } from './auth.js';

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

export async function recoveryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // ------------------------------------------------------------------- me ---

  app.get('/v1/me', async (request) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      return { user: publicUser(user), profile: snapshot.profile };
    });
  });

  app.patch('/v1/me', async (request) => {
    const user = currentUser(request);
    const body = z
      .object({
        displayName: z.string().max(80).optional(),
        locale: z.enum(['sv', 'en']).optional(),
        country: z.string().length(2).optional(),
        timezone: z.string().max(64).optional(),
      })
      .parse(request.body);

    return withTenant(user.tenant_id, async (client) => {
      const { rows } = await client.query(
        `UPDATE users SET
           display_name = COALESCE($2, display_name),
           locale       = COALESCE($3, locale),
           country      = COALESCE($4, country),
           timezone     = COALESCE($5, timezone)
         WHERE id = $1
         RETURNING id, email, display_name, role, locale, country, timezone`,
        [
          user.id,
          body.displayName ?? null,
          body.locale ?? null,
          body.country?.toUpperCase() ?? null,
          body.timezone ?? null,
        ],
      );
      return { user: publicUser(rows[0]) };
    });
  });

  app.put('/v1/me/profile', async (request) => {
    const user = currentUser(request);
    const body = z
      .object({
        whyStatement: z.string().max(4000).nullable().optional(),
        futureSelf: z
          .object({
            days30: z.string().max(2000).optional(),
            days90: z.string().max(2000).optional(),
            year1: z.string().max(2000).optional(),
            year5: z.string().max(2000).optional(),
            letter: z.string().max(8000).optional(),
          })
          .optional(),
        phase: z.enum(['insight', 'decision', 'preparation']).optional(),
      })
      .parse(request.body);

    return withTenant(user.tenant_id, async (client) => {
      await updateProfile(client, user.id, user.tenant_id, body);
      const snapshot = await loadSnapshot(client, user);
      return { profile: snapshot.profile };
    });
  });

  // -------------------------------------------------------------- the plan ---

  app.post('/v1/quit', async (request, reply) => {
    const user = currentUser(request);
    const body = z
      .object({
        substance: z.enum(SUBSTANCES),
        startedAt: z.coerce.date().optional(),
        baselineUnitsPerDay: z.number().min(0).max(1000),
        unitCostMinor: z.number().int().min(0).max(10_000_000),
        currency: z.string().length(3).default('SEK'),
        minutesPerUnit: z.number().int().min(0).max(1440).optional(),
      })
      .parse(request.body);

    const profile = substanceProfile(body.substance);

    const quit = await withTenant(user.tenant_id, async (client) => {
      const created = await createQuit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        substance: body.substance,
        startedAt: body.startedAt ?? new Date(),
        baselineUnitsPerDay: body.baselineUnitsPerDay,
        unitCostMinor: body.unitCostMinor,
        currency: body.currency.toUpperCase(),
        minutesPerUnit: body.minutesPerUnit ?? profile.defaultMinutesPerUnit,
      });
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'quit.create',
        meta: { substance: body.substance },
      });
      return created;
    });

    const warning = detoxWarning(body.substance);
    const locale = user.locale as Locale;

    // The medical warning goes out with the plan, not buried in a settings page.
    // For alcohol and benzodiazepines this is the single most important string
    // the product will ever show someone.
    return reply.code(201).send({
      quit,
      detoxWarning: warning.required
        ? { required: true, risk: warning.risk, message: translate(locale, warning.messageKey) }
        : { required: false },
    });
  });

  app.get('/v1/quit', async (request) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => ({
      quit: await getActiveQuit(client, user.id),
    }));
  });

  // ------------------------------------------------------------- dashboard ---

  /**
   * Everything the home screen needs in one round trip. Someone opening the app
   * mid-craving should not be waiting on six sequential requests.
   */
  app.get('/v1/dashboard', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const now = new Date();

    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      const phase = assessPhase(snapshot, now);
      const indicators = computeIndicators(snapshot, now);
      const insights = findInsights(snapshot, { now, limit: 3 });

      const streak = snapshot.quit
        ? computeStreak(snapshot.quit, snapshot.relapses, now)
        : null;
      const reclaimed =
        snapshot.quit && streak ? computeReclaimed(snapshot.quit, streak.currentMs, now) : null;
      const milestones =
        snapshot.quit && streak
          ? computeMilestones(snapshot.quit.substance, streak.currentMs / 3_600_000)
          : null;

      return {
        user: publicUser(user),
        profile: snapshot.profile,
        quit: snapshot.quit,
        phase: {
          key: phase.phase,
          label: translate(locale, `phase.${phase.phase}`),
          reason: translate(locale, phase.reasonKey),
          horizon: phase.horizon,
          focus: phase.focusKeys.map((key) => ({ key, label: translate(locale, key) })),
        },
        streak: streak
          ? {
              ...streak,
              nextDayMilestone: nextDayMilestone(streak.currentDays),
            }
          : null,
        reclaimed,
        milestones: milestones
          ? {
              reached: milestones.reached.map((m) => ({ ...m, text: translate(locale, m.key) })),
              next: milestones.next
                ? { ...milestones.next, text: translate(locale, milestones.next.key) }
                : null,
              progressToNext: milestones.progressToNext,
            }
          : null,
        indicators: indicators.indicators.map((indicator) => ({
          ...indicator,
          label: translate(locale, `indicator.${indicator.key}`),
          description: translate(locale, `indicator.${indicator.key}.desc`),
        })),
        insights: insights.map((insight) => ({
          id: insight.id,
          evidence: insight.evidence,
          suggestedToolId: insight.suggestedToolId ?? null,
          text: translate(
            locale,
            insight.message.key,
            localizeInsightParams(locale, insight.message.params),
          ),
        })),
        mantra: translate(locale, mantraOfTheDay(now)),
        supportContacts: snapshot.supportContacts,
        detoxWarning: snapshot.quit ? detoxWarning(snapshot.quit.substance) : null,
      };
    });
  });

  // ---------------------------------------------------------- craving flow ---

  /**
   * Build a plan for the moment without recording anything.
   *
   * Separate from logging on purpose: someone in an acute craving must be able to
   * get help without first committing a record about themselves to a database.
   */
  app.post('/v1/craving/plan', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const body = z
      .object({
        feeling: z.enum(CRAVING_FEELINGS as unknown as [string, ...string[]]),
        location: z.enum(CRAVING_LOCATIONS as unknown as [string, ...string[]]),
        intensity: z.number().int().min(0).max(10),
      })
      .parse(request.body);

    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user, 30);
      const plan = buildCravingPlan({
        feeling: body.feeling as never,
        location: body.location as never,
        intensity: body.intensity,
        supportContacts: snapshot.supportContacts,
        hasWhyStatement: Boolean(snapshot.profile.whyStatement),
      });

      return {
        leaveFirst: plan.leaveFirst,
        callFirst: plan.callFirst,
        delayMinutes: suggestedDelayMinutes(body.intensity),
        tools: plan.tools.map((tool) => ({
          id: tool.id,
          category: tool.category,
          minutes: tool.minutes,
          label: translate(locale, `tool.${tool.id}`),
        })),
        protocol: TEN_MINUTE_PROTOCOL.map((key) => translate(locale, key)),
        urgeSurfing: URGE_SURFING_SCRIPT.map((key) => translate(locale, key)),
        whyStatement: snapshot.profile.whyStatement,
        followUp: translate(locale, plan.followUpKey),
      };
    });
  });

  app.post('/v1/cravings', async (request, reply) => {
    const user = currentUser(request);
    const body = z
      .object({
        intensity: z.number().int().min(0).max(10),
        feeling: z.enum(CRAVING_FEELINGS as unknown as [string, ...string[]]),
        location: z.enum(CRAVING_LOCATIONS as unknown as [string, ...string[]]),
        trigger: z.string().max(500).nullish(),
        thought: z.string().max(2000).nullish(),
        actionTaken: z.string().max(500).nullish(),
        outcome: z.enum(['resisted', 'used', 'unknown']).optional(),
        note: z.string().max(4000).nullish(),
      })
      .parse(request.body);

    const craving = await withTenant(user.tenant_id, async (client) =>
      createCraving(client, { tenantId: user.tenant_id, userId: user.id, ...body }),
    );
    return reply.code(201).send({ craving });
  });

  app.patch('/v1/cravings/:id', async (request) => {
    const user = currentUser(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        outcome: z.enum(['resisted', 'used', 'unknown']),
        actionTaken: z.string().max(500).nullish(),
      })
      .parse(request.body);

    const craving = await withTenant(user.tenant_id, async (client) =>
      updateCravingOutcome(client, user.id, id, body.outcome, body.actionTaken),
    );
    if (!craving) throw notFound('Craving');
    return { craving };
  });

  app.get('/v1/cravings', async (request) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      return { cravings: snapshot.cravings };
    });
  });

  // ------------------------------------------------------------- check-ins ---

  app.post('/v1/checkins', async (request, reply) => {
    const user = currentUser(request);
    const body = z
      .object({
        kind: z.enum(['morning', 'evening']),
        day: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        mood: z.number().int().min(0).max(10).nullish(),
        sleepQuality: z.number().int().min(0).max(10).nullish(),
        stress: z.number().int().min(0).max(10).nullish(),
        cravingIntensity: z.number().int().min(0).max(10).nullish(),
        biggestRisk: z.string().max(1000).nullish(),
        keyDecision: z.string().max(1000).nullish(),
        wentWell: z.string().max(2000).nullish(),
        wasHard: z.string().max(2000).nullish(),
        learned: z.string().max(2000).nullish(),
        note: z.string().max(4000).nullish(),
      })
      .parse(request.body);

    // The client sends its own local day. The server's idea of "today" is in UTC
    // and would move someone's evening check-in into tomorrow.
    const day = body.day ?? new Date().toISOString().slice(0, 10);

    const checkIn = await withTenant(user.tenant_id, async (client) =>
      upsertCheckIn(client, { tenantId: user.tenant_id, userId: user.id, ...body, day }),
    );
    return reply.code(201).send({ checkIn });
  });

  app.get('/v1/checkins', async (request) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      return { checkIns: snapshot.checkIns };
    });
  });

  // --------------------------------------------------------------- relapse ---

  app.get('/v1/relapse/questions', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    return {
      opening: translate(locale, 'relapse.opening'),
      continuity: translate(locale, 'relapse.continuity'),
      safety: RELAPSE_SAFETY_QUESTIONS.map((key) => ({ key, text: translate(locale, key) })),
      autopsy: RELAPSE_AUTOPSY_QUESTIONS.map((q) => ({
        field: q.field,
        key: q.key,
        text: translate(locale, q.key),
      })),
    };
  });

  app.post('/v1/relapse', async (request, reply) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const body = z
      .object({
        occurredAt: z.coerce.date().optional(),
        note: z.string().max(4000).nullish(),
        autopsy: z
          .object({
            whatHappened: z.string().max(4000).optional(),
            chainStartedAt: z.string().max(500).optional(),
            firstTrigger: z.string().max(1000).optional(),
            thought: z.string().max(1000).optional(),
            feeling: z.string().max(1000).optional(),
            decision: z.string().max(1000).optional(),
            ignoredWarnings: z.string().max(1000).optional(),
            peoplePresent: z.string().max(1000).optional(),
            whatCouldHaveBrokenTheChain: z.string().max(2000).optional(),
            whatChangesNow: z.string().max(2000).optional(),
          })
          .optional(),
      })
      .parse(request.body);

    const plan = buildProtectionPlan(body.autopsy ?? {});

    const result = await withTenant(user.tenant_id, async (client) => {
      const quit = await getActiveQuit(client, user.id);
      if (!quit) throw badRequest('no_active_plan', 'There is no active quit plan to record against');

      const relapse = await recordRelapse(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        quitId: quit.id,
        occurredAt: body.occurredAt ?? new Date(),
        note: body.note,
        autopsy: body.autopsy,
        protectionPlan: plan,
      });

      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'relapse.record',
      });

      const snapshot = await loadSnapshot(client, user);
      const streak = computeStreak(quit, snapshot.relapses, new Date());
      return { relapse, streak };
    });

    return reply.code(201).send({
      id: result.relapse.id,
      message: translate(locale, 'relapse.continuity'),
      protectionPlan: {
        ...plan,
        tools: plan.toolIds.map((id) => ({ id, label: translate(locale, `tool.${id}`) })),
      },
      // Shown explicitly so the client never has to imply that anything was lost.
      streak: {
        currentDays: result.streak.currentDays,
        longestDays: result.streak.longestDays,
        totalDaysInRecovery: result.streak.totalDaysInRecovery,
      },
    });
  });

  // ------------------------------------------------------- support network ---

  app.get('/v1/support', async (request) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user, 1);
      return { contacts: snapshot.supportContacts };
    });
  });

  app.post('/v1/support', async (request, reply) => {
    const user = currentUser(request);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        relation: z.string().max(120).default(''),
        phone: z.string().max(40).nullish(),
        note: z.string().max(1000).nullish(),
        isPrimary: z.boolean().optional(),
      })
      .parse(request.body);

    const contact = await withTenant(user.tenant_id, async (client) =>
      createSupportContact(client, { tenantId: user.tenant_id, userId: user.id, ...body }),
    );
    return reply.code(201).send({ contact });
  });

  app.delete('/v1/support/:id', async (request, reply) => {
    const user = currentUser(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const removed = await withTenant(user.tenant_id, async (client) =>
      deleteSupportContact(client, user.id, id),
    );
    if (!removed) throw notFound('Contact');
    return reply.code(204).send();
  });

  // ----------------------------------------------------------- trigger map ---

  /**
   * Phase 2 of the recovery model. The point is not to collect triggers but to
   * make the chain visible: by the time someone can see thought → feeling →
   * impulse written down, the impulse has stopped feeling like a single
   * inevitable event.
   */
  app.get('/v1/triggers', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    return withTenant(user.tenant_id, async (client) => {
      const rows = await listTriggers(client, user.id);
      return {
        intro: translate(locale, 'trigger.intro'),
        steps: ['trigger', 'thought', 'feeling', 'impulse', 'action', 'consequence'].map(
          (key) => ({ key, label: translate(locale, `trigger.step.${key}`) }),
        ),
        triggers: rows.map((row) => ({
          id: row.id,
          label: row.label,
          category: row.category,
          chain: row.chain ?? {},
        })),
      };
    });
  });

  app.post('/v1/triggers', async (request, reply) => {
    const user = currentUser(request);
    const body = z
      .object({
        label: z.string().min(1).max(200),
        category: z.string().max(60).default('other'),
        chain: z
          .object({
            thought: z.string().max(1000).optional(),
            feeling: z.string().max(1000).optional(),
            impulse: z.string().max(1000).optional(),
            action: z.string().max(1000).optional(),
            consequence: z.string().max(1000).optional(),
          })
          .default({}),
      })
      .parse(request.body);

    const trigger = await withTenant(user.tenant_id, async (client) =>
      createTrigger(client, { tenantId: user.tenant_id, userId: user.id, ...body }),
    );
    return reply.code(201).send({ trigger });
  });

  app.delete('/v1/triggers/:id', async (request, reply) => {
    const user = currentUser(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const removed = await withTenant(user.tenant_id, async (client) =>
      deleteTrigger(client, user.id, id),
    );
    if (!removed) throw notFound('Trigger');
    return reply.code(204).send();
  });

  // ------------------------------------------------------- rebuild my life ---

  /**
   * The fifth mode. Returns only the domains it is honest to offer at this
   * phase — someone on day two cannot work on their career, and showing it to
   * them just adds a failure to a day that already has enough.
   */
  app.get('/v1/rebuild', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const now = new Date();

    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      const rows = await listLifeDomains(client, user.id);
      const phase = assessPhase(snapshot, now).phase;

      const progress: DomainProgress[] = rows.map((r) => ({
        id: r.domain as LifeDomainId,
        status: r.status,
        note: r.note,
        updatedAt: r.updated_at,
      }));
      const byId = new Map(progress.map((p) => [p.id, p]));
      const available = availableDomains(phase);
      const suggestion = suggestNextDomain(snapshot, progress, phase, now);

      return {
        intro: translate(locale, 'rebuild.intro'),
        pickOne: translate(locale, 'rebuild.pickOne'),
        phase,
        progress: rebuildProgress(progress),
        suggestion: suggestion
          ? {
              domain: suggestion.domain.id,
              label: translate(locale, `rebuild.domain.${suggestion.domain.id}`),
              reason: translate(locale, suggestion.reasonKey),
            }
          : null,
        domains: available.map((domain) => {
          const current = byId.get(domain.id);
          return {
            id: domain.id,
            dimension: domain.dimension,
            label: translate(locale, `rebuild.domain.${domain.id}`),
            description: translate(locale, `rebuild.domain.${domain.id}.desc`),
            status: current?.status ?? 'untouched',
            statusLabel: translate(locale, `rebuild.status.${current?.status ?? 'untouched'}`),
            note: current?.note ?? null,
          };
        }),
        // Locked domains are reported rather than hidden, so the person can see
        // the whole map and that nothing is being kept from them — just deferred.
        locked: LIFE_DOMAINS.filter((d) => !available.some((a) => a.id === d.id)).map((d) => ({
          id: d.id,
          label: translate(locale, `rebuild.domain.${d.id}`),
        })),
      };
    });
  });

  app.put('/v1/rebuild/:domain', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const { domain } = z
      .object({ domain: z.enum(LIFE_DOMAINS.map((d) => d.id) as unknown as [string, ...string[]]) })
      .parse(request.params);
    const body = z
      .object({
        status: z.enum(['untouched', 'working', 'steady']),
        note: z.string().max(4000).nullish(),
      })
      .parse(request.body);

    return withTenant(user.tenant_id, async (client) => {
      const row = await upsertLifeDomain(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        domain,
        status: body.status,
        note: body.note,
      });
      return {
        domain: row.domain,
        status: row.status,
        statusLabel: translate(locale, `rebuild.status.${row.status}`),
        note: row.note,
      };
    });
  });

  // --------------------------------------------------------------- toolbox ---

  app.get('/v1/toolbox', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    return {
      tools: TOOLBOX.map((tool) => ({
        ...tool,
        label: translate(locale, `tool.${tool.id}`),
        categoryLabel: translate(locale, `toolbox.category.${tool.category}`),
      })),
    };
  });

  app.get('/v1/safety/resources', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    return {
      disclaimer: translate(locale, 'safety.disclaimer'),
      resources: emergencyResources(user.country).map((resource) => ({
        ...resource,
        label: translate(locale, resource.key),
      })),
    };
  });

  app.get('/v1/coach/history', async (request) => {
    const user = currentUser(request);
    const limit = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(30) })
      .parse(request.query).limit;

    return withTenant(user.tenant_id, async (client) => ({
      messages: await listCoachMessages(client, user.id, limit),
    }));
  });
}

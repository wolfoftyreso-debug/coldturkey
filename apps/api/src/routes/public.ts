import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { emergencyResources, triage } from '@cleat/core';
import { negotiateLocale, translate, type Locale } from '@cleat/i18n';

/**
 * The unauthenticated surface.
 *
 * It exists for one reason that outranks the others: the emergency numbers
 * used to sit behind a login. Somebody in crisis who found the landing page
 * had to create an account before the product would tell them what to ring,
 * which is the product putting its funnel ahead of the thing it claims to be
 * for. Nothing here requires an account, and nothing here reads or writes
 * anybody's data.
 *
 * The second reason is that "an API out" starts here — a documented, stable,
 * public surface that another service or a partner clinic can call without
 * being issued credentials for a person's recovery record.
 */
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  const localeOf = (header: string | undefined, requested?: string): Locale =>
    requested === 'sv' || requested === 'en' ? requested : negotiateLocale(header);

  const query = z.object({
    country: z.string().length(2).optional(),
    locale: z.enum(['sv', 'en']).optional(),
  });

  /**
   * Emergency and crisis contacts for a country.
   *
   * Deliberately reachable with no token, no account and no cookie. Cached at
   * the edge because it is the same answer for everyone in a country, and
   * because the one time it is needed is the one time the network is bad.
   */
  app.get('/v1/public/safety/resources', async (request, reply) => {
    const { country, locale: requested } = query.parse(request.query);
    const locale = localeOf(request.headers['accept-language'], requested);

    void reply.header('cache-control', 'public, max-age=3600');
    return {
      country: country?.toUpperCase() ?? null,
      disclaimer: translate(locale, 'safety.disclaimer'),
      resources: emergencyResources(country).map((resource) => ({
        key: resource.key,
        contact: resource.contact,
        kind: resource.kind,
        label: translate(locale, resource.key),
      })),
    };
  });

  /**
   * Run a message through safety triage without storing anything.
   *
   * Offered so an integrator — a partner service, another app, a helpline's
   * own tooling — can use the triage without sending their users through
   * Cleat. Nothing is written: no message, no result, no address. That is the
   * whole point of exposing it here rather than behind an account.
   *
   * Rate limited by the global limiter. If this ever carries real volume it
   * needs its own budget, which is a deliberate follow-up rather than an
   * oversight.
   */
  const triageBody = z.object({
    text: z.string().min(1).max(4000),
    country: z.string().length(2).optional(),
    locale: z.enum(['sv', 'en']).optional(),
  });

  app.post('/v1/public/safety/triage', async (request) => {
    const body = triageBody.parse(request.body);
    const locale = localeOf(request.headers['accept-language'], body.locale);
    const result = triage({ text: body.text, country: body.country, locale });

    return {
      level: result.level,
      categories: result.categories,
      // The caller is told when to stop coaching and hand over. An integrator
      // that ignores this is the failure mode worth naming in the docs.
      bypassCoach: result.bypassCoach,
      askDirectly: result.askDirectly,
      message: translate(locale, result.messageKey),
      resources: result.resources.map((resource) => ({
        key: resource.key,
        contact: resource.contact,
        kind: resource.kind,
        label: translate(locale, resource.key),
      })),
      stored: false,
    };
  });

  /** What this deployment is and speaks. Useful for a client deciding a locale. */
  app.get('/v1/public/meta', async (_request, reply) => {
    void reply.header('cache-control', 'public, max-age=3600');
    return {
      product: 'Cleat',
      api: 'v1',
      locales: ['sv', 'en'],
      countries: ['SE', 'US', 'GB'],
      docs: '/v1/public/openapi.json',
    };
  });
}

import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../config.js';
import { z } from 'zod';
import { translate, type Locale } from '@cleat/i18n';
import { withTenant } from '../db/pool.js';
import { appendCoachMessage, listCoachMessages, loadSnapshot } from '../db/repository.js';
import { coach } from '../coach/service.js';
import { authenticate, currentUser } from '../plugins/auth.js';

const messageBody = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(['acute', 'relapse', 'general', 'deep', 'supporter']).optional(),
  immediateDanger: z.boolean().optional(),
});

export async function coachRoutes(app: FastifyInstance): Promise<void> {
  const config = loadConfig();
  app.addHook('preHandler', authenticate);

  app.post<{ Body: unknown }>(
    '/v1/coach/message',
    {
      // Each of these can reach a language model, which costs money and takes
      // seconds. The global per-IP ceiling does not bound that: one signed-in
      // account can burn the whole budget, and an attacker with an account is
      // a paying customer for somebody else's bill. Twenty a minute is far
      // above any real conversation and far below a useful abuse rate.
      config: {
        rateLimit: { max: config.COACH_LIMIT_MAX, timeWindow: config.COACH_LIMIT_WINDOW },
      },
    },
    async (request, reply) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const body = messageBody.parse(request.body);
    const now = new Date();

    const result = await withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      const history = (await listCoachMessages(client, user.id, 16, user.tenant_id)).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await coach({
        snapshot,
        displayName: user.display_name,
        locale,
        message: body.message,
        mode: body.mode,
        immediateDanger: body.immediateDanger,
        history,
        now,
      });

      // The user's own words are stored before the reply, so a crash between the
      // two does not lose what they said.
      await appendCoachMessage(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        role: 'user',
        content: body.message,
        mode: response.mode,
        safetyLevel: response.safetyLevel,
      });
      await appendCoachMessage(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        role: 'assistant',
        content: response.text,
        mode: response.mode,
        safetyLevel: response.safetyLevel,
      });

      return response;
    });

    return reply.send({
      reply: result.text,
      mode: result.mode,
      safety: {
        level: result.safetyLevel,
        categories: result.safetyCategories,
        bypassedCoach: result.bypassedCoach,
        resources: result.resources.map((resource) => ({
          ...resource,
          label: translate(locale, resource.key),
        })),
      },
      negotiation: result.negotiation,
      // Surfaced honestly rather than hidden: if the model is unavailable the
      // person should know the answer came from the built-in tools.
      source: result.local ? 'local' : 'model',
    });
    },
  );
}

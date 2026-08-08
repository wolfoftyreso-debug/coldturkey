import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { translate, type Locale } from '@nivora/i18n';
import { withTenant } from '../db/pool.js';
import { appendCoachMessage, listCoachMessages, loadSnapshot } from '../db/repository.js';
import { coach } from '../coach/service.js';
import { authenticate, currentUser } from '../plugins/auth.js';

const messageBody = z.object({
  message: z.string().min(1).max(4000),
  mode: z.enum(['acute', 'relapse', 'general', 'deep']).optional(),
  immediateDanger: z.boolean().optional(),
});

export async function coachRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.post('/v1/coach/message', async (request, reply) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const body = messageBody.parse(request.body);
    const now = new Date();

    const result = await withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user);
      const history = (await listCoachMessages(client, user.id, 16)).map((m) => ({
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
  });
}

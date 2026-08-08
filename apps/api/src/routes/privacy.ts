import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { translate, type Locale } from '@cleat/i18n';
import { withTenant } from '../db/pool.js';
import { listCoachMessages, loadSnapshot, writeAudit } from '../db/repository.js';
import { badRequest } from '../lib/errors.js';
import { authenticate, currentUser } from '../plugins/auth.js';
import { publicUser } from './auth.js';

/**
 * Privacy routes.
 *
 * Recovery data is among the most sensitive category of personal data there is:
 * disclosed to the wrong party it costs people custody, employment and
 * insurance. Export and erasure are therefore first-class product features, not
 * a compliance checkbox behind a support ticket.
 */
export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/v1/privacy/summary', async (request) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user, 3650);
      return {
        principles: translate(locale, 'privacy.principles'),
        whatWeStore: [
          { category: 'account', count: 1 },
          { category: 'profile', count: snapshot.profile.whyStatement ? 1 : 0 },
          { category: 'quitPlan', count: snapshot.quit ? 1 : 0 },
          { category: 'relapses', count: snapshot.relapses.length },
          { category: 'checkIns', count: snapshot.checkIns.length },
          { category: 'cravings', count: snapshot.cravings.length },
          { category: 'supportContacts', count: snapshot.supportContacts.length },
        ],
        sharing: {
          soldToThirdParties: false,
          usedForAdvertising: false,
          sharedWithInsurers: false,
          sharedWithEmployers: false,
        },
      };
    });
  });

  /** Everything we hold, in one JSON document the user can keep. */
  app.get('/v1/privacy/export', async (request, reply) => {
    const user = currentUser(request);
    return withTenant(user.tenant_id, async (client) => {
      const snapshot = await loadSnapshot(client, user, 3650);
      const messages = await listCoachMessages(client, user.id, 1000);
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: user.id,
        action: 'privacy.export',
      });

      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-disposition', 'attachment; filename="cleat-export.json"')
        .send({
          exportedAt: new Date().toISOString(),
          user: publicUser(user),
          profile: snapshot.profile,
          quit: snapshot.quit,
          relapses: snapshot.relapses,
          checkIns: snapshot.checkIns,
          cravings: snapshot.cravings,
          supportContacts: snapshot.supportContacts,
          coachMessages: messages,
        });
    });
  });

  /**
   * Hard delete, not a soft flag.
   *
   * Every tenant-scoped table cascades from `users`, so removing the row removes
   * the check-ins, the cravings, the relapse autopsies and the coach transcript
   * with it. The audit entry that records the deletion is written first and
   * deliberately carries no user id afterwards.
   */
  app.delete('/v1/privacy/account', async (request, reply) => {
    const user = currentUser(request);
    const locale = user.locale as Locale;
    const body = z.object({ confirm: z.string() }).parse(request.body ?? {});

    const expected = translate(locale, 'privacy.deleteWord');
    if (body.confirm !== expected && body.confirm !== 'DELETE' && body.confirm !== 'RADERA') {
      throw badRequest('confirmation_required', `Send { "confirm": "${expected}" } to proceed`);
    }

    await withTenant(user.tenant_id, async (client) => {
      await writeAudit(client, {
        tenantId: user.tenant_id,
        userId: null,
        action: 'privacy.account_deleted',
        meta: { at: new Date().toISOString() },
      });
      await client.query('DELETE FROM users WHERE id = $1', [user.id]);
    });

    return reply.send({ deleted: true, message: translate(locale, 'privacy.deleted') });
  });
}

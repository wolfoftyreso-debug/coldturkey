import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/pool.js';
import { coachEnabled } from '../coach/claude.js';
import { render } from '../observability/metrics.js';

/**
 * Kubernetes probes and metrics.
 *
 * `/healthz` is a liveness probe: it answers as long as the process is running.
 * `/readyz` is a readiness probe and actually touches the database — a pod that
 * cannot reach Postgres must be pulled out of the service, not left serving
 * errors to someone in the middle of a craving.
 *
 * The metric definitions live in `observability/metrics.ts`, including the rule
 * that no metric may carry anything about a person.
 */
export { metrics } from '../observability/metrics.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime() }));

  app.get('/readyz', async (_request, reply) => {
    try {
      await getPool().query('SELECT 1');
      return { status: 'ready', database: 'ok', coach: coachEnabled() ? 'configured' : 'local' };
    } catch (error) {
      return reply
        .code(503)
        .send({ status: 'unavailable', database: 'error', error: (error as Error).message });
    }
  });

  app.get('/metrics', async (_request, reply) =>
    reply.header('content-type', 'text/plain; version=0.0.4').send(render()),
  );
}

import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/pool.js';
import { coachEnabled } from '../coach/claude.js';

/**
 * Kubernetes probes and metrics.
 *
 * `/healthz` is a liveness probe: it answers as long as the process is running.
 * `/readyz` is a readiness probe and actually touches the database — a pod that
 * cannot reach Postgres must be pulled out of the service, not left serving
 * errors to someone in the middle of a craving.
 */
export const metrics = {
  requests: 0,
  errors: 0,
  coachModelCalls: 0,
  coachLocalFallbacks: 0,
  safetyEmergencies: 0,
};

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

  app.get('/metrics', async (_request, reply) => {
    const memory = process.memoryUsage();
    const lines = [
      '# HELP nivora_requests_total Total HTTP requests handled.',
      '# TYPE nivora_requests_total counter',
      `nivora_requests_total ${metrics.requests}`,
      '# HELP nivora_errors_total Total HTTP responses with status >= 500.',
      '# TYPE nivora_errors_total counter',
      `nivora_errors_total ${metrics.errors}`,
      '# HELP nivora_coach_model_calls_total Coach replies produced by the language model.',
      '# TYPE nivora_coach_model_calls_total counter',
      `nivora_coach_model_calls_total ${metrics.coachModelCalls}`,
      '# HELP nivora_coach_local_total Coach replies produced by the built-in local coach.',
      '# TYPE nivora_coach_local_total counter',
      `nivora_coach_local_total ${metrics.coachLocalFallbacks}`,
      '# HELP nivora_safety_emergencies_total Messages that triggered the emergency safety path.',
      '# TYPE nivora_safety_emergencies_total counter',
      `nivora_safety_emergencies_total ${metrics.safetyEmergencies}`,
      '# HELP nivora_process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE nivora_process_resident_memory_bytes gauge',
      `nivora_process_resident_memory_bytes ${memory.rss}`,
      '# HELP nivora_process_uptime_seconds Process uptime in seconds.',
      '# TYPE nivora_process_uptime_seconds gauge',
      `nivora_process_uptime_seconds ${Math.round(process.uptime())}`,
    ];
    return reply.header('content-type', 'text/plain; version=0.0.4').send(`${lines.join('\n')}\n`);
  });
}

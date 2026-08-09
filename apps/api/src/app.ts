import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { loadConfig } from './config.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { coachRoutes } from './routes/coach.js';
import { healthRoutes, metrics } from './routes/health.js';
import { publicRoutes } from './routes/public.js';
import { privacyRoutes } from './routes/privacy.js';
import { recoveryRoutes } from './routes/recovery.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Recovery data must never end up in a log aggregator. Bodies are not
      // logged at all, and the few headers we do log are scrubbed.
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-tenant"]'],
        remove: true,
      },
      serializers: {
        req: (request) => ({
          method: request.method,
          url: request.url.split('?')[0],
          id: request.id,
        }),
      },
    },
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    allowedHeaders: ['content-type', 'authorization', 'x-tenant'],
  });

  // Someone hammering the login endpoint and someone opening the craving screen
  // repeatedly are different problems; the global limit is generous because the
  // second case is the product working as intended.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: ['/healthz', '/readyz', '/metrics'],
  });

  app.addHook('onResponse', async (_request, reply) => {
    metrics.requests += 1;
    if (reply.statusCode >= 500) metrics.errors += 1;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message, details: error.details } });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'validation_failed',
          message: 'Request body failed validation',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply
        .code(429)
        .send({ error: { code: 'rate_limited', message: 'Too many requests' } });
    }

    // Unexpected: log it with the request id, tell the client nothing useful to
    // an attacker.
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .code(500)
      .send({ error: { code: 'internal_error', message: 'Something went wrong' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint' } }),
  );

  await app.register(healthRoutes);
  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(recoveryRoutes);
  await app.register(coachRoutes);
  await app.register(privacyRoutes);

  return app;
}

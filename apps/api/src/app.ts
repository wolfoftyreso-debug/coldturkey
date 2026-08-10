import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { loadConfig } from './config.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { coachRoutes } from './routes/coach.js';
import { healthRoutes } from './routes/health.js';
import { recordRequest } from './observability/metrics.js';
import { reportError } from './observability/errors.js';
import { publicRoutes } from './routes/public.js';
import { openapiRoutes } from './routes/openapi.js';
import { twoFactorRoutes } from './routes/twofactor.js';
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

  // Many HTTP clients set `content-type: application/json` on every request,
  // including a DELETE with no body. Fastify's default parser rejects that
  // before any handler runs, so an authorization check never happens and the
  // caller gets a confusing 400 about a body they did not intend to send.
  // An empty body is simply no body.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, payload: string, done) => {
      if (payload === undefined || payload === null || payload.trim() === '') {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(payload));
      } catch {
        // Deliberately not the parser's own message: it echoes the payload.
        done(new AppError(400, 'malformed_request', 'Request body could not be read'), undefined);
      }
    },
  );

  await app.register(helmet, {
    // This API serves JSON and nothing else. The policy says so: no scripts,
    // no styles, no frames, no plugins. If a response ever gets rendered as a
    // document — by a browser sniffing, or by an error page — there is nothing
    // in it that can execute.
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // A year, with subdomains. Set by the API as well as the ingress because
    // an API reachable on its own hostname must not depend on somebody
    // remembering to configure the proxy.
    strictTransportSecurity: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    // Credentials are only meaningful against an explicit origin list. With a
    // wildcard the browser refuses them anyway; being explicit here means the
    // combination cannot be introduced by a config change alone.
    credentials: config.corsOrigins !== true,
    allowedHeaders: ['content-type', 'authorization', 'x-tenant'],
    maxAge: 600,
  });

  // Someone hammering the login endpoint and someone opening the craving screen
  // repeatedly are different problems; the global limit is generous because the
  // second case is the product working as intended.
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    allowList: ['/healthz', '/readyz', '/metrics'],
  });

  app.addHook('onResponse', async (request, reply) => {
    // The route template, never the resolved URL. `/v1/cravings/:id` is an
    // operational fact; `/v1/cravings/8f3e…` is a person's craving log turning
    // up in a metrics store that gets shared far more casually than a database.
    const route = request.routeOptions?.url ?? 'unmatched';
    recordRequest(request.method, route, reply.statusCode, reply.elapsedTime);
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

    // Fastify's own client errors — empty body with a JSON content-type, a
    // body over the limit, unparseable JSON — used to fall through to the
    // generic 500. That is wrong twice over: it tells the caller the server
    // broke when the request was malformed, and it pollutes the error rate
    // that pages somebody at 3am. A malformed request is a 4xx.
    const fastifyCode = (error as { code?: string }).code;
    if (typeof fastifyCode === 'string' && fastifyCode.startsWith('FST_ERR_CTP_')) {
      const tooLarge = fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE';
      return reply.code(tooLarge ? 413 : 400).send({
        error: {
          code: tooLarge ? 'payload_too_large' : 'malformed_request',
          // Deliberately not the Fastify message: it names internals.
          message: tooLarge ? 'Request body is too large' : 'Request body could not be read',
        },
      });
    }

    // Unexpected: report it, log it with the request id, and tell the client
    // nothing useful to an attacker. Reporting is not awaited — a reporting
    // outage must not become an application outage, and the person waiting on
    // this response is not interested in either.
    void reportError(
      error,
      {
        route: request.routeOptions?.url,
        method: request.method,
        statusCode: 500,
        userId: (request as { user?: { id?: string } }).user?.id,
        tenantId: (request as { tenantId?: string }).tenantId,
      },
      request.log,
    );
    return reply
      .code(500)
      .send({ error: { code: 'internal_error', message: 'Something went wrong' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint' } }),
  );

  await app.register(healthRoutes);
  await app.register(publicRoutes);
  await app.register(openapiRoutes);
  await app.register(authRoutes);
  await app.register(twoFactorRoutes);
  await app.register(recoveryRoutes);
  await app.register(coachRoutes);
  await app.register(privacyRoutes);

  return app;
}

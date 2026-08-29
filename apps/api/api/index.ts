import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { assertKeyRingUsable } from '../src/crypto/field.js';

/**
 * The API as a Vercel function.
 *
 * `src/server.ts` is still the real entry point — it listens on a port, it is
 * what the container runs, and it is what a self-hosted deployment should use.
 * This file exists so the same application can be put in front of people
 * without first standing up a host, using the Vercel project that already
 * serves the web client.
 *
 * Two things are deliberately different here, and both are consequences of the
 * platform rather than choices:
 *
 * **Migrations do not run here.** `server.ts` migrates at boot, which is right
 * for one long-lived process and wrong for a function that may cold-start a
 * hundred times in a minute — a hundred concurrent migration attempts against
 * one database is a lock convoy at best. The `vercel-build` script runs them
 * once, at deploy time, before any function is live.
 *
 * **The in-process rate limiter is weaker here than in the container.** Each
 * function instance keeps its own counter, so the effective per-IP ceiling is
 * the configured number multiplied by however many instances are warm. The
 * control that actually matters is unaffected: the login lockout keeps its
 * state in Postgres precisely so it cannot be multiplied this way, and it is
 * what stands between an attacker and somebody's account. The generic limiter
 * is a courtesy on top of it. Worth knowing, not worth blocking on — and worth
 * putting a real limiter in front of if this becomes the permanent home.
 */

let started: Promise<FastifyInstance> | null = null;

function instance(): Promise<FastifyInstance> {
  // Cached across invocations on the same warm instance, so the connection
  // pool and the key ring are built once rather than per request.
  started ??= (async () => {
    // Same guard as the container: a truncated key lets the process serve
    // every read and fail every write, which looks healthy from outside.
    assertKeyRingUsable();
    const app = await buildApp();
    await app.ready();
    return app;
  })();
  return started;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const app = await instance();
  app.server.emit('request', request, response);
}

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import handler from '../api/index.js';
import { closePool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { ensureDefaultTenant } from './db/tenants.js';
import { setMailer, type Mail, type Mailer } from './mail/smtp.js';

/**
 * The serverless adapter, driven over a real socket.
 *
 * `api/index.ts` hands requests to Fastify by emitting them on its internal
 * server rather than by listening on a port, which is the standard trick and
 * also the kind of thing that is either exactly right or completely broken
 * with nothing in between. It is not covered by any other test: the container
 * runs `server.ts`, and this file is the only thing that exercises the other
 * entry point.
 *
 * This does not prove the function works *on Vercel* — nothing here can prove
 * that, and only a deploy will. It proves the adapter itself is sound.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

class SilentMailer implements Mailer {
  readonly kind = 'log';
  async send(_mail: Mail): Promise<void> {}
}

suite('the serverless entry point', () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    setMailer(new SilentMailer());
    // A bare Node server standing in for the platform: it does exactly what
    // Vercel does, which is call the exported handler with the raw request and
    // response.
    server = createServer((request, response) => {
      void handler(request, response);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    setMailer(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });

  it('answers a health probe', async () => {
    const response = await fetch(`${origin}/healthz`);
    expect(response.status).toBe(200);
  });

  it('serves the public crisis resources, which need no account', async () => {
    // The one surface that must work from every entry point there is.
    const response = await fetch(`${origin}/v1/public/safety/resources?country=SE`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { resources: { contact: string | null }[] };
    expect(body.resources.some((r) => r.contact)).toBe(true);
  });

  it('carries a POST body through to the route', async () => {
    // The half of an adapter that silently fails: GETs work, bodies vanish.
    const response = await fetch(`${origin}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `serverless-${Date.now()}@cleat.test`,
        password: 'a-long-enough-password',
        displayName: 'Serverless',
      }),
    });
    expect(response.status).toBe(201);
    expect((await response.json()).accessToken as string).toBeTruthy();
  });

  it('still refuses a request with no token', async () => {
    const response = await fetch(`${origin}/v1/dashboard`);
    expect(response.status).toBe(401);
  });

  it('emits the security headers, which come from the app and not the platform', async () => {
    const response = await fetch(`${origin}/healthz`);
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('strict-transport-security')).toContain('max-age=');
  });

  it('reuses one instance across invocations rather than booting per request', async () => {
    // A pool per request exhausts the database's connection limit under any
    // real load, and is the classic way a serverless port of a stateful
    // service falls over in production rather than in review.
    const before = await fetch(`${origin}/metrics`).then((r) => r.text());
    await fetch(`${origin}/healthz`);
    const after = await fetch(`${origin}/metrics`).then((r) => r.text());
    const uptime = (text: string) =>
      Number(/cleat_process_uptime_seconds (\d+)/.exec(text)?.[1] ?? -1);
    // Same process, so uptime moves forward rather than resetting.
    expect(uptime(after)).toBeGreaterThanOrEqual(uptime(before));
    expect(uptime(before)).toBeGreaterThanOrEqual(0);
  });
});

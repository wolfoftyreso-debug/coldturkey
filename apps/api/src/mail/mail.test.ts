import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, resetConfig } from '../config.js';
import { ResendError, ResendMailer } from './resend.js';
import { mailer, setMailer, type Mailer } from './smtp.js';

/**
 * The mail transport, against a real HTTP server.
 *
 * Mail is the only way somebody who has lost their password gets back into an
 * account holding their recovery history, so "it probably works" is not a
 * standard this layer can be held to. What is exercised here is the request we
 * actually put on the wire, and every way the other end can say no.
 *
 * What is asserted just as hard: that nothing which fails here leaks the API
 * key or the message body into an error. A reset mail's body is a working key
 * to somebody's account, and error strings end up in logs, alerts and pasted
 * issue reports.
 */

interface Recorded {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

let server: Server;
let base: string;
const received: Recorded[] = [];
/** Set per test to control what the stub answers. */
let reply: { status: number; body: string; contentType?: string } = {
  status: 200,
  body: JSON.stringify({ id: 'stub-id' }),
};

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed: unknown = raw;
      try {
        parsed = JSON.parse(raw);
      } catch {
        /* record the raw text */
      }
      received.push({
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: parsed,
      });
      res.writeHead(reply.status, {
        'content-type': reply.contentType ?? 'application/json',
      });
      res.end(reply.body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  setMailer(null);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function mailerFor(base_: string, apiKey = 're_test_key_do_not_use'): ResendMailer {
  return new ResendMailer({ apiKey, from: 'no-reply@cleat.app', base: base_ });
}

function ok(): void {
  reply = { status: 200, body: JSON.stringify({ id: 'stub-id' }) };
}

describe('Resend transport', () => {
  it('posts the message Resend expects, authenticated', async () => {
    ok();
    received.length = 0;
    await mailerFor(base).send({
      to: 'someone@example.com',
      subject: 'Återställ ditt lösenord',
      text: 'Länk:\n\nhttps://cleat.app/reset?token=abc',
    });

    expect(received).toHaveLength(1);
    const call = received[0]!;
    expect(call.method).toBe('POST');
    expect(call.path).toBe('/emails');
    expect(call.headers.authorization).toBe('Bearer re_test_key_do_not_use');
    expect(call.headers['content-type']).toContain('application/json');

    const body = call.body as Record<string, unknown>;
    expect(body.from).toBe('Cleat <no-reply@cleat.app>');
    expect(body.to).toEqual(['someone@example.com']);
    // Swedish subjects go over JSON as-is; the SMTP path needs RFC 2047 and
    // this one must not double-encode.
    expect(body.subject).toBe('Återställ ditt lösenord');
    expect(body.text).toContain('https://cleat.app/reset?token=abc');
  });

  it('marks the mail auto-generated so clients do not file it as bulk', async () => {
    ok();
    received.length = 0;
    await mailerFor(base).send({ to: 'a@example.com', subject: 's', text: 't' });
    const body = received[0]!.body as { headers?: Record<string, string> };
    expect(body.headers?.['Auto-Submitted']).toBe('auto-generated');
  });

  it('never asks for HTML, open tracking or click tracking', async () => {
    ok();
    received.length = 0;
    await mailerFor(base).send({ to: 'a@example.com', subject: 's', text: 't' });
    const body = received[0]!.body as Record<string, unknown>;
    // A tracking pixel in a mail about somebody's drinking reports to a third
    // party when they opened it. This assertion exists so that adding one is a
    // deliberate act with a failing test attached, not a config default.
    expect(body).not.toHaveProperty('html');
    expect(body).not.toHaveProperty('react');
    expect(Object.keys(body).sort()).toEqual(['from', 'headers', 'subject', 'text', 'to']);
  });

  it('trims a trailing slash on the base rather than posting to //emails', async () => {
    ok();
    received.length = 0;
    await mailerFor(`${base}/`).send({ to: 'a@example.com', subject: 's', text: 't' });
    expect(received[0]!.path).toBe('/emails');
  });

  it('throws with the status and Resend error name on a refusal', async () => {
    reply = {
      status: 422,
      body: JSON.stringify({
        name: 'validation_error',
        message: 'The `from` address is not a verified domain.',
      }),
    };
    await expect(
      mailerFor(base).send({ to: 'a@example.com', subject: 's', text: 't' }),
    ).rejects.toMatchObject({ name: 'ResendError', status: 422, code: 'validation_error' });
  });

  it('surfaces an auth failure rather than reporting success', async () => {
    reply = { status: 401, body: JSON.stringify({ name: 'restricted_api_key' }) };
    // The whole point of the production guard in loadConfig is that mail
    // failures must be loud. A transport that swallowed a 401 would defeat it.
    await expect(
      mailerFor(base).send({ to: 'a@example.com', subject: 's', text: 't' }),
    ).rejects.toBeInstanceOf(ResendError);
  });

  it('still fails loudly when the error body is not JSON', async () => {
    reply = { status: 502, body: '<html>bad gateway</html>', contentType: 'text/html' };
    await expect(
      mailerFor(base).send({ to: 'a@example.com', subject: 's', text: 't' }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('leaks neither the API key nor the message body into the error', async () => {
    reply = { status: 500, body: JSON.stringify({ name: 'internal_error' }) };
    const secretKey = 're_a_very_secret_key_value';
    const resetLink = 'https://cleat.app/reset?token=THE-ACTUAL-TOKEN';
    let thrown: unknown;
    try {
      await mailerFor(base, secretKey).send({
        to: 'a@example.com',
        subject: 'Återställ',
        text: resetLink,
      });
    } catch (error) {
      thrown = error;
    }
    const serialised = `${String(thrown)}${(thrown as Error).stack ?? ''}`;
    expect(serialised).not.toContain(secretKey);
    expect(serialised).not.toContain('THE-ACTUAL-TOKEN');
  });

  it('reports a transport failure instead of hanging or resolving', async () => {
    // Nothing is listening on this port, so the connection is refused. The
    // caller must learn the mail did not go.
    const dead = 'http://127.0.0.1:9';
    await expect(
      mailerFor(dead).send({ to: 'a@example.com', subject: 's', text: 't' }),
    ).rejects.toMatchObject({ name: 'ResendError', code: 'network_error' });
  });
});

/**
 * Which transport a deployment gets is a configuration decision that nobody
 * looks at again until mail stops arriving, so the decision itself is pinned
 * here rather than left to be read out of an if-chain.
 */
describe('transport selection', () => {
  const saved = { ...process.env };

  /** The minimum a config must have before the mail settings even parse. */
  const BASE = {
    DATABASE_URL: 'postgres://unused/unused',
    JWT_SECRET: 'a-secret-long-enough-for-hs256-signing-in-tests',
  };

  function reload(env: Record<string, string | undefined>): Mailer {
    Object.assign(process.env, BASE);
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetConfig();
    setMailer(null);
    return mailer();
  }

  afterEach(() => {
    process.env = { ...saved };
    resetConfig();
    setMailer(null);
  });

  it('uses Resend when an API key is configured', () => {
    expect(
      reload({ RESEND_API_KEY: 're_key', SMTP_HOST: undefined }).kind,
    ).toBe('resend');
  });

  it('prefers an explicit API key over a relay host left over from before', () => {
    // Both configured is not a misconfiguration to reject — it is somebody
    // migrating. The key is the newer, deliberate choice.
    expect(reload({ RESEND_API_KEY: 're_key', SMTP_HOST: 'relay.internal' }).kind).toBe('resend');
  });

  it('falls back to SMTP when only a relay is configured', () => {
    expect(reload({ RESEND_API_KEY: undefined, SMTP_HOST: 'relay.internal' }).kind).toBe('smtp');
  });

  it('logs a digest in development when neither is configured', () => {
    expect(reload({ RESEND_API_KEY: undefined, SMTP_HOST: undefined }).kind).toBe('log');
  });

  it('refuses to boot a production process that would silently swallow mail', () => {
    Object.assign(process.env, BASE);
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.RESEND_API_KEY;
    process.env.CORS_ORIGINS = 'https://cleat.app';
    process.env.FIELD_ENCRYPTION_KEYS = 'k:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    resetConfig();
    expect(() => loadConfig()).toThrow(/SMTP_HOST or RESEND_API_KEY is required in production/);
  });

  it('accepts a production process that has Resend and no relay at all', () => {
    Object.assign(process.env, BASE);
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    process.env.RESEND_API_KEY = 're_key';
    process.env.CORS_ORIGINS = 'https://cleat.app';
    process.env.FIELD_ENCRYPTION_KEYS = 'k:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    resetConfig();
    expect(loadConfig().RESEND_API_KEY).toBe('re_key');
  });
});

/**
 * Configuration that is wrong in a way nobody notices until somebody is
 * locked out.
 *
 * Both of these used to be plain strings. A `MAIL_FROM` with a typo and a
 * `PUBLIC_WEB_URL` with the scheme left off both let the process boot, pass
 * every health probe, and serve the whole product correctly — right up until
 * a person who cannot sign in asks for a reset. Then the relay refuses the
 * envelope, or the mail arrives with a link no client will make clickable,
 * and the one user who cannot report the bug is the one who hit it.
 */
describe('mail configuration is checked at boot, not at reset time', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    resetConfig();
  });

  function load(env: Record<string, string>): () => unknown {
    process.env.DATABASE_URL = 'postgres://unused/unused';
    process.env.JWT_SECRET = 'a-secret-long-enough-for-hs256-signing-in-tests';
    Object.assign(process.env, env);
    resetConfig();
    return () => loadConfig();
  }

  it('rejects a MAIL_FROM that is not an address', () => {
    expect(load({ MAIL_FROM: 'Cleat' })).toThrow(/MAIL_FROM must be an email address/);
  });

  it('rejects a PUBLIC_WEB_URL with no scheme', () => {
    expect(load({ PUBLIC_WEB_URL: 'app.cleat.se' })).toThrow(
      /PUBLIC_WEB_URL must be an absolute URL/,
    );
  });

  it('accepts the values a real deployment would use', () => {
    const config = load({
      MAIL_FROM: 'no-reply@cleat.se',
      PUBLIC_WEB_URL: 'https://app.cleat.se',
    })() as { MAIL_FROM: string; PUBLIC_WEB_URL: string };
    expect(config.MAIL_FROM).toBe('no-reply@cleat.se');
    expect(config.PUBLIC_WEB_URL).toBe('https://app.cleat.se');
  });
});

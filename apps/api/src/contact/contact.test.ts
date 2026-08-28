import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { closePool, withoutTenant } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultTenant } from '../db/tenants.js';
import { decryptField, isEncrypted } from '../crypto/field.js';
import { setMailer, type Mail, type Mailer } from '../mail/smtp.js';
import { metrics } from '../observability/metrics.js';
import { resetConfig } from '../config.js';

/**
 * The organisation enquiry endpoint.
 *
 * This is the only conversion event on the commercial side of the product —
 * individuals never pay — so the questions worth asking are the ones about
 * losing a customer, not the ones about the happy path. Chiefly: what happens
 * when mail fails, and can this endpoint be turned into something it is not.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

class CapturingMailer implements Mailer {
  readonly kind = 'log';
  sent: Mail[] = [];
  /** Set to make the next send fail, the way a revoked key would. */
  failWith: Error | null = null;

  async send(mail: Mail): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(mail);
  }
}

suite('organisation enquiries', () => {
  let app: FastifyInstance;
  let mail: CapturingMailer;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    // The production ceiling is five an hour, which is right for an endpoint a
    // real clinic uses once and a bot would use continuously — and which would
    // otherwise block this suite at the sixth assertion. The limiter itself is
    // exercised deliberately further down, against its real setting.
    process.env.CONTACT_LIMIT_MAX = '1000';
    resetConfig();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    setMailer(null);
    delete process.env.CONTACT_LIMIT_MAX;
    resetConfig();
    await app.close();
    await closePool();
  });

  function post(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: '/v1/contact/organisation', payload });
  }

  async function rows(email: string) {
    return withoutTenant(async (client) => {
      const { rows } = await client.query(
        `SELECT id, organisation, contact_name, contact_email, contact_phone,
                seats_estimate, message, status, notified_at, source_prefix
           FROM org_enquiries WHERE contact_email = $1 ORDER BY created_at`,
        [email],
      );
      return rows;
    });
  }

  it('stores the enquiry and tells both sides', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `anna+${Date.now()}@klinik.example`;

    const response = await post({
      organisation: 'Beroendemottagningen Väst',
      contactName: 'Anna Lind',
      contactEmail: email,
      contactPhone: '+46 70 123 45 67',
      seatsEstimate: 'ungefär 40, men vi växer',
      message: 'Vi har 40 klienter i öppenvård och vill veta vad det kostar.',
    });

    expect(response.statusCode).toBe(202);
    const stored = await rows(email);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.organisation).toBe('Beroendemottagningen Väst');
    expect(stored[0]!.status).toBe('new');
    expect(stored[0]!.notified_at).not.toBeNull();

    // One to us, one to them.
    expect(mail.sent).toHaveLength(2);
    expect(mail.sent[0]!.text).toContain('Beroendemottagningen Väst');
    expect(mail.sent[1]!.to).toBe(email);
  });

  it('does not echo anything the caller typed back to the address they gave', async () => {
    // This endpoint sends mail to an arbitrary address on request. If the
    // confirmation carried caller-supplied text it would be a relay for
    // attacker-controlled content wearing our sender domain.
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `relay+${Date.now()}@example.test`;
    const payload = 'CLICK http://evil.example TO CLAIM YOUR PRIZE';

    await post({
      organisation: payload,
      contactName: payload,
      contactEmail: email,
      message: payload,
    });

    const confirmation = mail.sent.find((m) => m.to === email);
    expect(confirmation).toBeDefined();
    expect(confirmation!.text).not.toContain('evil.example');
    expect(confirmation!.text).not.toContain('PRIZE');
    expect(confirmation!.subject).not.toContain('PRIZE');
  });

  it('keeps the enquiry when mail fails, and says so in the metrics', async () => {
    // The reason the write happens before the send. A revoked API key must not
    // turn a customer into silence.
    mail = new CapturingMailer();
    mail.failWith = new Error('Resend refused the message (401 restricted_api_key)');
    setMailer(mail);
    const before = metrics.orgEnquiriesUnnotified;
    const email = `lost+${Date.now()}@klinik.example`;

    const response = await post({
      organisation: 'Klinik utan mail',
      contactName: 'Bo Berg',
      contactEmail: email,
      message: 'Hör av er.',
    });

    // The caller did nothing wrong and is told their enquiry arrived, because
    // it did.
    expect(response.statusCode).toBe(202);

    const stored = await rows(email);
    expect(stored).toHaveLength(1);
    // Unannounced, and findable by exactly that.
    expect(stored[0]!.notified_at).toBeNull();
    expect(metrics.orgEnquiriesUnnotified).toBe(before + 1);
  });

  it('encrypts the message at rest', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `crypt+${Date.now()}@klinik.example`;
    const secret = 'Vi har 12 patienter med samtidig LARO-behandling.';

    await post({
      organisation: 'Krypto',
      contactName: 'Cia Ceder',
      contactEmail: email,
      message: secret,
    });

    const stored = await rows(email);
    const raw = stored[0]!.message as string;
    expect(isEncrypted(raw)).toBe(true);
    expect(raw).not.toContain('LARO');
    // And it round-trips under the row's own AAD.
    expect(
      decryptField(raw, {
        tenantId: 'no-tenant',
        table: 'org_enquiries',
        column: 'message',
        ownerId: stored[0]!.id as string,
      }),
    ).toBe(secret);
  });

  it('will not decrypt one enquiry’s message under another enquiry’s id', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const a = `aad-a+${Date.now()}@klinik.example`;
    await post({ organisation: 'A', contactName: 'A A', contactEmail: a, message: 'hemligt' });
    const stored = await rows(a);
    expect(() =>
      decryptField(stored[0]!.message as string, {
        tenantId: 'no-tenant',
        table: 'org_enquiries',
        column: 'message',
        ownerId: '00000000-0000-0000-0000-000000000000',
      }),
    ).toThrow();
  });

  it('swallows a bot without telling it, and sends no mail', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `bot+${Date.now()}@spam.example`;

    const response = await post({
      organisation: 'Cheap SEO Services',
      contactName: 'Bot',
      contactEmail: email,
      message: 'buy links',
      website: 'http://cheap-links.example',
    });

    // Same answer a person gets. Telling a bot it was caught only teaches it.
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ received: true });
    expect(mail.sent).toHaveLength(0);

    const stored = await rows(email);
    expect(stored[0]!.status).toBe('spam');
  });

  it('records a coarse source prefix and never the address', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `prefix+${Date.now()}@klinik.example`;
    await post({ organisation: 'Prefix AB', contactName: 'Pia Palm', contactEmail: email });
    const prefix = (await rows(email))[0]!.source_prefix as string | null;
    if (prefix !== null) {
      // Two octets at most — enough to spot a flood, not a location history.
      expect(prefix.split(/[.:]/).length).toBeLessThanOrEqual(2);
    }
  });

  it('normalises the address so one clinic is one row to find', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const stamp = Date.now();
    await post({
      organisation: 'Case',
      contactName: 'Case Sensitive',
      contactEmail: `MiXeD+${stamp}@Klinik.Example`,
    });
    expect(await rows(`mixed+${stamp}@klinik.example`)).toHaveLength(1);
  });

  it('rejects the shapes a form should reject', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['missing organisation', { contactName: 'A B', contactEmail: 'a@b.example' }],
      ['missing name', { organisation: 'X', contactEmail: 'a@b.example' }],
      ['not an address', { organisation: 'X', contactName: 'A B', contactEmail: 'not-an-email' }],
      ['one-character organisation', { organisation: 'X', contactName: 'A B', contactEmail: 'a@b.example' }],
      [
        'a message longer than the field',
        {
          organisation: 'X Y',
          contactName: 'A B',
          contactEmail: 'a@b.example',
          message: 'x'.repeat(4001),
        },
      ],
    ];
    for (const [label, payload] of cases) {
      const response = await post(payload);
      expect(response.statusCode, label).toBe(400);
      expect(response.json().error.code, label).toBe('validation_failed');
    }
  });

  it('stops a flood at the configured ceiling', async () => {
    // Built separately so the limiter can be exercised at a realistic setting
    // rather than the one this suite needs to get through its assertions.
    process.env.CONTACT_LIMIT_MAX = '2';
    resetConfig();
    const tight = await buildApp();
    await tight.ready();
    setMailer(new CapturingMailer());
    try {
      const send = () =>
        tight.inject({
          method: 'POST',
          url: '/v1/contact/organisation',
          payload: {
            organisation: 'Flood',
            contactName: 'Flo Od',
            contactEmail: `flood+${Math.random()}@spam.example`,
          },
        });
      expect((await send()).statusCode).toBe(202);
      expect((await send()).statusCode).toBe(202);
      const third = await send();
      expect(third.statusCode).toBe(429);
      expect(third.json().error.code).toBe('rate_limited');
    } finally {
      await tight.close();
      process.env.CONTACT_LIMIT_MAX = '1000';
      resetConfig();
    }
  });

  it('accepts an enquiry with only the three fields that matter', async () => {
    mail = new CapturingMailer();
    setMailer(mail);
    const email = `minimal+${Date.now()}@klinik.example`;
    // Every extra required field on this form is a clinic that gives up
    // halfway. Name, address, organisation — nothing else is mandatory.
    const response = await post({
      organisation: 'Liten mottagning',
      contactName: 'Dag Dahl',
      contactEmail: email,
    });
    expect(response.statusCode).toBe(202);
    expect((await rows(email))[0]!.message).toBeNull();
  });
});

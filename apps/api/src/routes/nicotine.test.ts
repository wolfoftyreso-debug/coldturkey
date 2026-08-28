import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { closePool } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultTenant } from '../db/tenants.js';
import { setMailer, type Mail, type Mailer } from '../mail/smtp.js';

/**
 * What somebody quitting smoking actually gets back from the API.
 *
 * The domain engine has a sourced timeline and the public page renders it.
 * This is the third surface — the one the person meets after they sign up —
 * and it is the one where the attribution has to survive being serialised,
 * translated and sent over the wire. A source that is correct in `core` and
 * missing in the dashboard payload is a source nobody ever sees.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

class SilentMailer implements Mailer {
  readonly kind = 'log';
  async send(_mail: Mail): Promise<void> {}
}

suite('the dashboard for somebody quitting smoking', () => {
  let app: FastifyInstance;
  let auth: { authorization: string };

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    setMailer(new SilentMailer());
    app = await buildApp();
    await app.ready();

    const registered = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: `smoker-${Date.now()}@cleat.test`,
        password: 'a-long-enough-password',
        displayName: 'Smoker',
      },
    });
    auth = { authorization: `Bearer ${registered.json().accessToken as string}` };

    // Three days in: past the 48-hour marker, short of two weeks. Twenty
    // cigarettes a day at 70 öre each is roughly a Swedish pack.
    await app.inject({
      method: 'POST',
      url: '/v1/quit',
      headers: auth,
      payload: {
        substance: 'nicotine',
        baselineUnitsPerDay: 20,
        unitCostMinor: 350,
        currency: 'SEK',
        startedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    });
  });

  afterAll(async () => {
    setMailer(null);
    await app.close();
    await closePool();
  });

  interface Dashboard {
    milestones: {
      reached: { key: string; text: string; source?: string }[];
      next: { key: string; text: string; source?: string } | null;
    } | null;
    reclaimed: { soFar: { moneyMinor: number; minutes: number } } | null;
    detoxWarning: { required: boolean } | null;
  }

  async function dashboard(): Promise<Dashboard> {
    const response = await app.inject({ method: 'GET', url: '/v1/dashboard', headers: auth });
    expect(response.statusCode).toBe(200);
    return response.json<Dashboard>();
  }

  it('has already given them four milestones by day three', () => {
    // The argument for a front-loaded ladder. Somebody three days into
    // quitting smoking has done the hardest part and needs to be told what it
    // bought — not to wait a month for the first marker.
    return dashboard().then((body) => {
      const keys = body.milestones!.reached.map((m) => m.key);
      expect(keys).toEqual([
        'milestone.nicotine.min20',
        'milestone.nicotine.h12',
        'milestone.nicotine.h24',
        'milestone.nicotine.h48',
      ]);
    });
  });

  it('carries the source all the way to the payload, not just into core', async () => {
    const body = await dashboard();
    for (const milestone of body.milestones!.reached) {
      expect(milestone.source, milestone.key).toMatch(/^(NHS|CDC)$/);
    }
    expect(body.milestones!.next?.source).toMatch(/^(NHS|CDC)$/);
  });

  it('translates the milestone text rather than shipping the key', async () => {
    const body = await dashboard();
    const next = body.milestones!.next!;
    expect(next.text).not.toBe(next.key);
    expect(next.text).toContain('Två veckor');
  });

  it('counts the money and the time three days of not smoking bought back', async () => {
    const body = await dashboard();
    // 20 a day at 3.50 kr, three days: 210 kr. Allowed to be a little under,
    // because `soFar` is capped at the streak and the streak is measured in
    // milliseconds rather than whole days.
    expect(body.reclaimed!.soFar.moneyMinor).toBeGreaterThan(19_000);
    expect(body.reclaimed!.soFar.moneyMinor).toBeLessThanOrEqual(21_000);
    // Seven minutes a cigarette, sixty a day.
    expect(body.reclaimed!.soFar.minutes).toBeGreaterThan(150);
  });

  it('does not tell a smoker to seek medical detox', async () => {
    // The clinically important difference from alcohol, and one the product
    // must get right in both directions: warning where it matters, silent
    // where it does not. A detox warning here would be noise that teaches
    // people to ignore the one that counts.
    const body = await dashboard();
    expect(body.detoxWarning?.required ?? false).toBe(false);
  });
});

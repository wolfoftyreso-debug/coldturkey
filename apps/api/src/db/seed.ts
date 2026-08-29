import { pathToFileURL } from 'node:url';
import { hashPassword } from '../auth/password.js';
import { closePool, withTenant } from './pool.js';
import { createQuit, createSupportContact, createUser, findUserByEmail, updateProfile, upsertCheckIn, createCraving } from './repository.js';
import { createTenant, ensureDefaultTenant } from './tenants.js';
import { migrate } from './migrate.js';

const DAY = 86_400_000;

/**
 * Development seed.
 *
 * Creates two tenants so the isolation is visible while developing rather than
 * only under test: a shared consumer tenant and a clinic. The demo account has
 * enough history for the indicators and the pattern insights to have something
 * to say, because an empty dashboard tells you nothing about whether the
 * dashboard works.
 */
export async function seed(): Promise<void> {
  await migrate();

  const consumer = await ensureDefaultTenant();
  const clinic = await createTenant('demo-clinic', 'Demoklinken', { publicSignup: false });

  await seedDemoUser(consumer.id, 'demo@cleat.se', 'Alex');
  await seedDemoUser(clinic.id, 'patient@demo-clinic.se', 'Kim');

  console.log('[seed] done');
  console.log('[seed]   consumer tenant : %s (demo@cleat.se / demo-password-123)', consumer.slug);
  console.log('[seed]   clinic tenant   : %s (patient@demo-clinic.se / demo-password-123)', clinic.slug);
}

async function seedDemoUser(tenantId: string, email: string, displayName: string): Promise<void> {
  const passwordHash = await hashPassword('demo-password-123');
  const now = Date.now();

  await withTenant(tenantId, async (client) => {
    const existing = await findUserByEmail(client, email);
    if (existing) {
      console.log('[seed] %s already exists, skipping', email);
      return;
    }

    const user = await createUser(client, {
      tenantId,
      email,
      passwordHash,
      displayName,
      role: 'owner',
    });

    await updateProfile(client, user.id, tenantId, {
      whyStatement:
        'Jag vill kunna vara närvarande med min son utan att räkna ner till kvällen.',
      futureSelf: {
        days30: 'Sova hela nätter och vakna utan ångest.',
        days90: 'Tillbaka på jobbet på riktigt.',
      },
      phase: 'preparation',
    });

    await createQuit(client, {
      tenantId,
      userId: user.id,
      substance: 'alcohol',
      startedAt: new Date(now - 23 * DAY),
      baselineUnitsPerDay: 6,
      unitCostMinor: 3000,
      currency: 'SEK',
      minutesPerUnit: 45,
    });

    await createSupportContact(client, {
      tenantId,
      userId: user.id,
      name: 'Jonas',
      relation: 'vän',
      phone: '070-000 00 00',
      isPrimary: true,
    });

    // Two weeks of check-ins with a deliberate pattern: worse sleep on the days
    // before the strongest cravings, so the insight engine has a real signal.
    for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
      const date = new Date(now - daysAgo * DAY);
      const roughNight = daysAgo % 4 === 0;
      await upsertCheckIn(client, {
        tenantId,
        userId: user.id,
        kind: 'morning',
        day: date.toISOString().slice(0, 10),
        mood: roughNight ? 4 : 7,
        sleepQuality: roughNight ? 3 : 8,
        stress: roughNight ? 8 : 4,
        cravingIntensity: roughNight ? 7 : 3,
        biggestRisk: roughNight ? 'Fredagskväll hemma ensam' : 'Inget särskilt',
      });

      if (roughNight) {
        await createCraving(client, {
          tenantId,
          userId: user.id,
          intensity: 8,
          feeling: 'stress',
          location: 'home',
          trigger: 'Bråk på jobbet',
          actionTaken: 'Ringde Jonas',
          outcome: 'resisted',
        });
      }
    }
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entrypoint === import.meta.url) {
  seed()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seed] failed', error);
      process.exit(1);
    });
}

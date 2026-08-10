import type {
  CheckIn,
  CravingLog,
  QuitPlan,
  RecoveryProfile,
  RecoverySnapshot,
  RelapseEvent,
  SupportContact,
} from '@cleat/core';
import type { Client } from './pool.js';
import { decryptField, encryptField } from '../crypto/field.js';

/**
 * Row → domain mapping.
 *
 * `pg` returns `numeric` as a string to avoid silent precision loss, so every
 * numeric column is converted explicitly here rather than being trusted to
 * coerce correctly somewhere deeper in the stack.
 */

export interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: 'member' | 'admin' | 'owner';
  locale: string;
  country: string;
  timezone: string;
  created_at: Date;
  /** Session generation; see migration 005. */
  token_version: number;
  /** Encrypted TOTP secret, or null. See migration 006. */
  totp_secret: string | null;
  totp_enabled_at: Date | null;
}

export async function findUserByEmail(
  client: Client,
  email: string,
): Promise<(UserRow & { password_hash: string }) | null> {
  const { rows } = await client.query<UserRow & { password_hash: string }>(
    `SELECT id, tenant_id, email, password_hash, display_name, role, locale, country, timezone, created_at, token_version, totp_secret, totp_enabled_at
     FROM users
     WHERE lower(email) = lower($1) AND deleted_at IS NULL`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(client: Client, id: string): Promise<UserRow | null> {
  const { rows } = await client.query<UserRow>(
    `SELECT id, tenant_id, email, display_name, role, locale, country, timezone, created_at, token_version, totp_secret, totp_enabled_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser(
  client: Client,
  input: {
    tenantId: string;
    email: string;
    passwordHash: string;
    displayName: string;
    role?: 'member' | 'admin' | 'owner';
    locale?: string;
    country?: string;
    timezone?: string;
  },
): Promise<UserRow> {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users (tenant_id, email, password_hash, display_name, role, locale, country, timezone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, tenant_id, email, display_name, role, locale, country, timezone, created_at, token_version, totp_secret, totp_enabled_at`,
    [
      input.tenantId,
      input.email,
      input.passwordHash,
      input.displayName,
      input.role ?? 'member',
      input.locale ?? 'sv',
      input.country ?? 'SE',
      input.timezone ?? 'Europe/Stockholm',
    ],
  );
  const user = rows[0]!;
  await client.query(
    `INSERT INTO profiles (user_id, tenant_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [user.id, input.tenantId],
  );
  return user;
}

// ------------------------------------------------------------------ profile ---

interface ProfileRow {
  why_statement: string | null;
  future_self: Record<string, string> | null;
  phase: string;
}

export async function getProfile(
  client: Client,
  userId: string,
  user: Pick<UserRow, 'timezone' | 'country' | 'tenant_id'>,
): Promise<RecoveryProfile> {
  const { rows } = await client.query<ProfileRow>(
    'SELECT why_statement, future_self, phase FROM profiles WHERE user_id = $1',
    [userId],
  );
  const row = rows[0];
  return {
    whyStatement: decryptField(row?.why_statement ?? null, {
      tenantId: user.tenant_id,
      table: 'profiles',
      column: 'why_statement',
      ownerId: userId,
    }),
    futureSelf: (row?.future_self as RecoveryProfile['futureSelf']) ?? null,
    phase: (row?.phase as RecoveryProfile['phase']) ?? 'insight',
    timezone: user.timezone,
    country: user.country,
  };
}

export async function updateProfile(
  client: Client,
  userId: string,
  tenantId: string,
  patch: { whyStatement?: string | null; futureSelf?: Record<string, string>; phase?: string },
): Promise<void> {
  await client.query(
    `INSERT INTO profiles (user_id, tenant_id, why_statement, future_self, phase, updated_at)
     VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), COALESCE($5, 'insight'), now())
     ON CONFLICT (user_id) DO UPDATE SET
       why_statement = COALESCE($3, profiles.why_statement),
       future_self   = COALESCE($4::jsonb, profiles.future_self),
       phase         = COALESCE($5, profiles.phase),
       updated_at    = now()`,
    [
      userId,
      tenantId,
      encryptField(patch.whyStatement ?? null, {
        tenantId,
        table: 'profiles',
        column: 'why_statement',
        ownerId: userId,
      }),
      patch.futureSelf ? JSON.stringify(patch.futureSelf) : null,
      patch.phase ?? null,
    ],
  );
}

// --------------------------------------------------------------------- quit ---

interface QuitRow {
  id: string;
  substance: string;
  started_at: Date;
  baseline_units_per_day: string;
  unit_cost_minor: number;
  currency: string;
  minutes_per_unit: number;
  status: 'active' | 'paused' | 'archived';
}

function toQuitPlan(row: QuitRow): QuitPlan {
  return {
    id: row.id,
    substance: row.substance as QuitPlan['substance'],
    startedAt: row.started_at,
    baselineUnitsPerDay: Number(row.baseline_units_per_day),
    unitCostMinor: row.unit_cost_minor,
    currency: row.currency,
    minutesPerUnit: row.minutes_per_unit,
    status: row.status,
  };
}

const QUIT_COLUMNS =
  'id, substance, started_at, baseline_units_per_day, unit_cost_minor, currency, minutes_per_unit, status';

export async function getActiveQuit(client: Client, userId: string): Promise<QuitPlan | null> {
  const { rows } = await client.query<QuitRow>(
    `SELECT ${QUIT_COLUMNS} FROM quits
     WHERE user_id = $1 AND status = 'active'
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ? toQuitPlan(rows[0]) : null;
}

export async function createQuit(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    substance: string;
    startedAt: Date;
    baselineUnitsPerDay: number;
    unitCostMinor: number;
    currency: string;
    minutesPerUnit: number;
  },
): Promise<QuitPlan> {
  // One active plan at a time. Starting a new one archives the old rather than
  // deleting it — the history is the point.
  await client.query(
    `UPDATE quits SET status = 'archived' WHERE user_id = $1 AND status = 'active'`,
    [input.userId],
  );
  const { rows } = await client.query<QuitRow>(
    `INSERT INTO quits (tenant_id, user_id, substance, started_at, baseline_units_per_day,
                        unit_cost_minor, currency, minutes_per_unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${QUIT_COLUMNS}`,
    [
      input.tenantId,
      input.userId,
      input.substance,
      input.startedAt,
      input.baselineUnitsPerDay,
      input.unitCostMinor,
      input.currency,
      input.minutesPerUnit,
    ],
  );
  return toQuitPlan(rows[0]!);
}

// ----------------------------------------------------------------- relapses ---

export async function listRelapses(
  client: Client,
  userId: string,
  tenantId?: string,
): Promise<RelapseEvent[]> {
  const { rows } = await client.query<{
    id: string;
    quit_id: string;
    occurred_at: Date;
    note: string | null;
    autopsy: RelapseEvent['autopsy'];
  }>(
    `SELECT id, quit_id, occurred_at, note, autopsy FROM relapses
     WHERE user_id = $1 ORDER BY occurred_at ASC`,
    [userId],
  );
  const open = (value: string | null): string | null =>
    tenantId
      ? decryptField(value, { tenantId, table: 'relapses', column: 'note', ownerId: userId })
      : value;
  return rows.map((r) => ({
    id: r.id,
    quitId: r.quit_id,
    occurredAt: r.occurred_at,
    note: open(r.note),
    autopsy: r.autopsy ?? null,
  }));
}

export async function recordRelapse(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    quitId: string;
    occurredAt: Date;
    note?: string | null;
    autopsy?: unknown;
    protectionPlan?: unknown;
  },
): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO relapses (tenant_id, user_id, quit_id, occurred_at, note, autopsy, protection_plan)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING id`,
    [
      input.tenantId,
      input.userId,
      input.quitId,
      input.occurredAt,
      encryptField(input.note ?? null, {
        tenantId: input.tenantId,
        table: 'relapses',
        column: 'note',
        ownerId: input.userId,
      }),
      input.autopsy ? JSON.stringify(input.autopsy) : null,
      input.protectionPlan ? JSON.stringify(input.protectionPlan) : null,
    ],
  );
  return rows[0]!;
}

// ---------------------------------------------------------------- check-ins ---

interface CheckInRow {
  id: string;
  kind: 'morning' | 'evening';
  day: string;
  created_at: Date;
  mood: number | null;
  sleep_quality: number | null;
  stress: number | null;
  craving_intensity: number | null;
  biggest_risk: string | null;
  went_well: string | null;
  was_hard: string | null;
  learned: string | null;
  note: string | null;
}

/** The narrative columns on a check-in. All five are somebody's own words. */
const CHECK_IN_TEXT = ['biggest_risk', 'went_well', 'was_hard', 'learned', 'note'] as const;

function toCheckIn(row: CheckInRow, ref?: { tenantId: string; ownerId: string }): CheckIn {
  const open = (value: string | null, column: string): string | null =>
    ref
      ? decryptField(value, {
          tenantId: ref.tenantId,
          table: 'check_ins',
          column,
          ownerId: ref.ownerId,
        })
      : value;
  return {
    id: row.id,
    kind: row.kind,
    // `date` columns come back as `YYYY-MM-DD` strings; keep them that way so a
    // timezone conversion cannot shift someone's day.
    day: typeof row.day === 'string' ? row.day : new Date(row.day).toISOString().slice(0, 10),
    createdAt: row.created_at,
    mood: row.mood,
    sleepQuality: row.sleep_quality,
    stress: row.stress,
    cravingIntensity: row.craving_intensity,
    biggestRisk: open(row.biggest_risk, 'biggest_risk'),
    wentWell: open(row.went_well, 'went_well'),
    wasHard: open(row.was_hard, 'was_hard'),
    learned: open(row.learned, 'learned'),
    note: open(row.note, 'note'),
  };
}

export async function listCheckIns(
  client: Client,
  userId: string,
  sinceDays = 90,
  tenantId?: string,
): Promise<CheckIn[]> {
  const { rows } = await client.query<CheckInRow>(
    `SELECT id, kind, day::text AS day, created_at, mood, sleep_quality, stress,
            craving_intensity, biggest_risk, went_well, was_hard, learned, note
     FROM check_ins
     WHERE user_id = $1 AND created_at > now() - ($2 || ' days')::interval
     ORDER BY created_at ASC`,
    [userId, String(sinceDays)],
  );
  return rows.map((row) => toCheckIn(row, tenantId ? { tenantId, ownerId: userId } : undefined));
}

export async function upsertCheckIn(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    kind: 'morning' | 'evening';
    day: string;
    mood?: number | null;
    sleepQuality?: number | null;
    stress?: number | null;
    cravingIntensity?: number | null;
    biggestRisk?: string | null;
    keyDecision?: string | null;
    wentWell?: string | null;
    wasHard?: string | null;
    learned?: string | null;
    note?: string | null;
  },
): Promise<CheckIn> {
  const seal = (value: string | null, column: string): string | null =>
    encryptField(value, {
      tenantId: input.tenantId,
      table: 'check_ins',
      column,
      ownerId: input.userId,
    });
  const { rows } = await client.query<CheckInRow>(
    `INSERT INTO check_ins (tenant_id, user_id, kind, day, mood, sleep_quality, stress,
                            craving_intensity, biggest_risk, key_decision, went_well,
                            was_hard, learned, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id, day, kind) DO UPDATE SET
       mood = EXCLUDED.mood,
       sleep_quality = EXCLUDED.sleep_quality,
       stress = EXCLUDED.stress,
       craving_intensity = EXCLUDED.craving_intensity,
       biggest_risk = EXCLUDED.biggest_risk,
       key_decision = EXCLUDED.key_decision,
       went_well = EXCLUDED.went_well,
       was_hard = EXCLUDED.was_hard,
       learned = EXCLUDED.learned,
       note = EXCLUDED.note
     RETURNING id, kind, day::text AS day, created_at, mood, sleep_quality, stress,
               craving_intensity, biggest_risk, went_well, was_hard, learned, note`,
    [
      input.tenantId,
      input.userId,
      input.kind,
      input.day,
      input.mood ?? null,
      input.sleepQuality ?? null,
      input.stress ?? null,
      input.cravingIntensity ?? null,
      seal(input.biggestRisk ?? null, 'biggest_risk'),
      input.keyDecision ?? null,
      seal(input.wentWell ?? null, 'went_well'),
      seal(input.wasHard ?? null, 'was_hard'),
      seal(input.learned ?? null, 'learned'),
      seal(input.note ?? null, 'note'),
    ],
  );
  return toCheckIn(rows[0]!, { tenantId: input.tenantId, ownerId: input.userId });
}

// ----------------------------------------------------------------- cravings ---

interface CravingRow {
  id: string;
  occurred_at: Date;
  intensity: number;
  feeling: string;
  location: string;
  trigger: string | null;
  thought: string | null;
  action_taken: string | null;
  outcome: 'resisted' | 'used' | 'unknown';
  note: string | null;
}

function toCraving(row: CravingRow, ref?: { tenantId: string; ownerId: string }): CravingLog {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    intensity: row.intensity,
    feeling: row.feeling as CravingLog['feeling'],
    location: row.location as CravingLog['location'],
    trigger: row.trigger,
    thought: row.thought,
    actionTaken: row.action_taken,
    outcome: row.outcome,
    note: ref
      ? decryptField(row.note, {
          tenantId: ref.tenantId,
          table: 'cravings',
          column: 'note',
          ownerId: ref.ownerId,
        })
      : row.note,
  };
}

const CRAVING_COLUMNS =
  'id, occurred_at, intensity, feeling, location, trigger, thought, action_taken, outcome, note';

export async function listCravings(
  client: Client,
  userId: string,
  sinceDays = 90,
  tenantId?: string,
): Promise<CravingLog[]> {
  const { rows } = await client.query<CravingRow>(
    `SELECT ${CRAVING_COLUMNS} FROM cravings
     WHERE user_id = $1 AND occurred_at > now() - ($2 || ' days')::interval
     ORDER BY occurred_at ASC`,
    [userId, String(sinceDays)],
  );
  return rows.map((row) => toCraving(row, tenantId ? { tenantId, ownerId: userId } : undefined));
}

export async function createCraving(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    intensity: number;
    feeling: string;
    location: string;
    trigger?: string | null;
    thought?: string | null;
    actionTaken?: string | null;
    outcome?: 'resisted' | 'used' | 'unknown';
    note?: string | null;
  },
): Promise<CravingLog> {
  const { rows } = await client.query<CravingRow>(
    `INSERT INTO cravings (tenant_id, user_id, intensity, feeling, location, trigger,
                           thought, action_taken, outcome, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${CRAVING_COLUMNS}`,
    [
      input.tenantId,
      input.userId,
      input.intensity,
      input.feeling,
      input.location,
      input.trigger ?? null,
      input.thought ?? null,
      input.actionTaken ?? null,
      input.outcome ?? 'unknown',
      encryptField(input.note ?? null, {
        tenantId: input.tenantId,
        table: 'cravings',
        column: 'note',
        ownerId: input.userId,
      }),
    ],
  );
  return toCraving(rows[0]!, { tenantId: input.tenantId, ownerId: input.userId });
}

export async function updateCravingOutcome(
  client: Client,
  userId: string,
  cravingId: string,
  outcome: 'resisted' | 'used' | 'unknown',
  actionTaken?: string | null,
  tenantId?: string,
): Promise<CravingLog | null> {
  const { rows } = await client.query<CravingRow>(
    `UPDATE cravings SET outcome = $3, action_taken = COALESCE($4, action_taken)
     WHERE user_id = $1 AND id = $2
     RETURNING ${CRAVING_COLUMNS}`,
    [userId, cravingId, outcome, actionTaken ?? null],
  );
  return rows[0]
    ? toCraving(rows[0], tenantId ? { tenantId, ownerId: userId } : undefined)
    : null;
}

// --------------------------------------------------------- support network ---

export async function listSupportContacts(
  client: Client,
  userId: string,
  tenantId?: string,
): Promise<SupportContact[]> {
  const { rows } = await client.query<{
    id: string;
    name: string;
    relation: string;
    phone: string | null;
    is_primary: boolean;
  }>(
    `SELECT id, name, relation, phone, is_primary FROM support_contacts
     WHERE user_id = $1 ORDER BY is_primary DESC, created_at ASC`,
    [userId],
  );
  const open = (value: string | null, column: string): string | null =>
    tenantId
      ? decryptField(value, { tenantId, table: 'support_contacts', column, ownerId: userId })
      : value;
  return rows.map((r) => ({
    id: r.id,
    // A support contact is somebody else's name and phone number — third-party
    // personal data this person volunteered, and the thing a leaked backup
    // would expose about people who never signed up for anything.
    name: open(r.name, 'name') ?? '',
    relation: r.relation,
    phone: open(r.phone, 'phone'),
    isPrimary: r.is_primary,
  }));
}

export async function createSupportContact(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    name: string;
    relation: string;
    phone?: string | null;
    note?: string | null;
    isPrimary?: boolean;
  },
): Promise<SupportContact> {
  if (input.isPrimary) {
    await client.query('UPDATE support_contacts SET is_primary = false WHERE user_id = $1', [
      input.userId,
    ]);
  }
  const seal = (value: string | null, column: string): string | null =>
    encryptField(value, {
      tenantId: input.tenantId,
      table: 'support_contacts',
      column,
      ownerId: input.userId,
    });
  const { rows } = await client.query<{
    id: string;
    name: string;
    relation: string;
    phone: string | null;
    is_primary: boolean;
  }>(
    `INSERT INTO support_contacts (tenant_id, user_id, name, relation, phone, note, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, relation, phone, is_primary`,
    [
      input.tenantId,
      input.userId,
      seal(input.name, 'name'),
      input.relation,
      seal(input.phone ?? null, 'phone'),
      seal(input.note ?? null, 'note'),
      input.isPrimary ?? false,
    ],
  );
  const row = rows[0]!;
  // Returned from the caller's own input rather than by decrypting what came
  // back: the values are already in hand, and a round trip through the
  // ciphertext would only add a way to get it wrong.
  return {
    id: row.id,
    name: input.name,
    relation: row.relation,
    phone: input.phone ?? null,
    isPrimary: row.is_primary,
  };
}

export async function deleteSupportContact(
  client: Client,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await client.query('DELETE FROM support_contacts WHERE user_id = $1 AND id = $2', [
    userId,
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// ------------------------------------------------------------ coach memory ---

export interface CoachMessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: string;
  safety_level: string;
  created_at: Date;
}

export async function listCoachMessages(
  client: Client,
  userId: string,
  limit = 20,
  tenantId?: string,
): Promise<CoachMessageRow[]> {
  const { rows } = await client.query<CoachMessageRow>(
    `SELECT id, role, content, mode, safety_level, created_at FROM coach_messages
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  // Decrypted on the way out. The tenant is optional only because some
  // internal callers already hold the row's tenant implicitly through the
  // transaction; when it is absent the AAD cannot be rebuilt, so a ciphertext
  // is returned as-is rather than silently mangled — and the caller that
  // forgot it sees an envelope, not a plausible wrong answer.
  return rows.reverse().map((row) =>
    tenantId
      ? {
          ...row,
          content:
            decryptField(row.content, {
              tenantId,
              table: 'coach_messages',
              column: 'content',
              ownerId: userId,
            }) ?? '',
        }
      : row,
  );
}

export async function appendCoachMessage(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    mode: string;
    safetyLevel: string;
  },
): Promise<void> {
  const content = encryptField(input.content, {
    tenantId: input.tenantId,
    table: 'coach_messages',
    column: 'content',
    ownerId: input.userId,
  });
  await client.query(
    `INSERT INTO coach_messages (tenant_id, user_id, role, content, mode, safety_level)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.tenantId, input.userId, input.role, content, input.mode, input.safetyLevel],
  );
}

// ---------------------------------------------------------- trigger map ---

/**
 * The chain the spec asks for: trigger → thought → feeling → impulse → action →
 * consequence. Stored as one JSON object per named trigger, because the value is
 * in seeing the whole chain at once, not in querying the links separately.
 */
export interface TriggerChain {
  thought?: string;
  feeling?: string;
  impulse?: string;
  action?: string;
  consequence?: string;
}

export interface TriggerRow {
  id: string;
  label: string;
  category: string;
  chain: TriggerChain;
  created_at: Date;
}

export async function listTriggers(
  client: Client,
  userId: string,
  tenantId?: string,
): Promise<TriggerRow[]> {
  const { rows } = await client.query<TriggerRow>(
    'SELECT id, label, category, chain, created_at FROM triggers WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  // A trigger label is short but not harmless — "seeing my ex", "payday",
  // "when he calls" is a sentence about somebody's life.
  return tenantId
    ? rows.map((r) => ({
        ...r,
        label:
          decryptField(r.label, {
            tenantId,
            table: 'triggers',
            column: 'label',
            ownerId: userId,
          }) ?? '',
      }))
    : rows;
}

export async function createTrigger(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    label: string;
    category: string;
    chain: TriggerChain;
  },
): Promise<TriggerRow> {
  const { rows } = await client.query<TriggerRow>(
    `INSERT INTO triggers (tenant_id, user_id, label, category, chain)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, label, category, chain, created_at`,
    [
      input.tenantId,
      input.userId,
      encryptField(input.label, {
        tenantId: input.tenantId,
        table: 'triggers',
        column: 'label',
        ownerId: input.userId,
      }),
      input.category,
      JSON.stringify(input.chain),
    ],
  );
  return { ...rows[0]!, label: input.label };
}

export async function deleteTrigger(
  client: Client,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await client.query('DELETE FROM triggers WHERE user_id = $1 AND id = $2', [
    userId,
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// ------------------------------------------------------ rebuild my life ---

export interface LifeDomainRow {
  domain: string;
  status: 'untouched' | 'working' | 'steady';
  note: string | null;
  updated_at: Date;
}

export async function listLifeDomains(
  client: Client,
  userId: string,
  tenantId?: string,
): Promise<LifeDomainRow[]> {
  const { rows } = await client.query<LifeDomainRow>(
    'SELECT domain, status, note, updated_at FROM life_domains WHERE user_id = $1',
    [userId],
  );
  return tenantId
    ? rows.map((r) => ({
        ...r,
        note: decryptField(r.note, {
          tenantId,
          table: 'life_domains',
          column: 'note',
          ownerId: userId,
        }),
      }))
    : rows;
}

export async function upsertLifeDomain(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    domain: string;
    status: 'untouched' | 'working' | 'steady';
    note?: string | null;
  },
): Promise<LifeDomainRow> {
  const { rows } = await client.query<LifeDomainRow>(
    `INSERT INTO life_domains (tenant_id, user_id, domain, status, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, domain) DO UPDATE SET
       status = EXCLUDED.status,
       note = COALESCE(EXCLUDED.note, life_domains.note),
       updated_at = now()
     RETURNING domain, status, note, updated_at`,
    [
      input.tenantId,
      input.userId,
      input.domain,
      input.status,
      encryptField(input.note ?? null, {
        tenantId: input.tenantId,
        table: 'life_domains',
        column: 'note',
        ownerId: input.userId,
      }),
    ],
  );
  return { ...rows[0]!, note: input.note ?? rows[0]!.note };
}

// ---------------------------------------------------------------- snapshot ---

/**
 * Assemble everything the pure domain functions need in one place, so a route
 * never has to remember which five tables feed the indicators.
 */
export async function loadSnapshot(
  client: Client,
  user: UserRow,
  windowDays = 90,
): Promise<RecoverySnapshot> {
  // Sequential, not `Promise.all`: these share a single pooled connection inside
  // one transaction, and node-postgres would serialise them anyway while warning
  // about overlapping queries on the same client.
  const profile = await getProfile(client, user.id, user);
  const quit = await getActiveQuit(client, user.id);
  const relapses = await listRelapses(client, user.id, user.tenant_id);
  const checkIns = await listCheckIns(client, user.id, windowDays, user.tenant_id);
  const cravings = await listCravings(client, user.id, windowDays, user.tenant_id);
  const supportContacts = await listSupportContacts(client, user.id, user.tenant_id);
  return { profile, quit, relapses, checkIns, cravings, supportContacts };
}

export async function writeAudit(
  client: Client,
  input: { tenantId: string; userId: string | null; action: string; meta?: unknown },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (tenant_id, user_id, action, meta) VALUES ($1, $2, $3, $4::jsonb)`,
    [input.tenantId, input.userId, input.action, JSON.stringify(input.meta ?? {})],
  );
}

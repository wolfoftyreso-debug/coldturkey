-- Cleat initial schema.
--
-- Multi-tenancy model: a single shared schema with a `tenant_id` column on every
-- tenant-scoped table, enforced by PostgreSQL row-level security rather than by
-- application code. Every request runs inside a transaction that sets
-- `app.tenant_id`; without it, `current_setting` returns NULL, the policy
-- predicate evaluates to NULL, and the query returns nothing.
--
-- That default matters more here than in most products. Recovery data leaking
-- across tenant boundaries is not a bug report, it is a disclosure of someone's
-- addiction history to their employer or clinic. A forgotten `WHERE tenant_id =`
-- in one hand-written query should return zero rows, not somebody else's.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- tenants ---
-- Not row-level secured: tenants must be resolvable before a tenant context
-- exists (that is what login does). Access is confined to `withoutTenant()`.
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'standard',
  -- Per-tenant switches: whether self-signup is open, which locale to default
  -- to, whether a clinic wants the coach disabled, and so on.
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- ------------------------------------------------------------------ users ---
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         text NOT NULL,
  password_hash text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  locale        text NOT NULL DEFAULT 'sv',
  country       text NOT NULL DEFAULT 'SE',
  timezone      text NOT NULL DEFAULT 'Europe/Stockholm',
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz,
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX users_tenant_email_key ON users (tenant_id, lower(email));

-- --------------------------------------------------------- refresh tokens ---
-- Only the hash is stored. A database dump must not hand out live sessions.
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

-- --------------------------------------------------------------- profiles ---
CREATE TABLE profiles (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  why_statement text,
  future_self   jsonb NOT NULL DEFAULT '{}'::jsonb,
  phase         text NOT NULL DEFAULT 'insight',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ quits ---
CREATE TABLE quits (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  substance              text NOT NULL,
  started_at             timestamptz NOT NULL,
  baseline_units_per_day numeric(10, 2) NOT NULL DEFAULT 0,
  -- Money is stored in minor units as an integer. Floats and money do not mix,
  -- and this number is shown to someone counting what they have bought back.
  unit_cost_minor        integer NOT NULL DEFAULT 0,
  currency               text NOT NULL DEFAULT 'SEK',
  minutes_per_unit       integer NOT NULL DEFAULT 30,
  status                 text NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'paused', 'archived')),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quits_user_idx ON quits (user_id, status);

-- --------------------------------------------------------------- relapses ---
CREATE TABLE relapses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quit_id         uuid NOT NULL REFERENCES quits(id) ON DELETE CASCADE,
  occurred_at     timestamptz NOT NULL,
  note            text,
  autopsy         jsonb,
  protection_plan jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX relapses_user_idx ON relapses (user_id, occurred_at DESC);

-- -------------------------------------------------------------- check-ins ---
CREATE TABLE check_ins (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('morning', 'evening')),
  day               date NOT NULL,
  mood              smallint CHECK (mood BETWEEN 0 AND 10),
  sleep_quality     smallint CHECK (sleep_quality BETWEEN 0 AND 10),
  stress            smallint CHECK (stress BETWEEN 0 AND 10),
  craving_intensity smallint CHECK (craving_intensity BETWEEN 0 AND 10),
  biggest_risk      text,
  key_decision      text,
  went_well         text,
  was_hard          text,
  learned           text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX check_ins_unique ON check_ins (user_id, day, kind);
CREATE INDEX check_ins_user_idx ON check_ins (user_id, created_at DESC);

-- --------------------------------------------------------------- cravings ---
CREATE TABLE cravings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  intensity    smallint NOT NULL CHECK (intensity BETWEEN 0 AND 10),
  feeling      text NOT NULL,
  location     text NOT NULL,
  trigger      text,
  thought      text,
  action_taken text,
  outcome      text NOT NULL DEFAULT 'unknown'
                 CHECK (outcome IN ('resisted', 'used', 'unknown')),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cravings_user_idx ON cravings (user_id, occurred_at DESC);

-- ------------------------------------------------------------ trigger map ---
CREATE TABLE triggers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      text NOT NULL,
  category   text NOT NULL DEFAULT 'other',
  -- trigger → thought → feeling → impulse → action → consequence
  chain      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX triggers_user_idx ON triggers (user_id);

-- ------------------------------------------------------- support contacts ---
CREATE TABLE support_contacts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  relation   text NOT NULL DEFAULT '',
  phone      text,
  note       text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_contacts_user_idx ON support_contacts (user_id);

-- --------------------------------------------------------- coach messages ---
CREATE TABLE coach_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('user', 'assistant')),
  content      text NOT NULL,
  mode         text NOT NULL DEFAULT 'general',
  safety_level text NOT NULL DEFAULT 'none',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_messages_user_idx ON coach_messages (user_id, created_at DESC);

-- -------------------------------------------------------------- audit log ---
CREATE TABLE audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant_id, created_at DESC);

-- ------------------------------------------------------ row-level security --
-- FORCE is the important word: without it the table owner (which is who the
-- application usually connects as in a small deployment) silently bypasses every
-- policy below, and the isolation is decorative.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'refresh_tokens', 'profiles', 'quits', 'relapses',
    'check_ins', 'cravings', 'triggers', 'support_contacts',
    'coach_messages', 'audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END
$$;

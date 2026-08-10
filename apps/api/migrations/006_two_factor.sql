-- Two-factor authentication.
--
-- An account here is not a shopping history. Somebody who takes one over can
-- read a relapse log and a coach transcript, which is the raw material for
-- blackmail, a custody dispute, or an employer who was never meant to know. A
-- password plus an email address is thin protection for that, and email is
-- exactly what a controlling partner with access to the household account
-- already has.
--
-- Optional, not mandatory. Forcing an authenticator app on somebody in early
-- recovery — often the same week they are least able to deal with one more
-- obstacle — would push people away from a tool they need. It is offered and
-- it is real when switched on.

ALTER TABLE users
  -- Encrypted with the field-encryption keyring before it is written, so a
  -- leaked backup does not hand out the ability to mint codes. Storing a TOTP
  -- secret in the clear next to a password hash defeats most of the point of
  -- having a second factor at all.
  ADD COLUMN totp_secret text,
  ADD COLUMN totp_enabled_at timestamptz;

CREATE TABLE totp_recovery_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Only the hash. These are passwords by another name.
  code_hash  text NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX totp_recovery_user_idx ON totp_recovery_codes (user_id) WHERE used_at IS NULL;
CREATE UNIQUE INDEX totp_recovery_hash_idx ON totp_recovery_codes (code_hash);

ALTER TABLE totp_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE totp_recovery_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON totp_recovery_codes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Login challenges.
--
-- When a second factor is enabled, a correct password no longer produces
-- tokens; it produces a short-lived challenge that the code completes. The
-- challenge is stored rather than signed so it can be consumed exactly once
-- and revoked, and so a stolen challenge cannot be replayed after use.
CREATE TABLE login_challenges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  -- Deliberately short. It exists only for the seconds between a password and
  -- a six-digit code.
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_challenges_expires_idx ON login_challenges (expires_at);

ALTER TABLE login_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON login_challenges
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

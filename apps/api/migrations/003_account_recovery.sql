-- Account recovery and email verification.
--
-- Until now a forgotten password meant a permanently lost account, and an
-- account here holds the record of the hardest thing somebody has done. That
-- made "log in again" the single most destructive failure in the product, and
-- the per-account login lockout added alongside it made the window worse: five
-- wrong guesses and the right password is refused for fifteen minutes with no
-- way back.
--
-- Design notes that matter:
--
--   * Only hashes are stored. A leaked database must not hand over working
--     reset links, exactly as it must not hand over working refresh tokens.
--   * Tokens are single use and short lived, and using one revokes every
--     refresh token for that user — a password reset is also the thing you do
--     when you think somebody else is in your account.
--   * Rows are kept after use rather than deleted, so "this link was already
--     used" is answerable, and so an audit shows the reset happened.

CREATE TABLE account_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose      text NOT NULL CHECK (purpose IN ('password_reset', 'email_verification')),
  token_hash   text NOT NULL UNIQUE,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  -- Recorded to make abuse visible in the audit trail, not to profile anyone.
  requested_ip inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- The lookup on the hot path: find the live token for this purpose.
CREATE INDEX account_tokens_user_purpose_idx
  ON account_tokens (user_id, purpose)
  WHERE consumed_at IS NULL;

-- Lets the cleanup job find expired rows without scanning the table.
CREATE INDEX account_tokens_expires_idx ON account_tokens (expires_at);

ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

-- Everyone who already exists keeps working. Verification gates new sign-ups
-- from here on; retroactively locking out existing accounts to enforce a
-- policy added later would be the product punishing people for its own
-- timeline.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

-- Same isolation as every other tenant-scoped table, including FORCE so that
-- the table owner is subject to it too. Written out rather than folded into
-- the loop in 001 because that loop has already run on existing databases.
ALTER TABLE account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON account_tokens
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
